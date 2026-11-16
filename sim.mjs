// 回归套件统一入口：默认加载 TypeScript 版 @cruel-isle/sim-core（P0-2 起为主实现）
//   SIM=ref node validate.mjs   → 改用参考实现 sim/world.mjs（对照/排障用）
// Node ≥ 22.18 / 24 原生支持 .ts 类型擦除，无需 tsx / 构建步骤。
const useRef = process.env.SIM === 'ref';
const mod = useRef
  ? await import('./sim/world.mjs')
  : await import('./packages/sim-core/src/index.ts');

export const World = mod.World;
export const SEASON_DAYS = mod.SEASON_DAYS;
export const SIM_IMPL = useRef ? 'sim/world.mjs（参考实现）' : 'packages/sim-core（TypeScript）';
/** 铁律 11 静态扫描的目标源码 */
export const SIM_SOURCES = useRef
  ? ['sim/world.mjs']
  : ['packages/sim-core/src/world.ts', 'packages/sim-core/src/rng.ts', 'packages/sim-core/src/kinship.ts',
    'packages/sim-core/src/data.ts', 'packages/sim-core/src/snapshot.ts', 'packages/sim-core/src/constants.ts',
    'packages/sim-core/src/aging.ts'];
