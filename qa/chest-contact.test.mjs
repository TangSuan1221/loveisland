import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {portraitActor,disposeActor} from '../src/characters.js';
import {performances} from '../src/action-catalog.js';
import {performTrack} from '../src/action-playback.js';

for(const name of ['lin','zhou','qiao']){
  const actor=portraitActor(name),j=actor._rig.joints,R=actor._rig.R;
  function palm(side){
    return j.Spine2.worldToLocal(j[side+'Hand'].localToWorld(new Vector3(0,-.055*R,.015*R)));
  }
  for(const id of ['A22','A23'])for(let frame=0;frame<=180;frame++){
    performTrack(actor,performances.get(id).tracks[0],frame/30,6);
    const left=palm('Left'),right=palm('Right');
    if(id==='A23'){
      assert.ok(Math.abs(left.x)<.06&&Math.abs(left.y/R+.055)<.045&&left.z>.12&&left.z<.21,name+' chest');
    }else if(frame<=90){
      assert.ok(left.x<-.065&&right.x>.065&&left.y>right.y+.055*R,name+' crossed');
    }else if(frame===180){
      assert.ok(left.x>.1&&right.x<-.1,name+' released');
    }
  }
  disposeActor(actor);
}
