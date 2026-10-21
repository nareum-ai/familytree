import { getUserName } from './session';

/** 받는 사람이 누가 보냈는지 알 수 있도록 보낸 사람 이름을 포함 */
export function buildInviteMessage(personName: string) {
  const sender = getUserName();
  return `${sender ? `${sender}님이` : '가족이'} 우리 가족 가계도에 ${personName}님을 초대했어요.\n`
    + '아래 링크를 눌러 가입하면 바로 가계도를 볼 수 있어요.';
}

/** 초대 토큰 → 공유용 링크 (인앱 브라우저용으로 보낸 사람 이름을 ?from=에 포함) */
export function buildInviteLink(token: string) {
  const sender = getUserName();
  const base = `${window.location.origin}/invite/${token}`;
  return sender ? `${base}?from=${encodeURIComponent(sender)}` : base;
}
