// @cruel-isle/sim-core —— 对外出口（SPEC §13 API 契约）
// 零依赖、零 IO、零 three/WebGPU。Node / Web Worker / 浏览器通用。
export { World } from './world.ts';
export { Rng } from './rng.ts';
export { transferList } from './snapshot.ts';
export { parseCsv } from './data.ts';
export { DATA, DATA_HASH } from './data.generated.ts';
export {
  HOURS_PER_DAY, SEASON_DAYS, SEASONS,
  RESOURCE_KEYS, STOCK_KEYS, BEHAVIOR_INDEX, JOB_INDEX, TAG_BITS,
} from './constants.ts';
export type {
  AdvanceResult, PendingScene, SceneLogEntry, Death, Birth,
  Command, CommandResult, GameData, Job, Report, SaveV1, Season, Snapshot, StockKey, WorldOptions,
} from './types.ts';
