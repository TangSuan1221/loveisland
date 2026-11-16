import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export const stageSource = process.env.STAGE_DATA_DIR ??
  path.resolve(root, 'src/performance/stage/data');
const output = path.resolve(root, 'src/performance/stage/stage-data.generated.js');

const headers = {
  stage: 'stage,tone,aspect,stops,glow_color,glow_x,glow_y,glow_power,glow_radius,haze_y,haze_color,actor_x,actor_feet,actor_h,rim_color,note',
  layer: 'stage,layer,depth,blur,parallax,opacity,blend,note',
  light: 'stage,role,dx,dy,dz,color,intensity,softness,actor_only',
  fx: 'stage,type,count,x0,y0,x1,y1,size_min,size_max,speed,color,alpha,blend,seed',
  grade: 'stage,exposure,contrast,saturation,shadow_tint,high_tint,vignette,vig_soft,bloom_thresh,bloom_strength,bloom_radius,grain,chroma,note',
};
const enums = {
  tone: ['deadpan','warm','bitter','absurd','ominous'],
  blend: ['normal','add'],
  role: ['key','fill','rim','bounce','ambient'],
  type: ['bokeh','petal','spark','ember','dust','ring','flame','aura'],
};
const colorPattern = /^#[0-9a-f]{6}$/i;

function readCell(key, value) {
  if (key === 'note') return value;
  if (!value) throw Error('empty value');
  if (key === 'stage' || key === 'layer') {
    if (!/^[a-z][a-z0-9_-]*$/.test(value)) throw Error('invalid identifier');
    return value;
  }
  if (key in enums) {
    if (!enums[key].includes(value)) throw Error('unknown ' + key);
    return value;
  }
  if (key.endsWith('color') || key.endsWith('tint')) {
    if (!colorPattern.test(value)) throw Error('expected RGB hex color');
    return value;
  }
  if (key === 'stops') {
    const stops = value.split(';').map(pair => {
      const fields = pair.split(':');
      const at = Number(fields[0]);
      if (fields.length !== 2 || !fields[0] || !Number.isFinite(at) || !colorPattern.test(fields[1])) throw Error('invalid gradient stop');
      return { at, color: fields[1] };
    });
    if (stops[0].at !== 0 || stops.at(-1).at !== 1 || stops.some((s,i) => i > 0 && s.at <= stops[i-1].at)) throw Error('gradient must ascend from 0 to 1');
    return stops;
  }
  if (key === 'actor_only') {
    if (!['0','1'].includes(value)) throw Error('expected 0 or 1');
    return value === '1';
  }
  const n = Number(value);
  if (!Number.isFinite(n)) throw Error('expected finite number');
  if (['count','seed'].includes(key) && !Number.isSafeInteger(n)) throw Error('expected integer');
  if (['depth','opacity','alpha','softness','parallax'].includes(key) && (n < 0 || n > 1)) throw Error('expected 0–1');
  if (['count','blur','intensity','size_min','size_max'].includes(key) && n < 0) throw Error('expected nonnegative number');
  return n;
}

function readTable(table, directory) {
  const file = table === 'stage' ? 'stage.csv' : 'stage-' + table + '.csv';
  const [head, ...lines] = fs.readFileSync(path.join(directory,file),'utf8').replace(/^\uFEFF/,'').trimEnd().split(/\r?\n/);
  if (head !== headers[table]) throw Error(file + ': unexpected CSV header');
  const keys = head.split(',');
  return lines.flatMap((line, i) => {
    if (!line.trim()) return [];
    const cells = line.split(',');
    const where = file + ':' + (i + 2);
    if (cells.length !== keys.length) throw Error(where + ': wrong column count');
    const row = {};
    for (const [index,key] of keys.entries()) {
      try {
        const field = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        row[field] = readCell(key,cells[index].trim());
      } catch (error) { throw Error(where + ' ' + key + ': ' + error.message); }
    }
    return [row];
  });
}

export function compileStages(directory) {
  const stages = Object.create(null);
  for (const {stage: id,...fields} of readTable('stage',directory)) {
    if (stages[id]) throw Error('Duplicate stage ' + id);
    stages[id] = { id, ...fields, layers: [], lights: [], fx: [], grade: null };
  }
  for (const [table,field] of Object.entries({ layer: 'layers', light: 'lights', fx: 'fx', grade: 'grade' })) {
    for (const {stage: id,...row} of readTable(table,directory)) {
      if (!stages[id]) throw Error(table + ': unknown stage ' + id);
      if (table === 'grade') {
        if (stages[id].grade) throw Error(id + ': duplicate grade');
        stages[id].grade = row;
      } else stages[id][field].push(row);
    }
  }
  for (const stage of Object.values(stages)) {
    if (stage.layers.length < 4 || stage.layers.some((row,i,a) => i > 0 && row.depth < a[i-1].depth)) throw Error(stage.id + ': invalid layer stack');
    if (new Set(stage.layers.map(l => l.layer)).size !== stage.layers.length) throw Error(stage.id + ': duplicate layer');
    if (!stage.lights.some(light => light.role === 'key')) throw Error(stage.id + ': missing key light');
    if (!stage.grade || stage.grade.bloomStrength <= 0) throw Error(stage.id + ': missing grade or bloom');
    if (stage.fx.some(fx => fx.sizeMax < fx.sizeMin) || stage.fx.reduce((n, fx) => n + fx.count, 0) > 1200) throw Error(stage.id + ': invalid particle recipe');
  }
  for (const required of ['hanami','cabin','orb']) if (!stages[required]) throw Error('Missing stage ' + required);
  return stages;
}

export function generateStages(check = false) {
  const stages = compileStages(stageSource);
  const generated = '// Generated by tools/gen-data.mjs from 演出背景/data/*.csv.\n' +
    'export const STAGES = ' + JSON.stringify(stages, null, 2) + ';\n';
  if (check) {
    if (fs.readFileSync(output,'utf8').replace(/\r\n/g,'\n') !== generated) throw Error('Stale stage recipes. Run node tools/gen-data.mjs --stage');
  } else {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output,generated);
  }
  console.log((check ? 'Verified' : 'Generated') + ' stage recipes: ' + Object.keys(stages).join(', '));
}
