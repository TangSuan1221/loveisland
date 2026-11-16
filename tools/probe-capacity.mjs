// tools/probe-capacity.mjs —— 扫 workforceScale，打印生存曲线
// 用法：node tools/probe-capacity.mjs [days=60] [seed=20260101]
import { World } from '../sim.mjs';

const DAYS = Number(process.argv[2] ?? 60);
const SEED = Number(process.argv[3] ?? 20260101);

console.log(`天数 ${DAYS} · 种子 ${SEED}`);
console.log('ws    存活  出生  死亡  柴峰  死因');
for (const ws of [1.0, 0.97, 0.95, 0.92, 0.90, 0.87, 0.85, 0.80, 0.70]) {
  const w = new World({ days: DAYS, seed: SEED, npcCount: 12, workforceScale: ws });
  const r = w.run();
  const causes = Object.entries(r.deathCauses).map(([k, v]) => `${k}:${v}`).join(' ');
  const woodPeak = Math.max(0, ...r.dailyStats.map(d => d.firewood));
  console.log(String(ws).padEnd(5) + String(r.alive).padStart(4) +
    String(w.births.length).padStart(6) +
    String(r.deaths.length).padStart(6) + String(woodPeak.toFixed(0)).padStart(6) + '  ' + (causes || '—'));
}
