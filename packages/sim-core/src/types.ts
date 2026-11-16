// sim-core 类型契约（SPEC §3 / §10 / §11.2 / §13）
// 只用可擦除语法（无 enum / namespace / 参数属性），Node 原生 type-stripping 可直接运行。

/** CSV 行：全部保留原始字符串，数值由 num()/bool() 现场转换（与参考实现逐位一致） */
export type CsvRow = Record<string, string>;

export type Behavior = CsvRow;
export type Tier = CsvRow;
export type Modifier = CsvRow;
export interface GameData {
  needLadder: CsvRow[];
  behaviors: Behavior[];
  modifiers: Modifier[];
  gates: CsvRow[];
  stocks: CsvRow[];
  resources: CsvRow[];
  ladder: CsvRow[];
  reactions: CsvRow[];
  categories: CsvRow[];
  scenes: CsvRow[];
  history: CsvRow[];
  feelings: CsvRow[];
  aiPriority: CsvRow[];
  /** P1-2 资源点位（explore-sites.csv） */
  sites: CsvRow[];
}

export type SiteState = 'unknown' | 'known' | 'depleted';

/** P1-2 · 空间资源点。只有 known/depleted 的点位计入产出上限；unknown 恒为 0 */
export interface Site {
  id: string;
  resource: ResourceKey;
  x: number; y: number;
  capacity: number;
  regenPerDay: number;
  /** 1–4：越难越少被选中作为发现目标，探索烦恼的总权重也越低 */
  difficulty: number;
  /** >1 = 冬季探索更伤人；<1 = 冬季产出倍率（再生 × penalty） */
  winterPenalty: number;
  /** 'winter' = 只有冬季才能被发现（不在冬季时不计入"未知可探索点位"） */
  discoverSeason: 'any' | 'winter';
  state: SiteState;
  /** 当前可采量，日终按 regen 回升到 capacity */
  stock: number;
  discoveredDay: number | null;
}

export type StockKey = 'Satiety' | 'Hydration' | 'Rest' | 'Warmth' | 'Health';
export type ResourceKey = 'food' | 'water' | 'firewood';
export type Job = ResourceKey | 'idle';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type RelationTag =
  | 'Know' | 'Friend' | 'ExFriend' | 'Lover' | 'ExLover' | 'Couple'
  | 'Parent' | 'Child' | 'GrandParent' | 'GrandChild'
  | 'BrotherSisterOlder' | 'BrotherSisterYounger' | 'Relative' | 'Other' | 'Divorce'
  | 'Debtor' | 'Creditor' | 'Suspect';

export interface Traits { consc: number; agree: number; neuro: number; extra: number; grit: number }

export interface MemoryEntry { id: string; permanent: boolean; day: number }

export interface SurvivalState {
  tier:string; behavior:string; target?:number; retryAt?:number;
  cooldown:Record<string,number>; effects:Record<string,number>;
}
export interface Npc {
  skills?: Record<string,number>;
  survival?: SurvivalState;
  id: number;
  name: string;
  alive: boolean;
  stocks: Record<StockKey, number>;
  traits: Traits;
  feeling: string;
  job: Job;
  sleeping: boolean;
  born: number;
  frail: number;
  satietyZeroHours: number;
  dehydrateHours: number;
  hypothermiaHours: number;
  satietyZeroDays: number;
  bedridden: number;
  memories: MemoryEntry[];
  lastScoreMap: Record<string, number>;
  // 日内标记（日终清空，不存档）
  _shortToday?: boolean;
  _rationCut?: boolean;
  jobLockedToday?: boolean;
  /** P1-2 · 探索后休整到第几天（含）为止：该日 06:00 不排岗 */
  scoutRestUntil?: number;
}

export interface Relation { bond: number; strain: number; tags: Set<string> }

export interface Family { parents: Map<number, Set<number>>; children: Map<number, Set<number>> }

export interface Policy {
  rationPerPerson: number;
  favor: Set<number>;
  managerStrain: number;
  winterPrep: boolean;
  workforceScale: number;
}

export interface LadderTier { min: number; max: number; tier: string; label: string; semantic: string; shareOk: boolean }
export interface Reaction { id: string; event: string; delta: number; noRank: boolean; strain: number; note: string }
export interface Category { id: string; cat: string; label: string; base: number; gateMode: string; gateRP: number; gateScale: number }
export interface SceneBranch { sceneId: string; cat: string; party: number; cond: string; branch: string; rate: number; effect: string }
export interface Scene { id: string; cat: string; party: number; cond: string; branches: SceneBranch[] }
export interface HistoryParam { id: string; label: string; good: string; bad: string; permanent: boolean; condTag: string }
export interface FeelingDef { id: string; name: string; label: string; trigger: string; work: number; social: number }

export interface SceneCtx { F: number; T: number; A: number | null; rp: number }

export interface LogEntry { tick: number; day: number; hour: number; kind: string; msg: string }
export interface Death { id: number; name: string; day: number; hour: number; cause: string }
export interface Birth { id: number; day: number; parents: number[] }
export interface RationRecord { res: string; ratio: number; tick: number }
export interface SceneLogEntry {
  day: number; hour: number; scene: string; cat: string; branch: string;
  F: number; T: number; A: number | null; effect?: string; rp?: number;
}

export interface JobDemand {
  food: number; water: number; firewood: number;
  total: number; available: number; shortfall: number;
}

export interface DailyStat {
  day: number; season: Season; alive: number;
  food: number; water: number; firewood: number;
  rp: number; supplyRatio: number; avgBond: number; avgStrain: number; maxStrain: number;
  jobDemand: number; deaths: number; scenes: number; feedings: number;
  minHealth: number; minHydra: number; minWarm: number;
  prodFood: number; consFood: number;
  foodWorkers: number; waterWorkers: number; woodWorkers: number;
}

export interface Report {
  days: number; alive: number; deaths: Death[];
  deathCauses: Record<string, number>; scenes: number; scenesByCat: Record<string, number>;
  filteredScenes: number; tierDist: Record<string, number>; frogCases: number; fightsWhileFed: number;
  managerStrain: number; dailyStats: DailyStat[]; sceneSample: SceneLogEntry[]; log: LogEntry[];
  rngSeed: string;
}

export interface WorldOptions {
  days?: number; seed?: number; npcCount?: number;
  ration?: number; favor?: number[]; winterPrep?: boolean;
  workforceScale?: number; startScale?: number; maxNpc?: number;
  /** P1-2 · 开局点位状态：'csv'（默认，按 initial_state）/ 'unknown'（全部未知）/ 'known'（全部已知） */
  sitesStart?: 'csv' | 'unknown' | 'known';
  /**
   * P1-3 · 衰老（默认 true）。false = 退回 P1-2 规则：开局 born=-100+i、无年龄效果、
   * 人口上限按历史总人数（用于 parity 对照与回归排障）
   */
  aging?: boolean;
  /** 数值表注入（默认用构建期生成的 data.generated.ts）。运行期 fetch+parseCsv 也可以传进来 */
  data?: GameData;
}

export type Command =
  | { type: 'setRation'; value: number }
  | { type: 'setFavor'; ids: number[] }
  | { type: 'setWinterPrep'; value: boolean }
  | { type: 'setWorkforceScale'; value: number }
  | { type: 'assignJob'; npcId: number; job: Job }
  | { type: 'mediate'; a: number; b: number }
  | { type: 'exileVote'; targetId: number }
  | { type: 'setSpeed'; value: 0 | 1 | 2 | 4 | 8 | 16 };

export interface CommandResult { ok: boolean; reason?: string; [k: string]: unknown }

/**
 * P1-1 · 已抽签、未结算的场景（SPEC §10 pendingScene）。
 * 抽签（场景模板 + 参与者 + 分支）已消费 RNG；结算（applyEffect）尚未发生。
 * 读档后直接按 branchId 结算，**不重新抽签、不消耗 RNG**。
 */
export interface PendingScene {
  sceneId: string;
  branchId: string;
  participants: number[];          // [F, T] 或 [F, T, A]
  focus: number; target: number; another: number | null;
  rp: number;
  rolledAt: { day: number; hour: number };
  /** 抽完签后的 RNG 状态（splitmix64 的 s，BigInt→string）。读档时必须等于 meta.rngState，否则存档损坏 */
  rngCursor: string;
}

/** P1-1 · 当晚烦恼阶段的进度（20:00 一次抽 n 场，逐场推进） */
export interface TroubleState {
  rp: number;
  /** 本晚开场时算好的类别权重；中途某场改了 Lover 标签也不重算（与一次性结算语义一致） */
  weights: Array<{ cat: string; eff: number }>;
  remaining: number;
}

/** advance() 的返回：停在一场待结算场景 / 完成一个 tick / 已结束 */
export type AdvanceResult = 'scene' | 'tick' | 'over';

/** P1-1 · 日内中间量（日终清空）。缺了它们，20–23 点之间存档会分叉 */
export interface DayState {
  conflictToday: boolean;
  jobDemand: JobDemand | null;
  prod: Record<string, number>;
  cons: Record<string, number>;
  pendingTrouble: number | null;
  /** 每个 NPC：[_shortToday, _rationCut, jobLockedToday]，null = 未赋值（保持 undefined） */
  npcFlags: Array<[boolean | null, boolean | null, boolean | null]>;
}

export interface SaveV1 {
  version: 1;
  meta: { savedAt: number; day: number; hour: number; rngState: string; seed: number; totalDays: number;
    /** P1-3 · 缺省视为 false（P1-3 之前的存档没有年龄效果） */
    aging?: boolean; maxNpc?: number };
  ticks: number;
  policy: { rationPerPerson: number; favor: number[]; winterPrep: boolean; workforceScale: number; managerStrain: number };
  store: Record<string, number>;
  fireActive: boolean;
  griefDays: number;
  filteredScenes: number;
  rationHistory: RationRecord[];
  mediateCooldown: Array<[string, number]>;
  deaths: Death[];
  sceneLog: SceneLogEntry[];
  npcs: Array<{
    skills?: Record<string,number>;
    survival?: SurvivalState;
    id: number; name: string; alive: boolean; born: number; frail: number;
    stocks: Record<StockKey, number>; traits: Traits; feeling: string; job: Job; sleeping: boolean;
    satietyZeroHours: number; dehydrateHours: number; hypothermiaHours: number; satietyZeroDays: number;
    memories: MemoryEntry[];
    scoutRestUntil?: number;
  }>;
  /** P1-2 · 点位状态（缺省 = 按 explore-sites.csv 初始状态） */
  sites?: Array<{ id: string; state: SiteState; stock: number; discoveredDay: number | null }>;
  family: { parents: Array<[number, number[]]>; children: Array<[number, number[]]> };
  births: Birth[];
  relations: Array<{ from: number; to: number; bond: number; strain: number; tags: string[] }>;
  // ── P1-1 新增（可选：旧存档没有这些键，读档时按默认值处理）──
  dayState?: DayState;
  /** 非 null = 存档发生在 20:00 烦恼阶段中途（该 tick 的前半段已结算，后半段未结算） */
  trouble?: TroubleState | null;
  pendingScene?: PendingScene | null;
}

/**
 * 渲染层快照（SPEC §11.2）：纯 SoA typed arrays，禁止对象数组。
 * 每次调用都分配新的 ArrayBuffer，可直接作为 Transferable 投递（postMessage 第二参数用 transferList()）。
 * 关系为稀疏边表：只含「双方都存活」的有向边（16 人 ≤ 240 条）。
 * ⚠️ edgeStrain 只能用于线粗映射，UI 绝不显示数值（Strain 对玩家不可见）。
 */
export interface Snapshot {
  currentTarget: Int16Array; currentTier: Uint8Array; currentBehavior: Uint8Array;
  tick: number; day: number; hour: number; seasonIdx: number;
  fireActive: boolean; griefDays: number;
  /** [food, water, firewood] */
  store: Float32Array;
  count: number;
  id: Uint8Array;
  alive: Uint8Array;
  /** P1-2 引入空间点位前恒为 0；渲染层暂按 job 布点 */
  posX: Float32Array; posY: Float32Array;
  satiety: Float32Array; hydration: Float32Array; rest: Float32Array; warmth: Float32Array; health: Float32Array;
  /** feeling.csv 行序索引 */
  feeling: Uint8Array;
  /** JOB_INDEX 索引 */
  job: Uint8Array;
  edgeCount: number;
  edgeFrom: Uint8Array; edgeTo: Uint8Array;
  edgeBond: Float32Array; edgeStrain: Float32Array;
  /** 0–11，对应 relation-ladder.csv 行序 */
  edgeTier: Uint8Array;
  /** TAG_BITS 位掩码 */
  edgeTags: Uint32Array;
  // ── P1-1：待结算场景（渲染层据此播场景卡；-1 = 无）──
  /** scene-branch.csv 中场景首次出现的顺序索引 */
  pendingSceneIdx: number;
  /** 该场景 branches 内的索引 */
  pendingBranchIdx: number;
  pendingF: number; pendingT: number; pendingA: number;
  // ── P1-3 衰老 ──
  /** 年龄（岁） */
  age: Float32Array;
  /** 1 = Elder（≥ 60 岁） */
  elder: Uint8Array;
  // ── P1-2：资源点位（explore-sites.csv 行序）。坐标只供 UI 展示，不做寻路 ──
  siteCount: number;
  siteX: Float32Array; siteY: Float32Array;
  /** RESOURCE_KEYS 索引 */
  siteResource: Uint8Array;
  /** 0 = unknown（UI 可选择不画或画模糊提示），1 = known，2 = depleted */
  siteState: Uint8Array;
  /** 可采量 / capacity，0–1 */
  siteFill: Float32Array;
  // ── P2-1：玩家政策（UI 显示用；只读）──
  /** 全岛对管理者的怨气 0–100。UI 只画成情绪条，不显示数值 */
  managerStrain: number;
  rationPerPerson: number;
  winterPrep: boolean;
  /** 1 = 被偏袒（按 id 下标） */
  favor: Uint8Array;
  /** 当前季节索引之外的游戏时长（天），= maxDays */
  maxDays: number;
}
