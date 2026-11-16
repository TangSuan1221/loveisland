// 主线程侧的 Worker 客户端：收快照、ack、发指令。只持有「最新一份」快照（双缓冲的消费端）。
import type { Command, SaveV1, Snapshot } from '@cruel-isle/sim-core';
import type { FromWorker, Meta, ToWorker, WorldEvent } from './protocol.ts';

export class SimClient {
  private worker: Worker;
  private reqId = 0;
  private waiting = new Map<number, (v: unknown) => void>();
  meta: Meta | null = null;
  /** 当前帧使用的快照（front buffer） */
  front: Snapshot | null = null;
  /** 上一份快照（插值用） */
  back: Snapshot | null = null;
  /** front 到达的时刻（ms），用于 back→front 插值 */
  frontAt = 0;
  interval = 100;
  paused = false;
  simMs = 0;
  onEvents: (evs: WorldEvent[]) => void = () => {};
  onMeta: (m: Meta) => void = () => {};
  onError: (msg: string) => void = () => {};

  constructor() {
    this.worker = new Worker(new URL('../worker/sim.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.recv(e.data);
    this.worker.onerror = e => this.onError(e.message);
  }

  private send(m: ToWorker) { this.worker.postMessage(m); }

  private recv(m: FromWorker) {
    switch (m.type) {
      case 'meta': this.meta = m.meta; this.front = this.back = null; this.onMeta(m.meta); break;
      case 'snapshot': {
        const now = performance.now();
        if (this.front) this.interval = Math.max(16, Math.min(500, now - this.frontAt));
        this.back = this.front;      // 旧 front 退为 back（它的 buffer 已归主线程所有）
        this.front = m.snap;
        this.frontAt = now;
        this.paused = m.paused;
        this.simMs = m.simMs;
        if (m.events.length) this.onEvents(m.events);
        this.send({ type: 'ack' });
        break;
      }
      case 'commandResult': case 'saved': {
        const r = this.waiting.get(m.reqId);
        this.waiting.delete(m.reqId);
        r?.(m.type === 'saved' ? m.save : m.result);
        break;
      }
      case 'error': this.onError(m.message); break;
    }
  }

  init(seed: number, days: number) { this.send({ type: 'init', seed, days }); }
  load(save: SaveV1) { this.send({ type: 'load', save }); }
  setSpeed(ticksPerSecond: number) { this.send({ type: 'speed', ticksPerSecond }); }
  setPaused(paused: boolean) { this.send({ type: 'pause', paused }); }
  setAutoPause(on: boolean) { this.send({ type: 'autoPause', on }); }

  command(cmd: Command): Promise<{ ok: boolean; reason?: string; [k: string]: unknown }> {
    const reqId = ++this.reqId;
    return new Promise(res => {
      this.waiting.set(reqId, res as (v: unknown) => void);
      this.send({ type: 'command', cmd, reqId });
    });
  }

  save(): Promise<SaveV1> {
    const reqId = ++this.reqId;
    return new Promise(res => {
      this.waiting.set(reqId, res as (v: unknown) => void);
      this.send({ type: 'save', reqId });
    });
  }
}
