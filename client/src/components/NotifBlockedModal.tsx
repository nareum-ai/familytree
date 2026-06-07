import { useRef } from 'react';

interface Props {
  onClose: () => void;
  onInstall?: () => void;
}

export function NotifBlockedModal({ onClose, onInstall }: Props) {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

  // 모달이 뜨자마자 같은 탭의 잔여 클릭(고스트 클릭)이 배경에 떨어져
  // 바로 닫혀버리는 걸 막기 위해, 마운트 직후 잠깐은 배경 클릭을 무시한다
  const mountedAt = useRef(Date.now());
  const handleOverlayClick = () => {
    if (Date.now() - mountedAt.current < 350) return;
    onClose();
  };

  // 이미 앱으로 설치된 경우 → 시스템 설정 안내
  if (isStandalone) {
    const steps = [
      { num: '①', icon: '⚙️', text: '스마트폰 「설정」 앱을 열어요' },
      { num: '②', icon: '📱', text: '「앱」→「가족 가계도」를 찾아요' },
      { num: '③', icon: '🔔', text: '「알림」→「허용」으로 바꿔요' },
    ];
    return (
      <div className="nb-overlay" onClick={handleOverlayClick}>
        <div className="nb-modal" onClick={e => e.stopPropagation()}>
          <div className="nb-top-icon">🔕</div>
          <h3 className="nb-title">알림이 차단되어 있어요</h3>
          <p className="nb-desc">아래 순서대로 따라 하시면<br/>알림을 켤 수 있어요</p>
          <div className="nb-steps">
            {steps.map(s => (
              <div key={s.num} className="nb-step">
                <span className="nb-step-num">{s.num}</span>
                <span className="nb-step-icon">{s.icon}</span>
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
          <div className="nb-top-icon">📲</div>
          <h3 className="nb-title">바탕화면에 설치하면<br/>알림을 받을 수 있어요</h3>
          <div className="nb-steps">
            <div className="nb-step">
              <span className="nb-step-num">①</span>
              <span className="nb-step-icon">⬆️</span>
              <span className="nb-step-text">화면 아래 공유 버튼을 탭해요</span>
            </div>
            <div className="nb-step">
              <span className="nb-step-num">②</span>
              <span className="nb-step-icon">➕</span>
              <span className="nb-step-text">「홈 화면에 추가」를 탭해요</span>
            </div>
            <div className="nb-step">
              <span className="nb-step-num">③</span>
              <span className="nb-step-icon">🔔</span>
              <span className="nb-step-text">설치 후 앱에서 알림을 켜요</span>
            </div>
          </div>
          <button className="nb-btn" onClick={onClose}>확인</button>
        </div>
      </div>
    );
  }

  // Android 크롬·엣지 → PWA 설치 유도
  return (
    <div className="nb-overlay" onClick={handleOverlayClick}>
      <div className="nb-modal" onClick={e => e.stopPropagation()}>
        <div className="nb-top-icon">📲</div>
        <h3 className="nb-title">알림을 받으려면 바탕화면에 설치해야 해요</h3>
        <p className="nb-desc">설치 후 알림을 켜면 기념일을 미리 알려드려요</p>
        <div className="nb-install-actions">
          <button className="nb-btn" onClick={() => { onInstall?.(); onClose(); }}>지금 설치하기</button>
          <button className="nb-btn-later" onClick={onClose}>나중에</button>
        </div>
      </div>
    </div>
  );
}
