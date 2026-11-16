export function createGameIslandView(root, options) {
  const host = document.createElement('section');
  host.className = 'game-island-world';
  host.setAttribute('aria-label', '初见岛');
  host.hidden = true;
  root.append(host);
  let phaseKey = '', mode = '', dispose, generation = 0, suspended = false;
  let focusBefore, inertSiblings = [];
  const canEmbed = () => {
    const state = options.getState();
    return state.selectedMap === 'island' && ['build','recording'].includes(state.phase);
  };

  function releaseFocus() {
    for (const node of inertSiblings) node.inert = false;
    inertSiblings = [];
    host.removeAttribute('aria-modal');
    host.removeAttribute('role');
    if (focusBefore?.isConnected) focusBefore.focus({preventScroll:true});
    focusBefore = null;
  }

  function setMode(next) {
    if (mode === next) return;
    if (mode === 'full') releaseFocus();
    mode = next;
    host.dataset.view = next;
    host.hidden = !next;
    root.classList.toggle('has-live-island', Boolean(next));
    if (next === 'full') {
      focusBefore = document.activeElement;
      inertSiblings = [...root.children].filter(node => node !== host && !node.inert);
      for (const node of inertSiblings) node.inert = true;
      host.setAttribute('role','dialog');
      host.setAttribute('aria-modal','true');
      host.tabIndex = -1;
      host.focus({preventScroll:true});
    }
  }

  function hide() {
    generation++;
    setMode('');
    dispose?.();
    dispose = undefined;
    host.replaceChildren();
  }

  function close() {
    if (canEmbed() && !suspended && mode === 'full') setMode('embedded');
    else hide();
  }

  async function show(next = 'full') {
    if (mode) { setMode(next); return; }
    const token = ++generation;
    setMode(next);
    try {
      const {mountLiveIsland} = await import('./artStudy/liveIsland.js');
      if (token !== generation) return;
      const cleanup = await mountLiveIsland(host,{...options,onClose:close});
      if (token !== generation) { cleanup?.(); return; }
      dispose = cleanup;
    } catch (error) {
      if (token !== generation) return;
      hide();
      options.onError(error);
    }
  }

  function sync() {
    const state = options.getState();
    const key = state.phase + '/' + state.selectedMap;
    if (key === phaseKey) return;
    phaseKey = key;
    suspended = false;
    if (canEmbed()) void show('embedded');
    else if (mode) hide();
  }

  function suspend() {
    if (mode === 'embedded') {
      suspended = true;
      hide();
    }
  }
  function presentCameraCut(wantsCut,mandatory) {
    if (!mode) return true;
    if (mandatory && mode === 'full') close();
    host.hidden = !mode || (mode === 'embedded' && wantsCut);
    return host.hidden;
  }
  host.addEventListener('keydown',event=>{
    if(event.key === 'Escape' && mode === 'full') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  return { get active(){return Boolean(mode);},get full(){return mode==='full';},show,sync,suspend,close,hide,presentCameraCut };
}
