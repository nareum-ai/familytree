import type { Person, Relationship } from './types';

// client/src/utils/familyGraph.ts getGeneration 과 동일 (양수 = 기준보다 윗세대)
export function getGeneration(personId: string, root: Person, relationships: Relationship[]): number {
  const visited = new Map<string, number>([[root.id, 0]]);
  const queue: Array<{ id: string; gen: number }> = [{ id: root.id, gen: 0 }];
  const visit = (id: string, gen: number) => {
    if (visited.has(id)) return;
    visited.set(id, gen);
    queue.push({ id, gen });
  };

  while (queue.length > 0) {
    const { id: curr, gen } = queue.shift()!;
    for (const r of relationships) {
      if (r.type === 'parent_child') {
        if (r.person2_id === curr) visit(r.person1_id, gen + 1);
        if (r.person1_id === curr) visit(r.person2_id, gen - 1);
      }
      if (r.type === 'spouse') {
        if (r.person1_id === curr) visit(r.person2_id, gen);
        if (r.person2_id === curr) visit(r.person1_id, gen);
      }
    }
  }
  return visited.get(personId) ?? 0;
}
