import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {updateCampfire} from './artStudy/campfire.js';
import {createLiveBuilding} from './artStudy/liveBuildings.js';
import {CELL_SIZE,FACILITY_FOOTPRINTS} from './camp/footprints.js';
import { FOOTPRINT,createNavigation } from './production-navigation.js';

export function createProductionScene(scene,island){
 const group=new THREE.Group();group.name='Player built production set';scene.add(group);
 const paths=new THREE.Group();paths.name='Footworn paths between placed facilities';scene.add(paths);
 const pathCanvas=document.createElement('canvas');pathCanvas.width=pathCanvas.height=1024;const pathTexture=new THREE.CanvasTexture(pathCanvas);pathTexture.colorSpace=THREE.SRGBColorSpace;const pathMaterial=new THREE.MeshBasicMaterial({map:pathTexture,transparent:true,depthWrite:false});const pathGeometry=new THREE.PlaneGeometry(28,28);

 const coverage=new THREE.Group();coverage.name='Camera coverage guides';coverage.visible=false;scene.add(coverage);const models=new Map(),palette={interview:'#d5ad76',privacy:'#a5bfa1'};
 const geometry=new RoundedBoxGeometry(1,1,1,2,.07),materials=new Map();let activeMap='island',coverageRange=11;
 const mat=c=>{if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.85}));return materials.get(c);};
 const cube=(p,c,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(geometry,mat(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;p.add(m);return m;};
 const sphere=new THREE.SphereGeometry(1,16,12);
 const ball=(p,c,x,y,z,sx,sy,sz)=>{const m=new THREE.Mesh(sphere,mat(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;p.add(m);return m;};
 const disc=(p,c,x,y,z,r,h)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,32),mat(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;p.add(m);return m;};
 function chair(p,x,z,rot=0,color='#9eb8ab'){const c=new THREE.Group();c.position.set(x,0,z);c.rotation.y=rot;p.add(c);cube(c,'#8b795e',0,.3,0,.42,.55,.42);cube(c,color,0,.6,0,.68,.17,.68);cube(c,color,0,.95,-.29,.68,.7,.16);for(const side of [-1,1])cube(c,color,side*.31,.8,0,.13,.3,.61);return c;}
 function modern(type){const p=new THREE.Group();
  if(type==='camera')return null;
  if(type==='water'){cube(p,'#dce4d9',0,.75,0,.86,1.5,.72);cube(p,'#566e68',0,1.18,.38,.56,.4,.04);cube(p,'#b6c8be',0,.88,.4,.56,.1,.2);for(const x of [-.15,.15]){cube(p,'#c1a87e',x,1.22,.44,.08,.1,.1);disc(p,'#f3edd8',x,.98,.48,.07,.12);}cube(p,'#e7cfac',0,1.56,0,.95,.12,.8);return p;}
  if(type==='table'){disc(p,'#9a9c85',0,.49,0,.35,.98);const top=disc(p,'#eee6d2',0,1.02,0,1.22,.12);top.scale.z=.75;for(const x of [-.75,.75])for(const z of [-1,1])chair(p,x,z,z>0?Math.PI:0);disc(p,'#cbb28c',0,1.13,0,.27,.08);ball(p,'#8ca07c',-.08,1.24,0,.13,.14,.13);ball(p,'#d9b27d',.13,1.23,0,.12,.12,.12);return p;}
  if(type==='tent'||type==='cabin'){cube(p,'#b6a389',0,.22,0,2.5,.44,2.6);cube(p,'#e9e4d6',0,.5,0,2.3,.22,2.4);cube(p,type==='tent'?'#a9c2b1':'#c3b49b',0,.65,.4,2.25,.16,1.5);for(const x of [-.58,.58])cube(p,'#f5efdc',x,.68,-.77,.9,.22,.48);cube(p,'#a49379',0,.88,-1.3,2.6,1.3,.12);for(const x of [-1.3,1.3]){cube(p,'#d6c7ab',x,1.52,-1.2,.09,2.7,.09);cube(p,'#d6c7ab',x,1.52,1.2,.09,2.7,.09);}cube(p,'#ece6d4',0,2.85,0,2.75,.14,2.7);cube(p,'#aec6bd',-1.27,1.68,0,.06,2.15,2.35);return p;}
  if(type==='fire'){disc(p,'#b7c6b4',0,.04,0,1.4,.08);disc(p,'#b49b79',0,.4,0,.55,.7);disc(p,'#e6dcc4',0,.78,0,.7,.12);chair(p,-.95,0,Math.PI/2,'#c6b092');chair(p,.95,0,-Math.PI/2,'#a8bfb1');disc(p,'#e8e7d8',0,.9,0,.14,.18);return p;}
  if(type==='privacy'){cube(p,'#cfbda1',0,.04,0,2.3,.08,2.3);for(let i=0;i<12;i++){cube(p,'#d7c7ac',-1.05+i*.19,1.15,-1.08,.08,2.3,.09);cube(p,'#d7c7ac',-1.08,1.15,-1.05+i*.19,.09,2.3,.08);}chair(p,0,0,.2,'#b3c8bc');disc(p,'#b8a27f',.77,.56,.53,.27,.12);disc(p,'#dacba7',.77,.36,.53,.07,.45);return p;}
  if(type==='interview'){cube(p,'#d1bfa3',0,.05,0,2.4,.1,2.4);cube(p,'#a9c1b7',0,1.2,-1.05,2.4,2.4,.1);cube(p,'#d9c49d',0,2.38,-1.01,2.45,.12,.15);for(const x of [-1.1,1.1])cube(p,'#c5af8b',x,1.2,-.97,.08,2.3,.08);chair(p,-.6,.05,-.15,'#d5b5a2');chair(p,.6,.05,.15,'#c3ceba');disc(p,'#c6b08a',0,.5,.7,.3,.1);return p;}
  return null;
 }
 function model(type){
  if(activeMap==='island' && FACILITY_FOOTPRINTS[type]){
    const [w,h]=FACILITY_FOOTPRINTS[type];
    return createLiveBuilding(THREE,type,w*CELL_SIZE,h*CELL_SIZE);
  }
  if(activeMap==='villa'){const modernModel=modern(type);if(modernModel)return modernModel;}
  if(type==='heater'){const h=new THREE.Group();disc(h,'#68736b',0,.55,0,.45,1.1);cube(h,'#e6ad71',0,.6,.43,.54,.55,.035);for(const x of [-.2,0,.2])cube(h,'#5a665f',x,.6,.46,.025,.6,.03);disc(h,'#465a56',0,1.4,0,.13,.85);disc(h,'#747c70',0,1.05,0,.5,.12);return h;}
  const original=island.facilityTemplates[type];if(original){const o=original.clone(true);o.rotation.set(0,0,0);if(activeMap==='snow'){if(type==='tent')cube(o,'#e8efeb',0,2.04,0,.35,.13,2.25);if(type==='table')cube(o,'#dce8e3',0,1.05,0,2.4,.04,.9);if(type==='cabin')cube(o,'#e8eeea',0,3.03,0,.4,.13,2.8);}return o;}
  const p=new THREE.Group();cube(p,'#a98059',0,.08,0,2.4,.16,2.4);
  for(const x of [-1.1,1.1])for(const z of [-.9,.9])cube(p,'#8c7159',x,1.15,z,.1,2.3,.1);
  cube(p,activeMap==='snow'?'#e1eae4':palette[type]||'#bed2c0',0,2.3,0,2.6,.16,2.6);
  if(type==='privacy'){cube(p,'#b4c7a5',0,1.15,-1,2.2,1.8,.09);cube(p,'#b4c7a5',-1,1.15,0,.09,1.8,2.2);}
  else{cube(p,'#ead9ac',0,1.25,-1,2.15,1.85,.08);cube(p,'#547968',0,1.45,-.94,.8,.4,.04);}
  for(const x of [-.6,.6])chair(p,x,.1,0,'#c2ad8d');return p;
 }
 const ghost=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.035,48),new THREE.MeshBasicMaterial({color:'#a6d8a1',transparent:true,opacity:.5,depthWrite:false}));ghost.position.y=.59;ghost.visible=false;scene.add(ghost);
 const grid=new THREE.GridHelper(24,24,'#e7f1cd','#c0d6a6');grid.position.set(1,.56,1);grid.material.transparent=true;grid.material.opacity=.28;grid.visible=false;scene.add(grid);
 const emergency=new THREE.Group();emergency.position.set(-7,.5,10.5);cube(emergency,'#f2eedb',0,.55,0,1.4,1.1,1.2);cube(emergency,'#c37461',0,.8,.61,.6,.16,.03);cube(emergency,'#c37461',0,.8,.62,.16,.6,.03);group.add(emergency);
 let facilities=[],nav=createNavigation(),signature='';
 function sync(next){const sig=JSON.stringify(next.map(f=>[f.id,f.type,f.x,f.z,f.rot,f.enabled]));if(sig===signature)return;signature=sig;facilities=next;nav=createNavigation(next);for(const child of [...coverage.children]){child.geometry.dispose();child.material.dispose();coverage.remove(child);}for(const f of next.filter(f=>f.type==='camera'&&f.enabled!==false)){const ring=new THREE.Mesh(new THREE.RingGeometry(coverageRange-.1,coverageRange,64),new THREE.MeshBasicMaterial({color:'#dfbd74',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(f.x,.57,f.z);coverage.add(ring);}
  paths.clear();if(activeMap==='snow'&&next.length){
   const ctx=pathCanvas.getContext('2d'),px=v=>(v+14)/28*1024;ctx.clearRect(0,0,1024,1024);ctx.filter='blur(4px)';ctx.strokeStyle='rgba(158,177,178,0.17)';ctx.lineWidth=30;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor='rgba(150,176,180,0.18)';ctx.shadowBlur=12;ctx.beginPath();
   const hub=next.find(f=>f.type==='fire')||next.find(f=>f.type==='table')||next[0],target=nav.servicePoint(hub);
   for(const f of next.filter(f=>f!==hub&&f.type!=='camera')){const points=nav.path(nav.servicePoint(f),target);if(points.length<2)continue;ctx.moveTo(px(points[0].x),px(points[0].z));for(let i=1;i<points.length-1;i++){const p=points[i],n=points[i+1];ctx.quadraticCurveTo(px(p.x),px(p.z),px((p.x+n.x)/2),px((p.z+n.z)/2));}const last=points.at(-1);ctx.lineTo(px(last.x),px(last.z));}
   ctx.stroke();pathTexture.needsUpdate=true;const trail=new THREE.Mesh(pathGeometry,pathMaterial);trail.rotation.x=-Math.PI/2;trail.position.y=.524;paths.add(trail);
  }
  const ids=new Set(next.map(f=>f.id));for(const[id,obj]of models)if(!ids.has(id)){obj.removeFromParent();models.delete(id);}
  for(const f of next){let obj=models.get(f.id);if(!obj){obj=model(f.type);obj.traverse(o=>o.userData.facilityId=f.id);models.set(f.id,obj);group.add(obj);}obj.position.set(f.x,.49,f.z);if(activeMap==='island')obj.rotation.y=-(f.rot||0)*Math.PI/2;}
 }
 return{group,sync,updateFire(time){for(const obj of models.values())updateCampfire(obj,time);},setCoverageRange(range){if(!Number.isFinite(range)||range<=.1||range===coverageRange)return;coverageRange=range;signature='';sync(facilities);},setMap(id){if(id===activeMap)return;activeMap=id;for(const obj of models.values())obj.removeFromParent();models.clear();signature='';sync(facilities);},get navigation(){return nav;},get facilities(){return facilities;},setBuild(value){grid.visible=value;coverage.visible=value;},ghost(type,point,valid){ghost.visible=!!point;if(point){ghost.position.set(point.x,.59,point.z);ghost.scale.setScalar(FOOTPRINT[type]||1);ghost.material.color.set(valid?'#9dd48b':'#df806b');}},clearGhost(){ghost.visible=false;},objects:()=>[...models.values()]};
}

