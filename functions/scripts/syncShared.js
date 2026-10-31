// client/src/utils/relationLabel.ts 를 Functions 로 복사 — 관계명 로직을 클라이언트와 한 곳에서 관리
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../../client/src/utils/relationLabel.ts');
const dst = path.join(__dirname, '../src/shared/relationLabel.ts');

const code = fs.readFileSync(src, 'utf8')
  .replace("import type { Person, Relationship } from '../types';", "import type { Person, Relationship } from './types';")
  .replace("import { getGeneration } from './familyGraph';", "import { getGeneration } from './generation';");

fs.writeFileSync(dst, '// 자동 생성 파일 — 수정은 client/src/utils/relationLabel.ts 에서\n' + code);
