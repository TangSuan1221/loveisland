// 存档/读档 / 玩家指令 / 极端边界 的验收测试
import { World, SIM_IMPL, SIM_SOURCES } from './sim.mjs';

const checks = [];
const push = (n, ok, d = '') => checks.push({ n, ok, d });
const pad = (s, n) => String(s).padEnd(n);

function runTicks(w, n) { for (let i = 0; i < n; i++) w.step(), w.tick++; }

console.log('\n═══ 存档 / 指令 / 边界 验收 ═══');
console.log(`实现：${SIM_IMPL}\n`);

/* ── 1. 存读档确定性 ── */
{
  const a = new World({ days: 120, seed: 424242 });
  runTicks(a, 24 * 20);                       // 跑 20 天
  const saved = JSON.parse(JSON.stringify(a.save()));
  runTicks(a, 24 * 10);                       // 再跑 10 天
  const expectRng = a.rng.s.toString();
  const expectBond = [...a.rel.values()].reduce((s, r) => s + r.bond, 0);

  const b = World.load(saved);
  runTicks(b, 24 * 10);                       // 从存档再跑 10 天
  const gotRng = b.rng.s.toString();
  const gotBond = [...b.rel.values()].reduce((s, r) => s + r.bond, 0);

  push('存读档后 RNG 序列完全一致', gotRng === expectRng, `${gotRng.slice(0, 12)}…`);
  push('存读档后关系总量完全一致', gotBond === expectBond, `${gotBond} vs ${expectBond}`);
  push('存读档后存活人数一致', b.alive.length === a.alive.length, `${b.alive.length} vs ${a.alive.length}`);
  push('存档体积可控（< 400 KB）', JSON.stringify(saved).length < 400 * 1024,
    `${(JSON.stringify(saved).length / 1024).toFixed(1)} KB`);
  push('存档只存偏离默认值的边（< 132）', saved.relations.length <= 132, `${saved.relations.length} 条`);
}

/* ── 1b. P1-1 场景中途存档 pendingScene（仅 TS 版：参考实现没有 advance()）── */
if (typeof World.prototype.advance === 'function') {
  const json = x => JSON.parse(JSON.stringify(x));
  const relTotal = w => {
    let b = 0, s = 0;
    for (const r of w.rel.values()) { b += r.bond; s += r.strain; }
    return { b, s };
  };
  /** 跑到第 day 天 20:00，推进到第 k 场待结算场景（k 从 1 起） */
  const toPending = (seed, opts, day, k) => {
    const w = new World({ days: 120, seed, ...opts });
    while (!(w.day === day && w.hour === 20)) if (!w.tickOnce()) return null;
    for (let i = 0; i < k; i++) {
      let r;
      do { r = w.advance(); } while (r === 'tick' && w.hour === 20);
      if (r !== 'scene') return null;
    }
    return w;
  };

  // ① 主断言（任务卡）：抽中未结算 → save → load → 结算 → 后续 10 天 RNG 序列与关系总量逐位一致
  {
    const ctrl = toPending(42, {}, 5, 2);
    const saved = json(ctrl.save());
    const test = World.load(saved);
    // 验证方法（任务卡风险项）：读档后先抽 10 个随机数，与对照组比对 —— 用克隆的 RNG，不扰动世界
    const peek = w => { const s = w.rng.s; const xs = Array.from({ length: 10 }, () => w.rng.next()); w.rng.s = s; return xs.join(','); };
    const peekOk = peek(ctrl) === peek(test);
    const seqA = [], seqB = [];
    for (let i = 0; i < 24 * 10; i++) {
      ctrl.tickOnce(); test.tickOnce();
      seqA.push(ctrl.rng.s.toString()); seqB.push(test.rng.s.toString());
    }
    const ra = relTotal(ctrl), rb = relTotal(test);
    push('pendingScene 存档含已选分支且 rngCursor=rngState',
      !!saved.pendingScene?.branchId && saved.pendingScene.rngCursor === saved.meta.rngState,
      `${saved.pendingScene?.sceneId}/${saved.pendingScene?.branchId}`);
    push('读档后前 10 个随机数与对照组一致', peekOk);
    push('穿越 pendingScene 存读档后 10 天 RNG 序列完全一致', seqA.join() === seqB.join(), `${seqA.length} 个 tick 逐个比对`);
    push('穿越 pendingScene 存读档后关系总量完全一致', ra.b === rb.b && ra.s === rb.s,
      `bond ${ra.b} / strain ${ra.s.toFixed(1)}`);
  }

  // ② 读档后不重新抽签：结算的就是存档里那条分支，且结算本身不消耗 RNG
  {
    const w = World.load(json(toPending(7, { startScale: 0.3 }, 8, 1).save()));
    const p = { ...w.pendingScene };
    const rngBefore = w.rng.s;
    const logLen = w.sceneLog.length;
    w.advance();   // 结算这一场（随后会继续抽下一场或结束本 tick）
    const e = w.sceneLog[logLen];
    push('读档后结算的正是存档分支（不重新抽签）',
      e && e.scene === p.sceneId && e.branch === p.branchId && e.F === p.focus && e.T === p.target, `${e?.scene}/${e?.branch}`);
    const w2 = World.load(json(toPending(7, { startScale: 0.3 }, 8, 1).save()));
    // 直接测 commit 不耗 RNG：私有方法在 JS 里可调用
    const p2 = w2.pendingScene; w2.pendingScene = null;
    const s0 = w2.rng.s; w2.commitScene(p2);
    push('pendingScene 结算不消耗 RNG', w2.rng.s === s0 && rngBefore === BigInt(p.rngCursor));
  }

  // ③ 宽覆盖：多种子 × 多情景 × 一晚中每一场，逐场存读档，后续 10 天整体状态全等
  {
    let tot = 0, bad = 0;
    const canon = (w, ds) => JSON.stringify({
      rng: w.rng.s.toString(), store: w.store, ms: w.policy.managerStrain, fs: w.filteredScenes,
      rel: [...w.rel.entries()].map(([k, r]) => [k, r.bond, r.strain, [...r.tags]]),
      npcs: w.npcs.map(n => [n.alive, n.feeling, n.job, n.stocks, n.memories.length]),
      ds, log: w.sceneLog.slice(-30),
    });
    for (const [seed, opts, day] of [[1, {}, 3], [2, { startScale: 0.15 }, 4], [3, { workforceScale: 0.85 }, 50],
      [4, { favor: [0, 1, 2] }, 20], [5, { startScale: 0.55, workforceScale: 0.85 }, 47], [6, { winterPrep: false }, 52],
      [8, { startScale: 0.15, workforceScale: 0.85 }, 6], [9, {}, 33], [10, {}, 7], [11, {}, 12], [12, {}, 19]]) {
      for (let k = 1; k <= 6; k++) {
        const a = toPending(seed, opts, day, k);
        if (!a) break;
        const b = World.load(json(a.save()));
        const ds0 = a.dailyStats.length;   // dailyStats 不进存档（SPEC §10），只比读档之后新产生的
        for (let i = 0; i < 24 * 10; i++) { a.tickOnce(); b.tickOnce(); }
        tot++; if (canon(a, a.dailyStats.slice(ds0)) !== canon(b, b.dailyStats)) bad++;
      }
    }
    push('多情景逐场 pendingScene 存读档：10 天后整体状态全等', tot >= 20 && bad === 0, `${tot - bad}/${tot} 场`);
  }

  // ④ 非场景时刻的日内存档（20–23 点 dayState）也必须逐位一致
  {
    let tot = 0, bad = 0;
    for (const t of [21, 22, 23, 24 * 25 + 21, 24 * 25 + 23, 24 * 50 + 22]) {
      const a = new World({ days: 120, seed: 777 });
      for (let i = 0; i < t; i++) a.tickOnce();
      const b = World.load(json(a.save()));
      for (let i = 0; i < 24 * 10; i++) { a.tickOnce(); b.tickOnce(); }
      const ra = relTotal(a), rb = relTotal(b);
      tot++; if (a.rng.s !== b.rng.s || ra.b !== rb.b || ra.s !== rb.s || a.policy.managerStrain !== b.policy.managerStrain) bad++;
    }
    push('20–23 点日内存档（dayState）后 10 天一致', bad === 0, `${tot - bad}/${tot}`);
  }

  // ⑤ 防损坏 + 兼容
  {
    const s = json(toPending(42, {}, 5, 1).save());
    s.pendingScene.rngCursor = '1';
    let threw = false;
    try { World.load(s); } catch { threw = true; }
    push('rngCursor 被篡改的存档拒绝加载', threw);
    const old = json(new World({ days: 10, seed: 3 }).save());
    delete old.dayState; delete old.trouble; delete old.pendingScene;
    let ok = true;
    try { const w = World.load(old); for (let i = 0; i < 48; i++) w.tickOnce(); } catch { ok = false; }
    push('P1-1 之前的旧存档（无新字段）仍可加载运行', ok);
    const sn = toPending(42, {}, 5, 1).snapshot();
    push('snapshot() 暴露待结算场景索引', sn.pendingSceneIdx >= 0 && sn.pendingBranchIdx >= 0 && sn.pendingF >= 0);
  }

  // ⑥ P1-2：点位状态随存档往返，读档后 20 天发现顺序与产出一致；快照带点位
  {
    const a = new World({ days: 120, seed: 20260101 });
    for (let i = 0; i < 24 * 30 + 21; i++) a.tickOnce();          // 第 30 天 21 点（已发现过点位、日内中途）
    const saved = json(a.save());
    const b = World.load(saved);
    for (let i = 0; i < 24 * 20; i++) { a.tickOnce(); b.tickOnce(); }
    const st = w => JSON.stringify(w.sites.map(s => [s.id, s.state, s.stock, s.discoveredDay]));
    push('点位状态（发现/可采量）随存档往返且后续 20 天一致',
      Array.isArray(saved.sites) && saved.sites.length > 0 && st(a) === st(b) && a.rng.s === b.rng.s,
      `${saved.sites.filter(s => s.state !== 'unknown').length}/${saved.sites.length} 已知`);
    const s = a.snapshot();
    push('snapshot() 含点位 SoA（坐标/资源/状态/可采量）',
      ArrayBuffer.isView(s.siteX) && s.siteCount === a.sites.length && s.siteState.length === a.sites.length);
  }
}

/* ── 2. 玩家指令 ── */
{
  const w = new World({ days: 120, seed: 7 });
  // setRation
  const r1 = w.applyCommand({ type: 'setRation', value: 0.5 });
  push('setRation 生效', r1.ok && w.policy.rationPerPerson === 0.5, String(w.policy.rationPerPerson));
  const r1b = w.applyCommand({ type: 'setRation', value: 99 });
  push('setRation 越界被 clamp 到 2.0', w.policy.rationPerPerson === 2, String(w.policy.rationPerPerson));

  // setFavor
  w.applyCommand({ type: 'setFavor', ids: [0, 1] });
  push('setFavor 生效', w.policy.favor.size === 2, [...w.policy.favor].join(','));

  // mediate
  const rel = w.relOf(2, 3);
  rel.strain = 50;
  const m1 = w.applyCommand({ type: 'mediate', a: 2, b: 3 });
  push('mediate 降低 Strain', m1.ok && rel.strain === 20, `→ ${rel.strain}`);
  const m2 = w.applyCommand({ type: 'mediate', a: 2, b: 3 });
  push('mediate 3 天冷却生效', !m2.ok && m2.reason === 'cooldown', m2.reason ?? '');

  // mediate 对高 hostility 失败
  const w2 = new World({ days: 120, seed: 8 });
  w2.relOf(4, 5).strain = 95;
  const m3 = w2.applyCommand({ type: 'mediate', a: 4, b: 5 });
  push('mediate 对 Strain≥90 失败并加剧', !m3.ok && m3.reason === 'too_hostile' && w2.relOf(4, 5).strain > 95,
    `→ ${w2.relOf(4, 5).strain.toFixed(0)}`);

  // mediate 非法输入
  push('mediate 对自己返回 same_npc', w.applyCommand({ type: 'mediate', a: 2, b: 2 }).reason === 'same_npc');
  push('未知指令不抛异常', w.applyCommand({ type: 'nonsense' }).ok === false);

  // assignJob
  const j = w.applyCommand({ type: 'assignJob', npcId: 6, job: 'water' });
  push('assignJob 生效并锁定当天', j.ok && w.npc(6).job === 'water' && w.npc(6).jobLockedToday === true);

  // exileVote 失败路径
  const ev1 = w.applyCommand({ type: 'exileVote', targetId: 9 });
  push('exileVote 票数不足则失败（关系好时）', ev1.ok === false && ev1.reason === 'vote_failed',
    `${ev1.votes}/${ev1.needed}`);

  // exileVote 成功路径
  const w3 = new World({ days: 120, seed: 9 });
  for (const n of w3.npcs) if (n.id !== 10) w3.relOf(n.id, 10).bond = 10;
  const ev2 = w3.applyCommand({ type: 'exileVote', targetId: 10 });
  push('exileVote 过半数则放逐成功（目标死亡）', ev2.ok === true && w3.npc(10).alive === false,
    `${ev2.votes}/${ev2.needed}`);
  push('放逐写入死亡记录且原因为 exile',
    w3.deaths.some(d => d.id === 10 && d.cause === 'exile'));
}

/* ── 3. 极端边界 ── */
{
  // 只剩 1 人：跑 10 天不崩
  const w = new World({ days: 10, seed: 11, npcCount: 2 });
  w.npc(1).alive = false;
  let crashed = false;
  try { runTicks(w, 240); } catch (e) { crashed = true; console.log('  异常:', e.message); }
  push('只剩 1 人跑 10 天不崩溃', !crashed);

  // 全灭：立即停止
  const w2 = new World({ days: 30, seed: 12, npcCount: 3 });
  for (const n of w2.npcs) n.alive = false;
  const rep = w2.run();
  push('全灭后 run() 正常返回而不死循环', rep.alive === 0 && rep.dailyStats.length === 0,
    `days=${rep.dailyStats.length}`);

  // 配给 0：全员饿死但不 NaN
  const w3 = new World({ days: 40, seed: 13, ration: 0 });
  const r3 = w3.run();
  push('配给 0 时全员饿死且数值无 NaN',
    r3.alive === 0 && r3.dailyStats.every(d => Number.isFinite(d.food)), `${r3.alive} 存活`);

  // 12 人 × 60 天 单 tick 性能
  const w4 = new World({ days: 60, seed: 14 });
  const t0 = performance.now();
  w4.run();
  const perTick = (performance.now() - t0) / (60 * 24);
  push('单 tick 耗时 < 0.5 ms（12 NPC）', perTick < 0.5, `${perTick.toFixed(4)} ms/tick`);
}

/* ── 铁律 11：模拟层禁用非确定性数学（静态扫描，去掉注释后匹配）── */
{
  const fs = await import('node:fs');
  const hits = [];
  for (const f of SIM_SOURCES) {
    const src = fs.readFileSync(new URL('./' + f, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const m of src.matchAll(/Math\.(random|pow|exp|sin|cos|tan|log|sqrt|cbrt|atan2?|hypot)\b/g)) hits.push(`${f}:${m[0]}`);
  }
  push('模拟层无 Math.random/pow/exp/sin 等（铁律 11）', hits.length === 0,
    hits.length ? [...new Set(hits)].join(',') : `0 处 / ${SIM_SOURCES.length} 个源文件`);
}

/* ── P0-2：SoA 快照与 tickOnce（仅 TS 版）── */
if (typeof World.prototype.snapshot === 'function') {
  // 架构边界：sim-core 只许相对 import 自己，禁止 three / WebGPU / node: IO
  {
    const fs = await import('node:fs');
    const dir = new URL('./packages/sim-core/src/', import.meta.url);
    const bad = [];
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.ts'))) {
      const src = fs.readFileSync(new URL(f, dir), 'utf8');
      for (const m of src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) if (!m[1].startsWith('./')) bad.push(`${f}→${m[1]}`);
    }
    const pkg = JSON.parse(fs.readFileSync(new URL('./packages/sim-core/package.json', import.meta.url), 'utf8'));
    push('sim-core 零外部 import 且 dependencies 为空', bad.length === 0 && Object.keys(pkg.dependencies ?? {}).length === 0,
      bad.join(',') || '仅相对 import');
  }
  const w = new World({ days: 60, seed: 21 });
  for (let i = 0; i < 24 * 10; i++) w.tickOnce();
  const s = w.snapshot();
  const objs = Object.entries(s).filter(([, v]) => typeof v === 'object');
  push('snapshot() 全部为 typed array（SoA，无对象数组）', objs.length > 0 && objs.every(([, v]) => ArrayBuffer.isView(v)),
    `${objs.length} 个数组`);
  const n = w.alive.length;
  push('snapshot() 边表只含存活者有向边', s.edgeCount === n * (n - 1), `${s.edgeCount} 条`);
  push('tickOnce() 推进 tick 且全灭后返回 false', w.tick === 240 &&
    (() => { const z = new World({ days: 5, seed: 1, npcCount: 3 }); for (const p of z.npcs) p.alive = false; return z.tickOnce() === false; })());
}

/* ── 汇总 ── */
let pass = 0;
for (const c of checks) {
  console.log(`  ${c.ok ? '✅' : '❌'} ${pad(c.n, 44)}${c.d ? '[' + c.d + ']' : ''}`);
  if (c.ok) pass++;
}
console.log(`\n${pass}/${checks.length} 通过`);
process.exit(pass === checks.length ? 0 : 1);
