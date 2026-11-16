import {Vector3,Quaternion} from 'three';
import {preventBodyClipping} from './body-collision.js';
import rows from './motions/style-study.json' with {type:'json'};
const clamp=v=>Math.max(0,Math.min(1,v));
function ease(t,a,b){const v=clamp((t-a)/(b-a));return v*v*(3-2*v);}
const neutral=new WeakMap();
function face(actor,lid,gaze,pupil,mouth,red=0){
 for(const eye of actor._eyes){
  if(!neutral.has(eye))neutral.set(eye,eye.scale.y);
  eye.scale.y=neutral.get(eye)*lid;
  for(const i of [1,2,5]){
   const part=eye.children[i];
   if(!part)continue;
   if(!neutral.has(part))neutral.set(part,{x:part.position.x,scale:part.scale.clone()});
   const base=neutral.get(part);part.position.x=base.x+gaze;
   part.scale.copy(base.scale).multiplyScalar(i===1?1:pupil);
  }
  const white=eye.children[0];if(white){white.userData.restColor??=white.material.color.clone();white.material.color.copy(white.userData.restColor);if(red)white.material.color.lerp({r:1,g:.54,b:.5},.6);}
 }
 actor._mouth.scale.copy(actor._mouthBaseScale);actor._mouth.scale.y*=mouth;
}
// Solve in character space, then convert each world orientation to its parent's space.
function shield(actor,side,s,weight){
 const j=actor._rig.joints,upper=j[side+'Arm'],lower=j[side+'ForeArm'],hand=j[side+'Hand'];
 actor.mesh.updateMatrixWorld(true);
 const start=upper.getWorldPosition(new Vector3()),target=j.Head.localToWorld(new Vector3(-s*.046,-.044+s*.022,.206+s*.017));
 const direction=target.clone().sub(start),length=direction.length();direction.normalize();
 const l1=lower.position.length(),l2=hand.position.length(),d=Math.min(length,l1+l2-.001);
 const along=(l1*l1-l2*l2+d*d)/(2*d);
 const pole=new Vector3(s,-.28,.12);pole.addScaledVector(direction,-pole.dot(direction)).normalize();
 const elbow=start.clone().addScaledVector(direction,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
 const down=new Vector3(0,-1,0);
 const q1=new Quaternion().setFromUnitVectors(down,elbow.clone().sub(start).normalize());
 const q2=new Quaternion().setFromUnitVectors(down,target.clone().sub(elbow).normalize());
 upper.quaternion.identity().slerp(upper.parent.getWorldQuaternion(new Quaternion()).invert().multiply(q1),weight);
 lower.quaternion.identity().slerp(q1.clone().invert().multiply(q2),weight);
 const palm=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI*.93);
 hand.quaternion.identity().slerp(q2.clone().invert().multiply(palm),weight);
}
export function sampleStudy(actor,id,t){
 const j=actor._rig.joints,R=actor._rig.R;
 const rot=(name,x=0,y=0,z=0)=>j[name].rotation.set(x,y,z);
 if(id==='A02'){
  const turn=ease(t,1.22,1.50),detect=t>=2.1,lean=ease(t,3.1,3.58);
  rot('Neck',0,-.42+.80*turn);rot('Head',.04,.44*turn-.22);rot('Spine2',lean*.28);
  face(actor,.87,-.012+.024*ease(t,1.04,1.11),detect?.42:1,1);
 }else if(id==='A15'){
  const swing=Math.tanh(3*Math.sin(t*5));
  rot('Hips',0,.37*swing,.09*swing);rot('Spine',0,-.37*swing,-.09*swing);
  rot('Head',-.14,0,.12);face(actor,.065,0,1,1.5+.16*Math.sin(t*5));
  for(const [side,s] of [['Left',1],['Right',-1]]){
   rot(side+'UpLeg',0,-.33*swing,-.08*swing);rot(side+'Arm',.04,0,s*.08);rot(side+'ForeArm',-.14);
  }
 }else if(id==='A21'){
  const u=t%3,fall=ease(u,1.82,1.95)*(1-ease(u,2.29,2.38)),wake=ease(u,2.29,2.38)*(1-ease(u,2.64,3));
  rot('Spine',.24*fall,0,.115*Math.sin(u*3.4)*(1-ease(u,1.62,1.82)));
  rot('Neck',.43*fall-.10*wake);rot('Head',.57*fall-.12*wake);
  face(actor,.64-.56*ease(u,1.4,1.95)+1.34*wake,0,1,1+fall,.75);
 }else{
  const cover=ease(t,.68,.91),move=ease(t,1.15,3.42),beat=Math.sin((t-1.15)*22)*ease(t,1.15,1.32)*(1-ease(t,3.22,3.42));
  j.Hips.position.set(9*move*R,(.86-.12*cover+.025*Math.abs(beat))*R,0);
  rot('Spine',.19*cover,0,.09*cover);rot('Neck',.60*cover,.55*cover);rot('Head',.67*cover,.67*cover);
  for(const [side,s] of [['Left',1],['Right',-1]]){
   rot(side+'UpLeg',-.28*cover-.16*s*beat,0,s*.28*cover+.38*beat);
   rot(side+'Leg',.45*cover+.24*s*beat);rot(side+'Foot',-.2*cover,0,-.30*beat);
   shield(actor,side,s,cover);
  }
  face(actor,1+.28*cover,0,.68,1+2*cover);
 }
}
export const study={catalog:new Map(rows.map(r=>[r.id,{...r,tracks:[r.id]}])),sample(a,id,t){sampleStudy(a,id,t);preventBodyClipping(a);}};
