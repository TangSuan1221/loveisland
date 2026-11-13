import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeCustomActor,disposeCustomActor,faceSurfacePoint} from '../src/avatar-model.js';
import {ANIME_PRESETS} from '../src/avatar-anime.js';
import {createCartoonMaterial} from '../src/avatar-material.js';

const preset=ANIME_PRESETS.find(p=>p.name==='金环赤发').values;
test('anime face shading uses unmodified source depth and does not deform accepted skin',()=>{
 const actor=makeCustomActor({id:'face-shading',appearance:preset});
 const original=new THREE.SphereGeometry(1,64,48);
 try{
  const skin=actor.mesh.getObjectByName('face-skin'),geometry=skin.geometry;
  const a=actor.appearance,p=geometry.attributes.position,s=original.attributes.position,d=geometry.attributes.faceSourceDepth;
  assert.equal(d.count,s.count);assert.equal(skin.material.userData.cartoonSurface,'face');
  for(let i=0;i<p.count;i++){
   assert.equal(d.getX(i),s.getZ(i));
   const expected=faceSurfacePoint(a.faceShape,s.getX(i),s.getY(i),s.getZ(i),a);
   for(let j=0;j<3;j++)assert.ok(Math.abs(p.array[i*3+j]-expected[j])<1e-7,'shading must not change facial geometry');
  }
  assert.equal(skin.material.userData.faceFrontLitDepth,.32);
 }finally{original.dispose();disposeCustomActor(actor);}
});
test('face-only shading leaves anime neck, hands, hair and other styles on their original materials',()=>{
 for(const artStyle of ['anime','drama','organic','satire']){
  const actor=makeCustomActor({id:'face-shading-scope',appearance:{...preset,artStyle}});
  try{
   const skin=actor.mesh.getObjectByName('face-skin');let count=0;
   actor.mesh.traverse(o=>{if(o.isMesh&&o.material?.userData.cartoonSurface==='face'){count++;assert.equal(o,skin);}});
   assert.equal(count,artStyle==='anime'?1:0);
   if(artStyle!=='anime')assert.equal(skin.geometry.attributes.faceSourceDepth,undefined);
  }finally{disposeCustomActor(actor);}
 }
});
test('dedicated face material is tracked and disposed exactly once',()=>{
 const actor=makeCustomActor({id:'face-shading-disposal',appearance:preset});
 const material=actor.mesh.getObjectByName('face-skin').material,resources=actor._resources;
 assert.ok(resources.material.has(material));let disposed=0;material.addEventListener('dispose',()=>disposed++);
 disposeCustomActor(actor);assert.equal(disposed,1);
 for(const resource of Object.values(resources))assert.equal(resource.size,0);
});
test('ordinary and flat anime materials do not request face depth attributes',()=>{
 for(const basic of [false,true]){
  const material=createCartoonMaterial('#edcfad',{style:'anime',basic});
  assert.equal(material.userData.cartoonSurface,undefined);assert.equal(material.userData.faceFrontLitDepth,undefined);material.dispose();
 }
});
