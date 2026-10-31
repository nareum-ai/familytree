import type { Person, Relationship } from '../types';

function esc(v: string | null | undefined): string {
  if (v == null) return '';
  return v.includes(',') ? `"${v.replace(/"/g, '""')}"` : v;
}

export const CSV_TEMPLATE = `ref,name,gender,birth_date,birth_lunar,is_root,is_deceased,death_date,death_lunar,father_ref,mother_ref,spouse_ref
P001,홍길동,male,1950-01-15,false,true,false,,,,,P002
P002,김순이,female,1953-05-20,false,false,false,,,P005,P006,P001
P003,홍철수,male,1975-03-10,false,false,false,,,P001,P002,
P004,홍영희,female,1978-07-22,false,false,false,,,P001,P002,
P005,김대복,male,1925-04-01,false,false,true,1998-03-22,false,,,P006
P006,이순자,female,1928-09-15,false,false,false,,,,,P005`;

export function exportFamilyToCSV(persons: Person[], relationships: Relationship[]): string {
  const header = 'ref,name,gender,birth_date,birth_lunar,is_root,is_deceased,death_date,death_lunar,father_ref,mother_ref,spouse_ref';

  // ref 맵: person.id → "P001" ...
  const refMap = new Map<string, string>();
  persons.forEach((p, i) => refMap.set(p.id, `P${String(i + 1).padStart(3, '0')}`));

  const rows = persons.map(p => {
    const parents = relationships
      .filter(r => r.type === 'parent_child' && r.person2_id === p.id)
      .map(r => ({ id: r.person1_id, gender: persons.find(x => x.id === r.person1_id)?.gender ?? null }));

    const father = parents.find(pa => pa.gender === 'male') ?? parents.find(pa => pa.gender == null && parents.indexOf(pa) === 0);
    const mother = parents.find(pa => pa.gender === 'female') ?? parents.find(pa => pa.gender == null && parents.indexOf(pa) === 1);

    const spouseRel = relationships.find(r =>
      r.type === 'spouse' && (r.person1_id === p.id || r.person2_id === p.id)
    );
    const spouseId = spouseRel
      ? (spouseRel.person1_id === p.id ? spouseRel.person2_id : spouseRel.person1_id)
      : null;

    return [
      refMap.get(p.id)!,
      esc(p.name),
      p.gender ?? '',
      p.birth_date ?? '',
      p.birth_lunar ? 'true' : 'false',
      p.is_root ? 'true' : 'false',
      p.is_deceased ? 'true' : 'false',
      p.death_date ?? '',
      p.death_lunar ? 'true' : 'false',
      father ? (refMap.get(father.id) ?? '') : '',
      mother ? (refMap.get(mother.id) ?? '') : '',
      spouseId ? (refMap.get(spouseId) ?? '') : '',
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

export function downloadCSV(filename: string, content: string): void {
  const BOM = '﻿'; // Excel 한글 호환 BOM
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
