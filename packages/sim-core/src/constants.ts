import type { Job, ResourceKey, Season, StockKey } from './types.ts';

export const HOURS_PER_DAY = 24;
export const SEASON_DAYS = 15;
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

export const SLEEP_HOURS: ReadonlySet<number> = new Set([22, 23, 0, 1, 2, 3, 4, 5]);
export const MEAL_HOURS: ReadonlySet<number> = new Set([8, 13, 19]);
export const DRINK_HOURS: ReadonlySet<number> = new Set([10, 16]);
export const WORK_HOURS: ReadonlySet<number> = new Set([9, 10, 11, 12, 13, 14, 15, 16, 17]);
export const JOB_ALLOC_HOUR = 6;
export const TROUBLE_HOUR = 20;

/** 血缘派生标签（recomputeKinship 负责维护） */
export const KIN_TAGS = ['Parent', 'Child', 'GrandParent', 'GrandChild',
  'BrotherSisterOlder', 'BrotherSisterYounger', 'Relative'] as const;

// ── 快照索引表（渲染层查表用；顺序即协议，只许在末尾追加）──
export const RESOURCE_KEYS: readonly ResourceKey[] = ['food', 'water', 'firewood'];
export const STOCK_KEYS: readonly StockKey[] = ['Satiety', 'Hydration', 'Rest', 'Warmth', 'Health'];
export const JOB_INDEX: readonly Job[] = ['idle', 'food', 'water', 'firewood'];
export const BEHAVIOR_INDEX: readonly string[] = [...JOB_INDEX,
  'EatHand','SeekFood','BegFood','StealFood','EatRot','EatNonFood','DrinkClean','BoilWater',
  'DrinkDirty','WarmAtFire','BurnFurniture','Huddle','SelfTreat','CallHelp','Rest','Retry',
  'Dying','SurviveSatiety','SurviveHydration','SurviveWarmth','SurviveHealth','Flee','FirstAid','Scene'];
export const TAG_BITS = [
  'Know', 'Friend', 'ExFriend', 'Lover', 'ExLover', 'Couple',
  'Parent', 'Child', 'GrandParent', 'GrandChild',
  'BrotherSisterOlder', 'BrotherSisterYounger', 'Relative', 'Other', 'Divorce',
  'Debtor', 'Creditor', 'Suspect',
] as const;
