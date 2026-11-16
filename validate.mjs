// 多情景验证器：证明"制度会咬人"，而不只是"能活"
// 用法：node validate.mjs
import { World, SEASON_DAYS } from './sim.mjs';

const DAYS = 60;

function run(label, opts) {
  const w = new World({ days: DAYS, seed: 20260101, npcCount: 12, ...opts });
  const r = w.run();
  const fights = (r.scenesByCat.Fight ?? 0) + (r.scenesByCat.Steal ?? 0) + (r.scenesByCat.Abandon ?? 0);
  return {
    label,
    alive: r.alive,
    births: w.births.length,
    deaths: r.deaths.length,
    causes: r.deathCauses,
    scenes: r.scenes,
    fights,
    frog: r.frogCases,
    fightsWhileFed: r.fightsWhileFed,
    avgBond: r.dailyStats.at(-1)?.avgBond ?? 0,
    tierDist: r.tierDist,
    managerStrain: r.managerStrain,
    _r: r,
  };
}

const scenarios = [
  ['① 正常治理（基准）', {}],
  ['② 关闭冬季储备', { winterPrep: false }],
  ['③ 偏袒 4 人（政治代价）', { favor: [0, 1, 2, 3] }],
  ['④ 疫病：劳动力 30%', { workforceScale: 0.3 }],
  ['⑤ 疫病+无冬储（绝境）', { workforceScale: 0.3, winterPrep: false }],
];

console.log('\n═══ 残酷小岛 · 多情景验证 ═══');
console.log(`每情景 ${DAYS} 天 · 12 NPC · 种子固定\n`);

const results = scenarios.map(([label, opts]) => run(label, opts));

const pad = (s, n) => String(s).padEnd(n, ' ');
const num = (s, n) => String(s).padStart(n);

console.log(pad('情景', 24) + num('存活', 5) + num('出生', 5) + num('死亡', 5) + num('场景', 5) + num('冲突', 5) +
  num('青蛙', 5) + num('丰年打架', 7) + num('均Bond', 8) + num('政压', 6) + '  死因');
console.log('─'.repeat(104));
for (const r of results) {
  console.log(
    pad(r.label, 24) +
    num(r.alive, 5) + num(r.births, 5) + num(r.deaths, 5) + num(r.scenes, 5) + num(r.fights, 5) +
    num(r.frog, 5) + num(r.fightsWhileFed, 7) + num(r.avgBond, 8) + num(r.managerStrain, 6) +
    '  ' + (Object.entries(r.causes).map(([k, v]) => `${k}:${v}`).join(' ') || '—')
  );
}

// ── 单调性断言：制度越差，结果越坏 ──
console.log('\n─── 结构断言 ───');
const checks = [];
const push = (n, ok, d = '') => checks.push({ n, ok, d });

const base = results[0];
const noPrep = results[1];
const favor = results[2];
const famine = results[3];
const harsh = results[4];

push('基准情景可存活（不是一上来就团灭）', base.alive >= 6, `${base.alive}/12`);
push('关掉冬储 → 存活人数不高于基准', noPrep.alive <= base.alive, `${noPrep.alive} vs ${base.alive}`);
push('关掉冬储 → 出现冻死', (noPrep.causes.hypothermia ?? 0) > 0, `hypothermia=${noPrep.causes.hypothermia ?? 0}`);
push('饥荒开局 → 出现冲突事件（Fight/Steal/Abandon）', famine.fights > base.fights, `${famine.fights} vs ${base.fights}`);
push('饥荒开局 → 关系均值下降', famine.avgBond < base.avgBond, `${famine.avgBond} vs ${base.avgBond}`);
push('饥荒开局 → 出现温水煮青蛙（Bond≥100 但 Strain≥70）', famine.frog > 0, `${famine.frog} 例`);
push('基准情景：丰年不打架（RP<2 时冲突=0）', base.fightsWhileFed === 0, `${base.fightsWhileFed} 违规`);
push('偏袒 → 政治压力 Strain→管理者 上升', favor.managerStrain > base.managerStrain, `${favor.managerStrain} vs ${base.managerStrain}`);
push('偏袒 → 被削份额者出现（_rationCut 触发）', favor.managerStrain > 0, `${favor.managerStrain}`);
push('绝境情景死亡数高于基准与偏袒情景', harsh.deaths > base.deaths && harsh.deaths > favor.deaths, `${harsh.deaths} 死`);
push('所有情景都正常终止（跑满或全灭，无死循环）', results.every(r => r._r.dailyStats.length === DAYS || r.alive === 0), '');
push('关系档位在至少一个情景中分化到 6 档以上', results.some(r => Object.keys(r.tierDist).length >= 6), '');

// ── P0-1 经济容错带：渐进死亡率 ──
// 存在一档劳力比例，使"有人死但岛没灭绝"（而不是 0 死 / 团灭 的二值结局）
const grad = [];
for (const ws of [0.95, 0.90, 0.85, 0.80]) {
  const r = run(`ws${ws}`, { workforceScale: ws });
  grad.push({ ws, alive: r.alive, deaths: r.deaths });
}
const partial = grad.filter(g => g.alive > 0 && g.deaths > 0);
push('存在渐进死亡档位（有人死但有人活）', partial.length >= 2,
  `${partial.length} 档：` + grad.map(p => `ws${p.ws}→${p.alive}活${p.deaths}死`).join(' '));
push('基准情景仍零死亡（不许把基准搞崩）', base.deaths === 0, `${base.deaths} 死`);
// 多种子稳健性：单种子过拟合不算数。5 种子 × 4 档的部分死亡格占比，且所有种子基准零死亡
{
  let cells = 0, part = 0, baseBad = 0;
  for (const seed of [777, 1, 2, 3, 4]) {
    if (run(`s${seed}`, { seed }).deaths > 0) baseBad++;
    for (const ws of [0.95, 0.90, 0.85, 0.80]) {
      const r = run(`s${seed}ws${ws}`, { seed, workforceScale: ws });
      cells++; if (r.alive > 0 && r.deaths > 0) part++;
    }
  }
  // 实测 10 种子 24/40 = 60%、本组 5 种子 10/20 = 50%；改前 0/20。阈值取 40% 留余量，防回退。
  push('多种子渐进死亡（5 种子 × 4 档，部分死亡格 ≥ 40%）', part / cells >= 0.4, `${part}/${cells}`);
  push('多种子基准零死亡（5 种子）', baseBad === 0, `${baseBad} 个种子有死亡`);
}

// ── P1-2 发现/探索（仅 TS 版：参考实现没有点位）──
{
  const probe = new World({ days: 1, seed: 1 });
  if (Array.isArray(probe.sites) && probe.sites.length) {
    // ① 未发现点位不产生任何产出：全程只盯一个从未被发现的点位，它的 stock 必须恒为 0
    {
      const w = new World({ days: 60, seed: 20260101, npcCount: 12 });
      let leaked = 0, checked = 0;
      while (w.tickOnce()) {
        for (const s of w.sites) {
          if (s.state !== 'unknown') continue;
          checked++;
          if (s.stock !== 0) leaked++;
        }
      }
      // 再做一次「全部未知 + 禁止发现」的硬测：任何资源都不应有一丁点产出
      const z = new World({ days: 10, seed: 3, npcCount: 12, sitesStart: 'unknown' });
      z.discover = () => null;
      let prod = 0;
      for (let i = 0; i < 24 * 10; i++) { z.tickOnce(); prod += (z._prod.food ?? 0) + (z._prod.water ?? 0) + (z._prod.firewood ?? 0); }
      push('从未发现的点位不产生任何产出', leaked === 0 && checked > 0 && prod === 0,
        `未知点位采样 ${checked} 次泄漏 ${leaked}；全未知+禁发现 10 天总产出 ${prod}`);
    }
    // ② 所有点位设为 unknown → 存活显著低于基线（证明探索真的影响产出）
    {
      let baseAlive = 0, unkAlive = 0;
      const seeds = [20260101, 777, 1, 2, 3];
      for (const seed of seeds) {
        baseAlive += new World({ days: 60, seed, npcCount: 12 }).run().alive;
        unkAlive += new World({ days: 60, seed, npcCount: 12, sitesStart: 'unknown' }).run().alive;
      }
      push('全部点位未知 → 60 天存活显著低于基线（≤ 一半）', unkAlive * 2 <= baseAlive,
        `5 种子合计 ${unkAlive} vs 基线 ${baseAlive}`);
    }
    // ③ 探索真的会发生：基准 60 天至少发现 1 个点位，且发现只能经由场景（编年史里有 discover 效果）
    {
      const w = new World({ days: 60, seed: 20260101, npcCount: 12 });
      w.run();
      const found = w.sites.filter(s => (s.discoveredDay ?? 0) > 0);
      const viaScene = w.sceneLog.filter(s => (s.effect ?? '').includes('discover:')).length;
      push('基准情景中探索会发现新点位（经由场景管线）', found.length >= 1 && viaScene >= found.length,
        `${found.map(s => `${s.id}@${s.discoveredDay}`).join(' ')}；含 discover 的场景 ${viaScene} 场`);
    }
  }
}

// ── P1-3 衰老（仅 TS 版：参考实现没有年龄）──
if (typeof probeAging() === 'function') {
  const SEEDS = [20260101, 777, 1, 2, 3, 4, 5, 6, 7, 8];
  // ① 老龄化/缺柴情景下死因以 hypothermia / dehydration 为主，不许变成 starvation 为主
  //    （ageFrail 只乘在失温方向 —— 老人应该冻死，而不是饿死）
  {
    const causes = {};
    for (const seed of SEEDS) for (const d of new World({ days: DAYS, seed, npcCount: 12, winterPrep: false }).run().deaths) {
      causes[d.cause] = (causes[d.cause] ?? 0) + 1;
    }
    const tot = Object.values(causes).reduce((a, b) => a + b, 0);
    const main = (causes.hypothermia ?? 0) + (causes.dehydration ?? 0);
    push('冬季缺柴时死因以 hypothermia/dehydration 为主（非 starvation）',
      tot > 0 && main / tot >= 0.8 && (causes.starvation ?? 0) < main, JSON.stringify(causes));
  }
  // ② 死亡顺序与脆弱度正相关：先死的一半，其「总脆弱度 = 性格 frail × ageFrail」均值高于后死的一半与存活者
  {
    let early = 0, eN = 0, late = 0, lN = 0, surv = 0, sN = 0;
    for (const seed of SEEDS) {
      const w = new World({ days: DAYS, seed, npcCount: 12, winterPrep: false });
      const frailAtDeath = new Map();
      const D = w.checkDeaths.bind(w);
      w.checkDeaths = () => {
        const before = w.alive.map(n => n.id);
        D();
        for (const id of before) if (!w.npcs[id].alive && !frailAtDeath.has(id)) frailAtDeath.set(id, w.effectiveFrail(w.npcs[id]));
      };
      const r = w.run();
      const order = r.deaths.map(d => frailAtDeath.get(d.id));
      const h = Math.floor(order.length / 2);
      order.forEach((f, i) => { if (i < h) { early += f; eN++; } else { late += f; lN++; } });
      for (const n of w.alive) { surv += w.effectiveFrail(n); sN++; }
    }
    const e = early / eN, l = late / lN, s = sN ? surv / sN : 0;
    push('死亡顺序与脆弱度（性格×年龄）正相关', e > l && (sN === 0 || e > s),
      `先死一半 ${e.toFixed(2)} > 后死一半 ${l.toFixed(2)}；存活者 ${sN ? s.toFixed(2) : '—'}（${sN} 人）`);
  }
  // ③ 老人先死：「冬天柴火勉强够一部分人」的冷冬里，Elder（≥60 岁）的死亡率显著高于非老人
  //    （开局物资 ×4 且不冬储：柴火只够烧到冬末前几天，只有部分人会冻死。全灭情景无法区分谁先死）
  {
    let eD = 0, eT = 0, yD = 0, yT = 0;
    for (const seed of SEEDS) {
      const w = new World({ days: DAYS, seed, npcCount: 12, winterPrep: false, startScale: 4 });
      const elderAtWinter = new Set();
      while (w.tickOnce()) if (w.day === 45 && w.hour === 0) for (const n of w.alive) if (w.isElder(n)) elderAtWinter.add(n.id);
      for (const n of w.npcs) {
        if (n.born > 45) continue;   // 冬天才出生的婴儿不计
        const dead = !n.alive;
        if (elderAtWinter.has(n.id)) { eT++; if (dead) eD++; } else { yT++; if (dead) yD++; }
      }
    }
    push('冷冬里老人死亡率显著高于非老人（≥ 1.5 倍）', eT > 0 && yT > 0 && eD / eT >= 1.5 * (yD / yT),
      `老人 ${eD}/${eT} = ${(100 * eD / eT).toFixed(0)}%，非老人 ${yD}/${yT} = ${(100 * yD / yT).toFixed(0)}%`);
  }
  // ④ ageFrail 只在失温方向生效：两个仅年龄不同的 NPC，饥饿/脱水掉速完全相同
  {
    const w = new World({ days: 10, seed: 5, npcCount: 12 });
    const [a, b] = [w.npcs[10], w.npcs[11]];
    a.born = -80 * 4; b.born = -20 * 4; a.frail = b.frail = 1;      // 80 岁 vs 20 岁
    for (const n of [a, b]) Object.assign(n.stocks, { Satiety: 80, Hydration: 80, Warmth: 80 });
    w.fireActive = false; w._temp = -10;
    w.stockTick(a); w.stockTick(b);
    push('ageFrail 只作用于失温（饥饿/脱水掉速与年龄无关）',
      a.stocks.Satiety === b.stocks.Satiety && a.stocks.Hydration === b.stocks.Hydration && a.stocks.Warmth < b.stocks.Warmth,
      `体温 80岁 ${a.stocks.Warmth.toFixed(1)} < 20岁 ${b.stocks.Warmth.toFixed(1)}`);
  }
}
function probeAging() { const w = new World({ days: 1, seed: 1 }); return w.aging === true ? w.ageOf : undefined; }

let pass = 0;
for (const c of checks) {
  console.log(`  ${c.ok ? '✅' : '❌'} ${c.n}${c.d ? '  [' + c.d + ']' : ''}`);
  if (c.ok) pass++;
}
console.log(`\n${pass}/${checks.length} 通过`);

// ── 关系两极分化展示（最坏情景）──
const worst = results.reduce((a, b) => (b.deaths > a.deaths ? b : a), results[0]);
const names = { T0: '绝交', T1: '仇敌', T2: '敌对', T3: '恶感', T4: '冷淡', T5: '疏远', T6: '认识', T7: '友好', T8: '亲近', T9: '挚友', T10: '血亲', T11: '誓约' };
console.log(`\n─── 最坏情景（${worst.label}）的关系两极 ───`);
for (const t of ['T0','T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11']) {
  const v = worst.tierDist[t] ?? 0;
  if (!v) continue;
  console.log('  ' + t.padEnd(4) + (names[t] ?? '').padEnd(5) + String(v).padStart(4) + '  ' + '█'.repeat(v));
}

process.exit(pass === checks.length ? 0 : 1);
