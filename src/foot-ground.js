import {Vector3,Quaternion} from 'three';

const soles=new WeakMap(),point=new Vector3(),floor=new Vector3(),origin=new Vector3();
function sampleSole(limb){
  // Store each weighted vertex in foot- and toe-local bind space once.
  // The vertical component after skinning is a dot product per bone.
  const mesh=limb.oldLeg.children.find(m=>m.isSkinnedMesh&&m.geometry.type==='SphereGeometry');
  if(!mesh)throw Error('Missing skinned shoe on '+limb.foot.name);
  const g=mesh.geometry,{position,skinWeight,skinIndex}=g.attributes,samples=[];
  const indexes=new Map([[limb.foot,0],[limb.toe,4]]);
  for(let i=0;i<position.count;i++){
    const row=new Array(8).fill(0);
    for(let k=0;k<2;k++){
      const w=skinWeight.getComponent(i,k);if(!w)continue;
      const index=skinIndex.getComponent(i,k),offset=indexes.get(mesh.skeleton.bones[index]);
      point.fromBufferAttribute(position,i).applyMatrix4(mesh.bindMatrix).applyMatrix4(mesh.skeleton.boneInverses[index]);
      row[offset]+=point.x*w;row[offset+1]+=point.y*w;row[offset+2]+=point.z*w;row[offset+3]+=w;
    }
    samples.push(...row);
  }
  return new Float64Array(samples);
}
export function soleHeight(limb){
  let s=soles.get(limb);if(!s){s=sampleSole(limb);soles.set(limb,s);}
  limb.toe.updateWorldMatrix(true,false);
  const a=limb.foot.matrixWorld.elements,b=limb.toe.matrixWorld.elements;
  let low=Infinity;
  for(let i=0;i<s.length;i+=8)low=Math.min(low,
    a[1]*s[i]+a[5]*s[i+1]+a[9]*s[i+2]+a[13]*s[i+3]+
    b[1]*s[i+4]+b[5]*s[i+5]+b[9]*s[i+6]+b[13]*s[i+7]);
  return low;
}
export function settleFeet(actor,air=0){
  const rig=actor._rig;if(!rig)return;
  const floorY=actor.mesh.getWorldPosition(floor).y;
  const lowest=Math.min(soleHeight(rig.limbs[0]),soleHeight(rig.limbs[1]));
  const hips=rig.joints.Hips;
  // Translate vertically in world space even if the parent is scaled or tilted.
  hips.getWorldPosition(origin);origin.y+=floorY+air*actor.mesh.getWorldScale(point).y-lowest;
  hips.position.copy(hips.parent.worldToLocal(origin));
}
export function jumpClearance(id,t,R){
  if(id!==36)return 0;
  for(const takeoff of [2,3.5]){
    const u=(t-takeoff)/.52;
    if(u>0&&u<1)return .09*R*4*u*(1-u);
  }
  return 0;
}

// Horizontal footprints are a function of clip time, not the previous frame.
// A support shoe stays at its landing mark while the hips continue traveling.
const gaits=new Map([
  [5,[0,.39,5]], [6,[0,.46,7,4]], [8,[.52,0,5]], [11,[0,.30,4]],
  [35,[0,.31,4]], [37,[0,-.65,5]], [56,[0,.39,5]], [65,[0,-.32,3]],
  [85,[0,-.28,3]], [114,[0,.39,5]], [122,[0,.39,5]], [145,[0,.39,5]],
  [182,[0,-.39,4]], [193,[0,.32,4]], [194,[0,.39,5]]
]);
const down=new Vector3(0,-1,0);
export function plantSteps(actor,id,t){
  const gait=gaits.get(id);if(!gait)return;
  const [dx,dz,count,end=6]=gait,{joints:j,R,limbs}=actor._rig;
  const progress=Math.min(1,Math.max(0,t/end)),step=Math.min(count-1,Math.floor(progress*count)),u=progress*count-step;
  const travel=new Vector3(dx*R,0,dz*R);
  j.Hips.position.x=travel.x*progress;j.Hips.position.z=travel.z*progress;
  // Reserve knee flexion for the unsupported foot, including the limping gait.
  j.Hips.position.y=(id===35?.72:.795)*R;
  const rotation=actor.mesh.getWorldQuaternion(new Quaternion());
  for(const [i,limb] of limbs.entries()){
    const swing=i===step%2,previous=Math.max(0,step-1)/count,next=Math.min(1,(step+1)/count);
    const eased=u*u*(3-2*u);
    const mark=swing?previous+(next-previous)*eased:step/count;
    const height=swing?Math.sin(Math.PI*u)**2*(id===35&&i===0?.023:.085)*R:0;
    const target=actor.mesh.localToWorld(new Vector3(limb.thigh.position.x+travel.x*mark,.069*R+height,travel.z*mark));
    const hip=limb.thigh.getWorldPosition(new Vector3()),axis=target.clone().sub(hip);
    const L=limb.shin.getWorldPosition(new Vector3()).distanceTo(hip),M=limb.foot.getWorldPosition(new Vector3()).distanceTo(limb.shin.getWorldPosition(new Vector3()));
    const d=Math.min(L+M-1e-6,Math.max(Math.abs(L-M)+1e-6,axis.length()));axis.normalize();
    const pole=new Vector3(0,0,1).applyQuaternion(rotation);pole.addScaledVector(axis,-pole.dot(axis)).normalize();
    const along=(L*L-M*M+d*d)/(2*d);
    const knee=axis.clone().multiplyScalar(along).addScaledVector(pole,Math.sqrt(Math.max(0,L*L-along*along)));
    for(const [bone,vector] of [[limb.thigh,knee],[limb.shin,axis.multiplyScalar(d).sub(knee)]]){
      bone.quaternion.setFromUnitVectors(down,vector.clone().normalize().applyQuaternion(bone.parent.getWorldQuaternion(new Quaternion()).invert()));
    }
    limb.foot.quaternion.copy(limb.shin.getWorldQuaternion(new Quaternion()).invert().multiply(rotation));
    limb.toe.rotation.set(0,0,0);
  }
}
