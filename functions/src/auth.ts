// ── 인증·계정 관련 Callable 함수 ──────────────────────────────────────────────
// 모든 로그인은 서버가 확인한 뒤 Firebase Auth 커스텀 토큰(uid = members 문서 id)을 발급한다.
// 토큰 클레임: fid(가족 id, 있으면) · adm(관리자) — Firestore 보안 규칙이 이 값으로 접근을 제한한다.
// 비밀번호 해시는 클라이언트가 읽을 수 없는 member_secrets/{memberId} 에만 저장한다.
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type DocumentData, type DocumentSnapshot } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

// 함수 로드 시점엔 initializeApp() 전일 수 있어 지연 호출
const db = () => getFirestore();

const LEGACY_SALT = 'famliytree-2024';
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

const callOpts = { cors: true };

// ── 비밀번호 해시 ─────────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** 일치하면 true. legacy: 예전 클라이언트 SHA-256 해시 (일치 시 호출부가 scrypt로 교체) */
async function verifyPassword(password: string, stored: string): Promise<{ ok: boolean; legacy: boolean }> {
  if (stored.startsWith('scrypt$')) {
    const [, saltHex, hashHex] = stored.split('$');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
    return { ok: timingSafeEqual(actual, expected), legacy: false };
  }
  if (!stored) return { ok: false, legacy: false };
  const legacy = createHash('sha256').update(password + LEGACY_SALT).digest();
  const expected = Buffer.from(stored, 'hex');
  return { ok: expected.length === legacy.length && timingSafeEqual(legacy, expected), legacy: true };
}

function validPassword(pw: unknown): pw is string {
  return typeof pw === 'string' && pw.length >= 4 && pw.length <= 100;
}

async function setPassword(memberId: string, password: string) {
  await db().doc(`member_secrets/${memberId}`).set(
    { password_hash: await hashPassword(password), fail_count: 0, locked_until: null }, { merge: true });
  // 예전 위치(members.password_hash)에 남은 값 제거
  await db().doc(`members/${memberId}`).update({ password_hash: FieldValue.delete() });
}

// ── 세션 토큰 ─────────────────────────────────────────────────────────────────

function sessionClaims(d: DocumentData): Record<string, unknown> {
  const claims: Record<string, unknown> = { adm: d.is_admin === true };
  if (d.family_id) claims.fid = d.family_id;
  return claims;
}

/** 클라이언트에 돌려줄 회원 정보 (비밀·기기 토큰 제외) */
function publicMember(id: string, d: DocumentData) {
  return {
    id,
    username:     d.username ?? '',
    person_id:    d.person_id ?? null,
    family_id:    d.family_id ?? null,
    person_name:  d.person_name ?? null,
    is_admin:     d.is_admin === true,
    status:       d.status ?? 'active',
    google_uid:   d.google_uid ?? null,
    google_email: d.google_email ?? null,
    created_at:   d.created_at ?? null,
  };
}

async function session(snap: DocumentSnapshot) {
  const d = snap.data()!;
  const token = await getAuth().createCustomToken(snap.id, sessionClaims(d));
  return { token, member: publicMember(snap.id, d) };
}

function requireMember(req: CallableRequest): string {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return req.auth.uid;
}

async function verifyGoogle(idToken: unknown) {
  if (typeof idToken !== 'string') throw new HttpsError('invalid-argument', 'idToken');
  const decoded = await getAuth().verifyIdToken(idToken).catch(() => {
    throw new HttpsError('unauthenticated', 'invalid google token');
  });
  if (decoded.firebase?.sign_in_provider !== 'google.com') throw new HttpsError('invalid-argument', 'not google');
  return { uid: decoded.uid, email: decoded.email ?? '', name: (decoded.name as string | undefined) ?? '' };
}

async function findMemberBy(field: string, value: unknown) {
  const snap = await db().collection('members').where(field, '==', value).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

function newMemberFields() {
  return {
    person_id: null, family_id: null, person_name: null as string | null,
    is_admin: false, status: 'active', created_at: new Date().toISOString(),
  };
}

// ── 아이디·비밀번호 ───────────────────────────────────────────────────────────

export const authLogin = onCall(callOpts, async (req) => {
  const { username, password } = req.data ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') return { error: 'invalid' };
  const memberSnap = await findMemberBy('username', username);
  if (!memberSnap) return { error: 'invalid' };

  const secretRef = db().doc(`member_secrets/${memberSnap.id}`);
  const secret = (await secretRef.get()).data() ?? {};
  const lockedUntil = secret.locked_until ? Date.parse(secret.locked_until as string) : 0;
  if (lockedUntil > Date.now()) return { error: 'locked' };

  const stored = (secret.password_hash as string | undefined) ?? (memberSnap.data()!.password_hash as string | undefined) ?? '';
  const { ok, legacy } = await verifyPassword(password, stored);
  if (!ok) {
    const fails = ((secret.fail_count as number | undefined) ?? 0) + 1;
    await secretRef.set({
      fail_count: fails >= MAX_FAILS ? 0 : fails,
      locked_until: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MS).toISOString() : null,
    }, { merge: true });
    return { error: fails >= MAX_FAILS ? 'locked' : 'invalid' };
  }
  if (memberSnap.data()!.status === 'suspended') return { error: 'suspended' };

  if (legacy || secret.password_hash === undefined) await setPassword(memberSnap.id, password);
  else if (secret.fail_count) await secretRef.update({ fail_count: 0, locked_until: null });
  return session(memberSnap);
});

export const authRegister = onCall(callOpts, async (req) => {
  const { username, password } = req.data ?? {};
  if (typeof username !== 'string' || !username.trim() || username.length > 50) return { error: '아이디를 확인해주세요.' };
  if (!validPassword(password)) return { error: '비밀번호는 4자 이상이어야 합니다.' };
  if (await findMemberBy('username', username)) return { error: '이미 사용 중인 아이디입니다.' };
  const ref = await db().collection('members').add({ username, ...newMemberFields() });
  await setPassword(ref.id, password);
  return { ok: true };
});

export const changePassword = onCall(callOpts, async (req) => {
  const memberId = requireMember(req);
  const { oldPassword, newPassword } = req.data ?? {};
  if (!validPassword(newPassword) || typeof oldPassword !== 'string') return { error: 'invalid' };
  const secret = (await db().doc(`member_secrets/${memberId}`).get()).data() ?? {};
  const stored = (secret.password_hash as string | undefined)
    ?? ((await db().doc(`members/${memberId}`).get()).data()?.password_hash as string | undefined) ?? '';
  if (!(await verifyPassword(oldPassword, stored)).ok) return { error: 'wrong-password' };
  await setPassword(memberId, newPassword);
  return { ok: true };
});

/** 본인 정보(이름·생년월일·이메일)가 일치하면 초기화 토큰 발급 — 메일은 onPasswordResetTokenCreated가 발송 */
export const requestPasswordReset = onCall(callOpts, async (req) => {
  const { username, personName, birthDate, email } = req.data ?? {};
  if (typeof username !== 'string') return { ok: false, notFound: true };
  const memberSnap = await findMemberBy('username', username);
  if (!memberSnap) return { ok: false, notFound: true };
  const m = memberSnap.data()!;
  if ((m.person_name ?? '') !== personName || !m.person_id) return { ok: false, notFound: false };
  const p = (await db().doc(`persons/${m.person_id}`).get()).data();
  if (!p || (p.birth_date ?? '') !== birthDate || (p.email ?? '') !== email) return { ok: false, notFound: false };

  console.log(`초기화 토큰 생성: member ${memberSnap.id}`);
  await db().collection('password_reset_tokens').add({
    member_id:  memberSnap.id,
    token:      randomBytes(24).toString('hex'),
    expires_at: new Date(Date.now() + RESET_TTL_MS).toISOString(),
    used:       false,
    created_at: new Date().toISOString(),
  });
  return { ok: true };
});

export const resetPassword = onCall(callOpts, async (req) => {
  const { token, newPassword } = req.data ?? {};
  if (typeof token !== 'string') return { error: '유효하지 않은 링크입니다.' };
  if (!validPassword(newPassword)) return { error: '비밀번호는 4자 이상이어야 합니다.' };
  const snap = await db().collection('password_reset_tokens')
    .where('token', '==', token).where('used', '==', false).limit(1).get();
  if (snap.empty) return { error: '유효하지 않은 링크입니다.' };
  const t = snap.docs[0];
  if (Date.parse(t.data().expires_at as string) < Date.now()) return { error: '만료된 링크입니다. 다시 요청해주세요.' };
  await setPassword(t.data().member_id as string, newPassword);
  await t.ref.update({ used: true });
  return { ok: true };
});

// ── Google ────────────────────────────────────────────────────────────────────

/** Google ID 토큰으로 로그인. 연결된 회원이 없으면 member: null */
export const authGoogle = onCall(callOpts, async (req) => {
  const g = await verifyGoogle(req.data?.idToken);
  const memberSnap = await findMemberBy('google_uid', g.uid);
  if (!memberSnap) return { member: null };
  if (memberSnap.data()!.status === 'suspended') return { error: 'suspended' };
  if (g.email && memberSnap.data()!.google_email !== g.email) await memberSnap.ref.update({ google_email: g.email });
  return session(memberSnap);
});

export const authRegisterGoogle = onCall(callOpts, async (req) => {
  const g = await verifyGoogle(req.data?.idToken);
  const existing = await findMemberBy('google_uid', g.uid);
  if (existing) return session(existing);
  const displayName = typeof req.data?.displayName === 'string' && req.data.displayName ? req.data.displayName : g.name;
  const ref = await db().collection('members').add({
    username: g.email, google_uid: g.uid, google_email: g.email,
    ...newMemberFields(), person_name: displayName || null,
  });
  return session(await ref.get());
});

/** 로그인한 회원 계정에 Google 연결 */
export const linkGoogle = onCall(callOpts, async (req) => {
  const memberId = requireMember(req);
  const g = await verifyGoogle(req.data?.idToken);
  const other = await findMemberBy('google_uid', g.uid);
  if (other && other.id !== memberId) return { ok: false, error: '이 구글 계정은 이미 다른 계정에 연결되어 있습니다.' };
  await db().doc(`members/${memberId}`).update({ google_uid: g.uid, google_email: g.email });
  return { ok: true, email: g.email };
});

export const unlinkGoogle = onCall(callOpts, async (req) => {
  const memberId = requireMember(req);
  await db().doc(`members/${memberId}`).update({ google_uid: null, google_email: null });
  return { ok: true };
});

// ── 세션 갱신·초대 ────────────────────────────────────────────────────────────

/** 가족 배정 등으로 회원 정보가 바뀐 뒤 클레임을 새로 받기 */
export const refreshSession = onCall(callOpts, async (req) => {
  const memberId = requireMember(req);
  const snap = await db().doc(`members/${memberId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'member');
  if (snap.data()!.status === 'suspended') return { error: 'suspended' };
  return session(snap);
});

async function loadInvite(token: unknown) {
  if (typeof token !== 'string' || !token) return null;
  const snap = await db().collection('invites').where('token', '==', token).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

/** 초대 링크 확인 (비로그인 가능) — 인물 이름과 상태만 돌려준다 */
export const getInvite = onCall(callOpts, async (req) => {
  const invite = await loadInvite(req.data?.token);
  if (!invite) return { status: 'notfound' };
  const inv = invite.data();
  if (inv.used_at) return { status: 'used', personId: inv.person_id };
  if (await findMemberBy('person_id', inv.person_id as string)) return { status: 'used', personId: inv.person_id };
  const person = (await db().doc(`persons/${inv.person_id}`).get()).data();
  if (!person) return { status: 'notfound' };
  return {
    status: 'ok',
    personId:   inv.person_id,
    personName: person.name ?? '',
    familyId:   person.family_id ?? 'main',
    senderName: inv.created_by ?? null,
  };
});

/** 초대 수락 — 로그인한 회원을 초대 인물에 연결하고 새 세션 토큰 발급 */
export const acceptInvite = onCall(callOpts, async (req) => {
  const memberId = requireMember(req);
  const invite = await loadInvite(req.data?.token);
  if (!invite || invite.data().used_at) return { error: 'invalid' };
  const personId = invite.data().person_id as string;
  const mapped = await findMemberBy('person_id', personId);
  if (mapped && mapped.id !== memberId) return { error: 'already-mapped' };
  const person = (await db().doc(`persons/${personId}`).get()).data();
  if (!person) return { error: 'invalid' };
  const familyId = (person.family_id as string | undefined) ?? 'main';

  const memberRef = db().doc(`members/${memberId}`);
  await memberRef.update({ person_id: personId, family_id: familyId, person_name: person.name ?? null });
  await invite.ref.update({ used_at: new Date().toISOString(), used_by_member_id: memberId });

  // 이 인물과 합의된 양방향 페어가 있으면 즉시 열람권 부여
  const [pairsA, pairsB] = await Promise.all([
    db().collection('person_access_pairs').where('person_a_id', '==', personId).get(),
    db().collection('person_access_pairs').where('person_b_id', '==', personId).get(),
  ]);
  const partnerIds = [
    ...pairsA.docs.map(d => d.data().person_b_id as string),
    ...pairsB.docs.map(d => d.data().person_a_id as string),
  ];
  for (const partnerId of partnerIds) {
    const dup = await db().collection('info_access')
      .where('requester_member_id', '==', memberId).where('person_id', '==', partnerId).limit(1).get();
    if (dup.empty) {
      await db().collection('info_access').add({
        requester_member_id: memberId, person_id: partnerId, granted_at: new Date().toISOString(),
      });
    }
  }
  return session(await memberRef.get());
});

// ── 기기 토큰·공개 정보 ───────────────────────────────────────────────────────

/**
 * 현재 기기 FCM 토큰을 회원 문서에 추가 (기존 기기 토큰 유지).
 * 같은 토큰이 다른 회원에 있으면 그쪽에서 제거하고, 이 기기의 이전 토큰(prevToken)도 제거한다.
 */
export const registerFcmToken = onCall(callOpts, async (req) => {
  const memberId = requireMember(req);
  const { token, prevToken } = req.data ?? {};
  if (typeof token !== 'string' || !token) throw new HttpsError('invalid-argument', 'token');
  const scope = req.data?.scope === 'admin' && req.auth?.token.adm === true ? 'admin' : 'user';
  const arr = scope === 'admin' ? 'fcm_tokens_admin' : 'fcm_tokens';
  const legacy = scope === 'admin' ? 'fcm_token_admin' : 'fcm_token';

  const [dupArr, dupLegacy] = await Promise.all([
    db().collection('members').where(arr, 'array-contains', token).get(),
    db().collection('members').where(legacy, '==', token).get(),
  ]);
  for (const d of dupArr.docs)    if (d.id !== memberId) await d.ref.update({ [arr]: FieldValue.arrayRemove(token) });
  for (const d of dupLegacy.docs) if (d.id !== memberId) await d.ref.update({ [legacy]: null });

  const ref = db().doc(`members/${memberId}`);
  // 같은 필드에 arrayRemove·arrayUnion을 한 번에 쓸 수 없어 2회로 나눈다
  if (typeof prevToken === 'string' && prevToken && prevToken !== token) {
    await ref.update({ [arr]: FieldValue.arrayRemove(prevToken) });
  }
  await ref.update({ [arr]: FieldValue.arrayUnion(token), [legacy]: token, fcm_tokens_updated_at: new Date().toISOString() });
  return { ok: true, scope };
});

/** 사용자에게 보여줄 관리자 연락처 (비로그인 가능) */
export const getAdminContact = onCall(callOpts, async () => {
  // 관리자가 여럿일 수 있으므로 구글 이메일이 연결된 첫 번째 관리자를 사용
  const snap = await db().collection('members').where('is_admin', '==', true).get();
  const email = snap.docs.map(d => d.data().google_email as string | undefined).find(e => !!e);
  return { email: email ?? null };
});
