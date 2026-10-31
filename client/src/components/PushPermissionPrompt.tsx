import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { LS } from '../lib/storageKeys';
import {
  canAddToHomeScreenIOS, isAndroidAppInstalled, isInAppBrowser, openInAndroidApp, shouldOfferPlayApp,
} from '../lib/device';
import {
  enablePushOnDevice, isDeviceRegistered, isPushSupported, notificationPermission, setPushEnabled,
} from '../lib/pushNotifications';
import './PushPermissionPrompt.css';

const SHOW_DELAY_MS = 2500;
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

type Variant = 'enable' | 'blocked' | 'ios-install' | 'android-open-app' | 'done';

interface Props {
  memberId: string;
  /** 알림이 차단된 경우 안내 모달 열기 */
  onBlocked: () => void;
  /** iOS 홈 화면 추가 안내 열기 */
  onIOSInstall: () => void;
}

function snoozed(): boolean {
  const until = Number(localStorage.getItem(LS.PUSH_PROMPT_SNOOZED_UNTIL) ?? 0);
  return Date.now() < until;
}

/**
 * 알림 켜기 안내 배너 — 권한 요청은 반드시 이 버튼 클릭(사용자 동작) 안에서 한다.
 *  · 푸시 지원 + 권한 미결정            → [알림 켜기]
 *  · 푸시 지원 + 알림 차단됨             → [켜는 방법] (설정에서 허용하는 안내)
 *  · iOS 브라우저(홈 화면 미추가)        → [홈 화면 추가 방법]
 *  · Android 브라우저 + Play 앱 설치됨   → [앱에서 열기] (앱 알림이 더 안정적)
 * "나중에"는 7일간 다시 띄우지 않는다. 이미 허용한 사용자에겐 띄우지 않는다.
 */
export function PushPermissionPrompt({ memberId, onBlocked, onIOSInstall }: Props) {
  const [variant, setVariant] = useState<Variant | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (snoozed() || isInAppBrowser()) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      let v: Variant | null = null;
      if (canAddToHomeScreenIOS()) {
        v = 'ios-install';
      } else if (shouldOfferPlayApp() && !isDeviceRegistered() && await isAndroidAppInstalled()) {
        v = 'android-open-app';
      } else if (await isPushSupported()) {
        const perm = notificationPermission();
        if (perm === 'default') v = 'enable';
        else if (perm === 'denied') v = 'blocked';
      }
      if (!cancelled) setVariant(v);
    }, SHOW_DELAY_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  if (!variant) return null;

  const later = () => {
    localStorage.setItem(LS.PUSH_PROMPT_SNOOZED_UNTIL, String(Date.now() + SNOOZE_MS));
    setVariant(null);
  };

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { granted } = await enablePushOnDevice(memberId);
      if (granted) {
        await setPushEnabled(memberId, true).catch(() => {});
        setVariant('done');
        setTimeout(() => setVariant(null), 2500);
      } else {
        setVariant(null);
        if (notificationPermission() === 'denied') onBlocked();
      }
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'done') {
    return (
      <div className="ppp-banner ppp-done" role="status">
        <span className="ppp-icon"><Icon name="bell" /></span>
        <p className="ppp-title">알림이 켜졌어요</p>
      </div>
    );
  }

  const content = {
    'enable': {
      icon: 'bell' as const,
      title: '가족 소식을 알림으로 받아보세요',
      desc: '생일·기일과 정보공개 요청을 놓치지 않게 알려드려요',
      action: busy ? '...' : '알림 켜기',
      onAction: enable,
    },
    'blocked': {
      icon: 'bell' as const,
      title: '알림이 꺼져 있어요',
      desc: '설정에서 허용하면 생일·기일 알림을 받을 수 있어요',
      action: '켜는 방법',
      onAction: () => { later(); onBlocked(); },
    },
    'ios-install': {
      icon: 'install' as const,
      title: '홈 화면에 추가하면 알림을 받을 수 있어요',
      desc: '아이폰은 홈 화면 앱에서만 알림이 와요',
      action: '방법 보기',
      onAction: () => { setVariant(null); onIOSInstall(); },
    },
    'android-open-app': {
      icon: 'phone' as const,
      title: '설치된 가계도 앱에서 열어보세요',
      desc: '앱에서 알림을 켜면 더 안정적으로 받을 수 있어요',
      action: '앱에서 열기',
      onAction: () => openInAndroidApp(),
    },
  }[variant];

  return (
    <div className="ppp-banner" role="dialog" aria-label="알림 설정 안내">
      <span className="ppp-icon"><Icon name={content.icon} /></span>
      <div className="ppp-text">
        <p className="ppp-title">{content.title}</p>
        <p className="ppp-desc">{content.desc}</p>
      </div>
      <div className="ppp-actions">
        <button className="ppp-btn" onClick={content.onAction} disabled={busy}>{content.action}</button>
        <button className="ppp-later" onClick={later}>나중에</button>
      </div>
    </div>
  );
}

interface ToastProps { title: string; body: string; onClose: () => void; }

/** 앱을 보고 있을 때 도착한 알림 — 화면 상단 토스트 */
export function ForegroundPushToast({ title, body, onClose }: ToastProps) {
  return (
    <div className="ppp-toast" role="status" onClick={onClose}>
      <span className="ppp-icon"><Icon name="bell" /></span>
      <div className="ppp-text">
        <p className="ppp-title">{title}</p>
        {body && <p className="ppp-desc">{body}</p>}
      </div>
    </div>
  );
}
