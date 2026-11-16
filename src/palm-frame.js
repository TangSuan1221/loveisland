import {Matrix4,Quaternion,Vector3} from 'three';

const down=new Vector3(0,-1,0),zAxis=new Vector3(0,0,1);
const profiles=new WeakMap();
const up=new Set('bowl offer ask open show invite comfort cradle catch take feed return'.split(' '));
const inward=new Set('chest belly hug folded cheek mouth brow temple pocket hip'.split(' '));
const horizontal=new Set('floor knee board stir tool chop hang dig point reach pushdown'.split(' '));
const forward=new Set('stop push guard wave'.split(' '));
const facingEachOther=new Set('clap rub book cloth carry cup'.split(' '));
const special={
  12:['floor','floor'],13:['knee','knee'],19:['cup','cheek'],24:['push','push'],25:['loose','brow'],28:['rub','rub'],30:['chest','point'],31:['cheek','cheek'],32:['hug','hug'],33:['hug','hug'],34:['chest','loose'],35:['chest','loose'],41:['mouth','point'],
  72:['carry','carry'],81:['clap','clap'],105:['hug','hug'],108:['floor','floor'],109:['folded','folded'],125:['cheek','knee'],139:['bowl','bowl'],151:['rub','rub'],157:['cloth','cloth'],161:['cloth','cloth'],173:['offer','take'],187:['cradle','cradle'],
  199:['loose','cup'],200:['bowl','tool'],201:['loose','tool'],202:['folded','point'],203:['cradle','carry'],204:['folded','folded'],205:['loose','reach'],206:['carry','carry'],207:['push','push']
};
export function beginPalmPose(a,n,t,left='loose',right='loose'){
  const profile=special[n]??[left,right];
  profiles.set(a,{n,t,profile});
}
function normalFor(a,side,frame){
  const sign=side==='Left'?1:-1,ctx=profiles.get(a);
  let key=ctx?.profile[sign===1?0:1]??'loose';
  if(ctx?.n===202&&ctx.t>2.65)key='folded';
  if(ctx?.n===207&&ctx.t>2.55)key='loose';
  let v;
  if(up.has(key))v=new Vector3(-sign*.18,1,.16);
  else if(inward.has(key))v=new Vector3(-sign*.23,-.05,-1);
  else if(horizontal.has(key))v=new Vector3(-sign*.16,-1,.12);
  else if(forward.has(key))v=new Vector3(-sign*.08,.09,1);
  else if(facingEachOther.has(key))v=new Vector3(-sign,.07,.04);
  else v=new Vector3(-sign,.02,.16);
  if(ctx?.n===161)v.applyAxisAngle(new Vector3(sign,0,0),.58*Math.sin(ctx.t*4));
  // Free gestures follow the changing forearm plane. Contact gestures retain
  // their surface normal, so a braced palm doesn't swivel against the object.
  if(['loose','swing','trail','wide','invite','show','open','wave'].includes(key)){
    const fore=a._rig.joints[side+'ForeArm'];
    const tangent=down.clone().applyQuaternion(fore.getWorldQuaternion(new Quaternion())).applyQuaternion(frame.clone().invert());
    v.applyAxisAngle(new Vector3(0,1,0),sign*.45*tangent.z);
    v.y+=.24*tangent.x;
  }
  return v.normalize().applyQuaternion(frame);
}
// Local -Y follows the fingers; local +Z is the side the fingers curl toward.
// A single direction cannot specify both axes. Preserve the tangent direction
// while aligning the palm surface, with a deterministic lateral fallback.
export function palmFrame(a,side,fingers,frame){
  const normal=normalFor(a,side,frame);
  const f=fingers.clone().addScaledVector(normal,-fingers.dot(normal));
  if(f.lengthSq()<.025){
    const fallback=new Vector3(0,0,1).applyQuaternion(frame);
    if(Math.abs(fallback.dot(normal))>.9)fallback.copy(down).applyQuaternion(frame);
    f.addScaledVector(fallback,.4).addScaledVector(normal,-.4*fallback.dot(normal));
  }
  const y=f.normalize().negate(),x=new Vector3().crossVectors(y,normal).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,new Vector3().crossVectors(x,y)));
}
export function distributePalm(a,side,desired){
  const j=a._rig.joints,fore=j[side+'ForeArm'],hand=j[side+'Hand'];
  const parent=fore.getWorldQuaternion(new Quaternion());
    const finger=down.clone().applyQuaternion(desired),axis=down.clone().applyQuaternion(parent);
  const normal=zAxis.clone().applyQuaternion(desired);
  const projected=axis.clone().addScaledVector(normal,-normal.dot(axis));
  if(projected.lengthSq()>.0001){
    projected.normalize();
    const signed=Math.atan2(normal.dot(finger.clone().cross(projected)),finger.dot(projected));
    const allowance=Math.acos(Math.min(1,Math.cos(1.25)/Math.max(.0001,axis.dot(projected))));
    const turn=Math.sign(signed)*Math.max(0,Math.abs(signed)-allowance);
    desired.premultiply(new Quaternion().setFromAxisAngle(normal,turn));
  }
  finger.copy(down).applyQuaternion(desired);
  const bend=finger.angleTo(axis);
  if(bend>1.25){
    const correction=new Quaternion().setFromUnitVectors(finger,axis);
    desired.premultiply(new Quaternion().slerp(correction,1-1.25/bend));
  }
  const relative=parent.invert().multiply(desired);
  // Extract the axial component. Pronation/supination belongs primarily to
  // the forearm; rolling about its long axis leaves the elbow and wrist fixed.
  if(relative.w<0)relative.set(-relative.x,-relative.y,-relative.z,-relative.w);
  const roll=Math.max(-1.35,Math.min(1.35,2*Math.atan2(relative.y,relative.w)*.72));
  fore.rotateY(roll);
  hand.quaternion.copy(fore.getWorldQuaternion(new Quaternion()).invert().multiply(desired));
}
export function posePalms(a){
  if(a._rig.limbs[0].hand.matrixAutoUpdate===false)return;
  const j=a._rig.joints,frame=j.Spine2.getWorldQuaternion(new Quaternion());
  for(const side of ['Left','Right']){
    const hand=j[side+'Hand'],current=hand.getWorldQuaternion(new Quaternion());
    const fingers=down.clone().applyQuaternion(current);
    distributePalm(a,side,palmFrame(a,side,fingers,frame));
  }
}
