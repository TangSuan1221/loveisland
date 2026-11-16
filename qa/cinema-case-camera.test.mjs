import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,PerspectiveCamera,Vector3} from 'three';
import {createCinemaCamera} from '../src/performance/cinema-camera.js';

function fixture(aspect) {
  const camera=new PerspectiveCamera(40,aspect,.1,200);
  camera.position.set(0,3,7);
  const actors=[-1,1].map((x,id)=>{
    const mesh=new Group(),_head=new Group();mesh.add(_head);
    mesh.position.set(x,.2,-1);_head.position.y=1.6+id*.14;
    return {mesh,_head,id};
  });
  const rig=createCinemaCamera({actors,camera,controls:{enabled:true,target:new Vector3()}});
  rig.capture();
  return {actors,camera,rig};
}

test('authored fulcrum stays at exact screen coordinates through a cut and changing aspect',()=>{
  for(const aspect of [16/9,9/16,1]) {
    const {actors,camera,rig}=fixture(aspect);
    const c={along:-2,side:1.4,height:.5,aimRole:'T',aimY:-.14,screenX:.68,screenY:.37,fov:42,endAlong:1.2,endSide:2.1,endHeight:.1};
    const shot={kind:'faceT',motion:'track',composition:c};
    for(const p of [0,.2,.5,.7,1]) {
      rig.frame(shot,[0,1],p);
      const aim=actors[1]._head.getWorldPosition(new Vector3());
      const e=p*p*(3-2*p);
      const expectedPosition=aim.clone().add(new Vector3(-2+3.2*e,.5-.4*e,1.4+.7*e));
      assert(camera.position.distanceTo(expectedPosition)<1e-9);
      aim.y+=c.aimY;aim.project(camera);
      assert(Math.abs((aim.x+1)/2-c.screenX)<1e-6);
      assert(Math.abs((1-aim.y)/2-c.screenY)<1e-6);
    }
  }
});

test('portrait establishing shot includes the full pair through its handheld action',()=>{
  const {actors,camera,rig}=fixture(.45);
  const shot={kind:'pair',motion:'still',composition:{along:.4,side:1.4,height:.2,aimRole:'mid',aimY:-.1,screenX:.57,screenY:.47,fov:34}};
  rig.frame(shot,[0,1],0);
  for(const actor of actors) {
    const p=actor._head.getWorldPosition(new Vector3()).project(camera);
    assert(Math.abs(p.x)<.96,'both heads fit the vertical aperture');
  }
});
