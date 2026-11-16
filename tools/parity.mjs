// tools/parity.mjs —— P0-2 等价性证明：旧 sim/world.mjs vs 新 packages/sim-core 逐字段比对
// 用法：node tools/parity.mjs        → 输出 PARITY OK（exit 0）或第一处差异（exit 1）
//
// 比对内容（每个 seed × 情景）：
//   report() 全部字段（dailyStats 全文、alive、deathCauses、deaths、scenesByCat、tierDist、log、rngSeed…）
//   sceneLog 全文、births、每条关系边的 bond/strain/tags、每个 NPC 的完整状态、store、policy
// 另外验证：存读档穿越（旧档→新读 / 新档→旧读）、玩家指令序列、tickOnce() 与 run() 逐 tick 等价。
//
// ★ P1-2 起 sim-core 有意改变了规则（资源点位 + 探索场景），与冻结的参考实现不再等价。
//   对照方式：用「P1-2 关闭」的数据注入跑 sim-core —— 去掉点位表、Explore 类别与其场景、
//   探索新增的记忆 → 规则退化为 P1-1，必须与参考实现逐字段相等。
//   这证明 P1-2 的改动是「加法」：关掉它，其余数值语义一个字都没变。
// ★ P1-3 起再加 aging:false（开局年龄不打散、无年龄效果、人口上限按历史总人数），同理证明衰老是「加法」。
import { World as Old } from '../sim/world.mjs';
import { World as NewRaw, DATA } from '../packages/sim-core/src/index.ts';

const P12_OFF = {
  ...DATA,
  sites: [],
  categories: DATA.categories.filter(c => c.gate_mode !== 'has_unknown_site'),
  scenes: DATA.scenes.filter(s => s.category !== 'Explore' && s.scene_id !== 'S78_find_grove')
    // P1-3：告白条件 romance_ok（禁血亲）在旧规则里是 bond_ge_160
    .map(s => (s.scene_cond === 'romance_ok' ? { ...s, scene_cond: 'bond_ge_160' } : s)),
};
class New extends NewRaw {
  constructor(opts = {}) { super({ data: P12_OFF, aging: false, ...opts }); }
  static load(s, data) { return NewRaw.load(s, data ?? P12_OFF); }
}

const SEEDS = [20260101, 777, 31337, 424242, 999, 1, 2, 3];
const SCENARIOS = [
  ['丰年', {}],
  ['无冬储', { winterPrep: false }],
  ['偏袒', { favor: [0, 1, 2, 3] }],
  ['饥荒', { startScale: 0.15 }],
  ['疫病', { workforceScale: 0.3 }],
  ['部分', { workforceScale: 0.85 }],
  ['冬荒', { startScale: 0.55, workforceScale: 0.85 }],
  ['极端', { startScale: 1.6, winterPrep: false }],
  ['配给0', { ration: 0, days: 30 }],
  ['小岛', { npcCount: 5 }],
];

/** 把 World 状态规范化成可 JSON 比较的纯数据（Set/Map 展开，排除 savedAt 等墙钟字段） */
function canon(w, rep) {
  return {
    report: rep,
    sceneLog: w.sceneLog,
    births: w.births,
    store: w.store,
    policy: { ...w.policy, favor: [...w.policy.favor] },
    griefDays: w.griefDays, fireActive: w.fireActive, filteredScenes: w.filteredScenes,
    rationHistory: w.rationHistory,
    jobDemand: w.jobDemand ?? null,
    npcs: w.npcs.map(n => ({ ...n, lastScoreMap: undefined })),
    rel: [...w.rel.entries()].map(([k, r]) => [k, r.bond, r.strain, [...r.tags]]),
    family: [[...w.family.parents].map(([k, v]) => [k, [...v]]), [...w.family.children].map(([k, v]) => [k, [...v]])],
    rng: w.rng.s.toString(),
  };
}

function firstDiff(a, b, path = '') {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    return `${path || '<root>'}: old=${JSON.stringify(a)?.slice(0, 120)} new=${JSON.stringify(b)?.slice(0, 120)}`;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: 数组/对象类型不同`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (a[k] === undefined && b[k] === undefined) continue;
    const d = firstDiff(a[k], b[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}

let cases = 0, fails = 0;
const fail = (label, d) => { fails++; console.log(`  ❌ ${label}\n     ${d}`); };

// ── 1. 情景 × 种子：run() 全量比对 ──
for (const seed of SEEDS) {
  for (const [name, opts] of SCENARIOS) {
    const o = new Old({ days: 60, seed, npcCount: 12, ...opts });
    const n = new New({ days: 60, seed, npcCount: 12, ...opts });
    const d = firstDiff(canon(o, o.run()), canon(n, n.run()));
    cases++;
    if (d) fail(`seed=${seed} ${name}`, d);
  }
}

// ── 2. 存读档交叉 ──
// P1-1 起 sim-core 的存档多了 dayState/trouble/pendingScene，读档时关系 Map 按真实插入序重建
// （参考实现读档后键序错乱 → 日内存档会分叉，这是 P1-1 要修的缺陷之一）。所以这里比的是：
//   a) 两边 save() 去掉 P1-1 新键后逐字段相同（存档主体格式未变，旧实现仍能读新档）
//   b) 新 load ≡ 不间断运行（逐字段，含 rel 键序）—— 比参考实现的 load 更严格
//   c) 旧实现读新存档不崩，且 RNG / 关系总量与不间断运行一致（参考实现自身的保证水平）
const strip = s => {
  const c = JSON.parse(JSON.stringify(s)); c.meta.savedAt = 0;
  delete c.dayState; delete c.trouble; delete c.pendingScene;
  delete c.sites;   // P1-2 新键
  delete c.meta.aging; delete c.meta.maxNpc;   // P1-3 新键
  for (const n of c.npcs ?? []) delete n.scoutRestUntil;
  return c;
};
const relSum = w => { let b = 0, s = 0; for (const r of w.rel.values()) { b += r.bond; s += r.strain; } return `${b}/${s}`; };
for (const seed of [424242, 7]) {
  const step = (w, k) => { for (let i = 0; i < k; i++) { w.step(); w.tick++; } };
  const o = new Old({ days: 120, seed }), n = new New({ days: 120, seed });
  step(o, 24 * 20); step(n, 24 * 20);
  const rawN = JSON.parse(JSON.stringify(n.save()));
  const so = strip(o.save()), sn = strip(rawN);
  let d = firstDiff(so, sn); cases++;
  if (d) fail(`seed=${seed} save() 主体`, d);
  const no = New.load(rawN), on = Old.load(rawN);
  step(no, 24 * 15); step(on, 24 * 15); step(o, 24 * 15); step(n, 24 * 15);
  d = firstDiff(canon(n, null), canon(no, null)); cases++;   // report 含 dailyStats（不进存档），故传 null
  if (d) fail(`seed=${seed} 新 load ≡ 不间断运行 +15 天`, d);
  d = firstDiff([o.rng.s.toString(), relSum(o), o.alive.length], [on.rng.s.toString(), relSum(on), on.alive.length]); cases++;
  if (d) fail(`seed=${seed} 旧实现读新存档 +15 天`, d);
}

// ── 3. 玩家指令序列（含 mediate/exile/assignJob 的 RNG 与状态影响）──
{
  const cmds = [
    [0, { type: 'setRation', value: 0.8 }], [3, { type: 'setFavor', ids: [1, 4] }],
    [5, { type: 'assignJob', npcId: 6, job: 'firewood' }], [8, { type: 'mediate', a: 2, b: 3 }],
    [9, { type: 'mediate', a: 2, b: 3 }], [12, { type: 'setWinterPrep', value: false }],
    [20, { type: 'exileVote', targetId: 11 }], [33, { type: 'setWorkforceScale', value: 0.7 }],
    [40, { type: 'nonsense' }],
  ];
  const drive = W => {
    const w = new W({ days: 60, seed: 4242 }); const res = [];
    for (w.tick = 0; w.tick < 60 * 24; w.tick++) {
      for (const [d, c] of cmds) if (w.day === d && w.hour === 7) res.push(w.applyCommand(c));
      w.step(); if (!w.alive.length) break;
    }
    return { res, state: canon(w, w.report()) };
  };
  const d = firstDiff(drive(Old), drive(New)); cases++;
  if (d) fail('玩家指令序列', d);
}

// ── 4. tickOnce() 逐 tick 推进 ≡ run() ──
for (const opts of [{}, { workforceScale: 0.3 }]) {
  const a = new New({ days: 60, seed: 99, ...opts }); const ra = a.run();
  const b = new New({ days: 60, seed: 99, ...opts }); while (b.tickOnce());
  const d = firstDiff(canon(a, ra), canon(b, b.report())); cases++;
  if (d) fail(`tickOnce ≡ run ${JSON.stringify(opts)}`, d);
}

// ── 5. snapshot() 是 SoA typed arrays，且与对象状态一致 ──
{
  const w = new New({ days: 60, seed: 5 });
  for (let i = 0; i < 24 * 30; i++) w.tickOnce();
  const s = w.snapshot();
  const arrays = Object.entries(s).filter(([, v]) => typeof v === 'object');
  const allTyped = arrays.every(([, v]) => ArrayBuffer.isView(v));
  const aliveEdges = w.alive.length * (w.alive.length - 1);
  let ok = allTyped && s.count === w.npcs.length && s.edgeCount === aliveEdges;
  for (let e = 0; ok && e < s.edgeCount; e++) {
    const r = w.relOf(s.edgeFrom[e], s.edgeTo[e]);
    ok = Math.fround(r.bond) === s.edgeBond[e] && Math.fround(r.strain) === s.edgeStrain[e]
      && w.ladder[s.edgeTier[e]].tier === w.tierOf(r.bond).tier;
  }
  for (let i = 0; ok && i < s.count; i++) ok = Math.fround(w.npcs[i].stocks.Health) === s.health[i];
  cases++;
  if (!ok) fail('snapshot SoA', `typed=${allTyped} count=${s.count} edges=${s.edgeCount}/${aliveEdges}`);
}

console.log(`\n${cases} 组比对，${fails} 处不等`);
if (fails) { console.log('PARITY FAIL'); process.exit(1); }
console.log('PARITY OK');
