import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createIsland } from './island.js';
import { createCharacters } from './characters.js';
import { createSimulation } from './npc-simulation.js';
import { createNPCInterface } from './npc-interface.js';
import './style.css';
import './npc-interface.css';

const icons = {
 island:'<path d="M3 16c4-4 14-4 18 0M3 19c2 2 4-2 6 0s4-2 6 0 4-2 6 0M12 13V5m0 1c-4-5-8-1-7 1 3-1 5-1 7-1Zm0 0c4-5 8-1 7 1-3-1-5-1-7-1Z"/>',
 people:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"/>',
 home:'<path d="m3 10 9-7 9 7M5 9v12h14V9m-10 12v-7h6v7"/>',
 camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
 moon:'<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 sound:'<path d="M3 9h4l5-4v14l-5-4H3Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 mute:'<path d="M3 9h4l5-4v14l-5-4H3Zm13 0 6 6m-6 0 6-6"/>',
 play:'<path d="m8 5 11 7-11 7Z"/>',
 pause:'<path d="M8 5v14M16 5v14"/>',
 arrow:'<path d="m9 5 7 7-7 7"/>',
 reset:'<path d="M3 5v6h6M3 11a9 9 0 1 1 2 7"/>',
 leaf:'<path d="M4 19C-1 8 10 4 20 3c1 12-5 19-13 15m-3 3L16 9"/>',
 heart:'<path d="M12 21 3 12a5 5 0 0 1 9-6 5 5 0 0 1 9 6Z"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
 zoom:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6m-11-14v6m-3-3h6"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 wind:'<path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h5"/>',
};
const icon = (id) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[id]||icons.leaf}</svg>`;
const app = document.querySelector('#app');
app.innerHTML = `
<main class="island-app">
 <div id="scene" aria-label="可旋转缩放的三维海岛场景"></div>
 <div class="vignette"></div>
 <header class="topbar">
  <div class="identity"><span class="identity-icon">${icon('island')}</span><div><h1>收视率暴君<span>荒岛恋综制作人</span></h1><div class="eyebrow">RATINGS TYRANT <span class="separator">/</span> ISLAND STUDIO</div></div></div>
  <div class="top-actions"><button id="light-toggle" class="weather-pill" aria-label="切换场景光照">${icon('sun')}<span id="time-label">晴日 · 10:30</span><span class="weather-divider"></span><span>海风轻轻</span></button><button id="sound" class="circle-button" aria-label="开启环境声音" aria-pressed="false">${icon('mute')}</button><button id="about" class="circle-button" aria-label="关于视觉版本">${icon('info')}</button></div>
 </header>
 <section class="island-title"><span class="tiny-label">SEASON 01 · TROPICAL ISLAND</span><h2>风吹过，<br>故事正在发生。</h2><p>把镜头留给岛上的每个小瞬间。</p><div class="island-name">${icon('leaf')} 初见岛 <span>视觉探索</span></div></section>
 <div class="world-labels" id="world-labels"></div>
 <div class="view-switch" aria-label="镜头范围"><button id="living-view" class="selected" aria-pressed="true">${icon('people')} 生活区</button><button id="island-view" aria-pressed="false">${icon('island')} 全岛俯瞰</button></div>
 <div class="scene-hint" id="scene-hint"><span class="live-dot"></span> 嘉宾们正在自主安排生活 <span class="hint-separator">·</span> 点击人物，靠近一点</div>
 <aside class="inspector" id="inspector" aria-live="polite" hidden></aside>
 <section class="collection-panel" id="collection-panel" hidden></section>
 <div class="bottom-left"><div class="day-card"><span class="day-number">01</span><div><span class="tiny-label">初见海岛</span><strong>一个晴朗的上午</strong><span>NPC生活模拟 · 经营系统未接入</span></div></div><div class="navigation-hint"><kbd>拖动</kbd> 环顾 <span>·</span> <kbd>滚轮</kbd> 靠近 <span>·</span> <kbd>右键</kbd> 平移</div></div>
 <nav class="dock" aria-label="场景工具">
  <button data-tab="island" class="dock-button active" aria-pressed="true">${icon('island')}<span>观察岛屿</span><small>01</small></button>
  <button data-tab="cast" class="dock-button" aria-pressed="false">${icon('people')}<span>嘉宾手册</span><small>02</small></button>
  <button data-tab="places" class="dock-button" aria-pressed="false">${icon('home')}<span>场景图鉴</span><small>03</small></button>
  <span class="dock-divider"></span>
  <button data-tab="photo" class="dock-button" aria-pressed="false">${icon('camera')}<span>镜头模式</span><small>04</small></button>
 </nav>
 <div class="bottom-right"><button id="reset-camera" class="circle-button" aria-label="重置镜头">${icon('reset')}</button><button id="pause" class="circle-button" aria-label="暂停场景动画" aria-pressed="false">${icon('pause')}</button><span class="edition">ISLAND STUDY / 001</span></div>
 <div class="photo-controls" hidden><span>镜头模式</span><button id="save-photo">${icon('camera')} 保存这一刻</button><button id="exit-photo">${icon('close')} 返回岛屿</button></div>
 <div id="toast" role="status"></div>
 <div class="loading" id="loading"><span class="loading-mark">${icon('island')}</span><h2>海风就要来了</h2><p>正在布置初见岛…</p><div class="loading-line"></div></div>
 <dialog id="about-dialog" aria-labelledby="about-title"><button class="dialog-close circle-button" aria-label="关闭">${icon('close')}</button><span class="tiny-label">A LITTLE ISLAND, MANY STORIES</span><h2 id="about-title">欢迎来到初见岛</h2><p>这是《收视率暴君》的NPC生活模拟版本。人物会根据需要与性格安排活动，邀请或拒绝彼此，并记住相处经历。点击“岛上生活”查看关系、介绍朋友或教一个新话题。</p><p>本版本根据公开资料独立实现社交机制，尚非原作系统的完整复刻。选角、经营、剪辑和播出仍未接入。进度保存在当前浏览器，离线不推进。</p><div class="about-features"><span>${icon('island')} 原创海岛场景</span><span>${icon('people')} 六位原创嘉宾</span><span>${icon('camera')} 自由镜头</span></div><button class="primary-button" id="about-done">回到海风里 ${icon('arrow')}</button></dialog>
</main>`;

const container = document.querySelector('#scene');
let renderer;
try { renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'}); }
catch(err) { document.querySelector('#loading').innerHTML='<h2>暂时无法打开三维场景</h2><p>请使用支持 WebGL 的浏览器，并启用硬件加速。</p>'; throw err; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
container.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label','初见岛三维视图：拖动旋转，滚轮缩放，点击人物查看。');
renderer.domElement.setAttribute('tabindex','0');

const scene = new THREE.Scene();
scene.background=new THREE.Color('#a8dad6');
scene.fog=new THREE.Fog('#a8dad6',65,140);
const aspect=innerWidth/innerHeight;
const camera=new THREE.PerspectiveCamera(37,aspect,0.1,220);
camera.position.set(12,13,20);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,0.8,2);
controls.enableDamping=true; controls.dampingFactor=0.07;
controls.minDistance=5; controls.maxDistance=105;
controls.minPolarAngle=0.30; controls.maxPolarAngle=1.24;
controls.maxTargetRadius=28; controls.panSpeed=.7;
controls.update();

const hemi=new THREE.HemisphereLight('#e4f9ff','#b5b28c',1.6);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0dc',2.3);sun.position.set(-25,40,22);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:.5,far:100});sun.shadow.normalBias=.045;sun.shadow.bias=-.00012;sun.shadow.radius=3;scene.add(sun);
const fill=new THREE.DirectionalLight('#d2f6f3',.6);fill.position.set(15,8,-14);scene.add(fill);

const island=createIsland(scene);
const cast=createCharacters(scene,{groundY:.48});
const actors=cast.actors;
const SAVE_KEY='ratings-tyrant-npc-v1';
let savedLife=null;
try { savedLife=JSON.parse(localStorage.getItem(SAVE_KEY)||'null'); } catch { /* Invalid browser storage starts a fresh simulation. */ }
let simulation;
try { simulation=createSimulation({actors,seed:20261112,saved:savedLife}); }
catch { simulation=createSimulation({actors,seed:20261112}); }
cast.setSimulation(simulation);
function saveLife(){if(document.hidden)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(simulation.serialize()));}catch{/* Storage restrictions must not stop island life. */}}
setInterval(saveLife,10000);
window.addEventListener('pagehide',saveLife);
const landmarks=island.landmarks||[];
const portraits=new Map();
const portraitRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true});portraitRenderer.setSize(160,160);portraitRenderer.setPixelRatio(1);portraitRenderer.outputColorSpace=THREE.SRGBColorSpace;portraitRenderer.toneMapping=THREE.ACESFilmicToneMapping;portraitRenderer.toneMappingExposure=1.0;
for(const actor of actors){const portraitScene=new THREE.Scene();const avatar=actor.mesh.clone(true);avatar.position.set(0,0,0);avatar.rotation.set(0,0,0);portraitScene.add(avatar);portraitScene.add(new THREE.HemisphereLight('#fff7e7','#a4bda0',2));const key=new THREE.DirectionalLight('#fff1d8',2);key.position.set(-3,5,4);portraitScene.add(key);const portraitCamera=new THREE.PerspectiveCamera(28,1,.1,20);portraitCamera.position.set(0,1.34,2.25);portraitCamera.lookAt(0,1.16,0);portraitRenderer.render(portraitScene,portraitCamera);portraits.set(actor.id,portraitRenderer.domElement.toDataURL('image/png'));}
portraitRenderer.dispose();
const portraitMarkup=(a)=>`<img src="${portraits.get(a.id)}" alt="${a.name}的头像"/>`;
const selectionRing=new THREE.Mesh(new THREE.RingGeometry(.65,.72,64),new THREE.MeshBasicMaterial({color:'#fff5c8',transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false}));selectionRing.rotation.x=-Math.PI/2;selectionRing.position.y=.505;selectionRing.visible=false;scene.add(selectionRing);
const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();
const actorRoots=new Map();for(const a of actors){a.mesh.traverse(o=>{if(o.isMesh)actorRoots.set(o,a);});}
const palettes=[{id:'day',label:'晴日 · 10:30',sky:'#a8dad6',sun:'#fff0dc',sunI:2.3,hemi:1.6,exposure:1.0},{id:'golden',label:'黄昏 · 17:40',sky:'#d4b6aa',sun:'#ffbd80',sunI:2.0,hemi:1.4,exposure:1.0},{id:'blue',label:'蓝调 · 19:20',sky:'#668baf',sun:'#adceff',sunI:1.0,hemi:1.0,exposure:.95}];
let lightIndex=0,paused=false,photoMode=false,selected=null,tab='island',soundEnabled=false;
let worldTime=0,lastTime=performance.now(),frames=0,renderedFrames=0,frameSum=0,maxFrameMs=0,activeSeconds=0;
const runtimeErrors=[];let runtimeErrorCount=0;const noteError=message=>{runtimeErrorCount++;if(runtimeErrors.length===50)runtimeErrors.shift();runtimeErrors.push(message);};window.addEventListener('error',e=>noteError(e.message));window.addEventListener('unhandledrejection',e=>noteError(String(e.reason)));
const startedAt=new Date().toISOString();
let cameraTween=null,toastTimer=null;
const $=s=>document.querySelector(s);
const lifeUI=createNPCInterface({simulation,actors,camera,controls,root:$('.island-app'),onSelect:showActor,onCamera:(target,position)=>{cameraTween={from:camera.position.clone(),to:position,fromTarget:controls.target.clone(),toTarget:target,start:performance.now()};},isBlocked:()=>photoMode||paused||!!selected||!$('#collection-panel').hidden||$('#about-dialog').open});
controls.addEventListener('start',()=>{cameraTween=null;lifeUI.suspend();});
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
function setTab(next){tab=next;document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===next;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
function flyTo(target,distance=13){const offset=camera.position.clone().sub(controls.target).normalize().multiplyScalar(distance);cameraTween={from:camera.position.clone(),to:target.clone().add(offset),fromTarget:controls.target.clone(),toTarget:target.clone(),start:performance.now()};}
function resetCamera(){selected=null;cast.clearFocus?.();selectionRing.visible=false;$('.island-app').classList.remove('inspecting','overview');$('#inspector').hidden=true;$('#collection-panel').hidden=true;setTab('island');$('#living-view').classList.add('selected');$('#living-view').setAttribute('aria-pressed','true');$('#island-view').classList.remove('selected');$('#island-view').setAttribute('aria-pressed','false');cameraTween={from:camera.position.clone(),to:new THREE.Vector3(12,13,20),fromTarget:controls.target.clone(),toTarget:new THREE.Vector3(0,.8,2),start:performance.now()};}
function nameOf(a,i){return a.name||['林夏','顾言','苏棠','陆川','许知','程野'][i%6];}
function showActor(actor){
 lifeUI.select(actor.id);lifeUI.suspend();
 selected=actor;cast.focusActor?.(actor.id,camera.position);$('.island-app').classList.add('inspecting');$('#collection-panel').hidden=true;setTab('cast');
 const i=actors.indexOf(actor);const name=nameOf(actor,i);
 $('#inspector').innerHTML=`<button class="inspector-close circle-button" aria-label="关闭人物卡">${icon('close')}</button><span class="tiny-label">ISLAND GUEST · ${String(i+1).padStart(2,'0')}</span><div class="portrait-badge" style="--guest-color:${actor.color||'#eead89'}">${portraitMarkup(actor)}</div><h2>${name}</h2><div class="role-tag">${actor.role||'初见岛嘉宾'}</div><p>${actor.description||'把生活放慢一点，和岛上的人一起，等一阵新的海风。'}</p><div class="character-note">${icon('wind')} 正在享受岛上的慢时光</div><button class="primary-button" id="follow-actor">靠近看看 ${icon('zoom')}</button><small class="visual-note">打开左侧“岛上生活”，查看需要、关系与记忆</small>`;
 $('#inspector').hidden=false;$('.inspector-close').focus({preventScroll:true});$('.inspector-close').onclick=()=>{cameraTween=null;selected=null;cast.clearFocus?.();$('.island-app').classList.remove('inspecting');selectionRing.visible=false;$('#inspector').hidden=true;setTab('island');document.querySelector('[data-tab="cast"]').focus({preventScroll:true});};
 $('#follow-actor').onclick=()=>{const point=actor.mesh.position.clone().add(new THREE.Vector3(.45,.8,.25));cameraTween={from:camera.position.clone(),to:point.clone().add(new THREE.Vector3(-4,2.3,4.2)),fromTarget:controls.target.clone(),toTarget:point,start:performance.now()};};
 flyTo(actor.mesh.position.clone().add(new THREE.Vector3(.6,.7,0)),9);
}
function showCollection(type){
 selected=null;cast.clearFocus?.();$('.island-app').classList.remove('inspecting');selectionRing.visible=false;$('#inspector').hidden=true;const panel=$('#collection-panel');
 if(tab===type&&!panel.hidden){panel.hidden=true;setTab('island');return;}
 setTab(type);panel.hidden=false;
 const isCast=type==='cast';const items=isCast?actors:landmarks;
 panel.innerHTML=`<div class="collection-heading"><div><span class="tiny-label">${isCast?'PEOPLE OF THE ISLAND':'LITTLE PLACES, LITTLE STORIES'}</span><h2>${isCast?'认识岛上的他们':'藏在岛上的小风景'}</h2></div><button class="circle-button close-collection" aria-label="关闭图鉴">${icon('close')}</button></div><div class="collection-grid">${items.map((a,i)=>`<button class="collection-item" data-index="${i}"><span class="item-icon" style="--guest-color:${a.color||['#93baa5','#deb27a','#d79980','#97bec7'][i%4]}">${isCast?portraitMarkup(a):icon('home')}</span><span><strong>${isCast?nameOf(a,i):a.name}</strong><small>${isCast?(a.role||'岛屿嘉宾'):(a.description||'点击靠近这处风景')}</small></span>${icon('arrow')}</button>`).join('')}</div>`;
 $('.close-collection').focus({preventScroll:true});$('.close-collection').onclick=()=>{panel.hidden=true;setTab('island');document.querySelector(`[data-tab="${type}"]`).focus({preventScroll:true});};
 panel.querySelectorAll('.collection-item').forEach(b=>b.onclick=()=>{const item=items[Number(b.dataset.index)];if(isCast)showActor(item);else{panel.hidden=true;flyTo(item.position,12);toast(item.name+' · '+(item.description||'一处属于岛上的小风景'));}});
}
function setPhoto(enabled){cameraTween=null;photoMode=enabled;$('.island-app').classList.toggle('photo-mode',enabled);$('.island-app').classList.remove('inspecting');$('.photo-controls').hidden=!enabled;$('#inspector').hidden=true;$('#collection-panel').hidden=true;selected=null;cast.clearFocus?.();selectionRing.visible=false;setTab(enabled?'photo':'island');if(enabled){$('#exit-photo').focus({preventScroll:true});toast('拖动镜头构图，按 Esc 返回');}else document.querySelector('[data-tab="photo"]').focus({preventScroll:true});}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{const next=b.dataset.tab;if(next==='island')resetCamera();else if(next==='photo')setPhoto(true);else showCollection(next);});
$('#exit-photo').onclick=()=>setPhoto(false);
$('#save-photo').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download=`初见岛-${palettes[lightIndex].id}-${Date.now()}.png`;a.href=renderer.domElement.toDataURL('image/png');a.click();toast('这一刻，已经留住了');};
$('#reset-camera').onclick=resetCamera;
$('#living-view').onclick=resetCamera;
$('#island-view').onclick=()=>{resetCamera();$('.island-app').classList.add('overview');$('#island-view').classList.add('selected');$('#island-view').setAttribute('aria-pressed','true');$('#living-view').classList.remove('selected');$('#living-view').setAttribute('aria-pressed','false');cameraTween.to.set(40,48,61);cameraTween.toTarget.set(0,.8,0);toast('全岛俯瞰 · 滚轮拉近，发现更多小风景');};
$('#pause').onclick=()=>{paused=!paused;cast.setPaused?.(paused);$('#pause').innerHTML=icon(paused?'play':'pause');$('#pause').setAttribute('aria-label',paused?'继续场景动画':'暂停场景动画');$('#pause').setAttribute('aria-pressed',String(paused));toast(paused?'时间停在这一刻':'海风又吹起来了');};
$('#light-toggle').onclick=()=>{lightIndex=(lightIndex+1)%palettes.length;const p=palettes[lightIndex];scene.background.set(p.sky);scene.fog.color.set(p.sky);sun.color.set(p.sun);sun.intensity=p.sunI;hemi.intensity=p.hemi;renderer.toneMappingExposure=p.exposure;$('#time-label').textContent=p.label;$('#light-toggle').querySelector('svg').outerHTML=icon(lightIndex===2?'moon':'sun');$('.island-app').dataset.light=p.id;toast('场景光照：'+p.label+' · 仅改变视觉');};
$('#about').onclick=()=>$('#about-dialog').showModal();$('#about-done').onclick=()=>$('#about-dialog').close();$('.dialog-close').onclick=()=>$('#about-dialog').close();
$('#about-dialog').addEventListener('click',e=>{if(e.target===$('#about-dialog'))$('#about-dialog').close();});
let audioContext,noiseSource,noiseGain;
$('#sound').onclick=async()=>{soundEnabled=!soundEnabled;if(soundEnabled){try{if(!audioContext){audioContext=new AudioContext();const buffer=audioContext.createBuffer(1,audioContext.sampleRate*4,audioContext.sampleRate);const data=buffer.getChannelData(0);let v=0;for(let i=0;i<data.length;i++){v=(v+(Math.random()*2-1)*.04)/1.02;data[i]=v;}noiseSource=audioContext.createBufferSource();noiseSource.buffer=buffer;noiseSource.loop=true;const filter=audioContext.createBiquadFilter();filter.type='lowpass';filter.frequency.value=620;noiseGain=audioContext.createGain();noiseGain.gain.value=.12;noiseSource.connect(filter).connect(noiseGain).connect(audioContext.destination);noiseSource.start();}await audioContext.resume();}catch{soundEnabled=false;toast('当前浏览器无法开启声音');}}else await audioContext?.suspend();$('#sound').innerHTML=icon(soundEnabled?'sound':'mute');$('#sound').setAttribute('aria-label',soundEnabled?'关闭环境声音':'开启环境声音');$('#sound').setAttribute('aria-pressed',String(soundEnabled));};
let down={x:0,y:0};renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};cameraTween=null;});
renderer.domElement.addEventListener('pointerup',e=>{if(e.button!==0||photoMode||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(actors.map(a=>a.mesh),true).find(h=>actorRoots.has(h.object));if(hit)showActor(actorRoots.get(hit.object));});
window.addEventListener('keydown',e=>{if($('#about-dialog').open)return;if(e.key==='Escape'){lifeUI.close();if(photoMode)setPhoto(false);else{cameraTween=null;$('#collection-panel').hidden=true;$('#inspector').hidden=true;selected=null;cast.clearFocus?.();$('.island-app').classList.remove('inspecting');selectionRing.visible=false;setTab('island');renderer.domElement.focus({preventScroll:true});}}if(e.target===renderer.domElement&&e.key==='Home')resetCamera();});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

// Read-only rendering and NPC simulation diagnostics.
const npcDiagnostics=()=>{const s=simulation.getSnapshot();return {time:s.time,stats:s.stats,scene:s.scene,actors:s.actors.map(a=>({id:a.id,activity:a.activity,x:a.x,z:a.z,topics:a.topics,needs:a.needs})),events:s.events.slice(-3)};};
const qaSnapshot=()=>({startedAt,elapsedSeconds:Math.round((performance.now()-boot)/1000),activeSeconds:Math.round(activeSeconds),frames:renderedFrames,meanFrameMs:+(frameSum/Math.max(frames,1)).toFixed(2),maxFrameMs:Math.round(maxFrameMs),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,actors:actors.length,landmarks:landmarks.length,paused,light:palettes[lightIndex].id,photoMode,selected:selected?.id||null,runtimeErrors,runtimeErrorCount,scope:'npc-life-simulation',npc:npcDiagnostics()});
window.__ISLAND_QA__={getSnapshot:qaSnapshot};
const boot=performance.now();
if(new URLSearchParams(location.search).has('qa')){const p=document.createElement('output');p.className='qa-panel';p.id='qa-panel';p.setAttribute('aria-label','视觉运行诊断');$('.island-app').classList.add('qa-mode');$('.island-app').appendChild(p);setInterval(()=>{p.textContent=JSON.stringify(qaSnapshot(),null,2);},1000);}
const labels=$('#world-labels');
const markerData=landmarks.slice(0,4).map((place,i)=>{const b=document.createElement('button');b.className='world-marker';b.innerHTML=`<span class="marker-dot"></span><span>${place.name}</span>`;b.setAttribute('aria-label','查看'+place.name);b.onclick=()=>{flyTo(place.position,12);toast(place.name);};labels.appendChild(b);return{place,el:b};});
let frameRequest;
function animate(now){
 frameRequest=requestAnimationFrame(animate);const rawDt=(now-lastTime)/1000;const dt=Math.min(rawDt,.05);lastTime=now;
 if(!document.hidden){frames++;frameSum+=rawDt*1000;maxFrameMs=Math.max(maxFrameMs,rawDt*1000);activeSeconds+=Math.min(rawDt,.25);}
 if(!paused&&!document.hidden){worldTime+=dt;simulation.update(dt);island.update?.(worldTime,dt);cast.update?.(worldTime,dt);}
 lifeUI.update(dt);
 if(cameraTween){const t=Math.min((now-cameraTween.start)/1000,1);const ease=1-Math.pow(1-t,3);camera.position.lerpVectors(cameraTween.from,cameraTween.to,ease);controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.toTarget,ease);if(t===1)cameraTween=null;}
 controls.update();
 if(selected){cast.focusActor?.(selected.id,camera.position);selectionRing.visible=true;selectionRing.position.x=selected.mesh.position.x;selectionRing.position.z=selected.mesh.position.z;selectionRing.material.opacity=.65+Math.sin(worldTime*3)*.17;}
 for(const m of markerData){const v=m.place.position.clone();v.y+=2.2;v.project(camera);const hidden=photoMode||camera.position.distanceTo(controls.target)<17||v.z>1||v.x<-1||v.x>1||v.y<-1||v.y>1;m.el.hidden=hidden;m.el.style.transform=`translate(-50%,-50%) translate(${(v.x*.5+.5)*innerWidth}px,${(-v.y*.5+.5)*innerHeight}px)`;}
 renderer.render(scene,camera);renderedFrames++;
}
requestAnimationFrame(animate);
setTimeout(()=>{$('#loading').classList.add('loaded');setTimeout(()=>$('#loading').remove(),800);},500);
document.addEventListener('visibilitychange',()=>{lastTime=performance.now();});
