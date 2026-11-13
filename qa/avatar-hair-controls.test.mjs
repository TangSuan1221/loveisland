import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {portraitActor,disposeActor} from '../src/characters.js';
import {normalizeAppearance,APPEARANCE_RANGES} from '../src/avatar-schema.js';

const fields=['hairFrontLength','hairBackLength','hairVolume'];
const make=appearance=>{const a=portraitActor('hair-controls',{appearance});a.mesh.updateMatrixWorld(true);return a;};
function signature(a,part='all'){
 const hash=createHash('sha256');
 a.mesh.getObjectByName('hair').traverse(o=>{
  if(!o.isMesh||o.name==='cartoon-outline'||(part!=='all'&&!o.name.startsWith(`${part}-`)))return;
  hash.update(o.name);hash.update(JSON.stringify(o.matrixWorld.elements));
  const p=o.geometry.getAttribute('position').array;hash.update(Buffer.from(p.buffer,p.byteOffset,p.byteLength));
 });return hash.digest('hex');
}
const styles=[{hairFront:'closepart_3',hairBack:'taper_3'},{hairFront:'receding_2',hairBack:'cropped_2'},{hairFront:'curtain_3',hairBack:'twintails_2'},{hairFront:'spikes_3',hairBack:'straight_3'}];
for(const style of styles){
 const base=make(style),explicit=make({...style,...Object.fromEntries(fields.map(k=>[k,1]))});
 assert.equal(signature(base),signature(explicit),'omitted controls retain default geometry');disposeActor(explicit);
 for(const [field,other,own] of [['hairFrontLength','back','front'],['hairBackLength','front','back']]){
  const varied=make({...style,[field]:APPEARANCE_RANGES[field][1]});
  assert.equal(signature(base,other),signature(varied,other),`${field} must not move ${other}`);
  // High swept-back foreheads intentionally have no hanging fringe to lengthen.
  if(style.hairFront==='curtain_3')assert.notEqual(signature(base,own),signature(varied,own),`${style.hairFront}/${style.hairBack} ${field} must affect ${own}`);disposeActor(varied);
 }
 for(const endpoint of [0,1]){
  const appearance={...style,...Object.fromEntries(fields.map(k=>[k,APPEARANCE_RANGES[k][endpoint]]))};
  const varied=make(appearance);
  varied.mesh.getObjectByName('hair').traverse(o=>{if(o.isMesh){const box=new THREE.Box3().setFromObject(o);assert.ok([...box.min,...box.max].every(Number.isFinite));assert.ok(box.getSize(new THREE.Vector3()).length()<4,'bounded hair geometry');}});
  const exported=JSON.parse(JSON.stringify({format:'ratings-tyrant-avatar',version:1,appearance:normalizeAppearance(appearance)}));
  const imported=make(normalizeAppearance(exported.appearance));assert.equal(signature(varied),signature(imported),'export/import preserves geometry');disposeActor(imported);disposeActor(varied);
 }
 disposeActor(base);
}

// Test real skull geometry, not a duplicate of the hair deformation equation.
// Existing seam vertices inside the cap are excluded; visible exterior samples
// must not be pushed through the skin by a new control setting.
for(const style of styles.slice(0,2)){
 const base=make(style),skin=base.mesh.getObjectByName('face-skin'),center=base._head.getWorldPosition(new THREE.Vector3()),ray=new THREE.Raycaster();
 const clearance=p=>{const direction=p.clone().sub(center).normalize();ray.set(center.clone().addScaledVector(direction,2),direction.clone().negate());const hit=ray.intersectObject(skin,false)[0];return hit?p.distanceTo(center)-hit.point.distanceTo(center):Infinity;};
 for(const field of fields)for(const value of APPEARANCE_RANGES[field].slice(0,2)){
  const changed=make({...style,[field]:value});let checked=0;
  base.mesh.getObjectByName('hair').traverse(o=>{
   if(!o.isMesh||!o.name.startsWith('front-')||o.name==='cartoon-outline')return;
   const target=changed.mesh.getObjectByName(o.name),p=o.geometry.getAttribute('position'),q=target.geometry.getAttribute('position');
   for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/70))){const before=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(clearance(before)<.001)continue;checked++;const after=new THREE.Vector3().fromBufferAttribute(q,i).applyMatrix4(target.matrixWorld);assert.ok(clearance(after)>-.002,`${style.hairFront} ${field}=${value} introduces visible skull penetration at vertex ${i}`);}
  });assert.ok(checked>20,'skull check must sample visible front surfaces');disposeActor(changed);
 }
 disposeActor(base);
}
for(const field of fields){assert.equal(normalizeAppearance({[field]:NaN})[field],1);assert.equal(normalizeAppearance({[field]:-100})[field],APPEARANCE_RANGES[field][0]);assert.equal(normalizeAppearance({[field]:100})[field],APPEARANCE_RANGES[field][1]);}
console.log('Hair controls: independent layers, default compatibility, bounded extremes, export roundtrip, and visible front/skull clearance pass.');


