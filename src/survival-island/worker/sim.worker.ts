/// <reference lib="webworker" />
// sim-core 跑在 Worker：固定步长，与渲染帧率完全解耦（SPEC §2 / §11.1）。
// 通信 = Transferable 双缓冲：主线程 ack 一份快照后，Worker 才发下一份 → 至多 1 帧延迟、零拷贝。
// 渲染层只能发指令（applyCommand），不能写模拟状态（铁律 12）。
import { DATA, World, transferList } from '@cruel-isle/sim-core';
import type { FromWorker, Meta, ToWorker, WorldEvent } from '../bridge/protocol.ts';
import { tensionOf } from './tension.ts';

const post = (m: FromWorker, transfer: Transferable[] = []) => (self as DedicatedWorkerGlobalScope).postMessage(m, transfer);

let world: World | null = null;
let ticksPerSecond = 2;          // 1× = 每真实秒 2 游戏小时（12 秒一天）。SPEC 的 20 分钟/天留给正式版设置
let paused = false;
let autoPause = true;
let holdOnScene = false;         // 正停在一场高张力的待结算场景上（等玩家「继续」）
let awaitingAck = false;
let carry = 0;
let last = performance.now();
let pendingEvents: WorldEvent[] = [];
let lastLog = 0, lastDeaths = 0, lastBirths = 0, discovered = new Set<string>(), overSent = false;

function warnOf(key: string): number {
  return Number(DATA.stocks.find(s => s.key === key)?.warn_threshold ?? 0);
}

function buildMeta(w: World, seed: number): Meta {
  const sceneBranches: Meta['sceneBranches'] = {};
  const sceneConds: Meta['sceneConds'] = {};
  for (const [id, sc] of w.sceneIndex) {
    sceneBranches[id] = sc.branches.map(b => ({ branch: b.branch, effect: b.effect }));
    sceneConds[id] = sc.cond;
  }
  const historyLines: Meta['historyLines'] = {};
  for (const [id, h] of w.history) historyLines[id] = { label: h.label, good: h.good, bad: h.bad };
  const reactions: Meta['reactions'] = {};
  for (const [id, r] of w.reactions) reactions[id] = { event: r.event, note: r.note };
  return {
    names: w.npcs.map(n => n.name),
    tierLabels: w.ladder.map(t => t.label),
    feelingNames: w.feelings.map(f => f.name),
    feelingLabels: w.feelings.map(f => f.label),
    sceneIds: [...w.sceneIndex.keys()],
    sceneBranches, sceneConds,
    catLabels: Object.fromEntries(w.categories.map(c => [c.cat, c.label])),
    historyLines, reactions,
    siteNames: w.sites.map(s => s.id),
    siteNotes: (DATA.sites ?? []).map(s => s.note),
    warn: {
      satiety: warnOf('Satiety'), hydration: warnOf('Hydration'), rest: warnOf('Rest'),
      warmth: warnOf('Warmth'), health: warnOf('Health'),
    },
    seed,
  };
}

function resetCursors(w: World) {
  lastLog = w.sceneLog.length;
  lastDeaths = w.deaths.length;
  lastBirths = w.births.length;
  discovered = new Set(w.sites.filter(s => s.state !== 'unknown').map(s => s.id));
  overSent = false;
  pendingEvents = [];
}

/** 收集自上次快照以来的新事件（只读 World） */
function collectEvents(w: World) {
  for (; lastLog < w.sceneLog.length; lastLog++) {
    const s = w.sceneLog[lastLog];
    pendingEvents.push({ kind: 'scene', day: s.day, hour: s.hour, scene: s, text: s.scene, tension: tensionOf(s) });
  }
  for (; lastDeaths < w.deaths.length; lastDeaths++) {
    const d = w.deaths[lastDeaths];
    pendingEvents.push({ kind: 'death', day: d.day, hour: d.hour, who: d.id, text: d.cause, tension: 100 });
  }
  for (; lastBirths < w.births.length; lastBirths++) {
    const b = w.births[lastBirths];
    pendingEvents.push({ kind: 'birth', day: b.day, hour: w.hour, who: b.id, text: b.parents.join('+'), tension: 70 });
  }
  for (const s of w.sites) {
    if (s.state !== 'unknown' && !discovered.has(s.id)) {
      discovered.add(s.id);
      pendingEvents.push({ kind: 'discover', day: s.discoveredDay ?? w.day, hour: w.hour, text: s.id, tension: 75 });
    }
  }
  if (w.isOver && !overSent) {
    overSent = true;
    pendingEvents.push({ kind: 'over', day: w.day, hour: w.hour, text: w.alive.length ? 'end' : 'wipe', tension: 100 });
  }
}

function sendSnapshot(simMs: number) {
  if (!world || awaitingAck) return;
  collectEvents(world);
  const snap = world.snapshot();
  const events = pendingEvents;
  pendingEvents = [];
  awaitingAck = true;
  post({ type: 'snapshot', snap, events, simMs, paused: paused || holdOnScene }, transferList(snap));
}

/** 待结算场景的张力 */
function pendingTension(w: World): number {
  const p = w.pendingScene;
  if (!p) return 0;
  const sc = w.sceneIndex.get(p.sceneId);
  const effect = sc?.branches.find(b => b.branch === p.branchId)?.effect;
  return tensionOf({ scene: p.sceneId, branch: p.branchId, cat: sc?.cat ?? '', effect });
}

function loop() {
  const now = performance.now();
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  let simMs = 0;
  try {
    if (world && !paused && !holdOnScene && !world.isOver) {
      carry += dt * ticksPerSecond;
      const t0 = performance.now();
      let steps = 0;
      while (carry >= 1 && steps < 64) {
        const r = world.advance();
        if (r === 'scene') {
          // 逐场推进：高张力场景停在「已抽签未结算」，让渲染层弹场景卡（SPEC §9 #10）
          if (autoPause && pendingTension(world) >= 85) { holdOnScene = true; carry = 0; break; }
          continue;
        }
        carry -= 1; steps++;
        if (r === 'over') break;
      }
      simMs = performance.now() - t0;
    }
  } catch (err) {
    post({ type: 'error', message: (err as Error).stack ?? String(err) });
    paused = true;
  }
  sendSnapshot(simMs);
  setTimeout(loop, 16);
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  try {
    switch (m.type) {
      case 'init': {
        world = new World({ seed: m.seed, days: m.days });
        resetCursors(world);
        holdOnScene = false; awaitingAck = false;
        post({ type: 'meta', meta: buildMeta(world, m.seed) });
        break;
      }
      case 'load': {
        world = World.load(m.save);
        resetCursors(world);
        holdOnScene = !!world.pendingScene; awaitingAck = false;
        post({ type: 'meta', meta: buildMeta(world, world.seed) });
        break;
      }
      case 'save': {
        if (world) post({ type: 'saved', reqId: m.reqId, save: world.save() });
        break;
      }
      case 'command': {
        // 指令是 L6 唯一合法入口：只走 applyCommand，不直接改 NPC
        const result = world ? world.applyCommand(m.cmd) : { ok: false, reason: 'no_world' };
        post({ type: 'commandResult', reqId: m.reqId, result });
        break;
      }
      case 'speed': ticksPerSecond = m.ticksPerSecond; break;
      case 'pause':
        paused = m.paused;
        if (!m.paused && holdOnScene && world) {
          // 玩家点「继续」：结算这一场，然后照常推进
          holdOnScene = false;
          world.advance();
        }
        break;
      case 'autoPause': autoPause = m.on; break;
      case 'ack': awaitingAck = false; break;
    }
  } catch (err) {
    post({ type: 'error', message: (err as Error).stack ?? String(err) });
  }
};

loop();
