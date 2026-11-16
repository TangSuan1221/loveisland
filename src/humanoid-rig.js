import {beginPalmPose,posePalms} from './palm-frame.js';
import * as THREE from 'three';

// Actor-local Y up, +Z forward, anatomical left on +X. Rest offsets scale
// with the generated body rather than with the actor's global height.
export function bindHumanoid({body,head,torso,arms,legs,R,resources,mesh,color}){
  const bones=[],joints={},limbs=[];
  function bone(parent,name,x,y,z=0){
    const joint=new THREE.Bone();
    joint.name='mixamorig'+name;
    joint.position.set(x,y,z);
    parent.add(joint);
    joints[name]=joint;
    bones.push(joint);
    return joint;
  }
  const hips=bone(body,'Hips',0,.86*R);
  const spine=bone(hips,'Spine',0,.14*R);
  const middle=bone(spine,'Spine1',0,.14*R);
  const chest=bone(middle,'Spine2',0,.16*R);
  const neck=bone(chest,'Neck',0,.15*R);
  const skull=bone(neck,'Head',0,head.position.y-1.45*R);
  skull.attach(head);
  for(const [i,side] of [-1,1].entries()){
    const name=side<0?'Right':'Left',oldArm=arms[i],oldLeg=legs[i];
    oldArm.rotation.z=0;
    const clavicle=bone(chest,name+'Shoulder',side*.06,.07*R);
    const arm=bone(clavicle,name+'Arm',oldArm.position.x-side*.06,0);
    const forearm=bone(arm,name+'ForeArm',0,-.257*R);
    const hand=bone(forearm,name+'Hand',0,-.224*R);
    // Fixed socket keeps existing clip and equipment names compatible.
    hand.updateMatrix();hand.matrixAutoUpdate=false;
    const thigh=bone(hips,name+'UpLeg',oldLeg.position.x,0);
    const shin=bone(thigh,name+'Leg',0,-.395*R);
    const foot=bone(shin,name+'Foot',0,-.395*R);
    const toe=bone(foot,name+'ToeBase',0,-.035*R,.073);
    const fingers=[];
    for(const [f,digit] of ['Thumb','Index','Middle','Ring','Pinky'].entries()){
      const length=[.023,.023,.025,.023,.019][f]*R;
      let parent=hand;
      for(let n=1;n<=3;n++){
        const b=bone(parent,name+'Hand'+digit+n,n===1?side*[-.037,-.025,-.008,.009,.025][f]:0,n===1?-(f===0?.032:.076)*R:-length,n===1?.014:0);
        if(n===1&&f===0)b.rotation.z=-side*.65;
        b.visible=false;
        fingers.push(b);parent=b;
      }
    }
    arms[i]=arm;legs[i]=thigh;
    limbs.push({arm,forearm,hand,thigh,shin,foot,toe,fingers,oldArm,oldLeg});
  }
  body.updateWorldMatrix(true,true);
  const skeleton=new THREE.Skeleton(bones);
  resources.skeleton=new Set([skeleton]);
  const boneIndex=new Map(bones.map((b,i)=>[b,i]));
  // Bind all vertices in the original mesh's local coordinates. Preserve the
  // original mesh bind matrix, including anchor, scale and garment offsets.
  function skin(source,chain,axis,centers,band){
    source.updateWorldMatrix(true,true);
    const matrix=source.matrixWorld.clone(),geometry=source.geometry.clone();
    resources.geometry.add(geometry);
    const indices=[],weights=[],pos=geometry.attributes.position,p=new THREE.Vector3();
    for(let i=0;i<pos.count;i++){
      const u=axis(p.fromBufferAttribute(pos,i));
      let j=0;
      while(j<centers.length&&u>centers[j]+band)j++;
      const k=Math.min(j+1,chain.length-1);
      const t=j===centers.length?0:THREE.MathUtils.smoothstep(u,centers[j]-band,centers[j]+band);
      indices.push(boneIndex.get(chain[j]),boneIndex.get(chain[k]),0,0);weights.push(1-t,t,0,0);
    }
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
    geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    function replace(o,parent){
      const s=new THREE.SkinnedMesh(geometry,o.material);
      s.name=o.name;s.position.copy(o.position);s.quaternion.copy(o.quaternion);s.scale.copy(o.scale);
      s.userData={...o.userData};s.castShadow=o.castShadow;s.receiveShadow=o.receiveShadow;
      if(s.userData.isOutline)s.raycast=()=>{};
      s.frustumCulled=false;parent.add(s);s.bind(skeleton,matrix);return s;
    }
    const main=replace(source,source.parent);
    for(const child of [...source.children]){
      if(child.userData.isOutline)replace(child,main);else main.add(child);
    }
    source.removeFromParent();
  }
  for(const part of [...torso.children]){
    if(part.isMesh)skin(part,[hips,spine,middle,chest,neck],v=>v.y,[.98*R,1.13*R,1.29*R,1.465*R],.055*R);
  }
  for(const l of limbs){
    for(const part of [...l.oldLeg.children]){
      if(part.name==='leg-contour')skin(part,[l.thigh,l.shin],v=>-v.y,[.395*R],.075*R);
      else if(part.geometry?.type==='SphereGeometry')skin(part,[l.foot,l.toe],v=>v.z*part.scale.z+part.position.z,[.073],.035);
      else l.foot.attach(part);
    }
    for(const part of [...l.oldArm.children]){
      if(part.name==='sleeve'||part.name==='forearm')skin(part,[l.arm,l.forearm],v=>-v.y,[.257*R],.052*R);
      else {
        l.hand.attach(part);
        if(part.geometry?.type==='SphereGeometry'){
          // A continuous mitten, with the broad palm facing the thigh.
          const geometry=part.geometry.clone(),p=geometry.attributes.position;
          for(let i=0;i<p.count;i++){
            const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
            const thumb=z>0?.32*Math.exp(-((y-.12)**2)/.10)*z*z:0;
            p.setXYZ(i,x*(1-.18*Math.max(0,y)),y,z*(1-.34*Math.max(0,y))+thumb);
          }
          geometry.computeVertexNormals();resources.geometry.add(geometry);
          part.geometry=geometry;
          for(const child of part.children)if(child.userData.isOutline)child.geometry=geometry;
          part.name='rounded-hand';part.scale.set(.028,.078*R,.044);
          part.position.set(0,-.051*R,.003);l.palm=part;
        }
      }
    }
  }
  return {skeleton,joints,limbs,R};
}

export function articulate(actor,pose,time){
  const rig=actor._rig;if(!rig)return;
  const rot=actor._body.rotation;
  rig.joints.Spine.rotation.set(rot.x*.45,rot.y*.45,rot.z*.45);
  rig.joints.Spine2.rotation.set(rot.x*.55,rot.y*.55,rot.z*.55);
  rot.set(0,0,0);
  const headAngles=actor._head.rotation;
  rig.joints.Neck.rotation.set(headAngles.x*.35,headAngles.y*.35,headAngles.z*.35);
  rig.joints.Head.rotation.set(headAngles.x*.65,headAngles.y*.65,headAngles.z*.65);
  headAngles.set(0,0,0);
  const depth=Math.max(0,-actor._body.position.y);
  actor._body.position.y=Math.max(0,actor._body.position.y);
  const intent={offer:'offer',ask:'ask',take:'cup',guard:'guard',stop:'stop',wave:'wave',point:'point',kneel:'knee',cold:'hug',cradle:'cradle',drink:'cup',eat:'mouth',wipe:'cheek',inspect:'book',read:'book',clap:'clap',hide:'cheek'}[pose]??'loose';
  beginPalmPose(actor,0,time,intent,intent);
  const moving=['step','dance','retreat','walk'].includes(pose);
  const fold=['drink','eat','wipe','cold','shy','cradle','read','inspect'].includes(pose);
  let lowest=0;
  for(const [i,l] of rig.limbs.entries()){
    const shoulder=l.arm.rotation.x;
    const elbow=fold?Math.min(1.85,.28+Math.max(0,-shoulder)*.84):Math.min(.82,.10+Math.max(0,-shoulder)*.30);
    l.arm.rotation.x+=elbow*.4;
    l.forearm.rotation.set(-elbow,0,0);
    l.hand.rotation.set(0,0,0);
    const sign=i?1:-1,lift=Math.max(0,-shoulder);
    l.arm.parent.rotation.z=sign*Math.min(.27,lift*.15);
    l.arm.parent.rotation.y=-sign*Math.min(.22,lift*.13);
    l.arm.rotation.x+=lift*.06;
    l.hand.rotation.x=fold?.13:0;
    if(i===1 && ['drink','eat','wipe'].includes(pose)){
      // Solve shoulder and elbow to a facial target in the sagittal plane.
      const up=(pose==='wipe'?.225:.135)*rig.R,forward=pose==='drink'?.19:.16;
      const upper=.257*rig.R,lower=.30*rig.R;
      const radius=Math.min(upper+lower-.001,Math.hypot(up,forward));
      const bend=Math.acos(THREE.MathUtils.clamp((radius*radius-upper*upper-lower*lower)/(2*upper*lower),-1,1));
      l.arm.rotation.x=-Math.atan2(forward,-up)+Math.atan2(lower*Math.sin(bend),upper+lower*Math.cos(bend));
      l.arm.rotation.z=-.32;
      l.forearm.rotation.x=-bend;
    }
    for(const b of l.fingers)b.rotation.x=fold?-.44:-.10;
    let hip=l.thigh.rotation.x,knee;
    if(depth>.014&&!moving){
      const a=Math.acos(THREE.MathUtils.clamp(1-depth/(.79*rig.R),0,1));
      hip=-a;knee=2*a;
      if(pose==='sit'){
        // Chair support lets the pelvis travel behind the heels. Keep the
        // shins upright and lower the hips by folding at the thighs.
        hip=-Math.acos(THREE.MathUtils.clamp(1-depth/.33,0,1));
        knee=-hip;
      }else if(pose==='kneel'){
        const reach=2*Math.cos(a);
        hip=i===0?-Math.acos(THREE.MathUtils.clamp(reach-1,-1,1)):.10;
        knee=Math.acos(THREE.MathUtils.clamp(reach-Math.cos(hip),-1,1))-hip;
      }
    }else knee=moving?.12+.64*Math.max(0,Math.sin(time*5.2+i*Math.PI)):.035;
    l.thigh.rotation.x=hip;l.shin.rotation.x=knee;
    l.foot.rotation.x=-hip-knee;l.foot.rotation.z=-l.thigh.rotation.z;
    l.toe.rotation.x=moving?-.12*Math.max(0,Math.sin(time*5.2+i*Math.PI)):0;
    lowest=Math.max(lowest,.395*rig.R*(Math.cos(hip)+Math.cos(hip+knee))*Math.cos(l.thigh.rotation.z));
  }
  rig.joints.Hips.position.y=.065*rig.R+lowest;
  posePalms(actor);
}

