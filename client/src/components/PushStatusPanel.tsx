import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getMemberData } from '../lib/firestore';
import {
  isAndroidAppInstalled, isIOS, isStandalone, openInAndroidApp, shouldOfferPlayApp,
} from '../lib/device';
import { isDeviceRegistered, isPushSupported, notificationPermission, pushScope } from '../lib/pushNotifications';
import { requestServerPushTest } from '../services/authService';
import { pushDeviceCount } from '../utils/pushStatus';
import type { Member } from '../types';
import { Icon } from './Icon';

const TEST_TIMEOUT_MS = 20000;

type DeviceState = 'ready' | 'off' | 'blocked' | 'ios-browser' | 'unsupported';

function fmt(iso?: string | null) {
  if (!iso) return '-';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const STATE_LABEL: Record<DeviceState, string> = {
  'ready':       '받는 중',
  'off':         '꺼짐',
  'blocked':     '차단됨',
  'ios-browser': '홈 화면 추가 필요',
  'unsupported': '이 브라우저는 미지원',
};

/** 내메뉴: 이 기기 알림 상태 + 등록 기기 수 + 서버 테스트 알림 + (Android 브라우저) Play 스토어 앱 */
export function PushStatusPanel({ memberId }: { memberId: string }) {
  const [state, setState]   = useState<DeviceState | null>(null);
  const [member, setMember] = useState<Partial<Member> | null>(null);
  const [appInstalled, setAppInstalled] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  const showPlayRow = shouldOfferPlayApp();

  const loadStatus = async () => {
    const supported = await isPushSupported();
    const perm = notificationPermission();
    let s: DeviceState;
    if (isIOS() && !isStandalone()) s = 'ios-browser';
    else if (!supported) s = 'unsupported';
    else if (perm === 'denied') s = 'blocked';
    else if (isDeviceRegistered()) s = 'ready';
    else s = 'off';
    const m = (await getMemberData(memberId).catch(() => undefined)) as Partial<Member> | undefined;
    return { s, m: m ?? null };
  };

  const refresh = () => loadStatus().then(({ s, m }) => { setState(s); setMember(m); });

  useEffect(() => {
    refresh();
    if (showPlayRow) isAndroidAppInstalled().then(setAppInstalled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const runServerTest = async () => {
    if (testing) return;
    setTesting(true);
    setTestMsg(null);
    try {
      const id = await requestServerPushTest(memberId, pushScope());
      const result = await new Promise<{ ok: number; fail: number; tokens: number } | null>(resolve => {
        const timer = setTimeout(() => { unsub(); resolve(null); }, TEST_TIMEOUT_MS);
        const unsub = onSnapshot(doc(db, 'push_tests', id), snap => {
          const d = snap.data();
          if (d?.done) {
            clearTimeout(timer); unsub();
            resolve({ ok: d.ok ?? 0, fail: d.fail ?? 0, tokens: d.tokens ?? 0 });
          }
        });
      });
      if (!result) setTestMsg({ ok: false, msg: '서버 응답이 없어요. 잠시 후 다시 시도해 주세요.' });
      else if (result.tokens === 0) setTestMsg({ ok: false, msg: '등록된 기기가 없어요. 위에서 알림을 먼저 켜 주세요.' });
      else if (result.ok === 0) setTestMsg({ ok: false, msg: `등록 기기 ${result.tokens}대 모두 발송 실패 — 알림을 껐다가 다시 켜 주세요.` });
      else setTestMsg({ ok: true, msg: `기기 ${result.tokens}대 중 ${result.ok}대로 발송했어요. 알림이 왔는지 확인해 주세요.` });
      refresh();
    } catch {
      setTestMsg({ ok: false, msg: '테스트 요청 중 오류가 발생했어요.' });
    } finally {
      setTesting(false);
    }
  };

  if (!state) return null;
  const devices = member ? pushDeviceCount(member as Member) : 0;

  return (
    <>
      {showPlayRow && (
        <div className="my-install-row">
          <div className="my-install-info">
            <span className="my-install-icon"><Icon name="phone" /></span>
            <div>
              <p className="my-install-title">{appInstalled ? '가계도 앱에서 열기' : 'Play 스토어 앱'}</p>
              <p className="my-install-desc">앱 알림으로 더 안정적으로 받을 수 있어요</p>
            </div>
          </div>
          <div className="my-install-actions">
            <button className="my-install-btn" onClick={() => openInAndroidApp()}>
              {appInstalled ? '열기' : '설치'}
            </button>
          </div>
        </div>
      )}

      <div className="my-push-status">
        <div className="my-push-status-rows">
          <span>이 기기: <b className={`my-push-state ${state}`}>{STATE_LABEL[state]}</b></span>
          <span>알림 받는 기기: <b>{devices}대</b></span>
          <span>마지막 수신: <b>{fmt(member?.push_last_ok_at)}</b></span>
        </div>
        <button className="my-push-test-btn" onClick={runServerTest} disabled={testing}>
          {testing ? '보내는 중...' : '서버 테스트 알림 받기'}
        </button>
        {testMsg && <p className={`my-pw-msg ${testMsg.ok ? 'ok' : 'err'}`}>{testMsg.msg}</p>}
      </div>
    </>
  );
}
