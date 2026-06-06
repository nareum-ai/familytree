"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupLoginLogs = exports.onBroadcastPushCreated = exports.sendAnniversaryReminders = exports.onInfoRequestCreated = exports.onApprovalRequestCreated = exports.onPasswordResetRequestCreated = exports.onPasswordResetTokenCreated = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const firestore_2 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
const params_1 = require("firebase-functions/params");
const nodemailer = require("nodemailer");
const MAIL_USER = (0, params_1.defineSecret)('MAIL_USER');
const MAIL_PASS = (0, params_1.defineSecret)('MAIL_PASS');
(0, app_1.initializeApp)();
(0, v2_1.setGlobalOptions)({ region: 'asia-northeast3' });
const db = (0, firestore_1.getFirestore)();
const fcm = (0, messaging_1.getMessaging)();
const APP_URL = 'https://familytree-3221b.web.app';
const APP_NAME = '우리 가족 가계도';
// ── FCM 전송 헬퍼 ─────────────────────────────────────────────────────────
async function sendPush(token, title, body, link = '/') {
    var _a;
    const absoluteLink = link.startsWith('http') ? link : `${APP_URL}${link}`;
    try {
        const messageId = await fcm.send({
            token,
            webpush: {
                headers: { Urgency: 'high' },
                data: { title, body, link: absoluteLink },
            },
        });
        console.log(`FCM 전송 성공: ${messageId}`);
    }
    catch (err) {
        console.error('FCM 전송 실패:', (_a = err.message) !== null && _a !== void 0 ? _a : err);
    }
}
// ── 비밀번호 초기화 토큰 생성 → 이메일 자동 발송 ─────────────────────────────
// contact_email 필드가 있으면 해당 주소로, 없으면 member.email로 발송
// (자동: member.email 사용 / 관리자 승인: contact_email 사용)
exports.onPasswordResetTokenCreated = (0, firestore_2.onDocumentCreated)({ document: 'password_reset_tokens/{docId}', secrets: [MAIL_USER, MAIL_PASS] }, async (event) => {
    var _a, _b, _c;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    let toEmail = data.contact_email;
    if (!toEmail) {
        const memberSnap = await db.doc(`members/${data.member_id}`).get();
        const personId = (_b = memberSnap.data()) === null || _b === void 0 ? void 0 : _b.person_id;
        if (personId) {
            const personSnap = await db.doc(`persons/${personId}`).get();
            toEmail = (_c = personSnap.data()) === null || _c === void 0 ? void 0 : _c.email;
        }
    }
    if (!toEmail)
        return;
    const link = `${APP_URL}/reset/${data.token}`;
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: MAIL_USER.value(), pass: MAIL_PASS.value() },
    });
    await transporter.sendMail({
        from: `"${APP_NAME}" <${MAIL_USER.value()}>`,
        to: toEmail,
        subject: `[${APP_NAME}] 비밀번호 초기화 링크`,
        html: `
        <p>안녕하세요.</p>
        <p>비밀번호 초기화 요청이 접수되었습니다.<br/>
        아래 링크를 클릭하여 새 비밀번호를 설정하세요.</p>
        <p><a href="${link}" style="color:#4F46E5;font-weight:bold">비밀번호 초기화하기</a></p>
        <p>링크는 <strong>1시간</strong> 동안 유효합니다.<br/>
        본인이 요청하지 않았다면 이 이메일을 무시하세요.</p>
      `,
    });
});
// 관리자 초기화 요청 → 관리자 FCM 알림
exports.onPasswordResetRequestCreated = (0, firestore_2.onDocumentCreated)('password_reset_requests/{docId}', async (event) => {
    var _a, _b;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data || data.status !== 'pending')
        return;
    const adminsSnap = await db.collection('members')
        .where('is_admin', '==', true)
        .get();
    const username = (_b = data.username) !== null && _b !== void 0 ? _b : '누군가';
    const sends = adminsSnap.docs
        .map(d => d.data().fcm_token_admin)
        .filter((t) => !!t)
        .map(token => sendPush(token, '🔑 비밀번호 초기화 요청', `${username}님이 비밀번호 초기화를 요청했습니다.`, '/'));
    await Promise.all(sends);
});
// ── 가족그룹 신청 즉시 알림 (관리자) ─────────────────────────────────────────
exports.onApprovalRequestCreated = (0, firestore_2.onDocumentCreated)('approval_requests/{requestId}', async (event) => {
    var _a, _b;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data || data.status !== 'pending')
        return;
    const adminsSnap = await db.collection('members')
        .where('is_admin', '==', true)
        .get();
    const requesterName = (_b = data.requested_name) !== null && _b !== void 0 ? _b : '누군가';
    const sends = adminsSnap.docs
        .map(d => d.data().fcm_token_admin)
        .filter((t) => !!t)
        .map(token => sendPush(token, '📋 가족그룹 생성 신청', `${requesterName}님이 가족그룹 생성을 신청했습니다.`, '/'));
    await Promise.all(sends);
});
// ── 정보공개 요청 즉시 알림 ─────────────────────────────────────────────────
// Firestore 트리거: info_requests 문서 생성 시 1회 실행
// 폴링 없음 — Firestore가 이벤트를 직접 전달
exports.onInfoRequestCreated = (0, firestore_2.onDocumentCreated)('info_requests/{requestId}', async (event) => {
    var _a, _b, _c;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    const holderMemberId = data.holder_member_id;
    if (!holderMemberId)
        return; // 권한자 없으면 자동 승인됨, 알림 불필요
    const memberSnap = await db.doc(`members/${holderMemberId}`).get();
    const fcmToken = (_b = memberSnap.data()) === null || _b === void 0 ? void 0 : _b.fcm_token;
    if (!fcmToken)
        return;
    const requesterName = (_c = data.requester_name) !== null && _c !== void 0 ? _c : '누군가';
    await sendPush(fcmToken, '📬 정보공개 요청', `${requesterName}님이 정보공개를 요청했습니다.`);
});
function getChusu(personId, baseId, rels) {
    if (personId === baseId)
        return 0;
    const visited = new Map();
    const queue = [{ id: baseId, dist: 0 }];
    visited.set(baseId, 0);
    while (queue.length > 0) {
        const item = queue.shift();
        const { id: curr, dist } = item;
        if (curr === personId)
            return dist;
        for (const r of rels) {
            if (r.type === 'spouse') {
                const next = r.person1_id === curr ? r.person2_id
                    : r.person2_id === curr ? r.person1_id : null;
                if (next && !visited.has(next)) {
                    visited.set(next, dist); // 배우자 = 0촌
                    queue.push({ id: next, dist });
                }
            }
            else if (r.type === 'parent_child') {
                const parent = r.person2_id === curr ? r.person1_id : null;
                const child = r.person1_id === curr ? r.person2_id : null;
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
// ── 기념일 알림 스케줄러 ──────────────────────────────────────────────────
// 매시간 실행 후 settings/push 의 sendHourKST 와 일치할 때만 발송
// 개인 설정은 각 members 문서의 push_prefs 필드에서 읽음
exports.sendAnniversaryReminders = (0, scheduler_1.onSchedule)({ schedule: '0 * * * *', timeZone: 'UTC' }, async () => {
    var _a, _b, _c;
    // 발송 시간만 전역 설정에서 읽음
    const settingsSnap = await db.doc('settings/push').get();
    const sendHourKST = typeof ((_a = settingsSnap.data()) === null || _a === void 0 ? void 0 : _a.sendHourKST) === 'number'
        ? settingsSnap.data().sendHourKST : 8;
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    if (kst.getUTCHours() !== sendHourKST)
        return;
    const todayY = kst.getUTCFullYear();
    const todayM = kst.getUTCMonth() + 1;
    const todayD = kst.getUTCDate();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sl = require('solarlunar');
    // 가능한 4개 offset 전체 미리 계산
    const allCheckDates = [0, 1, 3, 7].map(offset => {
        const d = new Date(Date.UTC(todayY, todayM - 1, todayD + offset));
        const m = d.getUTCMonth() + 1;
        const day = d.getUTCDate();
        const y = d.getUTCFullYear();
        const lunar = sl.solar2lunar(y, m, day);
        return { offset, solarM: m, solarD: day, lunarM: lunar.lMonth, lunarD: lunar.lDay };
    });
    const DEFAULT_PREFS = {
        enabled: true, offsets: [0, 1, 3, 7], maxChusu: 6,
        enableBirthday: true, enableDeathDay: true,
    };
    const membersSnap = await db.collection('members').where('status', '==', 'active').get();
    const familyMap = new Map();
    for (const doc of membersSnap.docs) {
        const d = doc.data();
        if (!d.family_id || !d.fcm_token || !d.person_id || d.is_admin)
            continue;
        // 개인 설정 읽기 (없으면 기본값)
        const pp = (_b = d.push_prefs) !== null && _b !== void 0 ? _b : {};
        const prefs = {
            enabled: pp.enabled !== false,
            offsets: Array.isArray(pp.offsets) ? pp.offsets : DEFAULT_PREFS.offsets,
            maxChusu: typeof pp.maxChusu === 'number' ? pp.maxChusu : DEFAULT_PREFS.maxChusu,
            enableBirthday: pp.enableBirthday !== false,
            enableDeathDay: pp.enableDeathDay !== false,
        };
        if (!prefs.enabled)
            continue;
        const list = (_c = familyMap.get(d.family_id)) !== null && _c !== void 0 ? _c : [];
        list.push({ memberId: doc.id, personId: d.person_id, token: d.fcm_token, prefs });
        familyMap.set(d.family_id, list);
    }
    if (familyMap.size === 0)
        return;
    const sends = [];
    for (const [familyId, memberList] of familyMap) {
        const [personsSnap, relsSnap] = await Promise.all([
            db.collection('persons').where('family_id', '==', familyId).get(),
            db.collection('relationships').where('family_id', '==', familyId).get(),
        ]);
        const persons = personsSnap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
        const rels = relsSnap.docs.map(d => d.data());
        for (const member of memberList) {
            const { prefs } = member;
            const checkDates = allCheckDates.filter(cd => prefs.offsets.includes(cd.offset));
            if (checkDates.length === 0)
                continue;
            for (const person of persons) {
                const p = person;
                const chusu = getChusu(p.id, member.personId, rels);
                if (chusu === null || chusu > prefs.maxChusu)
                    continue;
                // ── 생일 체크 ────────────────────────────────────────────────────
                if (prefs.enableBirthday && p.birth_date && !p.is_deceased) {
                    const [by, bm, bd] = p.birth_date.split('-').map(Number);
                    for (const chk of checkDates) {
                        const match = p.birth_lunar
                            ? (bm === chk.lunarM && bd === chk.lunarD)
                            : (bm === chk.solarM && bd === chk.solarD);
                        if (!match)
                            continue;
                        const age = todayY - by;
                        let title = '', body = '';
                        if (chk.offset === 0) {
                            title = `🎂 ${p.name}님의 생일`;
                            body = `오늘로 만 ${age}세! 가족들과 함께 축하해주세요.`;
                        }
                        else if (chk.offset === 1) {
                            title = `📅 내일은 ${p.name}님의 생일`;
                            body = `내일 만 ${age}세 생일입니다. 미리 축하 준비 어떠세요?`;
                        }
                        else {
                            title = `⏰ ${chk.offset}일 후 ${p.name}님의 생일`;
                            body = `${chk.offset}일 뒤 만 ${age}세 생일입니다.`;
                        }
                        sends.push(sendPush(member.token, title, body));
                    }
                }
                // ── 기일 체크 ────────────────────────────────────────────────────
                if (prefs.enableDeathDay && p.death_date) {
                    const [, dm, dd] = p.death_date.split('-').map(Number);
                    for (const chk of checkDates) {
                        const match = p.death_lunar
                            ? (dm === chk.lunarM && dd === chk.lunarD)
                            : (dm === chk.solarM && dd === chk.solarD);
                        if (!match)
                            continue;
                        let title = '', body = '';
                        if (chk.offset === 0) {
                            title = `🕯️ 오늘은 ${p.name}님의 기일`;
                            body = '고인의 명복을 빕니다.';
                        }
                        else if (chk.offset === 1) {
                            title = `🕯️ 내일은 ${p.name}님의 기일`;
                            body = '내일 기일입니다. 잊지 마세요.';
                        }
                        else {
                            title = `🕯️ ${chk.offset}일 후 ${p.name}님의 기일`;
                            body = `${chk.offset}일 뒤 기일입니다.`;
                        }
                        sends.push(sendPush(member.token, title, body));
                    }
                }
            }
        }
    }
    await Promise.all(sends);
    console.log(`기념일 알림 완료: ${sends.length}건`);
});
// ── 관리자 수동 공지 푸시 ────────────────────────────────────────────────────
// push_broadcasts 문서 생성 시 트리거 — 전체 또는 특정 회원에게 발송
exports.onBroadcastPushCreated = (0, firestore_2.onDocumentCreated)('push_broadcasts/{docId}', async (event) => {
    var _a, _b, _c, _d, _e;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data || data.sent)
        return;
    const memberId = data.member_id;
    if (!memberId)
        return;
    const memberSnap = await db.doc(`members/${memberId}`).get();
    if (!((_b = memberSnap.data()) === null || _b === void 0 ? void 0 : _b.is_admin))
        return;
    const title = ((_c = data.title) !== null && _c !== void 0 ? _c : '').trim();
    const body = ((_d = data.body) !== null && _d !== void 0 ? _d : '').trim();
    if (!title)
        return;
    const targetMemberId = data.target_member_id;
    let count = 0;
    if (targetMemberId) {
        const targetSnap = await db.doc(`members/${targetMemberId}`).get();
        const token = (_e = targetSnap.data()) === null || _e === void 0 ? void 0 : _e.fcm_token;
        if (token) {
            await sendPush(token, title, body);
            count = 1;
        }
    }
    else {
        const snap = await db.collection('members').where('status', '==', 'active').get();
        const sends = snap.docs
            .map(d => d.data().fcm_token)
            .filter((t) => !!t)
            .map(token => sendPush(token, title, body));
        await Promise.all(sends);
        count = sends.length;
    }
    await event.data.ref.update({ sent: true, sent_at: new Date().toISOString(), sent_count: count });
    console.log(`공지 푸시 발송 완료: ${count}명`);
});
// ── 로그 정리 (접속 로그 + 활동 로그) ─────────────────────────────────────
// 매월 1일 UTC 00:00 (KST 09:00) 실행 — 1년 이전 문서 일괄 삭제
async function batchDelete(refs) {
    for (let i = 0; i < refs.length; i += 500) {
        const batch = db.batch();
        refs.slice(i, i + 500).forEach(r => batch.delete(r));
        await batch.commit();
    }
}
exports.cleanupLoginLogs = (0, scheduler_1.onSchedule)({ schedule: '0 0 1 * *', timeZone: 'UTC' }, async () => {
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
});
//# sourceMappingURL=index.js.map