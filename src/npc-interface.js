import * as THREE from 'three';

// Presentation only: all choices, outcomes and memories belong to the simulation.
export function createNPCInterface({ simulation, actors, camera, controls, root, onSelect, onCamera, isBlocked }) {
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const bar = make('div', 'life-toolbar');
  const toggle = make('button', 'life-toggle', '岛上生活');
  const director = make('button', 'life-director', '自动运镜 · 关');
  toggle.setAttribute('aria-expanded', 'false');
  director.setAttribute('aria-pressed', 'false');
  bar.append(toggle, director);
  const panel = make('section', 'life-panel'); panel.hidden = true;
  panel.setAttribute('aria-label', '岛上生活与关系');
  const heading = make('div', 'life-heading');
  heading.append(make('strong', '', '每个人，都有自己的打算'));
  const close = make('button', '', '收起'); heading.append(close);
  const roster = make('div', 'life-roster');
  const detail = make('div', 'life-detail');
  const history = make('div', 'life-history');
  panel.append(heading, roster, detail, make('h3', '', '刚刚发生'), history);
  const caption = make('div', 'life-caption'); caption.hidden = true;
  caption.setAttribute('aria-label', '当前互动对话');
  const bubbles = make('div', 'life-bubbles');
  root.append(bar, panel, caption, bubbles);
  let selectedId = actors[0]?.id, auto = false, cooldownUntil = 0, elapsed = 0, nextUI = 0, shot = '', lastScene = null, conversationSide = null;
  let detailId = null, rows = new Map(), projected = new THREE.Vector3();
  const labels = new Map();
  for (const actor of actors) {
    const row = make('button', 'life-person');
    const name = make('strong', '', actor.name), state = make('span', '', '正在想今天的计划');
    row.append(name, state); row.onclick = () => { select(actor.id); onSelect(actor); };
    roster.append(row); rows.set(actor.id, { row, state });
    const label = make('div', 'life-bubble'); label.hidden = true;
    bubbles.append(label); labels.set(actor.id, label);
  }
  function setOpen(value) { panel.hidden = !value; toggle.setAttribute('aria-expanded', String(value)); }
  toggle.onclick = () => setOpen(panel.hidden); close.onclick = () => setOpen(false);
  director.onclick = () => { auto = !auto; shot = ''; director.textContent = `自动运镜 · ${auto ? '开' : '关'}`; director.setAttribute('aria-pressed', String(auto)); };
  function select(id) { selectedId = id; detailId = null; }
  function suspend() { cooldownUntil = elapsed + 12; shot = ''; }
  function buildDetail(state) {
    detail.replaceChildren(); detailId = state.id;
    detail.append(make('h3', '', `${actors.find(a => a.id === state.id)?.name || ''}的近况`));
    detail.append(make('p', 'life-personality'));
    const needs = make('div', 'life-needs');
    for (const [key, label] of [['hunger','饥饿'],['energy','疲惫'],['social','社交需要'],['fun','无聊']]) {
      const wrap = make('label'); wrap.append(make('span', '', label));
      const meter = make('meter'); meter.min = 0; meter.max = 100; meter.dataset.need = key;
      meter.setAttribute('aria-label', label); wrap.append(meter); needs.append(wrap);
    }
    detail.append(needs, make('small','','数值越高，越想满足这项需要。'), make('div', 'life-relationships'), make('p', 'life-memory'));
    const intro = make('div', 'life-intro');
    const choices = make('select'); choices.setAttribute('aria-label', '想介绍给谁');
    for (const other of actors.filter(a => a.id !== state.id)) {
      const option = make('option', '', other.name); option.value = other.id; choices.append(option);
    }
    const meet = make('button', '', '介绍认识');
    const feedback = make('p', 'life-feedback'); feedback.setAttribute('role', 'status');
    meet.onclick = () => {
      const result = simulation.introduce(state.id, choices.value);
      feedback.textContent = typeof result === 'string' ? result : result?.reason || result?.message || (result?.ok ? '已经传达邀请，由他们决定是否见面。' : '现在还不方便，稍后再试。');
    };
    intro.append(choices, meet); detail.append(intro);
    const form = make('form', 'life-topic');
    const input = make('input'); input.maxLength = 32; input.placeholder = '教一个话题，比如：会唱歌的椰子'; input.setAttribute('aria-label', '教给人物的新话题');
    const teach = make('button', '', '告诉TA'); teach.type = 'submit';
    form.append(input, teach); form.onsubmit = e => { e.preventDefault(); const value=input.value.trim(); if(!value)return; const result=simulation.teachTopic?.(state.id,value); feedback.textContent=result?.reason || result?.message || '记住这个话题了，之后可能会和别人聊起。'; input.value=''; };
    const gifts=make('div','life-gifts');
    for(const [id,name] of [['snack','送点心'],['book','送书'],['music','送唱片']]){
      const button=make('button','',name);button.onclick=()=>{const result=simulation.gift(state.id,id);feedback.textContent=result.reason;};gifts.append(button);
    }
    detail.append(form,gifts,make('p','life-preferences'), feedback, make('small', '', '介绍只创造相遇机会。交谈、拒绝与关系变化由双方决定。礼物目前用于偏好验证，不消耗经营预算。'));
  }
  function updateUI() {
    for (const actor of actors) {
      const state = simulation.getActor(actor.id); if (!state) continue;
      rows.get(actor.id).state.textContent = state.label || state.activity;
      rows.get(actor.id).row.setAttribute('aria-pressed', String(actor.id === selectedId));
    }
    const state = simulation.getActor(selectedId);
    if (state && !panel.hidden) {
      if (detailId !== state.id) buildDetail(state);
      const p=state.personality || {};
      detail.querySelector('.life-personality').textContent = `${p.type || p.label || p.name || (p.sociability>.65?'乐于结伴':'享受独处')} · 喜欢${(p.interests||[]).join('、')} · ${p.quirk || (p.directness>.6?'表达直接':'表达温和')}`;
      for(const meter of detail.querySelectorAll('meter')) meter.value=state.needs?.[meter.dataset.need] ?? 0;
      const relationships=state.relationships || {};
      const relationLabel=r=>!r?.familiarity?'尚未熟悉':r.affinity < -10?'有些隔阂':r.affinity>40?'很亲近':r.affinity>12?'聊得来':'正在了解';
      detail.querySelector('.life-relationships').replaceChildren(make('small','','关系是双向的，想法可能不一样'),...actors.filter(a=>a.id!==state.id).map(a=>{
        const r=relationships[a.id],back=simulation.getActor(a.id)?.relationships[state.id];
        return make('p','',`${a.name}：TA觉得${relationLabel(r)} / 对方觉得${relationLabel(back)}`);
      }));
      const giftNames={snack:'点心',book:'书',music:'唱片'};
      detail.querySelector('.life-preferences').textContent='发现的喜好：'+(Object.entries(state.preferences||{}).map(([k,v])=>`${giftNames[k]||k} ${v}`).join(' · ')||'还没有送过礼物');
      const memory=state.memories?.at(-1);
      detail.querySelector('.life-memory').textContent='最近记得：'+(typeof memory==='string'?memory:memory?.text || memory?.summary || '还在熟悉岛上的生活。');
    }
    const events=simulation.getEvents().slice(-4).reverse();
    history.replaceChildren(...events.map(e=>make('p','',e.text || e.summary || e.label || e.type)));
    const active=simulation.getActiveScene();
    const speaker=active && simulation.getActor(active.speakerId);
    caption.hidden=!speaker?.speech || root.classList.contains('photo-mode');
    if(!caption.hidden) {
      const name=actors.find(a=>a.id===active.speakerId)?.name || '';
      caption.replaceChildren(make('strong','',name),make('span','',speaker.speech));
    }
    const note=document.querySelector('#inspector .character-note');
    if(note && !document.querySelector('#inspector').hidden) note.textContent=simulation.getActor(selectedId)?.label || '正在岛上生活';
  }
  function update(dt) {
    elapsed+=dt;
    if(elapsed>=nextUI){ nextUI=elapsed+.3; updateUI(); }
    const hidden=root.classList.contains('photo-mode');
    for(const actor of actors){
      const state=simulation.getActor(actor.id), label=labels.get(actor.id);
      projected.copy(actor.mesh.position); projected.y+=2.25; projected.project(camera);
      label.hidden=hidden || !state || projected.z>1 || projected.z< -1 || Math.abs(projected.x)>.92 || Math.abs(projected.y)>.72 || camera.position.distanceTo(actor.mesh.position)>40;
      if(!label.hidden){ label.textContent=`${actor.name} · ${state.label || state.activity}`; label.style.transform=`translate(-50%,-100%) translate(${(projected.x*.5+.5)*innerWidth}px,${(-projected.y*.5+.5)*innerHeight}px)`; }
    }
    if(!auto || elapsed<cooldownUntil || isBlocked())return;
    const scene=simulation.getActiveScene();
    if(!scene){ if(lastScene){onCamera(new THREE.Vector3(0,.8,2),new THREE.Vector3(12,13,20));lastScene=null;conversationSide=null;shot='';}return; }
    if(scene.phase==='approach')return;
    const pair=scene.participants.map(id=>simulation.getActor(id)).filter(Boolean);
    if(pair.length<2)return;
    const key=`${scene.id}:${scene.phase}`;
    if(key===shot)return;
    shot=key;
    const target=new THREE.Vector3(pair.reduce((s,a)=>s+a.x,0)/pair.length,1.05,pair.reduce((s,a)=>s+a.z,0)/pair.length);
    const dx=pair[1].x-pair[0].x,dz=pair[1].z-pair[0].z,len=Math.hypot(dx,dz)||1;
    // Keep the same side of the conversation axis across speaker changes.
    if(lastScene!==scene.id || !conversationSide){conversationSide=new THREE.Vector3(-dz/len,0,dx/len);if(conversationSide.z<0)conversationSide.multiplyScalar(-1);}
    lastScene=scene.id;
    const closeup=scene.phase==='topic'||scene.phase==='response';
    const speaker=pair.find(a=>a.id===scene.speakerId);
    if(closeup&&speaker)target.lerp(new THREE.Vector3(speaker.x,1.15,speaker.z),.6);
    const distance=closeup?5.8:Math.max(7,len*1.5/Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
    const offset=conversationSide.clone().multiplyScalar(distance);offset.y=closeup?2.6:3.6;
    onCamera(target,target.clone().add(offset));
  }
  return {update,select,suspend,close:()=>setOpen(false)};
}
