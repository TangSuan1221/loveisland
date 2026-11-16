export const dramaticScenes={
 S81_slap_mediation:{marks:[[-.58,0],[.58,0],[0,-1.5]],description:'甲扇乙，乙回扇。丙赶到两人之间，摊开双臂劝停。',acceptance:'两次掌击方向相反，丙在回扇后进入两人之间。'},
 S45_fight_three_way:{marks:[[-.53,.02],[.53,.02],[1.2,-.22]],description:'A 抢步推 B，B 踉跄后回推。C 从侧面赶来，挤到两人之间，张臂护住 B。',acceptance:'能看见两次方向相反的推搡，各自带出退步；最后 C 的身体隔开 A、B。'},
 S73_breakup:{marks:[[-.45,0],[.45,0]],description:'两人起初牵手。A 抽回手，低头告别。B 追伸一次，停在半空；A 已经转身。B 收手，两人分向离开。',acceptance:'开头有牵手，之后有一次落空的挽留。两人先后转身，末帧间距明显增大。'},
 S74_friendship_breaks:{marks:[[-.55,0],[.55,0]],description:'B 主动伸手求和，A 将伸来的手拨开，以掌截断交流，迅速背转离场。B 收回被拨开的手，抱臂背过身。',acceptance:'拨开和收手发生在同一拍；A 决绝离开，B 留在原地。'}
};
const tracks=new WeakMap();
export function registerDramaticTracks(performances){
 for(const [id,scene] of Object.entries(dramaticScenes))performances.get(id).tracks.forEach((track,role)=>tracks.set(track,{id,role,scene}));
}
export function sampleDramatic(a,track,t){
 const entry=tracks.get(track);if(!entry)return false;
 const {id,role}=entry,j=a._rig.joints;
 function ramp(start,end){const u=Math.max(0,Math.min(1,(t-start)/(end-start)));return u*u*(3-2*u);}
 const pulse=(a,b,c,d)=>ramp(a,b)-ramp(c,d);
 let x=0,z=0,yaw=role===0?1.48:-1.48,lean=0,head=0,step=0,cycles=2;
 function arm(side,pitch,bend,spread=.1,wrist=0,inward=0){
   const sign=side==='Left'?1:-1;
   j[side+'Arm'].rotation.set(pitch,sign*inward,sign*spread);
   j[side+'ForeArm'].rotation.x=-bend;
   j[side+'Hand'].rotation.x=wrist;
 }
 arm('Left',.07,.16);arm('Right',.07,.16);
 if(id==='S45_fight_three_way'){
   const push=pulse(.64,.89,1.12,1.55),hit=ramp(.88,1.2),counter=pulse(1.86,2.12,2.38,2.9),back=ramp(2.1,2.48),intervene=ramp(2.46,3.56);
   if(role===0){
     x=.49*push+.27*hit-.42*back;lean=.28*push-.32*pulse(2.1,2.33,2.55,3.05);
     for(const side of ['Left','Right'])arm(side,-.59-.99*push,.99-.91*push,.15,.8*push);
     step=push+.5*back;
   }else if(role===1){
     x=.34*hit-.53*counter+.12*intervene;
     lean=-.43*pulse(.88,1.17,1.48,1.85)+.32*counter;
     for(const side of ['Left','Right'])arm(side,-.56-1.04*counter,.92-.84*counter,.13,.78*counter);
     step=hit+.5*counter;
   }else{
     x=-1.17*intervene;z=.27*intervene;yaw=-1.5+1.37*intervene;
     for(const side of ['Left','Right'])arm(side,-.12,.19,.14+1.1*intervene,.38*intervene);
     step=intervene;head=.43*pulse(3.6,3.9,4.3,4.6);
   }
 }else if(id==='S73_breakup'){
   const pull=ramp(.82,1.09),reach=pulse(1.18,1.73,2.68,3.39);
   if(role===0){
     const turn=ramp(1.67,2.46);step=ramp(2.43,5.26);x=-.09*pull-.96*step;
     yaw-=2.9*turn;head=.31*pulse(.48,.85,2.56,3.24);
     j.LeftShoulder.position.y+=.075*(1-pull);
     arm('Left',-.86+.56*pull,.52+.96*pull-.99*turn,.04);
   }else{
     step=ramp(3.91,5.84);x=-.1*reach+.77*step;yaw+=2.91*ramp(3.32,3.98);
     head=.37*ramp(2.67,3.34);
     arm('Right',-.86-.54*reach+.95*ramp(2.67,3.4),.52-.4*reach,.04);
   }
 }else{
   const offer=ramp(.13,.62),swat=pulse(.79,1.02,1.19,1.51),recoil=ramp(1.02,1.32);
   if(role===0){
     step=ramp(1.96,4.1);x=.1*swat-1.09*step;yaw-=3.13*ramp(1.38,1.99);
     arm('Left',-.22-1.18*swat,.66-.48*swat,.08+.48*pulse(1.03,1.19,1.35,1.51),.9*swat);
     arm('Right',-.19-.78*pulse(1.08,1.23,1.62,1.92),.54,.15);
   }else{
     x=.16*recoil;yaw+=2.36*ramp(2.8,3.48);head=.24*recoil;
     arm('Right',-.13-1.18*offer+.88*recoil,.21+1.49*recoil,.12,.12,-.62*recoil);
     arm('Left',-.5*recoil,.15+1.55*recoil,.16,0,-.68*recoil);
   }
 }
 const facing=a.mesh.rotation.y;
 a._body.position.set(Math.cos(facing)*x-Math.sin(facing)*z,0,Math.sin(facing)*x+Math.cos(facing)*z);
 a._body.rotation.y=yaw-facing;
 j.Spine.rotation.x=lean;j.Head.rotation.x=head;
 const gait=Math.sin(cycles*2*Math.PI*step);
 for(const [side,sign] of [['Left',1],['Right',-1]]){
   j[side+'UpLeg'].rotation.x=-.48*gait*sign;j[side+'Leg'].rotation.x=.54*Math.max(0,gait*sign);
 }
 return true;
}
