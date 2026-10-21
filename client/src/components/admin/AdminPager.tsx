/** 페이지 번호 목록 — 7페이지 초과 시 현재 페이지 주변만 표시하고 나머지는 … */
function pageItems(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const pages: (number | '…')[] = [0];
  if (current > 2) pages.push('…');
  for (let i = Math.max(1, current - 1); i <= Math.min(total - 2, current + 1); i++) pages.push(i);
  if (current < total - 3) pages.push('…');
  pages.push(total - 1);
  return pages;
}

export function AdminPager({ current, total, onChange }: {
  current: number; total: number; onChange: (p: number) => void;
}) {
  if (total <= 1) return null;

  return (
    <div className="member-pagination">
      <button disabled={current === 0} onClick={() => onChange(current - 1)}>‹</button>
      {pageItems(current, total).map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className="pager-ellipsis">…</span>
          : <button key={p} className={p === current ? 'pager-active' : ''} onClick={() => onChange(p)}>
              {p + 1}
            </button>
      )}
      <button disabled={current >= total - 1} onClick={() => onChange(current + 1)}>›</button>
    </div>
  );
}
