import {previewProps,propAt} from './catalog-props.js';
import {dramaticScenes} from './dramatic-scenes.js';
import assets from './motions/base-assets.json' with {type:'json'};
import {baseReview} from './base-motion.js';
import revisions from './action-review-revisions.json' with {type:'json'};
import {equipProp,propNames} from './action-props.js';
import * as THREE from 'three';
import {createGPURenderer} from './gpu-renderer.js';
import {portraitActor,disposeActor} from './characters.js';
import {performances} from './action-catalog.js';
import {performTrack} from './action-playback.js';
import requirements from '../docs/角色动作需求清单.md?raw';
import './action-review.css';

const checks=new Map();
for(const line of requirements.split(/\r?\n/)){
  if(!line.startsWith('|'))continue;
  const cells=line.split('|').slice(1,-1).map(cell=>cell.trim());
  const id=cells[0]?.split(' ')[0];
  if(!performances.has(id))continue;
  checks.set(id,/^A\d/.test(id)?cells.slice(3).join('。'):cells.length===5?cells.slice(3).join('。'):cells.slice(1).join('。'));
}
for(const [id,r] of Object.entries(revisions))checks.set(id,r.description+'　验收：'+r.acceptance);
const directBases=new Map();
for(const [id,roles] of Object.entries(assets.roles)){
  const ids=roles.flat();
  if(ids.length===1&&performances.get(id)?.tracks.length===1)directBases.set(id,ids[0]);
}
const reused=new Set(directBases.values());
const extraBases=new Map([...baseReview.catalog].filter(([id])=>!reused.has(id)));
for(const [id,s] of Object.entries(dramaticScenes))checks.set(id,s.description+'　验收：'+s.acceptance);
const directors=new Set(['group','interview','mole','contest','feedback','weather']);
function category(id){return /^A\d/.test(id)?'生活动作':/^S\d/.test(id)?'参考场景':directors.has(id)?'导演指令':'人物互动';}
const labels={pending:'待验收',passed:'通过',fix:'需修改'};
const prefix='island.actionReview.v1.';
export async function openRehearsal(onStage,onExit,study){
  if(document.querySelector('.action-rehearsal'))return;
  const catalog=study===baseReview?extraBases:study?.catalog||performances,storagePrefix=study===baseReview?'island.baseReview.v2.':study?'island.styleStudy.v1.':prefix;
  const dialog=document.createElement('dialog');
  dialog.className='action-rehearsal review-desk';
  dialog.setAttribute('aria-label','动作验收台');
  dialog.innerHTML=`<header><strong>动作验收台 · ${study===baseReview?'组合演出的基础片段 · 3D':study?'新版文本 · 3D 试演':'完整动作 · 3D'}</strong><span data-count></span><button data-close>返回游戏</button></header>
  <div class="review-layout"><aside><input type="search" data-query aria-label="搜索动作" placeholder="搜索动作名称或编号">
  <div class="review-filters"><select data-category aria-label="动作类别"><option value="">全部类别</option></select><select data-filter aria-label="验收状态"><option value="">全部状态</option></select></div>
  <select data-list size="15" aria-label="动作清单"></select></aside>
  <section><h2 data-heading></h2><p data-check></p>
  <div class="rehearsal-stage"></div>
  <div class="review-controls"><button data-play>暂停</button><button data-back>−1 帧</button><button data-forward>+1 帧</button><button data-reset>重播</button><label><input type="checkbox" data-bones>显示骨架</label><select data-speed aria-label="播放速度"><option>.25×</option><option>.5×</option><option selected>1×</option></select><select data-view aria-label="观察角度"><option>正面</option><option>侧面</option><option>背面</option><option>俯视</option><option>面部特写</option></select><select data-role aria-label="观察角色"></select></div>
  <div class="review-controls" data-equipment></div><div class="review-timeline"><input data-time type="range" min="0" max="180" step="1" value="0" aria-label="动作时间轴"><span data-clock></span></div>
  <label>问题备注<textarea data-note rows="2" placeholder="记录穿模、接触位置或需要修改的节拍"></textarea></label>
  <footer><button data-prev>上一项</button><button data-next>下一项</button><select data-verdict aria-label="当前动作验收结论"></select><span data-save role="status"></span></footer></section></div>`;
  document.body.append(dialog);dialog.showModal();
  let switching=false;
  if(!study||study===baseReview){
    const switcher=document.createElement('button');switcher.textContent=study?'查看完整动作':'查看其余基础片段';
    dialog.querySelector('header').insertBefore(switcher,dialog.querySelector('[data-close]'));
    switcher.onclick=()=>{switching=true;dialog.addEventListener('close',()=>openRehearsal(onStage,onExit,study?undefined:baseReview),{once:true});dialog.close();};
  }
  const el=key=>dialog.querySelector('[data-'+key+']');
  const list=el('list'),stage=dialog.querySelector('.rehearsal-stage');
  for(const name of ['生活动作','人物互动','导演指令','参考场景'])el('category').add(new Option(name,name));
  for(const [key,name] of Object.entries(labels)){el('filter').add(new Option(name,key));el('verdict').add(new Option(name,key));}
  const records=new Map();
  let storageError=false;
  for(const id of catalog.keys()){
    try{const legacy=!study&&directBases.has(id)?localStorage.getItem('island.baseReview.v2.'+directBases.get(id)):null;const record=JSON.parse(localStorage.getItem(storagePrefix+id)??legacy);if(record&&Object.hasOwn(labels,record.status))records.set(id,record);}
    catch{storageError=true;}
  }
  const recordFor=id=>records.get(id)||{status:'pending',note:''};
  let actors=[],entry,renderer,frame=0,closed=false,seconds=0,playing=true,previous=0;
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#dae5de');
  scene.add(new THREE.HemisphereLight(0xffffff,0xb7a58e,2.4));
  const light=new THREE.DirectionalLight(0xffedda,2.5);light.position.set(3,5,4);scene.add(light);
  const grid=new THREE.GridHelper(10,20,0x95a99c,0xbdcdc2);
  grid.position.y=-.012;scene.add(grid);
  const camera=new THREE.PerspectiveCamera(32,1,.1,60);
  const roleEquipment=new Map();
  let selectedProps=[];
  let helpers=[];
  function clearHelpers(){
    for(const h of helpers){scene.remove(h);h.dispose();}
    helpers=[];
  }
  function select(id){
    if(entry?.id===id)return;
    clearHelpers();actors.forEach(disposeActor);actors=[];entry=catalog.get(id);seconds=0;
    el('equipment').replaceChildren();
    el('role').replaceChildren(new Option('全部角色','all'));
    if(!entry){el('heading').textContent='没有匹配的动作';el('check').textContent='';}
    else{
      const count=entry.tracks.length;
      selectedProps=roleEquipment.get(id)??entry.tracks.map((_,i)=>previewProps[id]?.[i]?.[0]??'');
      roleEquipment.set(id,selectedProps);
      entry.tracks.forEach((_,i)=>{
        const a=portraitActor(['lin','zhou','qiao'][i]);
        const mark=dramaticScenes[id]?.marks[i];
        a.mesh.position.set(mark?.[0]??(i-(count-1)/2)*1.4,0,mark?.[1]??(i===1&&count===3?-.55:0));
        a.mesh.rotation.y=count===1?0:i===0?.72:i===count-1?-.72:0;
        actors.push(a);scene.add(a.mesh);
        const label=document.createElement('label'),picker=document.createElement('select');
        label.append('角色 '+String.fromCharCode(65+i)+' 道具 ',picker);picker.add(new Option('空手',''));
        for(const [kind,name] of Object.entries(propNames))picker.add(new Option(name,kind));
        picker.value=selectedProps[i];
        equipProp(a,picker.value);
        picker.onchange=()=>{selectedProps[i]=picker.value;equipProp(a,picker.value);};
        el('equipment').append(label);
        const h=new THREE.SkeletonHelper(a._rig.joints.Hips);
        h.material.depthTest=false;h.renderOrder=99;h.visible=false;scene.add(h);helpers.push(h);
        el('role').add(new Option('单看角色 '+String.fromCharCode(65+i),String(i)));
      });
      el('heading').textContent=entry.label+' · '+id+(!study&&directBases.has(id)?' / '+directBases.get(id):'');
      el('check').textContent=study?entry.description+'　验收：'+entry.acceptance:checks.get(id)||'';
    }
    el('note').value=entry?recordFor(id).note:'';
    el('verdict').value=entry?recordFor(id).status:'pending';
    el('note').disabled=el('verdict').disabled=!entry;
    el('time').value=0;
  }
  function refresh(){
    const search=el('query').value.trim().toLowerCase(),old=entry?.id;
    list.replaceChildren();let passed=0,fix=0;
    for(const item of catalog.values()){
      const status=recordFor(item.id).status;
      if(status==='passed')passed++;if(status==='fix')fix++;
      if(el('category').value&&category(item.id)!==el('category').value)continue;
      if(el('filter').value&&status!==el('filter').value)continue;
      const bp=!study&&directBases.get(item.id);if(!(item.id+' '+item.label+' '+(bp?bp+' '+assets.poses[bp].name:'')).toLowerCase().includes(search))continue;
      list.add(new Option(({pending:'○',passed:'✓',fix:'△'})[status]+'  '+item.label+' · '+item.id,item.id));
    }
    if(old&&Array.from(list.options).some(o=>o.value===old))list.value=old;
    else list.selectedIndex=list.length?0:-1;
    select(list.value);
    el('count').textContent='待验收 '+(catalog.size-passed-fix)+'　通过 '+passed+'　需修改 '+fix;
    el('prev').disabled=list.selectedIndex<=0;el('next').disabled=list.selectedIndex+1>=list.length;
  }
  function save(){
    if(!entry)return;
    const record={status:el('verdict').value,note:el('note').value};
    records.set(entry.id,record);
    try{localStorage.setItem(storagePrefix+entry.id,JSON.stringify(record));el('save').textContent='已保存';}
    catch{el('save').textContent='浏览器存储不可用，本次更改仅在当前窗口保留';}
  }
  el('query').oninput=refresh;el('category').onchange=el('filter').onchange=refresh;
  list.onchange=()=>{select(list.value);refresh();};
  function advance(n){list.selectedIndex+=n;list.onchange();}
  el('prev').onclick=()=>advance(-1);el('next').onclick=()=>advance(1);
  el('note').oninput=save;el('verdict').onchange=()=>{save();refresh();};
  function playback(value){playing=value;el('play').textContent=value?'暂停':'播放';}
  function seek(t){playback(false);seconds=Math.max(0,Math.min(6,t));}
  el('time').oninput=()=>seek(Number(el('time').value)/30);
  el('back').onclick=()=>seek((Math.round(seconds*30)-1)/30);
  el('forward').onclick=()=>seek((Math.round(seconds*30)+1)/30);
  el('play').onclick=()=>playback(!playing);el('reset').onclick=()=>{seconds=0;playback(true);};
  el('close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{closed=true;cancelAnimationFrame(frame);clearHelpers();actors.forEach(disposeActor);grid.geometry.dispose();grid.material.dispose();renderer?.dispose();dialog.remove();if(!switching)onExit?.();},{once:true});
  if(onStage&&!study){const b=document.createElement('button');b.textContent='安排岛上嘉宾出演';b.onclick=()=>{if(!entry)return;const r=onStage(entry.id,Array.from(el('equipment').querySelectorAll('select'),picker=>picker.value));if(r.ok)dialog.close();else el('save').textContent=r.message;};dialog.querySelector('footer').append(b);}
  let hissContext;
  {
    const sound=document.createElement('button');
    sound.textContent='开启嘶声';el('reset').after(sound);
    sound.onclick=async()=>{
      hissContext??=new AudioContext();
      if(hissContext.state==='running'&&sound.dataset.on){await hissContext.suspend();delete sound.dataset.on;sound.textContent='开启嘶声';}
      else{await hissContext.resume();sound.dataset.on='1';sound.textContent='关闭嘶声';}
    };
    dialog.addEventListener('close',()=>hissContext?.close(),{once:true});
  }
  refresh();if(storageError)el('save').textContent='部分验收记录无法读取';
  try{
    const gpu=await createGPURenderer();if(closed){gpu.dispose();return;}renderer=gpu;
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));stage.append(renderer.domElement);
    let width=0,height=0;
    function draw(now){
      const before=seconds;
      if(playing&&previous&&entry)seconds=(seconds+Math.min(.1,(now-previous)/1000)*parseFloat(el('speed').value))%6;
      if(hissContext?.state==='running'&&['A27','BP040'].includes(entry?.id)&&before<.68&&seconds>=.68){
        const ctx=hissContext,buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.43),ctx.sampleRate),samples=buffer.getChannelData(0);
        for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*.16*Math.sin(Math.PI*i/samples.length);
        const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();source.buffer=buffer;filter.type='highpass';filter.frequency.value=3600;
        source.connect(filter).connect(ctx.destination);source.onended=()=>{source.disconnect();filter.disconnect();};source.start();
      }
      previous=now;
      const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
      if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
      const role=el('role').value,solo=role==='all'?null:actors[Number(role)];
      const target=solo?.mesh.position;
      const dist=Math.max(4.9,(solo?1:actors.length)*2.65/camera.aspect);
      const angle=[0,Math.PI/2,Math.PI,0,0][el('view').selectedIndex]+(solo?.mesh.rotation.y||0);
      const top=el('view').selectedIndex===3,radial=dist*(top?.58:1);
      camera.position.set((target?.x||0)+Math.sin(angle)*radial,top?dist*.92+1:1.6,(target?.z||0)+Math.cos(angle)*radial);
      camera.lookAt(target?.x||0,1,target?.z||0);
      actors.forEach((a,i)=>{a.mesh.visible=!solo||solo===a;equipProp(a,propAt(entry.id,i,selectedProps[i],seconds));if(study)study.sample(a,entry.id,seconds);else performTrack(a,entry.tracks[i],seconds,6,(actors.length===2 || (entry.id==='S81_slap_mediation' && i<2))?actors[1-i]:undefined);});
      if(el('view').value==='面部特写'&&actors.length){
        const face=(solo||actors[0])._head;
        const aim=face.localToWorld(new THREE.Vector3(0,-.02,0));
        const eye=face.localToWorld(new THREE.Vector3(.045,.015,1.05));
        camera.position.copy(eye);camera.lookAt(aim);
      }
      el('time').value=Math.round(seconds*30);el('clock').textContent=seconds.toFixed(2)+' / 6.00 秒';
      helpers.forEach((h,i)=>{h.visible=el('bones').checked && actors[i].mesh.visible;});
      renderer.render(scene,camera);frame=requestAnimationFrame(draw);
    }
    frame=requestAnimationFrame(draw);
  }catch(error){stage.textContent=error.message;}
}

