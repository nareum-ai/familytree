import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useFamilyStore } from '../store/familyStore';
import { getCurrentUserName } from '../lib/storageKeys';
import { canSeeFull, classifyBranch, findRoot, getAccessibleBranches } from '../utils/familyGraph';

/**
 * 현재 뷰포인트에서 볼 수 있는 인물 — 접근 가능한 브랜치에 속하고 비공개가 아닌 사람.
 * (검색·기념일 목록 공통)
 */
export function useVisiblePersons() {
  const { persons, relationships, viewpointPersonId, grantedPersonIds, tempUnlockAll } = useFamilyStore(
    useShallow(s => ({
      persons: s.persons, relationships: s.relationships, viewpointPersonId: s.viewpointPersonId,
      grantedPersonIds: s.grantedPersonIds, tempUnlockAll: s.tempUnlockAll,
    }))
  );
  const currentUserName = getCurrentUserName();

  const accessibleBranches = useMemo(
    () => getAccessibleBranches(persons, relationships, viewpointPersonId),
    [persons, relationships, viewpointPersonId]
  );

  const visiblePersons = useMemo(() => {
    const root = findRoot(persons);
    return persons.filter(p =>
      classifyBranch(p.id, persons, relationships).some(b => accessibleBranches.includes(b)) &&
      canSeeFull(p, currentUserName, viewpointPersonId, root, grantedPersonIds, relationships, tempUnlockAll)
    );
  }, [persons, relationships, accessibleBranches, currentUserName, viewpointPersonId, grantedPersonIds, tempUnlockAll]);

  return { persons, relationships, viewpointPersonId, accessibleBranches, visiblePersons };
}
