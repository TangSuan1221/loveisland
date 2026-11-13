import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeCustomActor,createFacePaintGeometry,disposeCustomActor} from '../src/avatar-model.js';
import {normalizeAppearance} from '../src/avatar-schema.js';

const styles=['drama','organic','satire'];
const faces=['oval','round','square','heart','long','diamond'];
const jaws=[{jawWidth:1,chinLength:1},{jawWidth:.7,chinLength:.8},{jawWidth:1.3,chinLength:1.25}];
function actorFor(appearance){return makeCustomActor({id:'geometry-audit',appearance});}
function label(a){return `${a.artStyle}/${a.faceShape}/jaw=${a.jawWidth}/chin=${a.chinLength}`;}

test('all styles, face shapes and jaw/chin limits have finite mesh coordinates and normals',()=>{
 for(const artStyle of styles)for(const faceShape of faces)for(const limits of jaws){
  const a=normalizeAppearance({artStyle,faceShape,...limits}),actor=actorFor(a);
  try{actor.mesh.traverse(o=>{if(!o.isMesh)return;for(const key of ['position','normal']){
   const attr=o.geometry.getAttribute(key);assert.ok(attr,`${label(a)} ${o.name}: missing ${key}`);
   assert.ok(attr.array.every(Number.isFinite),`${label(a)} ${o.name}: nonfinite ${key}`);
  }});}finally{disposeCustomActor(actor);}
 }
});

// Interpolate the rendered paint triangles, independently raycast the actual
// tessellated face mesh. No deformation helper is used to compute expectations.
function paintPoint(geometry,u,v){
 const p=geometry.getAttribute('position'),gx=u*64,gy=v*64,c=Math.floor(gx),r=Math.floor(gy),x=gx-c,y=gy-r;
 const a=r*65+c,b=a+65,d=a+1,e=b+1;
 const terms=x+y<=1?[[a,1-x-y],[b,y],[d,x]]:[[b,1-x],[e,x+y-1],[d,1-y]];
 const out=new THREE.Vector3();for(const [i,w]of terms)out.addScaledVector(new THREE.Vector3().fromBufferAttribute(p,i),w);return out;
}
test('visible face-paint samples sit over real skin for all styles/shapes and jaw/chin limits',()=>{
 const samples=[[.5,.5],[.84,.84]];
 for(let ring=1;ring<=7;ring++)for(let i=0;i<28;i++){
  const angle=i/28*Math.PI*2,radius=.483*ring/7;samples.push([.5+radius*Math.cos(angle),.5+radius*Math.sin(angle)]);
 }
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
 try{for(const artStyle of styles)for(const faceShape of faces)for(const limits of jaws){
  const a=normalizeAppearance({artStyle,faceShape,...limits}),actor=actorFor(a),paint=createFacePaintGeometry(a);
  try{
   const skin=actor.mesh.getObjectByName('face-skin');assert.ok(skin,'named real skin mesh exists');
   const proxy=new THREE.Mesh(skin.geometry,material);proxy.updateMatrixWorld(true);
   const ray=new THREE.Raycaster();
   for(const [u,v]of samples){const p=paintPoint(paint,u,v);ray.set(new THREE.Vector3(p.x,p.y,2),new THREE.Vector3(0,0,-1));
    const hits=ray.intersectObject(proxy,false);assert.ok(hits.length,`${label(a)} paint UV ${u},${v} floats outside actual skin`);
    assert.ok(p.z>=hits[0].point.z-.0015,`${label(a)} paint UV ${u},${v} sinks ${hits[0].point.z-p.z} into skin`);
   }
  }finally{paint.dispose();disposeCustomActor(actor);}
 }}finally{material.dispose();}
});

function bounds(mesh){mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);}
test('resized and rotated eyes remain attached to triangulated skin',()=>{
 for(const artStyle of styles)for(const params of [{},{eyeSize:.55,eyeWidth:.6,eyeHeight:.6},{eyeSize:1.3,eyeWidth:1.1,eyeHeight:1.1,eyeRotation:30}]){
  const actor=actorFor({artStyle,...params});actor.mesh.updateMatrixWorld(true);
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),proxy=new THREE.Mesh(actor.mesh.getObjectByName('face-skin').geometry,material);proxy.updateMatrixWorld(true);
  const inverse=actor._head.matrixWorld.clone().invert(),ray=new THREE.Raycaster();let samples=0;
  try{for(const eye of actor._eyes)eye.traverse(o=>{
   if(!o.isMesh||o.geometry.type!=='BufferGeometry'||o.userData.isOutline)return;
   const p=o.geometry.attributes.position,matrix=inverse.clone().multiply(o.matrixWorld);
   for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix);ray.set(new THREE.Vector3(v.x,v.y,2),new THREE.Vector3(0,0,-1));const hits=ray.intersectObject(proxy,false);
    assert.ok(hits.length,`${artStyle}: eye outside face`);const gap=v.z-hits[0].point.z;
    assert.ok(gap>=-.001&&gap<.009,`${artStyle} ${JSON.stringify(params)} eye attachment gap ${gap}`);samples++;
   }
  });assert.ok(samples>100,'inspect actual eye patch vertices');}finally{material.dispose();disposeCustomActor(actor);}
 }
});
test('nose root stays attached at nose size and position limits',()=>{
 for(const artStyle of styles)for(const noseSize of [.35,1,1.8])for(const offset of [-.04,.04]){
  const actor=actorFor({artStyle,noseSize,noseX:offset,noseY:offset});actor.mesh.updateMatrixWorld(true);
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),proxy=new THREE.Mesh(actor.mesh.getObjectByName('face-skin').geometry,material);proxy.updateMatrixWorld(true);
  try{const nose=actor.mesh.getObjectByName('nose').children.find(o=>o.isMesh&&o.geometry.type==='BufferGeometry'),p=nose.geometry.attributes.position,matrix=actor._head.matrixWorld.clone().invert().multiply(nose.matrixWorld),ray=new THREE.Raycaster();
   for(const i of [0,1]){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix);ray.set(new THREE.Vector3(v.x,v.y,2),new THREE.Vector3(0,0,-1));const hits=ray.intersectObject(proxy,false);assert.ok(hits.length,'nose root above skin');const gap=v.z-hits[0].point.z;assert.ok(Math.abs(gap)<.003,`${artStyle} size=${noseSize} offset=${offset}: nose root gap ${gap}`);}
  }finally{material.dispose();disposeCustomActor(actor);}
 }
});
test('feet reach the floor and body joints overlap at supported body ratios',()=>{
 for(const artStyle of styles)for(const bodyRatio of [.8,1,1.3]){
  const actor=actorFor({artStyle,bodyRatio});actor.mesh.updateMatrixWorld(true);
  try{
   const torso=bounds(actor.mesh.getObjectByName('tailored-torso')),neck=bounds(actor.mesh.getObjectByName('neck')),face=bounds(actor.mesh.getObjectByName('face-skin'));
   assert.ok(neck.intersectsBox(torso),`${artStyle}/${bodyRatio}: disconnected neck/torso`);
   assert.ok(neck.intersectsBox(face),`${artStyle}/${bodyRatio}: disconnected head/neck`);
   for(const arm of actor._arms)assert.ok(bounds(arm.getObjectByName('sleeve')).intersectsBox(torso),`${artStyle}/${bodyRatio}: detached shoulder`);
   for(const leg of actor._legs){
    const shoe=leg.children.find(o=>o.isMesh&&o.geometry.type==='SphereGeometry'&&o.scale.z>o.scale.x*1.5);
    assert.ok(shoe,'shoe mesh exists');const foot=bounds(shoe),trouser=bounds(leg.getObjectByName('leg-contour'));
    assert.ok(trouser.intersectsBox(foot),`${artStyle}/${bodyRatio}: gap at ankle`);
    assert.ok(foot.min.y>=-.015&&foot.min.y<=.02,`${artStyle}/${bodyRatio}: sole height ${foot.min.y}`);
   }
  }finally{disposeCustomActor(actor);}
 }
});
