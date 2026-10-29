const MIN_PASSWORD_LENGTH = 6;

/** 새 비밀번호 입력 검증 — 문제가 있으면 오류 메시지, 없으면 null */
export function validateNewPassword(newPassword: string, confirmPassword: string): string | null {
  if (newPassword.length < MIN_PASSWORD_LENGTH) return `새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  if (newPassword !== confirmPassword) return '새 비밀번호가 일치하지 않습니다.';
  return null;
}
