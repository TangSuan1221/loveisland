import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Scene,Vector3} from 'three';
import {createCharacters,disposeActor} from '../src/characters.js';
const ids=readFileSync(new URL('../runtime_spec/characters.csv',import.meta.url),'utf8').trim().split(/\r?\n/).slice(1).map(s=>s.split(',')[0]);
const cast=createCharacters(new Scene());
cast.configureCast(ids.map(id=>({id})));
const state={activity:'idle',gesture:'idle',moving:false,x:0,z:0,facing:0};
cast.setSimulation({getActor:()=>state});
for(const moving of [false,true,false]){
  Object.assign(state,{moving,gesture:moving?'walk':'idle'});
  const travel=new Map();
  for(let frame=0;frame<=120;frame++){
    cast.update(frame/30,1/30);
    for(const a of cast.actors){
      assert.equal(a._rig.skeleton.bones.length,52);
      for(const l of a._rig.limbs){
        const shoulder=l.arm.getWorldPosition(new Vector3()),wrist=l.hand.getWorldPosition(new Vector3());
        const offset=wrist.sub(shoulder).divideScalar(a.mesh.scale.y*a._rig.R);
        assert.ok(-offset.y>.39,a.id+' wrist at shoulder height');
        assert.ok(Math.abs(offset.x)<.10,a.id+' arm held sideways');
        assert.ok(l.palm.scale.y/l.palm.scale.x>2,a.id+' round palm');
        const range=travel.get(l)||[Infinity,-Infinity];
        range[0]=Math.min(range[0],offset.z);range[1]=Math.max(range[1],offset.z);travel.set(l,range);
      }
    }
  }
  for(const [low,high] of travel.values())assert.ok(moving?high-low>.07:high-low<.04);
}
cast.actors.forEach(disposeActor);
console.log('12 actors: idle, walking, return to idle; 121 frames each, both wrists checked.');
