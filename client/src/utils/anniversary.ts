import type { Person, Relationship } from '../types';
import { getChusu } from '../hooks/useTreeLayout';
import { getRelationLabel } from './relationLabel';

// solarlunar ESM 동적 임포트 — 여러 export 구조 대응
type SolarLunarLib = {
  lunar2solar: (y: number, m: number, d: number, leap: boolean) => { sYear: number; sMonth: number; sDay: number };
};
let _lib: SolarLunarLib | null = null;
let _tried = false;

async function getLib(): Promise<SolarLunarLib | null> {
  if (_tried) return _lib;
  _tried = true;
  try {
    const mod = await import('solarlunar') as any;
    const candidate = mod?.default ?? mod;
    if (typeof candidate?.lunar2solar === 'function') {
      _lib = candidate as SolarLunarLib;
    }
  } catch { /* ignore */ }
  return _lib;
}

export interface AnniversaryItem {
  personId: string;
  personName: string;
  type: '생일' | '기일';
  originalDate: string;
  isLunar: boolean;
  nextSolarDate: Date;
  daysUntil: number;
  count?: number;
  chusu: number | null;
  relationLabel?: string; // 2촌 이하: 아버지/어머니/할아버지 등
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
      if (!r || r.sYear === -1 || !r.sYear) continue;
      const d = new Date(r.sYear, r.sMonth - 1, r.sDay);
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
): Promise<Date> {
  if (isLunar) {
    const converted = await lunarToNextSolar(month, day);
    if (converted) return converted;
    // 변환 실패 시 음력 월/일을 양력으로 근사 처리 (오차 있을 수 있음)
  }
  return nextOccurrence(month, day);
}

export async function buildAnniversaries(
  persons: Person[],
  relationships: Relationship[] = [],
  chusuBasePerson?: Person   // 뷰포인트 인물 (없으면 is_root=1 사용)
): Promise<AnniversaryItem[]> {
  const chusuRoot = chusuBasePerson ?? persons.find(p => p.is_root === 1) ?? persons[0];
  const t = midnight();
  const items: AnniversaryItem[] = [];

  for (const p of persons) {
    // ── 생일 (고인은 제외) ───────────────────────────────────────────────────
    if (p.birth_date && !p.is_deceased) {
      const parts = p.birth_date.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        const [by, bm, bd] = parts;
        const next = await resolveNextDate(bm, bd, !!p.birth_lunar);
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
        });
      }
    }

    // ── 기일: is_deceased 체크 OR death_date 있으면 표시 ─────────────────────
    if ((p.is_deceased || p.death_date) && p.death_date) {
      const parts = p.death_date.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        const [dy, dm, dd] = parts;
        const next = await resolveNextDate(dm, dd, !!p.death_lunar);
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
        });
      }
    }
  }

  return items.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
