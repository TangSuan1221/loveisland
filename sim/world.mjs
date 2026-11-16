// 残酷小岛 · 参考实现 / 数值验证器
// 纯 ESM，零依赖，可在 Node 直接跑。
// 目的：证明这套设计「不会卡死、冬季会崩、戏剧会自己长出来」。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 参考实现自 P0-2 起冻结。P1-2 之后 data/ 增加了它不认识的规则（点位/探索），
// 所以它读一份冻结的 P1-1 数据快照（tools/ref-baseline-data/）。数值与 data/ 的公共部分逐字相同。
const DATA = path.join(__dirname, '..', 'tools', 'ref-baseline-data');

/* ────────────────────────── 0. 确定性随机 (PCG32 简化) ────────────────────────── */
export class Rng {
  constructor(seed = 0x12345678) {
    this.s = BigInt(seed) & 0xffffffffffffffffn;
  }
  next() {
    // splitmix64，跨平台一致（只用整数运算）
    this.s = (this.s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.s;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    z = z ^ (z >> 31n);
    return Number(z & 0x7fffffffn) / 2147483647; // [0,1)
  }
  int(n) { return Math.floor(this.next() * n) % n; }
  pick(arr) { return arr[this.int(arr.length)]; }
  weighted(items, keyFn) {
    const total = items.reduce((a, b) => a + keyFn(b), 0);
    if (total <= 0) return null;
    let r = this.next() * total;
    for (const it of items) { r -= keyFn(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }
}

/* ────────────────────────── 1. CSV 载入 ────────────────────────── */
export function loadCsv(name) {
  const p = path.join(DATA, name);
  const raw = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length);
  const head = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const o = {};
    head.forEach((h, i) => { o[h.trim()] = (cells[i] ?? '').trim(); });
    return o;
  });
}
const num = v => (v === '' || v == null ? 0 : Number(v));
const bool = v => v === '1' || v === 'true';

/* ────────────────────────── 2. 常量 ────────────────────────── */
export const HOURS_PER_DAY = 24;
export const SEASON_DAYS = 15;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

const SLEEP_HOURS = new Set([22, 23, 0, 1, 2, 3, 4, 5]);
const MEAL_HOURS = new Set([8, 13, 19]);
const DRINK_HOURS = new Set([10, 16]);
const WORK_HOURS = new Set([9, 10, 11, 12, 13, 14, 15, 16, 17]);
const JOB_ALLOC_HOUR = 6;
const TROUBLE_HOUR = 20;

/* ────────────────────────── 3. 世界 ────────────────────────── */
import {retryNeeds, tendFire, reserveRation, fightAllowed, mourn, availableWork, sceneActors, socialWeight, zeroDamage, survivalTick, surplus, romance} from '../packages/sim-core/src/needs.ts';
export class World {
  constructor(opts = {}) {
    this.seed = opts.seed ?? 20260101;
    this.rng = new Rng(this.seed);
    this.stocks = loadCsv('stocks.csv');
    this.resources = loadCsv('resources.csv');
    this.ladder = loadCsv('relation-ladder.csv').map(r => ({
      min: num(r.min), max: num(r.max), tier: r.tier, label: r.label_zh,
      semantic: r.survival_semantic, shareOk: bool(r.share_ok),
    })).sort((a, b) => a.min - b.min);
    this.reactions = new Map(loadCsv('relation-reaction.csv').map(r => [r.id, {
      id: r.id, event: r.event, delta: num(r.delta_bond),
      noRank: bool(r.is_no_change_rank), strain: num(r.strain_delta), note: r.note,
    }]));
    this.categories = loadCsv('trouble-category.csv').map(r => ({
      id: r.id, cat: r.category, label: r.label_zh, base: num(r.base_rate),
      gateMode: r.gate_mode, gateRP: num(r.gate_rp_threshold), gateScale: num(r.gate_scale),
    }));
    this.scenes = loadCsv('scene-branch.csv').map(r => ({
      sceneId: r.scene_id, cat: r.category, party: num(r.party),
      cond: r.scene_cond, branch: r.branch_id, rate: num(r.rate), effect: r.effect,
    }));
    this.sceneIndex = new Map();
    for (const s of this.scenes) {
      if (!this.sceneIndex.has(s.sceneId)) {
        this.sceneIndex.set(s.sceneId, { id: s.sceneId, cat: s.cat, party: s.party, cond: s.cond, branches: [] });
      }
      this.sceneIndex.get(s.sceneId).branches.push(s);
    }
    this.history = new Map(loadCsv('history-param.csv').map(r => [r.id, {
      id: r.id, label: r.label_zh, good: r.good_line, bad: r.bad_line,
      permanent: bool(r.is_permanent), condTag: r.cond_tag,
    }]));
    this.feelings = loadCsv('feeling.csv').map(r => ({
      id: r.id, name: r.feeling, label: r.label_zh, trigger: r.trigger,
      work: num(r.effect_work), social: num(r.effect_social),
    }));

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
    this.rationHistory = []; // 最近 24 小时配给满足率

    // ── 玩家策略 ──
    this.policy = {
      rationPerPerson: opts.ration ?? 1.0,
      favor: new Set(opts.favor ?? []),   // 被偏袒的 npc id
      managerStrain: 0,                    // 政治代价：Strain→管理者
      winterPrep: opts.winterPrep ?? true, // 秋季为冬季储备柴火
      workforceScale: opts.workforceScale ?? 1.0, // 可劳动人口比例（疫病/伤病）
    };

    // ── NPC ──
    this.npcs = [];
    const N = opts.npcCount ?? 12;
    for (let i = 0; i < N; i++) {
      const s = {};
      for (const st of this.stocks) s[st.key] = num(st.max);
      s.Satiety = 70 + this.rng.int(30);
      const traits = {
        consc: 0.2 + this.rng.next() * 0.8,
        agree: 0.2 + this.rng.next() * 0.8,
        neuro: 0.2 + this.rng.next() * 0.8,
        extra: 0.2 + this.rng.next() * 0.8,
        grit: 0.2 + this.rng.next() * 0.8,
      };
      this.npcs.push({
        id: i, name: `Mii${String(i).padStart(2, '0')}`,
        alive: true, stocks: s,
        traits,
        feeling: 'Normal',
        job: 'food',
        sleeping: false,
        born: -100 + i,     // 开局世代（负数 = 游戏开始前出生）
        // 个体脆弱度：grit 越低越怕冷（0.85 硬朗 … 1.35 虚弱）。只在失温方向起作用。
        frail: 0.85 + (1 - traits.grit) * 0.5,
        satietyZeroHours: 0, dehydrateHours: 0, hypothermiaHours: 0,
        satietyZeroDays: 0,
        bedridden: 0,
        memories: [],
        lastScoreMap: {},
      });
    }

    // ── 关系（全量有向，初始 100）──
    this.rel = new Map();
    for (const a of this.npcs) for (const b of this.npcs) {
      if (a.id === b.id) continue;
      this.rel.set(`${a.id}>${b.id}`, { bond: 100, strain: 0, tags: new Set(['Know']) });
    }

    this.griefDays = 0;
    this.deaths = [];    this.sceneLog = [];
    this.filteredScenes = 0;
    this.assertions = [];
    this.mediateCooldown = new Map(); // `${a}|${b}` -> day
    this.conflictToday = false;
    // ── 亲属图（用于血缘标签推导）──
    this.family = { parents: new Map(), children: new Map() };
    this.maxNpc = opts.maxNpc ?? 16;
    this.births = [];
    this.initFamilies();
    this.recomputeKinship();
  }

  /* ── 时间工具 ── */
  get day() { return Math.floor(this.tick / HOURS_PER_DAY); }
  get hour() { return this.tick % HOURS_PER_DAY; }
  get seasonIdx() { return Math.floor(this.day / SEASON_DAYS) % 4; }
  get season() { return SEASONS[this.seasonIdx]; }
  get alive() { return this.npcs.filter(n => n.alive); }

  /* ── 关系访问 ── */
  relOf(a, b) {
    if (a == null || b == null || a === b) return null;
    return this.rel.get(`${a}>${b}`) ?? null;
  }

  /* ────────────────── 亲属图与血缘标签推导 ──────────────────
   * 设计决策：血缘类是【客观事实】，由家庭图结构推导，不由事件概率决定；
   *           情感类（Lover/Couple/ExFriend/Divorce…）才由事件结果写入。
   */
  linkParent(p, c) {
    if (p == null || c == null || p === c) return;
    if (!this.family.parents.has(c)) this.family.parents.set(c, new Set());
    this.family.parents.get(c).add(p);
    if (!this.family.children.has(p)) this.family.children.set(p, new Set());
    this.family.children.get(p).add(c);
  }

  /** 无向血缘距离（只走父子边），超过 maxDepth 视为无血缘 */
  bloodDistance(a, b, maxDepth = 4) {
    if (a === b) return 0;
    const q = [[a, 0]];
    const seen = new Set([a]);
    while (q.length) {
      const [x, d] = q.shift();
      if (d >= maxDepth) continue;
      const nb = new Set();
      for (const p of this.family.parents.get(x) ?? []) nb.add(p);
      for (const c of this.family.children.get(x) ?? []) nb.add(c);
      for (const y of nb) {
        if (y === b) return d + 1;
        if (!seen.has(y)) { seen.add(y); q.push([y, d + 1]); }
      }
    }
    return Infinity;
  }

  /** 重算血缘派生标签：Parent / Child / GrandParent / GrandChild / BrotherSister(Older|Younger) / Relative */
  recomputeKinship() {
    const KIN = ['Parent', 'Child', 'GrandParent', 'GrandChild',
      'BrotherSisterOlder', 'BrotherSisterYounger', 'Relative'];
    for (const [, r] of this.rel) for (const t of KIN) r.tags.delete(t);

    const has = (m, k, v) => (m.get(k) ?? new Set()).has(v);
    for (const a of this.npcs) {
      for (const b of this.npcs) {
        if (a.id === b.id) continue;
        const r = this.relOf(a.id, b.id);
        if (!r) continue;
        // 亲子：正向 Parent，反向 Child
        if (has(this.family.children, a.id, b.id)) { r.tags.add('Parent'); continue; }
        if (has(this.family.parents, a.id, b.id)) { r.tags.add('Child'); continue; }
        // 祖孙：正向 GrandParent（我→我的孙），反向 GrandChild（我→我的祖）
        let grand = false;
        for (const c of this.family.children.get(a.id) ?? []) {
          if (has(this.family.children, c, b.id)) { grand = true; break; }
        }
        if (grand) { r.tags.add('GrandParent'); continue; }
        let grandChild = false;
        for (const p of this.family.parents.get(a.id) ?? []) {
          if (has(this.family.children, b.id, p)) { grandChild = true; break; }
        }
        if (grandChild) { r.tags.add('GrandChild'); continue; }
        // 同胞：共享至少一个亲代
        let sibling = false;
        for (const p of this.family.parents.get(a.id) ?? []) {
          if (has(this.family.parents, b.id, p)) { sibling = true; break; }
        }
        if (sibling) {
          r.tags.add(a.born <= b.born ? 'BrotherSisterOlder' : 'BrotherSisterYounger');
          continue;
        }
        // 其他血缘
        if (this.bloodDistance(a.id, b.id, 4) !== Infinity) r.tags.add('Relative');
      }
    }
  }

  /** Other = "选择的家人"：无血缘但 Bond ≥ 180。需随 Bond 变化动态维护。 */
  updateOtherTag() {
    const KIN = ['Parent', 'Child', 'GrandParent', 'GrandChild',
      'BrotherSisterOlder', 'BrotherSisterYounger', 'Relative'];
    for (const a of this.npcs) {
      for (const b of this.npcs) {
        if (a.id === b.id) continue;
        const r = this.relOf(a.id, b.id);
        if (!r) continue;
        const hasKin = KIN.some(t => r.tags.has(t));
        if (!hasKin && r.bond >= 180) r.tags.add('Other');
        else if (hasKin) r.tags.delete('Other');
      }
    }
  }

  /** 开局家庭：覆盖 Parent/Child/GrandParent/GrandChild/BrotherSister/Relative/Couple */
  initFamilies() {
    const n = this.npcs.length;
    if (n < 6) return;
    const rel = (a, b) => { this.relOf(a, b).bond = 180; this.relOf(b, a).bond = 180; };
    const couple = (a, b) => {
      this.relOf(a, b).tags.add('Couple');
      this.relOf(b, a).tags.add('Couple');
      this.relOf(a, b).bond = 180;
      this.relOf(b, a).bond = 180;
    };
    const child = (a, b, c) => {
      this.linkParent(a, c); this.linkParent(b, c);
      this.relOf(a, c).bond = 180; this.relOf(c, a).bond = 180;
      this.relOf(b, c).bond = 180; this.relOf(c, b).bond = 180;
    };
    if (n >= 6) {
      couple(0, 1);
      child(0, 1, 2);          // 0,1 → 2
      child(0, 1, 5);          // 0,1 → 5（与 2 同胞）
      couple(2, 3);
      child(2, 3, 4);          // 2,3 → 4（于是 0,1 是 4 的祖辈）
    }
    if (n >= 10) {
      couple(8, 9);
      child(8, 9, 6);
      child(8, 9, 7);          // 6,7 同胞
    }
    // 其余为无血缘岛民
    void rel;
  }

  hasTagAnywhere(tag) {
    for (const [, r] of this.rel) if (r.tags.has(tag)) return true;
    return false;
  }

  /** 新增一个婴儿（受 maxNpc 限制） */
  birth(aId, bId) {
    if (this.npcs.length >= this.maxNpc) return null;
    if (aId == null || bId == null) return null;
    const a = this.npc(aId), b = this.npc(bId);
    if (!a?.alive || !b?.alive) return null;
    const id = this.npcs.length;
    const mix = (x, y) => Math.max(0, Math.min(1, (x + y) / 2 + (this.rng.next() - 0.5) * 0.2));
    const s = {};
    for (const st of this.stocks) s[st.key] = num(st.max);
    s.Satiety = 70; s.Hydration = 70;
    const baby = {
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
      // 婴儿体弱
      frail: 1.25,
      satietyZeroHours: 0, dehydrateHours: 0, hypothermiaHours: 0, satietyZeroDays: 0,
      bedridden: 0, memories: [], lastScoreMap: {},
    };
    this.npcs.push(baby);
    // 扩充关系矩阵
    for (const other of this.npcs) {
      if (other.id === id) continue;
      this.rel.set(`${other.id}>${id}`, { bond: 100, strain: 0, tags: new Set(['Know']) });
      this.rel.set(`${id}>${other.id}`, { bond: 100, strain: 0, tags: new Set(['Know']) });
    }
    this.linkParent(aId, id);
    this.linkParent(bId, id);
    for (const p of [aId, bId]) {
      this.relOf(p, id).bond = 180;
      this.relOf(id, p).bond = 180;
    }
    this.recomputeKinship();
    this.births.push({ id, day: this.day, parents: [aId, bId] });
    this.pushLog('BIRTH', `${a.name} 与 ${b.name} 的孩子 ${baby.name} 出生（第 ${this.day} 天）`);
    return baby;
  }
  tierOf(bond) {
    for (let i = this.ladder.length - 1; i >= 0; i--) {
      if (bond >= this.ladder[i].min) return this.ladder[i];
    }
    return this.ladder[0];
  }

  /* ── 环境温度 ── */
  temp() {
    const base = { spring: 18, summer: 26, autumn: 14, winter: 2 }[this.season];
    const h = this.hour;
    const night = h < 6 || h >= 20;
    return base + (night ? (this.season === 'winter' ? -10 : -8) : 0);
  }

  /* ── 资源压力（公理6 的资源调制）── */
  supplyRatio() {
    // 供给比 = 最近 24 小时内"实际配给满足率"的最低值。
    // 不能用库存天数：即时生产的经济体库存天然低，会误判成永久饥荒。
    if (!this.rationHistory.length) return 1;
    let m = 1;
    for (const r of this.rationHistory) m = Math.min(m, r.ratio);
    return m;
  }
  resourcePressure() {
    return Math.max(0.5, Math.min(3.0, 1 + (1 - this.supplyRatio()) * 2));
  }
  resFor(key) { return this.resources.find(r => r.key === key); }

  /* ────────────────────── 主循环 ────────────────────── */
  run() {
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

  step() {
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
    if (h === TROUBLE_HOUR) this.rollTrouble();

    for (const n of this.alive) this.updateFeeling(n);
    this.checkDeaths();

    if (h === 23) this.endOfDay();
  }

  /* ── 柴火：全有或全无 ── */
  burnFirewood() {
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
  allocateJobs() {
    const alive = this.alive;
    const N = alive.length;
    if (N === 0) return;
    const seasonMod = { spring: 'spring', summer: 'summer', autumn: 'autumn', winter: 'winter' }[this.season];

    const need = {
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
    const workersFor = (key, src = need) => {
      const r = this.resFor(key);
      const per = num(r[seasonMod]) * num(r.per_worker_day);
      if (per <= 0 || src[key] <= 0) return 0;
      return Math.ceil(src[key] / per);
    };

    const want = {
      food: workersFor('food'),
      water: workersFor('water'),
      firewood: workersFor('firewood'),
    };
    const keys = ['food', 'water', 'firewood'];
    // 秋季给柴火 2x 权重（冬储优先），避免被贪心顺序饿死
    const weight = { food: 1.0, water: 1.0, firewood: this.season === 'autumn' ? 2.0 : 1.0 };

    // 精准指派的 NPC 当天不被覆盖
    const lockedByJob = { food: 0, water: 0, firewood: 0, idle: 0 };
    for (const n of alive) if (n.jobLockedToday) lockedByJob[n.job] = (lockedByJob[n.job] ?? 0) + 1;

    const capacity = alive.filter(n => !n.jobLockedToday && n.stocks.Satiety > 10 && n.stocks.Health > 20);
    let able = capacity.length ? capacity : alive.filter(n => !n.jobLockedToday);
    if (!able.length) able = [];
    // 劳动力系数：模拟疫病/伤病让一半人躺下
    const wscale = this.policy.workforceScale ?? 1.0;
    if (wscale < 1) {
      able = able.slice(0, Math.max(1, Math.round(able.length * wscale)));
    }

    // P0-1：按「真实可用劳力」而不是「存活人数」做比例缩放。
    // 旧写法按 N 算名额、再按 food→water→firewood 顺序发给 able，
    // 一旦 able < N，排在最后的岗位（水/柴）被整段截断 —— 这就是铁律 8 禁止的「贪心」。
    const L = able.length + lockedByJob.food + lockedByJob.water + lockedByJob.firewood;
    const totalWant = keys.reduce((a, k) => a + want[k], 0);
    this.jobDemand = { ...want, total: totalWant, available: L, shortfall: Math.max(0, totalWant - L) };

    let alloc;
    if (totalWant <= L) {
      alloc = { ...want };
    } else {
      // P0-1 · 致命底线：最快致死的资源（水：4h 掉血）先拿到「真实需求」的人手，
      // 不含短缺加派的 1.5x。余下劳力再按权重比例缩放。底线装不下时退回纯比例。
      // 注意：柴火【不】进底线 —— 冬季柴火超订、必须靠秋储，是 §4.2 的残酷发动机（关冬储必冻死）。
      const floor = { food: 0, water: 0, firewood: 0 };
      floor.water = Math.min(want.water, workersFor('water', baseNeed));
      let fl = floor.water;
      if (fl > L - 1) { floor.water = 0; fl = 0; }
      const rest = L - fl;
      // 超订：按权重比例缩放，每个非零需求至少保 1 人（防止某一项被彻底饿死）
      const residual = {};
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
    const assign = (key, cnt) => {
      const remain = Math.max(0, cnt - (lockedByJob[key] ?? 0));
      for (let i = 0; i < remain && idx < able.length; i++) able[idx++].job = key;
    };
    assign('food', alloc.food);
    assign('water', alloc.water);
    assign('firewood', alloc.firewood);

    // 余力：只有当食物库存低于"过冬储备目标"时才继续采集，否则闲着（社交/休息）
    const reserve = N * 6; // 6 天口粮储备目标
    const surplusWorkers = Math.max(0, Math.min(
      able.length - idx,
      Math.ceil(Math.max(0, reserve - this.store.food) / 1.5)
    ));
    assign('food', surplusWorkers);
    while (idx < able.length) able[idx++].job = 'idle';
    for (const n of alive) if (!n.jobLockedToday && !able.includes(n)) n.job = 'idle';
  }

  /* ── 生产 ── */
  // P0-1 · 承载力：同一片林子/泉眼，人越多人均产出越低。
  //   carry = min(carry_max, (carry_k + carry_ref) / (carry_k + N))
  //   N = carry_ref 时为 1.0；人口少于参考值有余裕，多于则递减（只用四则运算，铁律 11）。
  carryFactor(r) {
    const ref = num(r.carry_ref);
    if (ref <= 0) return 1;
    const k = num(r.carry_k);
    const cap = num(r.carry_max) || Infinity;
    return Math.min(cap, (k + ref) / (k + this.alive.length));
  }

  produce() {
    const seasonMod = this.season;
    const buckets = { food: 0, water: 0, firewood: 0 };
    for (const n of this.alive) {
      const available=availableWork(this,n);
      if (!available) continue;
      const f = this.feelingOf(n);
      buckets[n.job] = (buckets[n.job] ?? 0) + f.work * available;
    }
    const hours = WORK_HOURS.size;
    for (const key of Object.keys(buckets)) {
      const r = this.resFor(key);
      if (!r) continue;
      const per = num(r[seasonMod]) * num(r.per_worker_day) / hours * this.carryFactor(r);
      const gain = buckets[key] * per;
      this.store[key] = (this.store[key] ?? 0) + gain;
      this._prod = this._prod ?? {};
      this._prod[key] = (this._prod[key] ?? 0) + gain;
    }
  }

  /* ── 进食/饮水：按人头均分，不足则全员少分 ── */
  consumeMeal(resKey, unitsPerPerson, stockKey, nutrition) {
    const alive = this.alive;
    const N = alive.length;
    if (N === 0) return;
    // 每个人只取"补满自己存量所需"的量（真实行为，避免浪费）。
    // 总需求因此自然等于全岛一天的真实消耗，而不是拍脑袋的常数。
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
    this._cons = this._cons ?? {};
    this._cons[resKey] = (this._cons[resKey] ?? 0) + taken;
    const ratio = taken / totalDemand;
    this.rationHistory.push({ res: resKey, ratio, tick: this.tick });
    if (this.rationHistory.length > 12) this.rationHistory.shift(); // 只记最近约 2.4 天

    if (ratio < 0.999) {
      this.pushLog('RATION_SHORT', `${resKey} 缺口：需 ${totalDemand.toFixed(2)} 得 ${taken.toFixed(2)}（${(ratio * 100).toFixed(0)}%）`);
    }
    // P0-1 · 短缺时的分配顺序（取代"全员按比例少分"）：
    //   被偏袒者 → 在岗劳力 → Health 高者 → id 小者，依次补满各自 want，分完为止。
    // 旧写法让所有人在同一小时一起跌破临界、一起死（0 或 12 的二值结局）；
    // 按序分配后，先倒下的是闲置/体弱者，劳力保住 → 产出保住 → 岛能缩编活下去。
    // 仍是"按需取食 + 单餐上限"（铁律 6），只改了谁先拿。
    const share = want.slice();
    if (ratio < 0.999) {
      const key = n => [this.policy.favor.has(n.id) ? 1 : 0, n.job !== 'idle' ? 1 : 0, n.stocks.Health, -n.id];
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

  /** 某资源的最近满足率（最后 48 条记录内的最低值） */
  ratioOf(res) {
    let m = 1, seen = false;
    for (const r of this.rationHistory) {
      if (r.res !== res) continue;
      seen = true;
      m = Math.min(m, r.ratio);
    }
    return seen ? m : 1;
  }

  /* ── 存量结算 ── */
  envTick() {
    const t = this.temp();
    this._temp = t;
  }

  stockTick(n) {
    const asleep = SLEEP_HOURS.has(this.hour) && !this.crisisAwake(n);
    n.sleeping = asleep;
    for (const st of this.stocks) {
      const key = st.key;
      if (key === 'Health') continue;
      let d = 0;
      if (key === 'Rest') d = asleep ? num(st.per_hour_sleep) : num(st.per_hour_wake);
      // 饱食/水分 24 小时都在掉（睡着也会饿会渴），否则每日消耗与 per_person_day 不自洽
      else if (key === 'Satiety' || key === 'Hydration') d = num(st.per_hour_wake);
      else if (key === 'Warmth') {
        // 趋近模型：体温向"环境决定的平衡点"收敛，而不是线性掉。
        // 平衡点 = 有火 →100；否则 (温度+5)*5，温度 -5 以下即 0（深冬夜无火）
        const target = this.fireActive ? 100 : Math.min(100, (this._temp + 5) * 5);
        d = (target - n.stocks[key]) * 0.15;
        // 个体脆弱度：只在「失温」方向起作用。体弱者掉得更快，
        // 于是缺柴的冬天不是"一起死"而是"先死最弱的" —— 死亡率变成渐进，哀悼才有对象。
        if (d < 0) d /= (n.frail ?? 1);
      }
      n.stocks[key] = Math.max(0, Math.min(num(st.max), n.stocks[key] + d));
    }
    // 归零/临界伤害：按 crit_threshold 累积，每 N 小时扣血
    zeroDamage(this,n);

    // 恢复：吃饱喝足睡够 → 缓慢自愈
    if (n.stocks.Satiety > 40 && n.stocks.Hydration > 40 && n.stocks.Rest > 40 && n.stocks.Warmth > 30) {
      n.stocks.Health = Math.min(100, n.stocks.Health + 1);
    }
    n.stocks.Health = Math.max(0, Math.min(100, n.stocks.Health));
  }

  crisisAwake(n) {
    if (!n.alive) return true;
    return n.stocks.Satiety <= 0 || n.stocks.Hydration <= 0 || n.stocks.Health <= 25 || this.griefDays > 0 && n.stocks.Rest < 5;
  }

  /* ── Feeling（照抄 Tomodachi 8 种 + 2 种生存向）── */
  updateFeeling(n) {
    const s = n.stocks;
    const avgBond = this.avgBondOf(n);
    let f = 'Normal';
    if (s.Satiety < 20) f = 'Starving';
    else if (this.strainMax(n) >= 90 || (n.satietyZeroDays >= 2)) f = 'Desperate';
    else if (this.griefDays > 0) f = 'Depress';
    else if (this.strainMax(n) >= 70) f = 'Angry';
    // 社交性抑郁：不是只有丧亲才抑郁。被孤立 + 长期摩擦 = Depress（排在烦躁之前，抑郁比烦躁更严重）
    else if (avgBond < 105 && this.strainMax(n) >= 40) f = 'Depress';
    else if (s.Health < 45 && avgBond < 115) f = 'Depress';
    else if (this.strainMax(n) >= 55 && avgBond < 110) f = 'Deject';
    else if (this.strainMax(n) >= 40) f = 'Irritate';
    else if (s.Warmth < 45 || this.supplyRatio() < 0.33) f = 'Worry';
    else if (s.Rest < 40) f = 'Careless';
    else if (s.Satiety > 60 && this.strainMax(n) < 30 && s.Health > 70) f = 'Good';
    n.feeling = f;
  }

  feelingOf(n) { return this.feelings.find(f => f.name === n.feeling) ?? { work: 1, social: 1 }; }
  strainMax(n) {
    let m = 0;
    for (const b of this.npcs) {
      if (b.id === n.id) continue;
      const r = this.relOf(n.id, b.id);
      if (r && r.bond < 160) m = Math.max(m, r.strain);
    }
    return m;
  }
  avgBondOf(n) {
    let s = 0, c = 0;
    for (const b of this.npcs) {
      if (b.id === n.id) continue;
      const r = this.relOf(n.id, b.id);
      if (r) { s += r.bond; c++; }
    }
    return c ? s / c : 100;
  }

  /* ────────────────────── 事件层 ────────────────────── */
  rollTrouble() {
    const rp = this.resourcePressure();
    const weights = [];
    for (const c of this.categories) {
      let eff = 0;
      if (c.gateMode === 'always') eff = c.base * rp;
      else if (c.gateMode === 'gated') eff = Math.max(0, c.base * (rp - c.gateRP) * c.gateScale);
      else if (c.gateMode === 'winter') eff = this.season === 'winter' ? c.base * rp : 0;
      else if (c.gateMode === 'has_lover') eff = this.hasTagAnywhere('Lover') || this.hasTagAnywhere('Couple') ? c.base * rp : 0;
      else if (c.gateMode === 'after_death') eff = this.griefDays > 0 ? 400 : 0;
      if (['Cloth','IslandEdit','Other','Question','Goods','RoomStyle'].includes(c.cat) && !surplus(this)) eff=0;
      if(c.cat==='Fight' && !fightAllowed(this,rp))eff=0;
      eff *= socialWeight(this,c.cat);
      if (eff > 0) weights.push({ cat: c.cat, eff });
    }
    let n = Math.max(2, Math.min(6, Math.round(2 + (rp - 1) * 1.6)));
    for (let i = 0; i < n; i++) {
      const pickCat = this.rng.weighted(weights, w => w.eff);
      if (!pickCat) continue;
      this.tryScene(pickCat.cat, rp);
    }
  }

  tryScene(cat, rp) {
    const ok = this._trySceneCat(cat, rp);
    if (ok) return;
    // 兜底：该类别本期无满足条件的分支 → 退到 always 可用的 Relation，避免"空掷"
    if (cat !== 'Relation' && this._trySceneCat('Relation', rp)) return;
    this.filteredScenes++;
  }

  _trySceneCat(cat, rp) {
    const candidates = [...this.sceneIndex.values()].filter(s => s.cat === cat);
    if (!candidates.length) return false;
    for (let attempt = 0; attempt < 80; attempt++) {
      const scene = this.rng.pick(candidates);
      const alive = sceneActors(this,cat,scene.id);
      if (!alive.length && this.alive.length) continue;
      if (alive.length < scene.party) return false;
      // 关键：NPC 主要和"有关系的人"互动（好友/仇敌），不是随机路人。
      // 这既是真实性，也是 Strain 能在一对固定关系上累积、触发"温水煮青蛙"的前提。
      const victims = cat==='Fight' ? alive.filter(actor=>alive.some(target=>this.relOf(actor.id,target.id)?.tags.has('Suspect'))) : [];
      const initiators = victims.length ? victims : alive;
      const F = initiators[this.rng.int(initiators.length)];
      const others = alive.filter(n => n.id !== F.id);
      const pickByBond = (exclude) => {
        const eligible = others.filter(n => n.id !== exclude);
        const suspects = cat==='Fight' && exclude===null ? eligible.filter(n=>this.relOf(F.id,n.id)?.tags.has('Suspect')) : [];
        const pool = suspects.length ? suspects : eligible;
        if (!pool.length) return null;
        const r = this.rng.weighted(pool, n => {
          const b = this.relOf(F.id, n.id)?.bond ?? 100;
          // 铁律 11：禁 Math.pow。平方用乘法，IEEE 754 下单次乘法结果唯一，跨引擎确定。
          const x = b / 100;
          return 1 + x * x; // bond 200 → 权重 5；bond 0 → 1
        });
        return r;
      };
      const T = pickByBond(null);
      if (!T) return false;
      const A = scene.party >= 3 ? pickByBond(T.id) : null;
      if (scene.party >= 3 && !A) return false;
      const ctx = { F: F.id, T: T.id, A: A?.id ?? null, rp };
      if (!this.meetsCond(scene.cond, ctx)) continue;
      this.resolveScene(scene, ctx);
      return true;
    }
    return false;
  }

  meetsCond(cond, ctx) {
    const { F, T, A } = ctx;
    const bFT = this.relOf(F, T)?.bond ?? 100;
    const bTA = A != null ? (this.relOf(T, A)?.bond ?? 100) : 0;
    const s = this.store;
    switch (cond) {
      case 'any': return true;
      case 'food_le_1': return s.food <= Math.max(1.0, this.alive.length * 0.5);
      case 'food_scarce': return this.ratioOf('food') < 0.8;
      case 'water_scarce': return this.ratioOf('water') < 0.8;
      case 'bond_lt_40': return bFT < 40;
      case 'bond_lt_60': return bFT < 60;
      case 'bond_ge_160': return bFT >= 160 && romance(this,F,T);
      case 'winter_cold': return this.season === 'winter' && (this.npc(F).stocks.Warmth < 45 || this.npc(T).stocks.Warmth < 45);
      case 'target_sick': return this.npc(T).stocks.Health < 60;
      case 'dying': {
        const f = this.npc(F), t = this.npc(T);
        // 放宽：场景只在 20:00 生成一次，等 Health 掉到 15 往往人已经死了（冻死/脱水几小时内）
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
      case 'is_couple': {
        const r1 = this.relOf(F, T), r2 = this.relOf(T, F);
        return !!(r1?.tags.has('Couple') || r2?.tags.has('Couple'));
      }
      default: return false;
    }
  }

  npc(id) { return this.npcs[id]; }

  /* ────────────────────── L6 玩家指令 ────────────────────── */
  applyCommand(cmd) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    switch (cmd.type) {
      case 'setRation':
        this.policy.rationPerPerson = clamp(Number(cmd.value) || 0, 0, 2);
        return { ok: true, ration: this.policy.rationPerPerson };
      case 'setFavor':
        this.policy.favor = new Set((cmd.ids ?? []).filter(i => this.npc(i)?.alive));
        return { ok: true, favor: [...this.policy.favor] };
      case 'setWinterPrep':
        this.policy.winterPrep = !!cmd.value;
        return { ok: true };
      case 'setWorkforceScale':
        this.policy.workforceScale = clamp(Number(cmd.value) || 1, 0.05, 1);
        return { ok: true };
      case 'assignJob': {
        const n = this.npc(cmd.npcId);
        if (!n?.alive) return { ok: false, reason: 'dead' };
        if (!['food', 'water', 'firewood', 'idle'].includes(cmd.job)) return { ok: false, reason: 'bad_job' };
        if (['M96','M97','M98','M99'].includes(n.survival?.tier??'')) return {ok:false,reason:'survival'};
        n.job = cmd.job;
        n.jobLockedToday = true;   // 精准指派：当轮不被 06:00 分配覆盖
        return { ok: true };
      }
      case 'mediate': return this.mediate(cmd.a, cmd.b);
      case 'exileVote': return this.exileVote(cmd.targetId);
      case 'setSpeed': return { ok: true, speed: cmd.value }; // 渲染层消费
      default: return { ok: false, reason: 'unknown_command' };
    }
  }

  /** 调解：降低双方 Strain；对高压关系会失败并加剧 */
  mediate(aId, bId) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
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
    this.policy.managerStrain = clamp(this.policy.managerStrain + 5, 0, 100); // 被干预的不快

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
  exileVote(targetId) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
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

  /* ────────────────────── 存档 / 读档 ────────────────────── */
  save() {
    return {
      version: 1,
      meta: {
        savedAt: Date.now(), day: this.day, hour: this.hour,
        rngState: this.rng.s.toString(), seed: this.seed, totalDays: this.maxDays,
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
      })),
      family: {
        parents: [...this.family.parents.entries()].map(([k, v]) => [k, [...v]]),
        children: [...this.family.children.entries()].map(([k, v]) => [k, [...v]]),
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
    };
  }

  static load(s) {
    if (s?.version !== 1) throw new Error(`不支持的存档版本: ${s?.version}`);
    const w = new World({
      days: s.meta.totalDays, seed: s.meta.seed, npcCount: s.npcs.length,
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
      });
    }
    // 亲属图
    if (s.family) {
      w.family.parents = new Map(s.family.parents.map(([k, v]) => [k, new Set(v)]));
      w.family.children = new Map(s.family.children.map(([k, v]) => [k, new Set(v)]));
    }
    w.births = (s.births ?? []).map(b => ({ ...b }));
    // 重置为默认，再叠加存档中的偏离值
    for (const [, r] of w.rel) { r.bond = 100; r.strain = 0; r.tags.clear(); r.tags.add('Know'); }
    for (const e of s.relations) {
      const r = w.relOf(e.from, e.to);
      if (!r) continue;
      r.bond = e.bond; r.strain = e.strain;
      for (const t of e.tags) r.tags.add(t);
    }
    return w;
  }

  resolveScene(scene, ctx) {
    const valid = scene.branches.filter(b => this.meetsCond(scene.cond, ctx));
    const chosen = this.rng.weighted(valid, b => b.rate);
    if (!chosen) { this.filteredScenes++; return; }
    const before = this.snapshotStrain();
    this.applyEffect(chosen.effect, ctx);
    // 检测本轮是否发生了负面互动（用于 Strain 是否衰减）
    if (this.snapshotStrain() > before) this.conflictToday = true;
    this.sceneLog.push({
      day: this.day, hour: this.hour, scene: scene.id, cat: scene.cat,
      branch: chosen.branch, F: ctx.F, T: ctx.T, A: ctx.A,
      effect: chosen.effect, rp: ctx.rp,
    });
  }

  snapshotStrain() {
    let s = 0;
    for (const [, r] of this.rel) s += r.strain;
    return s;
  }

  /* ── 效果 DSL ── */
  applyEffect(str, ctx) {
    if (!str || str === 'none') return;
    const { F, T, A } = ctx;
    const who = { F, T, A };
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
            const [from, to] = parts[1].split('>');
            const res = parts[2], amt = num(parts[3]);
            if (amt < 0) this.store[res] = Math.max(0, (this.store[res] ?? 0) + amt);
            break;
          }
          case 'feeling': {
            const n = this.npc(who[parts[1]]);
            if (n) n.feeling = parts[2];
            break;
          }
          case 'health': {
            const n = this.npc(who[parts[1]]);
            if (n) n.stocks.Health = Math.max(0, Math.min(100, n.stocks.Health + num(parts[2])));
            break;
          }
          case 'mem': {
            const h = this.history.get(parts[1]);
            if (!h) break;
            for (const k of ['F', 'T', 'A']) {
              const n = this.npc(who[k]);
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
          case 'trouble': {
            this.pendingTrouble = (this.pendingTrouble ?? 0) + 1;
            break;
          }
          case 'feed':
          case 'drink': {
            // 场景内嵌的进食/饮水：从公共仓库取一份，当场恢复
            const n = this.npc(who[parts[1]]);
            if (!n) break;
            const res = kind === 'feed' ? 'food' : 'water';
            const stockKey = kind === 'feed' ? 'Satiety' : 'Hydration';
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
        this.pushLog('EFFECT_ERR', `${t} → ${e.message}`);
      }
    }
  }

  applyBond(aId, bId, delta, noRank) {
    const r = this.relOf(aId, bId);
    if (!r) return;
    let next = r.bond + delta;
    if (delta < 0 && noRank) {
      // 公理5：小恶不降档 —— 数值可掉到本档下限，但不跨档
      const tier = this.tierOf(r.bond);
      next = Math.max(tier.min, next);
    }
    r.bond = Math.max(0, Math.min(200, next));
  }

  applyStrain(aId, bId, delta) {
    const r = this.relOf(aId, bId);
    if (!r) return;
    r.strain = Math.max(0, Math.min(100, r.strain + delta));
  }

  /* ── 死亡 ── */
  checkDeaths() {
    for (const n of this.alive) {
      if (n.stocks.Health > 0) continue;
      n.alive = false;
      this.deaths.push({ id: n.id, name: n.name, day: this.day, hour: this.hour, cause: this.deathCause(n) });
      this.pushLog('DEATH', `${n.name} 死于 ${this.deathCause(n)}（第 ${this.day} 天）`);
      this.griefDays = 3;
      mourn(this,n);
      // 目击者反应：Bond→死者 +20，Strain→管理者 +15
      for (const m of this.alive) {
        const r = this.relOf(m.id, n.id);
        if (r) { r.bond = Math.min(200, r.bond + 20); }
        this.policy.managerStrain = Math.min(100, this.policy.managerStrain + 15);
      }
    }
  }
  deathCause(n) {
    if (n.hypothermiaHours > 0) return 'hypothermia';
    if (n.dehydrateHours > 0) return 'dehydration';
    if (n.satietyZeroHours > 0) return 'starvation';
    return 'injury';
  }

  /* ── 日终 ── */
  endOfDay() {
    const alive = this.alive;
    const livingEdges = new Set(alive.flatMap(a=>alive.map(b=>this.relOf(a.id,b.id))));

    // ★ 资源短缺 → 集体记仇。这是"谁少吃了一口"的制度化表达，
    //   也是 Strain 唯一的稳定来源：丰年无人记仇，荒年所有关系同时变酸。
    const sr = this.supplyRatio();
    if (sr < 0.5) {
      const amount = (0.5 - sr) * 40; // sr=0 → +20/天；sr=0.25 → +10/天
      for (const [, r] of this.rel) {
        if (livingEdges.has(r) && r.bond < 160) r.strain = Math.min(100, r.strain + amount);
      }
      this.policy.managerStrain = Math.min(100, this.policy.managerStrain + amount * 0.5);
    }
    // 当天被削减配给 → 对管理者记仇
    for (const n of alive) {
      if (n._rationCut) {
        this.policy.managerStrain = Math.min(100, this.policy.managerStrain + 1);
        n._rationCut = false;
      }
    }
    // 偏袒的可见代价：没被偏袒的人持续记恨管理者（与丰年/荒年无关）
    if (this.policy.favor.size > 0) {
      const notFavored = alive.filter(n => !this.policy.favor.has(n.id)).length;
      this.policy.managerStrain = Math.min(100, this.policy.managerStrain + notFavored * 0.3);
    }

    // Strain 自然衰减（仅当天无负面互动时）
    let strainSum = 0, bondSum = 0, pairs = 0;
    for (const [, r] of this.rel) {
      if (livingEdges.has(r) && !this.conflictToday) r.strain = Math.max(0, r.strain - 1);
      // 积怨腐蚀好感：这是「温水煮青蛙」的终局，也是 Bond 唯一能跌破 60 的慢路径。
      // 阈值 80 与 relation-ladder 的「积怨」档对齐；每天 −5，掉 100 点需要 20 天持续积怨。
      if (livingEdges.has(r) && r.strain >= 80) r.bond = Math.max(0, r.bond - 5);
      strainSum += r.strain; bondSum += r.bond; pairs++;
    }
    this.conflictToday = false;
    // 饥饿天数累计
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
    this.updateOtherTag();
  }

  maxStrainAll() {
    let m = 0;
    for (const [, r] of this.rel) m = Math.max(m, r.strain);
    return +m.toFixed(1);
  }

  pushLog(kind, msg) {
    if (this.log.length < 400) this.log.push({ tick: this.tick, day: this.day, hour: this.hour, kind, msg });
  }

  /* ── 报告 ── */
  report() {
    const byCat = {};
    for (const s of this.sceneLog) byCat[s.cat] = (byCat[s.cat] ?? 0) + 1;
    const causes = {};
    for (const d of this.deaths) causes[d.cause] = (causes[d.cause] ?? 0) + 1;
    // 关系分布
    const tiers = {};
    for (const [, r] of this.rel) {
      const t = this.tierOf(r.bond);
      tiers[t.tier] = (tiers[t.tier] ?? 0) + 1;
    }
    // 温水煮青蛙检测：标签不变但 strain>=70
    let frog = 0;
    for (const [, r] of this.rel) if (r.strain >= 70 && r.bond >= 100) frog++;
    // 饥荒才打架检测
    const fightWhenFed = this.sceneLog.filter(s => s.cat === 'Fight' && s.rp < 2.0).length;
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
