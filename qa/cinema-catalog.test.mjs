import assert from 'node:assert/strict';
import test from 'node:test';
import {portraitActor,disposeActor} from '../src/characters.js';
import {performTrack} from '../src/action-playback.js';
import {catalogScenes} from '../src/performance/catalog-scenes.js';
import {createCinemaActing} from '../src/performance/cinema-acting.js';

test('all S01–S80 screenings sample the rehearsal track for the correct role and time',()=>{
  const ids=['lin','zhou','qiao'];
  const cast=ids.map(id=>portraitActor(id)),reference=ids.map(id=>portraitActor(id));
  const acting=createCinemaActing(cast);
  const joints=['Hips','RightHand','LeftHand','RightForeArm','LeftForeArm','LeftFoot','RightFoot'];
  assert.equal(catalogScenes.size,81);
  for(const [id,entry] of catalogScenes){
    const restore=acting.begin({type:'staged-performance',sceneId:'run-17',performanceKey:id,participants:ids.slice(0,entry.tracks.length)});
    for(const seconds of [.7,2.9,5.1]){
      acting.frame({kind:'pair'},seconds/6,seconds*1000);
      entry.tracks.forEach((track,role)=>{
        performTrack(reference[role],track,seconds,6);
        reference[role].mesh.updateMatrixWorld(true);cast[role].mesh.updateMatrixWorld(true);
        for(const joint of joints){
          const expected=reference[role]._rig.joints[joint].matrixWorld.elements;
          const actual=cast[role]._rig.joints[joint].matrixWorld.elements;
          assert.ok(actual.every((v,i)=>Math.abs(v-expected[i])<1e-5),id+' role '+role+' '+joint);
        }
      });
    }
    restore();
  }
  [...cast,...reference].forEach(disposeActor);
});
