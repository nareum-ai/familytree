import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import * as nodemailer from 'nodemailer';
import { getRelationLabel } from './shared/relationLabel';
import type { Person as LabelPerson, Relationship as Rel } from './shared/types';
import { invalidateResetTokens } from './resetTokens';
// CJS 빌드는 클래스 자체를 export (esModuleInterop 꺼져 있어 default import 사용 불가)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const klcMod = require('korean-lunar-calendar');
const KoreanLunarCalendar: typeof import('korean-lunar-calendar').default = klcMod.default ?? klcMod;

const MAIL_USER = defineSecret('MAIL_USER');
const MAIL_PASS = defineSecret('MAIL_PASS');

initializeApp();
setGlobalOptions({ region: 'asia-northeast3' });

const db  = getFirestore();
const fcm = getMessaging();

const APP_URL  = 'https://familytree-3221b.web.app';
const APP_NAME = '우리 가족 가계도';

// ── FCM 전송 헬퍼 ─────────────────────────────────────────────────────────
// 회원 1명이 여러 기기(폰 TWA·PC 브라우저 등)를 쓸 수 있으므로 토큰은 배열로 관리한다.
//   일반: fcm_tokens[] (+ 구버전 fcm_token)   관리자 PWA: fcm_tokens_admin[] (+ fcm_token_admin)
// 발송 결과 만료·무효 토큰은 자동 삭제하고, 성공/실패 시각을 회원 문서에 남긴다.
type PushScope = 'user' | 'admin';

interface PushMsg { title: string; body: string; link?: string; ttlSec?: number; tag?: string; }
interface PushResult { ok: number; fail: number; tokens: number; }

const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

function tokenFields(scope: PushScope) {
  return scope === 'admin'
    ? { arr: 'fcm_tokens_admin', legacy: 'fcm_token_admin' }
    : { arr: 'fcm_tokens',       legacy: 'fcm_token' };
}

function memberTokens(data: FirebaseFirestore.DocumentData | undefined, scope: PushScope): string[] {
  if (!data) return [];
  const { arr, legacy } = tokenFields(scope);
  const list: unknown[] = Array.isArray(data[arr]) ? data[arr] : [];
  if (data[legacy]) list.push(data[legacy]);
  return [...new Set(list.filter((t): t is string => typeof t === 'string' && t.length > 0))];
}

function buildMessage(token: string, m: PushMsg): Message {
  const link = m.link ?? '/';
  const absoluteLink = link.startsWith('http') ? link : `${APP_URL}${link}`;
  const data: Record<string, string> = { title: m.title, body: m.body, link: absoluteLink };
  if (m.tag) data.tag = m.tag;
  const headers: Record<string, string> = { Urgency: 'high' };
  if (m.ttlSec) headers.TTL = String(m.ttlSec);
  // data-only: 서비스 워커(백그라운드)·onMessage(포그라운드)가 직접 표시
  return { token, webpush: { headers, data } };
}

/** 회원의 모든 기기로 메시지(1건 이상) 발송 + 무효 토큰 정리 + 결과 기록 */
async function pushToMember(
  ref: FirebaseFirestore.DocumentReference,
  data: FirebaseFirestore.DocumentData | undefined,
  scope: PushScope,
  msgs: PushMsg | PushMsg[],
): Promise<PushResult> {
  const list = Array.isArray(msgs) ? msgs : [msgs];
  const tokens = memberTokens(data, scope);
  if (tokens.length === 0 || list.length === 0) return { ok: 0, fail: 0, tokens: 0 };

  const messages: Message[] = [];
  for (const m of list) for (const t of tokens) messages.push(buildMessage(t, m));

  let ok = 0, fail = 0;
  const dead = new Set<string>();
  let lastError = '';
  for (let i = 0; i < messages.length; i += 500) {
    const chunk = messages.slice(i, i + 500);
    try {
      const res = await fcm.sendEach(chunk);
      res.responses.forEach((r, j) => {
        if (r.success) { ok++; return; }
        fail++;
        const code = r.error?.code ?? '';
        lastError = code || (r.error?.message ?? 'unknown');
        if (DEAD_TOKEN_CODES.has(code)) dead.add((chunk[j] as { token: string }).token);
      });
    } catch (err) {
      fail += chunk.length;
      lastError = (err as Error).message ?? String(err);
    }
  }

  const { arr, legacy } = tokenFields(scope);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (ok > 0)   patch.push_last_ok_at = now;
  if (fail > 0) { patch.push_last_fail_at = now; patch.push_last_error = lastError; }
  if (dead.size > 0) {
    patch[arr] = FieldValue.arrayRemove(...dead);
    if (data?.[legacy] && dead.has(data[legacy] as string)) patch[legacy] = null;
  }
  try { await ref.update(patch); } catch (e) { console.error('푸시 결과 기록 실패:', (e as Error).message); }

  console.log(`FCM ${ref.id}: 기기 ${tokens.length}, 성공 ${ok}, 실패 ${fail}, 무효토큰 삭제 ${dead.size}`);
  return { ok, fail, tokens: tokens.length };
}

/** 관리자 전원(관리자 PWA 토큰)에게 발송 */
async function pushToAdmins(msg: PushMsg) {
  const adminsSnap = await db.collection('members').where('is_admin', '==', true).get();
  await Promise.all(adminsSnap.docs.map(d => pushToMember(d.ref, d.data(), 'admin', msg)));
}

// ── 비밀번호 초기화 토큰 생성 → 이메일 자동 발송 ─────────────────────────────
// contact_email 필드가 있으면 해당 주소로, 없으면 member.email로 발송
// (자동: member.email 사용 / 관리자 승인: contact_email 사용)
export const onPasswordResetTokenCreated = onDocumentCreated(
  { document: 'password_reset_tokens/{docId}', secrets: [MAIL_USER, MAIL_PASS] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // 새 링크가 생기면 이전 링크는 무효화 — 가장 최근 메일의 링크만 작동 (본인 요청·관리자 승인 공통)
    await invalidateResetTokens(data.member_id as string, event.params.docId);

    let toEmail = data.contact_email as string | undefined;
    if (!toEmail) {
      const memberSnap = await db.doc(`members/${data.member_id}`).get();
      const personId = memberSnap.data()?.person_id as string | undefined;
      if (personId) {
        const personSnap = await db.doc(`persons/${personId}`).get();
        toEmail = personSnap.data()?.email as string | undefined;
      }
    }
    if (!toEmail) { console.warn(`초기화 메일 생략: 받을 이메일 없음 (member ${data.member_id})`); return; }

    const link = `${APP_URL}/reset/${data.token}`;
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: MAIL_USER.value(), pass: MAIL_PASS.value() },
    });
    await transporter.sendMail({
      from:    `"${APP_NAME}" <${MAIL_USER.value()}>`,
      to:      toEmail,
      subject: `[${APP_NAME}] 비밀번호 초기화 링크`,
      html:    `
        <p>안녕하세요.</p>
        <p>비밀번호 초기화 요청이 접수되었습니다.<br/>
        아래 링크를 클릭하여 새 비밀번호를 설정하세요.</p>
        <p><a href="${link}" style="color:#4F46E5;font-weight:bold">비밀번호 초기화하기</a></p>
        <p>링크는 <strong>1시간</strong> 동안 유효합니다.<br/>
        본인이 요청하지 않았다면 이 이메일을 무시하세요.</p>
      `,
    });
    console.log(`초기화 메일 발송: member ${data.member_id}`);
  }
);

// 관리자 초기화 요청 → 관리자 FCM 알림
export const onPasswordResetRequestCreated = onDocumentCreated(
  'password_reset_requests/{docId}',
  async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== 'pending') return;

    const username = (data.username as string) ?? '누군가';
    await pushToAdmins({
      title: '🔑 비밀번호 초기화 요청',
      body:  `${username}님이 비밀번호 초기화를 요청했습니다.`,
    });
  }
);

// ── 가족그룹 신청 즉시 알림 (관리자) ─────────────────────────────────────────
export const onApprovalRequestCreated = onDocumentCreated(
  'approval_requests/{requestId}',
  async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== 'pending') return;

    const requesterName = (data.requested_name as string) ?? '누군가';
    await pushToAdmins({
      title: '📋 가족그룹 생성 신청',
      body:  `${requesterName}님이 가족그룹 생성을 신청했습니다.`,
    });
  }
);

// ── 정보공개 요청 즉시 알림 ─────────────────────────────────────────────────
// Firestore 트리거: info_requests 문서 생성 시 1회 실행
// 폴링 없음 — Firestore가 이벤트를 직접 전달
export const onInfoRequestCreated = onDocumentCreated(
  'info_requests/{requestId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const holderMemberId = data.holder_member_id as string | null;
    if (!holderMemberId) return; // 권한자 없으면 자동 승인됨, 알림 불필요

    const memberSnap = await db.doc(`members/${holderMemberId}`).get();
    const requesterName = (data.requester_name as string) ?? '누군가';
    await pushToMember(memberSnap.ref, memberSnap.data(), 'user', {
      title: '📬 정보공개 요청',
      body:  `${requesterName}님이 정보공개를 요청했습니다.`,
    });
  }
);

// ── 촌수 계산 (BFS) ───────────────────────────────────────────────────────

function getChusu(personId: string, baseId: string, rels: Rel[]): number | null {
  if (personId === baseId) return 0;
  const visited = new Map<string, number>();
  const queue: { id: string; dist: number }[] = [{ id: baseId, dist: 0 }];
  visited.set(baseId, 0);

  while (queue.length > 0) {
    const item = queue.shift()!;
    const { id: curr, dist } = item;
    if (curr === personId) return dist;

    for (const r of rels) {
      if (r.type === 'spouse') {
        const next = r.person1_id === curr ? r.person2_id
                   : r.person2_id === curr ? r.person1_id : null;
        if (next && !visited.has(next)) {
          visited.set(next, dist); // 배우자 = 0촌
          queue.push({ id: next, dist });
        }
      } else if (r.type === 'parent_child') {
        const parent = r.person2_id === curr ? r.person1_id : null;
        const child  = r.person1_id === curr ? r.person2_id : null;
        for (const next of [parent, child]) {
          if (next && !visited.has(next)) {
            visited.set(next, dist + 1);
            queue.push({ id: next, dist: dist + 1 });
          }
        }
      }
    }
  }
  return null;
}

// ── 기념일 알림 메시지 ────────────────────────────────────────────────────
// 회원 1명당 하루 1건으로 묶어서 발송 — 누르면 기념일 화면(/?view=anniversary)으로 이동
interface AnnivItem { kind: 'birth' | 'death'; offset: number; name: string; age?: number; }

// 사촌류(혈족)는 나이·성별로 형/누나/오빠/언니/동생을 붙임 — '사촌' → '사촌형'
function withSibTitle(relation: string, base: LabelPerson, target: LabelPerson): string {
  if (!/사촌$/.test(relation) || relation.includes(' ')) return relation;
  const bb = base.birth_date ?? '', tb = target.birth_date ?? '';
  if (!bb || !tb || bb === tb) return relation;
  if (tb > bb) return `${relation}동생`;
  if (base.gender === 'female') return relation + (target.gender === 'female' ? '언니' : '오빠');
  if (base.gender === 'male')   return relation + (target.gender === 'female' ? '누나' : '형');
  return relation;
}

// '사촌형 홍재학' 처럼 관계명을 이름 앞에 붙임 — 관계를 못 구하면 이름만
function annivName(target: LabelPerson, base: LabelPerson | undefined, persons: LabelPerson[], rels: Rel[]): string {
  const relation = base ? getRelationLabel(target.id, base, persons, rels) : '';
  if (!base || !relation || relation.includes('세대') || relation === '나') return target.name;
  return `${withSibTitle(relation, base, target)} ${target.name}`;
}

function annivWhen(offset: number): string {
  return offset === 0 ? '오늘' : offset === 1 ? '내일' : `${offset}일 후`;
}

function buildAnnivMessage(items: AnnivItem[]): PushMsg {
  const sorted = [...items].sort((a, b) => a.offset - b.offset);
  const common = { link: '/?view=anniversary', tag: 'anniversary', ttlSec: 86400 };

  if (sorted.length === 1) {
    const it = sorted[0];
    if (it.kind === 'birth') {
      const title = it.offset === 0 ? `🎂 ${it.name}님의 생일`
                  : it.offset === 1 ? `📅 내일은 ${it.name}님의 생일`
                  : `⏰ ${it.offset}일 후 ${it.name}님의 생일`;
      const body  = it.offset === 0 ? `오늘로 만 ${it.age}세! 가족들과 함께 축하해주세요.`
                  : it.offset === 1 ? `내일 만 ${it.age}세 생일입니다. 미리 축하 준비 어떠세요?`
                  : `${it.offset}일 뒤 만 ${it.age}세 생일입니다.`;
      return { title, body, ...common };
    }
    const title = it.offset === 0 ? `🕯️ 오늘은 ${it.name}님의 기일` : `🕯️ ${annivWhen(it.offset)} ${it.name}님의 기일`;
    const body  = it.offset === 0 ? '고인의 명복을 빕니다.'
                : it.offset === 1 ? '내일 기일입니다. 잊지 마세요.'
                : `${it.offset}일 뒤 기일입니다.`;
    return { title, body, ...common };
  }

  const body = sorted
    .map(it => `${annivWhen(it.offset)} ${it.name}님 ${it.kind === 'birth' ? '생일' : '기일'}`)
    .join('\n');
  return { title: `📅 가족 기념일 ${sorted.length}건`, body, ...common };
}

// ── 기념일 알림 스케줄러 ──────────────────────────────────────────────────
// 매분 실행 후 settings/push 의 sendHourKST:sendMinuteKST 와 일치할 때만 발송
// 개인 설정은 각 members 문서의 push_prefs 필드에서 읽음
export const sendAnniversaryReminders = onSchedule(
  { schedule: '* * * * *', timeZone: 'UTC' },
  async () => {
    // 발송 시각만 전역 설정에서 읽음
    const settingsSnap = await db.doc('settings/push').get();
    const sendHourKST: number = typeof settingsSnap.data()?.sendHourKST === 'number'
      ? (settingsSnap.data()!.sendHourKST as number) : 8;
    const sendMinuteKST: number = typeof settingsSnap.data()?.sendMinuteKST === 'number'
      ? (settingsSnap.data()!.sendMinuteKST as number) : 0;

    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    if (kst.getUTCHours() !== sendHourKST || kst.getUTCMinutes() !== sendMinuteKST) return;
    console.log(`기념일 알림 시작: KST ${sendHourKST}:${String(sendMinuteKST).padStart(2, '0')}`);

    await runAnniversaryReminders();
  }
);

// 관리자 수동 실행 — anniversary_runs 문서 생성 시 발송 시각과 무관하게 오늘 기념일 알림 발송
export const onAnniversaryRunRequested = onDocumentCreated(
  'anniversary_runs/{docId}',
  async (event) => {
    const data = event.data?.data();
    if (!data || data.done) return;
    const memberId = data.member_id as string | undefined;
    if (!memberId) return;
    const memberSnap = await db.doc(`members/${memberId}`).get();
    if (!memberSnap.data()?.is_admin) return;

    const r = await runAnniversaryReminders();
    await event.data!.ref.update({ done: true, done_at: new Date().toISOString(), ...r });
  }
);

async function runAnniversaryReminders() {
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayY = kst.getUTCFullYear();
    const todayM = kst.getUTCMonth() + 1;
    const todayD = kst.getUTCDate();

    // 한국천문연구원(KASI) 기준 음력 — solarlunar(중국 음력)는 합삭 시각 차이로 하루씩 어긋나는 달이 있음
    const lunarCal = new KoreanLunarCalendar();

    // 회원이 고를 수 있는 offset(당일·1·3·7일 전) 날짜를 양력·음력으로 미리 계산
    const allCheckDates = [0, 1, 3, 7].map(offset => {
      const d = new Date(Date.UTC(todayY, todayM - 1, todayD + offset));
      const m = d.getUTCMonth() + 1;
      const day = d.getUTCDate();
      const y = d.getUTCFullYear();
      lunarCal.setSolarDate(y, m, day);
      const lunar = lunarCal.getLunarCalendar();
      return { offset, solarM: m, solarD: day, lunarM: lunar.month, lunarD: lunar.day };
    });

    const DEFAULT_PREFS = {
      enabled: true, offsets: [0, 1, 3, 7], maxChusu: 6,
      enableBirthday: true, enableDeathDay: true,
    };

    interface MemberEntry {
      ref: FirebaseFirestore.DocumentReference;
      data: FirebaseFirestore.DocumentData;
      personId: string;
      prefs: typeof DEFAULT_PREFS;
      items: AnnivItem[];
    }

    const membersSnap = await db.collection('members').where('status', '==', 'active').get();

    const familyMap = new Map<string, MemberEntry[]>();
    for (const doc of membersSnap.docs) {
      const d = doc.data();
      if (!d.family_id || !d.person_id || d.is_admin) continue;
      if (memberTokens(d, 'user').length === 0) continue;

      // 개인 설정 읽기 (없으면 기본값)
      const pp = (d.push_prefs as Record<string, unknown>) ?? {};
      const prefs = {
        enabled:       pp.enabled !== false,
        offsets:       Array.isArray(pp.offsets) ? (pp.offsets as number[]) : DEFAULT_PREFS.offsets,
        maxChusu:      typeof pp.maxChusu === 'number' ? pp.maxChusu : DEFAULT_PREFS.maxChusu,
        enableBirthday: pp.enableBirthday !== false,
        enableDeathDay: pp.enableDeathDay !== false,
      };
      if (!prefs.enabled) continue;

      const list = familyMap.get(d.family_id as string) ?? [];
      list.push({ ref: doc.ref, data: d, personId: d.person_id as string, prefs, items: [] });
      familyMap.set(d.family_id as string, list);
    }

    if (familyMap.size === 0) { console.log('기념일 알림: 토큰 있는 회원 없음'); return { total: 0, targets: 0, okMembers: 0 }; }

    for (const [familyId, memberList] of familyMap) {
      const [personsSnap, relsSnap] = await Promise.all([
        db.collection('persons').where('family_id', '==', familyId).get(),
        db.collection('relationships').where('family_id', '==', familyId).get(),
      ]);

      const persons = personsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as LabelPerson);
      const rels    = relsSnap.docs.map(d => d.data() as Rel);

      for (const member of memberList) {
        const { prefs } = member;
        const checkDates = allCheckDates.filter(cd => prefs.offsets.includes(cd.offset));
        if (checkDates.length === 0) continue;
        const base = persons.find(p => p.id === member.personId);
        const nameOf = (p: LabelPerson) => annivName(p, base, persons, rels);

        for (const person of persons) {
          const p = person as LabelPerson & {
            birth_date?: string; birth_lunar?: boolean; is_deceased?: boolean;
            death_date?: string; death_lunar?: boolean;
          };

          const chusu = getChusu(p.id, member.personId, rels);
          if (chusu === null || chusu > prefs.maxChusu) continue;

          // ── 생일 체크 ────────────────────────────────────────────────────
          if (prefs.enableBirthday && p.birth_date && !p.is_deceased) {
            const [by, bm, bd] = p.birth_date.split('-').map(Number);
            for (const chk of checkDates) {
              const match = p.birth_lunar
                ? (bm === chk.lunarM && bd === chk.lunarD)
                : (bm === chk.solarM && bd === chk.solarD);
              if (!match) continue;
              member.items.push({ kind: 'birth', offset: chk.offset, name: nameOf(p), age: todayY - by });
            }
          }

          // ── 기일 체크 ────────────────────────────────────────────────────
          if (prefs.enableDeathDay && p.death_date) {
            const [, dm, dd] = p.death_date.split('-').map(Number);
            for (const chk of checkDates) {
              const match = p.death_lunar
                ? (dm === chk.lunarM && dd === chk.lunarD)
                : (dm === chk.solarM && dd === chk.solarD);
              if (!match) continue;
              member.items.push({ kind: 'death', offset: chk.offset, name: nameOf(p) });
            }
          }
        }
      }
    }

    let total = 0, okMembers = 0;
    const targets = [...familyMap.values()].flat().filter(m => m.items.length > 0);
    await Promise.all(targets.map(async m => {
      total += m.items.length;
      const r = await pushToMember(m.ref, m.data, 'user', buildAnnivMessage(m.items));
      if (r.ok > 0) okMembers++;
    }));
    console.log(`기념일 알림 완료: ${total}건 / 대상 ${targets.length}명 / 수신 성공 ${okMembers}명`);
    return { total, targets: targets.length, okMembers };
}

// ── 관리자 수동 공지 푸시 ────────────────────────────────────────────────────
// push_broadcasts 문서 생성 시 트리거 — 전체 또는 특정 회원에게 발송
export const onBroadcastPushCreated = onDocumentCreated(
  'push_broadcasts/{docId}',
  async (event) => {
    const data = event.data?.data();
    if (!data || data.sent) return;

    const memberId = data.member_id as string | undefined;
    if (!memberId) return;

    const memberSnap = await db.doc(`members/${memberId}`).get();
    if (!memberSnap.data()?.is_admin) return;

    const title = ((data.title as string) ?? '').trim();
    const body  = ((data.body  as string) ?? '').trim();
    if (!title) return;

    const targetMemberId = data.target_member_id as string | null;
    let count = 0;

    const msg: PushMsg = { title, body };
    if (targetMemberId) {
      const targetSnap = await db.doc(`members/${targetMemberId}`).get();
      const r = await pushToMember(targetSnap.ref, targetSnap.data(), 'user', msg);
      if (r.ok > 0) count = 1;
    } else {
      const snap = await db.collection('members').where('status', '==', 'active').get();
      const results = await Promise.all(snap.docs.map(d => pushToMember(d.ref, d.data(), 'user', msg)));
      count = results.filter(r => r.ok > 0).length;
    }

    await event.data!.ref.update({ sent: true, sent_at: new Date().toISOString(), sent_count: count });
    console.log(`공지 푸시 발송 완료: ${count}명`);
  }
);

// ── 서버 테스트 알림 ────────────────────────────────────────────────────────
// push_tests 문서 생성 시 해당 회원의 모든 기기로 테스트 푸시 → 결과를 같은 문서에 기록
export const onPushTestCreated = onDocumentCreated(
  'push_tests/{docId}',
  async (event) => {
    const data = event.data?.data();
    if (!data || data.done) return;
    const memberId = data.member_id as string | undefined;
    if (!memberId) return;
    const scope: PushScope = data.scope === 'admin' ? 'admin' : 'user';

    const memberSnap = await db.doc(`members/${memberId}`).get();
    const r = await pushToMember(memberSnap.ref, memberSnap.data(), scope, {
      title: '🔔 서버 테스트 알림',
      body:  '이 알림이 보이면 기념일·요청 알림도 정상적으로 받을 수 있어요.',
      tag:   'server-test',
      ttlSec: 600,
      // 기념일 알림과 같은 링크 — 누르면 기념일 화면으로 가는지 함께 확인
      ...(scope === 'user' ? { link: '/?view=anniversary' } : {}),
    });
    await event.data!.ref.update({ done: true, done_at: new Date().toISOString(), ...r });
  }
);

// ── 로그 정리 (접속 로그 + 활동 로그) ─────────────────────────────────────
// 매월 1일 UTC 00:00 (KST 09:00) 실행 — 1년 이전 문서 일괄 삭제
async function batchDelete(refs: FirebaseFirestore.DocumentReference[]) {
  for (let i = 0; i < refs.length; i += 500) {
    const batch = db.batch();
    refs.slice(i, i + 500).forEach(r => batch.delete(r));
    await batch.commit();
  }
}

export const cleanupLoginLogs = onSchedule(
  { schedule: '0 0 1 * *', timeZone: 'UTC' },
  async () => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffIso = cutoff.toISOString();

    const [loginSnap, actSnap] = await Promise.all([
      db.collection('login_logs').where('logged_in_at', '<', cutoffIso).get(),
      db.collection('activity_logs').where('at', '<', cutoffIso).get(),
    ]);

    await Promise.all([
      batchDelete(loginSnap.docs.map(d => d.ref)),
      batchDelete(actSnap.docs.map(d => d.ref)),
    ]);

    console.log(`로그 정리 완료: 접속 ${loginSnap.size}건, 활동 ${actSnap.size}건 삭제`);
  }
);

// ── 인증·계정 Callable ───────────────────────────────────────────────────────
export * from './auth';
