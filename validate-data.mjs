// 数据表引用完整性校验：任何拼写错误都必须在这里报出来，而不是在运行时静默失效
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data');

function loadCsv(name) {
  const raw = fs.readFileSync(path.join(DATA, name), 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length);
  const head = lines[0].split(',').map(s => s.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const o = {};
    head.forEach((h, i) => { o[h] = (cells[i] ?? '').trim(); });
    return o;
  });
}

const stocks = loadCsv('stocks.csv');
const resources = loadCsv('resources.csv');
const ladder = loadCsv('relation-ladder.csv');
const reactions = loadCsv('relation-reaction.csv');
const cats = loadCsv('trouble-category.csv');
const scenes = loadCsv('scene-branch.csv');
const history = loadCsv('history-param.csv');
const feelings = loadCsv('feeling.csv');
const prio = loadCsv('ai-priority.csv');
const sites = loadCsv('explore-sites.csv');

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

// ── 已知词汇表 ──
const KNOWN_TAGS = new Set([
  'Know', 'Friend', 'ExFriend', 'Lover', 'ExLover', 'Couple', 'Parent', 'Child',
  'GrandParent', 'GrandChild', 'BrotherSisterOlder', 'BrotherSisterYounger',
  'Relative', 'Other', 'Divorce', 'Debtor', 'Creditor', 'Suspect',
]);
const KNOWN_CONDS = new Set([
  'any', 'food_le_1', 'food_scarce', 'water_scarce', 'bond_lt_40', 'bond_lt_60',
  'bond_ge_160', 'winter_cold', 'target_sick', 'dying', 'after_death',
  'strain_ge_60', 'bond_40_99', 'target_depress', 'low_health',
  'is_lover', 'has_lover', 'is_couple',
  'has_unknown_site',   // P1-2
  'romance_ok',         // P1-3：bond≥160 且无血缘（铁律 10：恋爱不跨血缘）
]);
const KNOWN_EFFECTS = new Set([
  'bond', 'strain', 'react', 'tag', 'feeling', 'health', 'mem', 'feed', 'drink',
  'transfer', 'trouble', 'couple', 'breakup', 'birth', 'none',
  'discover', 'scout',   // P1-2：discover:<role>:<res|random> / scout:<role>:<res|random>
]);
// rollTrouble 认识的生成模式（拼错 = 该类别权重恒为 0，静默失效）
const KNOWN_GATES = new Set(['always', 'gated', 'winter', 'has_lover', 'after_death', 'has_unknown_site']);
const FEELINGS = new Set(feelings.map(r => r.feeling));
const CATS = new Set(cats.map(r => r.category));
const REACTION_IDS = new Set(reactions.map(r => r.id));
const HISTORY_IDS = new Set(history.map(r => r.id));
const STOCK_KEYS = new Set(stocks.map(r => r.key));
const RES_KEYS = new Set(resources.map(r => r.key));

// ── 1. 阶梯连续性 ──
{
  let expect = 0;
  for (const r of ladder) {
    const min = Number(r.min), max = Number(r.max);
    if (min !== expect) err(`relation-ladder 断层：期望 min=${expect}，实际 ${min}（${r.tier}）`);
    if (max < min) err(`relation-ladder 区间倒置：${r.tier}`);
    expect = max + 1;
  }
  if (expect !== 201) err(`relation-ladder 未覆盖到 200，止于 ${expect - 1}`);
  else err.__ok_ladder = true;
}

// ── 2. 场景类别必须存在于 trouble-category ──
const sceneCats = new Set(scenes.map(s => s.category));
for (const c of sceneCats) if (!CATS.has(c)) err(`场景使用了未定义的烦恼类别：${c}`);
for (const c of cats) {
  const n = scenes.filter(s => s.category === c.category).length;
  if (n === 0 && Number(c.base_rate) > 0) warn(`烦恼类别 ${c.category} 有生成率但没有任何场景 → 抽中后会兜底到 Relation`);
}

// ── 3. 场景条件/分支合法性 ──
const byScene = new Map();
for (const s of scenes) {
  if (!byScene.has(s.scene_id)) byScene.set(s.scene_id, []);
  byScene.get(s.scene_id).push(s);
  if (!KNOWN_CONDS.has(s.scene_cond)) err(`场景 ${s.scene_id} 使用了未知条件：${s.scene_cond}`);
  const p = Number(s.party);
  if (![2, 3].includes(p)) err(`场景 ${s.scene_id} party=${s.party} 非法（只能 2 或 3）`);
}
for (const [id, rows] of byScene) {
  const conds = new Set(rows.map(r => r.scene_cond));
  if (conds.size > 1) err(`场景 ${id} 内分支的 scene_cond 不一致：${[...conds].join(' / ')}`);
  const parties = new Set(rows.map(r => r.party));
  if (parties.size > 1) err(`场景 ${id} 内分支的 party 不一致：${[...parties].join(' / ')}`);
  const sum = rows.reduce((a, r) => a + Number(r.rate), 0);
  if (Math.abs(sum - 100) > 0.01) err(`场景 ${id} 分支概率和为 ${sum}，应为 100`);
  const ids = rows.map(r => r.branch_id);
  if (new Set(ids).size !== ids.length) err(`场景 ${id} 的 branch_id 重复`);
}

// ── 4. 效果 DSL 逐 token 校验 ──
const WHO = new Set(['F', 'T', 'A', 'P']);
function checkWho(s, id, tok) {
  if (s != null && !WHO.has(s)) err(`场景 ${id} 效果 "${tok}" 使用了未知角色位：${s}`);
}
for (const s of scenes) {
  if (!s.effect || s.effect === 'none') continue;
  for (const raw of s.effect.split(';')) {
    const tok = raw.trim();
    if (!tok) continue;
    const parts = tok.split(':');
    const kind = parts[0];
    if (!KNOWN_EFFECTS.has(kind)) { err(`场景 ${s.scene_id} 未知效果类型：${tok}`); continue; }
    switch (kind) {
      case 'bond':
      case 'strain': {
        const pair = parts[1] ?? '';
        const [a, b] = pair.split('>');
        if (!a || !b) { err(`场景 ${s.scene_id} 效果 "${tok}" 缺少 A>B`); break; }
        checkWho(a, s.scene_id, tok); checkWho(b, s.scene_id, tok);
        if (a === b) err(`场景 ${s.scene_id} 效果 "${tok}" 两端相同`);
        if (!/^[+-]?\d+$/.test(parts[2] ?? '')) err(`场景 ${s.scene_id} 效果 "${tok}" 数值非法`);
        break;
      }
      case 'react': {
        if (!REACTION_IDS.has(parts[1])) err(`场景 ${s.scene_id} 引用了不存在的反应：${parts[1]}`);
        break;
      }
      case 'tag': {
        const [a, b] = (parts[1] ?? '').split('>');
        checkWho(a, s.scene_id, tok); checkWho(b, s.scene_id, tok);
        const v = parts[2] ?? '';
        if (!['+', '-'].includes(v[0] ?? '')) err(`场景 ${s.scene_id} 标签 "${tok}" 缺少 +/- 前缀`);
        const tag = v.slice(1);
        if (!KNOWN_TAGS.has(tag)) err(`场景 ${s.scene_id} 未知关系标签：${tag}`);
        break;
      }
      case 'feeling': {
        checkWho(parts[1], s.scene_id, tok);
        if (!FEELINGS.has(parts[2])) err(`场景 ${s.scene_id} 未知情绪：${parts[2]}`);
        break;
      }
      case 'health': {
        checkWho(parts[1], s.scene_id, tok);
        if (!/^[+-]?\d+$/.test(parts[2] ?? '')) err(`场景 ${s.scene_id} 效果 "${tok}" 数值非法`);
        break;
      }
      case 'mem': {
        if (!HISTORY_IDS.has(parts[1])) err(`场景 ${s.scene_id} 引用了不存在的记忆：${parts[1]}`);
        break;
      }
      case 'feed':
      case 'drink': {
        checkWho(parts[1], s.scene_id, tok);
        break;
      }
      case 'transfer': {
        const [, res, amt] = [parts[1], parts[2], parts[3]];
        if (!RES_KEYS.has(res)) err(`场景 ${s.scene_id} 未知资源：${res}`);
        if (!/^[+-]?\d+$/.test(amt ?? '')) err(`场景 ${s.scene_id} 效果 "${tok}" 数值非法`);
        break;
      }
      case 'trouble': {
        if (!CATS.has(parts[1])) err(`场景 ${s.scene_id} trouble 引用未知类别：${parts[1]}`);
        break;
      }
      case 'discover':
      case 'scout': {
        checkWho(parts[1], s.scene_id, tok);
        if (parts[1] === 'P') err(`场景 ${s.scene_id} 效果 "${tok}" 角色位不能是管理者 P`);
        const target = parts[2] ?? '';
        if (target !== 'random' && !RES_KEYS.has(target)) err(`场景 ${s.scene_id} 效果 "${tok}" 目标必须是资源键或 random`);
        break;
      }
      case 'couple':
      case 'breakup':
      case 'birth': {
        const [a, b] = (parts[1] ?? '').split('>');
        checkWho(a, s.scene_id, tok); checkWho(b, s.scene_id, tok);
        if (a === b) err(`场景 ${s.scene_id} 效果 "${tok}" 两端相同`);
        break;
      }
      default: break;
    }
  }
}

// ── 5. 覆盖率统计 ──
const condsUsed = new Set(scenes.map(s => s.scene_cond));
for (const c of condsUsed) if (!KNOWN_CONDS.has(c)) err(`未知条件 ${c}`);
const tagsUsed = new Set();
for (const s of scenes) {
  for (const raw of (s.effect ?? '').split(';')) {
    const parts = raw.trim().split(':');
    if (parts[0] === 'tag') tagsUsed.add((parts[2] ?? '').slice(1));
    // couple/breakup 是"结构化标签效果"，也算写入
    if (parts[0] === 'couple') tagsUsed.add('Couple');
    if (parts[0] === 'breakup') tagsUsed.add('Divorce');
    if (parts[0] === 'birth') { tagsUsed.add('Parent'); tagsUsed.add('Child'); }
  }
}
// 结构推导的标签不需要事件写入
const DERIVED = new Set(['Parent', 'Child', 'GrandParent', 'GrandChild',
  'BrotherSisterOlder', 'BrotherSisterYounger', 'Relative', 'Other', 'Know']);
for (const t of KNOWN_TAGS) {
  if (!tagsUsed.has(t) && !DERIVED.has(t)) err(`关系标签 ${t} 既没有事件写入，也不在结构推导集合里 → 永远不会出现`);
}

// ── 6. 资源/存量键一致 ──
for (const k of ['food', 'water', 'firewood']) if (!RES_KEYS.has(k)) err(`resources.csv 缺少 ${k}`);
for (const c of cats) if (!KNOWN_GATES.has(c.gate_mode)) err(`烦恼类别 ${c.category} 未知 gate_mode：${c.gate_mode}`);

// ── 6b. P1-2 资源点位 ──
{
  const ids = new Set();
  for (const r of sites) {
    if (ids.has(r.site_id)) err(`explore-sites 点位 id 重复：${r.site_id}`);
    ids.add(r.site_id);
    if (!RES_KEYS.has(r.resource)) err(`点位 ${r.site_id} 资源未知：${r.resource}`);
    for (const k of ['x', 'y', 'capacity', 'regen_per_day', 'winter_penalty']) {
      if (!Number.isFinite(Number(r[k])) || r[k] === '') err(`点位 ${r.site_id} 的 ${k} 非数值：${r[k]}`);
    }
    if (Number(r.capacity) <= 0 || Number(r.regen_per_day) < 0) err(`点位 ${r.site_id} capacity/regen 非法`);
    const d = Number(r.discover_difficulty);
    if (!(d >= 1 && d <= 4)) err(`点位 ${r.site_id} discover_difficulty 应为 1–4：${r.discover_difficulty}`);
    if (!['known', 'unknown'].includes(r.initial_state)) err(`点位 ${r.site_id} initial_state 应为 known/unknown：${r.initial_state}`);
    if (!['any', 'winter'].includes(r.discover_season)) err(`点位 ${r.site_id} discover_season 应为 any/winter：${r.discover_season}`);
  }
  for (const k of RES_KEYS) {
    const own = sites.filter(r => r.resource === k);
    if (own.length && !own.some(r => r.initial_state === 'known')) warn(`资源 ${k} 开局没有任何已知点位 → 第 1 天产出为 0`);
  }
  const explore = cats.find(c => c.gate_mode === 'has_unknown_site');
  if (explore && !sites.some(r => r.initial_state === 'unknown')) warn('有探索类烦恼，但开局没有任何未知点位 → 永不触发');
  for (const s of scenes) {
    if (!(s.effect ?? '').includes('discover:')) continue;
    for (const raw of s.effect.split(';')) {
      const [kind, , target] = raw.trim().split(':');
      if (kind === 'discover' && target !== 'random' && !sites.some(r => r.resource === target)) {
        err(`场景 ${s.scene_id} discover:${target} 但 explore-sites 没有该资源的点位`);
      }
    }
  }
}

// ── 7. 报告 ──
const party3 = [...byScene.values()].filter(r => Number(r[0].party) === 3).length;
const party2 = [...byScene.values()].filter(r => Number(r[0].party) === 2).length;
console.log('\n═══ 数据表完整性校验 ═══\n');
console.log(`  存量       ${STOCK_KEYS.size}`);
console.log(`  资源       ${RES_KEYS.size}`);
console.log(`  关系阶梯   ${ladder.length} 档（0–200 连续）`);
console.log(`  关系反应   ${REACTIONS_COUNT()} 条`);
function REACTIONS_COUNT() { return reactions.length; }
console.log(`  烦恼类别   ${CATS.size} 类`);
console.log(`  场景       ${byScene.size} 个 / ${scenes.length} 条分支（两人 ${party2} · 三人 ${party3}）`);
console.log(`  记忆       ${HISTORY_IDS.size} 条`);
console.log(`  情绪       ${FEELINGS.size} 种`);
console.log(`  优先级     ${prio.length} 档`);
console.log(`  资源点位   ${sites.length} 个（开局已知 ${sites.filter(r => r.initial_state === 'known').length}）`);
console.log(`\n  关系标签使用：事件写入 ${[...tagsUsed].sort().join(', ')}`);
console.log(`                结构推导 ${[...DERIVED].sort().join(', ')}`);

console.log('\n─── 覆盖率 ───');
const cover = [...CATS].map(c => ({
  c, n: [...byScene.values()].filter(r => r[0].category === c).length,
})).sort((a, b) => a.n - b.n);
for (const { c, n } of cover) {
  console.log(`  ${c.padEnd(12)} ${String(n).padStart(2)} 个场景 ${'█'.repeat(n)}${n === 0 ? '  ← 空' : ''}`);
}

if (warns.length) {
  console.log('\n─── 警告 ───');
  for (const w of warns) console.log('  ⚠️  ' + w);
}
// ── P0-2：sim-core 的 data.generated.ts 必须与 CSV 同步（改 CSV 忘了重新生成 = 新旧实现数值分叉）──
{
  const { csvHash } = await import('./tools/gen-data.mjs');
  const gen = path.join(__dirname, 'packages', 'sim-core', 'src', 'data.generated.ts');
  if (!fs.existsSync(gen)) {
    errors.push('packages/sim-core/src/data.generated.ts 不存在 → 运行 node tools/gen-data.mjs');
  } else {
    const m = fs.readFileSync(gen, 'utf8').match(/DATA_HASH = '([0-9a-f]+)'/);
    const want = csvHash();
    if (!m || m[1] !== want) errors.push(`data.generated.ts 已过期（${m?.[1] ?? '无哈希'} ≠ CSV ${want}）→ 运行 node tools/gen-data.mjs`);
    else console.log(`\n  sim-core 数据表与 CSV 同步 [${want}]`);
  }
}
if (errors.length) {
  console.log('\n─── 错误 ───');
  for (const e of errors) console.log('  ❌ ' + e);
  console.log(`\n${errors.length} 个错误`);
  process.exit(1);
}
await import('./tools/check-tiers.mjs');
console.log('\n✅ 引用完整性全部通过');
process.exit(0);
