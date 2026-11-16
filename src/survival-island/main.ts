import { BEHAVIOR_INDEX } from '@cruel-isle/sim-core';
// 主线程入口：Three.js 渲染 + Worker 客户端 + DOM UI。
// 主线程只读快照、只发指令（铁律 12）；模拟在 Worker 里按固定步长跑。
import type { Snapshot } from '@cruel-isle/sim-core';
import { SimClient } from './bridge/client.ts';
import type { Meta, WorldEvent } from './bridge/protocol.ts';
import { IsleRenderer, type Pick } from './render/isle.ts';
import { siteWorld } from './render/layout.ts';
import { FEELING_COLOR, FEELING_GLYPH, NEED_GLYPH, TIER_CSS } from './render/palette.ts';
import {
  BEHAVIOR_ZH, CAUSE_ZH, JOB_ZH, RES_ZH, SEASON_ZH, TAG_ORDER, TAG_ZH, bondTierOf, moodOf, sceneTitle, stockWord, whyLines,
} from './ui/text.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const DAYS = 60;
const SPEED_TPS = [0, 2, 4, 8, 16];          // 每真实秒推进的游戏小时（1× = 12 秒一天）
const SAVE_KEY = 'cruel-isle-save-v1';
const SITE_ZH: Record<string, string> = {
  E01_spring_north: '北泉', E02_spring_east: '东泉', E03_grove_west: '西林',
  E04_grove_south: '南林', E05_berry_patch: '浆果丛', E06_fish_cove: '渔湾',
};

const params = new URLSearchParams(location.search);
const canvas = $<HTMLCanvasElement>('view');
const isle = new IsleRenderer(canvas, params.has('webgl'));
const sim = new SimClient();

let meta: Meta | null = null;
let selected = -1;
let selectedSite = -1;
let hover = -1;
let speedIdx = 1;
const chronicle: WorldEvent[] = [];
let lastDetailKey = '';
let fpsFrames = 0, fpsAt = performance.now(), fps = 0;
(window as unknown as { __isle: unknown }).__isle = { sim, isle, get fps() { return fps; }, get backend() { return isle.backendName; } };

/* ───────────── 启动 ───────────── */
async function boot() {
  await isle.init();
  window.addEventListener('resize', () => isle.resize());
  sim.onMeta = m => { meta = m; isle.warn = m.warn; chronicle.length = 0; renderTimeline(); selected = -1; closeDetail(); };
  sim.onEvents = onEvents;
  sim.onError = msg => { toast('模拟出错：' + msg.split('\n')[0]); console.error(msg); };
  const seed = Number(params.get('seed') ?? Math.floor(Math.random() * 1e6));
  sim.init(seed, DAYS);
  sim.setSpeed(SPEED_TPS[speedIdx]);
  bindUi();
  if (!localStorage.getItem('cruel-isle-seen-help')) $('help').hidden = false;
  requestAnimationFrame(tick);
}

/* ───────────── 每帧 ───────────── */
let lastT = performance.now();
function tick(now: number) {
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  const s = sim.front;
  const p = s && !isle.dragged ? isle.pick(s) : null;
  hover = p?.kind === 'npc' ? p.index : -1;
  canvas.style.cursor = p ? 'pointer' : 'default';
  isle.frame(s, dt, selected, hover, $<HTMLInputElement>('showlines').checked);
  if (s && meta) {
    renderHud(s);
    renderRoster(s);
    renderLabels(s);
    renderDetail(s);
    renderNowMarker(s);
  }
  fpsFrames++;
  if (now - fpsAt > 1000) { fps = fpsFrames * 1000 / (now - fpsAt); fpsFrames = 0; fpsAt = now; $('h-pop').title = `${isle.backendName} · ${fps.toFixed(0)} fps · 模拟 ${sim.simMs.toFixed(2)} ms/帧`; }
  requestAnimationFrame(tick);
}

/* ───────────── 顶栏 ───────────── */
function renderHud(s: Snapshot) {
  $('h-day').textContent = `第 ${s.day + 1} 天 · ${SEASON_ZH[s.seasonIdx]}`;
  $('h-time').textContent = `${String(s.hour).padStart(2, '0')}:00${sim.paused ? ' ⏸' : ''}`;
  let alive = 0;
  for (let i = 0; i < s.count; i++) alive += s.alive[i];
  const perDay = [alive * 1, alive * (s.seasonIdx === 1 ? 1.5 : 1), s.seasonIdx === 3 ? alive * 0.5 : 0];
  for (const [i, id] of [[0, 'h-food'], [1, 'h-water'], [2, 'h-wood']] as const) {
    const w = stockWord(s.store[i], perDay[i]);
    const el = $(id);
    el.textContent = w;
    el.className = w === '见底' ? 'bad' : w === '撑一两天' ? 'warn' : '';
  }
  $('h-fire').hidden = !s.fireActive;
  const m = moodOf(s.managerStrain);
  const mood = $('h-mood');
  mood.textContent = m.label; mood.style.color = m.color;
  $('h-pop').textContent = `${alive} 人在世`;
}

/* ───────────── 名册 ───────────── */
let rosterKey = '';
function renderRoster(s: Snapshot) {
  if (!meta) return;
  const parts: string[] = [];
  for (let i = 0; i < s.count; i++) parts.push(`${s.alive[i]}${s.feeling[i]}${needIdx(s, i)}${Math.floor(s.age[i])}${i === selected ? 1 : 0}`);
  const key = parts.join('|');
  if (key === rosterKey) return;
  rosterKey = key;
  const ul = $('roster-list');
  ul.innerHTML = '';
  for (let i = 0; i < s.count; i++) {
    const li = document.createElement('li');
    if (!s.alive[i]) li.classList.add('dead');
    if (i === selected) li.classList.add('sel');
    const n = needIdx(s, i);
    li.innerHTML = `<span class="feel" style="color:${FEELING_COLOR[s.feeling[i]]}">${s.alive[i] ? FEELING_GLYPH[s.feeling[i]] : '✝'}</span>`
      + `<span>${meta.names[i] ?? '#' + i}</span><span class="needs">${s.alive[i] && n >= 0 ? NEED_GLYPH[n] : ''}</span>`
      + `<span class="age">${Math.floor(s.age[i])}岁${s.elder[i] ? '·老' : ''}</span>`;
    li.onclick = () => selectNpc(i, true);
    ul.appendChild(li);
  }
}

/** 最紧急的需求索引（-1 = 无） */
function needIdx(s: Snapshot, i: number): number {
  const w = isle.warn;
  const v = [s.satiety[i], s.hydration[i], s.rest[i], s.warmth[i], s.health[i]];
  const t = [w.satiety, w.hydration, w.rest, w.warmth, w.health];
  let best = -1, gap = 0;
  for (let k = 0; k < 5; k++) { if (v[k] >= t[k]) continue; const g = 1 - v[k] / t[k]; if (g > gap) { gap = g; best = k; } }
  return best;
}

/* ───────────── 名牌 ───────────── */
const labelPool: HTMLSpanElement[] = [];
function renderLabels(s: Snapshot) {
  if (!meta) return;
  const root = $('labels');
  let n = 0;
  const use = () => {
    let el = labelPool[n];
    if (!el) { el = document.createElement('span'); labelPool.push(el); root.appendChild(el); }
    n++;
    return el;
  };
  for (let i = 0; i < s.count; i++) {
    if (!s.alive[i]) continue;
    const show = i === selected || i === hover || s.count <= 16;
    if (!show) continue;
    const p = isle.npcWorldPos(i);
    const sc = isle.toScreen(p.x, isle.heightAt(p.x, p.z) + 2.75, p.z);
    if (sc.behind) continue;
    const el = use();
    el.className = i === selected ? 'sel' : '';
    el.textContent = meta.names[i];
    el.style.left = `${sc.x}px`; el.style.top = `${sc.y}px`; el.style.display = '';
  }
  for (let k = 0; k < s.siteCount; k++) {
    const w = siteWorld(s.siteX[k], s.siteY[k]);
    const sc = isle.toScreen(w.x, isle.heightAt(w.x, w.z) + 3.2, w.z);
    if (sc.behind) continue;
    const el = use();
    el.className = 'site';
    el.textContent = s.siteState[k] === 0 ? '？未知之地' : `${SITE_ZH[meta.siteNames[k]] ?? meta.siteNames[k]}${s.siteState[k] === 2 ? '（采空）' : ''}`;
    el.style.left = `${sc.x}px`; el.style.top = `${sc.y}px`; el.style.display = '';
  }
  for (let i = n; i < labelPool.length; i++) labelPool[i].style.display = 'none';
}

/* ───────────── 详情面板（选中岛民 / 点位） ───────────── */
function selectNpc(i: number, focus: boolean) {
  selected = i; selectedSite = -1; lastDetailKey = '';
  $('detail').hidden = false;
  if (focus) { const p = isle.npcWorldPos(i); isle.focusOn(p.x, p.z); }
}
function closeDetail() { selected = -1; selectedSite = -1; $('detail').hidden = true; lastDetailKey = ''; }

function renderDetail(s: Snapshot) {
  if (!meta || (selected < 0 && selectedSite < 0)) return;
  // 节流：内容变化才重建 DOM（下拉框/按钮状态不被每帧打断）
  const key = selected >= 0
    ? `n${selected}|${s.day}|${s.hour}|${s.alive[selected]}|${s.feeling[selected]}|${s.job[selected]}|${s.currentBehavior[selected]}|${s.currentTarget[selected]}|${s.favor[selected]}`
    : `s${selectedSite}|${s.day}|${s.siteState[selectedSite]}|${Math.round(s.siteFill[selectedSite] * 20)}`;
  if (key === lastDetailKey) return;
  lastDetailKey = key;
  const body = $('detail-body');
  if (selectedSite >= 0) { body.innerHTML = siteHtml(s, selectedSite); return; }
  const i = selected;
  const name = meta.names[i];
  const bar = (label: string, v: number, warn: number) => {
    const c = v < warn * 0.34 ? '#ef4444' : v < warn * 0.67 ? '#fb923c' : v < warn ? '#facc15' : '#4ade80';
    return `<span>${label}</span><div class="bar"><i style="width:${Math.max(2, v)}%;background:${c}"></i></div>`;
  };
  const w = isle.warn;
  const alive = s.alive[i] === 1;
  let html = `<h2>${name}${alive ? '' : ' ✝'}</h2><div class="sub">${Math.floor(s.age[i])} 岁${s.elder[i] ? '（老人，最怕冷）' : ''} · `
    + `${alive ? `${meta.feelingLabels[s.feeling[i]]} · ${BEHAVIOR_ZH[BEHAVIOR_INDEX[s.currentBehavior[i]]] ?? JOB_ZH[s.job[i]]}` : '已故'}${s.favor[i] ? ' · <b style="color:#facc15">被你偏袒</b>' : ''}</div>`;
  if (alive) {
    html += `<div class="bars">${bar('饱食', s.satiety[i], w.satiety)}${bar('水分', s.hydration[i], w.hydration)}${bar('精力', s.rest[i], w.rest)}${bar('体温', s.warmth[i], w.warmth)}${bar('健康', s.health[i], w.health)}</div>`;
    html += `<div class="cmds">
      <button data-cmd="job" data-job="food">去采集</button><button data-cmd="job" data-job="water">去取水</button>
      <button data-cmd="job" data-job="firewood">去砍柴</button><button data-cmd="job" data-job="idle">歇着</button>
      <button data-cmd="favor">${s.favor[i] ? '取消偏袒' : '偏袒'}</button>
      <button data-cmd="exile" title="对他关系很差的人过半数才会通过；失败会结仇">发起放逐投票</button></div>`;
    html += `<div class="mediate">调解与 <select id="med-target">${optionsAlive(s, i)}</select><button data-cmd="mediate">调解</button></div>`;
  }
  // 关系：他 → 每个人（档位标签 + 标签；绝不显示数值与 Strain）
  html += `<h4>${name} 眼中的其他人</h4><div class="rel">`;
  const rows: Array<{ to: number; tier: number; tags: number }> = [];
  for (let e = 0; e < s.edgeCount; e++) if (s.edgeFrom[e] === i) rows.push({ to: s.edgeTo[e], tier: s.edgeTier[e], tags: s.edgeTags[e] });
  rows.sort((a, b) => b.tier - a.tier);
  for (const r of rows) {
    const tags = TAG_ORDER.filter(t => t !== 'Know' && (r.tags & (1 << tagBit(t)))).map(t => TAG_ZH[t]).join('、');
    const back = bondTierOf(s, r.to, i);
    const oneWay = back !== r.tier ? `<span title="对方看他是「${meta.tierLabels[back] ?? '?'}」">⇢</span>` : '';
    html += `<span class="who" data-npc="${r.to}">${meta.names[r.to]} ${oneWay}</span>`
      + `<span class="tier" style="background:${TIER_CSS[r.tier]}">${meta.tierLabels[r.tier]}</span>`
      + (tags ? `<span class="tags">${tags}</span>` : '');
  }
  if (!rows.length) html += '<span class="tags">（没有在世的人了）</span>';
  html += '</div>';
  body.innerHTML = html;
}

const TAG_BITS_ORDER = ['Know', 'Friend', 'ExFriend', 'Lover', 'ExLover', 'Couple', 'Parent', 'Child', 'GrandParent', 'GrandChild',
  'BrotherSisterOlder', 'BrotherSisterYounger', 'Relative', 'Other', 'Divorce', 'Debtor', 'Creditor', 'Suspect'];
const tagBit = (t: string) => TAG_BITS_ORDER.indexOf(t);

function optionsAlive(s: Snapshot, except: number) {
  let o = '';
  for (let j = 0; j < s.count; j++) if (j !== except && s.alive[j]) o += `<option value="${j}">${meta!.names[j]}</option>`;
  return o;
}

function siteHtml(s: Snapshot, k: number): string {
  if (!meta) return '';
  if (s.siteState[k] === 0) return `<h2>？未知之地</h2><div class="sub">还没有人去过。岛民在烦恼时可能会结伴去探路——冬天探路很危险。</div>`;
  const name = SITE_ZH[meta.siteNames[k]] ?? meta.siteNames[k];
  const fill = s.siteFill[k];
  return `<h2>${name}</h2><div class="sub">${RES_ZH[s.siteResource[k]]}来源 · ${s.siteState[k] === 2 ? '已采空，明天会长回来一些' : fill > 0.66 ? '很充足' : fill > 0.33 ? '还剩一半左右' : '快被采光了'}</div>`
    + `<div class="bar"><i style="width:${Math.max(2, fill * 100)}%;background:#4ade80"></i></div>`
    + `<p class="sub">${meta.siteNotes[k] ?? ''}</p>`;
}

/* ───────────── 事件：事件卡 + 编年史 ───────────── */
function onEvents(evs: WorldEvent[]) {
  for (const e of evs) {
    if (e.tension >= 55 || e.kind !== 'scene') chronicle.push(e);
    if (e.tension >= 85 || e.kind === 'death' || e.kind === 'over' || e.kind === 'discover') pushCard(e);
  }
  if (chronicle.length > 400) chronicle.splice(0, chronicle.length - 400);
  renderTimeline();
}

function eventTitle(e: WorldEvent): string {
  if (!meta) return '';
  const nm = (i: number | null | undefined) => (i == null ? '' : meta!.names[i] ?? `#${i}`);
  switch (e.kind) {
    case 'scene': {
      const s = e.scene!;
      const who = [s.F, s.T, s.A].filter(x => x != null).map(nm).join('、');
      return `${sceneTitle(s.scene)}：${who}`;
    }
    case 'death': return `${nm(e.who)} ${CAUSE_ZH[e.text] ?? e.text}`;
    case 'birth': return `${nm(e.who)} 出生了`;
    case 'discover': return `发现了${SITE_ZH[e.text] ?? e.text}`;
    case 'over': return e.text === 'wipe' ? '全岛覆灭' : '一年过去了';
  }
}

function eventBody(e: WorldEvent): string[] {
  if (!meta) return [];
  if (e.kind === 'scene') return whyLines(meta, e.scene!, sim.front);
  if (e.kind === 'death') return [
    { hypothermia: '没有足够的柴火，夜里体温一路掉下去。老人和体弱的人最先撑不住。', dehydration: '取水的人手不够，水先断了——渴比饿死得快。', starvation: '粮食见底，干活的人倒下，产出更少，螺旋向下。', injury: '伤势太重。', exile: '大家投票把他赶出了岛。' }[e.text] ?? '',
    '岛上所有人对他的好感都会上升一些（死者为大），也会更怨你。',
    '接下来三天是哀悼期——这是修补关系的窗口。',
  ];
  if (e.kind === 'discover') return ['岛民探路时找到了新的资源点，从明天起可以去那里采集。', '已知资源点的「还剩多少」决定了每天最多能采多少。'];
  if (e.kind === 'over') return [e.text === 'wipe' ? '没有人活下来。' : `${DAYS} 天过去了。`, '点「新岛」重新开始，或读档回到之前。'];
  return [];
}

function pushCard(e: WorldEvent) {
  const root = $('cards');
  const card = document.createElement('div');
  card.className = 'card' + (e.kind === 'death' ? ' death' : e.tension >= 85 ? ' hot' : '');
  const lines = eventBody(e);
  card.innerHTML = `<h3>${eventTitle(e)}</h3><div class="when">第 ${e.day + 1} 天 ${String(e.hour).padStart(2, '0')}:00</div>`
    + (lines.length ? `<ol>${lines.map(l => `<li>${l}</li>`).join('')}</ol>` : '')
    + `<div class="actions">${focusable(e) ? '<button data-act="look">看看</button>' : ''}<button data-act="ok">知道了</button></div>`;
  card.querySelector<HTMLButtonElement>('[data-act=ok]')!.onclick = () => {
    card.remove();
    if (sim.paused && speedIdx > 0 && !root.querySelector('.card.hot, .card.death')) sim.setPaused(false);
  };
  const look = card.querySelector<HTMLButtonElement>('[data-act=look]');
  if (look) look.onclick = () => lookAt(e);
  root.appendChild(card);
  while (root.children.length > 4) root.firstElementChild?.remove();
}

function focusable(e: WorldEvent) { return e.kind === 'scene' || e.kind === 'death' || e.kind === 'birth'; }
function lookAt(e: WorldEvent) {
  const who = e.kind === 'scene' ? e.scene!.F : e.who;
  if (who != null) selectNpc(who, true);
}

/* 编年史时间轴：60 天一条线，红点 = 高张力，灰 = 死亡，金 = 出生/发现 */
function renderTimeline() {
  const tl = $('timeline');
  tl.innerHTML = '';
  for (let q = 0; q < 4; q++) {
    const d = document.createElement('div');
    d.className = 'season'; d.style.left = `${q * 25}%`; d.textContent = `${SEASON_ZH[q]}`;
    tl.appendChild(d);
  }
  const lanes = new Map<number, number>();
  for (const e of chronicle) {
    const x = Math.min(100, ((e.day + e.hour / 24) / DAYS) * 100);
    const lane = lanes.get(Math.round(x * 2)) ?? 0;
    lanes.set(Math.round(x * 2), lane + 1);
    const dot = document.createElement('div');
    dot.className = 'ev ' + (e.kind === 'death' ? 'dark' : e.kind === 'birth' || e.kind === 'discover' ? 'gold' : e.tension >= 85 ? 'red' : 'blue');
    dot.style.left = `${x}%`; dot.style.top = `${16 + (lane % 3) * 10}px`;
    dot.title = eventTitle(e);
    dot.onclick = () => {
      $('chron-detail').innerHTML = `<b>第 ${e.day + 1} 天 · ${eventTitle(e)}</b><br/>${eventBody(e).join('<br/>')}`;
      if (focusable(e)) lookAt(e);
    };
    tl.appendChild(dot);
  }
  const now = document.createElement('div');
  now.className = 'now'; now.id = 'tl-now';
  tl.appendChild(now);
}
function renderNowMarker(s: Snapshot) {
  const el = document.getElementById('tl-now');
  if (el) el.style.left = `${Math.min(100, ((s.day + s.hour / 24) / DAYS) * 100)}%`;
}

/* ───────────── 交互绑定 ───────────── */
function bindUi() {
  canvas.addEventListener('pointerdown', () => { isle.dragged = false; });
  canvas.addEventListener('click', () => {
    if (isle.dragged) return;
    const p: Pick | null = isle.pick(sim.front);
    if (!p) return;
    if (p.kind === 'npc') selectNpc(p.index, false);
    else { selectedSite = p.index; selected = -1; lastDetailKey = ''; $('detail').hidden = false; }
  });
  $('detail-close').onclick = closeDetail;
  $('detail-body').addEventListener('click', async ev => {
    const t = ev.target as HTMLElement;
    const npc = t.closest<HTMLElement>('[data-npc]');
    if (npc) { selectNpc(Number(npc.dataset.npc), true); return; }
    const b = t.closest<HTMLButtonElement>('[data-cmd]');
    if (!b || selected < 0 || !sim.front) return;
    const s = sim.front;
    let r: { ok: boolean; reason?: string; [k: string]: unknown };
    switch (b.dataset.cmd) {
      case 'job':
        r = await sim.command({ type: 'assignJob', npcId: selected, job: b.dataset.job as 'food' });
        toast(r.ok ? `${meta!.names[selected]} 今天${JOB_ZH[['idle', 'food', 'water', 'firewood'].indexOf(b.dataset.job!)]}（明早 6 点前不会被改派）` : r.reason==='survival' ? '他现在需要先自救。' : '做不到：' + r.reason);
        break;
      case 'favor': {
        const ids: number[] = [];
        for (let j = 0; j < s.count; j++) if (s.favor[j] && j !== selected) ids.push(j);
        if (!s.favor[selected]) ids.push(selected);
        r = await sim.command({ type: 'setFavor', ids });
        toast(s.favor[selected] ? `不再偏袒 ${meta!.names[selected]}` : `开始偏袒 ${meta!.names[selected]}——短缺时他先分到，但其他人会记恨你`);
        break;
      }
      case 'exile': {
        if (!confirm(`对 ${meta!.names[selected]} 发起放逐投票？通过等于让他离开（死亡）。失败的话，投票的人会更恨他。`)) return;
        r = await sim.command({ type: 'exileVote', targetId: selected });
        toast(r.ok ? `${meta!.names[selected]} 被放逐了（${r.votes}/${r.needed} 票）` : r.reason === 'vote_failed' ? `投票没过（${r.votes}/${r.needed} 票）` : '做不到：' + r.reason);
        break;
      }
      case 'mediate': {
        const other = Number($<HTMLSelectElement>('med-target').value);
        r = await sim.command({ type: 'mediate', a: selected, b: other });
        const reasons: Record<string, string> = { cooldown: `这两人 ${r.daysLeft ?? ''} 天内刚调解过`, too_hostile: '积怨太深，调解失败，反而更糟了', dead: '有人已不在世' };
        toast(r.ok ? `调解了 ${meta!.names[selected]} 和 ${meta!.names[other]}——心结松了一些（大家也会觉得你多管闲事）` : (reasons[r.reason ?? ''] ?? '做不到：' + r.reason));
        break;
      }
    }
    lastDetailKey = '';
  });
  document.querySelectorAll<HTMLButtonElement>('#hud .speed button').forEach(b => {
    b.onclick = () => setSpeed(Number(b.dataset.speed));
  });
  window.addEventListener('keydown', e => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); setSpeed(sim.paused ? Math.max(1, speedIdx) : 0); }
    if (e.code === 'Escape') closeDetail();
  });
  $<HTMLInputElement>('autopause').onchange = e => sim.setAutoPause((e.target as HTMLInputElement).checked);
  const ration = $<HTMLInputElement>('ration');
  ration.oninput = () => {
    const v = Number(ration.value);
    $('ration-v').textContent = v < 0.45 ? '饿着' : v < 0.85 ? '紧缩' : v <= 1.15 ? '正常' : v <= 1.6 ? '宽松' : '敞开吃';
  };
  ration.onchange = () => sim.command({ type: 'setRation', value: Number(ration.value) });
  $<HTMLInputElement>('winterprep').onchange = e => sim.command({ type: 'setWinterPrep', value: (e.target as HTMLInputElement).checked });
  $('btn-help').onclick = () => { $('help').hidden = false; };
  $('help-close').onclick = () => { $('help').hidden = true; localStorage.setItem('cruel-isle-seen-help', '1'); };
  $('btn-new').onclick = () => {
    if (!confirm('放弃这座岛，开一座新的？')) return;
    sim.init(Math.floor(Math.random() * 1e6), DAYS);
    $('cards').innerHTML = ''; resetPolicyUi();
  };
  $('btn-save').onclick = async () => {
    const save = await sim.save();
    // SPEC §10 建议 IndexedDB；20 KB 级存档先放 localStorage，正式版再换
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    toast(`已存档（第 ${save.meta.day + 1} 天 ${save.meta.hour}:00${save.pendingScene ? '，正停在一场事件中' : ''}）`);
  };
  $('btn-load').onclick = () => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { toast('还没有存档'); return; }
    sim.load(JSON.parse(raw));
    $('cards').innerHTML = '';
    toast('已读档');
  };
}

function resetPolicyUi() {
  $<HTMLInputElement>('ration').value = '1'; $('ration-v').textContent = '正常';
  $<HTMLInputElement>('winterprep').checked = true;
}

function setSpeed(idx: number) {
  if (idx === 0) { sim.setPaused(true); }
  else { speedIdx = idx; sim.setSpeed(SPEED_TPS[idx]); sim.setPaused(false); }
  document.querySelectorAll<HTMLButtonElement>('#hud .speed button').forEach(b => {
    b.classList.toggle('on', Number(b.dataset.speed) === (idx === 0 ? 0 : speedIdx));
  });
}

let toastTimer = 0;
function toast(msg: string) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 3200);
}

boot().catch(err => {
  document.body.innerHTML = `<pre style="color:#f87171;padding:20px">启动失败：${(err as Error).stack ?? err}</pre>`;
});
