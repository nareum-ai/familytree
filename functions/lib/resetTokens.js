"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateResetTokens = invalidateResetTokens;
const firestore_1 = require("firebase-admin/firestore");
/** 회원의 아직 안 쓴 비밀번호 초기화 링크를 모두 무효화 (exceptId는 남김) */
async function invalidateResetTokens(memberId, exceptId) {
    const snap = await (0, firestore_1.getFirestore)().collection('password_reset_tokens')
        .where('member_id', '==', memberId).where('used', '==', false).get();
    await Promise.all(snap.docs.filter(d => d.id !== exceptId).map(d => d.ref.update({ used: true })));
}
//# sourceMappingURL=resetTokens.js.map