// PWA 아이콘 생성 스크립트 (favicon.svg → PNG)
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../client/public/favicon.svg');
const outDir  = path.join(__dirname, '../client/public/icons');

if (!fs.existsSync(svgPath)) {
  console.error('favicon.svg not found:', svgPath);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const svg = fs.readFileSync(svgPath, 'utf-8');

for (const size of [192, 512]) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(240,247,251,1)',
  });
  const rendered = resvg.render();
  const png = rendered.asPng();
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✅ icon-${size}.png 생성 완료`);
}
