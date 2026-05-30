export function getManAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

/** 사망 당시 나이 (향년) */
export function getAgeAtDeath(birthDate: string, deathDate: string): number | null {
  if (!birthDate || !deathDate) return null;
  const birth = new Date(birthDate);
  const death = new Date(deathDate);
  if (isNaN(birth.getTime()) || isNaN(death.getTime())) return null;
  let age = death.getFullYear() - birth.getFullYear();
  const m = death.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && death.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

