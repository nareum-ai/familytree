import type { Member } from '../types';

/** 회원의 일반(가계도) 푸시 수신 기기 수 — 배열 + 구버전 단일 필드 합산(중복 제거) */
export function pushDeviceCount(m: Member): number {
  const set = new Set<string>(Array.isArray(m.fcm_tokens) ? m.fcm_tokens : []);
  if (m.fcm_token) set.add(m.fcm_token);
  return set.size;
}

export type PushHealth = 'ok' | 'failing' | 'none';

/** 수신 상태: 기기 없음 / 최근 실패가 마지막 성공보다 나중 / 정상 */
export function pushHealth(m: Member): PushHealth {
  if (pushDeviceCount(m) === 0) return 'none';
  const ok = m.push_last_ok_at ?? '';
  const fail = m.push_last_fail_at ?? '';
  if (fail && fail > ok) return 'failing';
  return 'ok';
}
