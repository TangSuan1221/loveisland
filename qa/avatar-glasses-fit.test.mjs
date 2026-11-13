import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {makeCustomActor,disposeCustomActor} from '../src/avatar-model.js';
test('frame size adjusts lens contour without moving it away from the eye center',()=>{
 for(const glasses of ['round','square','glasses_rectangle','glasses_rimless']){
  const centers=[],widths=[];
  for(const glassesSize of [.7,1,1.3]){const a=makeCustomActor({id:'lens-fit',appearance:{glasses,glassesSize,eyeSpacing:.02}});try{a.mesh.updateMatrixWorld(true);const frame=a.mesh.getObjectByName('glasses'),box=new THREE.Box3().setFromObject(frame.children[0]);centers.push(box.getCenter(new THREE.Vector3()).x);widths.push(box.getSize(new THREE.Vector3()).x);}finally{disposeCustomActor(a);}}
  assert(Math.max(...centers)-Math.min(...centers)<.0001,`${glasses}: size must not multiply eye spacing`);assert(widths[2]>widths[1]&&widths[1]>widths[0]);
 }
});
