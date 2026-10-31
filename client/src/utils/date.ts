const pad2 = (n: number) => String(n).padStart(2, '0');

/** 오늘 날짜 "YYYY-MM-DD" (기기 로컬 시간 기준) */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "YYYY-MM-DD" → "YYYY.MM.DD" (+ 음력 표시) */
export function formatDotDate(d: string, lunar: boolean): string;
export function formatDotDate(d: string | null, lunar: boolean): string | null;
export function formatDotDate(d: string | null, lunar: boolean): string | null {
  if (!d) return null;
  return `${d.replace(/-/g, '.')}${lunar ? ' (음력)' : ''}`;
}

/** ISO → "YYMMDD HH:mm" (관리자 화면용 축약 표기) */
export function formatCompactDateTime(iso: string, withTime = true): string {
  const d = new Date(iso);
  const date = `${String(d.getFullYear()).slice(2)}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  return withTime ? `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : date;
}
