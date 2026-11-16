import './cinema-fx.css';

const effects = new Set(['hearts', 'warm', 'spark', 'impact', 'cool', 'vignette']);
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const ease = value => value * value * (3 - 2 * value);

// Stagger, outward travel, rise and sprite size. The same beat always draws the same path.
const motes = [
  [0, .10, .72, 1.0], [.06, .29, .96, .55], [.13, .50, .86, .74],
  [.20, .15, 1.08, .50], [.28, .63, .88, .68], [.34, .40, .77, .42]
];

export function createCinemaFx(root) {
  const doc = root.ownerDocument;
  const layer = doc.createElement('div');
  layer.className = 'cinema-fx';
  layer.hidden = true;
  layer.setAttribute('aria-hidden', 'true');
  const grade = doc.createElement('div');
  grade.className = 'cinema-fx-grade';
  const emitter = doc.createElement('div');
  emitter.className = 'cinema-fx-emitter';
  const particles = motes.map(() => emitter.appendChild(doc.createElement('i')));
  layer.append(grade, emitter);
  root.appendChild(layer);
  const reduced = doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
  function clear() {
    layer.hidden = true;
    layer.removeAttribute('data-fx');
  }
  function frame(shot, progress, anchor) {
    const fx = shot?.fx;
    if (!effects.has(fx)) {
      if (!layer.hidden) clear();
      return;
    }
    const t = clamp(Number.isFinite(progress) ? progress : 0);
    const x = Number.isFinite(anchor?.x) ? anchor.x : .5;
    const y = Number.isFinite(anchor?.y) ? anchor.y : .5;
    layer.hidden = false;
    if (layer.dataset.fx !== fx) layer.dataset.fx = fx;
    // Keep the darkest corners away from the featured face, even on a reverse shot.
    const ax = clamp(x) * 100, ay = clamp(y) * 100;
    grade.style.setProperty('--focus-x', ax.toFixed(2) + '%');
    grade.style.setProperty('--focus-y', ay.toFixed(2) + '%');
    const envelope = ease(clamp(t / .10)) * ease(clamp((1-t) / .22));
    const strength = fx === 'impact' ? Math.pow(1 - t, 4) : envelope;
    grade.style.opacity = (strength * (reduced?.matches ? .52 : 1)).toFixed(3);
    if (fx !== 'hearts' && fx !== 'spark') return;
    const onScreen = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    emitter.hidden = !onScreen;
    if (!onScreen) return;
    emitter.style.left = ax + '%';
    emitter.style.top = ay + '%';
    const direction = x > .85 ? -1 : x < .15 ? 1 : x >= .5 ? 1 : -1;
    const faceClose = shot.kind === 'faceF' || shot.kind === 'faceT';
    const clearance = faceClose ? 17 : 7;
    for (let i = 0; i < particles.length; i++) {
      const [delay, spread, rise, scale] = motes[i];
      const p = clamp((t-delay) / .64);
      const sprite = particles[i];
      const opacity = Math.sin(Math.PI * p);
      const travel = reduced?.matches ? .32 : p;
      const dx = direction * (clearance + spread * 7 + travel * (spread * 6 + 2));
      const dy = -(3 + rise * 13 * travel);
      sprite.style.opacity = (opacity * (reduced?.matches ? .45 : .89)).toFixed(3);
      sprite.style.transform = `translate(${dx.toFixed(2)}vmin,${dy.toFixed(2)}vmin) rotate(${direction*(i*7-12)}deg) scale(${(scale*(.68+.32*opacity)).toFixed(3)})`;
    }
  }
  return {frame, clear};
}
