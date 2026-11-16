import {baseReview} from '../src/base-motion.js';
import {portraitActor} from '../src/characters.js';
import {Vector3} from 'three';
import {readFileSync} from 'node:fs';
const cast=readFileSync(new URL('../runtime_spec/characters.csv',import.meta.url),'utf8').trim().split(/\r?\n/).slice(1).map(row=>row.split(',')[0]);
for(const name of cast){
 const a=portraitActor(name),skin=a._head.getObjectByName('face-skin'),p=new Vector3(),center=new Vector3(),extent=new Vector3();
 skin.geometry.computeBoundingBox();skin.geometry.boundingBox.getCenter(center);skin.geometry.boundingBox.getSize(extent).multiplyScalar(.5);
 const bad=new Map();
 for(const id of baseReview.catalog.keys())for(let f=0;f<=180;f++){
  baseReview.sample(a,id,f/30);
  for(const limb of a._rig.limbs){
    for(const joint of [limb.foot,limb.toe,limb.hand,limb.forearm]){
      joint.getWorldPosition(p);
      if(!Number.isFinite(p.lengthSq())||p.y<-.002)throw Error(name+' '+id+' frame '+f+' '+joint.name+' invalid position '+p.toArray());
    }
  }
  for(const limb of a._rig.limbs)for(const b of [limb.hand,...limb.fingers]){
   skin.worldToLocal(b.getWorldPosition(p)).sub(center).divide(extent);const d=p.length();
   if(d<1)bad.set(id,Math.min(bad.get(id)||1,d));
  }
 }
 if(bad.size)throw Error(name+' '+JSON.stringify([...bad]));console.log(name,baseReview.catalog.size,'poses x 181 frames checked');
}