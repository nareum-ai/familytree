// 한국어 이름 → 성/이름 분리
// 복성(2자 성씨) 우선 체크 후, 기본은 첫 글자 = 성

const TWO_CHAR_SURNAMES = new Set([
  '남궁', '선우', '황보', '독고', '제갈', '사공', '동방',
  '서문', '장곡', '소봉', '어금', '망절', '무본', '연주',
]);

// 성씨 없이 이름 전체로 저장할 단어들 (임시 등록명, 가명 등)
const SINGLE_UNIT_NAMES = new Set(['임시', '미상', '불명', '익명']);

export function parseKoreanName(fullName: string): { lastName: string; firstName: string } {
  const name = fullName.trim();
  if (!name) return { lastName: '', firstName: '' };

  // 성씨 없이 전체를 이름으로 저장
  if (SINGLE_UNIT_NAMES.has(name)) {
    return { lastName: '', firstName: name };
  }

  // 2자 복성 체크 (이름 4자 이상일 때)
  if (name.length >= 3) {
    const prefix2 = name.slice(0, 2);
    if (TWO_CHAR_SURNAMES.has(prefix2)) {
      return { lastName: prefix2, firstName: name.slice(2) };
    }
  }

  // 기본: 첫 글자 = 성, 나머지 = 이름
  if (name.length >= 2) {
    return { lastName: name[0], firstName: name.slice(1) };
  }

  // 1글자: 이름만
  return { lastName: '', firstName: name };
}
