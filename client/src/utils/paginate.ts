/** 목록을 페이지 단위로 자른 결과 (목록이 줄어 page가 범위를 넘으면 마지막 페이지로) */
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.ceil(items.length / pageSize);
  const current = Math.min(page, Math.max(0, totalPages - 1));
  return {
    current,
    pageItems: items.slice(current * pageSize, (current + 1) * pageSize),
    totalPages,
  };
}
