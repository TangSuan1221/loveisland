import {createResourceSites} from './resourceSites.js';
import * as THREE from 'three';
import {cloneActorView} from '../clone-actor-view.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {makeGrid,newCamp} from '../camp/model.js';
import {W,H,inBounds} from '../camp/grid.js';
import {facilityRect} from '../camp/footprints.js';
import {buildLiveGround} from './liveGround.js';
import {createLiveGrid,CELL_SIZE,worldToCell,cellToWorld,placementBounds} from './liveGrid.js';
import {updateCampfire} from './campfire.js';
import {createLiveBuilding} from './liveBuildings.js';
import {buildFlora} from './flora.js';
import {addHorizon} from './horizon.js';
import {addGrazers} from './fauna.js';
import './liveIsland.css';

const terrainNames={deep:'深海',shallow:'浅水',sand:'沙地',grass:'草地',forest:'森林',rock:'岩地',soil:'耕土',cliff:'峭壁'};
const cameraOffset=new THREE.Vector3(24,31,34).multiplyScalar(3);
const floor=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const frontRotation=rot=>-rot*Math.PI/2;

function releaseScene(root) {
  const meshes=new Set(),materials=new Set(),textures=new Set();
  root.traverse(o=>{
    if(o.geometry)meshes.add(o.geometry);
    for(const m of o.material?[o.material].flat():[]) {
      materials.add(m);
      for(const v of Object.values(m))if(v?.isTexture)textures.add(v);
    }
  });
  textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());meshes.forEach(g=>g.dispose());
}

function surveyLines() {
  const p=[];
  const first=cellToWorld(0,0),x0=first.x-CELL_SIZE/2,z0=first.z-CELL_SIZE/2;
  for(let x=0;x<=W;x++)p.push(x0+x*CELL_SIZE,.009,z0,x0+x*CELL_SIZE,.009,z0+H*CELL_SIZE);
  for(let y=0;y<=H;y++)p.push(x0,.009,z0+y*CELL_SIZE,x0+W*CELL_SIZE,.009,z0+y*CELL_SIZE);
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  return new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x365450,transparent:true,opacity:.29,depthWrite:false}));
}
function footprint() {
  const group=new THREE.Group();
  const shape=new THREE.PlaneGeometry(1,1);shape.rotateX(-Math.PI/2);
  group.add(new THREE.Mesh(shape,new THREE.MeshBasicMaterial({color:0xa4edc1,opacity:.34,transparent:true,depthWrite:false,depthTest:false})));
  const corners=[[-.5,.004,-.5],[.5,.004,-.5],[.5,.004,.5],[-.5,.004,.5]].map(v=>new THREE.Vector3(...v));
  group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(corners),new THREE.LineBasicMaterial({color:0xf4ecc3,depthTest:false})));
  group.children.forEach((o,i)=>o.renderOrder=8+i);
  group.visible=false;return group;
}
function paintFootprint(mark,b,valid=true) {
  mark.visible=Boolean(b);
  if(!b)return;
  mark.position.set(b.x,.035,b.z);mark.scale.set(b.width,1,b.depth);
  mark.children[0].material.color.set(valid?'#70d3aa':'#e35861');
  mark.children[1].material.color.set(valid?'#f5efd0':'#ff5360');
}
function facilityBounds(facility) {
  const rect=facilityRect(facility);if(!rect)return null;
  const p=cellToWorld(rect.x,rect.y);
  return {x:p.x+(rect.w-1)*CELL_SIZE/2,z:p.z+(rect.h-1)*CELL_SIZE/2,
    width:rect.w*CELL_SIZE,depth:rect.h*CELL_SIZE};
}

export function mountLiveIsland(container,options) {
  const {getState,getActorState,getVisualActors,dispatch,onBuild,onClose,onGroundPointer,onInspectActor,getPlacementPreview}=options;
  const store=createLiveGrid({getState,dispatch});
  let world=store.snapshot(),state=getState(),disposed=false,busy=false;
  const surface=document.createElement('section');surface.className='live-island-view';
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const canvas=renderer.domElement;
  canvas.dataset.liveIslandCanvas='';canvas.tabIndex=0;
  canvas.setAttribute('aria-label','荒岛地图，拖动旋转、滚轮缩放，点选地块或建筑');
  surface.append(canvas);container.append(surface);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#69aed0');
  const sky=addHorizon(scene);
  const ground=buildLiveGround(THREE,scene,world.grid);
  const decor=new THREE.Group();scene.add(decor);
  const gathering=createResourceSites(scene);
  let foliage,habitatVersion;const fauna=addGrazers(decor);
  scene.add(new THREE.HemisphereLight(0xfff0d7,0x9e94ad,1.65));
  const light=new THREE.DirectionalLight(0xffedd5,2.05);
  light.position.set(-18,38,20);light.castShadow=true;
  Object.assign(light.shadow.camera,{left:-32,right:32,top:32,bottom:-32,far:120});
  light.shadow.mapSize.set(2048,2048);light.shadow.bias=-.00025;light.shadow.normalBias=.025;scene.add(light);
  const camera=new THREE.OrthographicCamera(-28,28,16,-16,.1,410);
  const controls=new OrbitControls(camera,canvas);
  controls.enableDamping=true;controls.dampingFactor=.12;
  controls.maxPolarAngle=Math.PI*.472;controls.minPolarAngle=.16;controls.minZoom=.66;controls.maxZoom=7;
  controls.screenSpacePanning=false;controls.rotateSpeed=.68;
  function overview() {
    controls.target.set(0,1,0);camera.position.copy(controls.target).add(cameraOffset);
    camera.zoom=1;camera.updateProjectionMatrix();controls.update();
  }
  overview();
  function resize(){
    const {width:w,height:h}=surface.getBoundingClientRect();
    if(w<1||h<1)return;
    const ratio=w/h,span=Math.max(56,ratio*32);
    Object.assign(camera,{left:-span/2,right:span/2,top:span/ratio/2,bottom:-span/ratio/2});
    camera.updateProjectionMatrix();renderer.setSize(w,h,false);
  }
  const ro=new ResizeObserver(resize);ro.observe(surface);resize();

  const tools=document.createElement('div');tools.dataset.liveIslandTools='';surface.append(tools);
  tools.innerHTML=`<div class="li-nav"><button type="button" data-live-tool="close">返回</button>
    <button type="button" data-live-tool="overview">全岛</button><button type="button" data-live-tool="camp">营地</button><select data-live-site aria-label="定位资源点"><option value="">资源点</option></select><button type="button" data-live-tool="zoom-in" aria-label="放大">＋</button>
    <button type="button" data-live-tool="zoom-out" aria-label="缩小">−</button><button type="button" data-live-tool="build">勘选地块</button></div>
    <aside class="li-build" hidden><div class="li-heading"><strong>营地建造</strong><button type="button" data-live-tool="dismiss" aria-label="关闭建造面板">×</button></div>
    <small data-live-budget></small><label>建筑<select data-live-kind></select></label><p data-live-info></p>
    <div class="li-actions"><button data-live-tool="buy">购入库存</button><button data-live-tool="place">放置</button>
    <button data-live-tool="rotate">转向 R</button></div><section data-live-selection hidden><p data-live-selected></p>
    <div class="li-actions"><button data-live-tool="move">移位</button><button data-live-tool="turn">原地旋转</button><button data-live-tool="store">回收</button></div></section>
    <button data-live-tool="advanced">完整营地建造</button></aside>
    <div class="li-caption"><span data-live-cell></span><span data-live-receipt role="status" aria-live="polite"></span></div>`;
  const q=selector=>tools.querySelector(selector);
  const button=name=>q('[data-live-tool="'+name+'"]');
  let catalog=world.grid.kinds;
  const kinds=q('[data-live-kind]');for(const d of world.catalog)kinds.add(new Option(d.name,d.id));
  const siteSelect=q('[data-live-site]');
  function populateSites(){siteSelect.replaceChildren(new Option('资源点',''));for(const art of gathering.root.children)if(art.visible)siteSelect.add(new Option(art.userData.siteName,art.name));}
  const gridLines=surveyLines();gridLines.visible=false;scene.add(gridLines);
  const mark=footprint(),facilityMark=footprint(),chosenMark=footprint();scene.add(mark,facilityMark,chosenMark);
  const models=new THREE.Group(),preview=new THREE.Group();scene.add(models,preview);
  const templates=new Map(),instances=new Map();
  const ghostPaint=new THREE.MeshBasicMaterial({color:0xa5e5c0,opacity:.52,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  const ghostInk=new THREE.LineBasicMaterial({color:0x345e4c,opacity:.66,transparent:true,depthWrite:false});
  let editing=false,mode='select',selectedId=null,hover=null,rot=0,ghostKey='',lastVersion='',lastHover='';
  let selectedDetail='',lastGroundRevision=null;
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),pos=new THREE.Vector3();
  ray.params.Line.threshold=.025;
  const actorRoot=new THREE.Group(),actorViews=new Map();scene.add(actorRoot);
  const embedded=()=>container.dataset.view==='embedded';
  const ready=()=>state.selectedMap==='island'&&state.speed<16&&(state.buildWindow||state.phase==='build'||state.phase==='recording');
  function model(kind,w,h) {
    const key=kind+'|'+w+'|'+h;
    if(!templates.has(key))templates.set(key,createLiveBuilding(THREE,kind,w,h));
    return templates.get(key).clone(true);
  }
  function previewModel(kind,w,h,b,rotation,valid) {
    const key=kind+'|'+w+'|'+h;
    if(key!==ghostKey) {
      preview.clear();const item=model(kind,w,h);
      item.traverse(o=>{if(o.isMesh)o.material=ghostPaint;else if(o.isLine)o.material=ghostInk;o.castShadow=false;o.receiveShadow=false;});
      preview.add(item);ghostKey=key;
    }
    preview.visible=true;preview.position.set(b.x,.055,b.z);preview.rotation.y=frontRotation(rotation);
    ghostPaint.color.set(valid?'#96e4bc':'#e97877');ghostInk.color.set(valid?'#31564b':'#8a363e');
  }
  function updateModels(){
    const seen=new Set();
    function put(id,kind,w,h,b,rotation,tag) {
      seen.add(id);const key=kind+'|'+w+'|'+h;
      let item=instances.get(id);
      if(item?.userData.templateKey!==key) {
        item?.removeFromParent();item=model(kind,w,h);instances.set(id,item);models.add(item);
        Object.assign(item.userData,{templateKey:key,...tag});
      }
      item.position.set(b.x,0,b.z);item.rotation.y=frontRotation(rotation||0);
    }
    for(const st of world.camp.placed) {
      const d=catalog.get(st.kind);if(!d)continue;
      put('b'+st.id,d.id,d.w*CELL_SIZE,d.h*CELL_SIZE,placementBounds(d,st.x,st.y,st.rot),st.rot,{buildingId:st.id});
    }
    for(const f of world.facilities) {
      const b=facilityBounds(f);if(!b)continue;
      const rotation=f.rot||0,swap=rotation%2;
      put('f'+f.id,f.type,swap?b.depth:b.width,swap?b.width:b.depth,b,rotation,{facilityId:f.id});
    }
    for(const [id,obj] of instances)if(!seen.has(id)){obj.removeFromParent();instances.delete(id);}
  }
  function controlsUI(){
    const enabled=ready(),st=world.camp.placed.find(s=>s.id===selectedId);
    if(!enabled){editing=false;mode='select';}
    button('build').hidden=!enabled;button('build').setAttribute('aria-pressed',String(editing));
    button('close').hidden=!onClose;
    q('.li-build').hidden=!editing;gridLines.visible=editing;
    button('advanced').hidden=!onBuild;
    const def=catalog.get(kinds.value);if(!def)return;
    const qty=world.camp.inventory[def.id]||0;
    q('[data-live-budget]').textContent='第 '+world.day+' 天 · 木料 '+world.camp.wood+' · 石料 '+(world.camp.stone||0);
    q('[data-live-info]').textContent=def.w+' × '+def.h+' 格 · '+def.wood+' 木料 · 库存 '+qty+(def.unlock_day>world.day?' · 第 '+def.unlock_day+' 天解锁':'');
    button('buy').disabled=busy||world.day<def.unlock_day||world.camp.wood<def.wood||qty+world.camp.placed.filter(b=>b.kind===def.id).length>=def.max_count;
    button('place').disabled=busy||!qty;button('place').setAttribute('aria-pressed',String(mode==='place'));
    const target=mode==='move'&&st?catalog.get(st.kind):def;
    button('rotate').disabled=mode==='select'||!target.rotatable;
    q('[data-live-selection]').hidden=!st;
    if(st){const d=catalog.get(st.kind);q('[data-live-selected]').textContent=d.name+' #'+st.id+' · '+(st.damaged?'受损':'完好');button('turn').disabled=!d.rotatable||busy;}
    paintFootprint(chosenMark,st&&editing&&mode==='select'?placementBounds(catalog.get(st.kind),st.x,st.y,st.rot):null);
    lastHover='';refreshHover();
  }
  function refreshState(force=false) {
    state=getState();
    const key=JSON.stringify([state.camp?.mapVersion,state.camp?.version,state.businessDay,state.phase,state.selectedMap,state.speed,state.facilities]);
    if(!force&&key===lastVersion)return;
    lastVersion=key;world=store.snapshot();catalog=world.grid.kinds;
    const mapVersion=world.camp.mapVersion||1,changedMap=habitatVersion!==mapVersion;
    if(changedMap){
      foliage?.dispose();const naturalForest=makeGrid({...newCamp(),mapVersion},1);
      foliage=buildFlora(THREE,decor,{naturalForest});habitatVersion=mapVersion;lastGroundRevision=null;
    }
    gathering.sync(world.grid);if(changedMap)populateSites();foliage.sync(world.grid,world.facilities);fauna.sync(world.grid,world.facilities);
    if(lastGroundRevision!==world.camp.gridRevision){ground.sync(world.grid);lastGroundRevision=world.camp.gridRevision;}
    updateModels();
    if(selectedId!==null&&!world.camp.placed.some(s=>s.id===selectedId)){selectedId=null;mode='select';}
    controlsUI();
  }
  function resetSelection() {selectedId=null;selectedDetail='';rot=0;mode='select';}
  // Production's TSL outfit shaders target WebGPU. Re-express their pigment
  // bands in WebGL while sharing the original geometry, face maps and poses.
  const webglMaterials=new Map();
  function actorMaterial(source,node) {
    if(!source.isNodeMaterial)return source;
    if(webglMaterials.has(source))return webglMaterials.get(source);
    const ink=node.userData.isOutline,style=source.userData.cartoonStyle;
    const mapped=new THREE.MeshBasicMaterial({color:source.color,side:source.side,
      transparent:source.transparent,opacity:source.opacity,toneMapped:false,
      depthWrite:source.depthWrite,depthTest:source.depthTest});
    if(ink) {
      const size=node.getWorldScale(new THREE.Vector3());
      const expansion=new THREE.Vector3(.003/Math.max(.001,Math.abs(size.x)),.003/Math.max(.001,Math.abs(size.y)),.003/Math.max(.001,Math.abs(size.z)));
      mapped.onBeforeCompile=s=>{
        s.uniforms.inkExpansion={value:expansion};
        s.vertexShader='uniform vec3 inkExpansion;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed+=normal*inkExpansion;');
      };
    }else if(style){
      const tones={anime:[.88,.84,.86],satire:[.77,.74,.70],organic:[.54,.62,.51],drama:[.53,.58,.69]};
      const d=tones[style]||tones.drama;
      mapped.onBeforeCompile=s=>{
        s.vertexShader='varying float castLight;\n'+s.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n castLight=dot(normalize(normalMatrix*normal),normalize(mat3(viewMatrix)*vec3(-.55,.72,1.)));');
        s.fragmentShader='varying float castLight;\n'+s.fragmentShader.replace('#include <color_fragment>',
          '#include <color_fragment>\n diffuseColor.rgb*=mix(vec3('+d.join(',')+'),vec3(1.),step(.20,castLight));');
      };
      mapped.customProgramCacheKey=()=>style;
    }
    webglMaterials.set(source,mapped);return mapped;
  }
  function inspectActors() {
    const sourceActors=getVisualActors?.()||[];
    const live=new Set();
    for(const a of sourceActors) {
      if(!state.cast?.includes(a.id)||!a.mesh?.visible)continue;
      live.add(a.id);let view=actorViews.get(a.id);
      if(view?.source!==a.mesh||view.attachmentsChanged){
        view?.dispose();view=cloneActorView(a.mesh,{watchAttachments:true});
        const {copy}=view,pairs=[];
        function pair(src,dst){
          pairs.push([src,dst]);
          if(src.material)dst.material=Array.isArray(src.material)?src.material.map(m=>actorMaterial(m,src)):actorMaterial(src.material,src);
          src.children.forEach((child,i)=>pair(child,dst.children[i]));
        }
        pair(a.mesh,copy);view.source=a.mesh;view.pairs=pairs;actorViews.set(a.id,view);actorRoot.add(copy);
      }
      for(const [src,dst] of view.pairs) {
        dst.position.copy(src.position);dst.quaternion.copy(src.quaternion);dst.scale.copy(src.scale);dst.visible=src.visible;
        if(src.morphTargetInfluences)dst.morphTargetInfluences.splice(0,dst.morphTargetInfluences.length,...src.morphTargetInfluences);
      }
      view.copy.position.y-=.48;
      view.copy.userData.liveActor=a.id;
    }
    for(const [id,v] of actorViews)if(!live.has(id)){v.dispose();actorViews.delete(id);}
  }
  function refreshHover(){
    preview.visible=false;mark.visible=false;
    if(!editing||!hover||!inBounds(hover.x,hover.y)){q('[data-live-cell]').textContent=selectedDetail;return;}
    const {x,y}=hover,st=world.camp.placed.find(s=>s.id===selectedId);
    const def=mode==='move'&&st?catalog.get(st.kind):catalog.get(kinds.value);
    const key=[x,y,mode,rot,def?.id,lastVersion,selectedDetail].join('|');
    if(mode==='place'||mode==='move') {
      const b=placementBounds(def,x,y,rot);
      if(key!==lastHover){
        const r=store.preview({kind:def.id,x,y,rot,...(mode==='move'?{id:selectedId}:{})});
        mark.userData.valid=r.ok;
        mark.userData.reason=r.ok?'可放置':r.message||'无法放置';
      }
      paintFootprint(mark,b,mark.userData.valid);
      previewModel(def.id,def.w*CELL_SIZE,def.h*CELL_SIZE,b,rot,mark.userData.valid);
      q('[data-live-cell]').textContent=def.name+' · '+x+', '+y+' · '+mark.userData.reason;
    }else{
      const p=cellToWorld(x,y);paintFootprint(mark,{...p,width:CELL_SIZE,depth:CELL_SIZE});
      q('[data-live-cell]').textContent=(selectedDetail?selectedDetail+' · ':'')+x+', '+y+' '+(terrainNames[world.grid.terrainKey(x,y)]||'');
    }
    lastHover=key;
  }
  function report(text){q('[data-live-receipt]').textContent=text||'';}
  async function commit(payload){
    if(busy||disposed)return;busy=true;controlsUI();
    try{
      const r=await (payload.op==='place'||payload.op==='move'?store.place(payload):store.command(payload));if(disposed)return;
      report(r?.message||'操作未完成');
      if(r?.ok){
        if(payload.op==='buy'){mode='place';selectedId=null;rot=0;}
        else if(payload.op==='place'||payload.op==='move'){mode='select';selectedId=payload.id??getState().camp?.placed.at(-1)?.id;}
        else if(payload.op==='store')resetSelection();
      }
    }catch(err){if(!disposed)report(err.message||'操作失败');}
    finally{busy=false;if(!disposed)refreshState(true);}
  }
  function rotate(){if(button('rotate').disabled)return;rot=(rot+1)%4;refreshHover();}
  button('close').onclick=()=>onClose?.();button('overview').onclick=overview;
  button('camp').onclick=()=>{
    const center=world.camp.placed.find(s=>s.id===selectedId)||world.camp.placed.find(s=>s.kind==='clinic');
    const b=center?placementBounds(catalog.get(center.kind),center.x,center.y,center.rot):{x:0,z:0};
    controls.target.set(b.x,1,b.z+(center?.kind==='clinic'?2:0));
    camera.position.copy(controls.target).add(new THREE.Vector3(33,30,63));
    camera.zoom=2.4;camera.updateProjectionMatrix();controls.update();
  };
  for(const [name,factor] of [['zoom-in',1.32],['zoom-out',1/1.32]])button(name).onclick=()=>{
    camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();
  };
  button('build').onclick=()=>{editing=!editing;resetSelection();report('');controlsUI();};
  button('dismiss').onclick=()=>{editing=false;resetSelection();report('');controlsUI();};
  button('advanced').onclick=()=>onBuild?.();
  siteSelect.onchange=()=>{
    const art=gathering.root.getObjectByName(siteSelect.value);if(!art)return;
    const p=art.position,azimuth=art.name==='E01_spring_north'?Math.atan2(p.x,p.z):Math.atan2(24,34);
    controls.target.set(p.x,.38,p.z);
    camera.position.set(p.x+Math.sin(azimuth)*64,45,p.z+Math.cos(azimuth)*64);
    camera.zoom=3.65;camera.updateProjectionMatrix();controls.update();
    selectedDetail=art.userData.siteName;hover=null;refreshHover();siteSelect.value='';
  };
  button('buy').onclick=()=>commit({op:'buy',kind:kinds.value});
  button('place').onclick=()=>{resetSelection();mode='place';report('点选落点');controlsUI();};
  button('rotate').onclick=rotate;
  button('turn').onclick=()=>commit({op:'rotate',id:selectedId});
  button('store').onclick=()=>commit({op:'store',id:selectedId});
  button('move').onclick=()=>{const st=world.camp.placed.find(s=>s.id===selectedId);if(st){mode='move';rot=st.rot;report('点选新位置');controlsUI();}};
  kinds.onchange=()=>{resetSelection();if(world.camp.inventory[kinds.value])mode='place';report('');controlsUI();};

  function picked(e){
    const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return null;
    pointer.set(2*(e.clientX-box.left)/box.width-1,1-2*(e.clientY-box.top)/box.height);
    ray.setFromCamera(pointer,camera);return ray.ray.intersectPlane(floor,pos)?{x:pos.x,z:pos.z}:null;
  }
  function modelAt(){
    const hit=ray.intersectObjects([models,actorRoot,gathering.root],true)[0];
    for(let o=hit?.object;o&&o!==scene;o=o.parent)if(o.userData.buildingId!=null||o.userData.facilityId!=null||o.userData.liveActor!=null||o.userData.siteId!=null)return o.userData;
    return {};
  }
  let down=null;
  const events=new AbortController(),signal=events.signal;
  canvas.addEventListener('pointerdown',e=>{if(e.button===0&&e.isPrimary)down={x:e.clientX,y:e.clientY,id:e.pointerId,dragged:false};else if(down)down.dragged=true;},{signal});
  canvas.addEventListener('pointermove',e=>{
    if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)down.dragged=true;
    const p=picked(e);if(!p)return;
    if(onGroundPointer?.({type:'move',...p,event:e})===true)return;
    if(down?.dragged)return;
    const cell=worldToCell(p.x,p.z);
    if(hover?.x!==cell.x||hover?.y!==cell.y){hover=cell;refreshHover();}
  },{signal});
  canvas.addEventListener('pointerleave',()=>{hover=null;refreshHover();},{signal});
  canvas.addEventListener('pointercancel',()=>{down=null;},{signal});
  canvas.addEventListener('pointerup',e=>{
    const press=down;down=null;
    if(!press||press.id!==e.pointerId||press.dragged||Math.hypot(e.clientX-press.x,e.clientY-press.y)>5)return;
    const p=picked(e);if(!p||onGroundPointer?.({type:'click',...p,event:e})===true)return;
    hover=worldToCell(p.x,p.z);
    if(!inBounds(hover.x,hover.y)){selectedDetail='';refreshHover();return;}
    if(editing&&(mode==='place'||mode==='move')){
      refreshHover();
      if(!mark.userData.valid){report(mark.userData.reason);return;}
      const st=world.camp.placed.find(s=>s.id===selectedId);
      commit({op:mode,kind:mode==='move'?st?.kind:kinds.value,...hover,rot,...(mode==='move'?{id:selectedId}:{})});return;
    }
    const hit=modelAt();
    if(embedded()){if(hit.liveActor)onInspectActor?.(hit.liveActor);return;}
    const st=hit.buildingId!=null?world.camp.placed.find(s=>s.id===hit.buildingId):store.at(hover.x,hover.y);
    const facility=world.facilities.find(f=>f.id===hit.facilityId),actor=hit.liveActor&&getActorState?.(hit.liveActor);
    selectedId=st?.id??null;
    selectedDetail=hit.siteName||(!st&&!actor&&!facility&&gathering.at(hover.x,hover.y)?.userData.siteName);
    selectedDetail=selectedDetail|| (actor?[actor.name,actor.label].filter(Boolean).join(' · '):facility?(facility.name||state.catalog.facilities.find(d=>d.id===facility.type)?.name||'节目设施'):st?catalog.get(st.kind)?.name:
      editing?'':'地块 '+hover.x+', '+hover.y+' · '+(terrainNames[world.grid.terrainKey(hover.x,hover.y)]||''));
    if(st&&ready())editing=true;
    report('');controlsUI();
  },{signal});
  surface.addEventListener('keydown',e=>{
    if(e.target.tagName==='SELECT'||e.target.tagName==='INPUT')return;
    if(e.key.toLowerCase()==='r'&&editing){e.preventDefault();rotate();}
    if(e.key==='Escape'&&editing){e.preventDefault();e.stopPropagation();editing=false;resetSelection();report('');controlsUI();}
  },{signal});

  let lastRead=0;
  refreshState(true);
  renderer.setAnimationLoop(ms=>{
    if(disposed||document.hidden||container.hidden||!container.isConnected)return;
    if(embedded()&&editing){editing=false;resetSelection();report('');controlsUI();}
    if(ms-lastRead>650){refreshState();lastRead=ms;}
    const external=getPlacementPreview?.();
    const externalBounds=external?.type&&facilityBounds(external);
    if(externalBounds){
      const b=externalBounds;paintFootprint(facilityMark,b,external.valid);
      const swap=(external.rot||0)%2;
      previewModel(external.type,swap?b.depth:b.width,swap?b.width:b.depth,b,external.rot||0,external.valid);
    }else if(external){
      const size=2*(external.radius||1.2);paintFootprint(facilityMark,{x:external.x,z:external.z,width:size,depth:size},external.valid);
    }else if(facilityMark.visible){facilityMark.visible=false;refreshHover();}
    inspectActors();controls.update();sky(camera,controls.target);ground.update(ms*.001);
    for(const item of instances.values())updateCampfire(item,ms*.001);
    renderer.render(scene,camera);
  });
  return function dispose(){
    if(disposed)return;disposed=true;
    renderer.setAnimationLoop(null);ro.disconnect();events.abort();controls.dispose();
    for(const view of actorViews.values())view.dispose();
    actorRoot.clear();actorViews.clear();preview.clear();models.clear();ground.dispose();
    templates.clear();
    releaseScene(scene);for(const m of webglMaterials.values())m.dispose();webglMaterials.clear();ghostPaint.dispose();ghostInk.dispose();light.shadow.dispose();
    renderer.dispose();renderer.forceContextLoss();surface.remove();
  };
}
