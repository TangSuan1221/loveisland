// 数值表：解析 + 类型化。CSV 原始字符串 → 运行时结构，转换规则与 sim/world.mjs 逐位一致。
import type {
  Category, CsvRow, FeelingDef, GameData, HistoryParam, LadderTier, Reaction, Scene, SceneBranch,
} from './types.ts';

export const num = (v: string | number | undefined | null): number =>
  (v === '' || v == null ? 0 : Number(v));
export const bool = (v: string | undefined): boolean => v === '1' || v === 'true';

/** 运行期解析（供 fetch 注入路径使用）。规则与 tools/gen-data.mjs、sim/world.mjs 完全相同 */
export function parseCsv(raw: string): CsvRow[] {
  const text = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const head = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const o: CsvRow = {};
    head.forEach((h, i) => { o[h.trim()] = (cells[i] ?? '').trim(); });
    return o;
  });
}

export interface Tables {
  stocks: CsvRow[];
  resources: CsvRow[];
  ladder: LadderTier[];
  reactions: Map<string, Reaction>;
  categories: Category[];
  scenes: SceneBranch[];
  sceneIndex: Map<string, Scene>;
  history: Map<string, HistoryParam>;
  feelings: FeelingDef[];
}

/** 每个 World 实例拿到自己的一份（行对象浅拷贝），实例间互不污染 */
export function buildTables(d: GameData): Tables {
  const stocks = d.stocks.map(r => ({ ...r }));
  const resources = d.resources.map(r => ({ ...r }));
  const ladder = d.ladder.map(r => ({
    min: num(r.min), max: num(r.max), tier: r.tier, label: r.label_zh,
    semantic: r.survival_semantic, shareOk: bool(r.share_ok),
  })).sort((a, b) => a.min - b.min);
  const reactions = new Map<string, Reaction>(d.reactions.map(r => [r.id, {
    id: r.id, event: r.event, delta: num(r.delta_bond),
    noRank: bool(r.is_no_change_rank), strain: num(r.strain_delta), note: r.note,
  }]));
  const categories = d.categories.map(r => ({
    id: r.id, cat: r.category, label: r.label_zh, base: num(r.base_rate),
    gateMode: r.gate_mode, gateRP: num(r.gate_rp_threshold), gateScale: num(r.gate_scale),
  }));
  const scenes = d.scenes.map(r => ({
    sceneId: r.scene_id, cat: r.category, party: num(r.party),
    cond: r.scene_cond, branch: r.branch_id, rate: num(r.rate), effect: r.effect,
  }));
  const sceneIndex = new Map<string, Scene>();
  for (const s of scenes) {
    let sc = sceneIndex.get(s.sceneId);
    if (!sc) {
      sc = { id: s.sceneId, cat: s.cat, party: s.party, cond: s.cond, branches: [] };
      sceneIndex.set(s.sceneId, sc);
    }
    sc.branches.push(s);
  }
  const history = new Map<string, HistoryParam>(d.history.map(r => [r.id, {
    id: r.id, label: r.label_zh, good: r.good_line, bad: r.bad_line,
    permanent: bool(r.is_permanent), condTag: r.cond_tag,
  }]));
  const feelings = d.feelings.map(r => ({
    id: r.id, name: r.feeling, label: r.label_zh, trigger: r.trigger,
    work: num(r.effect_work), social: num(r.effect_social),
  }));
  return { stocks, resources, ladder, reactions, categories, scenes, sceneIndex, history, feelings };
}
