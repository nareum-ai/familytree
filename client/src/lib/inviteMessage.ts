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

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * 경로에서 초대 토큰(UUID)만 추출.
 * 카카오톡 → 외부 브라우저 전환 과정에서 URL이 한 번 더 인코딩되면
 * `?from=`이 `%3Ffrom%3D...`로 경로에 붙어 토큰이 오염되므로 UUID 부분만 뽑는다.
 */
export function extractInviteToken(raw: string): string {
  let s = raw;
  for (let i = 0; i < 3; i++) {
    const m = s.match(UUID_RE);
    if (m) return m[0].toLowerCase();
    try { s = decodeURIComponent(s); } catch { break; }
  }
  return raw;
}

/** 깨끗한 초대 URL (외부 브라우저로 넘길 때 사용) */
export function canonicalInviteUrl(token: string): string {
  const from = new URLSearchParams(window.location.search).get('from');
  const base = `${window.location.origin}/invite/${token}`;
  return from ? `${base}?from=${encodeURIComponent(from)}` : base;
}
