// Play 스토어 등록용 이미지 생성 (A안 "따뜻한 기록" 디자인)
//   node make_screenshots.js
// 결과:
//   store_icon_512.png        — 스토어 앱 아이콘 (512×512)
//   feature_graphic.png       — 그래픽 이미지 (1024×500)
//   screenshot_1~3.png        — 휴대전화 스크린샷 (1080×1920)
//   client/public/icons/maskable-192.png, maskable-512.png — 안드로이드 적응형 아이콘
const puppeteer = require('puppeteer');
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const C = {
  pri: '#2E5E4E', priDark: '#1F4337', priBg: '#E3EDE6',
  acc: '#A9502F', accDark: '#8A3F24', accBg: '#F6E3D8',
  bg: '#F7F2E9', surface: '#FFFDF8', surface2: '#FBF7F0', surface3: '#F1EADD',
  text: '#2A2620', text2: '#5F5648', text3: '#7A6F5E',
  border: '#E6DCCB', border2: '#D6C8B0', line: '#B8A68A',
  male: '#3D7563', maleDark: '#24503F', female: '#C0603C', femaleDark: '#93452A',
  gold: '#B7862B', goldDark: '#7A5A16', deceased: '#A89D8A', deceasedDark: '#7F7563',
};

const avatar = name =>
  'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'client/public/avatars', name + '.png')).toString('base64');

// ── 아이콘 (가장자리까지 꽉 찬 정사각형, 마스크용 안전 영역 안에 나무 그림) ──
function iconSvg(markScale) {
  // 원본 나무 그림은 512 격자 기준 x 64~448, y 36~482
  const s = markScale, cx = 256, cy = 259;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="${C.pri}"/><stop offset="100%" stop-color="${C.priDark}"/>
  </linearGradient></defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})">
    <circle cx="256" cy="88" r="52" fill="#FFFDF8"/>
    <line x1="256" y1="140" x2="256" y2="196" stroke="#FFFDF8" stroke-opacity="0.75" stroke-width="18" stroke-linecap="round"/>
    <line x1="128" y1="196" x2="384" y2="196" stroke="#FFFDF8" stroke-opacity="0.75" stroke-width="18" stroke-linecap="round"/>
    <line x1="128" y1="196" x2="128" y2="268" stroke="#FFFDF8" stroke-opacity="0.65" stroke-width="15" stroke-linecap="round"/>
    <line x1="384" y1="196" x2="384" y2="268" stroke="#FFFDF8" stroke-opacity="0.65" stroke-width="15" stroke-linecap="round"/>
    <circle cx="128" cy="308" r="42" fill="#FFFDF8" opacity="0.92"/>
    <circle cx="384" cy="308" r="42" fill="#FFFDF8" opacity="0.92"/>
    <line x1="128" y1="350" x2="128" y2="390" stroke="#FFFDF8" stroke-opacity="0.55" stroke-width="12" stroke-linecap="round"/>
    <line x1="64" y1="390" x2="192" y2="390" stroke="#FFFDF8" stroke-opacity="0.55" stroke-width="12" stroke-linecap="round"/>
    <line x1="384" y1="350" x2="384" y2="390" stroke="#FFFDF8" stroke-opacity="0.55" stroke-width="12" stroke-linecap="round"/>
    <line x1="320" y1="390" x2="448" y2="390" stroke="#FFFDF8" stroke-opacity="0.55" stroke-width="12" stroke-linecap="round"/>
    <line x1="64" y1="390" x2="64" y2="424" stroke="#FFFDF8" stroke-opacity="0.45" stroke-width="10" stroke-linecap="round"/>
    <line x1="192" y1="390" x2="192" y2="424" stroke="#FFFDF8" stroke-opacity="0.45" stroke-width="10" stroke-linecap="round"/>
    <line x1="320" y1="390" x2="320" y2="424" stroke="#FFFDF8" stroke-opacity="0.45" stroke-width="10" stroke-linecap="round"/>
    <line x1="448" y1="390" x2="448" y2="424" stroke="#FFFDF8" stroke-opacity="0.45" stroke-width="10" stroke-linecap="round"/>
    <circle cx="64" cy="452" r="30" fill="#F3C9A8"/>
    <circle cx="192" cy="452" r="30" fill="#F3C9A8"/>
    <circle cx="320" cy="452" r="30" fill="#F3C9A8"/>
    <circle cx="448" cy="452" r="30" fill="#F3C9A8"/>
  </g>
</svg>`;
}

function writePng(svg, file, size) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(path.join(__dirname, file), png);
  console.log('  ✓', file);
}

// ── 공통 HTML 조각 ──────────────────────────────────────────────────────
const FONTS = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap">`;

const BASE_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Pretendard Variable', sans-serif; color: ${C.text}; word-break: keep-all; }
.serif { font-family: 'Gowun Batang', serif; }
.hex { clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
.node { display: flex; flex-direction: column; align-items: center; gap: 5px; position: relative; }
.ring { display: flex; align-items: center; justify-content: center; }
.ring.male { background: linear-gradient(150deg, ${C.male}, ${C.maleDark}); }
.ring.female { background: linear-gradient(150deg, ${C.female}, ${C.femaleDark}); }
.ring.me { background: linear-gradient(150deg, ${C.gold}, ${C.goldDark}); }
.ring.deceased { background: linear-gradient(150deg, ${C.deceased}, ${C.deceasedDark}); }
.inner { background: ${C.surface2}; overflow: hidden; }
.inner img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ring.deceased .inner img { filter: grayscale(45%); opacity: 0.88; }
.nm { font-size: 13px; font-weight: 700; white-space: nowrap; }
.nm .ko { font-family: 'Gowun Batang', serif; color: ${C.deceasedDark}; margin-right: 2px; }
.dec .nm { color: ${C.text3}; }
.age { font-size: 11px; color: ${C.text3}; margin-top: -3px; }
.badge { position: absolute; top: -5px; width: 20px; height: 20px; border-radius: 50%;
  color: #fff; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 0 2px ${C.surface}; }
`;

function hexNode(p, w) {
  const h = Math.round(w * 1.1), b = 4;
  const cls = p.dec ? 'deceased' : p.me ? 'me' : p.g;
  return `<div class="node ${p.dec ? 'dec' : ''}" style="width:${w + 22}px">
    <div class="ring hex ${cls}" style="width:${w}px;height:${h}px">
      <div class="inner hex" style="width:${w - b * 2}px;height:${h - b * 2}px"><img src="${avatar(p.a)}"></div>
    </div>
    ${p.me ? `<span class="badge" style="right:4px;background:${C.gold}">나</span>` : ''}
    <span class="nm">${p.dec ? '<span class="ko">故</span>' : ''}${p.n}</span>
    ${p.age ? `<span class="age">${p.age}</span>` : ''}
  </div>`;
}

// 선 아이콘 (앱의 Icon.tsx와 같은 모양)
const ICON = {
  tree: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4M5 16.5V14h14v2.5M12 11.5v2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  sparkle: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17.2v.1"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  cake: '<path d="M4 21h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 16c2 1.5 4 1.5 5.3 0 1.4 1.5 4 1.5 5.4 0 1.3 1.5 3.3 1.5 5.3 0M12 12V8"/>',
  candle: '<rect x="9" y="10" width="6" height="11" rx="1"/><path d="M12 10V8M12 7c-1.2-1-1.2-2.6 0-4 1.2 1.4 1.2 3 0 4z"/>',
  ring: '<circle cx="12" cy="14.5" r="6"/><path d="M9.5 4h5l1.5 2.5-4 3-4-3z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  chat: '<path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>',
};
const icon = (n, size = 20, color = 'currentColor') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0">${ICON[n]}</svg>`;

// ── 스크린샷 공통 틀: 위 문구 + 아래 휴대폰 화면 ────────────────────────
const W = 540, H = 960;

function shot(caption, sub, screen, activeNav) {
  const nav = [['user', 'My'], ['search', '검색'], ['calendar', '기념일'], ['mail', '초대'], ['sparkle', 'AI'], ['help', '도움말']];
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE_CSS}
  body { width:${W}px; height:${H}px; overflow:hidden; background:${C.bg}; }
  .cap { padding: 54px 36px 0; height: 214px; }
  .cap h1 { font-family:'Gowun Batang',serif; font-size: 34px; line-height: 1.3; font-weight: 700; }
  .cap p { margin-top: 10px; font-size: 16px; color: ${C.text2}; line-height: 1.55; }
  .phone { position:absolute; left: 26px; right: 26px; top: 214px; bottom: 0;
    background:${C.bg}; border: 7px solid ${C.text}; border-bottom: none; border-radius: 40px 40px 0 0; overflow:hidden;
    box-shadow: 0 30px 60px -30px rgba(60,45,25,.45); display:flex; flex-direction:column; }
  .hdr { background:${C.surface}; border-bottom:1px solid ${C.border}; height: 52px; padding: 0 16px;
    display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .logo { width:26px; height:26px; border-radius:7px; background:${C.pri}; display:flex; align-items:center; justify-content:center; }
  .logo-t { font-family:'Gowun Batang',serif; font-size:16px; font-weight:700; color:${C.pri}; }
  .content { flex:1; position:relative; overflow:hidden; }
  .bnav { background:${C.surface}; border-top:1px solid ${C.border}; display:flex; height: 64px; padding-bottom: 6px; flex-shrink:0; }
  .bnav div { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px;
    font-size:10px; font-weight:700; color:${C.text3}; }
  .bnav div.on { color:${C.pri}; }
  </style></head><body>
  <div class="cap"><h1>${caption}</h1><p>${sub}</p></div>
  <div class="phone">
    <div class="hdr"><div class="logo">${icon('tree', 16, '#FFFDF8')}</div><span class="logo-t">우리 가족 가계도</span></div>
    <div class="content">${screen}</div>
    <div class="bnav">${nav.map(([i, l]) => `<div class="${l === activeNav ? 'on' : ''}">${icon(i, 21)}${l}</div>`).join('')}</div>
  </div>
  </body></html>`;
}

// 1) 가계도
function treeScreen() {
  const P = {
    gf: { n: '김대수', a: 'm_hanbok_elder', g: 'male', dec: true, age: '(향 88)' },
    gm: { n: '이복순', a: 'f_hanbok_elder', g: 'female', age: '(84)' },
    f: { n: '김현석', a: 'm_adult', g: 'male', age: '(62)' },
    m: { n: '박혜경', a: 'f_adult', g: 'female', age: '(59)' },
    u: { n: '김태호', a: 'm_professor', g: 'male', age: '(57)' },
    a: { n: '최나영', a: 'f_cook', g: 'female', age: '(55)' },
    me: { n: '김민준', a: 'm_young', g: 'male', me: true, age: '(29)' },
    sis: { n: '김서연', a: 'f_college', g: 'female', age: '(24)' },
    c1: { n: '김지후', a: 'm_student', g: 'male', age: '(17)' },
    c2: { n: '김하은', a: 'f_child', g: 'female', age: '(11)' },
  };
  const L = C.line;
  const stem = h => `<div style="width:2px;height:${h}px;background:${L}"></div>`;
  const fork = w => `<div style="width:${w};height:14px;border:2px solid ${L};border-bottom:none"></div>`;
  const pair = (a, b, w) => `<div style="display:flex;align-items:flex-start">${hexNode(a, w)}<div style="width:10px;margin-top:${w * 0.55}px;border-top:2px dashed ${C.border2}"></div>${hexNode(b, w)}</div>`;
  return `
  <div style="display:flex;background:${C.surface};border-bottom:1px solid ${C.border};padding:0 12px">
    ${['친가', '외가', '처가'].map((t, i) => `<div style="flex:1;text-align:center;padding:12px 0;font-size:14px;font-weight:${i ? 600 : 700};color:${i ? C.text3 : C.pri};border-bottom:3px solid ${i ? 'transparent' : C.pri}">${t}</div>`).join('')}
  </div>
  <div style="position:absolute;inset:44px 0 0;background-image:radial-gradient(${C.border} 1px,transparent 1px);background-size:22px 22px"></div>
  <div style="position:relative;padding-top:58px;display:flex;flex-direction:column;align-items:center">
    ${pair(P.gf, P.gm, 62)}
    ${stem(16)}${fork('52%')}
    <div style="display:flex;width:100%">
      ${[[P.f, P.m, [P.me, P.sis]], [P.u, P.a, [P.c1, P.c2]]].map(([x, y, kids]) => `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center">
        ${pair(x, y, 54)}${stem(16)}${fork('50%')}
        <div style="display:flex;width:100%;justify-content:space-around">${kids.map(k => hexNode(k, 50)).join('')}</div>
      </div>`).join('')}
    </div>
  </div>
  <div style="position:absolute;left:14px;bottom:14px;display:flex;gap:6px">
    ${[['남성', C.male], ['여성', C.female], ['나', C.gold], ['고인', C.deceased]].map(([t, c]) => `<span style="display:flex;align-items:center;gap:5px;background:${C.surface};border:1px solid ${C.border};border-radius:99px;padding:5px 10px;font-size:11px;font-weight:600"><i style="width:9px;height:9px;border-radius:50%;background:${c}"></i>${t}</span>`).join('')}
  </div>`;
}

// 2) 기념일
function annScreen() {
  const rows = [
    { chip: '오늘', bg: C.pri, fg: '#fff', a: 'f_hanbok_elder', g: 'female', n: '이복순', rel: '2촌 · 할머니', type: '생신 · 음력', ic: 'cake', right: '84세' },
    { chip: 'D-12', bg: C.accBg, fg: C.accDark, a: 'm_young', g: 'me', n: '김민준', rel: '나', type: '생일', ic: 'cake', right: '만 30세' },
    { chip: 'D-23', bg: C.priBg, fg: C.priDark, a: 'f_adult', g: 'female', n: '결혼기념일', rel: '아버지 · 어머니', type: '결혼기념일', ic: 'ring', right: '32주년' },
    { chip: 'D-41', bg: C.surface3, fg: C.text2, a: 'm_hanbok_elder', g: 'deceased', n: '김대수', rel: '2촌 · 할아버지', type: '기일 · 음력', ic: 'candle', right: '3주기' },
    { chip: 'D-58', bg: C.surface3, fg: C.text2, a: 'f_college', g: 'female', n: '김서연', rel: '2촌 · 여동생', type: '생일', ic: 'cake', right: '만 25세' },
  ];
  return `
  <div style="padding:18px 16px 10px;display:flex;align-items:center;justify-content:space-between">
    <span class="serif" style="font-size:20px;font-weight:700">다가오는 기념일</span>
    <span style="width:36px;height:36px;border-radius:10px;background:${C.priBg};color:${C.pri};display:flex;align-items:center;justify-content:center">${icon('bell', 19)}</span>
  </div>
  <div style="margin:0 14px;background:${C.surface};border:1px solid ${C.border};border-radius:16px;overflow:hidden">
    ${rows.map((r, i) => `
    <div style="display:flex;align-items:center;gap:12px;padding:14px;${i < rows.length - 1 ? `border-bottom:1px solid ${C.surface3}` : ''}">
      <span style="min-width:46px;text-align:center;font-size:12px;font-weight:800;padding:5px 0;border-radius:7px;background:${r.bg};color:${r.fg}">${r.chip}</span>
      <div class="ring hex ${r.g}" style="width:38px;height:42px;flex-shrink:0"><div class="inner hex" style="width:32px;height:36px"><img src="${avatar(r.a)}"></div></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:700;${r.g === 'deceased' ? `color:${C.text3}` : ''}">${r.g === 'deceased' ? `<span class="serif" style="color:${C.deceasedDark}">故</span> ` : ''}${r.n}</div>
        <div style="font-size:12px;color:${C.text3};margin-top:2px">${r.rel}</div>
      </div>
      <div style="text-align:right">
        <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;font-size:12px;font-weight:600;color:${C.pri}">${icon(r.ic, 14)}${r.type}</div>
        <div style="font-size:12px;color:${C.text3};margin-top:3px">${r.right}</div>
      </div>
    </div>`).join('')}
  </div>
  <div style="margin:14px;padding:14px 16px;border-radius:14px;background:${C.pri};color:${C.bg};display:flex;gap:12px;align-items:center">
    ${icon('bell', 22, '#F3C9A8')}
    <div style="font-size:13px;line-height:1.5"><b>당일·하루 전·일주일 전</b> 등<br>원하는 때 휴대폰 알림으로 알려드려요</div>
  </div>`;
}

// 3) 초대
function inviteScreen() {
  return `
  <div style="position:absolute;inset:0;background:rgba(42,38,32,.28)"></div>
  <div style="position:absolute;left:0;right:0;bottom:0;top:46px;background:${C.surface};border-radius:22px 22px 0 0;padding:22px 20px">
    <div style="display:flex;align-items:center;gap:14px">
      <div class="ring hex female" style="width:66px;height:72px"><div class="inner hex" style="width:58px;height:64px"><img src="${avatar('f_adult')}"></div></div>
      <div>
        <div class="serif" style="font-size:22px;font-weight:700">박혜경</div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <span style="font-size:12px;font-weight:600;padding:3px 9px;border-radius:99px;background:${C.priBg};color:${C.priDark}">1촌 · 어머니</span>
          <span style="font-size:12px;font-weight:600;padding:3px 9px;border-radius:99px;background:${C.surface3};color:${C.text2}">1966. 4. 12</span>
        </div>
      </div>
    </div>
    <div style="margin-top:18px;display:flex;flex-direction:column;gap:10px;font-size:14px;color:${C.text2}">
      <div style="display:flex;gap:10px;align-items:center">${icon('chat', 17, C.pri)}텃밭에 상추가 한가득 — 주말에 가지러 오렴</div>
      <div style="display:flex;gap:10px;align-items:center">${icon('ring', 17, C.pri)}배우자 김현석</div>
      <div style="display:flex;gap:10px;align-items:center">${icon('phone', 17, C.pri)}010-••••-5678</div>
    </div>
    <div style="margin-top:22px;padding:18px;border-radius:16px;background:${C.priBg};border:1px solid #C9DCCF">
      <div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;color:${C.priDark}">${icon('link', 16)}초대 링크가 만들어졌어요<span style="font-weight:400;color:${C.text3};font-size:12px;margin-left:4px">30일 유효</span></div>
      <div style="margin-top:12px;display:flex;align-items:center;background:${C.surface};border:1px solid ${C.border};border-radius:10px;padding:10px 12px;font-size:13px;color:${C.text3}">
        <span style="flex:1">familytree-3221b.web.app/invite/a8f2…</span><b style="color:${C.pri}">복사</b>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px">
        <div style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px 0;border-radius:10px;background:#FEE500;color:#3A1D1D;font-size:14px;font-weight:700">
          <svg width="16" height="16" viewBox="0 0 18 18"><path d="M9 1.5C4.86 1.5 1.5 4.08 1.5 7.26c0 2.04 1.35 3.84 3.39 4.86l-.87 3.24 3.78-2.49c.39.06.78.09 1.2.09 4.14 0 7.5-2.58 7.5-5.76S13.14 1.5 9 1.5z" fill="currentColor"/></svg>카카오톡</div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px 0;border-radius:10px;background:${C.surface};border:1px solid ${C.border};color:${C.pri};font-size:14px;font-weight:700">${icon('chat', 16)}문자</div>
      </div>
    </div>
    <div style="margin-top:16px;display:flex;gap:8px">
      ${[['edit', '편집'], ['link', '권한 관리']].map(([i, t]) => `<div style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px 0;border-radius:10px;border:1px solid ${C.border};font-size:13px;font-weight:600;color:${C.text2}">${icon(i, 15)}${t}</div>`).join('')}
    </div>
  </div>`;
}

// ── 그래픽 이미지 1024×500 ───────────────────────────────────────────────
function featureHTML() {
  const g = [{ n: '김대수', a: 'm_hanbok_elder', g: 'male' }, { n: '이복순', a: 'f_hanbok_elder', g: 'female' }];
  const p = [{ n: '김현석', a: 'm_adult', g: 'male' }, { n: '박혜경', a: 'f_adult', g: 'female' }];
  const k = [{ n: '김민준', a: 'm_young', g: 'male', me: true }, { n: '김서연', a: 'f_college', g: 'female' }, { n: '김하은', a: 'f_child', g: 'female' }];
  const L = C.border2;
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE_CSS}
  body { width:1024px; height:500px; overflow:hidden; background:${C.bg}; position:relative; }
  .nm { font-size: 12px; }
  </style></head><body>
  <div style="position:absolute;width:520px;height:520px;border-radius:50%;right:-120px;top:-160px;background:radial-gradient(circle, rgba(46,94,78,.13), transparent 70%)"></div>
  <div style="position:absolute;left:84px;top:0;bottom:0;width:440px;display:flex;flex-direction:column;justify-content:center;gap:18px">
    <span style="font-size:15px;font-weight:600;letter-spacing:.08em;color:${C.acc}">우리 가족만의 공간</span>
    <h1 class="serif" style="font-size:54px;line-height:1.2;font-weight:700">우리 가족 가계도</h1>
    <p style="font-size:20px;color:${C.text2};line-height:1.5">흩어진 가족 이야기를<br>한 그루의 나무로 모아보세요</p>
    <div style="display:flex;gap:8px;margin-top:6px">
      ${[['tree', '양가 가계도'], ['calendar', '음력 기념일'], ['link', '가족 초대']].map(([i, t]) => `<span style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:99px;background:${C.surface};border:1px solid ${C.border};font-size:14px;font-weight:600;color:${C.pri}">${icon(i, 16)}${t}</span>`).join('')}
    </div>
  </div>
  <div style="position:absolute;right:70px;top:56px;width:380px;height:388px;background:${C.surface};border:1px solid ${C.border};border-radius:22px;box-shadow:0 30px 60px -30px rgba(60,45,25,.35);display:flex;flex-direction:column;align-items:center;padding-top:34px">
    <div style="display:flex;gap:6px">${g.map(x => hexNode(x, 62)).join('')}</div>
    <div style="width:2px;height:14px;background:${L}"></div>
    <div style="display:flex;gap:6px">${p.map(x => hexNode(x, 56)).join('')}</div>
    <div style="width:2px;height:14px;background:${L}"></div>
    <div style="width:62%;height:14px;border:2px solid ${L};border-bottom:none"></div>
    <div style="display:flex;width:80%;justify-content:space-between">${k.map(x => hexNode(x, 52)).join('')}</div>
  </div>
  </body></html>`;
}

// ── 실행 ──────────────────────────────────────────────────────────────────
(async () => {
  console.log('아이콘');
  writePng(iconSvg(0.62), 'client/public/icons/maskable-512.png', 512);   // 안전 영역(지름 80%) 안
  writePng(iconSvg(0.62), 'client/public/icons/maskable-192.png', 192);
  writePng(iconSvg(0.74), 'store_icon_512.png', 512);                     // Play가 모서리를 둥글게 잘라 씀

  const browser = await puppeteer.launch();
  const jobs = [
    { name: 'feature_graphic.png', w: 1024, h: 500, scale: 1, html: featureHTML() },
    { name: 'screenshot_1.png', w: W, h: H, scale: 2, html: shot('3대 가족을<br>한눈에', '아바타로 그리는 우리 집 가계도.<br>돌아가신 분도 함께 기억해요.', treeScreen(), '') },
    { name: 'screenshot_2.png', w: W, h: H, scale: 2, html: shot('음력 생신까지<br>잊지 않게', '생일·결혼기념일·기일을 모아<br>다가오는 날을 알려드려요.', annScreen(), '기념일') },
    { name: 'screenshot_3.png', w: W, h: H, scale: 2, html: shot('링크 하나로<br>가족을 초대해요', '카카오톡으로 보내면 가입과 동시에<br>가계도에 연결돼요.', inviteScreen(), '초대') },
  ];
  console.log('스토어 이미지');
  for (const j of jobs) {
    const page = await browser.newPage();
    await page.setViewport({ width: j.w, height: j.h, deviceScaleFactor: j.scale });
    await page.setContent(j.html, { waitUntil: 'load', timeout: 120000 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: j.name, type: 'png' });
    await page.close();
    console.log('  ✓', j.name);
  }
  await browser.close();
})();
