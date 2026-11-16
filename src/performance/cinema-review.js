import {catalogScenes} from './catalog-scenes.js';
import {catalogLocations} from './catalog-locations.js';
import {dramaticScenes} from '../dramatic-scenes.js';
import {extraTitles} from './cases/social-extra.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGPURenderer } from '../gpu-renderer.js';
import { createAvatarEditor } from '../avatar-editor.js';
import { createProduction } from '../production-engine.js';
import { createIslandStage } from '../artStudy/stageIsland.js';
import { createProductionScene } from '../production-scene.js';
import { createCharacters } from '../characters.js';
import { createIsland } from '../island.js';
import { createCinemaStage } from './cinema-stage.js';
import { stageNames } from './stage/stage-presentation.js';
import { createPerformance } from './director.js';
import { parseCsv } from './runtime.js';
import dialogue from './data/skit-line.csv?raw';
import definitions from './data/skit-def.csv?raw';
import '../game.css';
import './performance.css';
import './cinema-review.css';

const outcomes = {
  enjoyed:'周屿接住了林夏的节拍，两个人一起跳完了这段舞。',
  'concern-raised':'林夏指出亲历的问题，请周屿一起看看。','sharing-unavailable':'林夏没接到水，两个人只能空手离开。',
  'item-borrowed':'周屿把东西递给林夏。','borrow-declined':'周屿把东西留在自己手里。','item-returned':'林夏将借来的东西还给周屿。',
  comforted:'周屿放松下来，林夏又陪他坐了一会儿。','belief-corrected':'他们终于说清楚了当时看见的事。',
  'belief-unresolved':'两人重新讲了一遍经过，仍有各自的理解。','promise-discussed':'林夏和周屿谈起没有如期兑现的约定。',
  'milestone-celebrated':'周屿和林夏一起庆祝刚刚完成的目标。','mediation-offered':'周屿愿意考虑林夏提出的调停建议。',
  'contest-completed':'两人完成了节拍挑战，等待核对成绩。','mole-question-answered':'周屿接过话头，给出了自己的回答。',
  'mole-question-refused':'周屿示意到此为止，林夏收回了问题。','last-water-given':'林夏把最后一份水交给了周屿。',
  'last-water-split':'两个人分了剩下的水。','last-water-kept':'林夏收回手，把水留给了自己。',
  'mutual-feeling':'林夏和周屿确认了彼此的好感。',
  'feelings-declined':'林夏表达了好感，周屿没有接受。',
  reconciled:'两个人再次开口，终于和好了。',
  unresolved:'谈话停了下来，他们暂时没有和好。',
  disagreed:'两个人对这件事产生了分歧。',
  connected:'聊完这一次，他们更熟悉了一点。',
  allied:'林夏与周屿同意结伴完成接下来的任务。',
  'alliance-declined':'他们没有就结伴达成一致。',
  'boundary-respected':'两个人就个人边界达成了理解。',
  'boundary-disagreed':'两个人对彼此的边界仍有分歧。',
  clarified:'他们说清了一件彼此亲历的旧事。',
  'created-together':'两个人完成了共同创作的小目标。',
  'queue-apology':'周屿道了歉，回到了原来的位置。',
  'queue-yield':'林夏让开一步，让周屿先取水。',
  'queue-argue':'两人仍有分歧，取水顺序保持原样。',
  'queue-avoid':'林夏暂时离开了取水队伍。',
  'water-shared':'林夏把自己的水分给了周屿。',
  supported:'林夏留意到了周屿的状态，留下来陪他。'
};

// Rehearsal marks on the island: centre X/Z and the axis of the two performers.
// In a live recording the existing actors and facility supply these positions.
const marks={
  'mutual-feeling':[4.2,15.3,-.3], 'feelings-declined':[6,12.7,.72],
  reconciled:[1.3,4.9,.35], unresolved:[9,-5.4,-.7], disagreed:[4.1,2.4,-.35],
  connected:[2.8,11.9,.18], allied:[3,3.3,.7], 'alliance-declined':[-.8,2.1,-.55],
  'boundary-respected':[-7.9,-5.3,.12], 'boundary-disagreed':[8.2,-5.6,-.18],
  clarified:[-2,-8.4,-.6], 'created-together':[6.8,3.6,.08],
  'queue-apology':[-6.6,1.5,.04], 'queue-yield':[-5.6,.8,-.67],
  'queue-argue':[-7,1.3,.14], 'queue-avoid':[-3.1,1.8,-.6],
  'water-shared':[-6.4,1.2,.24], supported:[1.7,8.7,-.42],
};
Object.assign(marks,{
  enjoyed:[1.6,4.5,.1],'concern-raised':[4.5,3,.6],'sharing-unavailable':[-5.2,1.7,.75],
  'item-borrowed':[7,4.1,-.34],'borrow-declined':[5.3,4.2,.62],'item-returned':[-6.4,-5.2,.25],
  comforted:[4.25,15.4,-.3],'belief-corrected':[-3.5,-6.4,.71],'belief-unresolved':[-1,-7.1,-.6],
  'promise-discussed':[2.4,4,.21],'milestone-celebrated':[2.1,8.1,-.4],'mediation-offered':[-1.2,1.5,.7],
  'contest-completed':[.4,1.3,-.25],'mole-question-answered':[5.3,5.1,.16],
  'mole-question-refused':[8.8,-5.1,.4],'last-water-given':[-4.8,1.3,.32],
  'last-water-split':[-5.35,1.5,.44],'last-water-kept':[-4.2,.6,-.35]
});
const sites={
  S_new_home:[-8,-8,3.1,2.2,.12],S_homeless:[8,-8,3.1,2.2,-.14],
  S_upgrade:[-8,-8,3.1,2.2,.12],S_first_cross:[-10,4,3,1.7,0],
  S_wall_dispute:[-.1,-11.9,2,.6,0],S_island_grew:[5,15.4,2.8,2.8,0],
};
export async function openCinemaReview() {
  document.title = '实景分镜回放 · 荒岛心跳';
  const root = document.createElement('main');
  root.className = 'island-app cinema-review';
  root.dataset.productionPhase = 'recording';
  root.innerHTML = '<div id="scene"></div><div class="game-scene-tools"></div><nav class="cinema-review-tools" aria-label="事件回放"><select data-cinema-event aria-label="选择事件"></select><button type="button" data-cinema-replay>重播</button><button type="button" data-cinema-pause>暂停</button><button type="button" data-cinema-titles aria-pressed="false">隐藏字幕</button><a href="./">返回游戏</a></nav><p id="game-loading" role="status">正在准备实景分镜…</p>';
  if (location.protocol === 'file:') {
    root.querySelector('.cinema-review-tools a').remove();
  }
  document.querySelector('#app').replaceChildren(root);
  const loading = root.querySelector('#game-loading');
  let renderer;
  try {
    renderer = await createGPURenderer({alpha:false,powerPreference:'high-performance'});
  } catch(error) {
    loading.textContent = error.message;
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.querySelector('#scene').append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a8dad6');
  scene.fog = new THREE.Fog('#a8dad6',65,140);
  const camera = new THREE.PerspectiveCamera(37,innerWidth/innerHeight,.1,220);
  camera.position.set(1.4,2.1,8);
  const controls = new OrbitControls(camera,renderer.domElement);
  controls.target.set(0,1.45,2.5);
  controls.update();
  scene.add(new THREE.HemisphereLight('#e8f7e5','#a8b38b',1.6));
  const sun = new THREE.DirectionalLight('#fff1dc',2.3);
  sun.position.set(-25,40,22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:.5,far:100});
  sun.shadow.normalBias = .045;
  scene.add(sun);
  const gameKey = 'ratings-tyrant-production-v1';
  const faceKey = 'cinema-review-cast-v1';
  function readStored(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
  const defaults = createProduction({spatial:true,starterCamp:true}).getState();
  const island = createIsland(scene,{productionMode:true});
  const set = createProductionScene(scene,island);
  const campScene = createIslandStage(island,camera,controls);
  function syncIsland(saved) {
    const facilities = saved?.facilities ?? defaults.facilities;
    campScene.sync(saved?.camp ?? defaults.camp,true,facilities);
    set.sync(facilities);
  }
  const savedGame = readStored(gameKey)?.production;
  syncIsland(savedGame);
  window.addEventListener('storage',event=>{
    if(event.key===gameKey || event.key===null) syncIsland(readStored(gameKey)?.production);
  });
  const edits = readStored(faceKey) || {};
  const candidates = ['lin','zhou','qiao'].map(id=>{
    const base = savedGame?.candidates?.find(c=>c.id===id) || defaults.candidates.find(c=>c.id===id);
    return {...base,...edits[id],id};
  });
  const cast = createCharacters(scene,{groundY:.48});
  cast.configureCast(candidates);
  const actors = cast.actors;
  scene.updateMatrixWorld(true);
  const stage = createCinemaStage({camera,controls,actors,root,scene});
  const backdrop = document.createElement('select');
  backdrop.setAttribute('aria-label','演出背景');
  backdrop.add(new Option('背景 · 游戏小岛','island'));
  stage.setBackdrop('island');
  backdrop.add(new Option('背景 · 随剧情','auto'));
  for (const [key,name] of Object.entries(stageNames)) backdrop.add(new Option(name,key));
  root.querySelector('[data-cinema-event]').after(backdrop);
  const fitting = document.createElement('button');
  fitting.textContent = '定妆预览';
  fitting.onclick = () => {
    const url = new URL(location.href);
    url.hash = '';
    url.searchParams.set('cinema-review',select.value);
    url.searchParams.set('perf',root.dataset.performanceStage || 'hanami');
    url.searchParams.delete('still');
    url.searchParams.set('at',String(Math.round(shotTime)));
    location.assign(url);
  };
  backdrop.after(fitting);
  backdrop.onchange = () => {
    stage.setBackdrop(backdrop.value);
    if (!director.holding) play();
  };
  const director = createPerformance(root,stage);
  const state = {phase:'recording',season:1,day:1,candidates:actors.map(({id,name})=>({id,name}))};
  const select = root.querySelector('[data-cinema-event]');
  const events=new Map();
  function category(label){const group=document.createElement('optgroup');group.label=label;select.append(group);return group;}
  const catalogGroup=category('S01–S80 场景动作');
  const socialGroup=category('人物关系与日常'),extraGroup=category('物品、约定与节目任务'),campGroup=category('营地建设');
  const lines=new Map(parseCsv(dialogue).map(row=>[row.line_id,row.text]));
  for(const row of parseCsv(definitions)){
    const camp=row.skit_id.startsWith('CAMP_');
    if(!camp && !row.skit_id.startsWith('IS_'))continue;
    const key=camp?row.skit_id:row.scene_id;
    const text=camp?lines.get(row.skit_id+'_F'):outcomes[key];
    const option=new Option(camp?row.title_zh+' · '+text:row.title_zh,key);
    (camp?campGroup:socialGroup).append(option);
    const site=sites[row.scene_id];
    events.set(key,{type:camp?'camp-story':key,sceneId:row.scene_id,result:row.branch_id,text,
      ...(camp&&{x:site[0],z:site[1],stageAnchor:{x:site[0],z:site[1],width:site[2],depth:site[3],yaw:site[4]}})});
  }
  for(const [type,title] of Object.entries(extraTitles)){
    extraGroup.append(new Option(title,type));
    events.set(type,{type,text:outcomes[type],sceneId:type});
  }
  for(const [id,entry] of catalogScenes){
    catalogGroup.append(new Option(entry.label+' · '+id,id));
    events.set(id,{type:'catalog-scene',sceneId:id,performanceKey:id,text:entry.label});
  }
  const titles=root.querySelector('[data-cinema-titles]');
  titles.onclick=()=>{
    const hidden=root.classList.toggle('cinema-review-unlabelled');
    titles.setAttribute('aria-pressed',String(hidden));
    titles.textContent=hidden?'显示字幕':'隐藏字幕';
  };
  const pause = root.querySelector('[data-cinema-pause]');
  let paused = false;
  let shotTime = 0;
  let lastTime = performance.now();

  let resumeAfterEdit = false;
  const editor = createAvatarEditor({
    getCandidates:()=>candidates,
    onOpen(){ resumeAfterEdit = !paused; paused = true; },
    onSave(id,data){
      localStorage.setItem(faceKey,JSON.stringify({...readStored(faceKey),[id]:data}));
      Object.assign(candidates.find(c=>c.id===id),data);
      director.stop();
      cast.updateAppearance(id,data.appearance);
      actors.find(a=>a.id===id).name=data.name;
      state.candidates.find(c=>c.id===id).name=data.name;
      play(shotTime);
      return {ok:true};
    },
    onClose(){ paused = !resumeAfterEdit; lastTime = performance.now(); }
  });
  const editButton = document.createElement('button');
  editButton.textContent = '演员捏脸';
  editButton.onclick = ()=>editor.open(actors[0].id);
  fitting.after(editButton);
  function showState() {
    root.dataset.playback = director.holding ? (paused ? 'paused' : 'playing') : 'ended';
    root.dataset.shot = director.shot?.kind || '';
    root.dataset.effect = director.shot?.fx || '';
    root.dataset.frameMs = String(Math.round(shotTime));
    pause.disabled = !director.holding;
    pause.textContent = paused ? '继续' : '暂停';
  }
  function play(at = null) {
    const type = select.value;
    director.stop();
    const event=events.get(type);
    const entry=catalogScenes.get(type);
    const count=entry?.tracks.length??2;
    const [x,z,angle=0]=entry?catalogLocations[type]:(marks[type]||[event.x,event.z+2,0]);
    actors.forEach((actor,index)=>{
      actor.mesh.visible=index<count;
      if(entry){
        const mark=dramaticScenes[type]?.marks[index];
        actor.mesh.position.set(x+(mark?.[0]??(index-(count-1)/2)*1.4),island.bounds.groundY,z+(mark?.[1]??(index===1&&count===3?-.55:0)));
        actor.mesh.rotation.y=count===1?0:index===0?.72:index===count-1?-.72:0;
        return;
      }
      const distance=(index?1:-1)*.86;
      actor.mesh.position.set(x+Math.cos(angle)*distance,.48,z+Math.sin(angle)*distance);
      actor.mesh.rotation.y=(index?-1:1)*Math.PI/2-angle;
    });
    controls.target.set(x,1.45,z);
    camera.position.set(x+1.3,2.2,z+5.8);
    controls.update();
    director.preview({...event,id:type,participants:actors.slice(0,count).map(a=>a.id),sourcePart:'result'},state);
    paused = Number.isFinite(at);
    shotTime = paused ? Math.max(0,at) : 0;
    lastTime = performance.now();
    director.update(shotTime/director.rate,state);
    showState();
  }
  root.querySelector('[data-cinema-replay]').onclick = ()=>play();
  select.onchange = ()=>{
    const next = new URL(location.href);
    next.hash='';
    next.searchParams.set('cinema-review',select.value);
    next.searchParams.delete('at');
    if (location.protocol !== 'file:') history.replaceState(null,'',next);
    play();
  };
  pause.onclick = ()=>{
    paused = !paused;
    lastTime = performance.now();
    showState();
  };
  window.addEventListener('resize',()=>{
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth,innerHeight);
  });
  document.addEventListener('visibilitychange',()=>{ lastTime = performance.now(); });
  function playFromAddress() {
    const query=new URLSearchParams(location.search);
    const requested=location.hash.slice(1)||query.get('cinema-review');
    select.value=events.has(requested)?requested:'S47_steal_stock';
    play(query.has('at') ? Number(query.get('at')) : null);
  }
  window.addEventListener('popstate',playFromAddress);
  playFromAddress();
  loading.remove();
  let islandTime = 0;
  renderer.setAnimationLoop(now=>{
    const delta = Math.min(.1,Math.max(0,(now-lastTime)/1000));
    lastTime = now;
    if (!document.hidden && !paused) {
      if(director.holding) shotTime += delta*1000*director.rate;
      director.update(delta*1000,state);
      islandTime += delta;
      island.update(islandTime,delta);
      campScene.update(delta);
      set.updateFire(islandTime);
    }
    if(!director.holding) controls.update();
    stage.render(renderer);
    showState();
  });
}
