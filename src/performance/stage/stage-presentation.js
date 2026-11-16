import { STAGES } from './stage-data.js';
import { StageRenderer } from './stage-renderer.js';

export const stageNames = { hanami: '花见', cabin: '炉边', orb: '占星室' };

export function makeStageCanvas(doc) {
  const canvas = doc.createElement('canvas');
  canvas.id = 'perf-stage';
  canvas.setAttribute('aria-label', '演出舞台');
  Object.assign(canvas.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none',
  });
  return canvas;
}

// Both the live director and the screening room feed sampled actors into this surface.
export function createStagePresentation(root) {
  let canvas, renderer, current, sample, automatic, failed, loading;
  let preference = 'auto';
  let dimensions = '';
  function hide() {
    sample = null;
    hideCanvas();
  }
  function hideCanvas() {
    if (canvas) canvas.hidden = true;
    delete root.dataset.performanceStage;
  }
  function releaseAfterFailure(error) {
    console.warn('演出舞台无法绘制，切回岛上镜头。', error);
    failed = true;
    hide();
    renderer?.dispose();
    canvas?.remove();
  }
  function render() {
    if (!sample || failed) return false;
    const { time, frame } = sample;
    const next = preference === 'auto' ? automatic : preference;
    if (!STAGES[next] || (preference === 'auto' && frame.shot.kind === 'location')) {
      // Retain the sampled beat so a paused screening can change backdrops.
      hideCanvas();
      return false;
    }
    try {
      if (!renderer) {
        canvas = makeStageCanvas(root.ownerDocument);
        canvas.style.zIndex = '2';
        canvas.style.filter = 'brightness(calc(1 - var(--cinema-cut, 0)))';
        root.append(canvas);
        renderer = new StageRenderer(canvas, STAGES[next], { seed: 1 });
      } else if (next !== current) {
        const duration = current && root.dataset.playback !== 'paused' ? .85 : 0;
        renderer.setStage(STAGES[next], time, duration);
      }
      if (next !== current) {
        const pending = renderer.ready;
        loading = pending;
        pending.then(()=>{
          if (loading === pending) loading = null;
        },error=>{
          if (loading === pending) releaseAfterFailure(error);
        });
      }
      current = next;
      if (loading) {
        const keepLastFrame = Boolean(root.dataset.performanceStage);
        canvas.hidden = !keepLastFrame;
        return keepLastFrame;
      }
      canvas.hidden = false;
      const { clientWidth: w, clientHeight: h } = root;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const size = w + '/' + h + '/' + dpr;
      if (dimensions !== size) {
        renderer.resize(Math.max(1,w), Math.max(1,h), dpr);
        dimensions = size;
      }
      renderer.render(time, frame);
      root.dataset.performanceStage = next;
      return true;
    } catch (error) {
      releaseAfterFailure(error);
      return false;
    }
  }
  return {
    start(theme) {
      automatic = ['blush','floral','comic','discovery'].includes(theme) ? 'hanami'
        : ['stars','subdued','tension','music'].includes(theme) ? 'orb' : 'cabin';
    },
    sample(time,frame) {
      // Keep establishing shots of the actual construction site in the story.
      sample = { time, frame };
    },
    setPreference(value) { preference = value === 'island' || Object.hasOwn(STAGES,value) ? value : 'auto'; },
    hide() { hide(); current = null; },
    render,
    dispose() { hide(); renderer?.dispose(); canvas?.remove(); },
  };
}
