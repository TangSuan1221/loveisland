import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {portraitActor,disposeActor} from '../src/characters.js';
import {baseReview} from '../src/base-motion.js';
import {soleHeight,jumpClearance} from '../src/foot-ground.js';
const v=new Vector3();
for(const name of ['lin','zhou','qiao']){
  const actor=portraitActor(name,{groundY:.48}),rig=actor._rig;
  const floor=actor.mesh.getWorldPosition(v).y;
  for(const id of baseReview.catalog.keys())for(const t of [0,.26,1.2,2.26,3.76,5.5,6]){
    baseReview.sample(actor,id,t);actor.mesh.updateMatrixWorld(true);
    const actual=rig.limbs.map(l=>{
      const shoe=l.oldLeg.children.find(m=>m.isSkinnedMesh&&m.geometry.type==='SphereGeometry');
      let low=Infinity;
      for(let i=0;i<shoe.geometry.attributes.position.count;i++)low=Math.min(low,shoe.localToWorld(shoe.getVertexPosition(i,v)).y);
      assert.ok(Math.abs(low-soleHeight(l))<.0001,id+' weighted mesh');
      return low;
    });
    const air=jumpClearance(Number(id.slice(2)),t,rig.R)*actor.mesh.getWorldScale(v).y;
    assert.ok(Math.abs(Math.min(...actual)-floor-air)<.0001,id+' ground');
  }
  for(let phase=0;phase<5;phase++){
    const support=rig.limbs[1-phase%2].foot;let initial;
    for(let frame=1;frame<36;frame++){
      baseReview.sample(actor,'BP005',phase*1.2+frame/30);
      const p=support.getWorldPosition(new Vector3());initial??=p;
      assert.ok(Math.hypot(p.x-initial.x,p.z-initial.z)<.002,'planted walk');
    }
  }
  disposeActor(actor);
}
