// 关系标签覆盖验证：证明 15 个类型标签全部会真实出现（而不是表里有、代码不用）
import { World } from './sim.mjs';

const ALL_TAGS = [
  'Know', 'Friend', 'ExFriend', 'Lover', 'ExLover', 'Couple',
  'Parent', 'Child', 'GrandParent', 'GrandChild',
  'BrotherSisterOlder', 'BrotherSisterYounger', 'Relative', 'Other', 'Divorce',
  'Debtor', 'Creditor', 'Suspect',
];
// 前 15 个是 Tomodachi 原版标签，后 3 个是本作生存扩展
const CORE15 = ALL_TAGS.slice(0, 15);

const SEEDS = [20260101, 777, 31337, 424242, 999, 1, 41, 42, 43];
// ★ 必须跑混合情景：生存类标签（Debtor/Creditor/Suspect）只在饥荒时才可能触发，
//   只跑丰年会误判为"标签没实现"。
const SCENARIOS = [
  ['丰年', {}],
  ['饥荒物资', { startScale: 0.15 }],
  ['疫病', { workforceScale: 0.3 }],
  ['无冬储', { winterPrep: false }],
  ['偏袒', { favor: [0, 1, 2, 3] }],
  // 冬季 + 资源压力（RP≥2 → Fight/Steal 解禁）：唯一能让"为柴火打架/偷柴火"触发的组合
  // P0-1 后经济有了容错带，ws=0.9 已能缩编活下来（不再崩坏），故下调到 0.85 保持"崩坏"语义
  ['冬荒崩坏', { startScale: 0.55, workforceScale: 0.85 }],
  // 部分损失：靠 frail 个体差异让"先冻死最弱的"，从而活下来 10 人 → 哀悼场景才有 3 个活人可抽
  ['部分损失', { startScale: 1.6, winterPrep: false }],
  // 急性缺水：P0-1 给水加了致命底线，一般情景几乎不再缺水 → S39 脏水 需要开局就缺 + 劳力不足
  ['急性缺水', { startScale: 0, workforceScale: 0.4 }],   // P1-3 后改为零开局库存：S03 争水 / S36 / S39 三个缺水场景都要它
  // 冷冬存活：P1-2 后柴火受点位上限约束，「部分损失」情景冬季多半只剩 1–2 人 → 三人冬夜场景（S40 守火）抽不到人。
  // 加厚开局库存让冬天有足够活人又确实缺柴挨冻
  ['冷冬存活', { startScale: 2, winterPrep: false }],
  // 未知之地：全部点位未知 + 带足口粮 + 劳力略缺 → 长期探索 + 积怨，S79 探路争吵 / S80 护送伤者 需要它
  // （P1-3 后随机序列变化，原情景里 S79 只剩个位数概率）
  ['未知之地', { sitesStart: 'unknown', startScale: 3, workforceScale: 0.85 }],
];
const seen = new Map();      // tag -> 首次出现的 seed/day
const sceneUsed = new Map(); // sceneId -> 次数
const tagPair = new Map();   // tag -> 一对实例（用于展示）
let totalScenes = 0;
let maxNpc = 0;
let totalBirths = 0;
const allScenes = new Set();
let TOTAL = 0;               // 场景模板总数：从数值表动态读取，不再硬编码 74
let ALL_IDS = [];

console.log('\n═══ 关系标签覆盖验证 ═══');
console.log(`${SEEDS.length} 种子 × ${SCENARIOS.length} 情景 × 60 天\n`);

for (const seed of SEEDS) {
  for (const [sname, opts] of SCENARIOS) {
    const w = new World({ days: 60, seed, npcCount: 12, ...opts });
    const r = w.run();
    if (!TOTAL) { ALL_IDS = [...w.sceneIndex.keys()]; TOTAL = ALL_IDS.length; }
    totalScenes += r.scenes;
    maxNpc = Math.max(maxNpc, w.npcs.length);
    totalBirths += w.births.length;
    for (const s of w.sceneLog) allScenes.add(s.scene);
    for (const [k, rel] of w.rel) {
      for (const t of rel.tags) {
        if (!seen.has(t)) {
          seen.set(t, { seed, day: w.day, scenario: sname });
          tagPair.set(t, k);
        }
      }
    }
  }
}

console.log('─── 标签出现情况 ───');
const missing = [];
for (const t of ALL_TAGS) {
  const hit = seen.get(t);
  const core = CORE15.includes(t) ? '' : '  ★生存扩展';
  if (!hit) missing.push(t);
  console.log(`  ${hit ? '✅' : '❌'} ${t.padEnd(24)}${hit ? `首现 seed=${hit.seed}［${hit.scenario}］例: ${tagPair.get(t)}` : '从未出现'}${core}`);
}

console.log('\n─── 场景使用 ───');
console.log(`  ${totalScenes} 场，覆盖 ${allScenes.size} / ${TOTAL} 个场景模板（${(allScenes.size / TOTAL * 100).toFixed(0)}%）`);
console.log(`  人口峰值 ${maxNpc}（上限 16），累计出生 ${totalBirths}`);

// ── 断言 ──
const checks = [];
const push = (n, ok, d = '') => checks.push({ n, ok, d });

push('Tomodachi 原版 15 个标签全部出现', CORE15.every(t => seen.has(t)),
  `缺 ${CORE15.filter(t => !seen.has(t)).join(',') || '无'}`);
push('生存扩展 3 个标签全部出现', ALL_TAGS.slice(15).every(t => seen.has(t)),
  `缺 ${ALL_TAGS.slice(15).filter(t => !seen.has(t)).join(',') || '无'}`);
push('血缘类标签成组出现（Parent 与 Child 都有）',
  seen.has('Parent') && seen.has('Child'), '');
push('隔代标签出现（GrandParent 与 GrandChild）',
  seen.has('GrandParent') && seen.has('GrandChild'), '');
push('同胞标签双向出现（Older 与 Younger）',
  seen.has('BrotherSisterOlder') && seen.has('BrotherSisterYounger'), '');
push('场景模板覆盖率 ≥ 70%', allScenes.size / TOTAL >= 0.7, `${allScenes.size}/${TOTAL}`);
{
  const miss = ALL_IDS.filter(id => !allScenes.has(id));
  push('场景模板 100% 触发（无死内容）', miss.length === 0, miss.length ? `缺 ${miss.join(',')}` : `${TOTAL}/${TOTAL}`);
}
push('出生系统生效（5 种子累计 ≥ 5 个新生儿）', totalBirths >= 5, `${totalBirths} 个`);
push('人口不超过上限 16', maxNpc <= 16, `${maxNpc}`);

console.log('\n─── 断言 ───');
let pass = 0;
for (const c of checks) {
  console.log(`  ${c.ok ? '✅' : '❌'} ${c.n}${c.d ? '  [' + c.d + ']' : ''}`);
  if (c.ok) pass++;
}
console.log(`\n${pass}/${checks.length} 通过`);
process.exit(pass === checks.length ? 0 : 1);
