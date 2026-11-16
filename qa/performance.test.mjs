// test-skit.mjs —— 演出系统专项断言。沿用 残酷小岛 五套脚本的写法（push(n, ok, d) + exit code）。
// 用法：node test-skit.mjs
//
// 这 14 条就是「下一个 AI 算不算做完了」的验收口径。任何一条红，演出都不许合并。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCsv, validateTables, coverageReport,
  planScene, SkitPlayer, TIERS, Rng, deriveRng, degradeToT0,
} from '../src/performance/runtime.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const checks = [];
const push = (n, ok, d = '') => checks.push({ n, ok, d });

function loadSkitTables(){
  return Object.fromEntries(Object.entries({defs:'def',beats:'beat',lines:'line',choices:'choice',shots:'shot'})
    .map(([key,file])=>[key,parseCsv(fs.readFileSync(path.join(HERE,'../src/performance/data/skit-'+file+'.csv'),'utf8'))]));
}
function loadSceneTable(){
  return parseCsv(fs.readFileSync(path.join(HERE,'../src/performance/data/scene-branch.csv'),'utf8')).concat(
    parseCsv(fs.readFileSync(path.join(HERE,'../src/camp/data/scene-branch.csv'),'utf8')),
    tables.defs.filter(d=>d.skit_id.startsWith('IS_')).map(d=>({scene_id:d.scene_id,branch_id:'result'})));
}
const tables = loadSkitTables();
const scenes = loadSceneTable();
const ids = { F: 3, T: 7, A: 1 };
const names = { 3: '阿岚', 7: '阿吉', 1: '小满' };
const sceneRowOf = (sid, bid) => scenes.find(r => r.scene_id === sid && r.branch_id === bid);

function makePlan(over = {}) {
  return planScene({
    tables, seed: 20260101, tick: 7 * 24 + 20,
    sceneId: 'S02_share_last_food', branchId: 'B1',
    ids, names, bond: 168, strain: 12, rp: 1.35, feelings: ['Worry'], mems: ['H45'],
    choices: { CH_ABANDON: 'C1' },
    sceneRow: sceneRowOf('S02_share_last_food', 'B1'),
    ...over,
  });
}
const canon = o => JSON.stringify(o);

/* ── 1. 数据表合法 ───────────────────────────────────────────────── */
{
  const { errs } = validateTables(tables, scenes);
  push('数据表零错误（引用/时长/白名单/台词键）', errs.length === 0, `${errs.length} 条：${errs.slice(0, 3).join(' | ')}`);
}

/* ── 2. 覆盖率：真实场景表每一行都能产出演出 ─────────────────────── */
{
  const cov = coverageReport(tables, scenes);
  let ok = 0, bad = [];
  for (const r of scenes) {
    try {
      const p = planScene({
        tables, seed: 1, tick: 3, sceneId: r.scene_id, branchId: r.branch_id,
        ids, names, bond: 100, strain: 20, rp: 1, sceneRow: r,
      });
      if (p && p.total > 0 && p.cues.some(c => c.kind === 'end')) ok++;
      else bad.push(`${r.scene_id}/${r.branch_id}`);
    } catch (e) { bad.push(`${r.scene_id}/${r.branch_id}:${e.message}`); }
  }
  push('每个 (scene,branch) 都能产出完整演出', bad.length === 0, `${ok}/${scenes.length}${bad.length ? ' 缺 ' + bad.slice(0, 3).join(',') : ''}`);
  push('手写剧本覆盖 ≥ 12 个场景', new Set(tables.defs.map(d => d.scene_id)).size >= 12, `${new Set(tables.defs.map(d => d.scene_id)).size} 个场景；手写分支 ${cov.hand}/${cov.pairs}`);
}

/* ── 3. 变体重放一致（读档/录像/换设备） ─────────────────────────── */
{
  const a = makePlan(), b = makePlan();
  push('同输入两次求解逐字节一致', canon(a) === canon(b), a.skitId + '/' + a.variant);
}

/* ── 4. 派生 RNG 真的在变（否则等于写死） ────────────────────────── */
{
  const seen = new Set();
  const variants = new Set();
  for (let tick = 0; tick < 200; tick++) {
    const p = makePlan({
      tick, sceneId: 'S61_show_treasure', branchId: 'B1',
      sceneRow: sceneRowOf('S61_show_treasure', 'B1'),
    });
    seen.add(canon(p));
    variants.add(p.variant);
  }
  const want = [0, 1];
  push('不同 tick 至少产出 3 种不同演出计划', seen.size >= 3, `${seen.size} 种/200 tick`);
  push('200 tick 内所有变体都被抽到（无死变体）', want.every(v => variants.has(v)), `[${[...variants].join(',')}]`);
}

/* ── 5. 派生 RNG 纯函数性：同参数同结果，且不改外部状态 ─────────── */
{
  const r1 = deriveRng({ seed: 9, tick: 100, sceneId: 'S01_x', branchId: 'B1', focus: 1, target: 2, another: null, salt: 0 });
  const r2 = deriveRng({ seed: 9, tick: 100, sceneId: 'S01_x', branchId: 'B1', focus: 1, target: 2, another: null, salt: 0 });
  const s1 = r1.s, s2 = r2.s;
  const v1 = [r1.int(9), r1.int(9), r1.int(9)];
  const v2 = [r2.int(9), r2.int(9), r2.int(9)];
  push('派生 RNG 可复现（同参数同序列）', s1 === s2 && v1.join() === v2.join(), v1.join('/'));
  const r3 = deriveRng({ seed: 9, tick: 100, sceneId: 'S01_x', branchId: 'B1', focus: 1, target: 3, another: null, salt: 0 });
  push('换演员 ⇒ 换序列（不共享全局状态）', canon([r3.int(9), r3.int(9)]) !== canon([v1[0], v1[1]]), '');
}

/* ── 6. 时长预算 ─────────────────────────────────────────────────── */
{
  const bad = [];
  for (const skitId of new Set(tables.beats.map(b => b.skit_id))) {
    const vs = [...new Set(tables.beats.filter(b => b.skit_id === skitId).map(b => Number(b.variant)))];
    const def = tables.defs.find(d => d.skit_id === skitId);
    for (const v of vs) {
      const total = tables.beats
        .filter(b => b.skit_id === skitId && Number(b.variant) === v)
        .reduce((a, b) => a + Math.max(0, Number(b.dur_ms) || 0), 0);
      if (total > TIERS[def.tier].capMs) bad.push(`${skitId}#${v}=${total}>${TIERS[def.tier].capMs}`);
    }
  }
  push('每个剧本总时长都在 tier 预算内', bad.length === 0, bad.slice(0, 3).join(',') || 'ok');
  const t0 = tables.defs.filter(d => d.tier === 'T0');
  push('T0 一律不冻结世界（hold=0）', t0.every(d => Number(d.hold) === 0), `T0 共 ${t0.length} 本`);
  const maxBeat = Math.max(...tables.beats.map(b => Number(b.dur_ms) || 0));
  push('单 beat ≤ 6000ms', maxBeat <= 6000, `${maxBeat}ms`);
}

/* ── 7. 播放完整：每帧 16ms 步进，cue 恰好执行一次且时间单调 ──────── */
{
  const plan = makePlan({ sceneId: 'S02_share_last_food', branchId: 'B1' });
  const seen = [];
  const p = new SkitPlayer(plan, { onCue: c => seen.push(c) });
  let guard = 0;
  while (!p.done && guard++ < 100000) p.step(16);
  const monotonic = seen.every((c, i) => i === 0 || c.t >= seen[i - 1].t);
  push('逐帧播放：cue 数量与顺序完整且时间单调', seen.length === plan.cues.length && monotonic, `${seen.length}/${plan.cues.length}`);
}

/* ── 8. 跳过收敛：任意时刻跳过，结果与播完一致（一条 sceneLog） ─── */
{
  const plan = makePlan({ sceneId: 'S02_share_last_food', branchId: 'B1' });
  const seen = [];
  const p = new SkitPlayer(plan, { onCue: c => seen.push(c) });
  p.step(1200);           // 播 1.2 秒后跳过
  const before = seen.length;
  p.skip();
  push('跳过：cue 不重不漏、done 只到一次',
    p.done && seen.length === plan.cues.length && before < plan.cues.length,
    `跳前 ${before} 跳后 ${seen.length}/${plan.cues.length}`);
  push('跳过：end cue 恰好出现一次', seen.filter(c => c.kind === 'end').length === 1, '');
}

/* ── 9. 介入选项改变文案但不改变结构（结算已由模拟决定） ─────────── */
{
  const c1 = makePlan({ sceneId: 'S12_abandon_dying', branchId: 'B1', choices: { CH_ABANDON: 'C1' } });
  const c2 = makePlan({ sceneId: 'S12_abandon_dying', branchId: 'B1', choices: { CH_ABANDON: 'C2' } });
  const cap1 = c1.cues.find(c => c.kind === 'caption')?.text ?? '';
  const cap2 = c2.cues.find(c => c.kind === 'caption')?.text ?? '';
  const sameShape = c1.cues.length === c2.cues.length &&
    c1.cues.every((c, i) => c.kind === c2.cues[i].kind && c.t === c2.cues[i].t);
  push('介入：换选项只换文案、不换分镜结构', cap1 !== cap2 && sameShape, `「${cap1}」vs「${cap2}」`);
  const choiceCue = c1.cues.find(c => c.kind === 'choice');
  push('介入：T3 剧本带选项与可选指令', !!choiceCue && choiceCue.options.length >= 2 && choiceCue.options.some(o => o.command), JSON.stringify(choiceCue?.options?.map(o => o.command)));
}

/* ── 10. 演员已死 / 名字缺失：演出仍能生成，文案退化成 #id ───────── */
{
  const p = planScene({
    tables, seed: 5, tick: 9, sceneId: 'S06_tend_sick', branchId: 'B1',
    ids: { F: 3, T: 99, A: null }, names: { 3: '阿岚' },  // 99 没有名字（新生儿/死者）
    bond: 120, strain: 10, rp: 1, sceneRow: sceneRowOf('S06_tend_sick', 'B1'),
  });
  push('演员无名字时不崩（退化成占位）', !!p && p.cues.length > 0, p.skitId);
}

/* ── 11. 台词里不许出现半角逗号（CSV 会错列） ────────────────────── */
{
  const bad = tables.lines.filter(l => (l.text ?? '').includes(','));
  push('台词表无半角逗号', bad.length === 0, bad.slice(0, 3).map(l => l.line_id).join(','));
}

/* ── 12. 静态红线：运行时不许有 Math.random / 时钟 / sim-core ──
 *  说明：相机求解允许用 atan2/hypot（只影响画面，不影响选择与模拟）；
 *        选择逻辑（派生 RNG / 变体 / 台词）必须纯整数。 */
{
  const raw = fs.readFileSync(path.join(HERE, '../src/performance/runtime.js'), 'utf8');
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\/[^\n]*/g, '');
  const offenders = [];
  if (/Math\.random/.test(src)) offenders.push('Math.random');
  if (/Math\.(pow|exp|log|sqrt|cbrt)\b/.test(src)) offenders.push('不确定浮点函数');
  if (/Date\.now|performance\.now/.test(src)) offenders.push('时钟');
  if (/sim-core/.test(src) && /import/.test(src)) offenders.push('import sim-core');
  push('运行时零 Math.random / 零时钟 / 不 import sim-core', offenders.length === 0, offenders.join(','));
}

/* ── 13. 演出计划可 JSON 序列化（能存、能比对、能回放） ───────────── */
{
  const p = makePlan();
  let ok = true;
  try { const s = JSON.stringify(p); ok = JSON.parse(s).cues.length === p.cues.length; } catch { ok = false; }
  push('演出计划可 JSON 往返（无函数/无循环引用）', ok, `${p.cues.length} cues`);
}

/* ── 14. 每本 T2+ 剧本都必须有「留白」或「硬切」 ─────────────────── */
{
  const slow = tables.defs.filter(d => ['T2', 'T3', 'T4'].includes(d.tier));
  const missing = slow.filter(d => {
    const rows = tables.beats.filter(b => b.skit_id === d.skit_id);
    return !rows.some(b => b.kind === 'wait' || b.kind === 'cut');
  });
  push('T2+ 剧本都有留白或硬切（否则没有节奏）', missing.length === 0, missing.map(d => d.skit_id).join(','));
}

/* ── 15. 降级：预算耗尽时任何一场都能压成 T0（不冻结、不切镜头、≤1.2s） ── */
{
  const t4 = makePlan({ sceneId: 'S02_share_last_food', branchId: 'B1' });
  const t0 = degradeToT0(t4);
  const ok = t0.tier === 'T0' && t0.hold === false && t0.total <= TIERS.T0.capMs
    && !t0.cues.some(c => c.kind === 'cam') && t0.cues.some(c => c.kind === 'end');
  push('降级为 T0：不冻结/不切镜头/≤1.2s/仍有文案', ok, `${t4.tier}→${t0.tier} ${t0.total}ms`);
}

/* ── 16. 机位完全由 skit-shot.csv 驱动（改表即改机位，代码不动） ── */
{
  const base = loadSkitTables();
  const mutated = base.shots.map(r => r.shot === '2SHOT' ? { ...r, dist_sep: '20' } : r);
  const pick = t => planScene({
    tables: t, seed: 3, tick: 5, sceneId: 'S61_show_treasure', branchId: 'B1',
    ids, names, bond: 100, strain: 10, rp: 1, sceneRow: sceneRowOf('S61_show_treasure', 'B1'),
  }).cues.find(c => c.kind === 'cam').camera.dist;
  const d1 = pick(base), d2 = pick({ ...base, shots: mutated });
  push('机位表驱动：改 skit-shot.csv 即改画面（代码零改动）', d1 !== d2 && d1 > 0 && d2 > 0, `dist ${d1} → ${d2}`);
}

/* ── 汇总 ───────────────────────────────────────────────────────── */
let pass = 0;
for (const c of checks) {
  console.log(`  ${c.ok ? '✅' : '❌'}  ${c.n}${c.d ? '  [' + c.d + ']' : ''}`);
  if (c.ok) pass++;
}
console.log(`\n${pass}/${checks.length} 通过`);
process.exit(pass === checks.length ? 0 : 1);

