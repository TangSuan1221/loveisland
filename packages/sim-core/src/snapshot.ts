// 渲染层快照（SPEC §11.2）：纯 SoA typed arrays，只读，禁止对象数组。
// 每次调用分配新 ArrayBuffer → 可整体作为 Transferable 投递（见 transferList）。
// 渲染层拿到快照后绝不能反向写 World（铁律 12）。
import { leisureScene } from './needs.ts';
import { BEHAVIOR_INDEX, JOB_INDEX, RESOURCE_KEYS, TAG_BITS } from './constants.ts';
import type { Npc, PendingScene, Relation, Scene, Site, Snapshot } from './types.ts';

/** buildSnapshot 只依赖 World 的这些只读成员（避免循环 import） */
export interface SnapshotSource {
  tick: number; day: number; hour: number; seasonIdx: number;
  fireActive: boolean; griefDays: number;
  store: Record<string, number>;
  npcs: Npc[];
  feelings: Array<{ name: string }>;
  sceneIndex: Map<string, Scene>;
  pendingScene: PendingScene | null;
  sites: Site[];
  relOf(a: number, b: number): Relation | null;
  tierIndexOf(bond: number): number;
  ageOf(n: Npc): number;
  isElder(n: Npc): boolean;
  policy: { managerStrain: number; rationPerPerson: number; winterPrep: boolean; favor: Set<number> };
  maxDays: number;
}

const TAG_MASK = new Map<string, number>(TAG_BITS.map((t, i) => [t, 1 << i]));
const JOB_IDX = new Map<string, number>(JOB_INDEX.map((j, i) => [j, i]));

export function buildSnapshot(w: SnapshotSource): Snapshot {
  const scene=w.pendingScene;
  const acting=new Set(scene && leisureScene(w.sceneIndex.get(scene.sceneId)?.cat??'',scene.sceneId) ? scene.participants : []);
  const npcs = w.npcs;
  const n = npcs.length;
  const feelingIdx = new Map<string, number>(w.feelings.map((f, i) => [f.name, i]));

  const store = new Float32Array(RESOURCE_KEYS.length);
  RESOURCE_KEYS.forEach((k, i) => { store[i] = w.store[k] ?? 0; });

  const id = new Uint8Array(n), alive = new Uint8Array(n);
  const posX = new Float32Array(n), posY = new Float32Array(n);
  const satiety = new Float32Array(n), hydration = new Float32Array(n), rest = new Float32Array(n);
  const warmth = new Float32Array(n), health = new Float32Array(n);
  const feeling = new Uint8Array(n), job = new Uint8Array(n);
  const age = new Float32Array(n), elder = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const p = npcs[i];
    id[i] = p.id;
    alive[i] = p.alive ? 1 : 0;
    satiety[i] = p.stocks.Satiety;
    hydration[i] = p.stocks.Hydration;
    rest[i] = p.stocks.Rest;
    warmth[i] = p.stocks.Warmth;
    health[i] = p.stocks.Health;
    feeling[i] = feelingIdx.get(p.feeling) ?? 0;
    job[i] = JOB_IDX.get(p.job) ?? 0;
    age[i] = w.ageOf(p);
    elder[i] = w.isElder(p) ? 1 : 0;
  }

  // 稀疏边表：只含双方都存活的有向边。先数再分配，避免过量内存
  let m = 0;
  for (const a of npcs) if (a.alive) for (const b of npcs) if (b.alive && a.id !== b.id && w.relOf(a.id, b.id)) m++;
  const edgeFrom = new Uint8Array(m), edgeTo = new Uint8Array(m);
  const edgeBond = new Float32Array(m), edgeStrain = new Float32Array(m);
  const edgeTier = new Uint8Array(m), edgeTags = new Uint32Array(m);
  let e = 0;
  for (const a of npcs) {
    if (!a.alive) continue;
    for (const b of npcs) {
      if (!b.alive || a.id === b.id) continue;
      const r = w.relOf(a.id, b.id);
      if (!r) continue;
      edgeFrom[e] = a.id;
      edgeTo[e] = b.id;
      edgeBond[e] = r.bond;
      edgeStrain[e] = r.strain;
      edgeTier[e] = w.tierIndexOf(r.bond);
      let mask = 0;
      for (const t of r.tags) mask |= TAG_MASK.get(t) ?? 0;
      edgeTags[e] = mask >>> 0;
      e++;
    }
  }

  return {
    tick: w.tick, day: w.day, hour: w.hour, seasonIdx: w.seasonIdx,
    fireActive: w.fireActive, griefDays: w.griefDays,
    store, count: n, id, alive, posX, posY,
    currentTarget: Int16Array.from(npcs,p=>p.survival?.target??-1),
    currentTier: Uint8Array.from(npcs,p=>acting.has(p.id)?60:Number((p.survival?.tier??'M10').slice(1))),
    currentBehavior: Uint8Array.from(npcs,p=>BEHAVIOR_INDEX.indexOf(acting.has(p.id)?'Scene':p.survival?.behavior??p.job)),
    satiety, hydration, rest, warmth, health, feeling, job, age, elder,
    edgeCount: m, edgeFrom, edgeTo, edgeBond, edgeStrain, edgeTier, edgeTags,
    ...pendingFields(w),
    ...siteFields(w),
    managerStrain: w.policy.managerStrain,
    rationPerPerson: w.policy.rationPerPerson,
    winterPrep: w.policy.winterPrep,
    favor: Uint8Array.from(npcs, p => (w.policy.favor.has(p.id) ? 1 : 0)),
    maxDays: w.maxDays,
  };
}

const SITE_STATE = { unknown: 0, known: 1, depleted: 2 } as const;
const RES_IDX = new Map<string, number>(RESOURCE_KEYS.map((k, i) => [k, i]));

function siteFields(w: SnapshotSource) {
  const k = w.sites.length;
  const siteX = new Float32Array(k), siteY = new Float32Array(k), siteFill = new Float32Array(k);
  const siteResource = new Uint8Array(k), siteState = new Uint8Array(k);
  w.sites.forEach((s, i) => {
    siteX[i] = s.x; siteY[i] = s.y;
    siteResource[i] = RES_IDX.get(s.resource) ?? 0;
    siteState[i] = SITE_STATE[s.state];
    siteFill[i] = s.capacity > 0 ? s.stock / s.capacity : 0;
  });
  return { siteCount: k, siteX, siteY, siteResource, siteState, siteFill };
}

function pendingFields(w: SnapshotSource) {
  const p = w.pendingScene;
  if (!p) return { pendingSceneIdx: -1, pendingBranchIdx: -1, pendingF: -1, pendingT: -1, pendingA: -1 };
  let si = 0, bi = -1;
  for (const [id, sc] of w.sceneIndex) {
    if (id === p.sceneId) { bi = sc.branches.findIndex(b => b.branch === p.branchId); break; }
    si++;
  }
  return { pendingSceneIdx: bi < 0 ? -1 : si, pendingBranchIdx: bi, pendingF: p.focus, pendingT: p.target, pendingA: p.another ?? -1 };
}

/** 快照内所有 typed array 的底层 buffer（postMessage(snap, transferList(snap))） */
export function transferList(s: Snapshot): ArrayBuffer[] {
  const out: ArrayBuffer[] = [];
  for (const v of Object.values(s)) {
    if (ArrayBuffer.isView(v)) out.push(v.buffer as ArrayBuffer);
  }
  return out;
}
