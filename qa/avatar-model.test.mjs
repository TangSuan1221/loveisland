import assert from 'node:assert/strict';
import * as THREE from 'three';
import {APPEARANCE_OPTIONS,APPEARANCE_RANGES,DEFAULT_APPEARANCE,normalizeAppearance,appearanceForCandidate} from '../src/avatar-schema.js';
import {portraitActor,createCharacters,disposeActor} from '../src/characters.js';
import {CANDIDATES} from '../src/production-engine.js';
for(const [key,options]of Object.entries(APPEARANCE_OPTIONS))for(const {value} of options){
 const actor=portraitActor('qa',{appearance:{[key]:value}});assert.equal(actor.appearance[key],value);actor.mesh.updateMatrixWorld(true);actor.mesh.traverse(o=>{if(o.isMesh){assert.ok(!o.material.isShaderMaterial);const p=o.geometry.getAttribute('position');assert.ok(Array.from(p.array).every(Number.isFinite),`${key}:${value}`);}});const r=actor._resources;disposeActor(actor);for(const set of Object.values(r))assert.equal(set.size,0);
}
for(const [key,[min,max]]of Object.entries(APPEARANCE_RANGES)){
 const pair=key.startsWith('eyeUpper')&&key.endsWith('X')?['eyeUpperInnerX','eyeUpperOuterX']:key.startsWith('eyeLower')&&key.endsWith('X')?['eyeLowerInnerX','eyeLowerOuterX']:[];
 assert.equal(normalizeAppearance({[key]:-Infinity})[key],DEFAULT_APPEARANCE[key]);
 for(const [raw,expected]of [[-1e6,min],[1e6,max]]){const input=Object.fromEntries(pair.map(k=>[k,raw]));input[key]=raw;assert.equal(normalizeAppearance(input)[key],expected,key);}
}
assert.equal(normalizeAppearance({skinColor:'url(script)',hairStyle:'unknown'}).skinColor,DEFAULT_APPEARANCE.skinColor);
const strokes=Array.from({length:100},()=>({width:1,color:'#ffffff',points:Array.from({length:1000},()=>[.5,.5])}));assert.equal(normalizeAppearance({strokes}).strokes.reduce((n,s)=>n+s.points.length,0),30000);
const expected={lin:'bob',zhou:'crop',qiao:'bun',lu:'side',tang:'braids',chen:'curls',yao:'ponytail',xu:'quiff',song:'afro',he:'long',ning:'pixie',bai:'twintop'};
for(const c of CANDIDATES){assert.equal(appearanceForCandidate(c).hairStyle,expected[c.id]);const actor=portraitActor(c.id);assert.deepEqual(actor.appearance,appearanceForCandidate(c));disposeActor(actor);}
const cast=createCharacters(new THREE.Scene());const actor=cast.actors[0],originalPosition=actor.mesh.position.clone();assert.equal(cast.updateAppearance(actor.id,{eyeSize:1.4,eyeHeight:1.2,eyeWidth:.7,height:1.2,headScale:1.1}),true);assert.equal(cast.actors[0],actor);assert.deepEqual(actor.mesh.position.toArray(),originalPosition.toArray());assert.equal(actor.mesh.scale.y,1.2);for(let i=0;i<12;i++)cast.update(i*.02,.02);assert.equal(actor._eyes[0].scale.y,1.4*1.2);assert.equal(actor._eyes[0].scale.x,1.4*.7);cast.actors.forEach(disposeActor);
console.log('Avatar model checks passed: all choices, finite geometry, WebGPU-compatible materials, ownership/disposal, normalization, 30k point budget, 12 default parity, stable actor identity and animation scales.');
