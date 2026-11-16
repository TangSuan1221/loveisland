// Worker ⇄ 主线程 消息协议。主线程只发「指令」，Worker 只发「快照 + 事件」（铁律 12：渲染层不写模拟状态）
import type { Command, SaveV1, SceneLogEntry, Snapshot } from '@cruel-isle/sim-core';

/** 静态元数据：开局发一次（名字、表格标签等，主线程查表用，不随快照重复传） */
export interface Meta {
  names: string[];
  tierLabels: string[];
  feelingNames: string[];
  feelingLabels: string[];
  sceneIds: string[];
  /** sceneId → 每个分支的 effect（事件卡「为什么」用） */
  sceneBranches: Record<string, Array<{ branch: string; effect: string }>>;
  catLabels: Record<string, string>;
  historyLines: Record<string, { label: string; good: string; bad: string }>;
  reactions: Record<string, { event: string; note: string }>;
  siteNames: string[];
  siteNotes: string[];
  /** scene_id → scene_cond（「为什么」第一行） */
  sceneConds: Record<string, string>;
  /** 需求警戒线（stocks.csv warn_threshold）：低于才在头顶显示需求图标 */
  warn: { satiety: number; hydration: number; rest: number; warmth: number; health: number };
  seed: number;
}

/** 本帧新发生的事（编年史 / 事件卡） */
export interface WorldEvent {
  kind: 'scene' | 'death' | 'birth' | 'discover' | 'over';
  day: number;
  hour: number;
  scene?: SceneLogEntry;
  /** 死亡/出生/发现的主语 id */
  who?: number;
  text: string;
  /** 0–100：≥85 强推事件卡，55–84 进编年史红点，<55 只计数（SPEC §11.4） */
  tension: number;
}

export type ToWorker =
  | { type: 'init'; seed: number; days: number }
  | { type: 'command'; cmd: Command; reqId: number }
  | { type: 'speed'; ticksPerSecond: number }
  | { type: 'pause'; paused: boolean }
  /** 高张力场景（≥85）抽中后自动暂停在「待结算」，等玩家看完场景卡再继续（SPEC §9 #10 / §11.4） */
  | { type: 'autoPause'; on: boolean }
  | { type: 'save'; reqId: number }
  | { type: 'load'; save: SaveV1 }
  | { type: 'ack' };                       // 主线程消费完一份快照（双缓冲：收到 ack 才发下一份）

export type FromWorker =
  | { type: 'meta'; meta: Meta }
  | { type: 'snapshot'; snap: Snapshot; events: WorldEvent[]; simMs: number; paused: boolean }
  | { type: 'saved'; reqId: number; save: SaveV1 }
  | { type: 'error'; message: string }
  | { type: 'commandResult'; reqId: number; result: { ok: boolean; reason?: string; [k: string]: unknown } };
