// ─────────────────────────────────────────────────────────────────────────────
// skit-runtime.mjs —— 「小剧场 / 演出」参考运行时（零依赖 · 头部无 DOM · 确定性）
//
// 这份文件是《演出系统设计规格》的可执行版本，用途有三个：
//   1. 把「数据表 → 时间轴 → 逐 beat 指令」这套设计跑通，证明它不是 PPT 架构；
//   2. 给下一个 AI 一个可对照的实现基准（TS 化时逐函数搬过去即可）；
//   3. 把「派生 RNG / 时长预算 / 覆盖率 / 跳过收敛」这些硬约束变成可跑的断言。
//
// 它故意不做的事（都很重要）：
//   · 不 import sim-core，不碰 world.rng，不写任何模拟状态；
//   · 不用 Math.random / Math.pow / Math.sin / Date.now 做选择；
//   · 不含 DOM / three / Worker 代码 —— 那些属于表现层，由 apps/game 里的 director/stage/overlay 负责。
//
// 设计要点见 演出资料/01-演出系统设计规格.md。
// ─────────────────────────────────────────────────────────────────────────────



// ═══════════════════════════════════════════════════════════════════════════
// §1 常量：四张白名单。改这里 = 改协议，必须同步 SPEC 与 validate-data。
// ═══════════════════════════════════════════════════════════════════════════

/** 演出层级。hold=1 表示播放期间冻结模拟（T0 永不 hold）。 */
export const TIERS = {
  T0: { hold: 0, capMs: 1200, label: '花字' },
  T1: { hold: 1, capMs: 6000, label: '快切' },
  T2: { hold: 1, capMs: 11000, label: '小剧场' },
  T3: { hold: 1, capMs: 20000, label: '可介入' },
  T4: { hold: 1, capMs: 34000, label: '章' },
};

/** beat 类型白名单（14 种，封闭集合）。 */
export const KINDS = new Set([
  'cam',      // 切镜头：param.cam = 机位预设
  'move',     // 走位：param = 目标 mark
  'act',      // 动作：param = 动词
  'face',     // 换脸：param = 表情
  'say',      // 说话：text_key = 台词；气泡
  'caption',  // 字幕/花字：text_key；无角色锚点
  'callout',  // 强调标注：text_key + role 作锚点
  'fx',       // 特效：param = fx id
  'sfx',      // 音效：param = sfx id（表现层实现，可静音）
  'wait',     // 留白：只走时间，不说话不动
  'cut',      // 硬切：param = smash | black
  'letterbox',// 遮幅：param = on | off
  'choice',   // 介入窗口：param = choice id
  'end',      // 收束（必须存在）
]);

/** 机位的 yaw 求解模式与取景目标（机位本身在 data/skit-shot.csv，改表即改机位）。 */
export const YAW_MODES = new Set(['keep', 'perp', 'dir_FT', 'dir_TF', 'reverse']);
export const TARGETS = new Set(['centroid', 'mid', 'F', 'T', 'A','loc']);

/** 走位锚点（以舞台中心为原点的标准九宫位）。 */
export const MARKS = {
  C: [0, 0], L1: [-1.6, 0], R1: [1.6, 0], L2: [-3.2, 0], R2: [3.2, 0],
  NEAR: [0, 1.4], FAR: [0, -1.4], DOOR: [4.2, 0], SEAT_L: [-1.0, 0.6], SEAT_R: [1.0, 0.6],
};

/** 动作动词白名单：全部能在「胶囊体 + 位移/缩放/旋转」上实现，不需要骨骼。 */
export const ACTS = new Set([
  'sit', 'stand', 'turn', 'step_in', 'step_back', 'hop', 'spin', 'lean_in',
  'recoil', 'tremble', 'fall', 'freeze', 'point', 'offer', 'reach',
  'cover_face', 'slump', 'walk_past', 'kick', 'shiver', 'wipe', 'play', 'dance', 'carry',
]);

/** 表情白名单（10 情绪 + 8 表演脸）。渲染层没有的脸用「表情卡」DOM 补。 */
export const EMOTES = new Set([
  'Neutral', 'Good', 'Careless', 'Worry', 'Irritate', 'Angry', 'Deject', 'Depress', 'Desperate', 'Starving',
  'shock', 'deadpan', 'blush', 'smug', 'cry', 'smile', 'sweat', 'blank',
]);

/** 特效白名单（全部是程序化生成，不依赖美术资源）。 */
export const FX = new Set([
  'heart', 'hearts_burst', 'spark', 'flash', 'dust', 'snow', 'rain', 'fire_glow',
  'black', 'vignette', 'shake', 'slowmo', 'freeze_frame', 'zoom_punch', 'rainbow', 'star',
]);

/** 角色位。X1/X2 = 表现层临时演员（不进模拟、不具名、画成剪影）。N = 旁白。 */
export const ROLES = new Set(['F', 'T', 'A', 'X1', 'X2', 'N', '-']);

export const STAGE = { width: 8.4, depth: 4.0 };

// ═══════════════════════════════════════════════════════════════════════════
// §2 CSV 解析：与 残酷小岛/tools/gen-data.mjs 的 parseCsv 逐条同规则
//    （去 BOM / 切行 / 逗号切分 / trim）。**台词里不能出现半角逗号**，这是硬约束。
// ═══════════════════════════════════════════════════════════════════════════

export function parseCsv(raw) {
  const text = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const head = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const o = {};
    head.forEach((h, i) => { o[h] = (cells[i] ?? '').trim(); });
    return o;
  });
}



/** 机位表 → Map<shot, 归一化行>。数字列一次转完，求解时零解析。 */
export function shotTable(rows) {
  const m = new Map();
  for (const r of rows) {
    m.set(r.shot, {
      shot: r.shot,
      yaw: r.yaw_mode,
      pitch: Number(r.pitch),
      dist: Number(r.dist) || 0,
      distSep: Number(r.dist_sep) || 0,
      distTo: Number(r.dist_to) || 0,
      fov: Number(r.fov) || 0,
      target: r.target || 'mid',
      min: Number(r.dist_min) || 0,
      max: Number(r.dist_max) || 0,
    });
  }
  return m;
}

/** 读真实场景表（校验覆盖率用：演出必须覆盖 scene-branch.csv 里的每一个 scene+branch） */


// ═══════════════════════════════════════════════════════════════════════════
// §3 确定性：派生 RNG（抄 sim-core/rng.ts 的 splitmix64，逐位一致）
//    关键：**不碰 world.rng**。种子只由「存档里一定存在的量」拼成。
// ═══════════════════════════════════════════════════════════════════════════

export class Rng {
  constructor(seed = 0x12345678) {
    this.s = BigInt(seed) & 0xffffffffffffffffn;
  }
  next() {
    this.s = (this.s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.s;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    z = z ^ (z >> 31n);
    return Number(z & 0x7fffffffn) / 2147483647;
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

/** FNV-1a（纯整数，禁 Math.pow）。只用来把字符串搅进种子。 */
export function hashStr(h, str) {
  let x = h;
  for (let i = 0; i < str.length; i++) {
    x = ((x ^ BigInt(str.charCodeAt(i) & 0xff)) * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return x;
}

/**
 * 演出专用派生 RNG。
 * 同 (seed · tick · sceneId · branchId · F · T · A · salt) ⇒ 永远同一变体。
 * 读档、重播、录像、换设备全都一致；且不消耗 world.rng，parity 不受影响。
 */
export function deriveRng({ seed, tick, sceneId, branchId, focus, target, another = null, salt = 0, fps = 0 }) {
  let h = BigInt(seed) & 0xffffffffffffffffn;
  h = (h * 0x9e3779b97f4a7c15n + BigInt(tick)) & 0xffffffffffffffffn;
  h = hashStr(h, sceneId);
  h = hashStr(h, branchId);
  h = (h * 31n + BigInt(focus)) & 0xffffffffffffffffn;
  h = (h * 31n + BigInt(target)) & 0xffffffffffffffffn;
  h = (h * 31n + BigInt(another ?? -1)) & 0xffffffffffffffffn;
  h = (h * 31n + BigInt(salt)) & 0xffffffffffffffffn;
  h = (h * 31n + BigInt(fps)) & 0xffffffffffffffffn;
  return new Rng(h);
}

/**
 * 抽取顺序（**这是协议**，改动 = 所有录像失效）：
 *   D1 变体         deriveRng(..., salt=0).int(variantCount)
 *   D2 表情抖动     deriveRng(..., salt=1).int(8)      每遇到 param=ANY 的 face 消费一次
 *   D3 特抖动       deriveRng(..., salt=2).int(6)      每遇到 param=ANY 的 fx 消费一次
 *   D4 条件台词并列 deriveRng(..., salt=3).pick(tied)  仅当同优先级多条 cond 命中
 * 别的随机一律不许有。
 */
export const DRAW_SLOTS = Object.freeze({ VARIANT: 0, FACE: 1, FX: 2, LINE: 3 });

// ═══════════════════════════════════════════════════════════════════════════
// §4 机位求解：把「电影机位」翻译成现有 orbit 相机参数
//    isle.ts 的相机 = { yaw, pitch, dist, tx, tz } + lookAt(tx, 0, tz)。
//    所以每个预设只需返回这 5 个数 + 可选 fov。
// ═══════════════════════════════════════════════════════════════════════════

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];


/**
 * 机位求解：**完全由 data/skit-shot.csv 驱动**（改表即改机位，代码不动）。
 * 这是为 G2 留的接缝：拿到 `MiiTouchCameraParam` 的真实字段后，只需换表，不换求解器。
 *
 * @param {string} shotName 机位名（表里的一行）
 * @param {{pos:object, yaw?:number, side?:1|-1}} ctx
 * @param {Map} table `shotTable(rows)` 的结果
 */
export function solveShot(shotName, ctx, table) {
  const row = table?.get(shotName);
  if (!row) throw new Error(`未知机位：${shotName}（检查 data/skit-shot.csv）`);
  const P = ctx.pos ?? {};
  const F = P.F ?? MARKS.C, T = P.T ?? MARKS.R1, A = P.A ?? P.R2 ?? MARKS.L1;
  const yaw0 = ctx.yaw ?? 0.6;
  const side = ctx.side ?? 1;
  const sep = dist2(F, T) || 1.6;
  const axis = Math.atan2(T[0] - F[0], T[1] - F[1]);
  const perp = axis + Math.PI / 2 * side;
  let yaw;
  switch (row.yaw) {
    case 'keep': yaw = yaw0; break;
    case 'perp': yaw = perp; break;
    case 'dir_FT': yaw = Math.atan2(T[0] - F[0], T[1] - F[1]); break;
    case 'dir_TF': yaw = Math.atan2(F[0] - T[0], F[1] - T[1]); break;
    case 'reverse': yaw = perp + Math.PI; break;
    default: throw new Error(`未知 yaw_mode：${row.yaw}`);
  }
  const c = row.target === 'loc' ? (P.loc ?? F) : row.target === 'F' ? F
    : row.target === 'T' ? T
      : row.target === 'A' ? A
        : row.target === 'centroid' ? mid(mid(F, T), A) : mid(F, T);
  const raw = row.distSep ? sep * row.distSep : row.dist;
  const dist = clamp(raw, row.min || 0, row.max || raw);
  const out = { yaw, pitch: row.pitch, dist, tx: c[0], tz: c[1] };
  if (row.fov) out.fov = row.fov;
  if (row.distTo) out.distTo = row.distTo;
  return out;
}

/** 判断两个机位是否跨了 180° 轴线（切镜头时用来决定要不要「翻轴」） */
export function axisFlip(a, b) {
  const d = Math.abs(((a - b + Math.PI) % (Math.PI * 2)) - Math.PI);
  return d > Math.PI * 0.6;
}

// ═══════════════════════════════════════════════════════════════════════════
// §5 变体 / 台词选择
// ═══════════════════════════════════════════════════════════════════════════

export function variantsOf(beats, skitId) {
  const set = new Set();
  for (const b of beats) if (b.skit_id === skitId) set.add(Number(b.variant));
  return [...set].sort((a, b) => a - b);
}

/** 条件台词匹配：优先级 any(0) < 具体条件(1)，同优先级按表序；并列时才用 D4 抽。 */
export function pickLine(linesById, lineId, ctx, rng) {
  const rows = linesById.get(lineId);
  if (!rows || !rows.length) return null;
  const matched = rows.filter(r => condHolds(r.cond, ctx));
  if (!matched.length) return rows[0];
  const best = Math.max(...matched.map(r => condRank(r.cond)));
  const tied = matched.filter(r => condRank(r.cond) === best);
  if (tied.length === 1) return tied[0];
  return rng ? rng.pick(tied) : tied[0];
}

const condRank = c => (!c || c === 'any') ? 0 : 1;

export function condHolds(cond, ctx) {
  if (!cond || cond === 'any') return true;
  if (cond.startsWith('choice:')) {
    const [cid, opt] = cond.slice(7).split('=');
    return ctx.choices?.[cid] === opt;
  }
  const [k, op, v] = cond.split(/(>=|<=|>|<|=)/);
  const num = Number(v);
  switch (k) {
    case 'tier': return ctx.tierIndex != null && (op === '>=' ? ctx.tierIndex >= num : ctx.tierIndex <= num);
    case 'bond': return ctx.bond != null && (op === '>=' ? ctx.bond >= num : ctx.bond <= num);
    case 'strain': return ctx.strain != null && (op === '>=' ? ctx.strain >= num : ctx.strain <= num);
    case 'rp': return ctx.rp != null && (op === '>=' ? ctx.rp >= num : ctx.rp <= num);
    case 'feeling': return Array.isArray(ctx.feelings) && ctx.feelings.includes(v);
    case 'mem': return Array.isArray(ctx.mems) && ctx.mems.includes(v);
    default: return false;
  }
}

/** 名字占位替换：{F} {T} {A}；缺名字时退化成 #id（新生儿现成的坑） */
export function fillText(text, ctx) {
  if (!text) return '';
  return text.replace(/\{(F|T|A)\}/g, (_, r) => ctx.name?.(ctx.ids?.[r]) ?? (ctx.ids?.[r] != null ? `#${ctx.ids[r]}` : r));
}

// ═══════════════════════════════════════════════════════════════════════════
// §6 时间轴组装
// ═══════════════════════════════════════════════════════════════════════════

export function buildTimeline(beats, skitId, variant) {
  const rows = beats
    .filter(b => b.skit_id === skitId && Number(b.variant) === variant)
    .sort((a, b) => Number(a.beat) - Number(b.beat));
  let t = 0;
  const out = [];
  for (const r of rows) {
    const dur = Math.max(0, Number(r.dur_ms) || 0);
    out.push({ ...r, i: Number(r.beat), tStart: t, tEnd: t + dur, dur });
    t += dur;
  }
  return { rows: out, total: t };
}

/**
 * 核心：给一场「已抽签未结算」的场景，产出一份**纯数据**演出计划。
 * 返回对象不含任何函数副作用，可 JSON 序列化 → 可存、可比对、可回放。
 */
export function planScene({
  tables, seed, tick, sceneId, branchId, ids, names = {},
  bond = 100, strain = 0, rp = 1, feelings = [], mems = [], prevYaw = 0.6,
  forceSkit = null, choices = {}, sceneRow = null,
}) {
  const { defs, beats, lines } = tables;
  const shotMap = shotTable(tables.shots ?? []);
  const def = forceSkit
    ? defs.find(d => d.skit_id === forceSkit)
    : defs.find(d => d.scene_id === sceneId && (d.branch_id === '*' || d.branch_id === branchId))
      ?? defs.find(d => d.scene_id === sceneId && d.branch_id === '*');

  const ctxBase = {
    tierIndex: def ? Number(String(def.tier).slice(1)) : 1,
    bond, strain, rp, feelings, mems, choices,
    ids, name: id => names[id],
  };

  if (!def) return fallbackPlan({ tables, seed, tick, sceneId, branchId, ids, ctx: ctxBase, prevYaw, sceneRow });

  const vs = variantsOf(beats, def.skit_id);
  if (!vs.length) return fallbackPlan({ tables, seed, tick, sceneId, branchId, ids, ctx: ctxBase, prevYaw, sceneRow });

  const r1 = deriveRng({ seed, tick, sceneId, branchId, focus: ids.F, target: ids.T, another: ids.A, salt: DRAW_SLOTS.VARIANT });
  const variant = vs[r1.int(vs.length)];

  const { rows, total } = buildTimeline(beats, def.skit_id, variant);
  const linesById = groupLines(lines);

  // D2 / D3：表情与特效抖动（按 beat 顺序消费，未出现的 slot 不消费）
  const rf = deriveRng({ seed, tick, sceneId, branchId, focus: ids.F, target: ids.T, another: ids.A, salt: DRAW_SLOTS.FACE });
  const rx = deriveRng({ seed, tick, sceneId, branchId, focus: ids.F, target: ids.T, another: ids.A, salt: DRAW_SLOTS.FX });
  const EMOTE_ANY = ['shock', 'deadpan', 'sweat', 'blank', 'smile', 'Careless', 'Irritate', 'Neutral'];
  const FX_ANY = ['spark', 'dust', 'shake', 'flash', 'heart', 'star'];

  const cues = [];
  let side = 1;
  let lastYaw = prevYaw;
  for (const b of rows) {
    const cue = {
      i: b.i, t: b.tStart, dur: b.dur, kind: b.kind, role: b.role,
    };
    switch (b.kind) {
      case 'cam': {
        cue.shot = b.cam;
        const sol = solveShot(b.cam, { pos: marksFor(ids), yaw: lastYaw, side }, shotMap);
        if (b.cam === 'REVERSE' || b.cam === 'OTS_T') side = -side;
        if (axisFlip(sol.yaw, lastYaw)) sol.flip = true;
        lastYaw = sol.yaw;
        cue.camera = sol;
        break;
      }
      case 'move': cue.mark = b.param; cue.to = MARKS[b.param] ?? MARKS.C; break;
      case 'act': cue.act = b.param; break;
      case 'face': {
        const offset = Math.min(b.dur, Math.max(0, Number(b.at_ms) || 0));
        cue.t += offset;
        cue.dur -= offset;
        cue.emote = b.param === 'ANY' ? rf.pick(EMOTE_ANY) : b.param;
        break;
      }
      case 'say': {
        const line = pickLine(linesById, b.text_key, ctxBase, deriveRng({ seed, tick, sceneId, branchId, focus: ids.F, target: ids.T, another: ids.A, salt: DRAW_SLOTS.LINE + b.i }));
        cue.speaker = b.role;
        cue.textKey = b.text_key;
        cue.text = fillText(line?.text ?? '', ctxBase);
        cue.emote = line?.emote || null;
        cue.channel = 'bubble';
        break;
      }
      case 'caption': {
        const line = pickLine(linesById, b.text_key, ctxBase, null);
        cue.textKey = b.text_key;
        cue.text = fillText(line?.text ?? '', ctxBase);
        cue.channel = 'caption';
        cue.tone = line?.tone || def.tone;
        break;
      }
      case 'callout': {
        const line = pickLine(linesById, b.text_key, ctxBase, null);
        cue.textKey = b.text_key;
        cue.text = fillText(line?.text ?? '', ctxBase);
        cue.anchor = b.role;
        cue.channel = 'callout';
        break;
      }
      case 'fx': cue.fx = b.param === 'ANY' ? rx.pick(FX_ANY) : b.param; break;
      case 'sfx': cue.sfx = b.param; break;
      case 'wait': break;
      case 'cut': cue.cut = b.param || 'smash'; break;
      case 'letterbox': cue.letterbox = b.param !== 'off'; break;
      case 'choice': {
        cue.choice = b.param;
        cue.options = (tables.choices ?? [])
          .filter(o => o.choice_id === b.param)
          .map(o => ({ id: o.option_id, text: o.text, command: o.command || '' }));
        break;
      }
      case 'end': break;
      default: cue.unknown = b.kind;
    }
    cues.push(cue);
  }

  return {
    skitId: def.skit_id, sceneId, branchId, tier: def.tier, title: def.title_zh,
    hold: Number(def.hold) === 1, variant, total,
    beats: rows.length, cues,
    drawLog: { variant, faceSlots: cues.filter(c => c.kind === 'face' && c.emote).length, fxSlots: cues.filter(c => c.kind === 'fx' && c.fx).length },
  };
}

function marksFor(ids) {
  // 舞台中心 = F 的位置；其余按固定锚点排（表现层会用真实坐标替换）
  return { F: MARKS.C, T: MARKS.R1, A: MARKS.L1, X1: MARKS.R2, X2: MARKS.L2 };
}

export function groupLines(lines) {
  const m = new Map();
  for (const l of lines) {
    if (!m.has(l.line_id)) m.set(l.line_id, []);
    m.get(l.line_id).push(l);
  }
  return m;
}

// ═══════════════════════════════════════════════════════════════════════════
// §7 兜底演出：任何没有手写脚本的场景，自动生成一场 T1
//    这是「80 个场景第一天就全覆盖」的全部秘密，也是新加场景不会变成死内容的原因。
// ═══════════════════════════════════════════════════════════════════════════

const VERB_BY_TOKEN = {
  react: 'turn', bond: 'step_back', strain: 'tremble', tag: 'point',
  feed: 'offer', drink: 'offer', transfer: 'offer', health: 'slump',
  mem: 'freeze', trouble: 'tremble', couple: 'lean_in', breakup: 'turn',
  birth: 'carry', discover: 'point', scout: 'walk_past', none: 'freeze',
  feeling: 'turn',
};

export function fallbackPlan({ tables, seed, tick, sceneId, branchId, ids, ctx, prevYaw, sceneRow = null }) {
  const tokens = (sceneRow?.effect ?? '').split(';').map(s => s.split(':')[0]).filter(Boolean);
  const verb = VERB_BY_TOKEN[tokens[0]] ?? 'turn';
  const cat = sceneRow?.category ?? 'Other';
  const { lines } = tables;
  const linesById = groupLines(lines);
  const sayF = pickLine(linesById, `FB_${cat}_F`, ctx, null);
  const sayT = pickLine(linesById, `FB_${cat}_T`, ctx, null);
  const cap = pickLine(linesById, 'FB_CAP', ctx, null);
  const total = 5200;
  const cues = [
    { i: 0, t: 0, dur: 0, kind: 'cam', shot: '2SHOT', camera: solveShot('2SHOT', { pos: marksFor(ids), yaw: prevYaw, side: 1 }, shotTable(tables.shots ?? [])) },
    { i: 1, t: 0, dur: 900, kind: 'act', role: 'F', act: verb },
    { i: 2, t: 900, dur: 1300, kind: 'say', role: 'F', channel: 'bubble', text: fillText(sayF?.text ?? '', ctx), emote: sayF?.emote ?? 'Neutral', textKey: `FB_${cat}_F` },
    { i: 3, t: 2200, dur: 500, kind: 'face', role: 'T', emote: sayT?.emote ?? 'Neutral' },
    { i: 4, t: 2700, dur: 600, kind: 'wait' },
    { i: 5, t: 3300, dur: 900, kind: 'say', role: 'T', channel: 'bubble', text: fillText(sayT?.text ?? '', ctx), textKey: `FB_${cat}_T` },
    { i: 6, t: 4200, dur: 1000, kind: 'caption', channel: 'caption', text: fillText(cap?.text ?? '', ctx), textKey: 'FB_CAP', tone: 'deadpan' },
    { i: 7, t: 5200, dur: 0, kind: 'end' },
  ];
  return {
    skitId: `FB_${sceneId}_${branchId}`, sceneId, branchId, tier: 'T1', title: '（自动演出）',
    hold: true, variant: 0, total, beats: 8, cues, generated: true,
    drawLog: { variant: 0, faceSlots: 0, fxSlots: 0 },
  };
}

/** 覆盖检查：真实场景表里每个 (scene,branch) 是否能被手写脚本或兜底接住 */export function coverageReport(tables, sceneRows) {
  const defs = tables.defs;
  const has = (sid, bid) => defs.some(d => d.scene_id === sid && (d.branch_id === '*' || d.branch_id === bid));
  const pairs = [];
  for (const r of sceneRows) pairs.push({ sceneId: r.scene_id, branchId: r.branch_id, hand: has(r.scene_id, r.branch_id) });
  const hand = pairs.filter(p => p.hand).length;
  return { pairs: pairs.length, hand, fallback: pairs.length - hand, ratio: hand / pairs.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// §8.5 降级：预算耗尽 / 高速播放 / 玩家选了「只看大事」时，把任何一场压成 T0
//      T0 = 一条花字，不切镜头、不冻结世界、≤1.2s。它保证「永远有反馈」而不是「没有演出」。
// ═══════════════════════════════════════════════════════════════════════════

export function degradeToT0(plan) {
  const cap = plan.cues.find(c => c.kind === 'caption');
  const text = cap?.text ?? plan.title;
  const tone = cap?.tone ?? 'deadpan';
  return {
    ...plan, tier: 'T0', hold: false, degraded: true, total: 900,
    cues: [
      { i: 0, t: 0, dur: 900, kind: 'caption', channel: 'caption', text, tone },
      { i: 1, t: 900, dur: 0, kind: 'end' },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §8.6 数据校验：把「作者会犯的错」变成列表
// ═══════════════════════════════════════════════════════════════════════════

export function validateTables(tables, sceneRows = []) {
  const errs = [];
  const warns = [];
  const { defs, beats, lines } = tables;
  const choices = tables.choices ?? [];
  const choiceIds = new Set(choices.map(c => c.choice_id));
  const shotMap = shotTable(tables.shots ?? []);
  const sceneIds = new Set(sceneRows.map(r => r.scene_id));
  const branchOf = new Map();
  for (const r of sceneRows) {
    if (!branchOf.has(r.scene_id)) branchOf.set(r.scene_id, new Set());
    branchOf.get(r.scene_id).add(r.branch_id);
  }
  const lineIds = new Set(lines.map(l => l.line_id));

  // defs
  const seen = new Set();
  for (const d of defs) {
    if (seen.has(d.skit_id)) errs.push(`skit_id 重复：${d.skit_id}`);
    seen.add(d.skit_id);
    if (!TIERS[d.tier]) errs.push(`${d.skit_id} 未知 tier：${d.tier}`);
    if (!['0', '1', '2'].includes(d.extras)) errs.push(`${d.skit_id} extras 只能是 0/1/2：${d.extras}`);
    if (sceneRows.length) {
      if (!sceneIds.has(d.scene_id)) errs.push(`${d.skit_id} 引用了不存在的场景：${d.scene_id}`);
      else if (d.branch_id !== '*' && !branchOf.get(d.scene_id).has(d.branch_id)) {
        errs.push(`${d.skit_id} 引用了不存在的分支：${d.scene_id}/${d.branch_id}`);
      }
    }
    if (TIERS[d.tier] && Number(d.hold) !== TIERS[d.tier].hold) {
      errs.push(`${d.skit_id} hold 与 tier 不符：${d.tier} 应为 ${TIERS[d.tier].hold}`);
    }
  }

  // beats
  const byVariant = new Map();
  for (const b of beats) {
    if (!seen.has(b.skit_id)) { errs.push(`beat 指向不存在的 skit：${b.skit_id}`); continue; }
    if (!KINDS.has(b.kind)) errs.push(`${b.skit_id}/${b.variant}/${b.beat} 未知 kind：${b.kind}`);
    if (!ROLES.has(b.role)) errs.push(`${b.skit_id}/${b.variant}/${b.beat} 未知 role：${b.role}`);
    const dur = Number(b.dur_ms);
    if (!Number.isFinite(dur) || dur < 0) errs.push(`${b.skit_id}/${b.variant}/${b.beat} dur_ms 非法：${b.dur_ms}`);
    if (b.at_ms && (b.kind !== 'face' || !Number.isFinite(Number(b.at_ms)) || Number(b.at_ms) < 0 || Number(b.at_ms) >= dur))
      errs.push("非法表情偏移 at_ms" + ' ' + b.skit_id + '/' + b.beat);
    if (dur > 6000) errs.push(`${b.skit_id}/${b.variant}/${b.beat} 单 beat 超过 6000ms`);
    if (b.kind === 'cam' && !shotMap.has(b.cam)) errs.push(`${b.skit_id} 未知机位：${b.cam}`);
    if (b.kind === 'move' && !MARKS[b.param]) errs.push(`${b.skit_id} 未知 mark：${b.param}`);
    if (b.kind === 'act' && !ACTS.has(b.param)) errs.push(`${b.skit_id} 未知 act：${b.param}`);
    if (b.kind === 'face' && b.param !== 'ANY' && !EMOTES.has(b.param)) errs.push(`${b.skit_id} 未知 emote：${b.param}`);
    if (b.kind === 'fx' && b.param !== 'ANY' && !FX.has(b.param)) errs.push(`${b.skit_id} 未知 fx：${b.param}`);
    if (b.kind === 'choice' && !choiceIds.has(b.param)) errs.push(`${b.skit_id} 未知 choice：${b.param}`);
    if ((b.kind === 'say' || b.kind === 'caption' || b.kind === 'callout') && !lineIds.has(b.text_key)) {
      errs.push(`${b.skit_id}/${b.variant}/${b.beat} 台词键不存在：${b.text_key}`);
    }
    if (!['say', 'caption', 'callout', 'wait', 'act', 'move', 'face', 'fx', 'sfx', 'letterbox', 'choice'].includes(b.kind) && dur !== 0) {
      warns.push(`${b.skit_id}/${b.variant}/${b.beat} ${b.kind} 通常应为 0ms：${dur}`);
    }
    const k = `${b.skit_id}#${b.variant}`;
    if (!byVariant.has(k)) byVariant.set(k, []);
    byVariant.get(k).push(b);
  }

  // 每个 variant：beat 从 0 连续 / 有 end / 总时长在 tier 上限内 / 至少一个 say 或 caption
  for (const [k, rows] of byVariant) {
    const [skitId] = k.split('#');
    const def = defs.find(d => d.skit_id === skitId);
    const nums = rows.map(r => Number(r.beat)).sort((a, b) => a - b);
    if (nums.some((n, i) => n !== i)) errs.push(`${k} beat 不连续：${nums.join(',')}`);
    if (!rows.some(r => r.kind === 'end')) errs.push(`${k} 缺少 end beat`);
    if (!rows.some(r => r.kind === 'say' || r.kind === 'caption')) warns.push(`${k} 没有任何台词/字幕`);
    const total = rows.reduce((a, r) => a + Math.max(0, Number(r.dur_ms) || 0), 0);
    if (def && TIERS[def.tier] && total > TIERS[def.tier].capMs) {
      errs.push(`${k} 总时长 ${total}ms 超过 ${def.tier} 上限 ${TIERS[def.tier].capMs}ms`);
    }
    if (def?.tier === 'T3' && !rows.some(r => r.kind === 'choice')) errs.push(`${k} 是 T3 但没有 choice beat`);
    if (def?.tier === 'T4' && !rows.some(r => r.kind === 'letterbox')) errs.push(`${k} 是 T4 但没有 letterbox beat`);
  }

  // 台词表
  for (const l of lines) {
    if (/[,，,]/.test(l.text ?? '') && /,/.test(l.text)) errs.push(`台词 ${l.line_id} 含半角逗号（CSV 会错列）`);
    if ((l.text ?? '').length > 64) warns.push(`台词 ${l.line_id} 过长（${l.text.length} 字）`);
    if (l.role && !ROLES.has(l.role)) errs.push(`台词 ${l.line_id} 未知 role：${l.role}`);
    if (l.emote && !EMOTES.has(l.emote)) errs.push(`台词 ${l.line_id} 未知 emote：${l.emote}`);
    if (!EMOTES.has(l.emote) && l.emote && !['-', ''].includes(l.emote)) errs.push(`台词 ${l.line_id} emote 非法`);
    if (l.cond?.startsWith('choice:')) {
      const [cid, opt] = l.cond.slice(7).split('=');
      if (!choiceIds.has(cid)) errs.push(`台词 ${l.line_id} 引用了不存在的 choice：${cid}`);
      else if (!choices.some(c => c.choice_id === cid && c.option_id === opt)) errs.push(`台词 ${l.line_id} 引用不存在的选项：${l.cond}`);
    }
  }

  // 机位表
  const seenShot = new Set();
  for (const r of (tables.shots ?? [])) {
    const s = shotTable([r]).get(r.shot);
    if (seenShot.has(r.shot)) errs.push(`机位重复：${r.shot}`);
    seenShot.add(r.shot);
    if (!YAW_MODES.has(s.yaw)) errs.push(`机位 ${r.shot} 未知 yaw_mode：${s.yaw}`);
    if (!TARGETS.has(s.target)) errs.push(`机位 ${r.shot} 未知 target：${s.target}`);
    if (!(s.pitch > 0 && s.pitch <= 1.6)) errs.push(`机位 ${r.shot} pitch 越界：${s.pitch}`);
    if (!(s.dist > 0) && !(s.distSep > 0)) errs.push(`机位 ${r.shot} 既没有 dist 也没有 dist_sep`);
    if (s.fov && !(s.fov >= 20 && s.fov <= 90)) errs.push(`机位 ${r.shot} fov 越界：${s.fov}`);
  }
  const usedShots = new Set(beats.filter(b => b.kind === 'cam').map(b => b.cam));
  for (const s of usedShots) if (!shotMap.has(s)) errs.push(`场景引用了不存在的机位：${s}`);

  // 选择项表
  for (const c of choices) {
    if (!c.option_id) errs.push(`choice ${c.choice_id} 缺少 option_id`);
    if (!c.text) errs.push(`choice ${c.choice_id}/${c.option_id} 缺少文案`);
    if (c.command && !['mediate', 'setRation', 'exileVote', ''].includes(c.command)) {
      errs.push(`choice ${c.choice_id}/${c.option_id} 未知 command：${c.command}`);
    }
  }

  // 覆盖率
  if (sceneRows.length) {
    const cov = coverageReport(tables, sceneRows);
    if (cov.hand < cov.pairs) warns.push(`手写剧本覆盖 ${cov.hand}/${cov.pairs}（其余走自动兜底）`);
  }

  return { errs, warns };
}

// ═══════════════════════════════════════════════════════════════════════════
// §9 播放器：纯时钟 → 指令流。可被 DOM / three / 测试三种宿主复用。
// ═══════════════════════════════════════════════════════════════════════════

export class SkitPlayer {
  constructor(plan, { onCue = () => {}, onEnd = () => {} } = {}) {
    this.plan = plan;
    this.onCue = onCue;
    this.onEnd = onEnd;
    this.t = 0;
    this.cursor = 0;
    this.done = false;
  }
  /** 推进 dt 毫秒；返回本帧应执行的 cue 列表 */
  step(dt) {
    if (this.done) return [];
    this.t += Math.max(0, dt);
    const out = [];
    while (this.cursor < this.plan.cues.length && this.plan.cues[this.cursor].t <= this.t) {
      const c = this.plan.cues[this.cursor++];
      out.push(c);
      this.onCue(c);
    }
    if (this.t >= this.plan.total) { this.done = true; this.onEnd(); }
    return out;
  }
  /** 跳过：一次性吐完剩余 cue（仍保证 end 被执行一次） */
  skip() {
    if (this.done) return [];
    const rest = this.plan.cues.slice(this.cursor);
    this.cursor = this.plan.cues.length;
    this.t = this.plan.total;
    this.done = true;
    for (const c of rest) this.onCue(c);
    this.onEnd();
    return rest;
  }
}

