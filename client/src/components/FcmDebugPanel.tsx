import { useState } from 'react';
import { getToken } from 'firebase/messaging';
import { getMessagingInstance } from '../lib/firebase';
import { useFamilyStore } from '../store/familyStore';
import { LS } from '../lib/storageKeys';

const VAPID_KEY = 'BLRyRDSVY-2HCMviKpkqFKB2Nf2WHLipd2dh6WdQSK7thzEVX1UNENkr9oviMKeqFhgmELvbpD0yIrJm2xgLz-g';

export function FcmDebugPanel() {
  const { saveFcmToken } = useFamilyStore();
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const add = (msg: string) => setLog(prev => [...prev, msg]);

  const runTest = async () => {
    setLog([]);
    setRunning(true);
    try {
      add(`PWA 모드: ${window.matchMedia('(display-mode: standalone)').matches ? '✅' : '❌'}`);
      add(`알림 권한: ${Notification.permission}`);

      const { isSupported } = await import('firebase/messaging');
      const supported = await isSupported();
      add(`FCM 지원: ${supported ? '✅' : '❌'}`);
      if (!supported) { add('❌ 이 환경에서 FCM 미지원'); return; }

      const messaging = await getMessagingInstance();
      if (!messaging) { add('❌ messaging 인스턴스 없음'); return; }
      add('✅ messaging 초기화 완료');

      if (Notification.permission !== 'granted') {
        add('권한 요청 중...');
        const p = await Notification.requestPermission();
        add(`권한 결과: ${p}`);
        if (p !== 'granted') return;
      }

      add('서비스워커 대기 중...');
      const swReg = await navigator.serviceWorker.ready;
      add(`✅ SW 스코프: ${swReg.scope}`);

      add('토큰 요청 중...');
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      });

      if (!token) { add('❌ 토큰 빈값'); return; }
      add(`✅ 토큰 획득: ${token.slice(0, 30)}...`);

      const memberId = localStorage.getItem(LS.MEMBER_ID);
      if (!memberId) { add('❌ memberId 없음'); return; }

      await saveFcmToken(memberId, token, 'fcm_token');
      localStorage.setItem(LS.FCM_TOKEN_SAVED, token);
      add('✅ Firestore 저장 완료!');
    } catch (e: unknown) {
      add(`❌ 오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="my-fcm-debug">
      <p className="my-fcm-debug-title">🔧 알림 진단</p>
      <p>FCM 토큰: <b>{localStorage.getItem(LS.FCM_TOKEN_SAVED) ? '✅ 저장됨' : '❌ 없음'}</b></p>
      <button
        onClick={runTest}
        disabled={running}
        style={{
          marginTop: 8, padding: '8px 16px',
          background: '#2AABE2', color: 'white',
          border: 'none', borderRadius: 8,
          fontSize: 13, cursor: 'pointer', width: '100%',
        }}
      >
        {running ? '진단 중...' : '🔍 토큰 등록 테스트'}
      </button>
      {log.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.8, wordBreak: 'break-all' }}>
          {log.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      )}
    </div>
  );
}
