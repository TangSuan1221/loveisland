import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {portraitActor,disposeActor} from '../src/characters.js';
import {HAIR_FRONT_DESIGNS,HAIR_BACK_DESIGNS,resolveHairParts,hairPartIcon} from '../src/avatar-hair-catalog.js';
const hashGroup=group=>{const h=createHash('sha256');group.traverse(o=>{if(!o.isMesh||o.name==='cartoon-outline')return;h.update(JSON.stringify(o.position.toArray()));h.update(JSON.stringify(o.scale.toArray()));h.update(JSON.stringify(o.rotation.toArray()));const p=o.geometry.getAttribute('position').array;assert.ok(Array.from(p).every(Number.isFinite));h.update(Buffer.from(p.buffer,p.byteOffset,p.byteLength));});return h.digest('hex');};
for(const [field,designs,count] of [['hairFront',HAIR_FRONT_DESIGNS,131],['hairBack',HAIR_BACK_DESIGNS,161]]){
 assert.equal(Object.keys(designs).length,count);const hashes=new Map();
 for(const d of Object.values(designs)){const a=portraitActor('qa',{appearance:{[field]:d.value,[field==='hairFront'?'hairBack':'hairFront']:'none'}}),hair=a.mesh.getObjectByName('hair'),hash=hashGroup(hair);assert.ok(!hashes.has(hash),`${field}:${d.value} duplicates ${hashes.get(hash)}`);hashes.set(hash,d.value);assert.ok(hairPartIcon(field,d.value).includes('path'));disposeActor(a);assert.ok(Object.values(a._resources).every(set=>set.size===0));}
}
assert.deepEqual(resolveHairParts({hairStyle:'bald',hairFront:'auto',hairBack:'straight_3'}),{front:'none',back:'straight_3'});
assert.deepEqual(resolveHairParts({hairStyle:'bob',hairFront:'spikes_2',hairBack:'auto'}),{front:'spikes_2',back:'bob_2'});
const a=portraitActor('qa',{appearance:{hairFront:'curtain_3',hairBack:'twintails_2',hairTwoTone:true,hairSecondaryColor:'#ff3366',hairMirror:true}});assert.equal(a.mesh.getObjectByName('hair').scale.x,-1);assert.ok([...a._resources.material].some(m=>m.color?.getHexString()==='ff3366'));disposeActor(a);
console.log('Hair catalog: 131 front + 161 back unique finite mesh signatures; independent legacy fallback, mirror, secondary color, and resource disposal pass.');

// Slider deformation changes independent layers while leaving the supporting head cap unchanged.
for(const [front,back] of [['hime_3','twintails_3'],['fan_3','fanspikes_3'],['fingerwave_2','ringlets_2'],['receding_2','tower_3']]){
 const base=portraitActor('qa',{appearance:{hairFront:front,hairBack:back}}),changed=portraitActor('qa',{appearance:{hairFront:front,hairBack:back,hairFrontLength:1.3,hairBackLength:1.5,hairVolume:1.25}});
 const g=base.mesh.getObjectByName('hair'),h=changed.mesh.getObjectByName('hair');assert.notEqual(hashGroup(g),hashGroup(h),front+' controls must change actual geometry');
 assert.deepEqual(Array.from(g.getObjectByName('hair-crown').geometry.attributes.position.array),Array.from(h.getObjectByName('hair-crown').geometry.attributes.position.array),'sliders must not scale crown into skull');disposeActor(base);disposeActor(changed);
}
console.log('Length/volume controls: actual geometry changes, finite coordinates and unchanged supporting crown pass.');

for(const id of ['tower_3','ringlets_3']){const actor=portraitActor('qa',{appearance:{hairFront:'none',hairBack:id,hairTwoTone:true}}),hair=actor.mesh.getObjectByName('hair');assert.ok(hair.children.filter(m=>m.isMesh).length<=4,'dense curls must be batched');disposeActor(actor);}
const braidActor=portraitActor('qa',{appearance:{hairFront:'none',hairBack:'sidebraid_3'}});const braid=braidActor.mesh.getObjectByName('back-sidebraid_3-braid-core');assert.ok(braid,'side braid mesh exists');const bpos=braid.geometry.attributes.position;assert.ok(Array.from({length:bpos.count},(_,i)=>bpos.getZ(i)).some(z=>z>.2),'side braid reaches shoulder front');disposeActor(braidActor);
