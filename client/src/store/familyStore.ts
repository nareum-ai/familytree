import { create } from 'zustand';
import {
  collection,
  doc,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/firebase';
import { findDocs, grantInfoAccess, logActivity, nowIso } from '../lib/firestore';
import { LS, SS } from '../lib/storageKeys';
import { getMemberId, getMyPersonId, getUserName } from '../lib/session';
import type { Person, Relationship, BranchType, EditGrant } from '../types';
import { DEFAULT_PERMISSIONS } from '../types/permissions';
import { parseKoreanName } from '../utils/nameParser';
import { getChusu } from '../utils/familyGraph';
import { migrateLegacyFamilyId, runDataRepairs } from './dataRepair';

const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일
const LOAD_TIMEOUT_MS = 8000;

export interface InfoRequestItem {
  id: string;
  requesterName: string;
  personId: string;
  createdAt: string;
}

// 인물의 정보공개 권한자(보유 계정) 조회 — createInfoRequest와 getInfoHolderName이 공유
async function lookupInfoHolder(targetPersonId: string, persons: Person[]) {
  // 1순위: 해당 인물에 직접 매핑된 계정
  const holderSnap = await findDocs('members', where('person_id', '==', targetPersonId));
  if (!holderSnap.empty) {
    const d = holderSnap.docs[0];
    return {
      holderMemberId: d.id as string | null,
      holderName:     (d.data().person_name as string | null) ?? (d.data().username as string),
      holderIsAdmin:  d.data().is_admin === true,
    };
  }

  // 2순위: created_by 계정
  const createdBy = persons.find(p => p.id === targetPersonId)?.created_by;
  if (createdBy) {
    const creatorSnap = await findDocs('members', where('username', '==', createdBy));
    if (!creatorSnap.empty) {
      const d = creatorSnap.docs[0];
      return {
        holderMemberId: d.id as string | null,
        holderName:     (d.data().person_name as string | null) ?? createdBy,
        holderIsAdmin:  d.data().is_admin === true,
      };
    }
    return { holderMemberId: null, holderName: createdBy, holderIsAdmin: false };
  }
  return { holderMemberId: null, holderName: '알 수 없음', holderIsAdmin: false };
}

function toPerson(id: string, raw: Record<string, unknown>, familyId: string): Person {
  const parsed = parseKoreanName((raw.name as string) ?? '');
  return {
    ...(raw as Omit<Person, 'id'>),
    id,
    birth_date:  (raw.birth_date  as string | undefined)  ?? null,
    birth_lunar: (raw.birth_lunar as boolean | undefined) ?? false,
    is_deceased: (raw.is_deceased as boolean | undefined) ?? false,
    death_date:  (raw.death_date  as string | undefined)  ?? null,
    death_lunar: (raw.death_lunar as boolean | undefined) ?? false,
    created_by:  (raw.created_by  as string | undefined)  ?? null,
    permissions: (raw.permissions as typeof DEFAULT_PERMISSIONS | undefined) ?? DEFAULT_PERMISSIONS,
    family_id:   familyId,
    last_name:   (raw.last_name   as string | undefined)  ?? parsed.lastName,
    first_name:  (raw.first_name  as string | undefined)  ?? parsed.firstName,
  };
}

const actorName = () => getUserName() ?? '알 수 없음';

interface FamilyState {
  persons: Person[];
  relationships: Relationship[];
  selectedPersonId: string | null;
  viewpointPersonId: string | null;
  currentFamilyId: string | null;
  loading: boolean;
  focusRequest: { personId: string; branchId: BranchType } | null;
  infoRequestPersonId: string | null;

  // 임시 권한 해제 (관리자 토글)
  tempUnlockAll: boolean;
  setTempUnlockAll: (value: boolean) => Promise<void>;

  init: () => () => void;
  setViewpoint: (id: string | null) => void;
  requestFocus: (personId: string, branchId: BranchType) => void;
  clearFocusRequest: () => void;
  openInfoRequest: (personId: string) => void;
  closeInfoRequest: () => void;
  selectPerson: (id: string | null) => void;

  addPerson: (data: Partial<Person>) => Promise<Person>;
  updatePerson: (id: string, data: Partial<Person>) => Promise<Person>;
  deletePerson: (id: string) => Promise<void>;
  addRelationship: (data: { person1_id: string; person2_id: string; type: string; is_primary?: boolean }) => Promise<Relationship>;
  updateRelationship: (id: string, data: Partial<Pick<Relationship, 'marriage_date' | 'marriage_lunar' | 'is_primary'>>) => Promise<void>;
  deleteRelationshipsByPerson: (personId: string) => Promise<void>;
  createInvite: (person_id: string) => Promise<string>;

  // 정보공개 요청
  grantedPersonIds: Set<string>;
  loadGrantedAccess: () => Promise<void>;
  createInfoRequest: (targetPersonId: string) => Promise<boolean>; // true = 자동 승인됨
  getInfoHolderName: (targetPersonId: string) => Promise<string>;
  loadInfoRequestsForMe: () => Promise<InfoRequestItem[]>;
  approveInfoRequest: (requestId: string, personId: string) => Promise<void>;
  rejectInfoRequest:  (requestId: string) => Promise<void>;

  // 노드별 편집 권한 위임
  editGrantedPersonIds: Set<string>;
  loadEditGrants: () => Promise<void>;
  loadEditGrantsForPerson: (personId: string) => Promise<EditGrant[]>;
  grantEditAccess: (personId: string, granteePersonId: string, granteeName: string) => Promise<void>;
  revokeEditAccess: (grantId: string, personId: string, granteePersonId: string) => Promise<void>;
}

export const useFamilyStore = create<FamilyState>((set, get) => {
  // 편집 권한 대상이 현재 사용자(나 또는 뷰포인트)인지
  const isMe = (personId: string) =>
    personId === getMyPersonId() || personId === get().viewpointPersonId;
  const familyIdOrMain = () => get().currentFamilyId ?? 'main';

  return {
    persons: [],
    relationships: [],
    selectedPersonId: null,
    viewpointPersonId: sessionStorage.getItem(SS.VIEWPOINT_PERSON_ID),
    currentFamilyId: localStorage.getItem(LS.FAMILY_ID),
    loading: true,
    focusRequest: null,
    infoRequestPersonId: null,
    grantedPersonIds: new Set<string>(),
    editGrantedPersonIds: new Set<string>(),
    tempUnlockAll: false,

    setTempUnlockAll: async (value) => {
      await setDoc(doc(db, 'settings', 'permissions'), { tempUnlockAll: value }, { merge: true });
      set({ tempUnlockAll: value });
    },

    init: () => {
      // 임시 권한 해제 설정 — 가족 데이터와 무관하게 항상 구독
      const unsubPermissions = onSnapshot(doc(db, 'settings', 'permissions'), (snap) => {
        set({ tempUnlockAll: snap.exists() ? !!snap.data().tempUnlockAll : false });
      });

      const familyId = get().currentFamilyId;
      if (!familyId) {
        set({ loading: false });
        return unsubPermissions;
      }

      const timeout = setTimeout(() => set({ loading: false }), LOAD_TIMEOUT_MS);
      let personsReady = false;
      let relsReady = false;
      let hasRepaired = false;  // 데이터 보정은 초기 로드 1회만 실행
      let unsubPersons: () => void = () => {};
      let unsubRels: () => void = () => {};

      const checkReady = () => {
        if (!personsReady || !relsReady) return;
        clearTimeout(timeout);
        set({ loading: false });
        if (!hasRepaired) {
          hasRepaired = true;
          runDataRepairs(() => {
            const { persons, relationships, currentFamilyId } = get();
            return { persons, relationships, familyId: currentFamilyId };
          });
        }
        get().loadGrantedAccess();
        get().loadEditGrants();
      };

      // 마이그레이션이 필터 쿼리보다 반드시 앞서야 "0건 → 새 루트 생성" 버그 방지
      const startListeners = () => {
        unsubPersons = onSnapshot(
          query(collection(db, 'persons'), where('family_id', '==', familyId)),
          (snap) => {
            // persons가 0이면 → 관리자가 아직 승인/생성을 안 한 상태
            // (관리자 승인 플로우에서 루트가 생성되므로 여기서 자동 생성하지 않음)
            if (snap.empty) {
              set({ loading: false });
              return;
            }
            set({ persons: snap.docs.map(d => toPerson(d.id, d.data(), familyId)) });
            personsReady = true;
            checkReady();
          },
          () => { clearTimeout(timeout); set({ loading: false }); }
        );

        unsubRels = onSnapshot(
          query(collection(db, 'relationships'), where('family_id', '==', familyId)),
          (snap) => {
            const relationships = snap.docs.map(d => ({
              ...(d.data() as Omit<Relationship, 'id'>),
              id: d.id,
              family_id: familyId,
            }));
            set({ relationships });
            relsReady = true;
            checkReady();
          },
          () => { relsReady = true; checkReady(); }
        );
      };

      migrateLegacyFamilyId(familyId).finally(startListeners);

      return () => { clearTimeout(timeout); unsubPersons(); unsubRels(); unsubPermissions(); };
    },

    setViewpoint: (id) => {
      if (id) sessionStorage.setItem(SS.VIEWPOINT_PERSON_ID, id);
      else sessionStorage.removeItem(SS.VIEWPOINT_PERSON_ID);
      set({ viewpointPersonId: id });
    },

    requestFocus: (personId, branchId) => set({ focusRequest: { personId, branchId } }),
    clearFocusRequest: () => set({ focusRequest: null }),
    // 비공개 노드 정보공개 요청 패널 열기/닫기
    // selectedPersonId도 동시에 클리어하여 PersonDetail이 열리지 않도록 함
    openInfoRequest:  (personId) => set({ infoRequestPersonId: personId, selectedPersonId: null }),
    closeInfoRequest: ()         => set({ infoRequestPersonId: null }),
    selectPerson: (id) => set({ selectedPersonId: id }),

    // ── 인물·관계 CRUD ──────────────────────────────────────────────────────

    addPerson: async (personData) => {
      const familyId = familyIdOrMain();
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
        created_by:  localStorage.getItem(LS.ACCOUNT_NAME) ?? getUserName() ?? null,
        permissions: personData.permissions ?? DEFAULT_PERMISSIONS,
        family_id:   familyId,
        created_at:  nowIso(),
        phone:       personData.phone  ?? null,
        email:       personData.email  ?? null,
        recent_status: personData.recent_status ?? null,
      };
      const ref = await addDoc(collection(db, 'persons'), fields);
      logActivity('add', name, actorName(), familyId);
      return { ...fields, id: ref.id };
    },

    updatePerson: async (id, personData) => {
      // 이름이 변경되면 성/이름도 자동 재파싱
      const patch = { ...personData };
      if (personData.name && !personData.last_name && !personData.first_name) {
        const { lastName, firstName } = parseKoreanName(personData.name);
        patch.last_name  = lastName;
        patch.first_name = firstName;
      }
      await updateDoc(doc(db, 'persons', id), patch);
      const current = get().persons.find(p => p.id === id)!;
      return { ...current, ...personData };
    },

    deletePerson: async (id) => {
      const person = get().persons.find(p => p.id === id);
      await deleteDoc(doc(db, 'persons', id));
      await get().deleteRelationshipsByPerson(id);
      if (person) logActivity('delete', person.name, actorName(), familyIdOrMain());
      set(s => ({ selectedPersonId: s.selectedPersonId === id ? null : s.selectedPersonId }));
    },

    deleteRelationshipsByPerson: async (personId) => {
      // 로컬 상태 + Firestore 직접 쿼리 병행 — 타이밍 이슈로 로컬에 없는 관계도 삭제
      const [snap1, snap2] = await Promise.all([
        findDocs('relationships', where('person1_id', '==', personId)),
        findDocs('relationships', where('person2_id', '==', personId)),
      ]);
      const ids = new Set([...snap1.docs, ...snap2.docs].map(d => d.id));
      get().relationships
        .filter(r => r.person1_id === personId || r.person2_id === personId)
        .forEach(r => ids.add(r.id));
      await Promise.all([...ids].map(id => deleteDoc(doc(db, 'relationships', id))));
    },

    addRelationship: async (relData) => {
      const familyId = familyIdOrMain();
      const ref = await addDoc(collection(db, 'relationships'), { ...relData, family_id: familyId });
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
      await updateDoc(doc(db, 'relationships', id), data);
    },

    createInvite: async (person_id) => {
      const snap = await findDocs('invites', where('person_id', '==', person_id));
      if (!snap.empty) return snap.docs[0].data().token as string;
      const token = uuidv4();
      await addDoc(collection(db, 'invites'), {
        token, person_id,
        family_id: get().currentFamilyId,
        created_by: getUserName(),
        created_at: nowIso(),
        expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      });
      return token;
    },

    // ── 정보공개 요청 ─────────────────────────────────────────────────────────

    loadGrantedAccess: async () => {
      const memberId = getMemberId();
      if (!memberId) return;
      const snap = await findDocs('info_access', where('requester_member_id', '==', memberId));
      const ids = new Set(snap.docs.map(d => d.data().person_id as string));

      // 나를 등록한 계정의 인물 — 그 계정은 이미 내 정보를 알고 있으므로 기본 공개
      const myPersonId = getMyPersonId();
      const myPerson = get().persons.find(p => p.id === myPersonId);
      if (myPerson?.created_by) {
        const creatorSnap = await findDocs('members', where('username', '==', myPerson.created_by));
        const creatorPersonId = creatorSnap.docs[0]?.data().person_id as string | undefined;
        if (creatorPersonId) ids.add(creatorPersonId);
      }

      set({ grantedPersonIds: ids });
    },

    createInfoRequest: async (targetPersonId) => {
      const memberId = getMemberId();
      const userName = getUserName();
      if (!memberId || !userName) return false;

      const autoGrant = async () => {
        if (await grantInfoAccess(memberId, targetPersonId)) {
          set(s => ({ grantedPersonIds: new Set([...s.grantedPersonIds, targetPersonId]) }));
        }
        return true;
      };

      const memberSnap = await getDoc(doc(db, 'members', memberId));
      const requesterPersonId = (memberSnap.data()?.person_id as string | null) ?? null;
      const { persons, relationships } = get();

      // 2촌 이내(배우자 포함) → 자동 승인
      if (requesterPersonId && persons.some(p => p.id === requesterPersonId)) {
        const chusu = getChusu(targetPersonId, { id: requesterPersonId }, relationships);
        if (chusu !== null && chusu <= 2) return autoGrant();
      }

      // 임시 권한 해제 중이거나, 권한자가 관리자이거나 없으면 → 즉시 자동 승인
      const { holderMemberId, holderName, holderIsAdmin } = await lookupInfoHolder(targetPersonId, persons);
      if (!holderMemberId || holderIsAdmin || get().tempUnlockAll) return autoGrant();

      // 일반 회원이 권한자 → 대기 요청 생성 (이미 대기 중이면 생략)
      const reqSnap = await findDocs('info_requests', where('requester_member_id', '==', memberId));
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
        created_at:           nowIso(),
      });
      return false;
    },

    getInfoHolderName: async (targetPersonId) => {
      const { holderName } = await lookupInfoHolder(targetPersonId, get().persons);
      return holderName;
    },

    loadInfoRequestsForMe: async () => {
      // 현재 로그인 회원이 권한 보유자인 대기 요청만 로드
      const memberId = getMemberId();
      if (!memberId) return [];
      const snap = await findDocs('info_requests',
        where('holder_member_id', '==', memberId),
        where('status',           '==', 'pending'));
      return snap.docs.map(d => ({
        id:            d.id,
        requesterName: d.data().requester_name as string,
        personId:      d.data().target_person_id as string,
        createdAt:     d.data().created_at as string,
      }));
    },

    approveInfoRequest: async (requestId, personId) => {
      const requestRef = doc(db, 'info_requests', requestId);
      await updateDoc(requestRef, { status: 'approved', reviewed_at: nowIso() });
      const request = (await getDoc(requestRef)).data();

      // 1. 요청자 → 대상인물 접근권 부여
      await grantInfoAccess((request?.requester_member_id as string | undefined) ?? '', personId);

      // 2. 양방향 페어 생성 + 대상인물 계정이 있으면 즉시 역방향 접근권 부여
      const requesterPersonId = request?.requester_person_id as string | null;
      if (!requesterPersonId) return;

      const [pa, pb] = await Promise.all([
        findDocs('person_access_pairs',
          where('person_a_id', '==', requesterPersonId), where('person_b_id', '==', personId)),
        findDocs('person_access_pairs',
          where('person_a_id', '==', personId), where('person_b_id', '==', requesterPersonId)),
      ]);
      if (pa.empty && pb.empty) {
        await addDoc(collection(db, 'person_access_pairs'), {
          person_a_id: requesterPersonId,
          person_b_id: personId,
          family_id:   get().persons[0]?.family_id ?? '',
          created_at:  nowIso(),
        });
      }

      const holderSnap = await findDocs('members', where('person_id', '==', personId));
      if (!holderSnap.empty) await grantInfoAccess(holderSnap.docs[0].id, requesterPersonId);
    },

    rejectInfoRequest: async (requestId) => {
      await updateDoc(doc(db, 'info_requests', requestId), { status: 'rejected', reviewed_at: nowIso() });
    },

    // ── 노드별 편집 권한 위임 ──────────────────────────────────────────────────

    loadEditGrants: async () => {
      const granteeIds = [...new Set([getMyPersonId(), get().viewpointPersonId].filter((id): id is string => !!id))];
      if (granteeIds.length === 0) return;
      const snap = await findDocs('edit_grants', where('grantee_person_id', 'in', granteeIds));
      set({ editGrantedPersonIds: new Set(snap.docs.map(d => d.data().person_id as string)) });
    },

    loadEditGrantsForPerson: async (personId) => {
      const snap = await findDocs('edit_grants', where('person_id', '==', personId));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as EditGrant));
    },

    grantEditAccess: async (personId, granteePersonId, granteeName) => {
      const dup = await findDocs('edit_grants',
        where('person_id', '==', personId),
        where('grantee_person_id', '==', granteePersonId));
      if (!dup.empty) return;
      await addDoc(collection(db, 'edit_grants'), {
        person_id:         personId,
        grantee_person_id: granteePersonId,
        grantee_name:      granteeName,
        granted_by:        actorName(),
        granted_at:        nowIso(),
        family_id:         familyIdOrMain(),
      });
      if (isMe(granteePersonId)) {
        set(s => ({ editGrantedPersonIds: new Set([...s.editGrantedPersonIds, personId]) }));
      }
    },

    revokeEditAccess: async (grantId, personId, granteePersonId) => {
      await deleteDoc(doc(db, 'edit_grants', grantId));
      if (isMe(granteePersonId)) {
        set(s => {
          const next = new Set(s.editGrantedPersonIds);
          next.delete(personId);
          return { editGrantedPersonIds: next };
        });
      }
    },
  };
});
