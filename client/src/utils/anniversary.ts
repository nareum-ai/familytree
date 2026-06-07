import type { Person, Relationship } from '../types';
import { getChusu } from '../hooks/useTreeLayout';
import { getRelationLabel } from './relationLabel';

// solarlunar ESM 동적 임포트 — 여러 export 구조 대응
type SolarLunarLib = {
  lunar2solar: (y: number, m: number, d: number, leap: boolean) => { cYear: number; cMonth: number; cDay: number };
};
let _lib: SolarLunarLib | null = null;
let _tried = false;

async function getLib(): Promise<SolarLunarLib | null> {
  if (_tried) return _lib;
  _tried = true;
  try {
    const mod = await import('solarlunar') as unknown as Record<string, Partial<SolarLunarLib> | undefined>;
    // ESM 번들 구조가 다양하므로 여러 경로 시도
    for (const candidate of [mod?.default, mod, mod?.solarlunar]) {
      if (candidate && typeof candidate.lunar2solar === 'function') {
        _lib = candidate as SolarLunarLib;
        break;
      }
    }
  } catch { /* ignore */ }
  return _lib;
}

export interface AnniversaryItem {
  personId: string;
  personName: string;
  type: '생일' | '기일' | '결혼기념일';
  originalDate: string;
  isLunar: boolean;
  nextSolarDate: Date;
  daysUntil: number;
  count?: number;
  chusu: number | null;
  relationLabel?: string; // 2촌 이하: 아버지/어머니/할아버지 등
  lunarMonthDay?: string;  // 음력 저장 시: "5/20" 형식
  solarConverted?: boolean; // 음력 → 양력 변환 성공 여부
  partnerName?: string;      // 결혼기념일: 상대방 이름
  relationshipId?: string;   // 결혼기념일: 관계 문서 ID
}

function midnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 양력 월/일 → 올해 또는 내년 날짜 */
function nextOccurrence(month: number, day: number): Date {
  const t = midnight();
  const cy = t.getFullYear();
  let d = new Date(cy, month - 1, day);
  d.setHours(0, 0, 0, 0);
  if (d < t) d = new Date(cy + 1, month - 1, day);
  return d;
}

/** 음력 월/일 → 가장 가까운 양력 날짜 (변환 실패 시 null) */
async function lunarToNextSolar(month: number, day: number): Promise<Date | null> {
  const lib = await getLib();
  if (!lib) return null;
  const cy = new Date().getFullYear();
  for (const yr of [cy - 1, cy, cy + 1]) {
    try {
      const r = lib.lunar2solar(yr, month, day, false);
      if (!r || !r.cYear || r.cYear === -1) continue;
      const d = new Date(r.cYear, r.cMonth - 1, r.cDay);
      d.setHours(0, 0, 0, 0);
      if (d >= midnight()) return d;
    } catch { continue; }
  }
  return null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

async function resolveNextDate(
  month: number, day: number, isLunar: boolean
): Promise<{ date: Date; converted: boolean }> {
  if (isLunar) {
    const converted = await lunarToNextSolar(month, day);
    if (converted) return { date: converted, converted: true };
    // 변환 실패 시 음력 월/일을 그대로 사용 (양력 변환 없음)
    return { date: nextOccurrence(month, day), converted: false };
  }
  return { date: nextOccurrence(month, day), converted: false };
}

export async function buildAnniversaries(
  persons: Person[],
  relationships: Relationship[] = [],
  chusuBasePerson?: Person,   // 뷰포인트 인물 (없으면 is_root=1 사용)
  allPersons?: Person[]       // 결혼기념일 상대방 이름 조회용 전체 목록
): Promise<AnniversaryItem[]> {
  const chusuRoot = chusuBasePerson ?? persons.find(p => p.is_root === 1) ?? persons[0];
  const lookupPersons = allPersons ?? persons;
  const t = midnight();
  const items: AnniversaryItem[] = [];

  for (const p of persons) {
    // ── 생일 (고인은 제외) ───────────────────────────────────────────────────
    if (p.birth_date && !p.is_deceased) {
      const parts = p.birth_date.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        const [by, bm, bd] = parts;
        const { date: next, converted: birthConverted } = await resolveNextDate(bm, bd, !!p.birth_lunar);
        items.push({
          personId: p.id,
          personName: p.name,
          type: '생일',
          originalDate: p.birth_date,
          isLunar: !!p.birth_lunar,
          nextSolarDate: next,
          daysUntil: daysBetween(t, next),
          count: next.getFullYear() - by,
          chusu: chusuRoot ? getChusu(p.id, chusuRoot, relationships) : null,
          relationLabel: chusuRoot
            ? (getRelationLabel(p.id, chusuRoot, persons, relationships) || undefined)
            : undefined,
          lunarMonthDay: p.birth_lunar ? `${bm}.${bd}` : undefined,
          solarConverted: p.birth_lunar ? birthConverted : undefined,
        });
      }
    }

    // ── 기일: is_deceased 체크 OR death_date 있으면 표시 ─────────────────────
    if ((p.is_deceased || p.death_date) && p.death_date) {
      const parts = p.death_date.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        const [dy, dm, dd] = parts;
        const { date: next, converted: deathConverted } = await resolveNextDate(dm, dd, !!p.death_lunar);
        const chusu = chusuRoot ? getChusu(p.id, chusuRoot, relationships) : null;
        items.push({
          personId: p.id,
          personName: p.name,
          type: '기일',
          originalDate: p.death_date,
          isLunar: !!p.death_lunar,
          nextSolarDate: next,
          daysUntil: daysBetween(t, next),
          count: next.getFullYear() - dy,
          chusu,
          relationLabel: chusuRoot
            ? (getRelationLabel(p.id, chusuRoot, persons, relationships) || undefined)
            : undefined,
          lunarMonthDay: p.death_lunar ? `${dm}.${dd}` : undefined,
          solarConverted: p.death_lunar ? deathConverted : undefined,
        });
      }
    }
  }

  // ── 결혼기념일 ────────────────────────────────────────────────────────────
  const seenRels = new Set<string>();
  for (const rel of relationships) {
    if (rel.type !== 'spouse' || !rel.marriage_date) continue;
    if (seenRels.has(rel.id)) continue;
    seenRels.add(rel.id);

    const parts = rel.marriage_date.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) continue;
    const [my, mm, md] = parts;

    const p1 = lookupPersons.find(p => p.id === rel.person1_id);
    const p2 = lookupPersons.find(p => p.id === rel.person2_id);
    if (!p1 || !p2) continue;

    const { date: next, converted } = await resolveNextDate(mm, md, !!rel.marriage_lunar);
    items.push({
      personId: rel.person1_id,
      personName: `${p1.name} · ${p2.name}`,
      type: '결혼기념일',
      originalDate: rel.marriage_date,
      isLunar: !!rel.marriage_lunar,
      nextSolarDate: next,
      daysUntil: daysBetween(t, next),
      count: next.getFullYear() - my,
      chusu: null,
      partnerName: p2.name,
      relationshipId: rel.id,
      lunarMonthDay: rel.marriage_lunar ? `${mm}.${md}` : undefined,
      solarConverted: rel.marriage_lunar ? converted : undefined,
    });
  }

  return items.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function formatDate(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
