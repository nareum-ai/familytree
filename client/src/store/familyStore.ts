import { create } from 'zustand';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/firebase';
import type { Person, Relationship, BranchType, ApprovalRequest } from '../types';
import { DEFAULT_PERMISSIONS } from '../types/permissions';
import { parseKoreanName } from '../utils/nameParser';
import { hashPassword } from '../utils/crypto';
import type { Member } from '../types';
import { LS } from '../lib/storageKeys';

const LS_USER_KEY     = LS.USER_NAME;
const LS_FAMILY_ID    = LS.FAMILY_ID;
const LS_MEMBER_ID    = LS.MEMBER_ID;
const LS_ACCOUNT_NAME = LS.ACCOUNT_NAME;
const ADMIN_NAME     = '관리자';

interface FamilyState {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  viewpointPersonId: string | null;
  currentFamilyId: string | null;
  loading: boolean;
  focusRequest: { personId: string; branchId: BranchType } | null;
  infoRequestPersonId: string | null;

  init: () => () => void;
  setViewpoint: (id: string | null) => void;
  requestFocus: (personId: string, branchId: BranchType) => void;
  clearFocusRequest: () => void;
  openInfoRequest: (personId: string) => void;
  closeInfoRequest: () => void;
  addPerson: (data: Partial<Person>) => Promise<Person>;
  updatePerson: (id: string, data: Partial<Person>) => Promise<Person>;
  deletePerson: (id: string) => Promise<void>;
  addRelationship: (data: { person1_id: string; person2_id: string; type: string }) => Promise<Relationship>;
  deleteRelationshipsByPerson: (personId: string) => Promise<void>;
  selectPerson: (id: string | null) => void;
  createInvite: (person_id: string) => Promise<string>;

  // 정보공개 요청
  grantedPersonIds: Set<string>;
  loadGrantedAccess: () => Promise<void>;
  createInfoRequest: (targetPersonId: string) => Promise<void>;
  loadInfoRequestsForMe: () => Promise<Array<{ id: string; requesterName: string; personId: string; createdAt: string }>>;
  approveInfoRequest: (requestId: string, requesterMemberId: string, personId: string) => Promise<void>;
  rejectInfoRequest:  (requestId: string) => Promise<void>;

  // 회원 인증
  registerMember: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginMember: (username: string, password: string) => Promise<Member | null>;
  ensureAdminAccount: () => Promise<void>;

  submitFamilyGroupRequest: (
    realName: string, description: string,
    gender: 'male' | 'female', birthDate: string | null, birthLunar: boolean
  ) => Promise<void>;
  checkPendingFamilyRequest: () => Promise<{ id: string; realName: string; createdAt: string } | null>;
  cancelFamilyGroupRequest: (requestId: string) => Promise<void>;

  // 어드민 전용
  loadApprovalRequests: () => Promise<ApprovalRequest[]>;
  listMembers: () => Promise<Member[]>;
  mapMemberToPerson: (memberId: string, personId: string, familyId: string, personName: string) => Promise<void>;
  deleteMember: (memberId: string) => Promise<void>;
  isPersonMapped: (personId: string) => Promise<boolean>;
  approveRequest: (requestId: string, requestedName: string) => Promise<string>;
  rejectRequest: (requestId: string) => Promise<void>;
  listFamilies: () => Promise<Array<{ familyId: string; rootName: string; createdAt: string; disabled: boolean; rootPersonId: string }>>;
  toggleFamilyStatus: (rootPersonId: string, disabled: boolean) => Promise<void>;
  deleteFamily: (familyId: string) => Promise<void>;
  switchToFamily: (familyId: string) => void;
}

export { ADMIN_NAME };

export const useFamilyStore = create<FamilyState>((set, get) => ({
  persons: [],
  relationships: [],
  selectedPersonId: null,
  viewpointPersonId: sessionStorage.getItem('viewpointPersonId'),
  currentFamilyId: localStorage.getItem(LS_FAMILY_ID),
  loading: true,
  focusRequest: null,
  infoRequestPersonId: null,
  grantedPersonIds: new Set<string>(),

  init: () => {
    const familyId = get().currentFamilyId;
    if (!familyId) {
      set({ loading: false });
      return () => {};
    }

    const timeout = setTimeout(() => set({ loading: false }), 8000);
    let personsReady = false;
    let relsReady = false;
    let unsub1: () => void = () => {};
    let unsub2: () => void = () => {};

    const checkReady = () => {
      if (personsReady && relsReady) {
        clearTimeout(timeout);
        set({ loading: false });
        fixMissingSpouseRels();
        fixMissingParentChildFromSpouse();
        fixMissingNameParts();
        get().loadGrantedAccess();
      }
    };

    // 성/이름 필드가 없는 기존 인물에 자동 파싱 후 저장
    const fixMissingNameParts = async () => {
      const { persons } = get();
      for (const p of persons) {
        if (!p.last_name && !p.first_name) {
          const { lastName, firstName } = parseKoreanName(p.name);
          try {
            await updateDoc(doc(db, 'persons', p.id), {
              last_name: lastName,
              first_name: firstName,
            });
          } catch {}
        }
      }
    };

    // ── 공동자녀 기반 배우자 관계 생성 ──────────────────────────────────────
    const fixMissingSpouseRels = async () => {
      const { persons, relationships } = get();
      const childToParents = new Map<string, string[]>();
      for (const r of relationships) {
        if (r.type !== 'parent_child') continue;
        const list = childToParents.get(r.person2_id) ?? [];
        list.push(r.person1_id);
        childToParents.set(r.person2_id, list);
      }
      const existingPairs = new Set<string>();
      for (const r of relationships) {
        if (r.type !== 'spouse') continue;
        existingPairs.add(`${r.person1_id}|${r.person2_id}`);
        existingPairs.add(`${r.person2_id}|${r.person1_id}`);
      }
      for (const parentIds of childToParents.values()) {
        if (parentIds.length < 2) continue;
        const male   = parentIds.find(pid => persons.find(p => p.id === pid)?.gender === 'male') ?? parentIds[0];
        const female = parentIds.find(pid => pid !== male);
        if (!male || !female) continue;
        if (existingPairs.has(`${male}|${female}`)) continue;
        try {
          await addDoc(collection(db, 'relationships'), {
            person1_id: male, person2_id: female, type: 'spouse',
            family_id: get().currentFamilyId,
          });
          existingPairs.add(`${male}|${female}`);
          existingPairs.add(`${female}|${male}`);
        } catch {}
      }
    };

    // ── 배우자 관계에서 누락된 부모-자녀 관계 보정 ──────────────────────────
    const fixMissingParentChildFromSpouse = async () => {
      const { relationships } = get();
      const existing = new Set(
        relationships.map(r => `${r.person1_id}|${r.person2_id}|${r.type}`)
      );
      for (const spouse of relationships) {
        if (spouse.type !== 'spouse') continue;
        const [a, b] = [spouse.person1_id, spouse.person2_id];
        for (const r of relationships) {
          if (r.type !== 'parent_child') continue;
          const [parent, otherParent] = r.person1_id === a ? [a, b] : r.person1_id === b ? [b, a] : [null, null];
          if (!parent || !otherParent) continue;
          const key = `${otherParent}|${r.person2_id}|parent_child`;
          if (!existing.has(key)) {
            try {
              await addDoc(collection(db, 'relationships'), {
                person1_id: otherParent, person2_id: r.person2_id, type: 'parent_child',
                family_id: get().currentFamilyId,
              });
              existing.add(key);
            } catch {}
          }
        }
      }
    };

    // ── family_id 마이그레이션 먼저 실행, 그 다음 실시간 리스너 시작 ──────────
    // 마이그레이션이 필터 쿼리보다 반드시 앞서야 "0건 → 새 루트 생성" 버그 방지
    const startListeners = () => {
      const personsQuery  = query(collection(db, 'persons'),      where('family_id', '==', familyId));
      const relsQuery     = query(collection(db, 'relationships'), where('family_id', '==', familyId));

      unsub1 = onSnapshot(
        personsQuery,
        async (snap) => {
          const persons = snap.docs.map(d => {
            const raw = d.data();
            const name   = (raw.name as string) ?? '';
            const parsed = parseKoreanName(name);
            return {
              ...(raw as Omit<Person, 'id'>),
              id: d.id,
              birth_date:  (raw.birth_date  as string | undefined)  ?? null,
              birth_lunar: (raw.birth_lunar  as boolean | undefined) ?? false,
              is_deceased: (raw.is_deceased  as boolean | undefined) ?? false,
              death_date:  (raw.death_date   as string | undefined)  ?? null,
              death_lunar: (raw.death_lunar  as boolean | undefined) ?? false,
              created_by:  (raw.created_by   as string | undefined)  ?? null,
              permissions: (raw.permissions  as typeof DEFAULT_PERMISSIONS | undefined) ?? DEFAULT_PERMISSIONS,
              family_id:   familyId,
              last_name:   (raw.last_name  as string | undefined)  ?? parsed.lastName,
              first_name:  (raw.first_name as string | undefined)  ?? parsed.firstName,
            } as Person;
          });

          // persons가 0이면 → 관리자가 아직 승인/생성을 안 한 상태
          // 과거처럼 "나" 루트를 자동 생성하지 않음 (관리자 승인 플로우에서 생성됨)
          if (persons.length === 0) {
            set({ loading: false });
            return;
          }

          set({ persons });
          personsReady = true;
          checkReady();
        },
        () => { clearTimeout(timeout); set({ loading: false }); }
      );

      unsub2 = onSnapshot(
        relsQuery,
        (snap) => {
          const relationships = snap.docs.map(d => ({
            ...(d.data() as Omit<Relationship, 'id'>),
            id: d.id,
            family_id: familyId,
          })) as Relationship[];
          set({ relationships });
          relsReady = true;
          checkReady();
        },
        () => { relsReady = true; checkReady(); }
      );
    };

    // family_id 없는 기존 docs를 현재 familyId로 먼저 보정한 뒤 리스너 시작
    (async () => {
      try {
        const checkSnap = await getDocs(
          query(collection(db, 'persons'), where('family_id', '==', familyId))
        );
        if (checkSnap.size === 0) {
          // 마이그레이션 필요: family_id 없는 모든 docs → 현재 familyId
          const allPersons = await getDocs(collection(db, 'persons'));
          const allRels    = await getDocs(collection(db, 'relationships'));
          for (const d of allPersons.docs) {
            if (!d.data().family_id)
              try { await updateDoc(doc(db, 'persons', d.id), { family_id: familyId }); } catch {}
          }
          for (const d of allRels.docs) {
            if (!d.data().family_id)
              try { await updateDoc(doc(db, 'relationships', d.id), { family_id: familyId }); } catch {}
          }
        }
      } finally {
        startListeners();
      }
    })();

    return () => { clearTimeout(timeout); unsub1(); unsub2(); };
  },

  setViewpoint: (id) => {
    if (id) sessionStorage.setItem('viewpointPersonId', id);
    else sessionStorage.removeItem('viewpointPersonId');
    set({ viewpointPersonId: id });
  },

  addPerson: async (personData) => {
    const familyId = get().currentFamilyId ?? 'main';
    const name = personData.name ?? '';
    const { lastName, firstName } = parseKoreanName(name);
    const fields = {
      name,
      last_name:   personData.last_name  ?? lastName,
      first_name:  personData.first_name ?? firstName,
      gender:      personData.gender      ?? null,
      birth_year:  personData.birth_year  ?? null,
      birth_date:  personData.birth_date  ?? null,
      birth_lunar: personData.birth_lunar ?? false,
      photo_url:   personData.photo_url   ?? null,
      is_root:     personData.is_root     ?? 0,
      is_deceased: personData.is_deceased ?? false,
      death_date:  personData.death_date  ?? null,
      death_lunar: personData.death_lunar ?? false,
      // created_by = 계정 아이디 (인물명이 아닌 로그인 계정)
      created_by:  localStorage.getItem(LS_ACCOUNT_NAME) ?? localStorage.getItem(LS_USER_KEY) ?? null,
      permissions: personData.permissions ?? DEFAULT_PERMISSIONS,
      family_id:   familyId,
      created_at:  new Date().toISOString(),
    };
    const ref = await addDoc(collection(db, 'persons'), fields);
    return { ...fields, id: ref.id } as Person;
  },

  updatePerson: async (id, personData) => {
    // 이름이 변경되면 성/이름도 자동 재파싱
    const patch = { ...personData };
    if (personData.name && !personData.last_name && !personData.first_name) {
      const { lastName, firstName } = parseKoreanName(personData.name);
      patch.last_name  = lastName;
      patch.first_name = firstName;
    }
    await updateDoc(doc(db, 'persons', id), { ...patch });
    const updated = get().persons.map(p => p.id === id ? { ...p, ...personData } : p).find(p => p.id === id)!;
    return updated;
  },

  deletePerson: async (id) => {
    await deleteDoc(doc(db, 'persons', id));
    await get().deleteRelationshipsByPerson(id);
    set(s => ({ selectedPersonId: s.selectedPersonId === id ? null : s.selectedPersonId }));
  },

  deleteRelationshipsByPerson: async (personId) => {
    const rels = get().relationships.filter(
      r => r.person1_id === personId || r.person2_id === personId
    );
    await Promise.all(rels.map(r => deleteDoc(doc(db, 'relationships', r.id))));
  },

  addRelationship: async (relData) => {
    const familyId = get().currentFamilyId ?? 'main';
    const ref = await addDoc(collection(db, 'relationships'), {
      ...relData, family_id: familyId,
    });
    return {
      id: ref.id,
      person1_id: relData.person1_id,
      person2_id: relData.person2_id,
      type: relData.type as Relationship['type'],
      family_id: familyId,
    };
  },

  requestFocus: (personId, branchId) => set({ focusRequest: { personId, branchId } }),
  clearFocusRequest: () => set({ focusRequest: null }),
  // 비공개 노드 정보공개 요청 패널 열기/닫기
  // selectedPersonId도 동시에 클리어하여 PersonDetail이 열리지 않도록 함
  openInfoRequest:  (personId) => set({ infoRequestPersonId: personId, selectedPersonId: null }),
  closeInfoRequest: ()         => set({ infoRequestPersonId: null }),
  selectPerson: (id) => set({ selectedPersonId: id }),

  createInvite: async (person_id) => {
    const snap = await getDocs(
      query(collection(db, 'invites'), where('person_id', '==', person_id))
    );
    if (!snap.empty) return snap.docs[0].data().token as string;
    const token = uuidv4();
    await addDoc(collection(db, 'invites'), {
      token, person_id,
      family_id: get().currentFamilyId,
      created_by: localStorage.getItem(LS_USER_KEY) ?? null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    return token;
  },

  // ── 정보공개 요청 ─────────────────────────────────────────────────────────

  loadGrantedAccess: async () => {
    const memberId = localStorage.getItem(LS_MEMBER_ID);
    if (!memberId) return;
    const snap = await getDocs(
      query(collection(db, 'info_access'),
        where('requester_member_id', '==', memberId))
    );
    const ids = new Set(snap.docs.map(d => d.data().person_id as string));
    set({ grantedPersonIds: ids });
  },

  createInfoRequest: async (targetPersonId) => {
    const memberId  = localStorage.getItem(LS_MEMBER_ID);
    const userName  = localStorage.getItem(LS_USER_KEY);
    if (!memberId || !userName) return;

    // 요청자의 person_id 확보 (양방향 접근권 페어 생성에 필요)
    const memberSnap = await getDoc(doc(db, 'members', memberId));
    const requesterPersonId = (memberSnap.data()?.person_id as string | null) ?? null;

    const { persons } = get();
    const target = persons.find(p => p.id === targetPersonId);

    // 권한 보유자: 매핑된 회원 → 없으면 작성자 이름
    // 1순위: 해당 인물에 매핑된 계정
    const holderSnap = await getDocs(
      query(collection(db, 'members'), where('person_id', '==', targetPersonId))
    );
    let holderMemberId: string | null  = holderSnap.empty ? null : holderSnap.docs[0].id;
    let holderName: string             = holderSnap.empty ? ''    : holderSnap.docs[0].data().username as string;

    // 2순위: created_by(계정 아이디)로 계정 찾기
    if (!holderMemberId && target?.created_by) {
      const creatorSnap = await getDocs(
        query(collection(db, 'members'), where('username', '==', target.created_by))
      );
      if (!creatorSnap.empty) {
        holderMemberId = creatorSnap.docs[0].id;
        holderName     = target.created_by;
      } else {
        holderName = target.created_by; // 계정 없음, 이름만
      }
    }
    if (!holderName) holderName = '알 수 없음';

    // 중복 체크
    const dup = await getDocs(query(collection(db, 'info_requests'),
      where('requester_member_id', '==', memberId),
      where('target_person_id',   '==', targetPersonId),
      where('status',             '==', 'pending')
    ));
    if (!dup.empty) return; // 이미 대기 중

    await addDoc(collection(db, 'info_requests'), {
      requester_member_id:  memberId,
      requester_name:       userName,
      requester_person_id:  requesterPersonId,
      target_person_id:     targetPersonId,
      holder_member_id:     holderMemberId,
      holder_name:          holderName,
      status:               'pending',
      created_at:           new Date().toISOString(),
    });
  },

  loadInfoRequestsForMe: async () => {
    // 현재 로그인 회원이 권한 보유자인 요청만 로드
    const memberId = localStorage.getItem(LS_MEMBER_ID);
    if (!memberId) return [];
    const snap = await getDocs(query(collection(db, 'info_requests'),
      where('holder_member_id', '==', memberId),
      where('status',           '==', 'pending')
    ));
    return snap.docs.map(d => ({
      id:            d.id,
      requesterName: d.data().requester_name as string,
      personId:      d.data().target_person_id as string,
      createdAt:     d.data().created_at as string,
    }));
  },

  approveInfoRequest: async (requestId, requesterMemberId, personId) => {
    await updateDoc(doc(db, 'info_requests', requestId), {
      status:      'approved',
      reviewed_at: new Date().toISOString(),
    });

    // 1. 요청자 → 대상인물 접근권 부여
    const dup = await getDocs(query(collection(db, 'info_access'),
      where('requester_member_id', '==', requesterMemberId),
      where('person_id',           '==', personId)
    ));
    if (dup.empty) {
      await addDoc(collection(db, 'info_access'), {
        requester_member_id: requesterMemberId,
        person_id:           personId,
        granted_at:          new Date().toISOString(),
      });
    }

    // 2. 양방향 페어 생성 + 대상인물 계정이 있으면 즉시 역방향 접근권 부여
    const reqSnap = await getDoc(doc(db, 'info_requests', requestId));
    const requesterPersonId = reqSnap.data()?.requester_person_id as string | null;
    if (requesterPersonId) {
      const { persons } = get();
      const familyId = persons[0]?.family_id ?? '';

      // 중복 페어 방지 (양방향 체크)
      const [pa, pb] = await Promise.all([
        getDocs(query(collection(db, 'person_access_pairs'),
          where('person_a_id', '==', requesterPersonId), where('person_b_id', '==', personId))),
        getDocs(query(collection(db, 'person_access_pairs'),
          where('person_a_id', '==', personId), where('person_b_id', '==', requesterPersonId))),
      ]);
      if (pa.empty && pb.empty) {
        await addDoc(collection(db, 'person_access_pairs'), {
          person_a_id: requesterPersonId,
          person_b_id: personId,
          family_id:   familyId,
          created_at:  new Date().toISOString(),
        });
      }

      // 대상인물에 이미 매핑된 계정이 있으면 즉시 역방향 접근권 부여
      const holderSnap = await getDocs(
        query(collection(db, 'members'), where('person_id', '==', personId))
      );
      if (!holderSnap.empty) {
        const holderMemberId = holderSnap.docs[0].id;
        const dupRev = await getDocs(query(collection(db, 'info_access'),
          where('requester_member_id', '==', holderMemberId),
          where('person_id',           '==', requesterPersonId)
        ));
        if (dupRev.empty) {
          await addDoc(collection(db, 'info_access'), {
            requester_member_id: holderMemberId,
            person_id:           requesterPersonId,
            granted_at:          new Date().toISOString(),
          });
        }
      }
    }
  },

  rejectInfoRequest: async (requestId) => {
    await updateDoc(doc(db, 'info_requests', requestId), {
      status:      'rejected',
      reviewed_at: new Date().toISOString(),
    });
  },

  // ── 회원 인증 ──────────────────────────────────────────────────────────────

  registerMember: async (username, password) => {
    // 중복 체크
    const dup = await getDocs(
      query(collection(db, 'members'), where('username', '==', username))
    );
    if (!dup.empty) return { ok: false, error: '이미 사용 중인 아이디입니다.' };
    const pw = await hashPassword(password);
    await addDoc(collection(db, 'members'), {
      username,
      password_hash: pw,
      person_id: null,
      family_id: null,
      person_name: null,
      is_admin: false,
      status: 'active',
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  },

  loginMember: async (username, password) => {
    const pw = await hashPassword(password);
    const snap = await getDocs(
      query(collection(db, 'members'),
        where('username', '==', username),
        where('password_hash', '==', pw))
    );
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...(d.data() as Omit<Member, 'id'>) };
  },

  ensureAdminAccount: async () => {
    const snap = await getDocs(
      query(collection(db, 'members'), where('is_admin', '==', true))
    );
    if (snap.empty) {
      const pw = await hashPassword('admin1234');
      await addDoc(collection(db, 'members'), {
        username: '관리자',
        password_hash: pw,
        person_id: null, family_id: null, person_name: null,
        is_admin: true, status: 'active',
        created_at: new Date().toISOString(),
      });
    }
  },

  checkPendingFamilyRequest: async () => {
    const memberId = localStorage.getItem(LS_MEMBER_ID);
    if (!memberId) return null;
    const snap = await getDocs(query(collection(db, 'approval_requests'),
      where('member_id', '==', memberId),
      where('status',    '==', 'pending')
    ));
    if (snap.empty) return null;
    const d = snap.docs[0];
    return {
      id:        d.id,
      realName:  d.data().requested_name as string,
      createdAt: d.data().created_at as string,
    };
  },

  cancelFamilyGroupRequest: async (requestId) => {
    await deleteDoc(doc(db, 'approval_requests', requestId));
  },

  submitFamilyGroupRequest: async (realName, description, gender, birthDate, birthLunar) => {
    const memberId       = localStorage.getItem(LS_MEMBER_ID);
    const memberUsername = localStorage.getItem(LS_USER_KEY);
    await addDoc(collection(db, 'approval_requests'), {
      requested_name:  realName,
      description,
      gender,
      birth_date:      birthDate,
      birth_lunar:     birthLunar,
      member_id:       memberId,
      member_username: memberUsername,
      status:          'pending',
      created_at:      new Date().toISOString(),
    });
  },

  // ── 어드민 전용 ────────────────────────────────────────────────────────────

  loadApprovalRequests: async () => {
    const snap = await getDocs(
      query(collection(db, 'approval_requests'), where('status', '==', 'pending'))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as ApprovalRequest[];
  },

  approveRequest: async (requestId, requestedName) => {
    const familyId = uuidv4();

    // 요청 정보 가져오기 (member_id 확인)
    const reqDoc  = await getDocs(query(collection(db, 'approval_requests'),
      where('status', '==', 'pending')));
    const reqSnap = reqDoc.docs.find(d => d.id === requestId);
    const memberId = reqSnap?.data().member_id as string | null ?? null;

    // 요청 정보에서 성별/생년월일 가져오기
    const reqData = reqSnap?.data();
    const reqGender     = (reqData?.gender     as string | undefined) ?? null;
    const reqBirthDate  = (reqData?.birth_date  as string | undefined) ?? null;
    const reqBirthLunar = (reqData?.birth_lunar as boolean | undefined) ?? false;

    // 이름 파싱
    const { parseKoreanName } = await import('../utils/nameParser');
    const parsed = parseKoreanName(requestedName);

    // 새 가족집단 root 인물 생성
    const rootPersonRef = await addDoc(collection(db, 'persons'), {
      name:        requestedName,
      gender:      reqGender,
      birth_year:  null,
      birth_date:  reqBirthDate,
      birth_lunar: reqBirthLunar,
      photo_url:   null,
      is_root:     1,
      is_deceased: false, death_date: null, death_lunar: false,
      created_by:  requestedName,
      permissions: DEFAULT_PERMISSIONS,
      family_id:   familyId,
      last_name:   parsed.lastName,
      first_name:  parsed.firstName,
      created_at:  new Date().toISOString(),
    });

    // 요청 상태 업데이트
    await updateDoc(doc(db, 'approval_requests', requestId), {
      status: 'approved',
      family_id: familyId,
      reviewed_at: new Date().toISOString(),
    });

    // member_id가 있으면 해당 계정을 루트 노드에 자동 매핑
    if (memberId) {
      await updateDoc(doc(db, 'members', memberId), {
        person_id:   rootPersonRef.id,
        family_id:   familyId,
        person_name: requestedName,
      });
    }

    return familyId;
  },

  rejectRequest: async (requestId) => {
    await updateDoc(doc(db, 'approval_requests', requestId), {
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
    });
  },

  listMembers: async () => {
    const snap = await getDocs(collection(db, 'members'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Member, 'id'>) }));
  },

  mapMemberToPerson: async (memberId, personId, familyId, personName) => {
    await updateDoc(doc(db, 'members', memberId), {
      person_id:   personId,
      family_id:   familyId,
      person_name: personName,
    });

    // 이 인물과 합의된 양방향 페어가 있으면 즉시 접근권 부여
    const [pairsA, pairsB] = await Promise.all([
      getDocs(query(collection(db, 'person_access_pairs'), where('person_a_id', '==', personId))),
      getDocs(query(collection(db, 'person_access_pairs'), where('person_b_id', '==', personId))),
    ]);
    const partnerIds = [
      ...pairsA.docs.map(d => d.data().person_b_id as string),
      ...pairsB.docs.map(d => d.data().person_a_id as string),
    ];
    for (const partnerId of partnerIds) {
      const dup = await getDocs(query(collection(db, 'info_access'),
        where('requester_member_id', '==', memberId),
        where('person_id',           '==', partnerId)
      ));
      if (dup.empty) {
        await addDoc(collection(db, 'info_access'), {
          requester_member_id: memberId,
          person_id:           partnerId,
          granted_at:          new Date().toISOString(),
        });
      }
    }
  },

  deleteMember: async (memberId: string) => {
    await deleteDoc(doc(db, 'members', memberId));
  },

  isPersonMapped: async (personId: string): Promise<boolean> => {
    const snap = await getDocs(
      query(collection(db, 'members'), where('person_id', '==', personId))
    );
    return !snap.empty;
  },

  listFamilies: async () => {
    const snap = await getDocs(
      query(collection(db, 'persons'), where('is_root', '==', 1))
    );
    const seen = new Set<string>();
    const result: Array<{ familyId: string; rootName: string; createdAt: string; disabled: boolean; rootPersonId: string }> = [];
    for (const d of snap.docs) {
      const fid = (d.data().family_id as string) ?? 'main';
      if (!seen.has(fid)) {
        seen.add(fid);
        result.push({
          familyId: fid,
          rootName: d.data().name as string,
          createdAt: d.data().created_at as string,
          disabled: !!(d.data().family_disabled),
          rootPersonId: d.id,
        });
      }
    }
    return result;
  },

  toggleFamilyStatus: async (rootPersonId: string, disabled: boolean) => {
    await updateDoc(doc(db, 'persons', rootPersonId), { family_disabled: disabled });
  },

  deleteFamily: async (familyId: string) => {
    const [pSnap, rSnap] = await Promise.all([
      getDocs(query(collection(db, 'persons'),      where('family_id', '==', familyId))),
      getDocs(query(collection(db, 'relationships'), where('family_id', '==', familyId))),
    ]);
    await Promise.all([
      ...pSnap.docs.map(d => deleteDoc(doc(db, 'persons', d.id))),
      ...rSnap.docs.map(d => deleteDoc(doc(db, 'relationships', d.id))),
    ]);
  },

  switchToFamily: (familyId) => {
    localStorage.setItem(LS_FAMILY_ID, familyId);
    set({ currentFamilyId: familyId, persons: [], relationships: [], loading: true });
  },
}));
