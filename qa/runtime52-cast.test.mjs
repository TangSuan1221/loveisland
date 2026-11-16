import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Box3, Quaternion, Scene, Vector3} from 'three';
import {portraitActor,disposeActor} from '../src/characters.js';
import {cloneActorView} from '../src/clone-actor-view.js';
import {performances} from '../src/action-catalog.js';
import {sampleAuthored,releaseAuthored} from '../src/authored-motion.js';
import {playRetargeted} from '../src/action-playback.js';

const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const rows=read('../runtime_spec/characters.csv').trim().split(/\r?\n/).slice(1);
const presets=new Map(read('../runtime_spec/proportions.csv').trim().split(/\r?\n/).slice(1).map(row=>{
  const cells=row.split(',');return [cells[0],Number(cells[3])];
}));
const tracks=['A01','A26','A27','play-lead','play-follow'].map(id=>({
  id,clip:JSON.parse(read('../src/motions/'+id+'.json')),
  track:performances.get(id.startsWith('play-')?'play':id).tracks[id==='play-follow'?1:0]
}));
const retargeted=JSON.parse(read('../src/retargeted-motion.json'));
for(const row of rows){
  const [id,preset]=row.split(','),actor=portraitActor(id,{groundY:.48});
  const original=actor.mesh,scene=new Scene();original.position.set(3,.48,-2);scene.add(original);
  scene.updateMatrixWorld(true);
  const face=new Box3().setFromObject(actor._head.getObjectByName('face-skin'),true);
  const shoe=actor._rig.limbs[0].oldLeg.children.find(n=>n.isSkinnedMesh&&n.geometry.type==='SphereGeometry');
  const sole=new Box3().setFromObject(shoe,true);
  const heads=(face.max.y-sole.min.y)/(face.max.y-face.min.y);
  assert.ok(Math.abs(heads-presets.get(preset))<.015,id+' head ratio '+heads);
  const {copy,dispose}=cloneActorView(original);
  copy.position.y-=.48;copy.updateMatrixWorld(true);
  function compare(src,dst){
    if(src.isSkinnedMesh){
      assert.notEqual(src.skeleton,dst.skeleton);
      assert.equal(dst.skeleton.bones.length,52);
      for(const bone of dst.skeleton.bones)assert.ok(copy.getObjectById(bone.id));
      const positions=src.geometry.attributes.position;
      for(let i=0;i<positions.count;i+=Math.max(1,Math.floor(positions.count/12))){
        const a=src.localToWorld(src.getVertexPosition(i,new Vector3()));
        const b=dst.localToWorld(dst.getVertexPosition(i,new Vector3()));a.y-=.48;
        assert.ok(a.distanceTo(b)<.00001,id+' '+src.name+' split from camp pose');
      }
    }
    src.children.forEach((child,i)=>compare(child,dst.children[i]));
  }
  compare(original,copy);dispose();
  for(const {id:clipId,clip,track} of tracks){
    assert.equal(new Set(clip.bones).size,52);
    for(let frame=0;frame<clip.samples.length;frame++){
      assert.ok(sampleAuthored(actor,track,frame/(clip.samples.length-1)));
      clip.bones.forEach((name,i)=>{
        const expected=new Quaternion().fromArray(clip.samples[frame].q[i]).normalize();
        const actual=actor._rig.joints[name].quaternion.clone().normalize();
        assert.ok(expected.angleTo(actual)<.00001,id+' '+clipId+' '+name+' '+frame);
      });
    }
    releaseAuthored(actor);
  }
  for(const [name,clip] of Object.entries(retargeted)){
    for(let frame=0;frame<clip.frames.length;frame++){
      playRetargeted(actor,name,frame*clip.duration/(clip.frames.length-1));
      for(const limb of [...actor._arms,...actor._legs])assert.ok(Number.isFinite(limb.rotation.x+limb.rotation.z));
    }
  }
  console.log(id,heads.toFixed(3),'heads; 52 joints; camp skin, 5 authored clips and 3 retargeted clips passed');
  disposeActor(actor);
}
