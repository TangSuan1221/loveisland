import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {portraitActor,disposeActor} from '../src/characters.js';
import {performTrack} from '../src/action-playback.js';

for(const id of ['lin','zhou','qiao']){
  const a=portraitActor(id),{skeleton,joints,limbs}=a._rig;
  assert.equal(skeleton.bones.length,52);
  assert.equal(new Set(skeleton.bones.map(b=>b.name)).size,52);
  assert.ok(skeleton.bones.every(b=>b.isBone));
  for(const side of ['Left','Right']){
    for(const [child,parent] of [['Arm','Shoulder'],['ForeArm','Arm'],['Hand','ForeArm'],['Leg','UpLeg'],['Foot','Leg'],['ToeBase','Foot']])
      assert.equal(joints[side+child].parent,joints[side+parent]);
    for(const digit of ['Thumb','Index','Middle','Ring','Pinky'])
      assert.equal(joints[side+'Hand'+digit+'3'].parent,joints[side+'Hand'+digit+'2']);
  }
  for(const [name,b] of Object.entries(joints))assert.equal(b.name,'mixamorig'+name);
  assert.ok(limbs[1].hand.isBone);
  const meshes=[];
  a.mesh.traverse(o=>{if(o.isSkinnedMesh&&!o.userData.isOutline)meshes.push(o);});
  assert.ok(meshes.some(m=>m.name==='tailored-torso'));
  const leg=meshes.find(m=>m.name==='leg-contour');
  const arm=meshes.find(m=>m.name==='forearm');
  function tip(mesh){
    let pick=0;const p=mesh.geometry.attributes.position;
    for(let i=1;i<p.count;i++)if(p.getY(i)<p.getY(pick))pick=i;
    a.mesh.updateMatrixWorld(true);
    return mesh.localToWorld(mesh.getVertexPosition(pick,new Vector3()));
  }
  for(const m of meshes){
    assert.equal(m.skeleton,skeleton);
    const w=m.geometry.attributes.skinWeight;
    for(let k=0;k<w.count;k++)assert.ok(Math.abs(w.getX(k)+w.getY(k)+w.getZ(k)+w.getW(k)-1)<1e-5);
  }
  const initial=tip(arm);
  limbs[0].forearm.rotation.x=-1.5;
  assert.ok(tip(arm).distanceTo(initial)>.15,'forearm vertices must follow elbow independently');
  limbs[0].forearm.rotation.x=0;
  const start=tip(leg);
  limbs[0].shin.rotation.x=1.5;
  assert.ok(tip(leg).distanceTo(start)>.3,'shin vertices must follow knee independently');
  limbs[0].shin.rotation.x=0;
  performTrack(a,['sit'],1,1);
  const hips=joints.Hips.position.y;
  for(const l of limbs){
    assert.ok(l.shin.rotation.x>1.5 && l.thigh.rotation.x<-.8);
    const knee=l.shin.getWorldPosition(new Vector3()),ankle=l.foot.getWorldPosition(new Vector3());
    assert.ok(Math.abs(knee.z-ankle.z)<.005,'seated shin must be upright');
    assert.ok(Math.abs(l.foot.getWorldPosition(new Vector3()).y-.065*a._rig.R*a.mesh.scale.y)<.003);
  }
  performTrack(a,['idle'],1,1);assert.ok(joints.Hips.position.y>hips+.25);
  performTrack(a,['drink'],1,1);assert.ok(limbs[1].forearm.rotation.x< -1);
  disposeActor(a);
}
console.log('PASS: 52 original joints, three actors, actual skin deformation, normalized weights, wrist attachment, grounded seated ankles and recovery.');

