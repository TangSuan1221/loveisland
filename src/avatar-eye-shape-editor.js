import { createEyeCurve, EYE_CURVE_FIELDS as FIELDS, readEyeShape as readShape } from './avatar-eye-curve.js';
// Standalone normalized eye-curve editor. Schema and avatar rendering live elsewhere.
const SVG_NS = 'http://www.w3.org/2000/svg';
const ORIGIN = { x: 180, y: 210 }, SCALE = 100;
const POINTS = [
  { id: 'inner', label: '内眼角', x: -1, yKey: 'eyeInnerY' },
  { id: 'outer', label: '外眼角', x: 1, yKey: 'eyeOuterY' },
  { id: 'upperInner', label: '上睑内控制点', xKey: 'eyeUpperInnerX', yKey: 'eyeUpperInnerY', maxPeer: 'eyeUpperOuterX' },
  { id: 'upperOuter', label: '上睑外控制点', xKey: 'eyeUpperOuterX', yKey: 'eyeUpperOuterY', minPeer: 'eyeUpperInnerX' },
  { id: 'lowerInner', label: '下睑内控制点', xKey: 'eyeLowerInnerX', yKey: 'eyeLowerInnerY', maxPeer: 'eyeLowerOuterX' },
  { id: 'lowerOuter', label: '下睑外控制点', xKey: 'eyeLowerOuterX', yKey: 'eyeLowerOuterY', minPeer: 'eyeLowerInnerX' },
];
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const round = v => Math.round(v * 100000) / 100000;
const screen = (x, y) => `${round(ORIGIN.x + x * SCALE)},${round(ORIGIN.y - y * SCALE)}`;

/**
 * getAppearance returns the current plain appearance object. onChange merges a
 * field-only patch synchronously (and must not itself add history). onCommit gets
 * a detached full BEFORE snapshot, once per effective gesture, for parent undo.
 * Cancelling restores only fields written by that gesture, including undefined
 * for an originally absent field so the parent schema can supply its default.
 */
export function mountEyeShapeEditor(host, { getAppearance, onChange, onCommit }) {
  const doc = host.ownerDocument, win = doc.defaultView;
  const root = doc.createElement('div');
  root.className = 'av-eye-shape-editor';
  root.innerHTML = `
    <style>
      .av-eye-shape-editor{font:inherit;color:#203b35;max-width:520px;min-width:0}
      .av-eye-shape-editor *{box-sizing:border-box}
      .av-eye-shape-editor [hidden]{display:none!important}
      .av-eye-shape-editor p{font-size:12px;line-height:1.6;margin:8px 0}
      .av-eye-shape-editor button{font:inherit;font-size:12px;line-height:1.4;min-height:44px;padding:8px 10px;border:1px solid #b8c9c2;border-radius:8px;background:#fff;color:#203b35;cursor:pointer;white-space:normal}
      .av-eye-shape-editor button:hover{background:#edf5f1}
      .av-eye-shape-editor button:focus-visible{outline:3px solid #2476ce;outline-offset:2px}
      .av-eye-shape-editor .eye-board{display:block;width:100%;height:auto;background:#f3f7f5;border:1px solid #b8c9c2;border-radius:10px;touch-action:none;user-select:none;-webkit-user-select:none}
      .av-eye-shape-editor .eye-point{cursor:grab;touch-action:none;outline:none}
      .av-eye-shape-editor .eye-point:active{cursor:grabbing}
      .av-eye-shape-editor .eye-dot{fill:#fff;stroke:#216ecd;stroke-width:2.5}
      .av-eye-shape-editor .eye-point[aria-pressed="true"] .eye-dot{fill:#216ecd;stroke:#fff;stroke-width:3}
      .av-eye-shape-editor .eye-focus-ring{fill:none;stroke:transparent;stroke-width:2}
      .av-eye-shape-editor .eye-point:focus-visible .eye-focus-ring{stroke:#216ecd}
      .av-eye-shape-editor .eye-point-label{font:11px sans-serif;fill:#28483e;paint-order:stroke;stroke:#f3f7f5;stroke-width:3;pointer-events:none}
      .av-eye-shape-editor .eye-point-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:8px 0}
      .av-eye-shape-editor .eye-point-list [aria-pressed="true"]{border-color:#216ecd;background:#e7f0ff;color:#174d91}
      .av-eye-shape-editor .eye-readout{display:block;min-height:3.2em;font-size:12px;line-height:1.6;font-variant-numeric:tabular-nums}
      .av-eye-shape-editor .eye-reset{margin-top:8px}
    </style>
    <div data-eye-enable-panel><p>启用动漫设计眼型后，可直接拖动控制点编辑上下眼睑曲线。</p><button type="button" data-eye-enable>启用动漫眼形编辑</button></div>
    <section data-eye-panel aria-label="动漫眼形控制点编辑器">
      <p>拖动圆点改变真实曲线；内眼角在左，外眼角在右，y 向上。虚线连接原始控制点，不是眼睑。</p>
      <p data-eye-lid-note></p>
      <svg class="eye-board" viewBox="0 0 360 380" preserveAspectRatio="xMidYMid meet" role="group" aria-label="眼形曲线，六个可拖拽控制点">
        <g aria-hidden="true" fill="none" stroke="#c4d3cc" stroke-width="1" stroke-dasharray="4 5">
          <path d="M 45 210 H 315 M 180 18 V 358"/>
        </g>
        <g aria-hidden="true" fill="#667c73" font-size="11"><text x="187" y="18">y ↑</text><text x="312" y="225">x →</text></g>
        <path data-eye-sclera fill="#fff" stroke="none"/>
        <g fill="none" stroke="#6c9eb2" stroke-width="1.25" stroke-dasharray="5 4" aria-hidden="true">
          <polyline data-eye-guide="upper"/><polyline data-eye-guide="lower"/>
        </g>
        <path data-eye-curve="upper" fill="none" stroke="#243e37" stroke-width="3.5" stroke-linecap="round"/>
        <path data-eye-curve="lower" fill="none" stroke="#486b5f" stroke-width="2.5" stroke-linecap="round"/>
        <g data-eye-handles></g>
      </svg>
      <div class="eye-point-list" role="group" aria-label="选择控制点"></div>
      <output class="eye-readout" aria-live="polite" aria-atomic="true"></output>
      <p>选中控制点后用方向键调整（每次 0.02）；Shift＋方向键细调（0.002）。内外眼角只可上下移动。Escape 取消本次调整。</p>
      <button type="button" class="eye-reset" data-eye-reset>重置眼形</button>
    </section>`;
  host.append(root);
  const q = selector => root.querySelector(selector);
  const svg = q('svg'), panel = q('[data-eye-panel]'), enablePanel = q('[data-eye-enable-panel]');
  const controls = new Map(), listeners = [], blockedKeys = new Set();
  let gesture = null, selected = 'upperInner', destroyed = false;
  const appearance = () => getAppearance() || {};
  const snapshot = () => structuredClone(appearance());
  const listen = (element, type, handler, capture = false) => {
    element.addEventListener(type, handler, capture);
    listeners.push(() => element.removeEventListener(type, handler, capture));
  };
  const makeSvg = (tag, attrs) => {
    const element = doc.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
    return element;
  };
  const coordinates = (point, shape) => ({ x: point.xKey ? shape[point.xKey] : point.x, y: shape[point.yKey] });

  for (const point of POINTS) {
    const handle = makeSvg('g', { class: 'eye-point', 'data-eye-point': point.id, tabindex: 0, role: 'button' });
    handle.append(makeSvg('circle', { r: 24, fill: 'transparent' }));
    handle.append(makeSvg('circle', { r: 12, class: 'eye-focus-ring', 'aria-hidden': true }));
    handle.append(makeSvg('circle', { r: 6.5, class: 'eye-dot', 'aria-hidden': true }));
    const left = point.id === 'inner' || point.id.endsWith('Inner');
    const label = makeSvg('text', { x: left ? -13 : 13, y: point.id.startsWith('lower') ? 20 : -14,
      'text-anchor': left ? 'end' : 'start', class: 'eye-point-label', 'aria-hidden': true });
    label.textContent = point.label;
    handle.append(label);
    q('[data-eye-handles]').append(handle);
    const button = doc.createElement('button');
    button.type = 'button';
    button.dataset.eyeSelect = point.id;
    button.textContent = point.label;
    q('.eye-point-list').append(button);
    controls.set(point.id, { handle, button });
    for (const element of [handle, button]) {
      listen(element, 'focus', () => { selected = point.id; render(); });
      listen(element, 'click', () => { selected = point.id; render(); });
      listen(element, 'keydown', event => keyDown(event, point, element));
      listen(element, 'blur', () => { if (gesture?.element === element) finish(true); });
    }
    listen(handle, 'pointerdown', event => pointerDown(event, point, handle));
  }

  function render() {
    if (destroyed) return;
    const a = appearance(), enabled = !!gesture || a.eyeStyle === 'anime_designed';
    panel.hidden = !enabled;
    enablePanel.hidden = enabled;
    if (!enabled) return;
    const shape = readShape(a), points = Object.fromEntries(POINTS.map(p => [p.id, coordinates(p, shape)]));
    const s = id => screen(points[id].x, points[id].y);
    const curve = createEyeCurve(a);
    const control = p => screen(...p);
    // Preserve legacy C paths when certified safe. Extreme shapes use exactly
    // production's constrained polyline, never an unclipped raw-C illustration.
    const sampledPath = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${ORIGIN.x + x*SCALE},${ORIGIN.y - y*SCALE}`).join(' ');
    const cubicPath = pts => `M ${control(pts[0])} C ${pts.slice(1).map(control).join(' ')}`;
    const upper = curve.sampled ? sampledPath(curve.upper) : cubicPath(curve.upperControls);
    const lower = curve.sampled ? sampledPath(curve.lower) : cubicPath(curve.lowerControls);
    svg.dataset.eyeBoundary = curve.sampled ? 'sampled' : 'cubic';
    q('[data-eye-lid-note]').textContent = `实线及白眼边界已应用上睑下压（上睑控制点 y × ${curve.upperScale.toFixed(3)}）；虚线、圆点与坐标仍是原始参数。${curve.sampled ? '极限组合采用与模型、虹膜裁剪相同的采样边界，向外约束边界，防止交叉、开口过窄及虹膜边缘越界；存档控制点不变。' : '眼角和下睑保持不变。'}`;
    q('[data-eye-curve="upper"]').setAttribute('d', upper);
    q('[data-eye-curve="lower"]').setAttribute('d', lower);
    const closing = curve.sampled ? sampledPath(curve.lower.slice().reverse()).replace(/^M /, 'L ') : `C ${s('lowerOuter')} ${s('lowerInner')} ${s('inner')}`;
    q('[data-eye-sclera]').setAttribute('d', `${upper} ${closing} Z`);
    q('[data-eye-guide="upper"]').setAttribute('points', ['inner', 'upperInner', 'upperOuter', 'outer'].map(s).join(' '));
    q('[data-eye-guide="lower"]').setAttribute('points', ['inner', 'lowerInner', 'lowerOuter', 'outer'].map(s).join(' '));
    for (const point of POINTS) {
      const { handle, button } = controls.get(point.id), p = points[point.id];
      handle.setAttribute('transform', `translate(${s(point.id)})`);
      handle.setAttribute('aria-label', `${point.label}，x ${p.x.toFixed(3)}，y ${p.y.toFixed(3)}；${point.xKey ? '方向键移动' : '上下方向键移动'}，Shift 细调`);
      handle.setAttribute('aria-pressed', String(point.id === selected));
      button.setAttribute('aria-pressed', String(point.id === selected));
    }
    const point = POINTS.find(p => p.id === selected), p = points[selected];
    q('.eye-readout').textContent = `已选：${point.label} · x ${p.x.toFixed(3)} · y ${p.y.toFixed(3)}${point.xKey ? '（横向不越过同眼睑另一控制点）' : '（x 固定）'}`;
  }

  function pointerCoordinates(event) {
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
    // CTM accounts for responsive sizing, letterboxing, and ancestor transforms.
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    try {
      const p = svg.createSVGPoint();
      p.x = event.clientX; p.y = event.clientY;
      const local = p.matrixTransform(matrix.inverse());
      if (!Number.isFinite(local.x) || !Number.isFinite(local.y)) return null;
      return { x: (local.x - ORIGIN.x) / SCALE, y: (ORIGIN.y - local.y) / SCALE };
    } catch { return null; }
  }

  function begin(kind, point, element) {
    const before = snapshot(), beforeShape = readShape(before);
    gesture = { kind, point, element, before, beforeShape, touched: new Set(), keys: new Set() };
    return gesture;
  }

  function updatePoint(point, x, y) {
    const a = readShape(appearance()), patch = {};
    const stable = (value, key) => Math.abs(value - a[key]) < 1e-9 ? a[key]
      : Math.abs(value - gesture.beforeShape[key]) < 1e-9 ? gesture.beforeShape[key] : round(value);
    if (point.xKey) {
      const [, min, max] = FIELDS[point.xKey];
      const value = clamp(stable(x, point.xKey), point.minPeer ? a[point.minPeer] : min, point.maxPeer ? a[point.maxPeer] : max);
      if (value !== a[point.xKey]) patch[point.xKey] = value;
    }
    const [, min, max] = FIELDS[point.yKey], value = clamp(stable(y, point.yKey), min, max);
    if (value !== a[point.yKey]) patch[point.yKey] = value;
    if (!Object.keys(patch).length) return;
    for (const key of Object.keys(patch)) gesture.touched.add(key);
    onChange(patch);
    render();
  }

  function finish(cancel = false) {
    if (!gesture) return;
    const g = gesture;
    // Clear before releasing capture/calling the parent: both can re-enter us.
    gesture = null;
    if (cancel && g.kind === 'keyboard') for (const key of g.keys) blockedKeys.add(key);
    if (g.kind === 'pointer' && svg.hasPointerCapture(g.pointerId)) svg.releasePointerCapture(g.pointerId);
    if (cancel) {
      if (g.touched.size) onChange(Object.fromEntries([...g.touched].map(key => [key, g.before[key]])));
    } else {
      const current = readShape(appearance());
      if ([...g.touched].some(key => current[key] !== g.beforeShape[key])) onCommit(g.before);
    }
    render();
  }

  function pointerDown(event, point, handle) {
    if (destroyed || gesture || event.button !== 0 || event.isPrimary === false || appearance().eyeStyle !== 'anime_designed') return;
    const start = pointerCoordinates(event);
    if (!start) return;
    event.preventDefault(); event.stopPropagation();
    handle.focus({ preventScroll: true });
    selected = point.id;
    const g = begin('pointer', point, handle);
    g.pointerId = event.pointerId;
    g.start = start;
    g.origin = coordinates(point, g.beforeShape);
    // Window listeners also provide a safe fallback if capture is lost/unavailable.
    try { svg.setPointerCapture(event.pointerId); } catch { /* e.g. a detached pointer */ }
    render();
  }

  function pointerMove(event) {
    const g = gesture;
    if (g?.kind !== 'pointer' || g.pointerId !== event.pointerId) return;
    const p = pointerCoordinates(event);
    if (!p) return;
    updatePoint(g.point, g.origin.x + p.x - g.start.x, g.origin.y + p.y - g.start.y);
  }

  function keyDown(event, point, element) {
    if (!ARROWS[event.key] || event.ctrlKey || event.metaKey || event.altKey || appearance().eyeStyle !== 'anime_designed') return;
    event.preventDefault(); event.stopPropagation();
    if (destroyed || gesture?.kind === 'pointer') return;
    if (blockedKeys.has(event.key) && event.repeat) return;
    blockedKeys.delete(event.key);
    const [dx, dy] = ARROWS[event.key];
    if (!point.xKey && !dy) return;
    if (gesture && gesture.element !== element) finish(true);
    const g = gesture || begin('keyboard', point, element);
    g.keys.add(event.key);
    selected = point.id;
    const p = coordinates(point, readShape(appearance())), step = event.shiftKey ? .002 : .02;
    updatePoint(point, p.x + dx * step, p.y + dy * step);
  }

  listen(win, 'pointermove', pointerMove, true);
  listen(win, 'pointerup', event => {
    if (gesture?.kind !== 'pointer' || gesture.pointerId !== event.pointerId) return;
    pointerMove(event);
    finish();
  }, true);
  const cancelPointer = event => {
    if (gesture?.kind === 'pointer' && gesture.pointerId === event.pointerId) finish(true);
  };
  listen(win, 'pointercancel', cancelPointer, true);
  listen(svg, 'lostpointercapture', cancelPointer);
  listen(doc, 'keydown', event => {
    if (event.key !== 'Escape' || !gesture) return;
    event.preventDefault(); event.stopPropagation();
    finish(true);
  }, true);
  listen(win, 'keyup', event => {
    blockedKeys.delete(event.key);
    if (gesture?.kind !== 'keyboard' || !gesture.keys.has(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    gesture.keys.delete(event.key);
    if (!gesture.keys.size) finish();
  }, true);
  listen(win, 'blur', () => finish(true));
  listen(doc, 'visibilitychange', () => { if (doc.hidden) finish(true); });

  function applyOnce(patch) {
    if (!Object.keys(patch).length) return;
    const before = snapshot();
    onChange(patch);
    // Activation may synchronously remount this widget; it still owns this commit.
    onCommit(before);
    render();
  }
  listen(q('[data-eye-enable]'), 'click', () => {
    if (destroyed) return;
    finish(true);
    if (appearance().eyeStyle !== 'anime_designed') applyOnce({ eyeStyle: 'anime_designed' });
  });
  listen(q('[data-eye-reset]'), 'click', () => {
    if (destroyed || appearance().eyeStyle !== 'anime_designed') return;
    finish(true);
    const shape = readShape(appearance());
    applyOnce(Object.fromEntries(Object.entries(FIELDS).filter(([key, [value]]) => shape[key] !== value).map(([key, [value]]) => [key, value])));
  });

  render();
  return {
    // Rendering preserves nodes, focus, and capture, even during an active drag.
    refresh() { render(); },
    // Navigation must roll back an unfinished gesture before host dirty checks.
    cancel() { if (!destroyed) finish(true); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try { finish(true); }
      finally { for (const remove of listeners) remove(); root.remove(); }
    },
  };
}
