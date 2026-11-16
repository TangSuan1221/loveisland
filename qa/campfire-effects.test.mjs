import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLiveBuilding} from '../src/artStudy/liveBuildings.js';
import {campfireEffectName,updateCampfire} from '../src/artStudy/campfire.js';

test('placed fire and bonfire copies animate independently on both sides of the world origin',()=>{
  for(const kind of ['fire_pit','bonfire','fire']){
    const first=createLiveBuilding(THREE,kind,1.5,1.5);
    const second=first.clone(true);
    first.position.set(-12,0,-9);second.position.set(4,0,7);
    const smoke=first.getObjectByName('Smoke'),embers=first.getObjectByName('Embers');
    assert.notEqual(smoke.instanceMatrix,second.getObjectByName('Smoke').instanceMatrix);
    const sourceSparks=second.getObjectByName('Embers').instanceMatrix.array.slice();
    const scales=[];
    for(const seconds of [0,.21,.85,1.4]){
      updateCampfire(first,seconds);
      scales.push(first.getObjectByName('Flame 0').scale.y);
      assert.ok(smoke.instanceMatrix.array.every(Number.isFinite));
      assert.ok(embers.instanceMatrix.array.every(Number.isFinite));
    }
    assert.equal(new Set(scales).size,4);
    assert.deepEqual(second.getObjectByName('Embers').instanceMatrix.array,sourceSparks);
    const effect=first.getObjectByName(campfireEffectName);
    effect.removeFromParent();
    const size=new THREE.Box3().setFromObject(first,true).getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.x-1.425)<1e-5&&Math.abs(size.z-1.425)<1e-5);
  }
});
