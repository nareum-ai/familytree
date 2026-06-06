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
import { getChusu } from '../hooks/useTreeLayout';

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
  addRelationship: (data: { person1_id: string; person2_id: string; type: string; is_primary?: boolean }) => Promise<Relationship>;
  updateRelationship: (id: string, data: Partial<Pick<Relationship, 'marriage_date' | 'marriage_lunar' | 'is_primary'>>) => Promise<void>;
  deleteRelationshipsByPerson: (personId: string) => Promise<void>;
  selectPerson: (id: string | null) => void;
  createInvite: (person_id: string) => Promise<string>;

  // 정보공개 요청
  grantedPersonIds: Set<string>;
  loadGrantedAccess: () => Promise<void>;
  createInfoRequest: (targetPersonId: string) => Promise<boolean>; // true = 자동 승인됨
  loadInfoRequestsForMe: () => Promise<Array<{ id: string; requesterName: string; personId: string; createdAt: string }>>;
  approveInfoRequest: (requestId: string, requesterMemberId: string, personId: string) => Promise<void>;
  rejectInfoRequest:  (requestId: string) => Promise<void>;

  // 회원 인증
  registerMember: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginMember: (username: string, password: string) => Promise<Member | null>;
  ensureAdminAccount: () => Promise<void>;
  loginWithGoogle: () => Promise<{ member: Member | null; googleUid: string; googleEmail: string; displayName: string } | null>;
  registerWithGoogle: (googleUid: string, googleEmail: string, displayName: string) => Promise<Member>;
  linkGoogleToMember: (memberId: string, googleUid: string, googleEmail: string) => Promise<{ ok: boolean; error?: string }>;
  unlinkGoogleFromMember: (memberId: string) => Promise<void>;
  saveFcmToken: (memberId: string, token: string, field?: string) => Promise<void>;
  recordLogin: (memberId: string) => Promise<void>;
  requestPasswordReset: (username: string, personName: string, birthDate: string, email: string) => Promise<{ ok: boolean; notFound?: boolean }>;
  resetPasswordWithToken: (token: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  requestAdminPasswordReset: (username: string, personName: string, contactEmail: string, message?: string) => Promise<void>;

  submitFamilyGroupRequest: (
    realName: string, description: string,
    gender: 'male' | 'female', birthDate: string | null, birthLunar: boolean
  ) => Promise<void>;
  checkPendingFamilyRequest: () => Promise<{ id: string; realName: string; createdAt: string } | null>;
  cancelFamilyGroupRequest: (requestId: string) => Promise<void>;

  // 어드민 전용
  loadApprovalRequests: () => Promise<ApprovalRequest[]>;
  loadPasswordResetRequests: () => Promise<import('../types').PasswordResetRequest[]>;
  approvePasswordResetRequest: (requestId: string, username: string, contactEmail: string) => Promise<void>;
  rejectPasswordResetRequest: (requestId: string) => Promise<void>;
  listMembers: () => Promise<Member[]>;
  mapMemberToPerson: (memberId: string, personId: string, familyId: string, personName: string) => Promise<void>;
  consumeInviteToken: (token: string) => Promise<void>;
  deleteMember: (memberId: string) => Promise<void>;
  isPersonMapped: (personId: string) => Promise<boolean>;
  approveRequest: (requestId: string, requestedName: string) => Promise<string>;
  rejectRequest: (requestId: string) => Promise<void>;
  listFamilies: () => Promise<Array<{ familyId: string; rootName: string; createdAt: string; disabled: boolean; rootPersonId: string; personCount: number }>>;
  toggleFamilyStatus: (rootPersonId: string, disabled: boolean) => Promise<void>;
  isFamilyDisabled: (familyId: string) => Promise<boolean>;
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
      phone:       personData.phone  ?? null,
      email:       personData.email  ?? null,
      memo:        personData.memo   ?? null,
    };
    const ref = await addDoc(collection(db, 'persons'), fields);
    const actorName = localStorage.getItem(LS_USER_KEY) ?? '알 수 없음';
    addDoc(collection(db, 'activity_logs'), {
      at: new Date().toISOString(), action: 'add',
      person_name: name, actor_name: actorName, family_id: familyId,
    }).catch(() => {});
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
    const person = get().persons.find(p => p.id === id);
    await deleteDoc(doc(db, 'persons', id));
    await get().deleteRelationshipsByPerson(id);
    if (person) {
      const actorName = localStorage.getItem(LS_USER_KEY) ?? '알 수 없음';
      addDoc(collection(db, 'activity_logs'), {
        at: new Date().toISOString(), action: 'delete',
        person_name: person.name, actor_name: actorName,
        family_id: get().currentFamilyId ?? 'main',
      }).catch(() => {});
    }
    set(s => ({ selectedPersonId: s.selectedPersonId === id ? null : s.selectedPersonId }));
  },

  deleteRelationshipsByPerson: async (personId) => {
    // 로컬 상태 + Firestore 직접 쿼리 병행 — 타이밍 이슈로 로컬에 없는 관계도 삭제
    const localRels = get().relationships.filter(
      r => r.person1_id === personId || r.person2_id === personId
    );
    const [snap1, snap2] = await Promise.all([
      getDocs(query(collection(db, 'relationships'), where('person1_id', '==', personId))),
      getDocs(query(collection(db, 'relationships'), where('person2_id', '==', personId))),
    ]);
    const firestoreIds = new Set([...snap1.docs, ...snap2.docs].map(d => d.id));
    localRels.forEach(r => firestoreIds.add(r.id));
    await Promise.all([...firestoreIds].map(id => deleteDoc(doc(db, 'relationships', id))));
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
      is_primary: relData.is_primary,
    };
  },

  updateRelationship: async (id, data) => {
    await updateDoc(doc(db, 'relationships', id), data as Record<string, unknown>);
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
    const memberId = localStorage.getItem(LS_MEMBER_ID);
    const userName = localStorage.getItem(LS_USER_KEY);
    if (!memberId || !userName) return false;

    const memberSnap = await getDoc(doc(db, 'members', memberId));
    const requesterPersonId = (memberSnap.data()?.person_id as string | null) ?? null;

    const { persons, relationships } = get();
    const target = persons.find(p => p.id === targetPersonId);

    // 2촌 이내(배우자 포함) → 자동 승인
    if (requesterPersonId) {
      const requesterPerson = persons.find(p => p.id === requesterPersonId);
      if (requesterPerson) {
        const chusu = getChusu(targetPersonId, requesterPerson, relationships);
        if (chusu !== null && chusu <= 2) {
          const accessSnap = await getDocs(
            query(collection(db, 'info_access'), where('requester_member_id', '==', memberId))
          );
          if (!accessSnap.docs.some(d => d.data().person_id === targetPersonId)) {
            await addDoc(collection(db, 'info_access'), {
              requester_member_id: memberId,
              person_id:           targetPersonId,
              granted_at:          new Date().toISOString(),
            });
            const { grantedPersonIds } = get();
            set({ grantedPersonIds: new Set([...grantedPersonIds, targetPersonId]) });
          }
          return true;
        }
      }
    }

    let holderMemberId: string | null = null;
    let holderName = '';
    let holderIsAdmin = false;

    // 1순위: 해당 인물에 직접 매핑된 계정
    const holderSnap = await getDocs(
      query(collection(db, 'members'), where('person_id', '==', targetPersonId))
    );
    if (!holderSnap.empty) {
      const d = holderSnap.docs[0];
      holderMemberId = d.id;
      holderName     = d.data().username as string;
      holderIsAdmin  = d.data().is_admin === true;
    }

    // 2순위: created_by 계정 찾기
    if (!holderMemberId && target?.created_by) {
      const creatorSnap = await getDocs(
        query(collection(db, 'members'), where('username', '==', target.created_by))
      );
      if (!creatorSnap.empty) {
        const d = creatorSnap.docs[0];
        holderMemberId = d.id;
        holderName     = target.created_by;
        holderIsAdmin  = d.data().is_admin === true;
      } else {
        holderName = target.created_by;
      }
    }
    if (!holderName) holderName = '알 수 없음';

    // 권한자가 관리자이거나 없으면 → 즉시 자동 승인
    if (!holderMemberId || holderIsAdmin) {
      // 단일 where로 중복 체크 (복합 인덱스 불필요)
      const accessSnap = await getDocs(
        query(collection(db, 'info_access'), where('requester_member_id', '==', memberId))
      );
      const alreadyGranted = accessSnap.docs.some(d => d.data().person_id === targetPersonId);
      if (!alreadyGranted) {
        await addDoc(collection(db, 'info_access'), {
          requester_member_id: memberId,
          person_id:           targetPersonId,
          granted_at:          new Date().toISOString(),
        });
        const { grantedPersonIds } = get();
        set({ grantedPersonIds: new Set([...grantedPersonIds, targetPersonId]) });
      }
      return true; // 자동 승인
    }

    // 일반 회원이 권한자 → 대기 요청 생성
    const reqSnap = await getDocs(
      query(collection(db, 'info_requests'), where('requester_member_id', '==', memberId))
    );
    const alreadyPending = reqSnap.docs.some(
      d => d.data().target_person_id === targetPersonId && d.data().status === 'pending'
    );
    if (alreadyPending) return false;

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
    return false;
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

  requestPasswordReset: async (username, personName, birthDate, email) => {
    const snap = await getDocs(
      query(collection(db, 'members'), where('username', '==', username))
    );
    if (snap.empty) return { ok: false, notFound: true };
    const memberDoc = snap.docs[0];
    const data = memberDoc.data();
    const nameMatch = (data.person_name ?? '') === personName;
    if (!nameMatch) return { ok: false, notFound: false };

    // 생년월일/이메일은 연결된 persons 문서에서 확인
    if (!data.person_id) return { ok: false, notFound: false };
    const personSnap = await getDoc(doc(db, 'persons', data.person_id as string));
    if (!personSnap.exists()) return { ok: false, notFound: false };
    const pd = personSnap.data();
    const bdMatch    = (pd.birth_date ?? '') === birthDate;
    const emailMatch = (pd.email ?? '') === email;
    if (!bdMatch || !emailMatch) return { ok: false, notFound: false };

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1시간
    await addDoc(collection(db, 'password_reset_tokens'), {
      member_id:  memberDoc.id,
      token,
      expires_at: expiresAt,
      used:       false,
      created_at: new Date().toISOString(),
    });
    // 이메일 발송은 Firebase Function이 Firestore 트리거로 처리
    return { ok: true };
  },

  resetPasswordWithToken: async (token, newPassword) => {
    const snap = await getDocs(
      query(collection(db, 'password_reset_tokens'),
        where('token', '==', token),
        where('used', '==', false))
    );
    if (snap.empty) return { ok: false, error: '유효하지 않은 링크입니다.' };
    const tokenDoc = snap.docs[0];
    const data = tokenDoc.data();
    if (new Date(data.expires_at as string) < new Date()) {
      return { ok: false, error: '만료된 링크입니다. 다시 요청해주세요.' };
    }
    const pw = await hashPassword(newPassword);
    await Promise.all([
      updateDoc(doc(db, 'members', data.member_id as string), { password_hash: pw }),
      updateDoc(tokenDoc.ref, { used: true }),
    ]);
    return { ok: true };
  },

  requestAdminPasswordReset: async (username, personName, contactEmail, message) => {
    await addDoc(collection(db, 'password_reset_requests'), {
      username,
      person_name:   personName,
      contact_email: contactEmail,
      message:       message ?? null,
      status:        'pending',
      created_at:    new Date().toISOString(),
    });
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

  loginWithGoogle: async () => {
    try {
      const { signInWithPopup } = await import('firebase/auth');
      const { auth, googleProvider } = await import('../lib/firebase');
      const result = await signInWithPopup(auth, googleProvider);
      const googleUid   = result.user.uid;
      const googleEmail = result.user.email ?? '';
      const displayName = result.user.displayName ?? googleEmail;

      const snap = await getDocs(
        query(collection(db, 'members'), where('google_uid', '==', googleUid))
      );
      if (snap.empty) return { member: null, googleUid, googleEmail, displayName };
      const d = snap.docs[0];
      return { member: { id: d.id, ...(d.data() as Omit<Member, 'id'>) }, googleUid, googleEmail, displayName };
    } catch (err: unknown) {
      // 팝업을 닫거나 취소한 경우 null 반환 (에러 표시 안 함)
      if ((err as { code?: string })?.code === 'auth/popup-closed-by-user') return null;
      if ((err as { code?: string })?.code === 'auth/cancelled-popup-request') return null;
      throw err;
    }
  },

  registerWithGoogle: async (googleUid, googleEmail, displayName) => {
    const ref = await addDoc(collection(db, 'members'), {
      username:      googleEmail,
      password_hash: '',
      google_uid:    googleUid,
      google_email:  googleEmail,
      person_id:     null,
      family_id:     null,
      person_name:   displayName || null,
      is_admin:      false,
      status:        'active',
      created_at:    new Date().toISOString(),
    });
    return {
      id: ref.id, username: googleEmail, password_hash: '',
      google_uid: googleUid, google_email: googleEmail,
      person_id: null, family_id: null, person_name: displayName || null,
      is_admin: false, status: 'active' as const, created_at: new Date().toISOString(),
    };
  },

  linkGoogleToMember: async (memberId, googleUid, googleEmail): Promise<{ ok: boolean; error?: string }> => {
    // 동일 google_uid가 다른 계정에 이미 연결되어 있는지 확인
    const snap = await getDocs(
      query(collection(db, 'members'), where('google_uid', '==', googleUid))
    );
    const duplicate = snap.docs.find(d => d.id !== memberId);
    if (duplicate) {
      return { ok: false, error: '이 구글 계정은 이미 다른 계정에 연결되어 있습니다.' };
    }
    await updateDoc(doc(db, 'members', memberId), { google_uid: googleUid, google_email: googleEmail });
    return { ok: true };
  },

  unlinkGoogleFromMember: async (memberId) => {
    await updateDoc(doc(db, 'members', memberId), { google_uid: null, google_email: null });
  },

  saveFcmToken: async (memberId, token, field = 'fcm_token') => {
    // 같은 토큰이 다른 멤버에 등록돼 있으면 제거
    const dup = await getDocs(
      query(collection(db, 'members'), where(field, '==', token))
    );
    for (const d of dup.docs) {
      if (d.id !== memberId) await updateDoc(doc(db, 'members', d.id), { [field]: null });
    }
    await updateDoc(doc(db, 'members', memberId), { [field]: token });
  },

  recordLogin: async (memberId) => {
    const now = new Date().toISOString();
    const ua  = navigator.userAgent;
    // 최근 접속일 업데이트
    await updateDoc(doc(db, 'members', memberId), { last_login_at: now });
    // 접속 로그 기록
    await addDoc(collection(db, 'login_logs'), {
      member_id:  memberId,
      logged_in_at: now,
      user_agent: ua,
    });
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
    if (!memberId) return;

    // 이미 family_id가 있는 계정은 신청 불가 (루트 계정 포함)
    const memberSnap = await getDoc(doc(db, 'members', memberId));
    if (memberSnap.data()?.family_id) return;

    // 대기 중인 신청이 있으면 중복 삽입 방지 (pending·approved 모두 포함)
    const existing = await getDocs(query(collection(db, 'approval_requests'),
      where('member_id', '==', memberId)
    ));
    if (existing.docs.some(d => ['pending', 'approved'].includes(d.data().status))) return;
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

  loadPasswordResetRequests: async () => {
    const snap = await getDocs(
      query(collection(db, 'password_reset_requests'), where('status', '==', 'pending'))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() })) as import('../types').PasswordResetRequest[];
  },

  approvePasswordResetRequest: async (requestId, username, contactEmail) => {
    const memberSnap = await getDocs(
      query(collection(db, 'members'), where('username', '==', username))
    );
    if (memberSnap.empty) throw new Error('member not found');
    const memberId = memberSnap.docs[0].id;
    const token    = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await Promise.all([
      addDoc(collection(db, 'password_reset_tokens'), {
        member_id:     memberId,
        token,
        expires_at:    expiresAt,
        used:          false,
        contact_email: contactEmail,
        created_at:    new Date().toISOString(),
      }),
      updateDoc(doc(db, 'password_reset_requests', requestId), {
        status:      'approved',
        reviewed_at: new Date().toISOString(),
      }),
    ]);
  },

  rejectPasswordResetRequest: async (requestId) => {
    await updateDoc(doc(db, 'password_reset_requests', requestId), {
      status:      'rejected',
      reviewed_at: new Date().toISOString(),
    });
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
    // 다른 계정이 이미 이 person_id에 매핑돼 있으면 거부
    const existingSnap = await getDocs(
      query(collection(db, 'members'), where('person_id', '==', personId))
    );
    const alreadyMapped = existingSnap.docs.some(d => d.id !== memberId);
    if (alreadyMapped) throw new Error('ALREADY_MAPPED');

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

  consumeInviteToken: async (token: string) => {
    const snap = await getDocs(
      query(collection(db, 'invites'), where('token', '==', token))
    );
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
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
    const [rootSnap, allSnap] = await Promise.all([
      getDocs(query(collection(db, 'persons'), where('is_root', '==', 1))),
      getDocs(collection(db, 'persons')),
    ]);
    const countByFamily = new Map<string, number>();
    for (const d of allSnap.docs) {
      const fid = (d.data().family_id as string) ?? 'main';
      countByFamily.set(fid, (countByFamily.get(fid) ?? 0) + 1);
    }
    const seen = new Set<string>();
    const result: Array<{ familyId: string; rootName: string; createdAt: string; disabled: boolean; rootPersonId: string; personCount: number }> = [];
    for (const d of rootSnap.docs) {
      const fid = (d.data().family_id as string) ?? 'main';
      if (!seen.has(fid)) {
        seen.add(fid);
        result.push({
          familyId: fid,
          rootName: d.data().name as string,
          createdAt: d.data().created_at as string,
          disabled: !!(d.data().family_disabled),
          rootPersonId: d.id,
          personCount: countByFamily.get(fid) ?? 0,
        });
      }
    }
    return result;
  },

  toggleFamilyStatus: async (rootPersonId: string, disabled: boolean) => {
    await updateDoc(doc(db, 'persons', rootPersonId), { family_disabled: disabled });
  },

  isFamilyDisabled: async (familyId: string): Promise<boolean> => {
    const snap = await getDocs(
      query(collection(db, 'persons'),
        where('family_id', '==', familyId),
        where('is_root', '==', 1))
    );
    if (snap.empty) return false;
    return !!(snap.docs[0].data().family_disabled);
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
