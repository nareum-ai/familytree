const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');

// 스크린샷 1: 메인 가계도
const svg1 = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e8f4fb"/>
      <stop offset="100%" stop-color="#f0f7fb"/>
    </linearGradient>
    <linearGradient id="hdr" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#2AABE2"/>
    </linearGradient>
    <linearGradient id="gm" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#2AABE2"/>
    </linearGradient>
    <linearGradient id="gf" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EC4899"/>
      <stop offset="100%" stop-color="#F472B6"/>
    </linearGradient>
  </defs>

  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect width="1080" height="160" fill="url(#hdr)"/>
  <text x="80" y="105" font-family="sans-serif" font-size="52" font-weight="bold" fill="white">우리 가족 가계도</text>
  <circle cx="980" cy="88" r="36" fill="rgba(255,255,255,0.2)"/>
  <text x="980" y="100" font-family="sans-serif" font-size="30" fill="white" text-anchor="middle">👤</text>

  <rect width="1080" height="110" y="160" fill="white"/>
  <text x="120" y="230" font-family="sans-serif" font-size="34" fill="#4F46E5" text-anchor="middle">친가</text>
  <rect x="60" y="255" width="120" height="5" rx="3" fill="#4F46E5"/>
  <text x="340" y="230" font-family="sans-serif" font-size="34" fill="#bbb" text-anchor="middle">외가</text>
  <text x="560" y="230" font-family="sans-serif" font-size="34" fill="#bbb" text-anchor="middle">처가</text>
  <text x="780" y="230" font-family="sans-serif" font-size="34" fill="#bbb" text-anchor="middle">처외가</text>

  <!-- Gen1 -->
  <polygon points="420,390 480,357 540,390 540,457 480,490 420,457" fill="url(#gm)"/>
  <polygon points="590,390 650,357 710,390 710,457 650,490 590,457" fill="url(#gf)"/>
  <text x="480" y="540" font-family="sans-serif" font-size="38" fill="#1a2e3b" text-anchor="middle" font-weight="600">홍대수</text>
  <text x="480" y="585" font-family="sans-serif" font-size="30" fill="#888" text-anchor="middle">(78)</text>
  <text x="650" y="540" font-family="sans-serif" font-size="38" fill="#1a2e3b" text-anchor="middle" font-weight="600">이순자</text>
  <text x="650" y="585" font-family="sans-serif" font-size="30" fill="#888" text-anchor="middle">(75)</text>

  <line x1="565" y1="490" x2="565" y2="670" stroke="#2AABE2" stroke-width="4"/>

  <!-- Gen2 -->
  <polygon points="390,720 460,682 530,720 530,795 460,833 390,795" fill="url(#gm)"/>
  <circle cx="540" cy="702" r="44" fill="#F97316"/>
  <text x="540" y="718" font-family="sans-serif" font-size="28" fill="white" text-anchor="middle" font-weight="bold">나</text>
  <polygon points="620,720 690,682 760,720 760,795 690,833 620,795" fill="url(#gf)"/>
  <text x="460" y="890" font-family="sans-serif" font-size="38" fill="#1a2e3b" text-anchor="middle" font-weight="600">홍재억</text>
  <text x="460" y="935" font-family="sans-serif" font-size="30" fill="#888" text-anchor="middle">(49)</text>
  <text x="690" y="890" font-family="sans-serif" font-size="38" fill="#1a2e3b" text-anchor="middle" font-weight="600">전현숙</text>
  <text x="690" y="935" font-family="sans-serif" font-size="30" fill="#888" text-anchor="middle">(50)</text>

  <line x1="565" y1="833" x2="565" y2="1010" stroke="#2AABE2" stroke-width="4"/>
  <line x1="380" y1="1010" x2="750" y2="1010" stroke="#2AABE2" stroke-width="4"/>
  <line x1="380" y1="1010" x2="380" y2="1055" stroke="#2AABE2" stroke-width="4"/>
  <line x1="750" y1="1010" x2="750" y2="1055" stroke="#2AABE2" stroke-width="4"/>

  <!-- Gen3 -->
  <circle cx="352" cy="990" r="40" fill="#2AABE2"/>
  <text x="352" y="1005" font-family="sans-serif" font-size="26" fill="white" text-anchor="middle" font-weight="bold">1촌</text>
  <polygon points="300,1055 370,1017 440,1055 440,1130 370,1168 300,1130" fill="url(#gf)"/>
  <text x="370" y="1225" font-family="sans-serif" font-size="38" fill="#1a2e3b" text-anchor="middle" font-weight="600">홍사민</text>
  <text x="370" y="1270" font-family="sans-serif" font-size="30" fill="#888" text-anchor="middle">(19)</text>

  <circle cx="778" cy="990" r="40" fill="#2AABE2"/>
  <text x="778" y="1005" font-family="sans-serif" font-size="26" fill="white" text-anchor="middle" font-weight="bold">1촌</text>
  <polygon points="670,1055 740,1017 810,1055 810,1130 740,1168 670,1130" fill="url(#gm)"/>
  <text x="740" y="1225" font-family="sans-serif" font-size="38" fill="#1a2e3b" text-anchor="middle" font-weight="600">홍준서</text>
  <text x="740" y="1270" font-family="sans-serif" font-size="30" fill="#888" text-anchor="middle">(17)</text>

  <!-- 하단 네비 -->
  <rect x="0" y="1780" width="1080" height="140" fill="white"/>
  <line x1="0" y1="1780" x2="1080" y2="1780" stroke="#e2e8f0" stroke-width="2"/>
  <text x="135" y="1840" font-family="sans-serif" font-size="36" fill="#2AABE2" text-anchor="middle">👤</text>
  <text x="135" y="1882" font-family="sans-serif" font-size="28" fill="#2AABE2" text-anchor="middle">My</text>
  <text x="378" y="1840" font-family="sans-serif" font-size="36" fill="#aaa" text-anchor="middle">🔍</text>
  <text x="378" y="1882" font-family="sans-serif" font-size="28" fill="#aaa" text-anchor="middle">검색</text>
  <text x="621" y="1840" font-family="sans-serif" font-size="36" fill="#aaa" text-anchor="middle">📅</text>
  <text x="621" y="1882" font-family="sans-serif" font-size="28" fill="#aaa" text-anchor="middle">기념일</text>
  <text x="864" y="1840" font-family="sans-serif" font-size="36" fill="#aaa" text-anchor="middle">❓</text>
  <text x="864" y="1882" font-family="sans-serif" font-size="28" fill="#aaa" text-anchor="middle">도움말</text>
</svg>`;

// 스크린샷 2: 기념일 화면
const svg2 = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
  <defs>
    <linearGradient id="hdr2" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#2AABE2"/>
    </linearGradient>
  </defs>

  <rect width="1080" height="1920" fill="#f8fafc"/>
  <rect width="1080" height="160" fill="url(#hdr2)"/>
  <text x="80" y="105" font-family="sans-serif" font-size="52" font-weight="bold" fill="white">기념일</text>

  <!-- 이달의 기념일 섹션 -->
  <text x="60" y="240" font-family="sans-serif" font-size="38" font-weight="bold" fill="#1a2e3b">🎂 이달의 생일</text>

  <!-- 카드 1 -->
  <rect x="40" y="270" width="1000" height="160" rx="20" fill="white" filter="drop-shadow(0 2px 12px rgba(0,0,0,0.08))"/>
  <polygon points="80,320 110,303 140,320 140,354 110,371 80,354" fill="#4F46E5"/>
  <text x="110" y="343" font-family="sans-serif" font-size="20" fill="white" text-anchor="middle">👤</text>
  <text x="180" y="330" font-family="sans-serif" font-size="38" font-weight="600" fill="#1a2e3b">홍사민</text>
  <text x="180" y="375" font-family="sans-serif" font-size="30" fill="#888">6월 15일 · 만 19세</text>
  <rect x="860" y="300" width="140" height="52" rx="26" fill="#4F46E5"/>
  <text x="930" y="333" font-family="sans-serif" font-size="26" fill="white" text-anchor="middle">D-3</text>

  <!-- 카드 2 -->
  <rect x="40" y="450" width="1000" height="160" rx="20" fill="white" filter="drop-shadow(0 2px 12px rgba(0,0,0,0.08))"/>
  <polygon points="80,500 110,483 140,500 140,534 110,551 80,534" fill="#EC4899"/>
  <text x="110" y="523" font-family="sans-serif" font-size="20" fill="white" text-anchor="middle">👤</text>
  <text x="180" y="510" font-family="sans-serif" font-size="38" font-weight="600" fill="#1a2e3b">이순자</text>
  <text x="180" y="555" font-family="sans-serif" font-size="30" fill="#888">6월 22일 · 만 75세</text>
  <rect x="840" y="480" width="160" height="52" rx="26" fill="#f0f0f0"/>
  <text x="920" y="513" font-family="sans-serif" font-size="26" fill="#888" text-anchor="middle">D-10</text>

  <!-- 다음달 섹션 -->
  <text x="60" y="680" font-family="sans-serif" font-size="38" font-weight="bold" fill="#1a2e3b">📅 다음달 기념일</text>

  <!-- 카드 3 -->
  <rect x="40" y="710" width="1000" height="160" rx="20" fill="white" filter="drop-shadow(0 2px 12px rgba(0,0,0,0.08))"/>
  <polygon points="80,760 110,743 140,760 140,794 110,811 80,794" fill="#4F46E5"/>
  <text x="110" y="783" font-family="sans-serif" font-size="20" fill="white" text-anchor="middle">👤</text>
  <text x="180" y="770" font-family="sans-serif" font-size="38" font-weight="600" fill="#1a2e3b">홍준서</text>
  <text x="180" y="815" font-family="sans-serif" font-size="30" fill="#888">7월 8일 · 만 17세</text>
  <rect x="840" y="740" width="160" height="52" rx="26" fill="#f0f0f0"/>
  <text x="920" y="773" font-family="sans-serif" font-size="26" fill="#888" text-anchor="middle">D-26</text>

  <!-- 카드 4 -->
  <rect x="40" y="895" width="1000" height="160" rx="20" fill="white" filter="drop-shadow(0 2px 12px rgba(0,0,0,0.08))"/>
  <polygon points="80,945 110,928 140,945 140,979 110,996 80,979" fill="#6B7280"/>
  <text x="110" y="968" font-family="sans-serif" font-size="20" fill="white" text-anchor="middle">👤</text>
  <text x="180" y="955" font-family="sans-serif" font-size="38" font-weight="600" fill="#1a2e3b">홍대수</text>
  <text x="180" y="1000" font-family="sans-serif" font-size="30" fill="#888">7월 19일 · 기일</text>
  <rect x="840" y="925" width="160" height="52" rx="26" fill="#f0f0f0"/>
  <text x="920" y="958" font-family="sans-serif" font-size="26" fill="#888" text-anchor="middle">D-37</text>

  <!-- 알림 설정 안내 -->
  <rect x="40" y="1120" width="1000" height="140" rx="20" fill="#eff6ff" stroke="#2AABE2" stroke-width="2"/>
  <text x="540" y="1180" font-family="sans-serif" font-size="34" fill="#2AABE2" text-anchor="middle">🔔 기념일 알림을 설정하면</text>
  <text x="540" y="1228" font-family="sans-serif" font-size="30" fill="#2AABE2" text-anchor="middle">당일, 1일 전, 3일 전, 7일 전 알림을 받을 수 있어요</text>

  <!-- 하단 네비 -->
  <rect x="0" y="1780" width="1080" height="140" fill="white"/>
  <line x1="0" y1="1780" x2="1080" y2="1780" stroke="#e2e8f0" stroke-width="2"/>
  <text x="135" y="1840" font-family="sans-serif" font-size="36" fill="#aaa" text-anchor="middle">👤</text>
  <text x="135" y="1882" font-family="sans-serif" font-size="28" fill="#aaa" text-anchor="middle">My</text>
  <text x="378" y="1840" font-family="sans-serif" font-size="36" fill="#aaa" text-anchor="middle">🔍</text>
  <text x="378" y="1882" font-family="sans-serif" font-size="28" fill="#aaa" text-anchor="middle">검색</text>
  <text x="621" y="1840" font-family="sans-serif" font-size="36" fill="#2AABE2" text-anchor="middle">📅</text>
  <text x="621" y="1882" font-family="sans-serif" font-size="28" fill="#2AABE2" text-anchor="middle">기념일</text>
  <text x="864" y="1840" font-family="sans-serif" font-size="36" fill="#aaa" text-anchor="middle">❓</text>
  <text x="864" y="1882" font-family="sans-serif" font-size="28" fill="#aaa" text-anchor="middle">도움말</text>
</svg>`;

fs.writeFileSync('screenshot_1.png', new Resvg(svg1).render().asPng());
console.log('스크린샷 1 완료');
fs.writeFileSync('screenshot_2.png', new Resvg(svg2).render().asPng());
console.log('스크린샷 2 완료');
