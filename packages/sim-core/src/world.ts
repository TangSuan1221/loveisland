// 残酷小岛 · sim-core 世界模拟（由 sim/world.mjs 逐函数搬运）
//
// P0-2 纪律：只加类型、拆模块、把 CSV 读入改成可注入。**数值语义一字不改**。
//   - 方法名 / 字段名 / 调用顺序 / Map 插入顺序 与参考实现完全相同（RNG 消耗顺序依赖它）
//   - 等价性由 tools/parity.mjs 逐字段证明
//   - 零 IO、零 three 依赖：可在 Node / Worker / 浏览器直接运行
import {
  DRINK_HOURS, HOURS_PER_DAY, JOB_ALLOC_HOUR, MEAL_HOURS, SEASONS, SEASON_DAYS,
  SLEEP_HOURS, TROUBLE_HOUR, WORK_HOURS,
} from './constants.ts';
import { DATA } from './data.generated.ts';
import { buildTables, num } from './data.ts';
import {
  bloodDistance as _bloodDistance, linkParent as _linkParent, newFamily, sharesAncestry as _sharesAncestry,
  recomputeKinship as _recomputeKinship, updateOtherTag as _updateOtherTag,
} from './kinship.ts';
import { Rng } from './rng.ts';
import { DAYS_PER_YEAR, ELDER_AGE, ageFrailOf, ageOutputOf } from './aging.ts';
import { buildSnapshot } from './snapshot.ts';
import type {
  AdvanceResult, Birth, Category, Command, CommandResult, CsvRow, DailyStat, DayState, Death, Family, FeelingDef, GameData,
  HistoryParam, JobDemand, LadderTier, LogEntry, Npc, PendingScene, Policy, RationRecord, Reaction, Relation, Report,
  ResourceKey, SaveV1, Scene, SceneBranch, SceneCtx, SceneLogEntry, Season, Site, SiteState, Snapshot, StockKey,
  TroubleState, WorldOptions,
} from './types.ts';

type Store = Record<string, number>;

import {retryNeeds, tendFire, reserveRation, fightAllowed, mourn, availableWork, sceneActors, socialWeight, zeroDamage, survivalTick, surplus, romance} from './needs.ts';
export class World {
  // ── 数值表（实例私有副本）──
  readonly data: GameData;
  stocks: CsvRow[];
  resources: CsvRow[];
  ladder: LadderTier[];
  reactions: Map<string, Reaction>;
  categories: Category[];
  scenes: SceneBranch[];
  sceneIndex: Map<string, Scene>;
  history: Map<string, HistoryParam>;
  feelings: FeelingDef[];
  /** P1-2 · 空间资源点（explore-sites.csv 行序） */
  sites: Site[];

  // ── 状态 ──
  seed: number;
  /** P1-3 · 衰老开关（见 WorldOptions.aging） */
  aging: boolean;
  rng: Rng;
  tick: number;
  maxDays: number;
  log: LogEntry[];
  dailyStats: DailyStat[];
  store: Store;
  fireActive: boolean;
  rationHistory: RationRecord[];
  policy: Policy;
  npcs: Npc[];
  rel: Map<string, Relation>;
  griefDays: number;
  deaths: Death[];
  sceneLog: SceneLogEntry[];
  filteredScenes: number;
  assertions: unknown[];
  mediateCooldown: Map<string, number>;
  conflictToday: boolean;
  family: Family;
  maxNpc: number;
  births: Birth[];

  // ── 运行期中间量（P1-1 起随 dayState 存档）──
  jobDemand?: JobDemand;
  pendingTrouble?: number;
  _temp = 0;
  _prod: Partial<Record<string, number>> = {};
  _cons: Partial<Record<string, number>> = {};

  // ── P1-1 · 场景中途状态 ──
  /** 20:00 烦恼阶段进行中（该 tick 的 stepBegin 已执行、stepEnd 未执行） */
  trouble: TroubleState | null = null;
  /** 已抽签、未结算的场景；advance() 返回 'scene' 时非空 */
  pendingScene: PendingScene | null = null;

  constructor(opts: WorldOptions = {}) {
    this.data = opts.data ?? DATA;
    const t = buildTables(this.data);
    this.stocks = t.stocks;
    this.resources = t.resources;
    this.ladder = t.ladder;
    this.reactions = t.reactions;
    this.categories = t.categories;
    this.scenes = t.scenes;
    this.sceneIndex = t.sceneIndex;
    this.history = t.history;
    this.feelings = t.feelings;
    // P1-2 · 点位不消耗 RNG（开局状态来自 CSV），所以 NPC 生成的随机序列不受影响
    const start = opts.sitesStart ?? 'csv';
    this.sites = (this.data.sites ?? []).map(r => {
      const state: SiteState = start === 'csv' ? (r.initial_state === 'known' ? 'known' : 'unknown') : start;
      return {
        id: r.site_id, resource: r.resource as ResourceKey,
        x: num(r.x), y: num(r.y), capacity: num(r.capacity), regenPerDay: num(r.regen_per_day),
        difficulty: Math.max(1, num(r.discover_difficulty)), winterPenalty: num(r.winter_penalty) || 1,
        discoverSeason: r.discover_season === 'winter' ? 'winter' : 'any',
        state, stock: state === 'known' ? num(r.capacity) : 0, discoveredDay: state === 'known' ? 0 : null,
      };
    });

    this.seed = opts.seed ?? 20260101;
    this.aging = opts.aging ?? true;
    this.rng = new Rng(this.seed);

    // ── 时间 ──
    this.tick = 0;
    this.maxDays = opts.days ?? 60;
    this.log = [];
    this.dailyStats = [];

    // ── 资源 ──
    this.store = {};
    const scale = opts.startScale ?? 1.0;
    for (const r of this.resources) {
      this.store[r.key] = num(r.initial) * scale;
    }
    this.fireActive = false;
    this.rationHistory = [];

    // ── 玩家策略 ──
    this.policy = {
      rationPerPerson: opts.ration ?? 1.0,
      favor: new Set(opts.favor ?? []),
      managerStrain: 0,
      winterPrep: opts.winterPrep ?? true,
      workforceScale: opts.workforceScale ?? 1.0,
    };

    // ── NPC ──
    this.npcs = [];
    const N = opts.npcCount ?? 12;
    for (let i = 0; i < N; i++) {
      const s = {} as Record<StockKey, number>;
      for (const st of this.stocks) s[st.key as StockKey] = num(st.max);
      s.Satiety = 70 + this.rng.int(30);
      const traits = {
        consc: 0.2 + this.rng.next() * 0.8,
        agree: 0.2 + this.rng.next() * 0.8,
        neuro: 0.2 + this.rng.next() * 0.8,
        extra: 0.2 + this.rng.next() * 0.8,
        grit: 0.2 + this.rng.next() * 0.8,
      };
      // P1-3 · 开局年龄打散，岁数需与开局家庭的代际一致（见 openingAge）。
      // 多消耗 1 次 RNG → 改变后续全部随机序列（任务卡：预期内，基准数字需整体更新）
      const born = this.aging ? -this.openingAge(i, N) * DAYS_PER_YEAR : -100 + i;
      this.npcs.push({
        id: i, name: `Mii${String(i).padStart(2, '0')}`,
        alive: true, stocks: s,
        traits,
        feeling: 'Normal',
        job: 'food',
        sleeping: false,
        born,
        // 个体脆弱度：grit 越低越怕冷（0.85 硬朗 … 1.35 虚弱）。只在失温方向起作用。
        frail: 0.85 + (1 - traits.grit) * 0.5,
        satietyZeroHours: 0, dehydrateHours: 0, hypothermiaHours: 0,
        satietyZeroDays: 0,
        bedridden: 0,
        memories: [],
        lastScoreMap: {},
      });
    }

    // ── 关系（全量有向，初始 100）── 插入顺序 a 外层 b 内层，RNG 消耗依赖它
    this.rel = new Map();
    for (const a of this.npcs) for (const b of this.npcs) {
      if (a.id === b.id) continue;
      this.rel.set(`${a.id}>${b.id}`, { bond: 100, strain: 0, tags: new Set(['Know']) });
    }

    this.griefDays = 0;
    this.deaths = []; this.sceneLog = [];
    this.filteredScenes = 0;
    this.assertions = [];
    this.mediateCooldown = new Map();
    this.conflictToday = false;
    // ── 亲属图（用于血缘标签推导）──
    this.family = newFamily();
    this.maxNpc = opts.maxNpc ?? 16;
    this.births = [];
    this.initFamilies();
    this.recomputeKinship();
  }

  /* ── 时间工具 ── */
  get day(): number { return Math.floor(this.tick / HOURS_PER_DAY); }
  get hour(): number { return this.tick % HOURS_PER_DAY; }
  get seasonIdx(): number { return Math.floor(this.day / SEASON_DAYS) % 4; }
  get season(): Season { return SEASONS[this.seasonIdx]; }
  get alive(): Npc[] { return this.npcs.filter(n => n.alive); }
  /** 已结束：全灭或跑满 maxDays */
  get isOver(): boolean { return this.alive.length === 0 || this.tick >= this.maxDays * HOURS_PER_DAY; }

  /* ────────────────── P1-3 · 衰老 ────────────────── */
  /**
   * 开局年龄（岁），须与 initFamilies 的代际一致（亲子相差 ≥ 16 岁）：
   *   祖辈 0,1 → 48–61 岁（开局唯一的老人家庭，会在第一年内步入 Elder）
   *   子辈 2,5 与配偶 3 → 22–29 岁；孙辈 4 → 0–5 岁
   *   另一家 8,9 → 24–33 岁；其子 6,7 → 1–7 岁
   *   无血缘 10,11+ → 16–45 岁
   * 每人消耗 1 次 RNG（rng.int）。
   */
  private openingAge(i: number, N: number): number {
    const r = (lo: number, span: number) => lo + this.rng.int(span);
    if (N >= 6) {
      if (i === 0 || i === 1) return r(48, 14);
      if (i === 2 || i === 3 || i === 5) return r(22, 8);
      if (i === 4) return r(0, 6);
    }
    if (N >= 10) {
      if (i === 8 || i === 9) return r(24, 10);
      if (i === 6 || i === 7) return r(1, 7);
    }
    return r(16, 30);
  }

  /** 年龄（岁）。aging=false 时恒为 30（无年龄效果） */
  ageOf(n: Npc): number {
    return this.aging ? (this.day - n.born) / DAYS_PER_YEAR : 30;
  }
  isElder(n: Npc): boolean { return this.aging && this.ageOf(n) >= ELDER_AGE; }
  /** 总脆弱度 = 性格 frail × ageFrail。只用于失温方向 */
  effectiveFrail(n: Npc): number {
    return (n.frail ?? 1) * (this.aging ? ageFrailOf(this.ageOf(n)) : 1);
  }

  /* ── 关系访问 ── */
  relOf(a: number | null | undefined, b: number | null | undefined): Relation | null {
    if (a == null || b == null || a === b) return null;
    return this.rel.get(`${a}>${b}`) ?? null;
  }

  /* ────────────────── 亲属图与血缘标签推导（实现见 kinship.ts）────────────────── */
  linkParent(p: number | null | undefined, c: number | null | undefined): void { _linkParent(this.family, p, c); }
  bloodDistance(a: number, b: number, maxDepth = 4): number { return _bloodDistance(this.family, a, b, maxDepth); }
  /** P1-3 · 是否有共同祖先（≤4 代）。夫妻不算 */
  isKin(a: number, b: number): boolean { return _sharesAncestry(this.family, a, b, 4); }
  recomputeKinship(): void { _recomputeKinship(this.family, this.rel, this.npcs, (a, b) => this.relOf(a, b)); }
  updateOtherTag(): void { _updateOtherTag(this.npcs, (a, b) => this.relOf(a, b)); }

  /** 开局家庭：覆盖 Parent/Child/GrandParent/GrandChild/BrotherSister/Relative/Couple */
  initFamilies(): void {
    const n = this.npcs.length;
    if (n < 6) return;
    const R = (a: number, b: number) => this.relOf(a, b)!;
    const couple = (a: number, b: number) => {
      R(a, b).tags.add('Couple');
      R(b, a).tags.add('Couple');
      R(a, b).bond = 180;
      R(b, a).bond = 180;
    };
    const child = (a: number, b: number, c: number) => {
      this.linkParent(a, c); this.linkParent(b, c);
      R(a, c).bond = 180; R(c, a).bond = 180;
      R(b, c).bond = 180; R(c, b).bond = 180;
    };
    if (n >= 6) {
      couple(0, 1);
      child(0, 1, 2);
      child(0, 1, 5);
      couple(2, 3);
      child(2, 3, 4);
    }
    if (n >= 10) {
      couple(8, 9);
      child(8, 9, 6);
      child(8, 9, 7);
    }
  }

  hasTagAnywhere(tag: string): boolean {
    for (const [, r] of this.rel) if (r.tags.has(tag)) return true;
    return false;
  }

  /**
   * 新增一个婴儿（受 maxNpc 限制，按历史总人数计——与 P1-2 相同）。
   * P1-3：双亲若有共同祖先则不生（铁律 10 的第二道闸，防 P1-3 之前存档里残留的血亲伴侣）。
   * 生育规则本身（育龄、代际更替）暂不做，见 SPEC §16.1。
   */
  birth(aId: number | null | undefined, bId: number | null | undefined): Npc | null {
    if (this.npcs.length >= this.maxNpc) return null;
    if (aId == null || bId == null) return null;
    const a = this.npc(aId), b = this.npc(bId);
    if (!a?.alive || !b?.alive) return null;
    if (this.aging && this.isKin(aId, bId)) return null;
    const id = this.npcs.length;
    const mix = (x: number, y: number) => Math.max(0, Math.min(1, (x + y) / 2 + (this.rng.next() - 0.5) * 0.2));
    const s = {} as Record<StockKey, number>;
    for (const st of this.stocks) s[st.key as StockKey] = num(st.max);
    s.Satiety = 70; s.Hydration = 70;
    const baby: Npc = {
      id, name: `Mii${String(id).padStart(2, '0')}`,
      alive: true, stocks: s,
      traits: {
        consc: mix(a.traits.consc, b.traits.consc),
        agree: mix(a.traits.agree, b.traits.agree),
        neuro: mix(a.traits.neuro, b.traits.neuro),
        extra: mix(a.traits.extra, b.traits.extra),
        grit: mix(a.traits.grit, b.traits.grit),
      },
      feeling: 'Normal', job: 'idle', sleeping: false,
      born: this.day,
      frail: 1.25,
      satietyZeroHours: 0, dehydrateHours: 0, hypothermiaHours: 0, satietyZeroDays: 0,
      bedridden: 0, memories: [], lastScoreMap: {},
    };
    this.npcs.push(baby);
    for (const other of this.npcs) {
      if (other.id === id) continue;
      this.rel.set(`${other.id}>${id}`, { bond: 100, strain: 0, tags: new Set(['Know']) });
      this.rel.set(`${id}>${other.id}`, { bond: 100, strain: 0, tags: new Set(['Know']) });
    }
    this.linkParent(aId, id);
    this.linkParent(bId, id);
    for (const p of [aId, bId]) {
      this.relOf(p, id)!.bond = 180;
      this.relOf(id, p)!.bond = 180;
    }
    this.recomputeKinship();
    this.births.push({ id, day: this.day, parents: [aId, bId] });
    this.pushLog('BIRTH', `${a.name} 与 ${b.name} 的孩子 ${baby.name} 出生（第 ${this.day} 天）`);
    return baby;
  }

  tierOf(bond: number): LadderTier {
    for (let i = this.ladder.length - 1; i >= 0; i--) {
      if (bond >= this.ladder[i].min) return this.ladder[i];
    }
    return this.ladder[0];
  }

  /** 档位索引 0–11（快照用） */
  tierIndexOf(bond: number): number {
    for (let i = this.ladder.length - 1; i >= 0; i--) if (bond >= this.ladder[i].min) return i;
    return 0;
  }

  /* ── 环境温度 ── */
  temp(): number {
    const base = { spring: 18, summer: 26, autumn: 14, winter: 2 }[this.season];
    const h = this.hour;
    const night = h < 6 || h >= 20;
    return base + (night ? (this.season === 'winter' ? -10 : -8) : 0);
  }

  /* ── 资源压力 ── */
  supplyRatio(): number {
    // 供给比 = 最近 12 次"实际配给满足率"的最低值。不能用库存天数（铁律 7）。
    if (!this.rationHistory.length) return 1;
    let m = 1;
    for (const r of this.rationHistory) m = Math.min(m, r.ratio);
    return m;
  }
  resourcePressure(): number {
    return Math.max(0.5, Math.min(3.0, 1 + (1 - this.supplyRatio()) * 2));
  }
  resFor(key: string): CsvRow { return this.resources.find(r => r.key === key)!; }

  /* ────────────────────── 主循环 ────────────────────── */
  run(): Report {
    const totalTicks = this.maxDays * HOURS_PER_DAY;
    for (this.tick = 0; this.tick < totalTicks; this.tick++) {
      this.step();
      if (this.alive.length === 0) {
        this.pushLog('TOTAL_WIPE', `全灭于第 ${this.day} 天 ${this.hour} 时`);
        break;
      }
    }
    return this.report();
  }

  /**
   * 推进 1 tick（渲染/Worker 用）：内部循环 advance() 直到本 tick 结束，场景即抽即结算。
   * 与 run() 逐 tick 等价（但从当前 tick 继续，而不是从 0 开始）。
   * 返回 false 表示已结束（全灭 / 跑满），此时不再推进。
   */
  tickOnce(): boolean {
    let r: AdvanceResult;
    do { r = this.advance(); } while (r === 'scene');
    return r === 'tick';
  }

  /**
   * P1-1 · 可中断推进：在「场景已抽签、未结算」处停下（返回 'scene'），供渲染层播场景卡 / 暂停 / 存档。
   *   'scene' → this.pendingScene 已就绪；再次调用 advance() 才结算它并继续
   *   'tick'  → 完成了一个完整 tick（tick 已 +1）
   *   'over'  → 已结束（全灭 / 跑满），不再推进
   * 连续调用 advance() 与 step()+tick++ 的结果逐位相同：抽签与结算之间不消耗任何 RNG。
   */
  advance(): AdvanceResult {
    if (this.pendingScene) {
      const p = this.pendingScene;
      this.pendingScene = null;
      this.commitScene(p);
    } else if (!this.trouble) {
      if (this.isOver) return 'over';
      this.stepBegin();
      if (this.hour === TROUBLE_HOUR) this.beginTrouble();
    }
    if (this.trouble) {
      while (this.trouble.remaining > 0) {
        const p = this.drawNextScene();
        if (p) { this.pendingScene = p; return 'scene'; }
      }
      this.trouble = null;
    }
    this.stepEnd();
    if (this.alive.length === 0) {
      this.pushLog('TOTAL_WIPE', `全灭于第 ${this.day} 天 ${this.hour} 时`);
      return 'over';
    }
    this.tick++;
    return this.isOver ? 'over' : 'tick';
  }

  /** 结算当前 tick（不推进 tick）。主循环顺序见 SPEC §2，不可改。 */
  step(): void {
    if (this.trouble || this.pendingScene) {
      throw new Error('step() 不能在场景中途调用：当前 tick 已部分结算，请用 advance() / tickOnce() 继续');
    }
    this.stepBegin();
    if (this.hour === TROUBLE_HOUR) this.rollTrouble();
    this.stepEnd();
  }

  /** §2 第 1–7 步：哀悼递减 → 06:00 烧柴/分岗 → 温度 → 存量 → 进食/饮水 → 生产 */
  private stepBegin(): void {
    const h = this.hour;
    this.griefDays = Math.max(0, this.griefDays - (h === 0 ? 1 : 0));

    if (h === JOB_ALLOC_HOUR) this.burnFirewood();
    if (h === JOB_ALLOC_HOUR) this.allocateJobs();

    this.envTick();
    for (const n of this.alive) { this.stockTick(n); survivalTick(this,n); }

    // 单餐上限 = 半日量（防止一餐吃光一天），但不超过"补满所需"
    if (MEAL_HOURS.has(h)) this.consumeMeal('food', 0.5, 'Satiety', 62);
    if (DRINK_HOURS.has(h)) this.consumeMeal('water', 0.6, 'Hydration', 100);
    if (WORK_HOURS.has(h)) this.produce();
    retryNeeds(this);
  }

  /** §2 第 9–11 步：情绪 → 死亡 → 23:00 日终 */
  private stepEnd(): void {
    for (const n of this.alive) this.updateFeeling(n);
    this.checkDeaths();
    if (this.hour === 23) this.endOfDay();
  }

  /* ── 柴火：全有或全无 ── */
  burnFirewood(): void {
    if (this.season !== 'winter') { this.fireActive = false; return; }
    const need = this.alive.length * 0.5;
    if (this.store.firewood >= need) {
      this.store.firewood -= need;
      this.fireActive = true;
      tendFire(this);
    } else {
      const got = this.store.firewood;
      this.store.firewood = 0;
      this.fireActive = false;
      if (got > 0) this.pushLog('FIRE_SHORT', `柴火不足：需 ${need.toFixed(1)} 得 ${got.toFixed(1)}`);
    }
  }

  /* ── 岗位分配：冬季必然超订 ── */
  allocateJobs(): void {
    const alive = this.alive;
    const N = alive.length;
    if (N === 0) return;
    const seasonMod = this.season;

    const need: Record<string, number> = {
      food: N * num(this.resFor('food').per_person_day),
      water: N * num(this.resFor('water').per_person_day) * (this.season === 'summer' ? 1.5 : 1.0),
      firewood: this.season === 'winter' ? N * 0.5 : 0,
    };
    const baseNeed = { ...need };   // 真实日需求（不含加派/冬储），用于致命底线
    // 短缺时加派人手（1.5x 安全系数）——这是 NPC 的自救行为，不是玩家指令
    for (const k of ['food', 'water']) {
      const per = N * num(this.resFor(k).per_person_day) || 1;
      if (this.store[k] / per < 2) need[k] *= 1.5;
    }
    // 秋末冬储：把"冬季 15 天所需柴火"摊到秋季剩余天数上（玩家政策 winterPrep）
    if (this.policy.winterPrep && this.season === 'autumn') {
      const daysLeft = SEASON_DAYS - (this.day % SEASON_DAYS);
      const winterNeed = N * 0.5 * SEASON_DAYS;
      const gap = Math.max(0, winterNeed - this.store.firewood);
      need.firewood = gap / Math.max(1, daysLeft);
    }
    const workersFor = (key: string, src: Record<string, number> = need) => {
      const r = this.resFor(key);
      const per = num(r[seasonMod]) * num(r.per_worker_day);
      if (per <= 0 || src[key] <= 0) return 0;
      return Math.ceil(src[key] / per);
    };

    const want: Record<string, number> = {
      food: workersFor('food'),
      water: workersFor('water'),
      firewood: workersFor('firewood'),
    };
    const keys = ['food', 'water', 'firewood'];
    // 秋季给柴火 2x 权重（冬储优先），避免被贪心顺序饿死
    const weight: Record<string, number> = { food: 1.0, water: 1.0, firewood: this.season === 'autumn' ? 2.0 : 1.0 };

    // 精准指派的 NPC 当天不被覆盖
    const lockedByJob: Record<string, number> = { food: 0, water: 0, firewood: 0, idle: 0 };
    for (const n of alive) if (n.jobLockedToday) lockedByJob[n.job] = (lockedByJob[n.job] ?? 0) + 1;

    const capacity = alive.filter(n => !n.jobLockedToday && n.stocks.Satiety > 10 && n.stocks.Health > 20
      && !(n.scoutRestUntil != null && n.scoutRestUntil >= this.day));   // P1-2 · 昨晚出去探路的人今天休整
    let able = capacity.length ? capacity : alive.filter(n => !n.jobLockedToday);
    if (!able.length) able = [];
    // 劳动力系数：模拟疫病/伤病让一半人躺下
    const wscale = this.policy.workforceScale ?? 1.0;
    if (wscale < 1) {
      able = able.slice(0, Math.max(1, Math.round(able.length * wscale)));
    }

    // P0-1：按「真实可用劳力」而不是「存活人数」做比例缩放（铁律 8）
    const L = able.length + lockedByJob.food + lockedByJob.water + lockedByJob.firewood;
    const totalWant = keys.reduce((a, k) => a + want[k], 0);
    this.jobDemand = {
      food: want.food, water: want.water, firewood: want.firewood,
      total: totalWant, available: L, shortfall: Math.max(0, totalWant - L),
    };

    let alloc: Record<string, number>;
    if (totalWant <= L) {
      alloc = { ...want };
    } else {
      // P0-1 · 致命底线：水先拿到「真实需求」的人手；柴火不进底线（关冬储必冻死）
      const floor: Record<string, number> = { food: 0, water: 0, firewood: 0 };
      floor.water = Math.min(want.water, workersFor('water', baseNeed));
      let fl = floor.water;
      if (fl > L - 1) { floor.water = 0; fl = 0; }
      const rest = L - fl;
      const residual: Record<string, number> = {};
      let wsum = 0;
      for (const k of keys) { residual[k] = Math.max(0, want[k] - floor[k]); wsum += residual[k] * weight[k]; }
      alloc = {};
      for (const k of keys) {
        const share = wsum > 0 ? Math.floor((residual[k] * weight[k] / wsum) * rest) : 0;
        alloc[k] = want[k] > 0 ? Math.max(1, floor[k] + share) : 0;
      }
      let t = keys.reduce((a, k) => a + alloc[k], 0);
      while (t > L) {
        const k = keys.reduce((m, x) => (alloc[x] - floor[x] > alloc[m] - floor[m] ? x : m), 'food');
        if (alloc[k] > Math.max(1, floor[k])) { alloc[k]--; t--; } else break;
      }
    }
    // 先全部置 idle，再按名额分配（避免上一轮的 job 残留）
    for (const n of able) n.job = 'idle';
    let idx = 0;
    const assign = (key: 'food' | 'water' | 'firewood', cnt: number) => {
      const remain = Math.max(0, cnt - (lockedByJob[key] ?? 0));
      for (let i = 0; i < remain && idx < able.length; i++) able[idx++].job = key;
    };
    assign('food', alloc.food);
    assign('water', alloc.water);
    assign('firewood', alloc.firewood);

    // 余力：只有当食物库存低于"过冬储备目标"时才继续采集
    const reserve = N * 6;
    const surplusWorkers = Math.max(0, Math.min(
      able.length - idx,
      Math.ceil(Math.max(0, reserve - this.store.food) / 1.5),
    ));
    assign('food', surplusWorkers);
    while (idx < able.length) able[idx++].job = 'idle';
    for (const n of alive) if (!n.jobLockedToday && !able.includes(n)) n.job = 'idle';
  }

  /* ── 生产 ── */
  /** P0-1 · 承载力：carry = min(carry_max, (carry_k + carry_ref) / (carry_k + N))，只用四则运算 */
  carryFactor(r: CsvRow): number {
    const ref = num(r.carry_ref);
    if (ref <= 0) return 1;
    const k = num(r.carry_k);
    const cap = num(r.carry_max) || Infinity;
    return Math.min(cap, (k + ref) / (k + this.alive.length));
  }

  produce(): void {
    const seasonMod = this.season;
    const buckets: Record<string, number> = { food: 0, water: 0, firewood: 0 };
    for (const n of this.alive) {
      const available=availableWork(this,n);
      if (!available) continue;
      const f = this.feelingOf(n);
      // P1-3 · 老年劳动力衰减（60 岁起，85 岁降到 0.6）。aging=false 时乘子恒为 1，数值与 P1-2 逐位相同
      const ageMul = this.aging ? ageOutputOf(this.ageOf(n)) : 1;
      buckets[n.job] = (buckets[n.job] ?? 0) + f.work * available * ageMul;
    }
    const hours = WORK_HOURS.size;
    for (const key of Object.keys(buckets)) {
      const r = this.resFor(key);
      if (!r) continue;
      const per = num(r[seasonMod]) * num(r.per_worker_day) / hours * this.carryFactor(r);
      // P1-2 · 产出 = min(劳力产能, 已知点位当前可采量)。未发现的点位不贡献任何可采量
      const gain = this.harvest(key as ResourceKey, buckets[key] * per);
      this.store[key] = (this.store[key] ?? 0) + gain;
      this._prod[key] = (this._prod[key] ?? 0) + gain;
    }
  }

  /* ────────────────── P1-2 · 资源点位 ──────────────────
   * 点位只决定"能采多少"（上限），不改劳力公式；空间坐标只用于 UI 与快照（不做寻路）。
   */

  /** 该资源无点位定义 → 不受限（兼容旧数据注入） */
  private sitesOf(res: string): Site[] { return this.sites.filter(s => s.resource === res); }

  /** 从已知点位按表序扣除 want，返回实际采到的量。点位采空 → depleted（日终再生后恢复 known） */
  harvest(res: ResourceKey, want: number): number {
    const all = this.sitesOf(res);
    if (!all.length || want <= 0) return all.length ? 0 : want;
    let got = 0;
    for (const s of all) {
      if (s.state === 'unknown' || got >= want) continue;
      const take = Math.min(s.stock, want - got);
      s.stock -= take;
      got += take;
      if (s.stock <= 1e-9) { s.stock = 0; s.state = 'depleted'; }
    }
    return got;
  }

  /** 日终再生：已发现点位回升 regen（冬季 × winterPenalty<1 时的减产倍率），封顶 capacity */
  private regenSites(): void {
    const winter = this.season === 'winter';
    for (const s of this.sites) {
      if (s.state === 'unknown') continue;
      const mul = winter && s.winterPenalty < 1 ? s.winterPenalty : 1;
      s.stock = Math.min(s.capacity, s.stock + s.regenPerDay * mul);
      if (s.stock > 0) s.state = 'known';
    }
  }

  /** 当前可被探索到的未知点位（discover_season=winter 的点位只在冬季算数） */
  unknownSites(res?: string): Site[] {
    const winter = this.season === 'winter';
    return this.sites.filter(s => s.state === 'unknown'
      && (s.discoverSeason === 'any' || winter)
      && (res == null || s.resource === res));
  }

  /** 有未知点位时探索类烦恼的权重系数：1 / 剩余最易点位的难度（越难找越少有人出去找） */
  private exploreWeight(): number {
    const u = this.unknownSites();
    if (!u.length) return 0;
    let d = Infinity;
    for (const s of u) d = Math.min(d, s.difficulty);
    return 1 / d;
  }

  /**
   * 发现一个点位（effect `discover:<role>:<res|random>`）。
   * 目标在符合条件的未知点位中按 1/difficulty 加权抽取 —— 消耗 1 次 RNG（在结算段内，但完全由存档状态决定，
   * 读档后结算同样消耗同样的随机数，确定性不受影响）。无未知点位 → 无效果。
   */
  discover(npcId: number | null | undefined, res: string): Site | null {
    const pool = this.unknownSites(res === 'random' ? undefined : res);
    if (!pool.length) return null;
    const s = pool.length === 1 ? pool[0] : this.rng.weighted(pool, x => 1 / x.difficulty);
    if (!s) return null;
    s.state = 'known';
    s.stock = s.capacity * 0.5;   // 刚发现：半满（之前没人采过但也没人清理）
    s.discoveredDay = this.day;
    const who = npcId != null ? this.npcs[npcId]?.name ?? '?' : '?';
    this.pushLog('DISCOVER', `${who} 发现了 ${s.id}（${s.resource}，第 ${this.day} 天）`);
    return s;
  }

  /**
   * 探索代价（effect `scout:<role>:<res|random>`）：耗体力 + 次日休整不排岗；
   * 冬季走向 winterPenalty>1 的目标点位会受伤（−5 × (penalty−1) × 10，即南林 −40%… 东泉 −20）。
   * 不消耗 RNG。
   */
  scout(npcId: number | null | undefined, res: string): void {
    const n = npcId == null ? undefined : this.npcs[npcId];
    if (!n?.alive) return;
    n.stocks.Rest = Math.max(0, n.stocks.Rest - 25);
    n.scoutRestUntil = this.day + 1;
    if (this.season === 'winter') {
      const pool = this.unknownSites(res === 'random' ? undefined : res);
      let worst = 1;
      for (const s of pool) worst = Math.max(worst, s.winterPenalty);
      if (worst > 1) n.stocks.Health = Math.max(0, n.stocks.Health - Math.round((worst - 1) * 20));
    }
  }

  /* ── 进食/饮水：按需取食 + 单餐上限（铁律 6）；短缺时按序分配（P0-1） ── */
  consumeMeal(resKey: string, unitsPerPerson: number, stockKey: StockKey, nutrition: number): void {
    const alive = this.alive;
    const N = alive.length;
    if (N === 0) return;
    let totalDemand = 0;
    const want = alive.map(n => {
      const maxShare = unitsPerPerson * this.policy.rationPerPerson;
      const need = Math.max(0, (100 - n.stocks[stockKey]) / nutrition);
      const take = Math.min(maxShare, need);
      totalDemand += take;
      return take;
    });
    if (totalDemand <= 0) return;

    const stock = this.store[resKey] ?? 0;
    const taken = Math.min(totalDemand, stock);
    this.store[resKey] = stock - taken;
    this._cons[resKey] = (this._cons[resKey] ?? 0) + taken;
    const ratio = taken / totalDemand;
    this.rationHistory.push({ res: resKey, ratio, tick: this.tick });
    if (this.rationHistory.length > 12) this.rationHistory.shift();

    if (ratio < 0.999) {
      this.pushLog('RATION_SHORT', `${resKey} 缺口：需 ${totalDemand.toFixed(2)} 得 ${taken.toFixed(2)}（${(ratio * 100).toFixed(0)}%）`);
    }
    // 序 = 被偏袒者 → 在岗劳力 → Health 高者 → id 小者
    const share = want.slice();
    if (ratio < 0.999) {
      const key = (n: Npc) => [this.policy.favor.has(n.id) ? 1 : 0, n.job !== 'idle' ? 1 : 0, n.stocks.Health, -n.id];
      const order = alive.map((_, i) => i).sort((a, b) => {
        const ka = key(alive[a]), kb = key(alive[b]);
        for (let j = 0; j < ka.length; j++) if (ka[j] !== kb[j]) return kb[j] - ka[j];
        return 0;
      });
      let rem = taken;
      for (const i of order) { const g = Math.min(want[i], rem); share[i] = g; rem -= g; }
    }
    alive.forEach((n, i) => {
      let gain=share[i]*nutrition;
      if (stockKey==='Satiety' && n.survival && n.stocks.Satiety+gain>=75 && gain>=25 && !n.survival.effects.Ration && reserveRation(this,n)) {
        gain-=25; n.survival.effects.Ration=1;
      }
      n.stocks[stockKey] = Math.min(100,n.stocks[stockKey]+gain);
      if (ratio < 0.7) n._shortToday = true;
      const fair = want[i] * ratio;
      if (share[i] < fair * 0.9) n._rationCut = true;
    });
  }

  /** 某资源的最近满足率（rationHistory 内的最低值） */
  ratioOf(res: string): number {
    let m = 1, seen = false;
    for (const r of this.rationHistory) {
      if (r.res !== res) continue;
      seen = true;
      m = Math.min(m, r.ratio);
    }
    return seen ? m : 1;
  }

  /* ── 存量结算 ── */
  envTick(): void {
    this._temp = this.temp();
  }

  stockTick(n: Npc): void {
    const asleep = SLEEP_HOURS.has(this.hour) && !this.crisisAwake(n);
    n.sleeping = asleep;
    for (const st of this.stocks) {
      const key = st.key as StockKey;
      if (key === 'Health') continue;
      let d = 0;
      if (key === 'Rest') d = asleep ? num(st.per_hour_sleep) : num(st.per_hour_wake);
      // 饱食/水分 24 小时都在掉（铁律 9）
      else if (key === 'Satiety' || key === 'Hydration') d = num(st.per_hour_wake);
      else if (key === 'Warmth') {
        // 趋近模型（铁律 5）：形式 d = (target − w) × 0.15 不变，只改 target 的计算
        let target = this.fireActive ? 100 : Math.min(100, (this._temp + 5) * 5);
        // P1-3 · 体弱者无火时的平衡点更低：target / 总脆弱度（性格 × 年龄）。
        // 只改 target 的「收敛速度」时，一夜过去所有人都冻到临界以下、掉血一样（实测老人死亡率仅比年轻人高 1%）；
        // 降低平衡点后，白天无火时老人也暖不起来 → 缺柴冬天里「先死最弱/最老的」。有火（target=100）时不受影响。
        if (this.aging && !this.fireActive) target = target < 0 ? target * this.effectiveFrail(n) : target / this.effectiveFrail(n);
        d = (target - n.stocks[key]) * 0.15;
        // 个体脆弱度：只在「失温」方向起作用。P1-3：× ageFrail（老人更怕冷），仍只作用于体温。
        // P1-3 修正既有 bug：原为 d /= frail（frail 越大掉得越慢，与「体弱者掉得更快」相反，导致孩子比老人先冻死）。
        // aging=false 时保留旧写法，供 parity 对照参考实现。
        if (d < 0) d = this.aging ? d * this.effectiveFrail(n) : d / (n.frail ?? 1);
      }
      n.stocks[key] = Math.max(0, Math.min(num(st.max), n.stocks[key] + d));
    }
    zeroDamage(this,n);

    // 恢复：吃饱喝足睡够 → 缓慢自愈
    if (n.stocks.Satiety > 40 && n.stocks.Hydration > 40 && n.stocks.Rest > 40 && n.stocks.Warmth > 30) {
      n.stocks.Health = Math.min(100, n.stocks.Health + 1);
    }
    n.stocks.Health = Math.max(0, Math.min(100, n.stocks.Health));
  }

  crisisAwake(n: Npc): boolean {
    if (!n.alive) return true;
    return n.stocks.Satiety <= 0 || n.stocks.Hydration <= 0 || n.stocks.Health <= 25 || this.griefDays > 0 && n.stocks.Rest < 5;
  }

  /* ── Feeling（10 种，优先级有序）── */
  updateFeeling(n: Npc): void {
    const s = n.stocks;
    const avgBond = this.avgBondOf(n);
    let f = 'Normal';
    if (s.Satiety < 20) f = 'Starving';
    else if (this.strainMax(n) >= 90 || (n.satietyZeroDays >= 2)) f = 'Desperate';
    else if (this.griefDays > 0) f = 'Depress';
    else if (this.strainMax(n) >= 70) f = 'Angry';
    else if (avgBond < 105 && this.strainMax(n) >= 40) f = 'Depress';
    else if (s.Health < 45 && avgBond < 115) f = 'Depress';
    else if (this.strainMax(n) >= 55 && avgBond < 110) f = 'Deject';
    else if (this.strainMax(n) >= 40) f = 'Irritate';
    else if (s.Warmth < 45 || this.supplyRatio() < 0.33) f = 'Worry';
    else if (s.Rest < 40) f = 'Careless';
    else if (s.Satiety > 60 && this.strainMax(n) < 30 && s.Health > 70) f = 'Good';
    n.feeling = f;
  }

  feelingOf(n: Npc): { work: number; social: number } {
    return this.feelings.find(f => f.name === n.feeling) ?? { work: 1, social: 1 };
  }
  strainMax(n: Npc): number {
    let m = 0;
    for (const b of this.npcs) {
      if (b.id === n.id) continue;
      const r = this.relOf(n.id, b.id);
      if (r && r.bond < 160) m = Math.max(m, r.strain);
    }
    return m;
  }
  avgBondOf(n: Npc): number {
    let s = 0, c = 0;
    for (const b of this.npcs) {
      if (b.id === n.id) continue;
      const r = this.relOf(n.id, b.id);
      if (r) { s += r.bond; c++; }
    }
    return c ? s / c : 100;
  }

  /* ────────────────────── 事件层 ──────────────────────
   * P1-1：每场场景拆成两段 ——
   *   draw（抽签：类别 → 模板 → 参与者 → 分支，消耗 RNG）→ PendingScene
   *   commit（结算：applyEffect + 写 sceneLog，**不消耗 RNG**）
   * 两段之间就是可存档的「场景中途」。一次性路径（rollTrouble / tryScene / resolveScene）
   * 只是把两段连着调，RNG 消耗顺序与拆分前逐位相同。
   */

  /** 20:00 一次性结算全部烦恼（step() 用） */
  rollTrouble(): void {
    this.beginTrouble();
    while (this.trouble!.remaining > 0) {
      const p = this.drawNextScene();
      if (p) this.commitScene(p);
    }
    this.trouble = null;
  }

  /** 算本晚类别权重与场数（不消耗 RNG） */
  private beginTrouble(): void {
    const rp = this.resourcePressure();
    const weights: Array<{ cat: string; eff: number }> = [];
    for (const c of this.categories) {
      let eff = 0;
      if (c.gateMode === 'always') eff = c.base * rp;
      else if (c.gateMode === 'gated') eff = Math.max(0, c.base * (rp - c.gateRP) * c.gateScale);
      else if (c.gateMode === 'winter') eff = this.season === 'winter' ? c.base * rp : 0;
      else if (c.gateMode === 'has_lover') eff = this.hasTagAnywhere('Lover') || this.hasTagAnywhere('Couple') ? c.base * rp : 0;
      else if (c.gateMode === 'after_death') eff = this.griefDays > 0 ? 400 : 0;
      else if (c.gateMode === 'has_unknown_site') eff = c.base * rp * this.exploreWeight();
      if (['Cloth','IslandEdit','Other','Question','Goods','RoomStyle'].includes(c.cat) && !surplus(this)) eff=0;
      if(c.cat==='Fight' && !fightAllowed(this,rp))eff=0;
      eff *= socialWeight(this,c.cat);
      if (eff > 0) weights.push({ cat: c.cat, eff });
    }
    const n = Math.max(2, Math.min(6, Math.round(2 + (rp - 1) * 1.6)));
    this.trouble = { rp, weights, remaining: n };
  }

  /** 抽本晚的下一场：成功返回待结算场景；本场空掷（无类别/无合格参与者/无分支）返回 null */
  private drawNextScene(): PendingScene | null {
    const t = this.trouble!;
    t.remaining--;
    const pickCat = this.rng.weighted(t.weights, w => w.eff);
    if (!pickCat) return null;
    return this.drawScene(pickCat.cat, t.rp);
  }

  /** tryScene 的抽签半段：本类别 → 兜底 Relation → 都不行则 filteredScenes++ */
  private drawScene(cat: string, rp: number): PendingScene | null {
    const r = this._drawSceneCat(cat, rp);
    if (r !== false) return r;
    if (cat !== 'Relation') {
      const r2 = this._drawSceneCat('Relation', rp);
      if (r2 !== false) return r2;
    }
    this.filteredScenes++;
    return null;
  }

  tryScene(cat: string, rp: number): void {
    const p = this.drawScene(cat, rp);
    if (p) this.commitScene(p);
  }

  _trySceneCat(cat: string, rp: number): boolean {
    const r = this._drawSceneCat(cat, rp);
    if (r === false) return false;
    if (r) this.commitScene(r);
    return true;
  }

  /**
   * 选模板 + 参与者 + 分支。
   *   false = 本类别找不到合格组合（调用方兜底 Relation）
   *   null  = 组合合格但无可选分支（参考实现里 resolveScene 记 filteredScenes 并"算作已处理"）
   */
  private _drawSceneCat(cat: string, rp: number): PendingScene | null | false {
    const candidates = [...this.sceneIndex.values()].filter(s => s.cat === cat);
    if (!candidates.length) return false;
    for (let attempt = 0; attempt < 80; attempt++) {   // ★ 硬上限，绝不 while(true)
      const scene = this.rng.pick(candidates);
      const alive = sceneActors(this,cat,scene.id);
      if (!alive.length && this.alive.length) continue;
      if (alive.length < scene.party) return false;
      // 参与者按关系加权（铁律 4）
      const victims = cat==='Fight' ? alive.filter(actor=>alive.some(target=>this.relOf(actor.id,target.id)?.tags.has('Suspect'))) : [];
      const initiators = victims.length ? victims : alive;
      const F = initiators[this.rng.int(initiators.length)];
      const others = alive.filter(n => n.id !== F.id);
      const pickByBond = (exclude: number | null, asTarget: boolean) => {
        const eligible = others.filter(n => n.id !== exclude);
        const suspects = cat==='Fight' && exclude===null ? eligible.filter(n=>this.relOf(F.id,n.id)?.tags.has('Suspect')) : [];
        const pool = suspects.length ? suspects : eligible;
        if (!pool.length) return null;
        return this.rng.weighted(pool, n => {
          const b = this.relOf(F.id, n.id)?.bond ?? 100;
          // 铁律 11：禁 Math.pow。平方用乘法
          const x = b / 100;
          const w = 1 + x * x; // bond 200 → 权重 5；bond 0 → 1
          // P1-3 · 老人更常成为场景对象（被照顾/被分食物）：只作用于 T 位，×1.3。仍是关系加权的乘子（铁律 4 不变）
          return asTarget && this.isElder(n) ? w * 1.3 : w;
        });
      };
      const T = pickByBond(null, true);
      if (!T) return false;
      const A = scene.party >= 3 ? pickByBond(T.id, false) : null;
      if (scene.party >= 3 && !A) return false;
      const ctx: SceneCtx = { F: F.id, T: T.id, A: A?.id ?? null, rp };
      if (!this.meetsCond(scene.cond, ctx)) continue;
      return this.drawBranch(scene, ctx);
    }
    return false;
  }

  /** resolveScene 的抽签半段：分支加权抽取（消耗 1 次 RNG）。无分支 → filteredScenes++ 返回 null */
  private drawBranch(scene: Scene, ctx: SceneCtx): PendingScene | null {
    const valid = scene.branches.filter(() => this.meetsCond(scene.cond, ctx));
    const chosen = this.rng.weighted(valid, b => b.rate);
    if (!chosen) { this.filteredScenes++; return null; }
    return {
      sceneId: scene.id, branchId: chosen.branch,
      participants: ctx.A != null ? [ctx.F, ctx.T, ctx.A] : [ctx.F, ctx.T],
      focus: ctx.F, target: ctx.T, another: ctx.A, rp: ctx.rp,
      rolledAt: { day: this.day, hour: this.hour },
      rngCursor: this.rng.s.toString(),
    };
  }

  /**
   * 结算半段：按已选分支执行效果并写编年史。**不消耗 RNG**（读档后直接调用它）。
   * 参与者在抽签后死亡也照常结算（边界 #8：事件已发生）。
   */
  private commitScene(p: PendingScene): void {
    const scene = this.sceneIndex.get(p.sceneId);
    const chosen = scene?.branches.find(b => b.branch === p.branchId);
    if (!scene || !chosen) {
      // 数值表变了（存档里的场景/分支已不存在）：跳过，不崩
      this.pushLog('PENDING_LOST', `待结算场景 ${p.sceneId}/${p.branchId} 已不在数值表中，跳过`);
      this.filteredScenes++;
      return;
    }
    const ctx: SceneCtx = { F: p.focus, T: p.target, A: p.another, rp: p.rp };
    const before = this.snapshotStrain();
    this.applyEffect(chosen.effect, ctx);
    if (this.snapshotStrain() > before) this.conflictToday = true;
    this.sceneLog.push({
      day: this.day, hour: this.hour, scene: scene.id, cat: scene.cat,
      branch: chosen.branch, F: ctx.F, T: ctx.T, A: ctx.A,
      effect: chosen.effect, rp: ctx.rp,
    });
  }

  meetsCond(cond: string, ctx: SceneCtx): boolean {
    const { F, T } = ctx;
    const bFT = this.relOf(F, T)?.bond ?? 100;
    const s = this.store;
    switch (cond) {
      case 'any': return true;
      case 'food_le_1': return s.food <= Math.max(1.0, this.alive.length * 0.5);
      case 'food_scarce': return this.ratioOf('food') < 0.8;
      case 'water_scarce': return this.ratioOf('water') < 0.8;
      case 'bond_lt_40': return bFT < 40;
      case 'bond_lt_60': return bFT < 60;
      case 'bond_ge_160': return bFT >= 160 && romance(this,F,T);
      // P1-3 修正既有 bug：告白不得发生在血亲之间（参考实现里父女会成为伴侣并生子）
      case 'romance_ok': return romance(this,F,T) && bFT >= 160 && !this.isKin(F, T);
      case 'winter_cold': return this.season === 'winter' && (this.npc(F).stocks.Warmth < 45 || this.npc(T).stocks.Warmth < 45);
      case 'target_sick': return this.npc(T).stocks.Health < 60;
      case 'dying': {
        const f = this.npc(F), t = this.npc(T);
        return f.stocks.Health <= 30 || t.stocks.Health <= 30
          || f.satietyZeroHours >= 2 || t.satietyZeroHours >= 2
          || f.dehydrateHours >= 2 || t.dehydrateHours >= 2
          || f.hypothermiaHours >= 2 || t.hypothermiaHours >= 2;
      }
      case 'after_death': return this.griefDays > 0;
      case 'strain_ge_60': return (this.relOf(F, T)?.strain ?? 0) >= 60;
      case 'bond_40_99': return bFT >= 40 && bFT < 100;
      case 'target_depress': return this.npc(T).feeling === 'Depress';
      case 'low_health': return this.npc(F).stocks.Health < 50 || this.npc(T).stocks.Health < 50;
      case 'is_lover':
      case 'has_lover': {
        const r1 = this.relOf(F, T), r2 = this.relOf(T, F);
        return !!(r1?.tags.has('Lover') || r2?.tags.has('Lover'));
      }
      case 'has_unknown_site': return this.unknownSites().length > 0;
      case 'is_couple': {
        const r1 = this.relOf(F, T), r2 = this.relOf(T, F);
        return !!(r1?.tags.has('Couple') || r2?.tags.has('Couple'));
      }
      default: return false;
    }
  }

  npc(id: number): Npc { return this.npcs[id]; }

  /* ────────────────────── L6 玩家指令 ────────────────────── */
  applyCommand(cmd: Command | { type: string; [k: string]: unknown }): CommandResult {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const c = cmd as Command;
    switch (c.type) {
      case 'setRation':
        this.policy.rationPerPerson = clamp(Number(c.value) || 0, 0, 2);
        return { ok: true, ration: this.policy.rationPerPerson };
      case 'setFavor':
        this.policy.favor = new Set((c.ids ?? []).filter(i => this.npc(i)?.alive));
        return { ok: true, favor: [...this.policy.favor] };
      case 'setWinterPrep':
        this.policy.winterPrep = !!c.value;
        return { ok: true };
      case 'setWorkforceScale':
        this.policy.workforceScale = clamp(Number(c.value) || 1, 0.05, 1);
        return { ok: true };
      case 'assignJob': {
        const n = this.npc(c.npcId);
        if (!n?.alive) return { ok: false, reason: 'dead' };
        if (!['food', 'water', 'firewood', 'idle'].includes(c.job)) return { ok: false, reason: 'bad_job' };
        if (['M96','M97','M98','M99'].includes(n.survival?.tier??'')) return {ok:false,reason:'survival'};
        n.job = c.job;
        n.jobLockedToday = true;   // 精准指派：当轮不被 06:00 分配覆盖
        return { ok: true };
      }
      case 'mediate': return this.mediate(c.a, c.b);
      case 'exileVote': return this.exileVote(c.targetId);
      case 'setSpeed': return { ok: true, speed: c.value }; // 渲染层消费
      default: return { ok: false, reason: 'unknown_command' };
    }
  }

  /** 调解：降低双方 Strain；对高压关系会失败并加剧 */
  mediate(aId: number, bId: number): CommandResult {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const a = this.npc(aId), b = this.npc(bId);
    if (!a?.alive || !b?.alive) return { ok: false, reason: 'dead' };
    if (aId === bId) return { ok: false, reason: 'same_npc' };
    const r = this.relOf(aId, bId);
    const rb = this.relOf(bId, aId);
    if (!r || !rb) return { ok: false, reason: 'no_relation' };

    const key = aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
    const last = this.mediateCooldown.get(key);
    if (last != null && this.day - last < 3) {
      return { ok: false, reason: 'cooldown', daysLeft: 3 - (this.day - last) };
    }
    this.mediateCooldown.set(key, this.day);
    this.policy.managerStrain = clamp(this.policy.managerStrain + 5, 0, 100);

    const worst = Math.max(r.strain, rb.strain);
    if (worst >= 90) {
      r.strain = clamp(r.strain + 10, 0, 100);
      rb.strain = clamp(rb.strain + 10, 0, 100);
      r.bond = clamp(r.bond - 20, 0, 200);
      this.pushLog('MEDIATE_FAIL', `${aId}↔${bId} 调解失败（Strain ${worst.toFixed(0)}）`);
      return { ok: false, reason: 'too_hostile', strain: worst };
    }
    r.strain = clamp(r.strain - 30, 0, 100);
    rb.strain = clamp(rb.strain - 30, 0, 100);
    this.pushLog('MEDIATE_OK', `${aId}↔${bId} 调解成功 → Strain ${r.strain.toFixed(0)}`);
    return { ok: true, strain: r.strain, strainReverse: rb.strain };
  }

  /** 放逐投票：bond<40 的人过半数即放逐（死亡） */
  exileVote(targetId: number): CommandResult {
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const target = this.npc(targetId);
    if (!target?.alive) return { ok: false, reason: 'dead' };
    const others = this.alive.filter(n => n.id !== targetId);
    if (others.length === 0) return { ok: false, reason: 'no_voters' };
    const voters = others.filter(n => (this.relOf(n.id, targetId)?.bond ?? 100) < 40);
    const needed = Math.ceil(others.length / 2);
    if (voters.length >= needed && voters.length > 0) {
      target.alive = false;
      this.deaths.push({ id: target.id, name: target.name, day: this.day, hour: this.hour, cause: 'exile' });
      this.griefDays = 3;
      mourn(this,target);
      for (const m of others) {
        const r = this.relOf(m.id, target.id);
        if (r) r.bond = Math.min(200, r.bond + 20);
      }
      this.policy.managerStrain = clamp(this.policy.managerStrain + 20, 0, 100);
      this.pushLog('EXILE', `${target.name} 被放逐（${voters.length}/${needed} 票）`);
      return { ok: true, exiled: targetId, votes: voters.length, needed };
    }
    for (const v of voters) {
      const r = this.relOf(v.id, targetId);
      if (r) r.strain = clamp(r.strain + 40, 0, 100);
    }
    this.policy.managerStrain = clamp(this.policy.managerStrain + 8, 0, 100);
    return { ok: false, reason: 'vote_failed', votes: voters.length, needed };
  }

  /* ────────────────────── 存档 / 读档（SPEC §10）────────────────────── */
  save(): SaveV1 {
    return {
      version: 1,
      meta: {
        savedAt: Date.now(), day: this.day, hour: this.hour,
        rngState: this.rng.s.toString(), seed: this.seed, totalDays: this.maxDays,
        aging: this.aging, maxNpc: this.maxNpc,
      },
      ticks: this.tick,
      policy: {
        rationPerPerson: this.policy.rationPerPerson,
        favor: [...this.policy.favor],
        winterPrep: this.policy.winterPrep,
        workforceScale: this.policy.workforceScale,
        managerStrain: this.policy.managerStrain,
      },
      store: { ...this.store },
      fireActive: this.fireActive,
      griefDays: this.griefDays,
      filteredScenes: this.filteredScenes,
      rationHistory: this.rationHistory.map(r => ({ ...r })),
      mediateCooldown: [...this.mediateCooldown.entries()],
      deaths: this.deaths.map(d => ({ ...d })),
      sceneLog: this.sceneLog.slice(-200).map(s => ({ ...s })),
      npcs: this.npcs.map(n => ({
        ...(n.skills ? {skills:{...n.skills}} : {}), survival: structuredClone(n.survival), id: n.id, name: n.name, alive: n.alive, born: n.born, frail: n.frail,
        stocks: { ...n.stocks }, traits: { ...n.traits },
        feeling: n.feeling, job: n.job, sleeping: n.sleeping,
        satietyZeroHours: n.satietyZeroHours, dehydrateHours: n.dehydrateHours,
        hypothermiaHours: n.hypothermiaHours, satietyZeroDays: n.satietyZeroDays,
        memories: n.memories.map(m => ({ ...m })),
        ...(n.scoutRestUntil != null ? { scoutRestUntil: n.scoutRestUntil } : {}),
      })),
      sites: this.sites.map(s => ({ id: s.id, state: s.state, stock: s.stock, discoveredDay: s.discoveredDay })),
      family: {
        parents: [...this.family.parents.entries()].map(([k, v]) => [k, [...v]] as [number, number[]]),
        children: [...this.family.children.entries()].map(([k, v]) => [k, [...v]] as [number, number[]]),
      },
      births: this.births.map(b => ({ ...b })),
      // 只存偏离默认的边（默认：bond=100, strain=0, tags={Know}）
      relations: [...this.rel.entries()]
        .filter(([, r]) => r.bond !== 100 || r.strain !== 0
          || r.tags.size > 1 || (r.tags.size === 1 && !r.tags.has('Know')))
        .map(([k, r]) => {
          const [from, to] = k.split('>').map(Number);
          return { from, to, bond: r.bond, strain: r.strain, tags: [...r.tags] };
        }),
      // ── P1-1 ──
      dayState: {
        conflictToday: this.conflictToday,
        jobDemand: this.jobDemand ? { ...this.jobDemand } : null,
        prod: { ...this._prod } as Record<string, number>,
        cons: { ...this._cons } as Record<string, number>,
        pendingTrouble: this.pendingTrouble ?? null,
        npcFlags: this.npcs.map(n => [n._shortToday ?? null, n._rationCut ?? null, n.jobLockedToday ?? null]),
      },
      trouble: this.trouble ? { rp: this.trouble.rp, weights: this.trouble.weights.map(x => ({ ...x })), remaining: this.trouble.remaining } : null,
      pendingScene: this.pendingScene ? { ...this.pendingScene, participants: [...this.pendingScene.participants], rolledAt: { ...this.pendingScene.rolledAt } } : null,
    };
  }

  static load(s: SaveV1, data?: GameData): World {
    if (s?.version !== 1) throw new Error(`不支持的存档版本: ${(s as { version?: unknown })?.version}`);
    // P1-1 · 待结算场景的 RNG 游标必须等于存档 RNG：抽签后到存档之间不允许再消耗随机数
    if (s.pendingScene && s.pendingScene.rngCursor !== s.meta.rngState) {
      throw new Error(`存档损坏：pendingScene.rngCursor (${s.pendingScene.rngCursor}) ≠ meta.rngState (${s.meta.rngState})`);
    }
    if (s.pendingScene && !s.trouble) throw new Error('存档损坏：有 pendingScene 却没有 trouble 进度');
    const w = new World({
      days: s.meta.totalDays, seed: s.meta.seed, npcCount: s.npcs.length, data,
      aging: s.meta.aging ?? false, maxNpc: s.meta.maxNpc,
    });
    w.tick = s.ticks;
    w.maxDays = s.meta.totalDays;
    w.rng.s = BigInt(s.meta.rngState);
    Object.assign(w.policy, {
      rationPerPerson: s.policy.rationPerPerson,
      favor: new Set(s.policy.favor),
      winterPrep: s.policy.winterPrep,
      workforceScale: s.policy.workforceScale,
      managerStrain: s.policy.managerStrain,
    });
    w.store = { ...s.store };
    w.fireActive = s.fireActive;
    w.griefDays = s.griefDays;
    w.filteredScenes = s.filteredScenes;
    w.rationHistory = s.rationHistory.map(r => ({ ...r }));
    w.mediateCooldown = new Map(s.mediateCooldown);
    w.deaths = s.deaths.map(d => ({ ...d }));
    w.sceneLog = s.sceneLog.map(x => ({ ...x }));
    for (const sn of s.npcs) {
      const n = w.npcs[sn.id];
      Object.assign(n, {
        ...(sn.skills ? {skills:{...sn.skills}} : {}), survival: structuredClone(sn.survival), name: sn.name, alive: sn.alive, born: sn.born ?? (-100 + sn.id),
        frail: sn.frail ?? 1.0,
        stocks: { ...sn.stocks }, traits: { ...sn.traits }, feeling: sn.feeling,
        job: sn.job, sleeping: sn.sleeping,
        satietyZeroHours: sn.satietyZeroHours, dehydrateHours: sn.dehydrateHours,
        hypothermiaHours: sn.hypothermiaHours, satietyZeroDays: sn.satietyZeroDays,
        memories: sn.memories.map(m => ({ ...m })),
        scoutRestUntil: sn.scoutRestUntil,
      });
    }
    // P1-2 · 点位：按 id 回填；存档里没有的点位（新数据表加的）保持 CSV 初始状态
    for (const ss of s.sites ?? []) {
      const site = w.sites.find(x => x.id === ss.id);
      if (site) Object.assign(site, { state: ss.state, stock: ss.stock, discoveredDay: ss.discoveredDay });
    }
    if (s.family) {
      w.family.parents = new Map(s.family.parents.map(([k, v]) => [k, new Set(v)]));
      w.family.children = new Map(s.family.children.map(([k, v]) => [k, new Set(v)]));
    }
    w.births = (s.births ?? []).map(b => ({ ...b }));
    // P1-1 · 关系 Map 的键序必须与「不间断运行」一致（开局 a×b，之后每次出生在末尾追加 other>id, id>other）。
    // endOfDay 的 bond/strain 求和按此顺序累加，键序不同会让浮点和出现末位差异。
    w.rel = World.rebuildRelOrder(w.rel, s.npcs.length, w.births);
    for (const [, r] of w.rel) { r.bond = 100; r.strain = 0; r.tags.clear(); r.tags.add('Know'); }
    for (const e of s.relations) {
      const r = w.relOf(e.from, e.to);
      if (!r) continue;
      r.bond = e.bond; r.strain = e.strain;
      for (const t of e.tags) r.tags.add(t);
    }
    // ── P1-1：日内中间量 + 烦恼进度 + 待结算场景（旧存档无这些键 → 保持参考实现的默认行为）──
    if (s.dayState) {
      const d = s.dayState;
      w.conflictToday = d.conflictToday;
      w.jobDemand = d.jobDemand ? { ...d.jobDemand } : undefined;
      w._prod = { ...d.prod };
      w._cons = { ...d.cons };
      w.pendingTrouble = d.pendingTrouble ?? undefined;
      d.npcFlags.forEach(([a, b, c], i) => {
        const n = w.npcs[i];
        if (!n) return;
        if (a != null) n._shortToday = a;
        if (b != null) n._rationCut = b;
        if (c != null) n.jobLockedToday = c;
      });
    }
    w.trouble = s.trouble ? { rp: s.trouble.rp, weights: s.trouble.weights.map(x => ({ ...x })), remaining: s.trouble.remaining } : null;
    w.pendingScene = s.pendingScene
      ? { ...s.pendingScene, participants: [...s.pendingScene.participants], rolledAt: { ...s.pendingScene.rolledAt } }
      : null;
    if (w.trouble) w._temp = w.temp();   // 中途存档：本 tick 的 envTick 已执行过，补回温度缓存
    return w;
  }

  /** 按「开局 + 出生追加」的真实插入顺序重排关系 Map；出生记录与 id 不连续时保持原序 */
  private static rebuildRelOrder(rel: Map<string, Relation>, N: number, births: Birth[]): Map<string, Relation> {
    const babies = births.map(b => b.id);
    const base = N - babies.length;
    if (babies.some((id, i) => id !== base + i)) return rel;
    const out = new Map<string, Relation>();
    const put = (a: number, b: number) => {
      const k = `${a}>${b}`;
      const r = rel.get(k);
      if (r) out.set(k, r);
    };
    for (let a = 0; a < base; a++) for (let b = 0; b < base; b++) if (a !== b) put(a, b);
    for (const id of babies) for (let o = 0; o < id; o++) { put(o, id); put(id, o); }
    return out.size === rel.size ? out : rel;
  }

  resolveScene(scene: Scene, ctx: SceneCtx): void {
    const p = this.drawBranch(scene, ctx);
    if (p) this.commitScene(p);
  }

  snapshotStrain(): number {
    let s = 0;
    for (const [, r] of this.rel) s += r.strain;
    return s;
  }

  /* ── 效果 DSL（SPEC §7.6）── */
  applyEffect(str: string, ctx: SceneCtx): void {
    if (!str || str === 'none') return;
    const { F, T, A } = ctx;
    const who: Record<string, number | null> = { F, T, A };
    for (const tok of str.split(';')) {
      const t = tok.trim();
      if (!t) continue;
      const parts = t.split(':');
      const kind = parts[0];
      try {
        switch (kind) {
          case 'bond': {
            const [a, b] = parts[1].split('>');
            this.applyBond(who[a], who[b], num(parts[2]), false);
            break;
          }
          case 'strain': {
            const [a, b] = parts[1].split('>');
            if (b === 'P') { this.policy.managerStrain = Math.min(100, this.policy.managerStrain + num(parts[2])); }
            else this.applyStrain(who[a], who[b], num(parts[2]));
            break;
          }
          case 'react': {
            const r = this.reactions.get(parts[1]);
            if (!r) break;
            if (r.id === 'R17') {
              const rr = this.relOf(F, T);
              if (rr) rr.bond = 0;
              this.applyStrain(T, F, r.strain);
            } else {
              this.applyBond(F, T, r.delta, r.noRank);
              if (r.strain) this.applyStrain(F, T, r.strain);
            }
            break;
          }
          case 'tag': {
            const [a, b] = parts[1].split('>');
            const val = parts[2];
            const rr = this.relOf(who[a], who[b]);
            if (rr) {
              if (val.startsWith('+')) rr.tags.add(val.slice(1));
              else if (val.startsWith('-')) rr.tags.delete(val.slice(1));
            }
            break;
          }
          case 'transfer': {
            const res = parts[2], amt = num(parts[3]);
            if (amt < 0) this.store[res] = Math.max(0, (this.store[res] ?? 0) + amt);
            break;
          }
          case 'feeling': {
            const n = this.npcOrNull(who[parts[1]]);
            if (n) n.feeling = parts[2];
            break;
          }
          case 'health': {
            const n = this.npcOrNull(who[parts[1]]);
            if (n) n.stocks.Health = Math.max(0, Math.min(100, n.stocks.Health + num(parts[2])));
            break;
          }
          case 'mem': {
            const h = this.history.get(parts[1]);
            if (!h) break;
            for (const k of ['F', 'T', 'A']) {
              const n = this.npcOrNull(who[k]);
              if (!n) continue;
              if (!n.memories.some(m => m.id === h.id && m.permanent)) {
                n.memories.push({ id: h.id, permanent: h.permanent, day: this.day });
              }
            }
            break;
          }
          case 'couple': {
            const [a, b] = parts[1].split('>');
            const [x, y] = [who[a], who[b]];
            const r1 = this.relOf(x, y), r2 = this.relOf(y, x);
            if (r1) r1.tags.add('Couple');
            if (r2) r2.tags.add('Couple');
            break;
          }
          case 'breakup': {
            const [a, b] = parts[1].split('>');
            const [x, y] = [who[a], who[b]];
            for (const [p, q] of [[x, y], [y, x]]) {
              const r = this.relOf(p, q);
              if (!r) continue;
              r.tags.delete('Lover'); r.tags.delete('Couple'); r.tags.add('Divorce');
            }
            break;
          }
          case 'birth': {
            const [a, b] = parts[1].split('>');
            const child = this.birth(who[a], who[b]);
            if (child) this.applyBond(who[a], child.id, 180, false);
            break;
          }
          case 'discover': {
            this.discover(who[parts[1]], parts[2] ?? 'random');
            break;
          }
          case 'scout': {
            this.scout(who[parts[1]], parts[2] ?? 'random');
            break;
          }
          case 'trouble': {
            this.pendingTrouble = (this.pendingTrouble ?? 0) + 1;
            break;
          }
          case 'feed':
          case 'drink': {
            const n = this.npcOrNull(who[parts[1]]);
            if (!n) break;
            const res = kind === 'feed' ? 'food' : 'water';
            const stockKey: StockKey = kind === 'feed' ? 'Satiety' : 'Hydration';
            const nut = kind === 'feed' ? 62 : 100;
            const unit = kind === 'feed' ? 1 / 3 : 0.5;
            if ((this.store[res] ?? 0) >= unit) {
              this.store[res] -= unit;
              n.stocks[stockKey] = Math.min(100, n.stocks[stockKey] + unit * nut);
            }
            break;
          }
          default: break;
        }
      } catch (e) {
        this.pushLog('EFFECT_ERR', `${t} → ${(e as Error).message}`);
      }
    }
  }

  /** 与参考实现 `this.npc(undefined|null)` → undefined 的行为一致 */
  private npcOrNull(id: number | null | undefined): Npc | undefined {
    return id == null ? undefined : this.npcs[id];
  }

  /** 关系回写唯一入口；noRank = IsNoChangeRank（铁律 2，不许简化） */
  applyBond(aId: number | null | undefined, bId: number | null | undefined, delta: number, noRank: boolean): void {
    const r = this.relOf(aId, bId);
    if (!r) return;
    let next = r.bond + delta;
    if (delta < 0 && noRank) {
      const tier = this.tierOf(r.bond);
      next = Math.max(tier.min, next);
    }
    r.bond = Math.max(0, Math.min(200, next));
  }

  applyStrain(aId: number | null | undefined, bId: number | null | undefined, delta: number): void {
    const r = this.relOf(aId, bId);
    if (!r) return;
    r.strain = Math.max(0, Math.min(100, r.strain + delta));
  }

  /* ── 死亡 ── */
  checkDeaths(): void {
    for (const n of this.alive) {
      if (n.stocks.Health > 0) continue;
      n.alive = false;
      this.deaths.push({ id: n.id, name: n.name, day: this.day, hour: this.hour, cause: this.deathCause(n) });
      this.pushLog('DEATH', `${n.name} 死于 ${this.deathCause(n)}（第 ${this.day} 天）`);
      this.griefDays = 3;
      mourn(this,n);
      for (const m of this.alive) {
        const r = this.relOf(m.id, n.id);
        if (r) { r.bond = Math.min(200, r.bond + 20); }
        this.policy.managerStrain = Math.min(100, this.policy.managerStrain + 15);
      }
    }
  }
  deathCause(n: Npc): string {
    if (n.hypothermiaHours > 0) return 'hypothermia';
    if (n.dehydrateHours > 0) return 'dehydration';
    if (n.satietyZeroHours > 0) return 'starvation';
    return 'injury';
  }

  /* ── 日终 ── */
  endOfDay(): void {
    const alive = this.alive;
    const livingEdges = new Set(alive.flatMap(a=>alive.map(b=>this.relOf(a.id,b.id))));

    // ★ 资源短缺 → 集体记仇（Strain 唯一稳定来源）
    const sr = this.supplyRatio();
    if (sr < 0.5) {
      const amount = (0.5 - sr) * 40;
      for (const [, r] of this.rel) {
        if (livingEdges.has(r) && r.bond < 160) r.strain = Math.min(100, r.strain + amount);
      }
      this.policy.managerStrain = Math.min(100, this.policy.managerStrain + amount * 0.5);
    }
    for (const n of alive) {
      if (n._rationCut) {
        this.policy.managerStrain = Math.min(100, this.policy.managerStrain + 1);
        n._rationCut = false;
      }
    }
    if (this.policy.favor.size > 0) {
      const notFavored = alive.filter(n => !this.policy.favor.has(n.id)).length;
      this.policy.managerStrain = Math.min(100, this.policy.managerStrain + notFavored * 0.3);
    }

    // Strain 自然衰减（仅当天无负面互动时）+ 积怨腐蚀好感
    let strainSum = 0, bondSum = 0, pairs = 0;
    for (const [, r] of this.rel) {
      if (livingEdges.has(r) && !this.conflictToday) r.strain = Math.max(0, r.strain - 1);
      if (livingEdges.has(r) && r.strain >= 80) r.bond = Math.max(0, r.bond - 5);
      strainSum += r.strain; bondSum += r.bond; pairs++;
    }
    this.conflictToday = false;
    for (const n of alive) {
      if (n.stocks.Satiety <= 0) n.satietyZeroDays++;
      else n.satietyZeroDays = 0;
    }
    const rp = this.resourcePressure();
    this.dailyStats.push({
      day: this.day, season: this.season, alive: alive.length,
      food: +this.store.food.toFixed(1), water: +this.store.water.toFixed(1),
      firewood: +this.store.firewood.toFixed(1),
      rp: +rp.toFixed(2), supplyRatio: +this.supplyRatio().toFixed(2),
      avgBond: +(bondSum / (pairs || 1)).toFixed(1),
      avgStrain: +(strainSum / (pairs || 1)).toFixed(1),
      maxStrain: this.maxStrainAll(),
      jobDemand: this.jobDemand ? this.jobDemand.total : 0,
      deaths: this.deaths.length,
      scenes: this.sceneLog.filter(s => s.day === this.day).length,
      feedings: alive.filter(n => n._shortToday).length,
      minHealth: alive.length ? +Math.min(...alive.map(n => n.stocks.Health)).toFixed(0) : 0,
      minHydra: alive.length ? +Math.min(...alive.map(n => n.stocks.Hydration)).toFixed(0) : 0,
      minWarm: alive.length ? +Math.min(...alive.map(n => n.stocks.Warmth)).toFixed(0) : 0,
      prodFood: +(this._prod?.food ?? 0).toFixed(1),
      consFood: +(this._cons?.food ?? 0).toFixed(1),
      foodWorkers: alive.filter(n => n.job === 'food').length,
      waterWorkers: alive.filter(n => n.job === 'water').length,
      woodWorkers: alive.filter(n => n.job === 'firewood').length,
    });
    this._prod = {};
    this._cons = {};
    for (const n of alive) n._shortToday = false;
    for (const n of alive) n.jobLockedToday = false;
    this.regenSites();
    this.updateOtherTag();
  }

  maxStrainAll(): number {
    let m = 0;
    for (const [, r] of this.rel) m = Math.max(m, r.strain);
    return +m.toFixed(1);
  }

  pushLog(kind: string, msg: string): void {
    if (this.log.length < 400) this.log.push({ tick: this.tick, day: this.day, hour: this.hour, kind, msg });
  }

  /* ── 渲染层快照（SoA typed arrays，SPEC §11.2）── */
  snapshot(): Snapshot { return buildSnapshot(this); }

  /* ── 报告 ── */
  report(): Report {
    const byCat: Record<string, number> = {};
    for (const s of this.sceneLog) byCat[s.cat] = (byCat[s.cat] ?? 0) + 1;
    const causes: Record<string, number> = {};
    for (const d of this.deaths) causes[d.cause] = (causes[d.cause] ?? 0) + 1;
    const tiers: Record<string, number> = {};
    for (const [, r] of this.rel) {
      const t = this.tierOf(r.bond);
      tiers[t.tier] = (tiers[t.tier] ?? 0) + 1;
    }
    let frog = 0;
    for (const [, r] of this.rel) if (r.strain >= 70 && r.bond >= 100) frog++;
    const fightWhenFed = this.sceneLog.filter(s => s.cat === 'Fight' && (s.rp ?? 0) < 2.0).length;
    return {
      days: this.maxDays, alive: this.alive.length, deaths: this.deaths,
      deathCauses: causes, scenes: this.sceneLog.length, scenesByCat: byCat,
      filteredScenes: this.filteredScenes,
      tierDist: tiers, frogCases: frog, fightsWhileFed: fightWhenFed,
      managerStrain: +this.policy.managerStrain.toFixed(1),
      dailyStats: this.dailyStats,
      sceneSample: this.sceneLog.slice(0, 40),
      log: this.log,
      rngSeed: this.rng.s.toString(),
    };
  }
}
