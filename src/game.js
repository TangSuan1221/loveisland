import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createIsland } from './island.js';
import { createCharacters, portraitActor, disposeActor } from './characters.js';
import { createSimulation } from './npc-simulation.js';
import { createProduction, CANDIDATES } from './production-engine.js';
import { createProductionInterface } from './production-interface.js';
import { createProductionScene } from './production-scene.js';
import {createProductionEnvironment} from './production-environment.js';
import {createMediaStore} from './production-media.js';
import {createPremiere} from './production-premiere.js';
import {createGPURenderer} from './gpu-renderer.js';
import {createAvatarEditor} from './avatar-editor.js';
import './game.css';

const app=document.querySelector('#app');
app.innerHTML='<main class="island-app"><div id="scene"></div><div class="scene-cinematic"></div><div class="game-captions" hidden></div><div class="game-placement" hidden></div><div class="game-scene-tools"><button id="game-overview" title="全岛俯瞰">全岛</button><button id="game-follow" aria-pressed="true">事件镜头 · 开</button><button id="game-sound" aria-pressed="false">环境声 · 关</button></div><div id="game-loading"><strong>收视率暴君</strong><span>正在准备你的制作现场…</span></div></main>';
const root=app.firstElementChild;
let renderer;
try { renderer=await createGPURenderer({alpha:false,powerPreference:'high-performance'}); } catch(error) { const loading=document.querySelector('#game-loading');loading.querySelector('span').textContent=error.message;throw error; }
root.dataset.renderer='webgpu';
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.querySelector('#scene').append(renderer.domElement);renderer.domElement.setAttribute('aria-label','海岛制作现场，可点击空地建造或拖动镜头');renderer.domElement.tabIndex=0;
const scene=new THREE.Scene();scene.background=new THREE.Color('#a8dad6');scene.fog=new THREE.Fog('#a8dad6',65,140);
const camera=new THREE.PerspectiveCamera(37,innerWidth/innerHeight,.1,220);camera.position.set(15,18,27);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.8,1);controls.enableDamping=true;controls.minDistance=5;controls.maxDistance=100;controls.minPolarAngle=.3;controls.maxPolarAngle=1.22;
const hemi=new THREE.HemisphereLight('#e8f7e5','#a8b38b',1.6);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff1dc',2.3);sun.position.set(-25,40,22);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:.5,far:100});sun.shadow.normalBias=.045;scene.add(sun);
const island=createIsland(scene,{productionMode:true});const environment=createProductionEnvironment(scene,island);const set=createProductionScene(scene,island);const cast=createCharacters(scene,{groundY:.48});
const visualActors=cast.actors;const baseActors=visualActors.map(a=>({id:a.id,name:a.name,anchor:a.anchor}));
const portraits=new Map();
const portraitRenderer=await createGPURenderer({alpha:true});portraitRenderer.setSize(160,160);portraitRenderer.outputColorSpace=THREE.SRGBColorSpace;
function refreshPortrait(candidate){
 const a=portraitActor(candidate.id,{appearance:candidate.appearance})||portraitActor(candidate.avatarId,{appearance:candidate.appearance});if(!a)return;
 const p=new THREE.Scene(),m=a.mesh;m.position.set(0,0,0);m.rotation.set(0,0,0);p.add(m,new THREE.HemisphereLight('#fff9e8','#aabf9a',2));
 const l=new THREE.DirectionalLight('#fff1d8',2);l.position.set(-3,5,4);p.add(l);
 const bounds=new THREE.Box3().setFromObject(a._head),target=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
 const c=new THREE.PerspectiveCamera(28,1,.1,20);c.position.copy(target).add(new THREE.Vector3(0,0,Math.max(1.2,Math.max(size.x,size.y)*.62/Math.tan(14*Math.PI/180))));c.lookAt(target);
 portraitRenderer.render(p,c);portraits.set(candidate.id,portraitRenderer.domElement.toDataURL('image/png'));disposeActor(a);
}

const SAVE='ratings-tyrant-production-v1';let bundle=null,loadError='';
try{bundle=JSON.parse(localStorage.getItem(SAVE)||'null');}catch{try{localStorage.setItem(SAVE+'-recovery',localStorage.getItem(SAVE));}catch{}loadError='存档无法读取，已保留原始数据。';}
let production;try{production=createProduction({saved:bundle?.production,resetProgress:true});}catch(error){try{localStorage.setItem(SAVE+'-recovery',localStorage.getItem(SAVE));}catch{}loadError=error.message+'，原存档已保存至恢复副本。';production=createProduction();}
// Do not restore any previous session simulation, footage namespace or events.
bundle=null;
let state=production.getState(),sim=null,npcHistory={},lastEvent=0,castKey='',layoutKey='',selected=null,placement=null,ghostPoint=null;
let avatarEditor;
let ui,cameraTween=null,follow=true,manualUntil=0,worldTime=0,shot='',lastScene=null,sceneSide=null,elapsed=0,lastNow=performance.now(),frames=0,errors=[],hudAt=0,saveAt=0,healthAt=0;
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.5);
const footageCamera=new THREE.PerspectiveCamera(38,16/9,.1,150),footageRay=new THREE.Raycaster();
const thumb=document.createElement('canvas');thumb.width=640;thumb.height=360;const thumbContext=thumb.getContext('2d');
const caption=root.querySelector('.game-captions'),placeHint=root.querySelector('.game-placement');
const note=message=>ui?.notify(message);
const media=createMediaStore(()=>ui?.refresh(),()=>note('素材图片存储失败；事实和经营进度仍保留。'));let mediaRun=`${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
function save(force=false){if(!force&&(document.hidden||state.phase==='title'))return true;try{localStorage.setItem(SAVE,JSON.stringify({production:production.serialize(),npc:sim?.serialize(),lastEvent,history:npcHistory,castKey,mediaRun}));return true;}catch{note('浏览器存储空间不足，请导出人物备份后释放空间。');return false;}}
function syncActors(){
 const ids=state.cast,key=`${state.season}:${ids.join(',')}`;if(key===castKey&&sim)return;
 if(sim)for(const a of sim.getSnapshot().actors)npcHistory[a.id]=a;
 castKey=key;lastEvent=0;selected=null;cast.clearFocus();
 cast.configureCast(ids.map(id=>state.candidates.find(c=>c.id===id)));
 if(ids.length<2){sim=null;return;}
 const definitions=visualActors.slice(0,ids.length);
 sim=createSimulation({actors:definitions,seed:state.seed+state.season});
 for(const a of definitions){const target=sim.getActor(a.id),history=npcHistory[a.id];if(history){target.memories=history.memories.slice(-16);target.topics=history.topics;if(history.goal)target.goal=structuredClone(history.goal);if(history.knowledge)target.knowledge=structuredClone(history.knowledge);for(const id of ids)if(id!==a.id&&history.relationships[id])target.relationships[id]={...history.relationships[id],cooldown:0,lastInteraction:-999};}const candidate=state.candidates.find(c=>c.id===a.id);if(candidate.knownRelation&&ids.includes(candidate.knownRelation.id)){const r=target.relationships[candidate.knownRelation.id];r.familiarity=Math.max(r.familiarity,55);r.affinity=Math.min(r.affinity,8);}}
 for(const a of definitions){const live=sim.getActor(a.id);if(live)live.name=state.candidates.find(c=>c.id===a.id)?.name||live.name;}
 sim.setServiceHandler(request=>production.dispatch('consumeService',request));sim.setProductionRules?.({day:state.day,rule:state.publicRules?.water});cast.setSimulation(sim);layoutKey='';syncLayout();cast.update(0,.01);
}
function syncLayout(resume=false){const keepScene=state.phase==='recording';const key=JSON.stringify(state.facilities.map(f=>[f.id,f.type,f.x,f.z,f.enabled]));set.setCoverageRange?.(state.upgrades.includes('lenses')?14:11);set.sync(state.facilities);if(sim&&key!==layoutKey){sim.setLayout(state.facilities.filter(f=>f.enabled!==false),set.navigation,{resume,keepScene});layoutKey=key;}}
function fly(target,position,duration=1){cameraTween={from:camera.position.clone(),to:position.clone(),fromTarget:controls.target.clone(),target:target.clone(),start:performance.now(),duration};}
function focus(id){const actor=visualActors.find(a=>a.id===(typeof id==='string'?id:id?.id));if(actor?.mesh.visible){selected=actor;manualUntil=elapsed+12;const target=actor._head.getWorldPosition(new THREE.Vector3());fly(target,target.clone().add(new THREE.Vector3(-5,3,6)));}else if(id?.x!==undefined){const target=new THREE.Vector3(id.x,1,id.z);fly(target,target.clone().add(new THREE.Vector3(6,8,10)));}}
function worldVisible(object){for(let node=object;node;node=node.parent)if(!node.visible)return false;return true;}
function frameFootage(subjects){
 const target=subjects.reduce((p,a)=>p.add(a._head.getWorldPosition(new THREE.Vector3())),new THREE.Vector3()).multiplyScalar(1/subjects.length);target.y-=.2;
 const spread=Math.max(...subjects.map(a=>a.mesh.position.distanceTo(target)),1),scale=Math.max(1,spread/2),subjectNodes=new Set();subjects.forEach(a=>a.mesh.traverse(o=>subjectNodes.add(o)));
 let best=null,bestScore=-Infinity;
 for(const raw of [[-4,2.8,5],[4,2.8,5],[-4,2.8,-5],[4,2.8,-5],[0,5,6]]){const position=target.clone().add(new THREE.Vector3(...raw).multiplyScalar(scale)),direction=target.clone().sub(position),distance=direction.length();footageRay.set(position,direction.normalize());footageRay.far=distance-.4;const blocked=footageRay.intersectObjects(scene.children,true).some(hit=>!subjectNodes.has(hit.object)&&worldVisible(hit.object)&&(!hit.object.material?.transparent||hit.object.material.opacity>.45));const facing=subjects.reduce((v,a)=>{const view=position.clone().sub(a.mesh.position).setY(0).normalize();return v+view.dot(new THREE.Vector3(Math.sin(a.mesh.rotation.y),0,Math.cos(a.mesh.rotation.y)));},0);const score=facing-(blocked?100:0);if(score>bestScore){bestScore=score;best=position;}}
 footageCamera.position.copy(best);footageCamera.lookAt(target);
}
function recordEvents(){
 if(!sim)return;let captured=false;
 for(const e of sim.getEvents()){
  if(e.id<=lastEvent)continue;lastEvent=e.id;
  const event={...e,id:`${castKey}:${e.id}`,reason:e.reason||`${e.participants.map(id=>sim.getActor(id)?.name||id).join('与')}在当前设施布局下，根据需求和关系作出选择。`};
  if(production.canCaptureEvent(event))try{
   const subjects=e.participants.map(id=>visualActors.find(a=>a.id===id)).filter(Boolean);
   if(subjects.length){frameFootage(subjects);renderer.render(scene,footageCamera);captured=true;thumbContext.drawImage(renderer.domElement,0,0,640,360);event.thumbnail=media.capture(`${mediaRun}:${castKey}:${e.id}`,thumb.toDataURL('image/jpeg',.76));}
  }catch{}
  production.dispatch('observe',{event});
 }
 if(captured)renderer.render(scene,camera);
}
function effects(){const responses=[];for(const effect of production.drainEffects()){
 state=production.getState();
 if(effect.type==='cast')syncActors();
 if(effect.type==='cast-changed'&&sim){for(const a of sim.getSnapshot().actors)npcHistory[a.id]=a;const candidate=state.candidates.find(c=>c.id===effect.added);const replacement=sim.replaceActor(effect.removed,{...candidate,anchor:[0,2]});if(!replacement.ok){note(replacement.reason);throw new Error(replacement.reason);}const history=npcHistory[effect.added],added=sim.getActor(effect.added);if(history&&!sim.getSnapshot().alumni?.[effect.added]){added.memories=structuredClone(history.memories.slice(-16));added.topics=structuredClone(history.topics);if(history.goal)added.goal=structuredClone(history.goal);if(history.knowledge)added.knowledge=structuredClone(history.knowledge);for(const id of state.cast)if(id!==effect.added&&history.relationships[id])added.relationships[id]={...structuredClone(history.relationships[id]),cooldown:0,lastInteraction:-999};}cast.configureCast(state.cast.map(id=>state.candidates.find(c=>c.id===id)));cast.setSimulation(sim);castKey=`${state.season}:${state.cast.join(',')}`;selected=null;cast.clearFocus();layoutKey='';syncLayout(true);cast.update(0,.01);recordEvents();}

 if(effect.type==='map-changed'){environment.setMap(effect.id);set.setMap?.(effect.id);scene.background.set(effect.id==='snow'?'#c6d9e3':effect.id==='villa'?'#d4dfda':'#a8dad6');scene.fog.color.copy(scene.background);}
 if(effect.type==='placement')syncLayout();
 if(effect.type==='introduce'){const r=sim?.introduce(effect.a,effect.b);production.dispatch('reportIntervention',{message:r?.reason||'未能传达',accepted:!!r?.ok});responses.push(r?.reason||'指令已传达');note(r?.reason||'指令已传达');recordEvents();}
 if(effect.type==='interview'){const r=sim?.interview(effect.a);production.dispatch('reportIntervention',{message:r?.reason||'未能传达',accepted:!!r?.ok});responses.push(r?.reason);note(r?.reason);recordEvents();}
 if(effect.type==='mole-task'||effect.type==='contest-request'){const r=sim?.requestDirectorTask({...effect,kind:effect.type==='contest-request'?'contest':'mole-task'});production.dispatch('reportIntervention',{message:r?.reason||'任务未能传达',accepted:!!r?.ok});responses.push(r?.reason);note(r?.reason);recordEvents();}
 if(effect.type==='contest-reward')sim?.onContestReward(effect);
 if(effect.type==='contest-reward-unavailable')note(effect.reason);
 if(effect.type==='public-rule')sim?.setProductionRules({day:state.day,rule:effect.rule});
 if(effect.type==='public-reward')sim?.applyPublicReward(effect);
 if(effect.type==='public-reward-unavailable')note(effect.reason);
 if(effect.type==='environment-state'){const a=sim?.getActor(effect.id);if(a){a.needs.environment=effect.environment;a.needs.privacy=effect.privacy;}}
 if(effect.type==='health-status'){sim?.setAvailability(effect.id,effect.status==='available');}
 if(effect.type==='support'&&sim){const a=sim.getActor(effect.id);if(a&&effect.kind==='rest'){for(const k of ['energy','hunger','thirst','environment','privacy'])a.needs[k]=Math.max(10,(a.needs[k]||0)-35);}}
 if(effect.type==='feedback'){sim?.teachTopic(effect.a,effect.text);}
 if(effect.type==='recording-stop'){sim?.endSegment();recordEvents();save();}
 if(effect.type==='period'){recordEvents();save();}
 if(effect.type==='day-start'&&sim){sim.setProductionRules?.({day:state.day,rule:state.publicRules?.water});environment.setWeather(0);scene.background.set(state.selectedMap==='snow'?'#c6d9e3':state.selectedMap==='villa'?'#d4dfda':'#a8dad6');scene.fog.color.copy(scene.background);sun.intensity=state.selectedMap==='snow'?1.8:2.3;for(const a of sim.getSnapshot().actors){const live=sim.getActor(a.id);live.needs.energy=Math.max(15,live.needs.energy-45);live.needs.hunger=Math.max(20,live.needs.hunger-35);for(const key of ['thirst','environment','privacy'])live.needs[key]=Math.max(10,(live.needs[key]||0)-40);sim.setAvailability(a.id,state.status[a.id]==='available');}syncLayout();}
 if(effect.type==='weather'){environment.setWeather(1);scene.background.set('#879f9e');sun.intensity=1.3;}
 }return responses.filter(Boolean);
}
let musicAudio;
function auditionMusic(){const style=state.timeline?.find(t=>t.music&&t.music!=='none')?.music;if(!style)return;try{musicAudio??=new AudioContext();musicAudio.resume();const notes={warm:[261.63,329.63,392],tense:[220,233.08,329.63],sad:[220,261.63,329.63]}[style];if(!notes)return;const now=musicAudio.currentTime;notes.forEach((frequency,i)=>{const voice=musicAudio.createOscillator(),gain=musicAudio.createGain();voice.type='triangle';voice.frequency.value=frequency;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.025,now+.07+i*.04);gain.gain.exponentialRampToValueAtTime(.0001,now+1.6);voice.connect(gain).connect(musicAudio.destination);voice.start(now);voice.stop(now+1.7);});}catch{}}
const premiere=createPremiere({root,resolveMedia:ref=>media.resolve(ref),onMusic:auditionMusic});
function action(type,payload){
 if(type==='editAppearance'){avatarEditor.open(payload?.id);return {ok:true,message:''};}
 if(type==='replayEpisode')return {ok:premiere.open(state),message:''};
 if(type==='place'||type==='move'){const f=state.facilities.find(f=>f.id===payload.id);const valid=set.navigation.placement(payload.type||f?.type,payload.x,payload.z,payload.id);if(!valid.ok)return valid;}
 if(type==='finishRecording'){sim?.endSegment();recordEvents();}
 const result=production.dispatch(type,payload);state=production.getState();if(result.ok&&type==='start'){sim=null;npcHistory={};castKey='';layoutKey='';lastEvent=0;mediaRun=`${Date.now()}-${Math.random().toString(36).slice(2,7)}`;cast.setSimulation(null);cast.configureCast([]);environment.setMap('island');set.setMap?.('island');environment.setWeather(0);scene.background.set('#a8dad6');scene.fog.color.copy(scene.background);}const responses=effects();if(responses.length)result.message=responses.join('；');
 if(result.ok){if(type==='broadcast'&&state.phase==='broadcast'&&payload.mode!=='skip')premiere.open(state);if(type==='preview')auditionMusic();if(type==='confirmCast'||type==='nextDay'){fly(new THREE.Vector3(0,.8,1),new THREE.Vector3(15,18,27));}if(type==='startRecording'){fly(new THREE.Vector3(0,.8,2),new THREE.Vector3(11,12,18));}save();}
 return result;
}
function startPlacement(request){if(request.mode==='cancel'){placement=null;set.clearGhost();placeHint.hidden=true;return;}placement={...request};if(request.mode==='move')placement.type=state.facilities.find(f=>f.id===request.facilityId)?.type;selected=null;cameraTween=null;fly(new THREE.Vector3(0,0,1),new THREE.Vector3(12,23,24));placeHint.hidden=false;placeHint.textContent='移动鼠标选择落点 · 绿色可建 / 红色不可建 · 点击确认';}
for(const candidate of state.candidates)refreshPortrait(candidate);
ui=createProductionInterface({production:{getState:()=>production.getState(),getRuntime:()=>production.getRuntime(),dispatch:(...args)=>production.dispatch(...args)},root,onAction:action,onFocus:focus,onPlacement:startPlacement,portraits,resolveMedia:ref=>media.resolve(ref),getActorState:id=>sim?.getActor(id)});
let studioWasPaused=false;
function saveCharacter(type,payload){
 const before=production.serialize();
 const result=production.dispatch(type,payload);state=production.getState();
 if(!result.ok)return {...result,reason:result.message};
 if(!save(true)){production=createProduction({saved:before});state=production.getState();return {ok:false,reason:'本地存储空间不足，尚未保存。请先导出人物备份。'};}
 production.drainEffects();
 const id=result.id||payload.id,candidate=state.candidates.find(c=>c.id===id);
 try{refreshPortrait(candidate);cast.updateAppearance(id,candidate.appearance);}catch(error){note('人物已保存，显示刷新失败；重新载入即可重试。');console.error(error);}
 const actor=visualActors.find(a=>a.id===id);if(actor)actor.name=candidate.name;
 const live=sim?.getActor(id);if(live)live.name=candidate.name;
 if(npcHistory[id])npcHistory[id].name=candidate.name;
 save(true);ui.refresh();return {...result,reason:result.message};
}
avatarEditor=createAvatarEditor({getCandidates:()=>production.getState().candidates,
 onSave:(id,data)=>saveCharacter('customizeCandidate',{id,...data}),
 onCreate:data=>saveCharacter('createCandidate',data),
 onDelete:id=>{const before=production.serialize(),result=production.dispatch('deleteCandidate',{id});state=production.getState();if(!result.ok)return {...result,reason:result.message};if(!save(true)){production=createProduction({saved:before});state=production.getState();return {ok:false,reason:'存储失败，人物未删除。'};}portraits.delete(id);ui.refresh();return {...result,reason:result.message};},
 onOpen:()=>{studioWasPaused=state.paused;if(state.phase==='recording'&&!state.paused)production.dispatch('pause',{});state=production.getState();controls.enabled=false;startPlacement({mode:'cancel'});},
 onClose:()=>{controls.enabled=true;if(state.phase==='recording'&&state.paused!==studioWasPaused)production.dispatch('pause',{});state=production.getState();ui.refresh();save(true);}
});
syncActors();syncLayout();environment.setMap(state.selectedMap);set.setMap?.(state.selectedMap);save(true);if(loadError)note(loadError);
function hitGround(e){pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);raycaster.setFromCamera(pointer,camera);return raycaster.ray.intersectPlane(groundPlane,new THREE.Vector3());}
renderer.domElement.addEventListener('pointermove',e=>{if(!placement)return;const p=hitGround(e);if(!p)return;ghostPoint={x:Math.round(p.x),z:Math.round(p.z)};const valid=set.navigation.placement(placement.type,ghostPoint.x,ghostPoint.z,placement.facilityId);set.ghost(placement.type,ghostPoint,valid.ok);placeHint.textContent=valid.message;});
let down={x:0,y:0};renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',e=>{if(e.button!==0||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;if(placement){const p=hitGround(e);if(!p)return;const request=placement;const result=action(request.mode==='move'?'move':'place',{type:request.type,id:request.facilityId,x:Math.round(p.x),z:Math.round(p.z)});note(result.message);if(result.ok){startPlacement({mode:'cancel'});ui.placementDone();}return;}if(state.phase!=='recording')return;hitGround(e);const hit=raycaster.intersectObjects(visualActors.filter(a=>a.mesh.visible).map(a=>a.mesh),true)[0];if(hit){const actor=visualActors.find(a=>{let p=hit.object;while(p){if(p===a.mesh)return true;p=p.parent;}return false;});if(actor){focus(actor.id);const n=sim.getActor(actor.id);note(`${actor.name}：${n.label} · 合作 ${Math.round(state.cooperation[actor.id]||0)} · 饥饿 ${Math.round(n.needs.hunger)}`);}}});
controls.addEventListener('start',()=>{cameraTween=null;manualUntil=elapsed+12;shot='';});
root.querySelector('#game-overview').onclick=()=>{manualUntil=elapsed+20;fly(new THREE.Vector3(0,.8,0),new THREE.Vector3(35,42,54));};
root.querySelector('#game-follow').onclick=e=>{follow=!follow;selected=null;e.target.textContent=`事件镜头 · ${follow?'开':'关'}`;e.target.setAttribute('aria-pressed',String(follow));shot='';};
let audioContext,noiseGain;root.querySelector('#game-sound').onclick=async e=>{try{if(!audioContext){audioContext=new AudioContext();const buffer=audioContext.createBuffer(1,audioContext.sampleRate*4,audioContext.sampleRate),data=buffer.getChannelData(0);let value=0;for(let i=0;i<data.length;i++){value=(value+(Math.random()*2-1)*.03)/1.02;data[i]=value;}const source=audioContext.createBufferSource();source.buffer=buffer;source.loop=true;noiseGain=audioContext.createGain();noiseGain.gain.value=.1;source.connect(noiseGain).connect(audioContext.destination);source.start();}const enabled=e.target.getAttribute('aria-pressed')!=='true';if(enabled)await audioContext.resume();else await audioContext.suspend();e.target.textContent=`环境声 · ${enabled?'开':'关'}`;e.target.setAttribute('aria-pressed',String(enabled));}catch{note('当前浏览器未能开启声音。');}};
window.addEventListener('keydown',e=>{if(avatarEditor?.isOpen)return;if(e.key==='Escape'){startPlacement({mode:'cancel'});ui.placementDone();}if(e.code==='Space'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)&&state.phase==='recording'){e.preventDefault();action('pause',{});ui.refresh();}});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
// Back/forward cache restores the old JS heap instead of rerunning startup.
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{lastNow=performance.now();});
window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
let diagnostic;if(new URLSearchParams(location.search).has('qa')){Object.defineProperty(window,'__avatarDiagnostics',{value:()=>({backend:renderer.backend.isWebGPUBackend?'webgpu':'unexpected',production:production.getState(),npc:sim?.serialize(),actors:visualActors.map(a=>({id:a.id,name:a.name,appearance:a.appearance,position:a.mesh.position.toArray(),visible:a.mesh.visible})),portraits:Object.fromEntries(portraits),memory:{...renderer.info.memory},preview:avatarEditor?.getPreviewDiagnostics?.()})});diagnostic=document.createElement('output');diagnostic.className='game-diagnostic';diagnostic.setAttribute('aria-label','制作流程诊断');root.append(diagnostic);}
function updateDirector(){const event=sim?.getActiveScene();const spoken=event&&sim.getActor(event.speakerId);caption.hidden=state.phase!=='recording'||!spoken?.speech;if(!caption.hidden){caption.replaceChildren();const name=document.createElement('strong'),text=document.createElement('span');name.textContent=spoken.name;text.textContent=spoken.speech;caption.append(name,text);}
 if(!follow||placement||state.phase!=='recording'||state.paused||elapsed<manualUntil)return;
 if(!event){if(lastScene){fly(new THREE.Vector3(0,.8,2),new THREE.Vector3(11,12,18));lastScene=null;shot='';}return;}if(event.phase==='approach')return;
 const key=`${event.id}:${event.phase}`;if(key===shot)return;shot=key;const[a,b]=event.participants.map(id=>sim.getActor(id)),target=new THREE.Vector3((a.x+b.x)/2,1.65,(a.z+b.z)/2);
 if(lastScene!==event.id){sceneSide=new THREE.Vector3(-(b.z-a.z),0,b.x-a.x).normalize();if(sceneSide.z<0)sceneSide.negate();}lastScene=event.id;
 const close=event.phase==='topic'||event.phase==='response';if(close&&spoken)target.lerp(visualActors.find(a=>a.id===spoken.id)?._head.getWorldPosition(new THREE.Vector3())||new THREE.Vector3(spoken.x,1.7,spoken.z),.45);const offset=sceneSide.clone().multiplyScalar(close?6.5:8.5);offset.y=close?3:4.5;fly(target,target.clone().add(offset));
}
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-lastNow)/1000,.25);lastNow=now;frames++;elapsed+=dt;
 if(!document.hidden&&!avatarEditor?.isOpen){worldTime+=dt;if(environment.map==='island')island.update(worldTime,dt);environment.update(dt);if(state.phase==='recording'&&!state.paused&&!state.segmentReady&&sim){sim.update(dt*state.speed);cast.update(worldTime,dt*state.speed);recordEvents();if(elapsed>healthAt){production.dispatch('syncActors',{actors:sim.getSnapshot().actors,elapsed:state.speed});healthAt=elapsed+1;}}production.update(dt);effects();}
 if(elapsed>hudAt){Object.assign(state,production.getRuntime());hudAt=elapsed+.2;set.setBuild(state.phase==='build'||!!placement);visualActors.forEach((a,i)=>{a.mesh.visible=state.cast.length>i&&!['title','casting'].includes(state.phase)&&!['left','medical'].includes(state.status?.[a.id]);});}
 updateDirector();if(cameraTween){const t=Math.min(1,(now-cameraTween.start)/(cameraTween.duration*1000)),ease=1-(1-t)**3;camera.position.lerpVectors(cameraTween.from,cameraTween.to,ease);controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.target,ease);if(t===1)cameraTween=null;}controls.update();ui.update(dt);renderer.render(scene,camera);
 if(elapsed>saveAt){saveAt=elapsed+8;state=production.getState();save();if(diagnostic)diagnostic.textContent=JSON.stringify({backend:renderer.backend.isWebGPUBackend?'webgpu':'unexpected',phase:state.phase,season:state.season,day:state.day,segment:state.segment,elapsed:state.segmentElapsed,cash:state.cash,facts:state.facts.length,clips:state.clips.length,ledger:state.ledger.length,episodes:state.episodes.length,errors:errors.slice(-8),npc:sim?.getSnapshot().stats,frames},null,2);}
}
renderer.onDeviceLost=()=>{save(true);const alert=document.createElement('div');alert.id='game-loading';const text=document.createElement('span');text.textContent='图形设备连接中断，请重新加载游戏。重新加载会清除本局进度，已保存的人物创作会保留。';const reload=document.createElement('button');reload.textContent='重新加载';reload.onclick=()=>location.reload();alert.append(text,reload);root.append(alert);};
requestAnimationFrame(frame);root.querySelector('#game-loading').remove();
