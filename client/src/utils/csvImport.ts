import { v4 as uuidv4 } from 'uuid';
import type { Person, Relationship } from '../types';
import { DEFAULT_PERMISSIONS } from '../types/permissions';
import { parseKoreanName } from './nameParser';

export interface CSVRow {
  ref: string;
  name: string;
  gender: 'male' | 'female' | null;
  birth_date: string | null;
  birth_lunar: boolean;
  is_root: boolean;
  is_deceased: boolean;
  death_date: string | null;
  death_lunar: boolean;
  father_ref: string;
  mother_ref: string;
  spouse_ref: string;
  _line: number;
}

export interface ImportError {
  line: number;
  ref: string;
  message: string;
}

export interface NameMatch {
  csvRef: string;
  csvName: string;
  existingId: string;
}

// ── 파싱 ─────────────────────────────────────────────────────────────────────

export function parseCSVText(text: string): { rows: CSVRow[]; errors: ImportError[] } {
  const errors: ImportError[] = [];

  const lines = text
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n').map(l => l.trim()).filter(l => l);

  if (lines.length < 2) {
    return { rows: [], errors: [{ line: 0, ref: '', message: '데이터 행이 없습니다.' }] };
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  for (const need of ['ref', 'name']) {
    if (!headers.includes(need)) {
      errors.push({ line: 0, ref: '', message: `필수 열 '${need}'가 없습니다.` });
    }
  }
  if (errors.length) return { rows: [], errors };

  const get = (vals: string[], key: string) => {
    const idx = headers.indexOf(key);
    return idx >= 0 ? (vals[idx] ?? '').trim().replace(/^"|"$/g, '') : '';
  };

  const rows: CSVRow[] = [];
  const refSet = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    const lineNum = i + 1;
    const ref = get(vals, 'ref');

    if (!ref) { errors.push({ line: lineNum, ref: '', message: `${lineNum}행: ref가 비어있습니다.` }); continue; }
    if (refSet.has(ref)) { errors.push({ line: lineNum, ref, message: `ref '${ref}' 중복` }); continue; }
    refSet.add(ref);

    const name = get(vals, 'name');
    if (!name) errors.push({ line: lineNum, ref, message: '이름이 비어있습니다.' });

    const genderRaw = get(vals, 'gender').toLowerCase();
    const gender = genderRaw === 'male' ? 'male' : genderRaw === 'female' ? 'female' : null;
    if (genderRaw && !gender) errors.push({ line: lineNum, ref, message: `성별은 male/female 또는 빈칸` });

    const birth_date = get(vals, 'birth_date') || null;
    if (birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(birth_date))
      errors.push({ line: lineNum, ref, message: `생년월일 형식 오류: ${birth_date} (YYYY-MM-DD)` });

    const death_date = get(vals, 'death_date') || null;
    if (death_date && !/^\d{4}-\d{2}-\d{2}$/.test(death_date))
      errors.push({ line: lineNum, ref, message: `기일 형식 오류: ${death_date} (YYYY-MM-DD)` });

    rows.push({
      ref, name, gender, birth_date, birth_lunar: get(vals, 'birth_lunar') === 'true',
      is_root: get(vals, 'is_root') === 'true',
      is_deceased: get(vals, 'is_deceased') === 'true',
      death_date, death_lunar: get(vals, 'death_lunar') === 'true',
      father_ref: get(vals, 'father_ref'),
      mother_ref: get(vals, 'mother_ref'),
      spouse_ref:  get(vals, 'spouse_ref'),
      _line: lineNum,
    });
  }

  // 관계 ref 유효성
  for (const row of rows) {
    for (const [field, val] of [
      ['father_ref', row.father_ref], ['mother_ref', row.mother_ref], ['spouse_ref', row.spouse_ref],
    ] as const) {
      if (val && !refSet.has(val))
        errors.push({ line: row._line, ref: row.ref, message: `${field}: 존재하지 않는 ref '${val}'` });
    }
  }

  const rootCount = rows.filter(r => r.is_root).length;
  if (rootCount > 1)
    errors.push({ line: 0, ref: '', message: `is_root=true가 ${rootCount}개입니다. 1개만 지정하세요.` });

  return { rows, errors };
}

// ── 이름 자동 매칭 ───────────────────────────────────────────────────────────

export function detectNameMatches(rows: CSVRow[], existingPersons: Person[]): NameMatch[] {
  return rows
    .filter(row => existingPersons.some(p => p.name === row.name))
    .map(row => ({
      csvRef: row.ref,
      csvName: row.name,
      existingId: existingPersons.find(p => p.name === row.name)!.id,
    }));
}

// ── 업로드 데이터 빌드 ────────────────────────────────────────────────────────

export function buildImportData(
  rows: CSVRow[],
  familyId: string,
  createdBy: string,
  mergeMap: Map<string, string>,  // csvRef → 기존 Firestore ID
): {
  newPersonDocs: Array<{ id: string; data: Omit<Person, 'id'> }>;
  newRelDocs: Array<Omit<Relationship, 'id'>>;
} {
  const refToId = new Map<string, string>(mergeMap);
  const newPersonDocs: Array<{ id: string; data: Omit<Person, 'id'> }> = [];

  for (const row of rows) {
    if (mergeMap.has(row.ref)) continue; // 기존 인물 — 생성 스킵
    const id = uuidv4();
    refToId.set(row.ref, id);
    const { lastName, firstName } = parseKoreanName(row.name);
    newPersonDocs.push({
      id,
      data: {
        name: row.name, last_name: lastName, first_name: firstName,
        gender: row.gender,
        birth_date: row.birth_date, birth_year: row.birth_date ? parseInt(row.birth_date) : null,
        birth_lunar: row.birth_lunar,
        is_root: row.is_root ? 1 : 0,
        is_deceased: row.is_deceased,
        death_date: row.death_date, death_lunar: row.death_lunar,
        photo_url: null,
        family_id: familyId, created_by: createdBy,
        permissions: DEFAULT_PERMISSIONS,
        created_at: new Date().toISOString(),
      },
    });
  }

  // 관계 중복 방지
  const relSet = new Set<string>();
  const newRelDocs: Array<Omit<Relationship, 'id'>> = [];

  const addRel = (p1: string, p2: string, type: 'spouse' | 'parent_child') => {
    if (!p1 || !p2 || p1 === p2) return;
    const key = type === 'spouse' ? `s|${[p1, p2].sort().join('|')}` : `pc|${p1}|${p2}`;
    if (!relSet.has(key)) { relSet.add(key); newRelDocs.push({ person1_id: p1, person2_id: p2, type, family_id: familyId }); }
  };

  for (const row of rows) {
    const pid = refToId.get(row.ref);
    if (!pid) continue;
    if (row.father_ref) { const fid = refToId.get(row.father_ref); if (fid) addRel(fid, pid, 'parent_child'); }
    if (row.mother_ref) { const mid = refToId.get(row.mother_ref); if (mid) addRel(mid, pid, 'parent_child'); }
    if (row.spouse_ref) { const sid = refToId.get(row.spouse_ref);  if (sid) addRel(pid, sid, 'spouse'); }
  }

  return { newPersonDocs, newRelDocs };
}
