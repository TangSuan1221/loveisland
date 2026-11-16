import {Vector3} from 'three';
import {applyPose} from '../../action-pose.js';

const ease = value => {
  const t = Math.min(1,Math.max(0,value));
  return t*t*(3-2*t);
};
const phase = (t,start,end) => ease((t-start)/(end-start));
const pulse = (t,start,end) => Math.sin(Math.PI*phase(t,start,end));

// A single performance clock spans the cuts. Feet never return to the starting mark on a reaction cut.
function sequence(rows,perform) {
  return rows.map(([fraction,kind,motion,fx,composition],i)=>({
    fraction,kind,motion,fx,composition,
    action(actors,p){perform(actors,fraction+p*((rows[i+1]?.[0]??1)-fraction));}
  }));
}
function lens(aimRole,along,side,height,aimY,screenX,screenY,fov,endAlong=along,endSide=side,endHeight=height) {
  return {aimRole,along,side,height,aimY,screenX,screenY,fov,endAlong,endSide,endHeight};
}
function lineOfAction([a,b]) {
  const p=a?.mesh.position,q=b?.mesh.position;
  if(!p||!q)return {x:1,z:0,gap:1.5};
  const dx=q.x-p.x,dz=q.z-p.z,gap=Math.hypot(dx,dz);
  return gap>.01 ? {x:dx/gap,z:dz/gap,gap} : {x:1,z:0,gap:1.5};
}
// Distance along the original conversation axis; positive lateral distance passes on the actor's left.
function travel(actor,axis,along,across,yawOffset=0) {
  if(!actor)return;
  actor.mesh.position.x+=axis.x*along-axis.z*across;
  actor.mesh.position.z+=axis.z*along+axis.x*across;
  actor.mesh.rotation.y+=yawOffset;
}
function pose(actor,from,to,mix,t) {
  if(actor?._head && actor._arms?.length===2 && actor._legs?.length===2 && actor._body)
    applyPose(actor,from,to,mix,t*6.1);
}
function stride(actor,progress,steps,magnitude=.48) {
  if(!actor?._legs)return;
  const swing=Math.sin(2*Math.PI*steps*progress);
  const gate=Math.min(1,progress*12,(1-progress)*12);
  actor._legs[0].rotation.x+=magnitude*swing*gate;
  actor._legs[1].rotation.x-=magnitude*swing*gate;
  actor.mesh.position.y+=.035*Math.abs(swing)*gate;
}
function elbow(actor,side,value) {
  const bone=actor?._rig?.joints?.[side+'ForeArm'];
  if(bone)bone.rotation.x+=value;
}
function glance(actor,turn,tilt=0) {
  if(actor?._head){actor._head.rotation.y+=turn;actor._head.rotation.x+=tilt;}
}

const apology=sequence([
  [0,'profile','still','none',lens('mid',-.65,3.9,.75,-.78,.46,.49,40)],
  [.31,'faceT','push','none',lens('T',-1.7,.97,-.25,-.27,.62,.44,39,-1.42,.8,-.18)],
  [.62,'wide','pull','none',lens('mid',.38,3.75,2.1,-.76,.42,.55,41,1.1,4.55,2.65)]
],([f,t],s)=>{
  const axis=lineOfAction([f,t]), retreat=phase(s,.51,.94), bow=pulse(s,.14,.55);
  travel(t,axis,.88*retreat,.20*retreat, .30*retreat);
  pose(t,'idle','bow',bow,s); elbow(t,'Right',-.44*bow);
  stride(t,retreat,2,-.39);
  pose(f,'idle','point',pulse(s,.01,.36)*.7,s);
  glance(f,-.13*retreat,.09*pulse(s,.52,.78));
});

const yieldPlace=sequence([
  [0,'wide','track','none',lens('mid',1.25,4.55,1.6,-.72,.36,.51,43,-.40,4.3,1.15)],
  [.44,'profile','track','none',lens('mid',-.9,3.8,-.33,-.88,.57,.48,42,-2.15,3.45,-.22)],
  [.78,'pair','still','warm',lens('mid',-2.15,3.95,.85,-.63,.59,.49,37)]
],([f,t],s)=>{
  const axis=lineOfAction([f,t]), clear=phase(s,.08,.43), pass=phase(s,.34,.94);
  // F steps fully out of the lane before T takes the vacated service mark.
  travel(f,axis,-.10*clear,.84*clear,-.75*clear);
  travel(t,axis,-Math.min(2,axis.gap*.90)*pass,-.17*Math.sin(Math.PI*pass));
  pose(f,'idle','offer',pulse(s,.05,.88)*.9,s);
  pose(t,'idle','nod',pulse(s,.17,.43),s);
  stride(f,clear,1,.32); stride(t,pass,3,.54);
});

const disagreement=sequence([
  [0,'insert','push','none',lens('F',.33,1.95,-1.03,-1.03,.38,.48,41,.41,1.65,-.98)],
  [.24,'faceF','still','impact',lens('F',1.13,.76,-.32,-.08,.39,.46,37)],
  [.47,'faceT','still','none',lens('T',-1.48,.40,.19,-.15,.69,.45,32)],
  [.72,'wide','still','cool',lens('mid',-.35,4.7,2.8,-.68,.50,.57,38)]
],([f,t],s)=>{
  const axis=lineOfAction([f,t]),first=pulse(s,.04,.50),reply=pulse(s,.35,.79);
  travel(f,axis,.22*first,.05*first);travel(t,axis,-.15*reply,-.07*reply);
  pose(f,'guard','point',first,s);pose(t,'guard','stop',reply,s);
  elbow(f,'Right',-.45*first);elbow(t,'Left',-.56*reply);
  glance(f,.17*reply);glance(t,-.15*first);
});

const avoidance=sequence([
  [0,'faceF','pull','none',lens('F',1.45,.92,.13,-.16,.29,.45,36,1.95,1.34,.21)],
  [.32,'wide','still','vignette',lens('T',-.52,5.4,1.72,-.67,.72,.47,48)],
  [.72,'profile','pull','cool',lens('T',-1.18,3.60,.06,-.48,.74,.46,44,-2.1,4.35,.18)]
],([f,t],s)=>{
  const axis=lineOfAction([f,t]),turn=phase(s,.12,.38),leave=phase(s,.32,.94);
  travel(f,axis,-1.65*leave,1.24*leave,2.38*turn);
  pose(f,'idle','retreat',pulse(s,.08,.49)*.62,s); stride(f,leave,3,.50);
  glance(f,-.46*pulse(s,.16,.46));pose(t,'idle','ask',pulse(s,.27,.75)*.79,s);
  glance(t,.29*leave,.09*leave);
});

const passCup=sequence([
  [0,'profile','push','none',lens('mid',-.43,3.13,-.29,-.70,.50,.54,39,-.20,2.58,-.35)],
  [.26,'insert','track','none',lens('hand',-.23,1.25,-.28,.01,.46,.50,33,-.30,1.17,-.22)],
  [.56,'faceT','still','none',lens('T',-1.68,.68,-.13,-.32,.57,.45,37)],
  [.78,'pair','arc','warm',lens('mid',.77,3.13,.19,-.60,.53,.46,40,1.46,2.92,.16)]
],([f,t],s)=>{
  const axis=lineOfAction([f,t]),offer=phase(s,.02,.39),receive=phase(s,.23,.57);
  const close=Math.min(.46,Math.max(0,(axis.gap-.91)/2));
  travel(f,axis,close*offer,.07*offer);travel(t,axis,-close*receive,-.06*receive);
  // First both palms meet; after the cut the giver recovers while the receiver draws the cup to the chest.
  const draw=phase(s,.56,.80);
  const giving=f?._rig?.joints?.RightArm??f?._arms?.[0];
  const holding=t?._rig?.joints?.RightArm??t?._arms?.[0];
  if(giving){giving.rotation.x=-.34-.89*offer+.90*draw;giving.rotation.z=.11+.08*offer;}
  if(holding){holding.rotation.x=-.12-1.04*receive+.40*draw;holding.rotation.z=.09;}
  elbow(f,'Right',-.33*offer+.16*draw);
  elbow(t,'Right',-.40*receive-.61*draw);
  const freeHand=t?._rig?.joints?.LeftArm;
  if(freeHand)freeHand.rotation.x-=.67*receive;
  elbow(t,'Left',-.57*receive);glance(t,0,.15*pulse(s,.28,.85));
  glance(f,-.09*pulse(s,.34,.76));stride(f,offer,1,.28);stride(t,receive,1,.30);
  // Both carry on the right; facing one another places those wrists on opposite sides.
  // Let the receiver step across with the advancing foot and meet the cup, then recover on the reverse.
  const giverHand=f?._rig?.joints?.RightHand, receiverHand=t?._rig?.joints?.RightHand;
  if(giverHand && receiverHand) {
    const delta=giverHand.getWorldPosition(new Vector3()).sub(receiverHand.getWorldPosition(new Vector3()));
    const meet=phase(s,.18,.50)*(1-.84*phase(s,.59,.88));
    const limit=Math.min(1,.64/(Math.hypot(delta.x,delta.z)||1));
    t.mesh.position.x+=meet*limit*delta.x;
    t.mesh.position.z+=meet*limit*delta.z;
  }
});

for(const shot of passCup)shot.cupRole=shot.fraction<.56?'F':'T';

const company=sequence([
  [0,'faceT','still','cool',lens('T',-1.48,1.04,.48,-.24,.71,.56,35)],
  [.34,'pair','arc','none',lens('mid',1.35,3.46,.44,-.59,.67,.52,40,-.55,3.14,.12)],
  [.67,'profile','pull','warm',lens('mid',-.67,2.95,.05,-.53,.42,.49,39,-1.29,3.69,.15)]
],([f,t],s)=>{
  const axis=lineOfAction([f,t]),approach=phase(s,.10,.53),rise=phase(s,.48,.93);
  const close=Math.max(0,Math.min(1.1,axis.gap-.75));
  travel(f,axis,close*approach,.44*approach,.63*approach);
  travel(t,axis,-.08*rise,.07*rise,-.34*rise);
  pose(t,'mourn','nod',rise,s);
  pose(f,'idle','ask',pulse(s,.26,.86)*.75,s);
  elbow(f,'Left',-.69*pulse(s,.32,.84));
  stride(f,approach,2,.38);glance(t,-.28*rise);
});

export default {
  'queue-apology':apology, 'queue-yield':yieldPlace,'queue-argue':disagreement,
  'queue-avoid':avoidance,'water-shared':passCup,supported:company
};
export {lens,sequence,lineOfAction,pose,phase,travel,stride,glance,elbow};
