import {settleFeet} from './foot-ground.js';
import {Vector3,Quaternion,Box3} from 'three';
const cache=new WeakMap();
const point=new Vector3(),joint=new Vector3(),normal=new Vector3(),axis=new Vector3(),delta=new Quaternion(),basis=new Quaternion(),local=new Vector3();
function collider(bone,center,radii){return {bone,center,radii,world:new Vector3(),q:new Quaternion(),inv:new Quaternion()};}
function volumes(actor){
 let result=cache.get(actor);if(result)return result;
 const j=actor._rig.joints,R=actor._rig.R,skin=actor._head.getObjectByName('face-skin');
 let center=new Vector3(0,0,0),r=new Vector3(.25,.3,.245);
 if(skin){skin.geometry.computeBoundingBox();const box=new Box3().copy(skin.geometry.boundingBox);box.getCenter(center);box.getSize(r).multiplyScalar(.5);}
 result=[collider(skin||actor._head,center,r),collider(j.Spine2,new Vector3(0,-.1*R,0),new Vector3(.18,.21*R,.126)),collider(j.Hips,new Vector3(0,.04*R,0),new Vector3(.15,.15*R,.12)) ];
 const hair=actor._head.getObjectByName('hair');
 for(const mesh of hair?.children||[]){
  if(!mesh.geometry||mesh.userData.isOutline)continue;
  mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
  const radius=box.getSize(new Vector3()).multiplyScalar(.5);
  if(Math.min(radius.x,radius.y,radius.z)>.0001)result.push(collider(mesh,box.getCenter(new Vector3()),radius));
 }
 cache.set(actor,result);return result;
}
export function preventBodyClipping(actor,air=0){
 if(!actor._rig)return;
 const colliders=volumes(actor),scale=actor.mesh.getWorldScale(local).y;
 for(const c of colliders){c.bone.localToWorld(c.world.copy(c.center));c.scale??=new Vector3();c.bone.getWorldScale(c.scale);c.bone.getWorldQuaternion(c.q);c.inv.copy(c.q).invert();}
 const limbs=actor._rig.limbs;
 for(let i=0;i<limbs.length;i++){
  const limb=limbs[i],other=limbs[1-i];
  // Project the moving forearm and hand away from the other arm and both thighs.
  // Solve these first so that face and torso clearance have final priority.
  for(const part of [limb.forearm,limb.hand]){
   const pivot=part.parent;
   for(const [a,b,radius] of [[other.forearm,other.hand,.077],[other.hand,other.palm,.065],[limb.thigh,limb.shin,.102],[other.thigh,other.shin,.102]]){
    const p=part.getWorldPosition(new Vector3()),u=a.getWorldPosition(new Vector3()),v=b.getWorldPosition(new Vector3()).sub(u);
    const along=Math.max(0,Math.min(1,normal.copy(p).sub(u).dot(v)/Math.max(1e-10,v.lengthSq())));
    normal.copy(p).sub(u.addScaledVector(v,along));const depth=radius*scale-normal.length();if(depth<=0)continue;
    if(normal.lengthSq()<1e-10)normal.set(i?1:-1,0,0);else normal.normalize();
    pivot.getWorldPosition(joint);axis.copy(p).sub(joint);const length=axis.length();axis.cross(normal);
    if(axis.lengthSq()>1e-10){pivot.parent.getWorldQuaternion(basis).normalize();axis.normalize().applyQuaternion(basis.invert());pivot.quaternion.premultiply(delta.setFromAxisAngle(axis,Math.min(.28,depth/Math.max(.01,length)))).normalize();}
   }
  }
  for(let pass=0;pass<7;pass++){
   let moved=false;
   for(const [part,end,pad] of [[limb.arm,limb.forearm,.043],[limb.forearm,limb.hand,.043],[limb.hand,limb.palm,.060]]){
    const pivot=part===limb.arm?part:part.parent;
    for(const f of [.4,.75,1]){
     part.getWorldPosition(point);end.getWorldPosition(local);point.lerp(local,f);
     for(const c of colliders){
      local.copy(point).sub(c.world).applyQuaternion(c.inv).divideScalar(scale);
      const clearance=c===colliders[0]?pad+.058:pad;
      const rx=c.radii.x*c.scale.x/scale+clearance,ry=c.radii.y*c.scale.y/scale+clearance,rz=c.radii.z*c.scale.z/scale+clearance;
      const d=Math.hypot(local.x/rx,local.y/ry,local.z/rz);if(d>=1||d<1e-6)continue;
      normal.set(local.x/(rx*rx),local.y/(ry*ry),local.z/(rz*rz)).normalize().applyQuaternion(c.q);
      pivot.getWorldPosition(joint);axis.copy(point).sub(joint);const length=axis.length();axis.cross(normal);if(axis.lengthSq()<1e-10)continue;
      pivot.parent.getWorldQuaternion(basis).normalize();axis.normalize().applyQuaternion(basis.invert());
      delta.setFromAxisAngle(axis,Math.min(.25,(1-d)*Math.min(rx,ry,rz)*scale/Math.max(.01,length)*1.5));
      pivot.quaternion.premultiply(delta).normalize();moved=true;break;
     }
    }
   }
   if(!moved)break;
  }
 }
 settleFeet(actor,air);
}