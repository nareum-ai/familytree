import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

/** 기념일 알림 발송 시각 (settings/push, 관리자 설정) — 문서·필드가 없으면 Functions 기본값 08:00 */
export interface PushSendTime { hour: number; minute: number; }
const DEFAULT_TIME: PushSendTime = { hour: 8, minute: 0 };

// 세션 중 거의 바뀌지 않으므로 한 번만 조회해 공유
let sendTimePromise: Promise<PushSendTime> | null = null;

function fetchSendTime(): Promise<PushSendTime> {
  sendTimePromise ??= getDoc(doc(db, 'settings', 'push'))
    .then(snap => {
      const { sendHourKST: h, sendMinuteKST: m } = snap.data() ?? {};
      return typeof h === 'number' ? { hour: h, minute: typeof m === 'number' ? m : 0 } : DEFAULT_TIME;
    })
    .catch(() => { sendTimePromise = null; return DEFAULT_TIME; });
  return sendTimePromise;
}

/** "오전 8시", "오후 9시 45분" */
export function formatSendTime({ hour, minute }: PushSendTime): string {
  const ampm = hour < 12 ? '오전' : '오후';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${ampm} ${h12}시${minute ? ` ${minute}분` : ''}`;
}

export function usePushSendTime(): PushSendTime {
  const [time, setTime] = useState(DEFAULT_TIME);
  useEffect(() => {
    let cancelled = false;
    fetchSendTime().then(t => { if (!cancelled) setTime(t); });
    return () => { cancelled = true; };
  }, []);
  return time;
}
