export type AppView = 'my' | 'search' | 'anniversary' | 'invite' | 'ai' | 'help';

const NAV_ITEMS: Array<{ view: AppView; icon: string; label: string; title: string }> = [
  { view: 'my',          icon: '👤', label: 'My',     title: 'My 메뉴' },
  { view: 'search',      icon: '🔍', label: '검색',   title: '검색' },
  { view: 'anniversary', icon: '📅', label: '기념일', title: '기념일' },
  { view: 'invite',      icon: '💌', label: '초대',   title: '가족 초대' },
  { view: 'ai',          icon: '🤖', label: 'AI',     title: 'AI' },
  { view: 'help',        icon: '❓', label: '도움말', title: '사용 안내' },
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
          <button className="header-ann-btn" title="관리자로 돌아가기" onClick={onReturnToAdmin}>🛡️</button>
        )}
        <div className="header-nav-buttons">
          {NAV_ITEMS.map(item => (
            <button
              key={item.view}
              className={`header-ann-btn ${item.view === 'my' ? 'header-my-btn' : ''}`}
              onClick={() => onOpen(item.view)}
              title={item.title}
            >
              {item.icon}{item.view === 'my' && badge}
            </button>
          ))}
        </div>
        <span className="header-username">{displayName}</span>
        {onShowIOSInstall && (
          <button className="header-install-btn" onClick={onShowIOSInstall}>📲 설치</button>
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
            {item.icon}
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
