import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Group, PerspectiveCamera, Vector3} from 'three';
import {createCinemaCamera} from '../src/performance/cinema-camera.js';

function fixture(aspect=16/9, blocked) {
  const camera=new PerspectiveCamera(37,aspect,.1,220);
  camera.position.set(-2,5,10);
  const controls={enabled:true,target:new Vector3(0,.8,0)};
  camera.lookAt(controls.target);
  const actors=[-1,1].map((x,i)=>{
    const mesh=new Group(), head=new Group();
    mesh.position.set(x,0,0); mesh.rotation.y=i ? -Math.PI/2 : Math.PI/2;
    mesh.add(head); head.position.y=1.65;
    return {id:i,mesh,_head:head};
  });
  return {camera,controls,actors,rig:createCinemaCamera({camera,controls,actors,blocked}),
    screen(actor){return actor._head.getWorldPosition(new Vector3()).project(camera);}};
}

test('reverse angles frame the listener behind a foreground shoulder, maintaining eyelines',()=>{
  for(const aspect of [16/9,1,9/16]) {
    const {rig,camera,actors,screen}=fixture(aspect);rig.capture();
    for(const kind of ['shoulderF','shoulderT']){
      rig.frame({kind,motion:'still'},[0,1],0);
      const [near,far]=kind==='shoulderF'?actors:[...actors].reverse();
      assert(camera.position.z>0);
      const n=screen(near),f=screen(far);
      assert(n.z<f.z);
      assert(Math.abs(f.x)<.60 && Math.abs(f.y)<.4);
      assert(Math.abs(n.x-f.x)>.48);
      assert(Math.abs(n.x)<1.3,'foreground edge stays in frame');
    }
  }
});

test('tracks generate parallax and all moving shots change camera position',()=>{
  const {rig,camera,actors,screen}=fixture();rig.capture();
  for(const motion of ['track','arc','push','pull','still']){
    const shot={kind:'pair',motion};
    rig.frame(shot,[0,1],0);const start=camera.position.clone(),foreground=screen(actors[0]);
    rig.frame(shot,[0,1],1);
    assert.equal(camera.position.distanceTo(start)>.05,motion!=='still');
    if(motion==='track')assert(Math.abs(screen(actors[0]).x-foreground.x)>.015);
  }
});

test('capture restores camera and controls after any cut; unavailable actors leave camera untouched',()=>{
  const {rig,camera,controls}=fixture();const pos=camera.position.clone(),q=camera.quaternion.clone(),target=controls.target.clone();
  const restore=rig.capture();assert(!controls.enabled);
  assert.equal(rig.frame({kind:'faceF'},['missing'],1),false);
  rig.frame({kind:'faceF'},[0],1);restore();
  assert.deepEqual(camera.position,pos);assert(camera.quaternion.equals(q));assert.deepEqual(controls.target,target);assert(controls.enabled);assert.equal(camera.fov,37);
});
test('a blocked cut keeps its elevated camera position throughout the beat',()=>{
  let probes=0;
  const {rig,camera}=fixture(16/9,()=>++probes<3);rig.capture();
  const shot={kind:'pair',motion:'still'};
  rig.frame(shot,[0,1],0);const height=camera.position.y;
  rig.frame(shot,[0,1],1);assert.equal(camera.position.y,height);assert.equal(probes,3);
});


test('insert keeps the carried cup centered, with the lens outside the carrying arm',()=>{
  const {actors,rig,camera}=fixture();
  const hand=new Group(),cup=new Group();
  actors[0].mesh.add(hand);hand.add(cup);hand.position.set(-.38,1.05,.36);
  actors[0]._rig={joints:{RightHand:hand}};
  cup.name='cinema-water-cup';cup.position.set(.035,-.095,.035);
  rig.capture();rig.frame({kind:'insert',motion:'push'},[0,1],.5);
  const prop=cup.getWorldPosition(new Vector3()),projected=prop.clone().project(camera);
  assert(Math.abs(projected.x)<.10 && Math.abs(projected.y)<.35);
  const outward=prop.clone().sub(actors[0].mesh.position).setY(0);
  assert(camera.position.clone().sub(prop).dot(outward)>0);
});
