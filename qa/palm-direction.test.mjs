import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {baseReview} from '../src/base-motion.js';
import {portraitActor,disposeActor} from '../src/characters.js';

for(const name of ['lin','zhou','qiao']){
  const actor=portraitActor(name);
  for(const limb of actor._rig.limbs){
    assert.equal(limb.palm.name,'rounded-hand');
    assert.equal(limb.hand.matrixAutoUpdate,false);
    assert.ok(limb.fingers.every(b=>!b.visible&&b.children.every(c=>!c.isMesh)));
  }
  const anchors=actor._rig.limbs.map(l=>l.forearm.worldToLocal(l.palm.getWorldPosition(new Vector3())));
  for(const id of baseReview.catalog.keys())for(const t of [0,1.2,3,5.8]){
    baseReview.sample(actor,id,t);
    actor._rig.limbs.forEach((l,i)=>{
      const point=l.forearm.worldToLocal(l.palm.getWorldPosition(new Vector3()));
      assert.ok(point.distanceTo(anchors[i])<1e-6,name+' '+id+' elbow-driven hand');
    });
  }
  disposeActor(actor);
}
