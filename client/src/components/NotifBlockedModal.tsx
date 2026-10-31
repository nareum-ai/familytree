import { useEffect, useRef } from 'react';
import { isIOS as detectIOS, isStandalone as detectStandalone, openInAndroidApp, shouldOfferPlayApp } from '../lib/device';
import { getInstallPrompt, triggerInstall } from '../lib/installPrompt';
import { Icon, type IconName } from './Icon';

const GHOST_CLICK_GUARD_MS = 350;

interface Props {
  onClose: () => void;
}

export function NotifBlockedModal({ onClose }: Props) {
  const isStandalone = detectStandalone();
  const isIOS = detectIOS();

  // 모달이 뜨자마자 같은 탭의 잔여 클릭(고스트 클릭)이 배경에 떨어져
  // 바로 닫혀버리는 걸 막기 위해, 마운트 직후 잠깐은 배경 클릭을 무시한다
  const mountedAt = useRef(0);
  useEffect(() => { mountedAt.current = Date.now(); }, []);
  const handleOverlayClick = () => {
    if (Date.now() - mountedAt.current < GHOST_CLICK_GUARD_MS) return;
    onClose();
  };

  // 이미 앱으로 설치된 경우 → 시스템 설정 안내
  if (isStandalone) {
    const steps: Array<{ num: string; icon: IconName; text: string }> = [
      { num: '①', icon: 'gear', text: '스마트폰 「설정」 앱을 열어요' },
      { num: '②', icon: 'phone', text: '「앱」→「가족 가계도」를 찾아요' },
      { num: '③', icon: 'bell', text: '「알림」→「허용」으로 바꿔요' },
    ];
    return (
      <div className="nb-overlay" onClick={handleOverlayClick}>
        <div className="nb-modal" onClick={e => e.stopPropagation()}>
          <div className="nb-top-icon"><Icon name="bell-off" /></div>
          <h3 className="nb-title">알림이 차단되어 있어요</h3>
          <p className="nb-desc">아래 순서대로 따라 하시면<br/>알림을 켤 수 있어요</p>
          <div className="nb-steps">
            {steps.map(s => (
              <div key={s.num} className="nb-step">
                <span className="nb-step-num">{s.num}</span>
                <span className="nb-step-icon"><Icon name={s.icon} /></span>
                <span className="nb-step-text">{s.text}</span>
              </div>
            ))}
          </div>
          <button className="nb-btn" onClick={onClose}>확인</button>
        </div>
      </div>
    );
  }

  // iOS 브라우저 → 홈 화면 추가 안내
  if (isIOS) {
    return (
      <div className="nb-overlay" onClick={handleOverlayClick}>
        <div className="nb-modal" onClick={e => e.stopPropagation()}>
          <div className="nb-top-icon"><Icon name="install" /></div>
          <h3 className="nb-title">바탕화면에 설치하면<br/>알림을 받을 수 있어요</h3>
          <div className="nb-steps">
            <div className="nb-step">
              <span className="nb-step-num">①</span>
              <span className="nb-step-icon"><Icon name="upload" /></span>
              <span className="nb-step-text">화면 아래 공유 버튼을 탭해요</span>
            </div>
            <div className="nb-step">
              <span className="nb-step-num">②</span>
              <span className="nb-step-icon"><Icon name="plus" /></span>
              <span className="nb-step-text">「홈 화면에 추가」를 탭해요</span>
            </div>
            <div className="nb-step">
              <span className="nb-step-num">③</span>
              <span className="nb-step-icon"><Icon name="bell" /></span>
              <span className="nb-step-text">설치 후 앱에서 알림을 켜요</span>
            </div>
          </div>
          <button className="nb-btn" onClick={onClose}>확인</button>
        </div>
      </div>
    );
  }

  // Android·PC 브라우저 → 설치 없이도 브라우저에서 알림을 받을 수 있다. 사이트 알림 권한 안내
  //   + Play 스토어 출시 후: Play 앱 / 출시 전: 브라우저가 설치를 지원하면 홈 화면 설치(PWA)
  const offerPlay = shouldOfferPlayApp();
  const offerPwa = !offerPlay && !!getInstallPrompt();
  return (
    <div className="nb-overlay" onClick={handleOverlayClick}>
      <div className="nb-modal" onClick={e => e.stopPropagation()}>
        <div className="nb-top-icon"><Icon name="bell-off" /></div>
        <h3 className="nb-title">이 브라우저에서 알림이<br/>차단되어 있어요</h3>
        <div className="nb-steps">
          <div className="nb-step">
            <span className="nb-step-num">①</span>
            <span className="nb-step-icon"><Icon name="gear" /></span>
            <span className="nb-step-text">주소창 왼쪽 아이콘(사이트 정보)을 탭해요</span>
          </div>
          <div className="nb-step">
            <span className="nb-step-num">②</span>
            <span className="nb-step-icon"><Icon name="bell" /></span>
            <span className="nb-step-text">「권한」→「알림」을 「허용」으로 바꿔요</span>
          </div>
          <div className="nb-step">
            <span className="nb-step-num">③</span>
            <span className="nb-step-icon"><Icon name="phone" /></span>
            <span className="nb-step-text">페이지를 새로고침하고 알림을 켜요</span>
          </div>
        </div>
        {offerPlay ? (
          <>
            <p className="nb-desc">또는 Play 스토어 앱을 설치하면<br/>앱 알림으로 더 안정적으로 받을 수 있어요</p>
            <div className="nb-install-actions">
              <button className="nb-btn" onClick={() => { openInAndroidApp(); onClose(); }}>Play 스토어 앱으로 받기</button>
              <button className="nb-btn-later" onClick={onClose}>닫기</button>
            </div>
          </>
        ) : offerPwa ? (
          <>
            <p className="nb-desc">홈 화면에 설치해서 앱처럼 쓸 수도 있어요</p>
            <div className="nb-install-actions">
              <button className="nb-btn" onClick={() => { triggerInstall(); onClose(); }}>홈 화면에 설치</button>
              <button className="nb-btn-later" onClick={onClose}>닫기</button>
            </div>
          </>
        ) : (
          <button className="nb-btn" onClick={onClose}>확인</button>
        )}
      </div>
    </div>
  );
}
