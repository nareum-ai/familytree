import './LandingPage.css';

interface Props {
  onRegister: () => void;
  onLogin: () => void;
}

/* ── 기능 카드 미리보기 ─────────────────────────────────────────────── */

function MockupTree() {
  // hex polygon points centered at (cx, cy) with radius r
  const hp = (cx: number, cy: number, r: number) =>
    `${cx},${cy-r} ${cx+r},${cy-r/2} ${cx+r},${cy+r/2} ${cx},${cy+r} ${cx-r},${cy+r/2} ${cx-r},${cy-r/2}`;

  // single hex node
  const Node = (
    cx: number, cy: number,
    grad: 'gm' | 'gf',
    avatar: string,
    name: string, age: number,
    id: number,
    isMe = false,
  ) => (
    <g key={id}>
      <defs>
        <clipPath id={`mc${id}`}><polygon points={hp(cx, cy, 10)} /></clipPath>
      </defs>
      <polygon points={hp(cx, cy, 13)} fill={`url(#${grad})`} />
      <image href={avatar} x={cx-10} y={cy-10} width={20} height={20} clipPath={`url(#mc${id})`} />
      {isMe && (
        <g>
          <circle cx={cx+10} cy={cy-10} r={6} fill="#F97316" />
          <text x={cx+10} y={cy-7} textAnchor="middle" fontSize="5" fontWeight="800" fill="white">나</text>
        </g>
      )}
      <text x={cx} y={cy+19} textAnchor="middle" fontSize="7" fontWeight="700" fill="#1A1A2E">{name}</text>
      <text x={cx} y={cy+27} textAnchor="middle" fontSize="6" fill="#94A3B8">({age}세)</text>
    </g>
  );

  const S = '#2AABE2'; // line stroke color

  return (
    <div className="feature-mockup mockup-tree">
      <svg viewBox="0 0 260 197" width="100%" height="100%">
        <defs>
          <linearGradient id="gm" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0EA5E9"/><stop offset="100%" stopColor="#0369A1"/>
          </linearGradient>
          <linearGradient id="gf" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#EC4899"/><stop offset="100%" stopColor="#DB2777"/>
          </linearGradient>
        </defs>

        {/* Gen1 → Gen2 */}
        <line x1="130" y1="31" x2="130" y2="50" stroke={S} strokeWidth="1.5"/>
        {/* Gen2 → Gen3 fan */}
        <line x1="130" y1="78" x2="130" y2="88" stroke={S} strokeWidth="1.5"/>
        <line x1="42"  y1="88" x2="204" y2="88" stroke={S} strokeWidth="1.5"/>
        <line x1="42"  y1="88" x2="42"  y2="97" stroke={S} strokeWidth="1.5"/>
        <line x1="96"  y1="88" x2="96"  y2="97" stroke={S} strokeWidth="1.5"/>
        <line x1="150" y1="88" x2="150" y2="97" stroke={S} strokeWidth="1.5"/>
        <line x1="204" y1="88" x2="204" y2="97" stroke={S} strokeWidth="1.5"/>
        {/* Gen3 큰아빠+큰엄마 → Gen4 */}
        <line x1="96"  y1="125" x2="96"  y2="135" stroke={S} strokeWidth="1.5"/>
        <line x1="77"  y1="135" x2="115" y2="135" stroke={S} strokeWidth="1.5"/>
        <line x1="77"  y1="135" x2="77"  y2="144" stroke={S} strokeWidth="1.5"/>
        <line x1="115" y1="135" x2="115" y2="144" stroke={S} strokeWidth="1.5"/>
        {/* Gen3 나+배우자 → Gen4 */}
        <line x1="204" y1="125" x2="204" y2="135" stroke={S} strokeWidth="1.5"/>
        <line x1="185" y1="135" x2="223" y2="135" stroke={S} strokeWidth="1.5"/>
        <line x1="185" y1="135" x2="185" y2="144" stroke={S} strokeWidth="1.5"/>
        <line x1="223" y1="135" x2="223" y2="144" stroke={S} strokeWidth="1.5"/>

        {/* Gen 1 */}
        {Node(117, 18, 'gm', '/avatars/m_elder.png',  '김대수', 75, 1)}
        {Node(143, 18, 'gf', '/avatars/f_elder.png',  '이복순', 83, 2)}
        {/* Gen 2 */}
        {Node(117, 65, 'gm', '/avatars/m_adult.png',  '김원석', 76, 3)}
        {Node(143, 65, 'gf', '/avatars/f_adult.png',  '박혜경', 74, 4)}
        {/* Gen 3 */}
        {Node( 42, 111, 'gf', '/avatars/f_young.png',  '김미란', 53, 5)}
        {Node( 82, 111, 'gm', '/avatars/m_adult.png',  '최준호', 52, 6)}
        {Node(110, 111, 'gf', '/avatars/f_adult.png',  '김지수', 48, 7)}
        {Node(150, 111, 'gm', '/avatars/m_young.png',  '김성진', 51, 8)}
        {Node(190, 111, 'gm', '/avatars/m_adult.png',  '김태호', 48, 9)}
        {Node(218, 111, 'gf', '/avatars/f_adult.png',  '박나영', 49, 10, true)}
        {/* Gen 4 */}
        {Node( 77, 157, 'gf', '/avatars/f_teen.png',   '최다은', 24, 11)}
        {Node(115, 157, 'gm', '/avatars/m_student.png', '최민서', 20, 12)}
        {Node(185, 157, 'gf', '/avatars/f_child.png',  '김하율', 17, 13)}
        {Node(223, 157, 'gm', '/avatars/m_child.png',  '김하준', 14, 14)}
      </svg>
    </div>
  );
}

function MockupAnniversary() {
  const rows = [
    { chip: '오늘', bg: '#10B981', color: 'white', name: '이순희', rel: '2촌 · 할머니', type: '생일', count: '만 74세' },
    { chip: 'D-12', bg: '#F97316', color: 'white', name: '김민준',  rel: '1촌 · 아버지', type: '생일', count: '만 52세' },
    { chip: 'D-23', bg: '#6366F1', color: 'white', name: '결혼기념일', rel: '아버지 · 어머니', type: '', count: '27주기' },
    { chip: 'D-45', bg: '#E2E8F0', color: '#64748B', name: '김수아', rel: '1촌 · 누나',   type: '생일', count: '만 29세' },
  ];
  return (
    <div className="feature-mockup mockup-ann">
      <div className="mockup-ann-header">🎂 다가오는 기념일</div>
      {rows.map((r, i) => (
        <div key={i} className={`mockup-ann-row${i < rows.length - 1 ? ' divided' : ''}`}>
          <span className="mockup-chip" style={{ background: r.bg, color: r.color }}>{r.chip}</span>
          <div className="mockup-ann-info">
            <span className="mockup-ann-name">{r.name}</span>
            <span className="mockup-ann-rel">{r.rel}</span>
          </div>
          <div className="mockup-ann-right">
            {r.type && <span className="mockup-ann-type">{r.type}</span>}
            <span className="mockup-ann-count">{r.count}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MockupInvite() {
  return (
    <div className="feature-mockup mockup-invite">
      <div className="mockup-invite-inner">
        {/* 인물 헤더 */}
        <div className="mockup-invite-person">
          <div className="mockup-invite-hex female">
            <img src="/avatars/f_adult.png" alt="" />
          </div>
          <div className="mockup-invite-person-info">
            <span className="mockup-invite-name">박혜경</span>
            <span className="mockup-invite-rel">1촌 · 어머니</span>
          </div>
        </div>
        {/* 링크 박스 */}
        <div className="mockup-invite-label">🔗 초대 링크 생성됨 <span className="mockup-invite-expiry">30일 유효</span></div>
        <div className="mockup-invite-link-row">
          <span className="mockup-invite-url">familytree.app/invite/a8f2…</span>
          <span className="mockup-invite-copy">복사</span>
        </div>
        {/* 공유 버튼 */}
        <div className="mockup-invite-share-row">
          <div className="mockup-invite-share-btn kakao">
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
              <path d="M9 1.5C4.86 1.5 1.5 4.08 1.5 7.26c0 2.04 1.35 3.84 3.39 4.86l-.87 3.24 3.78-2.49c.39.06.78.09 1.2.09 4.14 0 7.5-2.58 7.5-5.76S13.14 1.5 9 1.5z" fill="currentColor"/>
            </svg>
            카카오톡
          </div>
          <div className="mockup-invite-share-btn sms">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            문자
          </div>
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    icon: '🌳',
    title: '한눈에 보는 가계도',
    desc: '복잡한 가족 관계를 직관적인 트리로 시각화합니다. 몇 세대를 거슬러 올라가도 한 화면에서 확인할 수 있어요.',
    mockup: <MockupTree />,
  },
  {
    icon: '🎂',
    title: '기념일 자동 관리',
    desc: '생일과 결혼기념일을 자동으로 계산하고 알림을 받으세요. 음력도 지원합니다.',
    mockup: <MockupAnniversary />,
  },
  {
    icon: '🔐',
    title: '초대 링크로 바로 연결',
    desc: '가족에게 초대 링크를 보내면 가입 후 자동으로 가족 구성원과 연결됩니다.',
    mockup: <MockupInvite />,
  },
];

function TreeIllustration() {
  return (
    <svg className="landing-tree-svg" viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 연결선 */}
      {/* 1세대 → 가로선 */}
      <line x1="160" y1="36" x2="160" y2="62" stroke="rgba(255,255,255,0.35)" strokeWidth="2"/>
      {/* 가로선 2세대 */}
      <line x1="80" y1="62" x2="240" y2="62" stroke="rgba(255,255,255,0.35)" strokeWidth="2"/>
      {/* 2세대 세로선 */}
      <line x1="80"  y1="62"  x2="80"  y2="100" stroke="rgba(255,255,255,0.35)" strokeWidth="2"/>
      <line x1="240" y1="62"  x2="240" y2="100" stroke="rgba(255,255,255,0.35)" strokeWidth="2"/>
      {/* 2세대 부부 연결 */}
      <line x1="56"  y1="116" x2="104" y2="116" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeDasharray="4 3"/>
      <line x1="216" y1="116" x2="264" y2="116" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeDasharray="4 3"/>
      {/* 3세대 연결 */}
      <line x1="80"  y1="132" x2="80"  y2="158" stroke="rgba(255,255,255,0.30)" strokeWidth="2"/>
      <line x1="44"  y1="158" x2="116" y2="158" stroke="rgba(255,255,255,0.30)" strokeWidth="2"/>
      <line x1="44"  y1="158" x2="44"  y2="188" stroke="rgba(255,255,255,0.30)" strokeWidth="2"/>
      <line x1="116" y1="158" x2="116" y2="188" stroke="rgba(255,255,255,0.30)" strokeWidth="2"/>
      <line x1="240" y1="132" x2="240" y2="158" stroke="rgba(255,255,255,0.30)" strokeWidth="2"/>
      <line x1="196" y1="158" x2="276" y2="158" stroke="rgba(255,255,255,0.30)" strokeWidth="2"/>
      <line x1="196" y1="158" x2="196" y2="188" stroke="rgba(255,255,255,0.30)" strokeWidth="2"/>
      <line x1="276" y1="158" x2="276" y2="188" stroke="rgba(255,255,255,0.30)" strokeWidth="2"/>

      {/* 1세대 — 조부모 */}
      <circle cx="148" cy="22" r="18" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.55)" strokeWidth="2"/>
      <text x="148" y="27" textAnchor="middle" fontSize="16">👴</text>
      <circle cx="172" cy="22" r="18" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.55)" strokeWidth="2"/>
      <text x="172" y="27" textAnchor="middle" fontSize="16">👵</text>

      {/* 2세대 — 부모 좌 */}
      <circle cx="68"  cy="116" r="16" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/>
      <text x="68"  y="121" textAnchor="middle" fontSize="14">👨</text>
      <circle cx="92"  cy="116" r="16" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/>
      <text x="92"  y="121" textAnchor="middle" fontSize="14">👩</text>

      {/* 2세대 — 부모 우 */}
      <circle cx="228" cy="116" r="16" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/>
      <text x="228" y="121" textAnchor="middle" fontSize="14">👨</text>
      <circle cx="252" cy="116" r="16" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.5)" strokeWidth="2"/>
      <text x="252" y="121" textAnchor="middle" fontSize="14">👩</text>

      {/* 3세대 */}
      <circle cx="44"  cy="204" r="14" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"/>
      <text x="44"  y="209" textAnchor="middle" fontSize="12">👦</text>
      <circle cx="116" cy="204" r="14" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"/>
      <text x="116" y="209" textAnchor="middle" fontSize="12">👧</text>
      <circle cx="196" cy="204" r="14" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"/>
      <text x="196" y="209" textAnchor="middle" fontSize="12">👦</text>
      <circle cx="276" cy="204" r="14" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"/>
      <text x="276" y="209" textAnchor="middle" fontSize="12">👶</text>

      {/* 라벨 */}
      <text x="160" y="250" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.45)">우리 가족 가계도</text>
    </svg>
  );
}

export function LandingPage({ onRegister, onLogin }: Props) {
  return (
    <div className="landing">

      {/* ── 내비 ─────────────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="3.5" r="2.8" fill="white"/>
            <line x1="10" y1="6.3" x2="10" y2="9" stroke="rgba(255,255,255,0.8)" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="4.5" y1="9" x2="15.5" y2="9" stroke="rgba(255,255,255,0.8)" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="4.5" y1="9" x2="4.5" y2="12" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="15.5" y1="9" x2="15.5" y2="12" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="4.5" cy="14" r="2.2" fill="white" opacity="0.9"/>
            <circle cx="15.5" cy="14" r="2.2" fill="white" opacity="0.9"/>
          </svg>
          <span>우리 가족 가계도</span>
        </div>
        <button className="landing-nav-btn" onClick={onLogin}>로그인</button>
      </nav>

      {/* ── 히어로 ────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-hero-bg" />
        <div className="landing-hero-inner">
          <div className="landing-hero-text">
            <p className="landing-kicker">우리 가족만의 공간</p>
            <h1 className="landing-headline">
              가족이 가장<br />
              가까워지는 순간
            </h1>
            <p className="landing-sub">
              가계도, 기념일, 가족 정보를 한곳에서<br />
              함께 만들어가세요.
            </p>
            <div className="landing-hero-actions">
              <button className="landing-cta-primary" onClick={onRegister}>
                지금 시작하기
              </button>
            </div>
          </div>
          <div className="landing-hero-visual">
            <TreeIllustration />
          </div>
        </div>
        <div className="landing-hero-wave">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
            <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="#F4F5FA"/>
          </svg>
        </div>
      </section>

      {/* ── 기능 소개 ─────────────────────────────────────── */}
      <section className="landing-features">
        <div className="landing-features-inner">
          <h2 className="landing-section-title">가족을 더 가깝게</h2>
          <p className="landing-section-sub">우리 가족 가계도가 제공하는 기능들을 소개합니다</p>
          <div className="landing-features-grid">
            {features.map(f => (
              <div className="landing-feature-card" key={f.title}>
                {f.mockup}
                <div className="landing-feature-icon">{f.icon}</div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 최종 CTA ─────────────────────────────────────── */}
      <section className="landing-final">
        <div className="landing-final-inner">
          <div className="landing-final-emoji">👨‍👩‍👧‍👦</div>
          <h2 className="landing-final-title">우리 가족 이야기를<br />지금 시작하세요</h2>
          <p className="landing-final-sub">가입하고 초대 링크를 통해 가족과 연결되세요.</p>
          <button className="landing-final-btn" onClick={onRegister}>
            가족 가계도 시작하기 →
          </button>
        </div>
      </section>

    </div>
  );
}
