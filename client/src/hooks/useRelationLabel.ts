import { useFamilyStore } from '../store/familyStore';
import { getChusuBase } from '../utils/familyGraph';
import { getRelationLabel } from '../utils/relationLabel';

/** 현재 기준 인물(나/시점)에서 본 personId의 관계명. 본인은 '나' */
export function useRelationLabel(personId: string): string {
  const persons = useFamilyStore(s => s.persons);
  const relationships = useFamilyStore(s => s.relationships);
  const viewpointPersonId = useFamilyStore(s => s.viewpointPersonId);
  const base = getChusuBase(persons, viewpointPersonId);
  return base ? getRelationLabel(personId, base, persons, relationships) : '';
}
