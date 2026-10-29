import './LandingPage.css';

interface Props {
  onRegister: () => void;
  onLogin: () => void;
}

/* ── 히어로 가계도 (아바타 육각형) ─────────────────────────────────── */

type Gender = 'male' | 'female';
interface TreePerson { name: string; avatar: string; gender: Gender; me?: boolean }

const p = (name: string, avatar: string, gender: Gender, me = false): TreePerson =>
  ({ name, avatar: `/avatars/${avatar}.png`, gender, me });

const GRANDPARENTS = [p('김대수', 'm_hanbok_elder', 'male'), p('이복순', 'f_hanbok_elder', 'female')];
const BRANCHES = [
  {
    couple: [p('김현석', 'm_adult', 'male'), p('박혜경', 'f_adult', 'female')],
    kids:   [p('김민준', 'm_young', 'male', true), p('김서연', 'f_college', 'female')],
  },
  {
    couple: [p('김태호', 'm_professor', 'male'), p('최나영', 'f_cook', 'female')],
    kids:   [p('김지후', 'm_student', 'male'), p('김하은', 'f_child', 'female')],
  },
];

function HexAvatar({ person, size }: { person: TreePerson; size: 'lg' | 'md' | 'sm' }) {
  return (
    <div className={`lt-node lt-${size}`}>
      <div className={`lt-hex ${person.me ? 'me' : person.gender}`}>
        <div className="lt-hex-inner"><img src={person.avatar} alt="" /></div>
      </div>
      {person.me && <span className="lt-me">나</span>}
      <span className="lt-name">{person.name}</span>
    </div>
  );
}

function HeroTree() {
  return (
    <div className="lt-card" aria-label="가계도 예시: 3대 10명">
      <div className="lt-card-head">
        <span className="lt-card-title">김씨 가족</span>
        <span className="lt-card-meta">3대 · 10명</span>
      </div>
      <div className="lt-tree">
        <div className="lt-row">
          {GRANDPARENTS.map(gp => <HexAvatar key={gp.name} person={gp} size="lg" />)}
        </div>
        <div className="lt-stem" />
        <div className="lt-fork" />
        <div className="lt-branches">
          {BRANCHES.map(b => (
            <div className="lt-branch" key={b.couple[0].name}>
              <div className="lt-row">
                {b.couple.map(c => <HexAvatar key={c.name} person={c} size="md" />)}
              </div>
              <div className="lt-stem" />
              <div className="lt-fork" />
              <div className="lt-kids">
                {b.kids.map(k => <HexAvatar key={k.name} person={k} size="sm" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 기능 카드 미리보기 ─────────────────────────────────────────────── */

function MockupAnniversary() {
  const rows = [
    { chip: '오늘', cls: 'today', name: '이복순',     rel: '2촌 · 할머니',    type: '생신', count: '음력' },
    { chip: 'D-12', cls: 'soon',  name: '김민준',     rel: '나',             type: '생일', count: '만 29세' },
    { chip: 'D-23', cls: 'later', name: '결혼기념일', rel: '아버지 · 어머니', type: '',     count: '32주년' },
  ];
  return (
    <div className="feature-mockup mockup-ann">
      <div className="mockup-ann-header">다가오는 기념일</div>
      {rows.map((r, i) => (
        <div key={i} className={`mockup-ann-row${i < rows.length - 1 ? ' divided' : ''}`}>
          <span className={`mockup-chip ${r.cls}`}>{r.chip}</span>
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

function MockupCollab() {
  const side = (label: string, cls: string, pa: TreePerson, ma: TreePerson) => (
    <div className={`mc-side ${cls}`}>
      <span className="mc-label">{label}</span>
      <div className="mc-pair">
        <HexAvatar person={pa} size="sm" />
        <HexAvatar person={ma} size="sm" />
      </div>
    </div>
  );
  return (
    <div className="feature-mockup mockup-collab">
      <div className="mc-top">
        {side('친가', 'paternal', p('아버지', 'm_elder', 'male'), p('어머니', 'f_elder', 'female'))}
        {side('처가', 'maternal', p('장인', 'm_elder_2', 'male'), p('장모', 'f_elder_2', 'female'))}
      </div>
      <div className="mc-couple">
        <HexAvatar person={p('나', 'm_young', 'male', true)} size="sm" />
        <span className="mc-link" />
        <HexAvatar person={p('배우자', 'f_young', 'female')} size="sm" />
      </div>
    </div>
  );
}

function MockupInvite() {
  return (
    <div className="feature-mockup mockup-invite">
      <div className="mockup-invite-inner">
        <div className="mockup-invite-person">
          <div className="mockup-invite-hex female">
            <img src="/avatars/f_adult.png" alt="" />
          </div>
          <div className="mockup-invite-person-info">
            <span className="mockup-invite-name">박혜경</span>
            <span className="mockup-invite-rel">1촌 · 어머니</span>
          </div>
        </div>
        <div className="mockup-invite-label">초대 링크 생성됨 <span className="mockup-invite-expiry">30일 유효</span></div>
        <div className="mockup-invite-link-row">
          <span className="mockup-invite-url">familytree.app/invite/a8f2…</span>
          <span className="mockup-invite-copy">복사</span>
        </div>
        <div className="mockup-invite-share-row">
          <div className="mockup-invite-share-btn kakao">
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M9 1.5C4.86 1.5 1.5 4.08 1.5 7.26c0 2.04 1.35 3.84 3.39 4.86l-.87 3.24 3.78-2.49c.39.06.78.09 1.2.09 4.14 0 7.5-2.58 7.5-5.76S13.14 1.5 9 1.5z" fill="currentColor"/>
            </svg>
            카카오톡
          </div>
          <div className="mockup-invite-share-btn sms">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            문자
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 아이콘 (선 아이콘) ───────────────────────────────────────────── */

const Icon = {
  people: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c2.8 0 5 2.2 5 5"/></svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>
  ),
};

const features = [
  {
    icon: Icon.people,
    title: '부부가 함께 채우는 양가 가계도',
    desc: '친가·외가·처가를 각자 채우면 하나의 가계도로 이어집니다.',
    mockup: <MockupCollab />,
  },
  {
    icon: Icon.calendar,
    title: '음력까지 챙기는 기념일',
    desc: '생일과 결혼기념일을 자동으로 계산해 미리 알려드려요.',
    mockup: <MockupAnniversary />,
  },
  {
    icon: Icon.link,
    title: '링크 하나로 가족 초대',
    desc: '카카오톡이나 문자로 보내면 가입과 동시에 가계도에 연결돼요.',
    mockup: <MockupInvite />,
  },
];

const steps = [
  { num: '01', title: '나를 중심으로 시작', body: '나와 부모님, 형제부터 등록하면 가계도의 뼈대가 잡혀요.' },
  { num: '02', title: '가족에게 초대 보내기', body: '각자 아는 가족을 직접 채우면 훨씬 빠르고 정확해져요.' },
  { num: '03', title: '기념일은 자동으로', body: '등록된 생일과 기념일을 모아 다가오는 날을 알려드려요.' },
];

function LogoMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/>
      <path d="M12 7.5v4M5 16.5V14h14v2.5M12 11.5v2.5"/>
    </svg>
  );
}

export function LandingPage({ onRegister, onLogin }: Props) {
  return (
    <div className="landing">

      {/* ── 내비 ─────────────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <LogoMark />
          <span>우리 가족 가계도</span>
        </div>
        <button className="landing-nav-btn" onClick={onLogin}>로그인</button>
      </nav>

      {/* ── 히어로 ────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-hero-text">
          <p className="landing-kicker">우리 가족만의 공간</p>
          <h1 className="landing-headline">가족이 가장<br />가까워지는 순간</h1>
          <p className="landing-sub">
            흩어진 가족 이야기를 한 그루의 나무로 모아보세요.
            가계도와 기념일, 가족 정보를 함께 기록합니다.
          </p>
          <div className="landing-hero-actions">
            <button className="landing-cta-primary" onClick={onRegister}>가계도 시작하기</button>
            <button className="landing-cta-text" onClick={onLogin}>초대받으셨나요? 로그인 →</button>
          </div>
        </div>
        <div className="landing-hero-visual">
          <HeroTree />
          <div className="landing-float-ann" aria-hidden="true">
            <span className="lfa-title">다가오는 기념일</span>
            <div className="lfa-row"><span>민준 생일</span><b>D-12</b></div>
            <div className="lfa-row"><span>부모님 결혼기념일</span><b>D-23</b></div>
          </div>
        </div>
      </section>

      {/* ── 사용 흐름 ─────────────────────────────────────── */}
      <section className="landing-steps">
        <p className="landing-kicker">이렇게 시작해요</p>
        <h2 className="landing-section-title">세 걸음이면 우리 집 가계도가 완성돼요</h2>
        <div className="landing-steps-grid">
          {steps.map(s => (
            <div className="landing-step" key={s.num}>
              <span className="landing-step-num">{s.num}</span>
              <strong className="landing-step-title">{s.title}</strong>
              <p className="landing-step-body">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 기능 소개 ─────────────────────────────────────── */}
      <section className="landing-features">
        <div className="landing-features-grid">
          {features.map(f => (
            <div className="landing-feature-card" key={f.title}>
              {f.mockup}
              <div className="landing-feature-body">
                <span className="landing-feature-icon">{f.icon}</span>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 최종 CTA ─────────────────────────────────────── */}
      <section className="landing-final">
        <div className="landing-final-inner">
          <h2 className="landing-final-title">할머니의 이야기가<br />손주에게 닿도록.</h2>
          <button className="landing-final-btn" onClick={onRegister}>무료로 가계도 만들기</button>
        </div>
      </section>

    </div>
  );
}
