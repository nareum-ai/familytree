"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupLoginLogs = exports.sendAnniversaryReminders = exports.onInfoRequestCreated = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const firestore_2 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const v2_1 = require("firebase-functions/v2");
(0, app_1.initializeApp)();
(0, v2_1.setGlobalOptions)({ region: 'asia-northeast3' });
const db = (0, firestore_1.getFirestore)();
const fcm = (0, messaging_1.getMessaging)();
// ── FCM 전송 헬퍼 ─────────────────────────────────────────────────────────
async function sendPush(token, title, body, link = '/') {
    try {
        await fcm.send({
            token,
            notification: { title, body },
            webpush: {
                notification: { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' },
                fcmOptions: { link },
            },
        });
    }
    catch (_a) {
        // 만료 토큰 등 조용히 무시
    }
}
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
exports.sendAnniversaryReminders = (0, scheduler_1.onSchedule)({ schedule: '0 * * * *', timeZone: 'UTC' }, async () => {
    var _a, _b;
    // ── 관리자 설정 로드 (없으면 기본값 사용) ─────────────────────────────
    const settingsSnap = await db.doc('settings/push').get();
    const cfg = (_a = settingsSnap.data()) !== null && _a !== void 0 ? _a : {};
    const sendHourKST = typeof cfg.sendHourKST === 'number' ? cfg.sendHourKST : 8;
    const offsets = Array.isArray(cfg.offsets) ? cfg.offsets : [0, 1, 3, 7];
    const maxChusu = typeof cfg.maxChusu === 'number' ? cfg.maxChusu : 6;
    const enableBirthday = cfg.enableBirthday !== false;
    const enableDeathDay = cfg.enableDeathDay !== false;
    // KST 기준 오늘 날짜
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    // 설정된 발송 시간이 아니면 종료
    if (kst.getUTCHours() !== sendHourKST)
        return;
    const todayY = kst.getUTCFullYear();
    const todayM = kst.getUTCMonth() + 1;
    const todayD = kst.getUTCDate();
    // solarlunar로 각 offset의 음력 날짜 미리 계산
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sl = require('solarlunar');
    const checkDates = offsets.map(offset => {
        const d = new Date(Date.UTC(todayY, todayM - 1, todayD + offset));
        const m = d.getUTCMonth() + 1;
        const day = d.getUTCDate();
        const y = d.getUTCFullYear();
        const lunar = sl.solar2lunar(y, m, day);
        return { offset, solarM: m, solarD: day, lunarM: lunar.lMonth, lunarD: lunar.lDay };
    });
    // FCM 토큰 있는 활성 일반 회원 목록 (가족별 그룹화)
    const membersSnap = await db.collection('members')
        .where('status', '==', 'active')
        .get();
    // familyId → { memberId, personId, token }[]
    const familyMap = new Map();
    for (const doc of membersSnap.docs) {
        const d = doc.data();
        if (!d.family_id || !d.fcm_token || !d.person_id || d.is_admin)
            continue;
        const list = (_b = familyMap.get(d.family_id)) !== null && _b !== void 0 ? _b : [];
        list.push({ memberId: doc.id, personId: d.person_id, token: d.fcm_token });
        familyMap.set(d.family_id, list);
    }
    if (familyMap.size === 0)
        return;
    const sends = [];
    for (const [familyId, memberList] of familyMap) {
        // 가족 인물 + 관계 로드
        const [personsSnap, relsSnap] = await Promise.all([
            db.collection('persons').where('family_id', '==', familyId).get(),
            db.collection('relationships').where('family_id', '==', familyId).get(),
        ]);
        const persons = personsSnap.docs.map(d => (Object.assign({ id: d.id }, d.data())));
        const rels = relsSnap.docs.map(d => d.data());
        // 각 멤버 기준으로 6촌 이내 인물 필터 → 기념일 체크
        for (const member of memberList) {
            for (const person of persons) {
                const p = person;
                const chusu = getChusu(p.id, member.personId, rels);
                if (chusu === null || chusu > maxChusu)
                    continue;
                // ── 생일 체크 ────────────────────────────────────────────────────
                if (enableBirthday && p.birth_date && !p.is_deceased) {
                    const [by, bm, bd] = p.birth_date.split('-').map(Number);
                    for (const chk of checkDates) {
                        const match = p.birth_lunar
                            ? (bm === chk.lunarM && bd === chk.lunarD)
                            : (bm === chk.solarM && bd === chk.solarD);
                        if (!match)
                            continue;
                        const age = todayY - by;
                        let title = '';
                        let body = '';
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
                if (enableDeathDay && p.death_date) {
                    const [, dm, dd] = p.death_date.split('-').map(Number);
                    for (const chk of checkDates) {
                        const match = p.death_lunar
                            ? (dm === chk.lunarM && dd === chk.lunarD)
                            : (dm === chk.solarM && dd === chk.solarD);
                        if (!match)
                            continue;
                        let title = '';
                        let body = '';
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
// ── 접속 로그 정리 ───────────────────────────────────────────────────────────
// 매월 1일 UTC 00:00 (KST 09:00) 실행
// 1년(365일) 이전 login_logs 문서 일괄 삭제 — 배치 500개 제한 준수
exports.cleanupLoginLogs = (0, scheduler_1.onSchedule)({ schedule: '0 0 1 * *', timeZone: 'UTC' }, async () => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffIso = cutoff.toISOString();
    const snap = await db.collection('login_logs')
        .where('logged_in_at', '<', cutoffIso)
        .get();
    if (snap.empty) {
        console.log('삭제할 오래된 접속 로그 없음');
        return;
    }
    // 500개 단위 배치 삭제
    const chunks = [];
    const refs = snap.docs.map(d => d.ref);
    for (let i = 0; i < refs.length; i += 500) {
        chunks.push(refs.slice(i, i + 500));
    }
    await Promise.all(chunks.map(chunk => {
        const batch = db.batch();
        chunk.forEach(ref => batch.delete(ref));
        return batch.commit();
    }));
    console.log(`접속 로그 정리 완료: ${snap.size}건 삭제 (기준: ${cutoffIso})`);
});
//# sourceMappingURL=index.js.map