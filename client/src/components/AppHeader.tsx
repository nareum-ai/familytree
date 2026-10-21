export type AppView = 'my' | 'search' | 'anniversary' | 'invite' | 'ai' | 'help';

/** 선 아이콘 (24px 격자, currentColor) */
function NavIcon({ d }: { d: React.ReactNode }) {
  return (
    <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
  );
}

const ICONS = {
  my:          <NavIcon d={<><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>} />,
  search:      <NavIcon d={<><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>} />,
  anniversary: <NavIcon d={<><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>} />,
  invite:      <NavIcon d={<><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/></>} />,
  ai:          <NavIcon d={<><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></>} />,
  help:        <NavIcon d={<><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17.2v.1"/></>} />,
};

const SHIELD_ICON = <NavIcon d={<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/>} />;

const NAV_ITEMS: Array<{ view: AppView; label: string; title: string }> = [
  { view: 'my',          label: 'My',     title: 'My 메뉴' },
  { view: 'search',      label: '검색',   title: '검색' },
  { view: 'anniversary', label: '기념일', title: '기념일' },
  { view: 'invite',      label: '초대',   title: '가족 초대' },
  { view: 'ai',          label: 'AI',     title: 'AI' },
  { view: 'help',        label: '도움말', title: '사용 안내' },
];

interface Props {
  displayName: string | null;
  pendingRequestCount: number;
  onOpen: (view: AppView) => void;
  onLogout: () => void;
  /** 관리자 대리 접속 중이면 관리자 복귀 버튼 표시 */
  onReturnToAdmin?: () => void;
  /** iOS Safari면 홈 화면 추가 안내 버튼 표시 */
  onShowIOSInstall?: () => void;
}

function LogoSymbol() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      {/* 루트 */}
      <circle cx="10" cy="3.5" r="2.8" fill="white"/>
      {/* 루트→가로선 */}
      <line x1="10" y1="6.3" x2="10" y2="9" stroke="rgba(255,255,255,0.8)" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="4.5" y1="9" x2="15.5" y2="9" stroke="rgba(255,255,255,0.8)" strokeWidth="1.4" strokeLinecap="round"/>
      {/* 2세대 */}
      <line x1="4.5" y1="9" x2="4.5" y2="12" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="15.5" y1="9" x2="15.5" y2="12" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="4.5" cy="14" r="2.2" fill="white" opacity="0.9"/>
      <circle cx="15.5" cy="14" r="2.2" fill="white" opacity="0.9"/>
      {/* 3세대 */}
      <line x1="4.5" y1="16.2" x2="4.5" y2="17.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round"/>
      <line x1="2" y1="17.5" x2="7" y2="17.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round"/>
      <line x1="15.5" y1="16.2" x2="15.5" y2="17.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round"/>
      <line x1="13" y1="17.5" x2="18" y2="17.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round"/>
      <circle cx="2" cy="19" r="1.4" fill="white" opacity="0.75"/>
      <circle cx="7" cy="19" r="1.4" fill="white" opacity="0.75"/>
      <circle cx="13" cy="19" r="1.4" fill="white" opacity="0.75"/>
      <circle cx="18" cy="19" r="1.4" fill="white" opacity="0.75"/>
    </svg>
  );
}

/** 상단 헤더(데스크톱) */
export function AppHeader({ displayName, pendingRequestCount, onOpen, onLogout, onReturnToAdmin, onShowIOSInstall }: Props) {
  const badge = pendingRequestCount > 0 && <span className="header-notify-dot">{pendingRequestCount}</span>;
  return (
    <header className="app-header">
      <div className="header-logo">
        <div className="logo-symbol"><LogoSymbol /></div>
        <span className="logo-text">우리 가족 가계도</span>
      </div>
      <div className="header-user">
        {onReturnToAdmin && (
          <button className="header-ann-btn" title="관리자로 돌아가기" aria-label="관리자로 돌아가기" onClick={onReturnToAdmin}>{SHIELD_ICON}</button>
        )}
        <div className="header-nav-buttons">
          {NAV_ITEMS.map(item => (
            <button
              key={item.view}
              className={`header-ann-btn ${item.view === 'my' ? 'header-my-btn' : ''}`}
              onClick={() => onOpen(item.view)}
              title={item.title}
            >
              {ICONS[item.view]}
              <span className="header-nav-label">{item.label}</span>
              {item.view === 'my' && badge}
            </button>
          ))}
        </div>
        <span className="header-username">{displayName}</span>
        {onShowIOSInstall && (
          <button className="header-install-btn" onClick={onShowIOSInstall}>앱 설치</button>
        )}
        <button className="header-logout" onClick={onLogout}>로그아웃</button>
      </div>
    </header>
  );
}

/** 하단 탭 바(모바일) */
export function MobileBottomNav({ pendingRequestCount, onOpen }: Pick<Props, 'pendingRequestCount' | 'onOpen'>) {
  return (
    <nav className="mobile-bottom-nav">
      {NAV_ITEMS.map(item => (
        <button key={item.view} className="mobile-nav-btn" onClick={() => onOpen(item.view)}>
          <span className="mobile-nav-icon">
            {ICONS[item.view]}
            {item.view === 'my' && pendingRequestCount > 0 && (
              <span className="mobile-notify-dot">{pendingRequestCount}</span>
            )}
          </span>
          <span className="mobile-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
