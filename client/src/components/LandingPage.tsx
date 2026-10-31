import './LandingPage.css';

interface Props {
  onRegister: () => void;
  onLogin: () => void;
}

/* ── 히어로 가계도 (실제 가계도와 같은 육각형 노드) ─────────────── */

type Gender = 'male' | 'female';
interface TreePerson { name: string; avatar: string; gender: Gender; rel: string; chusu?: number; me?: boolean }

const p = (name: string, avatar: string, gender: Gender, rel: string, chusu?: number, me = false): TreePerson =>
  ({ name, avatar: `/avatars/${avatar}.png`, gender, rel, chusu, me });

const GRANDPARENTS = [p('김대수', 'm_hanbok_elder', 'male', '할아버지', 2), p('이복순', 'f_hanbok_elder', 'female', '할머니', 2)];
const BRANCHES = [
  {
    couple: [p('박혜경', 'f_adult', 'female', '어머니', 1), p('김현석', 'm_adult', 'male', '아버지', 1)],
    kids:   [p('김민준', 'm_young', 'male', '나', undefined, true), p('김서연', 'f_college', 'female', '여동생', 2)],
  },
  {
    couple: [p('김태호', 'm_professor', 'male', '작은아버지', 3), p('최나영', 'f_cook', 'female', '작은어머니')],
    kids:   [p('김지후', 'm_student', 'male', '사촌동생', 4), p('김하은', 'f_child', 'female', '사촌동생', 4)],
  },
];

/** 육각형 아바타: 바깥 육각형이 성별 색 테두리 */
function Hex({ person, size = 'md' }: { person: TreePerson; size?: 'sm' | 'md' }) {
  return (
    <span className={`lp-hex ${size} ${person.me ? 'me' : person.gender}`}>
      <span className="lp-hex-inner"><img src={person.avatar} alt="" /></span>
    </span>
  );
}

function TreeNode({ person }: { person: TreePerson }) {
  return (
    <div className={`lt-node${person.me ? ' me' : ''}`}>
      {person.chusu && <span className={`lt-chusu ${person.gender}`}>{person.chusu}촌</span>}
      <Hex person={person} />
      <span className="lt-name">{person.name}</span>
      <span className="lt-rel">{person.rel}</span>
    </div>
  );
}

const UPCOMING = [
  { dday: 'D-11', tone: 'acc', title: '할머니 생신', detail: '음력 9월 22일' },
  { dday: 'D-22', tone: 'pri', title: '부모님 결혼기념일', detail: '32주년' },
];

function HeroTree() {
  return (
    <div className="lt-card" aria-label="가계도 예시: 3대 10명">
      <div className="lt-card-head">
        <span className="lt-card-title">김씨 가족</span>
        <span className="lt-card-meta">3대 10명</span>
      </div>
      <div className="lt-tree">
        <div className="lt-row">
          {GRANDPARENTS.map(gp => <TreeNode key={gp.name} person={gp} />)}
        </div>
        <div className="lt-stem" />
        <div className="lt-fork" />
        <div className="lt-branches">
          {BRANCHES.map(b => (
            <div className="lt-branch" key={b.couple[0].name}>
              <div className="lt-row">
                {b.couple.map(c => <TreeNode key={c.name} person={c} />)}
              </div>
              <div className="lt-stem" />
              <div className="lt-fork" />
              <div className="lt-kids">
                {b.kids.map(k => <TreeNode key={k.name} person={k} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <ul className="lt-upcoming">
        {UPCOMING.map(u => (
          <li key={u.title}>
            <span className={`lt-dday ${u.tone}`}>{u.dday}</span>
            <span className="lt-up-title">{u.title}</span>
            <span className="lt-up-detail">{u.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const steps = [
  { title: '나와 가까운 가족부터', body: '나와 부모님, 형제를 먼저 등록하면 가계도의 뼈대가 잡혀요.' },
  { title: '가족에게 초대 보내기', body: '각자 아는 가족을 직접 채우면 훨씬 빠르고 정확해져요.' },
  { title: '기념일은 알아서 챙겨요', body: '등록된 생일과 기일을 모아, 다가오는 날을 미리 알려 드려요.' },
];

const SIDES = [
  { label: '친가', tone: 'pri', who: '남편이 채워요', pair: [p('', 'm_elder', 'male', ''), p('', 'f_elder', 'female', '')] },
  { label: '처가', tone: 'acc', who: '아내가 채워요', pair: [p('', 'm_elder_2', 'male', ''), p('', 'f_elder_2', 'female', '')] },
];

function LogoMark() {
  return (
    <span className="landing-logo-mark">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="9" cy="3.5" r="2" /><circle cx="3.5" cy="14.5" r="2" /><circle cx="14.5" cy="14.5" r="2" />
        <path d="M9 5.5V9M3.5 12.5V9h11v3.5" />
      </svg>
    </span>
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
          <h1 className="landing-headline">가족이 가장<br />가까워지는 순간</h1>
          <p className="landing-sub">
            흩어진 가족 이야기를 한 그루의 나무로 모아 보세요.
            가계도와 기념일, 가족 연락처를 함께 기록합니다.
          </p>
          <button className="landing-cta-primary" onClick={onRegister}>가계도 시작하기</button>
          <p className="landing-cta-text">초대 링크를 받으셨나요? <button onClick={onLogin}>로그인</button></p>
        </div>
        <div className="landing-hero-visual">
          <HeroTree />
        </div>
      </section>

      {/* ── 사용 흐름 ─────────────────────────────────────── */}
      <section className="landing-steps">
        <h2 className="landing-section-title">세 걸음이면 우리 집<br />가계도가 완성돼요</h2>
        <ol className="landing-step-list">
          {steps.map((s, i) => (
            <li className="landing-step" key={s.title}>
              <span className="landing-step-num">{i + 1}</span>
              <div className="landing-step-text">
                <h3 className="landing-step-title">{s.title}</h3>
                <p className="landing-step-body">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 양가 가계도 ───────────────────────────────────── */}
      <section className="landing-band">
        <div className="landing-band-inner">
          <div>
            <h2 className="landing-section-title">부부가 함께 채우는<br />양가 가계도</h2>
            <p className="landing-section-desc">친가와 외가, 처가를 각자 채우면 하나의 가계도로 이어집니다.</p>
          </div>
          <div className="landing-sides">
            {SIDES.map(side => (
              <div className="landing-side" key={side.label}>
                <span className={`landing-side-label ${side.tone}`}>{side.label}</span>
                <div className="landing-side-pair">
                  {side.pair.map(person => <Hex key={person.avatar} person={person} size="sm" />)}
                </div>
                <span className="landing-side-who">{side.who}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 초대 ──────────────────────────────────────────── */}
      <section className="landing-invite">
        <div>
          <h2 className="landing-section-title">링크 하나로 가족 초대</h2>
          <p className="landing-section-desc">카카오톡이나 문자로 보내면, 받은 사람이 가입하는 순간 가계도에 연결돼요.</p>
        </div>
        <div className="landing-invite-card" aria-hidden="true">
          <div className="landing-invite-link">
            <span>familytree-3221b.web.app/invite/a8f2</span>
            <b>복사</b>
          </div>
          <div className="landing-invite-share">
            <span className="kakao">카카오톡</span>
            <span className="sms">문자</span>
          </div>
          <p className="landing-invite-note">30일 동안 쓸 수 있어요</p>
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
