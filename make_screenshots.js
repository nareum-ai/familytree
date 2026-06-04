const puppeteer = require('puppeteer');
const fs = require('fs');

const W = 540, H = 960, SCALE = 2; // → 1080x1920

// ── 공통 CSS ─────────────────────────────────────────────────────────────
const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; background: #f0f4f8; }

  .app { display: flex; flex-direction: column; width: ${W}px; height: ${H}px; }

  /* 상단 헤더 */
  .header {
    background: linear-gradient(135deg, #4F46E5, #2AABE2);
    padding: 44px 20px 14px;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
  }
  .header-title { font-size: 20px; font-weight: 700; color: white; }
  .header-sub { font-size: 12px; color: rgba(255,255,255,0.75); margin-top: 2px; }
  .header-icon {
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
  }

  /* 하단 내비 */
  .bottom-nav {
    background: white;
    border-top: 1px solid #e2e8f0;
    display: flex;
    flex-shrink: 0;
    padding-bottom: 16px;
  }
  .nav-item {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 10px 0 4px; gap: 3px;
    font-size: 11px; color: #aaa;
  }
  .nav-item.active { color: #4F46E5; }
  .nav-item svg { width: 22px; height: 22px; }
  .nav-item span { font-size: 10px; font-weight: 600; }

  /* 스크롤 영역 */
  .content { flex: 1; overflow: hidden; }
`;

// ── 하단 내비 SVG 아이콘들 ─────────────────────────────────────────────
function navBar(active) {
  const items = [
    { key:'tree',  label:'가계도',  icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/><line x1="6" y1="11" x2="18" y2="11"/><line x1="6" y1="11" x2="6" y2="14"/><line x1="18" y1="11" x2="18" y2="14"/><circle cx="6" cy="16" r="2"/><circle cx="18" cy="16" r="2"/></svg>` },
    { key:'search',label:'검색',    icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>` },
    { key:'ann',   label:'기념일',  icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>` },
    { key:'help',  label:'도움말',  icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17" stroke-linecap="round" stroke-width="3"/></svg>` },
  ];
  return `<nav class="bottom-nav">${items.map(it=>`
    <div class="nav-item ${it.key===active?'active':''}">
      ${it.icon}
      <span>${it.label}</span>
    </div>`).join('')}</nav>`;
}

// ══════════════════════════════════════════════════════════════════════════
// 스크린샷 1: 가계도
// ══════════════════════════════════════════════════════════════════════════
function makeTreeHTML() {
  const hp = (cx,cy,r) => {
    const pts=[];
    for(let i=0;i<6;i++){const a=Math.PI/3*i-Math.PI/2; pts.push(`${cx+r*Math.cos(a)},${cy+r*Math.sin(a)}`);}
    return pts.join(' ');
  };

  const gradM = `<linearGradient id="gm" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0EA5E9"/><stop offset="100%" stop-color="#0369A1"/></linearGradient>`;
  const gradF = `<linearGradient id="gf" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#EC4899"/><stop offset="100%" stop-color="#DB2777"/></linearGradient>`;
  const gradD = `<linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#6B7280"/><stop offset="100%" stop-color="#4B5563"/></linearGradient>`;

  const S = '#2AABE2';
  const R = 34; // hex radius

  function node(cx,cy,g,name,age,me=false,deceased=false) {
    const gid = deceased?'gd':g==='m'?'gm':'gf';
    return `
      <polygon points="${hp(cx,cy,R)}" fill="url(#${gid})" ${deceased?'opacity="0.6"':''}/>
      <text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="22" font-weight="800" fill="white">${name[0]}</text>
      ${me?`<circle cx="${cx+R-6}" cy="${cy-R+6}" r="11" fill="#F97316"/>
             <text x="${cx+R-6}" y="${cy-R+10}" text-anchor="middle" font-size="9" font-weight="900" fill="white">나</text>`:''}
      <text x="${cx}" y="${cy+R+16}" text-anchor="middle" font-size="13" font-weight="700" fill="#1a2e3b">${name}</text>
      <text x="${cx}" y="${cy+R+32}" text-anchor="middle" font-size="11" fill="#94A3B8">${age}</text>`;
  }

  function couple(x1,y1,x2,y2) {
    const mx=(x1+x2)/2, my=(y1+y2)/2;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${S}" stroke-width="2" stroke-dasharray="5 3" opacity="0.5"/>
            <circle cx="${mx}" cy="${my}" r="7" fill="white" stroke="${S}" stroke-width="1.5"/>
            <text x="${mx}" y="${my+4}" text-anchor="middle" font-size="9" fill="${S}">💑</text>`;
  }

  // 레이아웃 좌표
  const g1 = [{cx:210,cy:130,g:'m',name:'김대수',age:'(75세)'},{cx:305,cy:130,g:'f',name:'이복순',age:'(73세)'}];
  const g2 = [{cx:155,cy:265,g:'m',name:'김원석',age:'(55세)'},{cx:250,cy:265,g:'f',name:'박혜경',age:'(52세)'}];
  const g2r = [{cx:350,cy:265,g:'m',name:'김성진',age:'(51세)',me:true},{cx:445,cy:265,g:'f',name:'박나영',age:'(49세)'}];
  const g3l = [{cx:105,cy:405,g:'m',name:'김진우',age:'(28세)'},{cx:205,cy:405,g:'f',name:'김지아',age:'(25세)'}];
  const g3r = [{cx:350,cy:405,g:'f',name:'김하율',age:'(17세)'},{cx:450,cy:405,g:'m',name:'김하준',age:'(14세)'}];

  const lines = `
    <!-- Gen1 → 가로 → Gen2 -->
    <line x1="257" y1="${130+R}" x2="257" y2="200" stroke="${S}" stroke-width="2"/>
    <line x1="155" y1="200" x2="400" y2="200" stroke="${S}" stroke-width="2"/>
    <line x1="155" y1="200" x2="155" y2="${265-R}" stroke="${S}" stroke-width="2"/>
    <line x1="400" y1="200" x2="400" y2="${265-R}" stroke="${S}" stroke-width="2"/>
    <!-- Gen2 left → Gen3 -->
    <line x1="200" y1="${265+R}" x2="200" y2="340" stroke="${S}" stroke-width="2"/>
    <line x1="105" y1="340" x2="210" y2="340" stroke="${S}" stroke-width="2"/>
    <line x1="105" y1="340" x2="105" y2="${405-R}" stroke="${S}" stroke-width="2"/>
    <line x1="210" y1="340" x2="210" y2="${405-R}" stroke="${S}" stroke-width="2"/>
    <!-- Gen2 right → Gen3 -->
    <line x1="397" y1="${265+R}" x2="397" y2="340" stroke="${S}" stroke-width="2"/>
    <line x1="350" y1="340" x2="450" y2="340" stroke="${S}" stroke-width="2"/>
    <line x1="350" y1="340" x2="350" y2="${405-R}" stroke="${S}" stroke-width="2"/>
    <line x1="450" y1="340" x2="450" y2="${405-R}" stroke="${S}" stroke-width="2"/>
  `;

  const couples = `
    ${couple(g1[0].cx+R,g1[0].cy, g1[1].cx-R,g1[1].cy)}
    ${couple(g2[0].cx+R,g2[0].cy, g2[1].cx-R,g2[1].cy)}
    ${couple(g2r[0].cx+R,g2r[0].cy, g2r[1].cx-R,g2r[1].cy)}
  `;

  const nodes = [
    ...g1.map(n=>node(n.cx,n.cy,n.g,n.name,n.age)),
    ...g2.map(n=>node(n.cx,n.cy,n.g,n.name,n.age)),
    ...g2r.map((n,i)=>node(n.cx,n.cy,n.g,n.name,n.age,i===0)),
    ...g3l.map(n=>node(n.cx,n.cy,n.g,n.name,n.age)),
    ...g3r.map(n=>node(n.cx,n.cy,n.g,n.name,n.age)),
  ].join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    ${BASE_CSS}
    .tree-bg { width:100%; height:100%; background: #EEF2FF; position:relative; overflow:hidden; }
    .tree-toolbar {
      position:absolute; top:12px; right:12px;
      display:flex; gap:8px;
    }
    .tree-btn {
      background:white; border:1px solid #e0e0e0; border-radius:8px;
      padding:6px 12px; font-size:11px; font-weight:600; color:#4F46E5;
      box-shadow:0 1px 4px rgba(0,0,0,0.08);
    }
    .tree-legend {
      position:absolute; bottom:12px; left:12px;
      display:flex; gap:8px;
    }
    .legend-chip {
      background:white; border-radius:20px; padding:4px 10px;
      font-size:10px; font-weight:600; color:#4a5568;
      box-shadow:0 1px 4px rgba(0,0,0,0.08);
      display:flex; align-items:center; gap:4px;
    }
    .legend-dot { width:8px; height:8px; border-radius:50%; }
  </style>
  </head><body>
  <div class="app">
    <div class="header">
      <div>
        <div class="header-title">우리 가족 가계도</div>
        <div class="header-sub">김대수 · 이복순 가계</div>
      </div>
      <div class="header-icon">👤</div>
    </div>
    <div class="content">
      <div class="tree-bg">
        <div class="tree-toolbar">
          <div class="tree-btn">+ 가족 추가</div>
          <div class="tree-btn">🔍</div>
        </div>
        <svg width="540" height="740" viewBox="0 0 540 540">
          <defs>${gradM}${gradF}${gradD}</defs>
          ${lines}
          ${couples}
          ${nodes}
        </svg>
        <div class="tree-legend">
          <div class="legend-chip"><div class="legend-dot" style="background:#0EA5E9"></div>남성</div>
          <div class="legend-chip"><div class="legend-dot" style="background:#EC4899"></div>여성</div>
          <div class="legend-chip"><div class="legend-dot" style="background:#F97316"></div>나</div>
        </div>
      </div>
    </div>
    ${navBar('tree')}
  </div>
  </body></html>`;
}

// ══════════════════════════════════════════════════════════════════════════
// 스크린샷 2: 기념일
// ══════════════════════════════════════════════════════════════════════════
function makeAnnHTML() {
  const items = [
    { chip:'오늘', chipBg:'#10B981', chipColor:'white', hex:'gm', initial:'김', name:'김민준', rel:'1촌 · 아버지', type:'생일', meta:'만 55세 생일', metatype:'birthday' },
    { chip:'D-3',  chipBg:'#F97316', chipColor:'white', hex:'gf', initial:'박', name:'박혜경', rel:'1촌 · 어머니', type:'생일', meta:'만 52세 생일', metatype:'birthday' },
    { chip:'D-12', chipBg:'#4F46E5', chipColor:'white', hex:'💍', initial:'💍', name:'결혼기념일', rel:'아버지 · 어머니', type:'기념일', meta:'28주기', metatype:'wedding' },
    { chip:'D-28', chipBg:'#E2E8F0', chipColor:'#64748B', hex:'gf', initial:'이', name:'이순희', rel:'2촌 · 할머니', type:'생일', meta:'만 73세 생일', metatype:'birthday' },
    { chip:'D-41', chipBg:'#E2E8F0', chipColor:'#64748B', hex:'gm', initial:'김', name:'김진우', rel:'2촌 · 조카', type:'생일', meta:'만 28세 생일', metatype:'birthday' },
  ];

  const cards = items.map((it,i) => {
    const hexBg = it.hex==='gm'
      ? 'linear-gradient(135deg,#0EA5E9,#0369A1)'
      : it.hex==='gf'
      ? 'linear-gradient(135deg,#EC4899,#DB2777)'
      : 'linear-gradient(135deg,#F59E0B,#D97706)';
    const isFirst = i===0;
    return `
    <div style="background:white; border-radius:16px; padding:16px; display:flex; align-items:center; gap:14px;
                box-shadow:${isFirst?'0 4px 20px rgba(16,185,129,0.15)':'0 2px 8px rgba(0,0,0,0.06)'};
                border:${isFirst?'1.5px solid #10B981':'1.5px solid #f0f0f0'};">
      <div style="width:44px;height:50px;clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
                  background:${hexBg};flex-shrink:0;display:flex;align-items:center;justify-content:center;
                  font-size:18px;font-weight:800;color:white;">
        ${it.hex==='💍'?'💍':it.initial}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:16px;font-weight:700;color:#1a2e3b;">${it.name}</div>
        <div style="font-size:12px;color:#94A3B8;margin-top:2px;">${it.rel}</div>
        <div style="font-size:11px;color:#64748B;margin-top:3px;">${it.meta}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
        <div style="background:${it.chipBg};color:${it.chipColor};
                    padding:4px 12px;border-radius:20px;font-size:13px;font-weight:700;">
          ${it.chip}
        </div>
        <div style="font-size:10px;color:#94A3B8;background:#f8f9fa;padding:2px 8px;border-radius:10px;">${it.type}</div>
      </div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    ${BASE_CSS}
    .ann-section-title {
      font-size:13px; font-weight:700; color:#4F46E5;
      display:flex; align-items:center; gap:6px;
      padding:14px 16px 8px;
      text-transform:uppercase; letter-spacing:0.5px;
    }
    .notify-banner {
      margin:12px 16px 0;
      background:linear-gradient(135deg,#EEF2FF,#E0E7FF);
      border:1.5px solid #C7D2FE; border-radius:14px;
      padding:14px 16px;
      display:flex; align-items:center; gap:12px;
    }
    .notify-icon { font-size:24px; flex-shrink:0; }
    .notify-text { font-size:12px; color:#4F46E5; font-weight:600; line-height:1.5; }
  </style>
  </head><body>
  <div class="app">
    <div class="header">
      <div>
        <div class="header-title">🎂 다가오는 기념일</div>
        <div class="header-sub">이번 달 · 다음 달</div>
      </div>
      <div class="header-icon">🔔</div>
    </div>
    <div class="content" style="overflow-y:hidden;">
      <div class="ann-section-title">📅 이번 달 기념일</div>
      <div style="display:flex;flex-direction:column;gap:10px;padding:0 16px;">
        ${cards}
      </div>
      <div class="notify-banner">
        <div class="notify-icon">🔔</div>
        <div class="notify-text">기념일 알림을 설정하면<br>당일·1일 전·3일 전·7일 전 알림을 받아요</div>
      </div>
    </div>
    ${navBar('ann')}
  </div>
  </body></html>`;
}

// ══════════════════════════════════════════════════════════════════════════
// 스크린샷 3: 초대 화면 (인물 상세 + 초대 링크)
// ══════════════════════════════════════════════════════════════════════════
function makeInviteHTML() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    ${BASE_CSS}
    .tree-bg-faded {
      position:absolute; inset:0;
      background:#EEF2FF;
      opacity:0.5;
    }
    .detail-panel {
      position:absolute; right:0; top:0; bottom:0; width:100%;
      background:white;
      padding:20px 20px 0;
      display:flex; flex-direction:column; gap:14px;
      overflow:hidden;
    }
    .detail-header { display:flex; justify-content:space-between; align-items:flex-start; }
    .detail-hex {
      width:72px; height:72px;
      clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
      background:linear-gradient(135deg,#EC4899,#DB2777);
      display:flex; align-items:center; justify-content:center;
      font-size:28px; font-weight:800; color:white;
    }
    .close-x { font-size:18px; color:#ccc; }
    .detail-name { font-size:22px; font-weight:700; color:#1a2e3b; }
    .meta-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
    .chip { background:#f0f4f8; color:#4a5568; font-size:12px; font-weight:600; padding:3px 10px; border-radius:20px; }
    .chip.accent { background:#EEF2FF; color:#4F46E5; }
    .btn-edit { align-self:flex-start; background:none; border:1.5px solid #e0e0e0; border-radius:6px; padding:5px 14px; font-size:13px; color:#4a5568; }
    .action-btn {
      padding:11px 16px; border-radius:10px; border:none;
      font-size:14px; font-weight:600; display:flex; align-items:center; gap:8px;
    }
    .action-primary { background:linear-gradient(135deg,#4F46E5,#7C3AED); color:white; }
    .action-secondary { background:#EEF2FF; color:#4F46E5; border:1.5px solid #C7D2FE; }
    .invite-box {
      background:linear-gradient(135deg,#EEF2FF,#E0E7FF);
      border:1.5px solid #C7D2FE; border-radius:14px;
      padding:16px; display:flex; flex-direction:column; gap:10px;
    }
    .invite-label { font-size:12px; font-weight:700; color:#4F46E5; display:flex; align-items:center; gap:6px; }
    .invite-expiry { font-weight:500; color:#818CF8; font-size:11px; }
    .invite-desc {
      background:white; border-radius:10px; padding:14px;
      text-align:center; box-shadow:0 2px 8px rgba(79,70,229,0.10);
    }
    .invite-desc-main { font-size:14px; color:#374151; line-height:1.7; }
    .invite-name-hl { font-size:22px; font-weight:800; color:#4F46E5; display:block; }
    .invite-link-row { display:flex; gap:6px; }
    .invite-input {
      flex:1; font-size:11px; padding:7px 8px;
      border:1px solid #C7D2FE; border-radius:8px;
      background:white; color:#6B7280;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }
    .btn-copy { background:#4F46E5; color:white; border:none; border-radius:8px; padding:7px 14px; font-size:12px; font-weight:600; }
    .share-row { display:flex; gap:8px; }
    .share-btn {
      flex:1; display:flex; align-items:center; justify-content:center;
      gap:6px; padding:10px; border:none; border-radius:10px;
      font-size:13px; font-weight:700;
    }
    .share-kakao { background:#FEE500; color:#191919; }
    .share-sms   { background:#4F46E5; color:white; }
  </style>
  </head><body>
  <div class="app">
    <div class="header">
      <div>
        <div class="header-title">우리 가족 가계도</div>
        <div class="header-sub">김대수 · 이복순 가계</div>
      </div>
      <div class="header-icon">👤</div>
    </div>
    <div class="content" style="position:relative;">
      <div class="tree-bg-faded"></div>
      <div class="detail-panel">
        <div class="detail-header">
          <div class="detail-hex">박</div>
          <span class="close-x">✕</span>
        </div>
        <div>
          <div class="detail-name">박혜경</div>
          <div class="meta-chips">
            <span class="chip">여성</span>
            <span class="chip">만 52세</span>
            <span class="chip">1972.04.18생</span>
            <span class="chip accent">1촌 (어머니)</span>
          </div>
        </div>
        <button class="btn-edit">편집</button>
        <div style="border-top:1px solid #f0f0f0;padding-top:14px;display:flex;flex-direction:column;gap:8px;">
          <button class="action-btn action-primary">
            <span style="font-size:16px;">+</span>가족 추가
          </button>
          <button class="action-btn action-secondary">
            <span>🔗</span>초대 링크 만들기
          </button>
        </div>
        <div class="invite-box">
          <p class="invite-label">🔗 초대 링크 생성됨 <span class="invite-expiry">30일 유효</span></p>
          <div class="invite-desc">
            <p class="invite-desc-main">이 링크로 가입하면<br>
              <strong class="invite-name-hl">박혜경</strong>
              <span style="font-size:14px;color:#374151;font-weight:500;">으로 바로 가입됩니다</span>
            </p>
          </div>
          <div class="invite-link-row">
            <div class="invite-input">https://familytree-3221b.web.app/invite/a8f2c3…</div>
            <button class="btn-copy">복사</button>
          </div>
          <div class="share-row">
            <button class="share-btn share-kakao">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5C4.86 1.5 1.5 4.08 1.5 7.26c0 2.04 1.35 3.84 3.39 4.86l-.87 3.24 3.78-2.49c.39.06.78.09 1.2.09 4.14 0 7.5-2.58 7.5-5.76S13.14 1.5 9 1.5z" fill="currentColor"/>
              </svg>
              카카오톡
            </button>
            <button class="share-btn share-sms">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              문자
            </button>
          </div>
        </div>
      </div>
    </div>
    ${navBar('tree')}
  </div>
  </body></html>`;
}

// ── 실행 ──────────────────────────────────────────────────────────────────
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE });

  const screens = [
    { name: 'screenshot_1.png', html: makeTreeHTML(),   label: '가계도 화면' },
    { name: 'screenshot_2.png', html: makeAnnHTML(),    label: '기념일 화면' },
    { name: 'screenshot_3.png', html: makeInviteHTML(), label: '초대 화면'   },
  ];

  for (const s of screens) {
    await page.setContent(s.html, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: s.name, type: 'png' });
    console.log(`✅ ${s.name} (${s.label}) 완료`);
  }

  await browser.close();
  console.log('\n🎉 스크린샷 3장 생성 완료 — 1080×1920');
})();
