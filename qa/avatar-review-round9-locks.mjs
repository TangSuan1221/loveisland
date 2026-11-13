import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeCustomActor,disposeCustomActor} from '../src/avatar-model.js';
import {ANIME_PRESETS} from '../src/avatar-anime.js';
const path='qa/avatar-accepted-round8-locks.json';
const nape = name=>/^back-anime_frame-nape-(-1|1)$/.test(name);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=a=>hash(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
const actor=makeCustomActor({id:'accepted-review-locks',appearance:ANIME_PRESETS.find(p=>p.name==='金环赤发').values});
let current;
try{
 const nodes=[];
 function visit(node,path){
  const item={path,name:node.name,type:node.type,position:node.position.toArray(),quaternion:node.quaternion.toArray(),scale:node.scale.toArray(),visible:node.visible,renderOrder:node.renderOrder};
  if(node.isMesh){
   const g=node.geometry;
   item.geometry=nape(node.name)?'allowed-rear-jaw-nape-geometry-only':{index:g.index?bytes(g.index.array):null,attributes:Object.fromEntries(Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b)).map(([k,a])=>[k,{itemSize:a.itemSize,count:a.count,arrayType:a.array.constructor.name,sha256:bytes(a.array)}]))};
   item.materials=nape(node.name)?'allowed-rear-jaw-nape-material-only':(Array.isArray(node.material)?node.material:[node.material]).map(m=>({type:m.type,color:m.color?.getHexString(),opacity:m.opacity,transparent:m.transparent,side:m.side,depthWrite:m.depthWrite,depthTest:m.depthTest,userData:m.userData}));
  }
  nodes.push(item);node.children.forEach((child,i)=>visit(child,path+'/'+i));
 }
 visit(actor.mesh,'root');current={appearance:actor.appearance,nodes};
}finally{disposeCustomActor(actor);}
if(process.argv.includes('--capture')){
 assert.ok(!fs.existsSync(path),'accepted baseline is immutable');
 fs.writeFileSync(path,JSON.stringify({scope:'All production preset properties, node transforms, materials, and all geometry/materials except the two lower rear-jaw nape meshes. Visual likeness is not asserted.',baseline:'full round8',capturedAt:new Date().toISOString(),current},null,2));
 console.log(`Captured immutable round8 lock baseline: ${current.nodes.length} nodes.`);
}else{
 const baseline=JSON.parse(fs.readFileSync(path));assert.deepEqual(current,baseline.current,'a previously accepted component changed outside the two permitted lower rear-jaw nape meshes');console.log(`PASS: ${current.nodes.length} production nodes preserve accepted round8 components outside the permitted lower rear-jaw nape geometry/material.`);
}
