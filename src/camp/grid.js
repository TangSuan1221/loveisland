// 建造系统 · 参考实现（零依赖 ESM，Node 18+）
// 职责：网格地形 / 结构占地 / 放置校验 / 加权连通 / 建造队列 / 存档 / 确定性哈希
// 设计真相源：../../残酷小岛-建造系统设计.md
// 本文件不依赖 three / DOM / 随机数；所有坐标整数，所有代价整数。

export const W = 64;
export const H = 64;
export const TILE_N = W * H;
export const CAMP = { x: 32, y: 32 };
/** 每“谷格”耗时 = 通行代价 / 96 小时（草地 4 代价 = 24 格/小时） */
export const SPEED_COST_PER_HOUR = 96;
export const WORK_HOURS = 9;
export const WINTER_BUILD_MOD = 0.75;

export const TERRAIN_KEYS = ['deep', 'shallow', 'sand', 'grass', 'forest', 'rock', 'soil', 'cliff'];
const T_INDEX = Object.fromEntries(TERRAIN_KEYS.map((k, i) => [k, i]));
export const T = Object.fromEntries(TERRAIN_KEYS.map((k, i) => [k.toUpperCase(), i]));

const DIR4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** 极简 CSV 解析：本项目所有表都没有引号内逗号 */
export function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('//'));
  const head = lines[0].split(',').map((s) => s.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    head.forEach((h, i) => { row[h] = (cols[i] ?? '').trim(); });
    return row;
  });
}

export function num(v, d = 0) {
  if (v === undefined || v === '' || v === null) return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/** 一维行主序索引（x 最快），与 AC 的 `z*X+x` 同构 */
export const idx = (x, y) => y * W + x;
export const inBounds = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

/** 占地在旋转后的尺寸：rot 1/3 交换宽高 */
export function sizeOf(w, h, rot) {
  return (rot & 1) ? { w: h, h: w } : { w, h };
}

/** 未旋转局部坐标 → 旋转后局部坐标（顺时针 90° × rot） */
export function rotateLocal(px, py, w, h, rot) {
  switch (rot & 3) {
    case 0: return { x: px, y: py };
    case 1: return { x: h - 1 - py, y: px };
    case 2: return { x: w - 1 - px, y: h - 1 - py };
    default: return { x: py, y: w - 1 - px };
  }
}

/** 门口朝向：rot 0 门在下边（+y），依次顺时针 */
export function doorNormal(rot) {
  return DIR4[(4-rot) & 3];
}

export function rleEncode(arr) {
  const out = [];
  let v = arr[0], n = 1;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === v) n++;
    else { out.push(v, n); v = arr[i]; n = 1; }
  }
  out.push(v, n);
  return out;
}

export function rleDecode(pairs, len) {
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < pairs.length; i += 2) {
    const v = pairs[i], n = pairs[i + 1];
    out.fill(v, p, p + n);
    p += n;
  }
  if (p !== len) throw new Error(`RLE 长度不符: ${p} != ${len}`);
  return out;
}

/** FNV-1a 32bit，用于存档/回归的确定性指纹 */
export function fnv1a(bytes, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export class Island {
  /**
   * @param {{mask:string, terrainDefs:object[], structures:object[], sites:object[]}} data
   */
  constructor(data) {
    this.terrainDefs = data.terrainDefs;
    this.kinds = new Map(data.structures.map((s) => [s.id, s]));
    this.kindList = data.structures;
    this.sites = data.sites.map((s) => ({ ...s }));

    this.base = new Uint8Array(TILE_N); this.terrain = this.base;
    this.skin = new Uint8Array(TILE_N);
    this.road = new Uint8Array(TILE_N);

    this.occ = new Uint16Array(TILE_N);       // 结构 id，0 = 空
    this.blocked = new Uint8Array(TILE_N);   // 1 = 阻挡通行
    this.walkStruct = new Uint8Array(TILE_N); // 1 = 可通行的结构（桥/门洞），O(1) 查询
    this.structs = [];
    this.nextId = 1;
    this.wood = 0;
    this.day = 0;
    this.gridVersion = 1;
    this.log = [];

    const rows = data.mask.split(/\r?\n/).filter((l) => l && !l.startsWith('//'));
    if (rows.length !== H) throw new Error(`底图行数 ${rows.length} != ${H}`);
    const CH = { '~': 'deep', '-': 'shallow', '.': 'sand', ',': 'grass', 'T': 'forest', '^': 'rock', ':': 'soil' };
    for (let y = 0; y < H; y++) {
      const row = rows[y];
      if (row.length !== W) throw new Error(`底图第 ${y} 行长度 ${row.length} != ${W}`);
      for (let x = 0; x < W; x++) {
        const k = CH[row[x]];
        if (k === undefined) throw new Error(`底图未知字符 ${row[x]} @ ${x},${y}`);
        this.terrain[idx(x, y)] = T_INDEX[k];
      }
    }
    this._distCache = null;
  }

  /* ───────────── 读写地形 ───────────── */

  terrainAt(x, y) { return this.terrain[idx(x, y)]; }
  terrainKey(x, y) { return TERRAIN_KEYS[this.terrainAt(x, y)]; }

  terrainDefAt(x, y) { return this.terrainDefs[this.terrainAt(x, y)]; }

  isWalkable(x, y) {
    if (!inBounds(x, y)) return false;
    const i = idx(x, y);
    if (this.blocked[i]) return false;
    if (this.walkStruct[i]) return true;   // 桥/门洞：地形是水也能走
    return this.terrainDefAt(x, y).walkable === 1;
  }

  /** 通行代价（越小越快）；不可通行为 0 */
  moveCost(x, y) {
    if (!this.isWalkable(x, y)) return 0;
    const i = idx(x, y);
    if (this.walkStruct[i]) return 2;
    return this.road[i]?2:this.terrainDefAt(x, y).move_cost;
  }

  /** 改地形（铺路/清林），返回旧值 */
  setTerrain(x, y, key) {
    if (!inBounds(x, y)) throw new Error('setTerrain 越界');
    const i = idx(x, y);
    const old = this.terrain[i];
    this.terrain[i] = T_INDEX[key];
    this.gridVersion++;
    this._distCache = null;
    return old;
  }

  /* ───────────── 连通性（Dial 桶队列，整数代价） ───────────── */

  /**
   * 从起点出发的加权最短代价场。
   * @param {{x:number,y:number}} from
   * @param {Set<number>} [extraBlocked] 额外阻挡（放置校验用）
   * @returns {Int32Array} -1 = 不可达，否则为代价（草地 4 / 路 2 / 桥 2）
   */
  distField(from, extraBlocked) {
    const MAXC = 8;
    const dist = new Int32Array(TILE_N).fill(-1);
    const buckets = Array.from({ length: MAXC + 1 }, () => []);
    const start = idx(from.x, from.y);
    if (!this.isWalkable(from.x, from.y) || extraBlocked?.has(start)) return dist;
    dist[start] = 0;
    buckets[0].push(start);
    let queued = 1, cur = 0;   // cur 是绝对代价，桶下标取模
    while (queued > 0) {
      while (buckets[cur % (MAXC + 1)].length === 0) cur++;
      const i = buckets[cur % (MAXC + 1)].pop(); queued--;
      if (dist[i] !== cur) continue;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of DIR4) {
        const nx = x + dx, ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const ni = idx(nx, ny);
        if (extraBlocked?.has(ni)) continue;
        if (this.blocked[ni]) continue;

        let step = 0;
        if (this.walkStruct[ni]) {
          step = 2;

        } else {
          const def = this.terrainDefs[this.terrain[ni]];
          if (def.walkable !== 1) continue;
          step = this.road[ni]?2:def.move_cost;
        }
        const nd = cur + step;
        if (dist[ni] === -1 || nd < dist[ni]) {
          dist[ni] = nd;
          buckets[nd % (MAXC + 1)].push(ni);
          queued++;
        }
      }
    }
    return dist;
  }

  /** 缓存版：营地到全岛的代价场（地形/结构变动后自动失效） */
  campDist() {
    if (!this._distCache) this._distCache = this.distField(CAMP);
    return this._distCache;
  }

  reachable(x, y) {
    if (!inBounds(x, y)) return false;
    return this.campDist()[idx(x, y)] >= 0;
  }

  /** 单程通行耗时（小时） */
  travelHours(x, y) {
    const d = this.campDist()[idx(x, y)];
    if (d < 0) return Infinity;
    return d / SPEED_COST_PER_HOUR;
  }

  /** 往返通勤占掉的工作小时比例 → 产出系数 [0.25, 1] */
  commuteFactor(x, y) {
    const h = this.travelHours(x, y);
    if (!Number.isFinite(h)) return 0;
    const eff = (WORK_HOURS - 2 * h) / WORK_HOURS;
    return Math.max(0.25, Math.min(1, eff));
  }

  /* ───────────── 占格与门 ───────────── */

  kindSize(kind, rot) { return sizeOf(kind.w, kind.h, rot); }

  /** 结构覆盖的所有格（世界坐标） */
  cellsOf(x, y, w, h) {
    const out = [];
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) out.push({ x: x + px, y: y + py });
    return out;
  }

  /** 门所在的格（世界坐标）与门外一格 */
  doors(kind, x, y, rot) {
    const p = rotateLocal(kind.door_x, kind.door_y, kind.w, kind.h, rot);
    const door = { x: x + p.x, y: y + p.y };
    const n = doorNormal(rot);
    const access = { x: door.x + n[0], y: door.y + n[1] };
    return { door, access, normal: n };
  }

  /* ───────────── 放置校验 ───────────── */

  /** 拒绝码 → 玩家可读理由（UI 直接显示，禁止只给 boolean） */
  static REASON = {
    OUT_OF_BOUNDS: '超出岛界',
    BLOCKED: '这块地已经被占用',
    TERRAIN: '地形不允许',
    SLOPE: '地面不平，需要先整平/架坡',
    RESERVED: '营地核心区禁止建造',
    SITE_BUFFER: '离资源点太近',
    NO_ACCESS: '门口没有可达的路',
    WATER_SPAN: '桥必须两端接岸，且跨过水面',
    SEALS_OFF: '会把已建好的门封死',
    MAX_COUNT: '同类建筑已达上限',
    LOCKED: '尚未解锁',
    NO_MATERIALS: '木料不够',
  };

  /**
   * 纯函数式校验。检查顺序固定（决定 UI 提示与回归断言）。
   * @param {object} kind structures.csv 的一行
   * @param {{wood:number, day:number, builtCount:Record<string,number>}} ctx
   */
  canPlace(kind, x, y, rot = 0, ctx = {}) {
    kind = this.kinds.get(kind.id) ?? kind;   // 归一化到本岛注册表，保证 indexOf/计数稳定
    
    const day = ctx.day ?? this.day;
    const { w, h } = this.kindSize(kind, rot);
    const fail = (code, detail) => ({ ok: false, code, reason: Island.REASON[code], detail });

    if (!Number.isInteger(x)||!Number.isInteger(y)||x < 0 || y < 0 || x + w > W || y + h > H) return fail('OUT_OF_BOUNDS');

    const cells = this.cellsOf(x, y, w, h);

    // 1 营地核心区
    if (kind.allow_camp !== 1) {
      for (const c of cells) {
        if (Math.abs(c.x - CAMP.x) <= 2 && Math.abs(c.y - CAMP.y) <= 2) return fail('RESERVED', `${c.x},${c.y}`);
      }
    }

    if(this.isReservedCell && cells.some(c=>this.isReservedCell(c.x,c.y)))return fail('RESERVED','固定地标');
    // 2 资源点缓冲区（曼哈顿 1 格）
    for (const c of cells) {
      for (const s of this.sites) {
        if (Math.abs(c.x - s.x) + Math.abs(c.y - s.y) <= 1) return fail('SITE_BUFFER', s.id);
      }
    }

    // 3 占格
    for (const c of cells) if (this.occ[idx(c.x, c.y)]) return fail('BLOCKED', `${c.x},${c.y}`);

    // 4 地形
    const t = this.terrainOk(kind, cells);
    if (t !== true) return fail(t === 'WATER_SPAN' ? 'WATER_SPAN' : 'TERRAIN', t);

    // 6 数量与解锁
    const built = ctx.builtCount?.[kind.id] ?? this.structs.filter((s) => s.kind.id === kind.id && !s.removed).length;
    if (built >= kind.max_count) return fail('MAX_COUNT', `${built}/${kind.max_count}`);
    if (day < kind.unlock_day) return fail('LOCKED', `第 ${kind.unlock_day} 天解锁`);

    // 8 可达
    const acc = this.accessOk(kind, x, y, rot, cells);
    if (acc !== true) return fail(acc);

    // 9 不封门（最贵的一步放最后）
    const sealed=this.wouldSealOff(kind,cells);if(sealed)return fail('SEALS_OFF',sealed);

    return { ok: true, code: 'OK', reason: '', cells };
  }

  terrainOk(kind, cells) {
    const rule = kind.terrain;
    const def = (c) => this.terrainDefs[this.terrain[idx(c.x, c.y)]];
    const LAND = new Set(['sand', 'grass', 'soil']);
    if (rule === 'land') return cells.every((c) => LAND.has(this.terrainKey(c.x, c.y))) || '需要陆地';
    if (rule === 'grass') return cells.every((c) => this.terrainKey(c.x, c.y) === 'grass') || '只能建在草地上';
    if (rule === 'shore') return cells.every((c) => this.terrainKey(c.x, c.y) === 'sand') || '只能建在沙滩上';
    if (rule === 'water') {
      const water = cells.filter((c) => this.terrainKey(c.x, c.y) === 'shallow').length;
      if (water === 0) return '必须建在水面上';
      return cells.every((c) => this.terrainKey(c.x, c.y) === 'shallow' || LAND.has(this.terrainKey(c.x, c.y))) || '需要水面';
    }
    if (rule === 'span') {
      const keys = cells.map((c) => this.terrainKey(c.x, c.y));
      const water = keys.filter((k) => k === 'shallow').length;
      if (water === 0) return 'WATER_SPAN';
      if (!LAND.has(keys[0]) || !LAND.has(keys[keys.length - 1])) return 'WATER_SPAN';
      if (!keys.every((k) => k === 'shallow' || LAND.has(k))) return 'WATER_SPAN';
      return true;
    }
    return '未知地形规则';
  }

  accessOk(kind, x, y, rot, cells) {
    if (kind.access === 'none') return true;
    const { access } = this.doors(kind, x, y, rot);
    if (!inBounds(access.x, access.y)) return 'NO_ACCESS';

    if (kind.access === 'land') {
      if (!this.isWalkable(access.x, access.y)) return 'NO_ACCESS';
      if (!this.reachable(access.x, access.y)) return 'NO_ACCESS';
      return true;
    }
    if (kind.access === 'water') {
      // 码头：占水面，但必须有一端挨着可走的岸
      const landNbr = cells.some((c) => {
        for (const [dx, dy] of DIR4) {
          const nx = c.x + dx, ny = c.y + dy;
          if (inBounds(nx, ny) && this.isWalkable(nx, ny) && this.reachable(nx, ny)) return true;
        }
        return false;
      });
      return landNbr ? true : 'NO_ACCESS';
    }
    if (kind.access === 'span') {
      const ends = [cells[0], cells[cells.length - 1]];
      const reach = ends.some((c) => this.isWalkable(c.x, c.y) && this.reachable(c.x, c.y));
      return reach ? true : 'NO_ACCESS';
    }
    return true;
  }

  /** 如果把这块地放上去，会不会让任何“已建好/在建且需要门”的结构失去可达性 */
  wouldSealOff(kind, cells) {
    const extra = new Set();
    if (kind.blocks === 1) for (const c of cells) extra.add(idx(c.x, c.y));
    if (extra.size === 0) return false;
    const dist = this.distField(CAMP, extra);
    for (const s of this.structs) {
      if (s.removed || s.kind.access === 'none' || s.kind.access === 'span') continue;
      const { access } = this.doors(s.kind, s.x, s.y, s.rot);
      if (!inBounds(access.x, access.y)) continue;
      const was = this.campDist()[idx(access.x, access.y)] >= 0;
      if (!was) continue;
      if (dist[idx(access.x, access.y)] < 0) return s.kind.name+(s.homeOf?.length?' · '+s.homeOf.join('、'):'');
    }
    return false;
  }

  /* ───────────── 建造 / 拆除 ───────────── */

  _stamp(st) {
    const { w, h } = this.kindSize(st.kind, st.rot);
    for (const c of this.cellsOf(st.x, st.y, w, h)) {
      const i = idx(c.x, c.y);
      this.occ[i] = st.id;
      if (st.kind.blocks === 1) this.blocked[i] = 1;
      if (st.kind.walkable === 1) this.walkStruct[i] = 1;
    }
  }

  _unstamp(st) {
    const { w, h } = this.kindSize(st.kind, st.rot);
    for (const c of this.cellsOf(st.x, st.y, w, h)) {
      const i = idx(c.x, c.y);
      if (this.occ[i] === st.id) this.occ[i] = 0;
      if (st.kind.blocks === 1) this.blocked[i] = 0;
      if (st.kind.walkable === 1) this.walkStruct[i] = 0;
    }
  }

}
