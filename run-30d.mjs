// 30/60 天 headless 回归：验证数值自洽、无死锁、冬季会崩、戏剧会自然涌现
import { World, SEASON_DAYS } from './sim.mjs';

function bar(v, max, w = 20) {
  const n = Math.round(Math.max(0, Math.min(1, v / max)) * w);
  return '█'.repeat(n) + '·'.repeat(w - n);
}

const DAYS = Number(process.argv[2] ?? 60);
const SEED = Number(process.argv[3] ?? 20260101);

console.log(`\n═══ 残酷小岛 headless 仿真 ═══`);
console.log(`天数 ${DAYS} · 种子 ${SEED} · 12 NPC · 15 天/季\n`);

const w = new World({ days: DAYS, seed: SEED, npcCount: 12 });
const r = w.run();

// ── 逐日表 ──
console.log('日 季节   存活  食物   水    柴   RP  供给  均Bond 均Strain 峰值 岗需 场景 缺粮 血 水 温');
console.log('─'.repeat(96));
for (const d of r.dailyStats) {
  console.log(
    String(d.day).padStart(2) + ' ' +
    d.season.padEnd(6) +
    String(d.alive).padStart(3) +
    String(d.food).padStart(7) +
    String(d.water).padStart(6) +
    String(d.firewood).padStart(6) +
    String(d.rp).padStart(6) +
    String(d.supplyRatio).padStart(6) +
    String(d.avgBond).padStart(8) +
    String(d.avgStrain).padStart(9) +
    String(d.maxStrain).padStart(5) +
    String(d.jobDemand).padStart(4) +
    String(d.scenes).padStart(4) +
    String(d.feedings).padStart(4) +
    String(d.minHealth).padStart(3) +
    String(d.minHydra).padStart(3) +
    String(d.minWarm).padStart(3)
  );
}

// ── 季节汇总 ──
console.log('\n─── 季节汇总 ───');
for (let s = 0; s < 4; s++) {
  const rows = r.dailyStats.filter(d => Math.floor(d.day / SEASON_DAYS) % 4 === s);
  if (!rows.length) continue;
  const avg = k => (rows.reduce((a, b) => a + b[k], 0) / rows.length).toFixed(1);
  const deaths = rows.length ? rows[rows.length - 1].deaths - rows[0].deaths : 0;
  console.log(
    `${rows[0].season.padEnd(7)} 均食物 ${avg('food').padStart(6)} 均水 ${avg('water').padStart(5)} ` +
    `均RP ${avg('rp').padStart(5)} 岗需 ${avg('jobDemand').padStart(5)}/12 新增死亡 ${deaths}`
  );
}

// ── 事件统计 ──
console.log('\n─── 事件统计 ───');
console.log('总计场景:', r.scenes, ' 无法匹配条件而跳过:', r.filteredScenes);
for (const [k, v] of Object.entries(r.scenesByCat).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + k.padEnd(12) + String(v).padStart(4) + '  ' + bar(v, Math.max(...Object.values(r.scenesByCat))));
}

console.log('\n─── 死亡 ───');
console.log('死亡数:', r.deaths.length, JSON.stringify(r.deathCauses));
for (const d of r.deaths) console.log(`  第${d.day}天 ${d.name} — ${d.cause}`);

console.log('\n─── 关系档位分布（132 有向对）───');
const order = ['T0','T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11'];
const names = {T0:'绝交',T1:'仇敌',T2:'敌对',T3:'恶感',T4:'冷淡',T5:'疏远',T6:'认识',T7:'友好',T8:'亲近',T9:'挚友',T10:'血亲',T11:'誓约'};
for (const t of order) {
  const v = r.tierDist[t] ?? 0;
  if (!v) continue;
  console.log('  ' + t.padEnd(4) + names[t].padEnd(5) + String(v).padStart(4) + '  ' + bar(v, 132, 40));
}

// ── 断言 ──
console.log('\n─── 硬断言（全部必须 PASS）───');
const checks = [];
const push = (name, ok, detail = '') => { checks.push({ name, ok, detail }); };

push('无死锁：跑满天数', r.dailyStats.length === DAYS, `${r.dailyStats.length}/${DAYS}`);
push('始终有可执行场景（未全跳过）', r.scenes > 0 && r.filteredScenes < r.scenes * 20, `场景 ${r.scenes} / 跳过 ${r.filteredScenes}`);
push('丰年不打架（RP<2 时无 Fight/Steal/Abandon）', r.fightsWhileFed === 0, `违规 ${r.fightsWhileFed} 次`);
push('丰年无冤气积累（无 Bond≥100 且 Strain≥70 的对）', r.frogCases === 0, `${r.frogCases} 例`);
push('关系整体向好（均 Bond ≥ 100）', (r.dailyStats.at(-1)?.avgBond ?? 0) >= 100, `${r.dailyStats.at(-1)?.avgBond}`);
push('关系分化存在（≥2 个档位被使用）', Object.keys(r.tierDist).length >= 2, `${Object.keys(r.tierDist).length} 档`);
push('事件类别多样（≥4 类）', Object.keys(r.scenesByCat).length >= 4, `${Object.keys(r.scenesByCat).length} 类`);
push('治理得当则无人死亡', r.deaths.length === 0, `${r.deaths.length} 死`);
push('冬季劳动力确实超订（岗位需求 > 可用人数）', r.dailyStats.some(d => d.jobDemand > 12), `峰值 ${Math.max(...r.dailyStats.map(d => d.jobDemand))}/12`);
push('资源未被负数/NaN 污染', r.dailyStats.every(d => Number.isFinite(d.food) && d.food >= -0.001), '');

let pass = 0;
for (const c of checks) {
  console.log(`  ${c.ok ? '✅ PASS' : '❌ FAIL'}  ${c.name}${c.detail ? '  [' + c.detail + ']' : ''}`);
  if (c.ok) pass++;
}
console.log(`\n${pass}/${checks.length} 通过`);

// ── 样例场景 ──
console.log('\n─── 场景样例（前 25 条）───');
for (const s of r.sceneSample.slice(0, 25)) {
  console.log(`  第${String(s.day).padStart(2)}天 ${String(s.hour).padStart(2)}时 RP=${s.rp.toFixed(2)} ${s.scene}/${s.branch} (F${s.F} T${s.T}${s.A != null ? ' A' + s.A : ''}) → ${s.effect}`);
}

console.log('\n─── 关键日志 ───');
for (const l of r.log.filter(x => ['DEATH','FIRE_SHORT','TOTAL_WIPE','RATION_SHORT'].includes(x.kind)).slice(0, 20)) {
  console.log(`  第${String(l.day).padStart(2)}天 ${l.kind.padEnd(12)} ${l.msg}`);
}

// 用同一世界的当事人和关系边追踪抢食后的冲突。
const stress=new World({days:DAYS,seed:SEED,workforceScale:0.3});
const thefts=new Map();
const record=stress.pushLog.bind(stress);
stress.pushLog=(kind,message)=>{
  record(kind,message);
  if(kind==='STEAL_FOOD')console.log('D'+stress.day+' '+stress.hour+'时 '+message);
};
console.log('\n─── 饥荒中的岛民 ───');
while(!stress.isOver){
  const day=stress.day,hour=stress.hour,firstScene=stress.sceneLog.length;
  stress.tickOnce();
  for(const n of stress.alive){
    const state=n.survival;
    if(state?.behavior!=='StealFood')continue;
    const victim=stress.npc(state.target);
    const key=[n.id,victim.id].sort((a,b)=>a-b).join('/');
    thefts.set(key,day);
  }
  for(const scene of stress.sceneLog.slice(firstScene)){
    if(scene.cat!=='Fight')continue;
    const pair=[scene.F,scene.T].sort((a,b)=>a-b).join('/');
    console.log('D'+day+' '+hour+'时 '+stress.npc(scene.F).name+' 与 '+stress.npc(scene.T).name+' 争执 '+scene.scene+
      (thefts.has(pair)?'；两人曾在 D'+thefts.get(pair)+' 发生抢食':''));
  }
}

console.log('\nRNG 终态:', r.rngSeed, '（同种子必得同结果）');
process.exit(pass === checks.length ? 0 : 1);
