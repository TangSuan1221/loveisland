// 亲属图 + 血缘标签推导（SPEC §6.7 B）。
// 设计决策：血缘类是【客观事实】，由家庭图结构推导，不由事件概率决定（铁律 10）。
// 这里是纯函数，World 通过 this.family / this.rel / this.npcs 调用；遍历顺序与参考实现完全一致。
import { KIN_TAGS } from './constants.ts';
import type { Family, Npc, Relation } from './types.ts';

export function newFamily(): Family {
  return { parents: new Map(), children: new Map() };
}

export function linkParent(family: Family, p: number | null | undefined, c: number | null | undefined): void {
  if (p == null || c == null || p === c) return;
  if (!family.parents.has(c)) family.parents.set(c, new Set());
  family.parents.get(c)!.add(p);
  if (!family.children.has(p)) family.children.set(p, new Set());
  family.children.get(p)!.add(c);
}

/** 无向血缘距离（只走父子边），超过 maxDepth 视为无血缘 */
export function bloodDistance(family: Family, a: number, b: number, maxDepth = 4): number {
  if (a === b) return 0;
  const q: Array<[number, number]> = [[a, 0]];
  const seen = new Set<number>([a]);
  while (q.length) {
    const [x, d] = q.shift()!;
    if (d >= maxDepth) continue;
    const nb = new Set<number>();
    for (const p of family.parents.get(x) ?? []) nb.add(p);
    for (const c of family.children.get(x) ?? []) nb.add(c);
    for (const y of nb) {
      if (y === b) return d + 1;
      if (!seen.has(y)) { seen.add(y); q.push([y, d + 1]); }
    }
  }
  return Infinity;
}

/**
 * P1-3 · 真正的血缘：两人共享至少一个祖先（含一方是另一方的祖先），深度上限 maxDepth 代。
 * 与 bloodDistance 的区别：bloodDistance 是无向 BFS，夫妻经共同子女相连（距离 2）会被误判为"有血缘"。
 */
export function sharesAncestry(family: Family, a: number, b: number, maxDepth = 4): boolean {
  if (a === b) return true;
  const anc = (x: number) => {
    const out = new Set<number>([x]);
    let frontier = [x];
    for (let d = 0; d < maxDepth && frontier.length; d++) {
      const next: number[] = [];
      for (const y of frontier) for (const p of family.parents.get(y) ?? []) if (!out.has(p)) { out.add(p); next.push(p); }
      frontier = next;
    }
    return out;
  };
  const A = anc(a);
  for (const y of anc(b)) if (A.has(y)) return true;
  return false;
}

type RelOf = (a: number, b: number) => Relation | null;

/** 重算血缘派生标签：Parent / Child / GrandParent / GrandChild / BrotherSister(Older|Younger) / Relative */
export function recomputeKinship(family: Family, rel: Map<string, Relation>, npcs: readonly Npc[], relOf: RelOf): void {
  for (const [, r] of rel) for (const t of KIN_TAGS) r.tags.delete(t);

  const has = (m: Map<number, Set<number>>, k: number, v: number) => (m.get(k) ?? new Set<number>()).has(v);
  for (const a of npcs) {
    for (const b of npcs) {
      if (a.id === b.id) continue;
      const r = relOf(a.id, b.id);
      if (!r) continue;
      // 亲子：正向 Parent，反向 Child
      if (has(family.children, a.id, b.id)) { r.tags.add('Parent'); continue; }
      if (has(family.parents, a.id, b.id)) { r.tags.add('Child'); continue; }
      // 祖孙：正向 GrandParent（我→我的孙），反向 GrandChild（我→我的祖）
      let grand = false;
      for (const c of family.children.get(a.id) ?? []) {
        if (has(family.children, c, b.id)) { grand = true; break; }
      }
      if (grand) { r.tags.add('GrandParent'); continue; }
      let grandChild = false;
      for (const p of family.parents.get(a.id) ?? []) {
        if (has(family.children, b.id, p)) { grandChild = true; break; }
      }
      if (grandChild) { r.tags.add('GrandChild'); continue; }
      // 同胞：共享至少一个亲代
      let sibling = false;
      for (const p of family.parents.get(a.id) ?? []) {
        if (has(family.parents, b.id, p)) { sibling = true; break; }
      }
      if (sibling) {
        r.tags.add(a.born <= b.born ? 'BrotherSisterOlder' : 'BrotherSisterYounger');
        continue;
      }
      // 其他血缘
      if (bloodDistance(family, a.id, b.id, 4) !== Infinity) r.tags.add('Relative');
    }
  }
}

/** Other = "选择的家人"：无血缘但 Bond ≥ 180。需随 Bond 变化动态维护。 */
export function updateOtherTag(npcs: readonly Npc[], relOf: RelOf): void {
  for (const a of npcs) {
    for (const b of npcs) {
      if (a.id === b.id) continue;
      const r = relOf(a.id, b.id);
      if (!r) continue;
      const hasKin = KIN_TAGS.some(t => r.tags.has(t));
      if (!hasKin && r.bond >= 180) r.tags.add('Other');
      else if (hasKin) r.tags.delete('Other');
    }
  }
}
