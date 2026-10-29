"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGeneration = getGeneration;
// client/src/utils/familyGraph.ts getGeneration 과 동일 (양수 = 기준보다 윗세대)
function getGeneration(personId, root, relationships) {
    var _a;
    const visited = new Map([[root.id, 0]]);
    const queue = [{ id: root.id, gen: 0 }];
    const visit = (id, gen) => {
        if (visited.has(id))
            return;
        visited.set(id, gen);
        queue.push({ id, gen });
    };
    while (queue.length > 0) {
        const { id: curr, gen } = queue.shift();
        for (const r of relationships) {
            if (r.type === 'parent_child') {
                if (r.person2_id === curr)
                    visit(r.person1_id, gen + 1);
                if (r.person1_id === curr)
                    visit(r.person2_id, gen - 1);
            }
            if (r.type === 'spouse') {
                if (r.person1_id === curr)
                    visit(r.person2_id, gen);
                if (r.person2_id === curr)
                    visit(r.person1_id, gen);
            }
        }
    }
    return (_a = visited.get(personId)) !== null && _a !== void 0 ? _a : 0;
}
//# sourceMappingURL=generation.js.map