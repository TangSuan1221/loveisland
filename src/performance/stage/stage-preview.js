import { STAGES } from './stage-data.js';
import { StageRenderer } from './stage-renderer.js';
import { makeStageCanvas, stageNames } from './stage-presentation.js';

export async function openStagePreview(query) {
  const id = query.get('perf');
  const root = document.querySelector('#app');
  if (!Object.hasOwn(STAGES,id)) {
    root.textContent = '未知舞台。可用场景：' + Object.keys(STAGES).join('、');
    return;
  }
  document.title = stageNames[id] + ' · 荒岛心跳';
  document.body.style.margin = '0';
  root.style.cssText = 'position:fixed;inset:0;overflow:hidden';
  const canvas = makeStageCanvas(document);
  root.replaceChildren(canvas);
  const still = query.get('still') === '1';
  const framing = query.get('framing') === 'full' ? 'full' : 'story';
  if (!still) {
    const nav = document.createElement('nav');
    nav.style.cssText = 'position:absolute;top:12px;left:12px;z-index:2;display:flex;gap:6px';
    const selector = document.createElement('select');
    selector.setAttribute('aria-label','定妆场景');
    for (const [key,name] of Object.entries(stageNames)) selector.add(new Option(name,key));
    selector.value = id;
    selector.onchange = () => {
      const url = new URL(location.href);
      url.searchParams.set('perf',selector.value);
      location.replace(url);
    };
    const back = document.createElement('button');
    back.textContent = '返回放映室';
    back.onclick = () => {
      const url = new URL(location.href);
      for (const key of ['perf','still','t']) url.searchParams.delete(key);
      if (!url.searchParams.has('cinema-review')) url.searchParams.set('cinema-review','');
      location.assign(url);
    };
    for (const control of [selector,back]) control.style.cssText = 'font:14px system-ui;color:white;background:#203333ed;border:1px solid #ffffff60;border-radius:6px;padding:6px 10px';
    const camera = document.createElement('select');
    camera.setAttribute('aria-label','演出机位');
    camera.add(new Option('剧情机位','story'));
    camera.add(new Option('全身机位','full'));
    camera.value = framing;
    camera.style.cssText = selector.style.cssText;
    camera.onchange = () => {
      const url = new URL(location.href);
      url.searchParams.set('framing',camera.value);
      location.replace(url);
    };
    nav.append(selector,camera,back);
    root.append(nav);
  }
  const seed = Number(query.get('seed') ?? 1);
  const start = Number(query.get('t') ?? (still ? 2 : 0));
  let renderer, request = 0, time = Number.isFinite(start) ? Math.max(0,start) : 0;
  let previous;
  try {
    renderer = new StageRenderer(canvas, STAGES[id], { seed: Number.isFinite(seed) ? seed : 1 });
    await renderer.ready;
    let settings = still ? { adaptive:false } : {};
    if (still) window.renderStageStill = (options = {}) => {
      settings = { adaptive:false, ...options };
      if (Number.isFinite(options.time)) time = Math.max(0,options.time);
      draw();
      return renderer.stats;
    };
    function draw() {
      renderer.render(time,{framing,...settings});
      canvas.dataset.stageReady = 'true';
    }
    function resize() {
      renderer.resize(root.clientWidth, root.clientHeight, still ? 1 : Math.min(window.devicePixelRatio || 1,1.5));
      draw();
    }
    function animate(stamp) {
      if (previous !== undefined) time += Math.max(0,(stamp-previous)/1000);
      previous = stamp;
      draw();
      request = requestAnimationFrame(animate);
    }
    resize();
    if (!still) request = requestAnimationFrame(animate);
    window.addEventListener('resize',resize);
    window.addEventListener('pagehide',event=>{
      if (event.persisted) return;
      cancelAnimationFrame(request);
      window.removeEventListener('resize',resize);
      renderer.dispose();
    },{once:true});
  } catch (error) {
    renderer?.dispose();
    root.textContent = '演出舞台加载失败：' + error.message;
    console.error(error);
  }
}
