import {Vector3} from 'three';
import {placePalm} from './chest-contact.js';

// End points for sharing objects are defined once in the space between
// performers. Both roles use root positions, independent of sampling order.
const exchange=new Set([70,71,73,74,97,107,118,119,121,125,126,138,139,158,159,163,164,173]);
export function partnerContact(a,num,t,other){
  if(!other||(!exchange.has(num)&&num!==140))return;
  const p=a.mesh.getWorldPosition(new Vector3()),q=other.mesh.getWorldPosition(new Vector3());
  const delta=q.clone().sub(p);delta.y=0;
  const distance=delta.length();if(distance<.01||distance>2.5*a.mesh.getWorldScale(new Vector3()).y)return;
  delta.normalize();
  const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
  const hold=smooth((t-.3)/1.35)*(1-smooth((t-4.55)/1.25));
  const bodyScale=a.mesh.getWorldScale(new Vector3()).y;
  const desired=num===140?.48:.64;
  const approach=Math.max(0,(distance-desired*bodyScale)*(num===140?1:.5))*hold;
  const facing=Math.atan2(delta.x,delta.z)-a.mesh.rotation.y;
  a._body.rotation.y+=Math.atan2(Math.sin(facing),Math.cos(facing))*hold;
  const body=a._body,origin=body.getWorldPosition(new Vector3());
  body.position.copy(body.parent.worldToLocal(origin.addScaledVector(delta,approach)));
  const level=(num===97||num===138||num===139)?.85:1.09;
  const target=p.clone().lerp(q,.5);
  target.y=(p.y+q.y)*.5+level*bodyScale;
  if(num===140){
    // At a seated patient's mouth. Use the body proportions even if their
    // skeleton has yet to be sampled this frame.
    target.copy(q).addScaledVector(delta,-.16*bodyScale);
    target.copy(other._mouth.getWorldPosition(new Vector3())).addScaledVector(delta,-.065*bodyScale);
  }
  const side=[70,74,125,139,140,159,164].includes(num)?'Right':'Left';
  const j=a._rig.joints,chest=j.Spine2;
  const palm=j[side+'Hand'].localToWorld(new Vector3(0,-.055*a._rig.R,.015*a._rig.R));
  target.addScaledVector(delta,-.028*bodyScale);
  if(num===173)target.z+=.065*bodyScale;
  const targetLocal=chest.worldToLocal(palm.lerp(target,hold));
  placePalm(a,side,targetLocal,new Vector3(side==='Left'?-.23:.23,-.19,.92));
  if(num===173){
    const otherPoint=target.clone();otherPoint.z-=.13*bodyScale;
    const free=j.RightHand.localToWorld(new Vector3(0,-.055*a._rig.R,.015*a._rig.R));
    placePalm(a,'Right',chest.worldToLocal(free.lerp(otherPoint,hold)),new Vector3(.23,-.19,.92));
  }
}
