// tools/gen-data.mjs —— 构建期把 data/*.csv 编译成 packages/sim-core/src/data.generated.ts
// 用法：node tools/gen-data.mjs        （改过任何 CSV 后必须重跑；validate-data.mjs 会检查是否过期）
//
// 选型（P0-2 · CSV 加载策略 A）：
//   - sim-core 零运行时 IO：Worker / 浏览器 / Node 都能直接 import，不需要 fetch 路径或 loader
//   - 行保持「原始字符串」，数值转换仍由 sim-core 内的 num()/bool() 完成 —— 与 sim/world.mjs 语义逐位一致
//   - 文件头写入 CSV 内容哈希，validate-data.mjs 据此拦截「改了 CSV 忘了重新生成」
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { generateStages, stageSource } from './gen-stage-data.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'packages', 'sim-core', 'src', 'data.generated.ts');

// 文件名 → GameData 字段（ai-priority.csv 当前 sim 未用，但一并打包，P2 行为层要用）
export const TABLES = {
  'stocks.csv': 'stocks',
  'resources.csv': 'resources',
  'relation-ladder.csv': 'ladder',
  'relation-reaction.csv': 'reactions',
  'trouble-category.csv': 'categories',
  'scene-branch.csv': 'scenes',
  'history-param.csv': 'history',
  'feeling.csv': 'feelings',
  'ai-priority.csv': 'aiPriority',
  'need-ladder.csv': 'needLadder',
  'behavior-v5.csv': 'behaviors',
  'modifier.csv': 'modifiers',
  'survival-gate.csv': 'gates',
  'explore-sites.csv': 'sites',
};

/** 与 sim/world.mjs 的 loadCsv 完全相同的解析规则（逗号切分、trim、去 BOM、丢空行） */
export function parseCsv(raw) {
  const text = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;   // 去 BOM
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const head = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const o = {};
    head.forEach((h, i) => { o[h.trim()] = (cells[i] ?? '').trim(); });
    return o;
  });
}

/** CSV 原文哈希（按文件名排序后拼接），用于过期检测 */
export function csvHash() {
  const h = crypto.createHash('sha256');
  for (const f of Object.keys(TABLES).sort()) {
    h.update(f + '\0');
    h.update(fs.readFileSync(path.join(DATA, f)));
    h.update('\0');
  }
  return h.digest('hex').slice(0, 16);
}

function generate() {
  const parts = [];
  for (const [file, key] of Object.entries(TABLES)) {
    const rows = parseCsv(fs.readFileSync(path.join(DATA, file), 'utf8'));
    parts.push(`  ${key}: ${JSON.stringify(rows)},`);
  }
  const hash = csvHash();
  const src = [
    '// ⚠️ 自动生成，勿手改。源：data/*.csv  生成器：tools/gen-data.mjs',
    '// 改过 CSV 后运行 `node tools/gen-data.mjs`；validate-data.mjs 会比对下面的哈希。',
    `import type { GameData } from './types.ts';`,
    '',
    `export const DATA_HASH = '${hash}';`,
    '',
    'export const DATA: GameData = {',
    ...parts,
    '};',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, src, 'utf8');
  console.log(`✅ 生成 ${path.relative(ROOT, OUT)}  hash=${hash}  (${(src.length / 1024).toFixed(1)} KB)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const stageOnly = process.argv.includes('--stage');
  if (!stageOnly) generate();
  if (stageOnly || fs.existsSync(stageSource)) generateStages(process.argv.includes('--check'));
}
