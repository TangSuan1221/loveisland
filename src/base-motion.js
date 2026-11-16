import {sampleSlap,sampleSlapMediation} from './slap-motion.js';
import {clearActionFace,sampleActionFace,sceneMood,reactionAt} from './action-face.js';
import {jumpClearance,plantSteps} from './foot-ground.js';
import {beginPalmPose,posePalms} from './palm-frame.js';
import {partnerContact} from './partner-contact.js';
import {applyHandTargets} from './hand-targets.js';
import {chestContact} from './chest-contact.js';
import {registerDramaticTracks,sampleDramatic,dramaticScenes} from './dramatic-scenes.js';
import {clearWorkObjects,showWorkObjects} from './island-work-objects.js';
import {sampleIslandWork} from './island-work-motion.js';
import assets from './motions/base-assets.json' with {type:'json'};

import score from './motions/base-score.js';
import {sampleAuthored} from './authored-motion.js';
import {performances} from './action-catalog.js';
import {preventBodyClipping} from './body-collision.js';

registerDramaticTracks(performances);
const dramaticTracks=new Set(Object.keys(dramaticScenes).flatMap(id=>performances.get(id).tracks));
const lookup=new Map(),trackContext=new Map();
for(const [id,entry] of performances)entry.tracks.forEach((tr,role)=>trackContext.set(tr,{id,role}));
for(const [id,entry] of performances)entry.tracks.forEach((track,i)=>lookup.set(track,assets.roles[id]?.[i]));
const slapScenes = new Set(['S04_fight_after_hunger', 'S18_fight_over_food']);
const splitCupTracks=new Set(performances.get('S15_drink_together').tracks);
const delayedDiscovery=performances.get('S48_steal_medicine').tracks[1];
const restored={1:'A01',40:'A27',48:'play',49:'play'};
const rest=new WeakMap(),active=new WeakSet();
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=(t,a,b)=>{const v=clamp((t-a)/(b-a));return v*v*(3-2*v);};
const {sin,cos,PI}=Math;
function capture(a){
 const bones=Object.values(a._rig.joints);
 const objects=[a._head.getObjectByName('hair'),...bones,a._body,a._head,a._mouth,...a._eyes,...a._eyes.flatMap(e=>e.children)];
 return objects.filter(Boolean).map(o=>[o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);
}
function neutral(a){
 clearActionFace(a);
 clearWorkObjects(a);

 let state=rest.get(a);
 if(!state){state=capture(a);rest.set(a,state);}
 for(const eye of a._eyes){const white=eye.children[0];if(white?.userData.restColor)white.material.color.copy(white.userData.restColor);}
 for(const [o,p,q,s] of state){o.position.copy(p);o.quaternion.copy(q);o.scale.copy(s);}
 // Game locomotion may have applied its own pose before this actor first performed.
 for(const b of Object.values(a._rig.joints))if(!b.name.includes('Thumb'))b.quaternion.identity();
 a._body.position.set(0,0,0);a._body.rotation.set(0,0,0);a._head.rotation.set(0,0,0);
 a._rig.joints.Hips.position.set(0,.86*a._rig.R,0);
}
export function releaseBase(a){if(active.delete(a))neutral(a);}
export function initializeBase(a){if(a._rig&&!rest.has(a))rest.set(a,capture(a));}
// Forward pitch, lateral lean, hip offset, knee flexion, shoulder yaw.
const stances={
 stand:[0,0,0,.08,0],slump:[.22,-.08,-.03,.17,.05],weight:[.04,.12,.055,.14,-.15],hunch:[.56,.03,0,.29,0],pitch:[.35,-.03,.025,.23,-.08],brake:[-.36,-.06,0,.36,0],drag:[.26,.05,0,.31,0],sprint:[1.22,0,0,.5,0],flat:[.14,.02,0,.19,1.28],sit:[.15,.06,0,1.47,0],rise:[.42,0,0,1.28,0],sprawl:[-1.05,.28,.03,1.65,.2],arch:[-.75,-.07,0,.28,0],crouch:[.5,0,0,1.02,0],board:[.32,0,0,.03,0],limp:[.4,.27,0,.53,0],lunge:[.53,-.15,.065,.84,.27],back:[-.18,.06,-.035,.22,-.25],rigid:[-.045,0,0,.025,0],brace:[.14,.08,.035,.38,-.26],stoop:[.93,0,0,.73,.05],squat:[.53,-.05,0,1.17,0]};
// Upper-arm pitch/spread, elbow flexion, wrist extension and palm twist, finger curl.
const arms={
 loose:[.04,.12,.12,0,0,.13],swing:[.13,.16,.19,.04,0,.15],trail:[.73,.18,.21,-.15,0,.21],reach:[-.99,.13,.32,.12,.06,.2],seam:[.02,.06,.07,0,0,.12],hip:[.12,.52,1.34,-.28,.52,.31],knee:[-.58,.15,.18,.2,.09,.21],wide:[-.41,1.12,.43,-.2,.32,.13],bowl:[-.53,.09,1.26,.3,1.04,.48],mouth:[-.63,.15,1.91,-.24,.18,.43],cup:[-.58,.13,1.03,-.21,.19,.76],temple:[-.95,.71,1.85,-.35,.24,.35],book:[-.53,.08,1.31,.16,.74,.54],high:[-2.43,.42,.48,-.2,.22,.18],pocket:[.01,.14,.4,-.1,.12,.72],toast:[-.72,.21,.66,.38,.67,.14],rub:[-.53,.02,1.29,.24,.75,.22],belly:[-.23,.14,1.13,-.26,.53,.39],claw:[-1.15,.19,.27,-.52,.1,.91],hug:[-.57,.17,1.62,-.24,.54,.42],guard:[-.74,.28,1.44,-.14,.4,.36],floor:[-.71,.31,.12,.18,.22,.39],wave:[-1.2,.84,1.26,.25,.48,.12],chop:[-.65,.34,.96,.08,.69,.24],open:[-.5,.52,.84,.18,1.08,.18],chest:[-.39,.14,1.53,-.16,.6,.36],show:[-.87,.29,1.12,.26,.95,.46],point:[-1.34,.18,.19,-.12,.36,.79],invite:[-.77,.57,.52,.14,1.31,.18],offer:[-.99,.13,.53,.27,1.14,.39],stop:[-1.02,.27,.43,.94,.15,.09],ask:[-.52,.36,1.09,.37,1.22,.14],tool:[-.72,.26,.95,-.19,.25,.94],comfort:[-.92,.48,.49,.36,.49,.25],wrist:[-.59,.13,1.4,.08,.84,.44],clap:[-.74,.21,1.07,.11,.93,.15],folded:[-.26,.06,.99,.18,.63,.3],cheek:[-.73,.26,1.78,-.26,.4,.27],brow:[-.94,.51,1.63,.38,.6,.14],carry:[-.24,.32,.66,-.12,.34,.89],board:[-.77,.24,.34,.39,.59,.13],stir:[-.74,.22,1.05,-.29,.46,.82],push:[-1.04,.34,.47,.81,.16,.12],cloth:[-.63,.49,.91,.07,.44,.71],cradle:[-.49,.29,1.21,.19,1.24,.33]};
const steps=new Set('walk rush start stop shuffle reverse sidle flee alongside retreat sneak patrol haul leave guide'.split(' '));
const accented=new Set('crash snatch land discover freeze interrupt resume assert rebut protect chop dig press plant stoke'.split(' '));
function apply(a,num,t){
 neutral(a);
 if(num>=199 && num<=207){beginPalmPose(a,num,t);sampleIslandWork(a,num,t);if(num!==207)posePalms(a);applyHandTargets(a,num,t);return;}
 if(restored[num]){sampleAuthored(a,performances.get(restored[num]).tracks[num===49?1:0],t/6);if(num===1){beginPalmPose(a,num,t);posePalms(a);}return;}
 const [stance,left,right,act]=score[num-1],j=a._rig.joints,R=a._rig.R;
 beginPalmPose(a,num,t,left,right);
 const rot=(name,x=0,y=0,z=0)=>j[name].rotation.set(x,y,z);
 let [pitch,lean,offset,bend,yaw]=stances[stance];
 let tempo=2.4,amp=.12,head=.06,look=.05,lid=.85,jaw=1,travel=0,sideways=0,scaleZ=1,scaleX=1;
 const hit=ease(t,.52,.68)*(1-ease(t,3.6,4.2)),wave=sin(t*3),late=ease(t,2.6,3.4);
 if(steps.has(act)){tempo=act==='rush'||act==='flee'?9:4.5;amp=.44;travel=.39*(t/6);if(act==='retreat'||act==='leave')travel*=-1;}
 if(accented.has(act)){amp=.36;pitch+=.24*hit;head+=.17*hit;tempo=4.6;}
 switch(act){
 case 'breathe':lid=.46;head=.17;j.Spine.scale.z=1+.04*sin(t*2.1);amp=.017;break;
 case 'start':pitch=.62*ease(t,.45,.61)-.32*ease(t,1,1.7);amp*=ease(t,.88,1.2);break;
 case 'stop':pitch=.43*ease(t,.8,1.3)-.71*ease(t,1.55,1.73)+.27*ease(t,2,2.35);amp*=1-ease(t,1.4,1.85);break;
 case 'rush':pitch-=1.42*ease(t,3.8,4.05);amp*=1-ease(t,3.7,4.2);break;
 case 'sidle':scaleZ=1-.53*hit;sideways=.52*ease(t,1,4.8);look=-.8;break;
 case 'reverse':yaw+=PI*ease(t,2.7,2.83);amp*=1-ease(t,1.5,1.6)+ease(t,2.91,3.1);lid=.55;break;
 case 'sigh':case 'wait':pitch+=.21*late;lid=.48;head=-.17+.26*late;jaw=1+.8*hit;break;
 case 'drop':bend*=ease(t,.92,1.14);pitch+=.27*ease(t,1.12,1.24);break;
 case 'strain':bend*=1-ease(t,.95,4.8);pitch+=.25*sin(PI*t/6);jaw=2;break;
 case 'rest':pitch=-1.42;lid=.09;jaw=2.7;break;
 case 'wake':pitch-=.44*ease(t,2,2.16);lid=.13+ease(t,2,2.16);break;
 case 'chew':tempo=9;jaw=1.2+.74*Math.abs(sin(9*t));head=.14+.05*sin(9*t);break;
 case 'gulp':pitch=-.97*hit;head=-.58*hit;jaw=1+.7*hit;break;
 case 'crash':bend+=.45*late;pitch+=.49*late;look=.09*sin(32*t);break;
 case 'read':case 'page':head=.42;look=.12*(2*((t*2)%1)-1);amp=act==='page'?.31:.025;break;
 case 'yawn':head=-.48*hit;jaw=1+4*hit;lid=.28;break;
 case 'wind':head=-.1;lid=.52;amp=.014;break;
 case 'hide':yaw=1.38*ease(t,.45,.59);head=.28;look=-.68;break;
 case 'shiver':tempo=30;amp=.13;pitch+=.055*sin(t*30);break;
 case 'rub':tempo=14;amp=.22;break;
 case 'hunger':scaleZ=.76;pitch+=.18*hit;lid=.37;jaw=2.3;break;
 case 'thirst':tempo=5;amp=.4;head=-.33;jaw=2.6;break;
 case 'thaw':{const relax=ease(t,.75,4.15);pitch=.56-.48*relax;bend=.29-.2*relax;lean=.03*(1-relax);yaw=0;offset=0;lid=.55+.33*relax;break;}
 case 'flee':case 'wince':lean+=.21*Math.abs(sin(6*t));lid=.29;jaw=2.1;break;
 case 'land':bend+=.51*hit;lean+=.48*late;head+=.18*Math.abs(sin(9*t))*late;break;
 case 'farewell':tempo=17;amp=.68;travel=-.65*t/6;jaw=1.35;break;
 case 'babble':tempo=8;amp=.71;jaw=1+.7*sin(5*t);break;
 case 'interrupt':amp=0;jaw=2.9-1.9*ease(t,4,4.18);look=.69*ease(t,2,4);lid=.65;break;
 case 'resume':amp=.07+.56*Number(t>1.4);jaw=t<1.4?1:2.4+.6*sin(t*8);break;
 case 'mourn':case 'remorse':head=.52;lid=.38;amp=.025;break;
 case 'sky':head=-.66;look=.27;break;
 case 'dance':case 'echo':tempo=6;amp=.55;lean+=.19*sin(t*6);break;
 case 'applause':tempo=12;amp=.29;break;
 case 'cheer':amp=.48;bend+=.25*Math.abs(wave);break;
 case 'rock':lean+=.13*wave;head=.32;break;
 case 'sing':case 'chorus':jaw=1.75+.69*sin(t*4);break;
 case 'stir':case 'wring':case 'scrub':tempo=7;amp=.4;break;
 case 'listen':case 'assent':case 'lookup':head+=.14*wave;break;
 case 'whisper':lean+=.25;jaw=1+.45*wave;break;
 case 'inspect':case 'search':case 'lay':case 'wipe':head=.37;look=.24*wave;break;
 case 'evade':case 'glance':case 'choose':look=-.62*hit;break;
 }
 // Supporting beats are authored per intention; gaze, weight and hand timing
 // remain independently scrubbable when a BP is inspected outside its scene.
 const approach=ease(t,.25,1.55),release=ease(t,3.45,4.8),hold=approach-release;
 let fingerGain=1;
 switch(act){
 case 'beckon':case 'invite':amp=.32;tempo=5;look=.25*hold;break;
 case 'explain':case 'converse':case 'introduce':jaw=1+.55*Math.abs(sin(5*t));amp=.25;look=.38*sin(1.3*t);break;
 case 'probe':case 'plead':case 'confess':lean+=.13*hold;head=.16;look=.22*(1-hold);amp=.17;jaw=1+.36*hold;break;
 case 'pass':case 'return':case 'offer':case 'feed':pitch+=.26*hold;amp=.06;fingerGain=1-.65*release;break;
 case 'release':case 'retract':pitch-=.3*release;sideways-=.18*release;fingerGain=1-release;break;
 case 'catch':case 'clutch':case 'conceal':fingerGain=.25+1.25*approach;pitch-=.16*late;look=.31*late;break;
 case 'decline':case 'dispute':case 'rebut':look=.36*sin(7*t)*hold;pitch-=.17*hold;break;
 case 'handoff':case 'join':case 'greet':case 'guide':look=.56*hold;lean+=.11*hold;break;
 case 'care':case 'soothe':case 'weak':lid=.54;head+=.34*hold;tempo=1.8;amp=.07;break;
 case 'track':case 'watch':case 'search':look=.72*sin(1.23*t);amp=.04;break;
 case 'remind':case 'compare':case 'swap':look=.46*Math.tanh(4*sin(1.65*t));head+=.18;break;
 case 'rain':case 'hang':case 'spread':head=-.53*hold;pitch-=.17*hold;break;
 case 'lift':case 'lower':case 'gather':bend+=(act==='lift'?.55*(1-approach):.55*hold);pitch+=.22*hold;fingerGain=.4+.8*approach;break;
 case 'treasure':case 'fit':case 'wrap':head=.39;look=.19*wave;amp=.06;break;
 case 'protect':case 'steady':case 'press':pitch+=.31*hold;bend+=.17*hold;break;
 case 'imitate':case 'teach':case 'chop':case 'dig':tempo=act==='imitate'?3.4:4.8;amp=.45;break;
 case 'tug':case 'haul':lean-=.22*hold;jaw=1+.5*hold;break;
 case 'lookup':case 'absorb':head=.42-.6*late;lid=.5+.36*late;break;
 case 'depart':case 'leave':yaw+=1.2*late;look=-.45*late;break;
 case 'hold':case 'freeze':case 'farewellStill':amp=.008;break;
 }
 // Keep weight changes and gaze readable at the island camera distance.
 amp*=.65;tempo*=.87;lean*=.74;
 const pulse=(start,end)=>ease(t,start,start+.35)*(1-ease(t,end,end+.5));
 const beat=sin(t*tempo),walk=steps.has(act)?amp:0;
 j.Hips.position.set((offset+sideways)*R,(.86-.79*(1-cos(bend)))*R,travel*R);
 rot('Hips',0,yaw,lean);rot('Spine',pitch*.53);rot('Spine2',pitch*.47);j.Spine.scale.z*=scaleZ;j.Spine.scale.x*=scaleX;
 rot('Neck',head*.48,look*.32);rot('Head',head*.52,look*.68);
 for(const [side,s,key] of [['Left',1,left],['Right',-1,right]]){
  let [shoulder,spread,elbow,wrist,twist,curl]=arms[key];
  const phase=sin(t*tempo+(s<0?2.66:0)),sweep=amp*phase;
  if(key==='trail')shoulder+=.53*(1-late);
  if(key==='clap'||key==='rub')spread+=sweep*.55;
  if(key==='hug'||key==='rub'||key==='clap'||key==='folded'||key==='cradle')twist+=.24;
  const cross=['hug','rub','clap','folded','cradle','belly','chest','mouth','cheek','brow'].includes(key)?-.59:0;
  rot(side+'Shoulder',0,0,s*(key==='high'?.26:key==='loose'?-.075:.035));
  rot(side+'Arm',shoulder+sweep*.63,s*cross,s*(spread+(key==='wave'?sweep*.64:0)));
  rot(side+'ForeArm',-elbow-sweep*(['dance','echo'].includes(act)?1.25:.45),s*.13,0);rot(side+'Hand',wrist+sweep*.58,s*(twist+sweep*.48),s*sweep*.35);
  for(const digit of ['Thumb','Index','Middle','Ring','Pinky'])for(let k=1;k<=3;k++)j[side+'Hand'+digit+k].rotation.x=-(key==='point'&&digit==='Index'?.05:curl)*fingerGain;
  rot(side+'UpLeg',-bend+s*walk*beat,0,s*(stance==='sprawl'?.94:stance==='brace'?.2:.045));rot(side+'Leg',2*bend+Math.max(0,-s*walk*beat));rot(side+'Foot',-bend-s*walk*beat);
 }
 for(const e of a._eyes)e.scale.y*=lid;
 a._mouth.scale.y*=jaw;
 const nod=Math.sin(t*4), sway=Math.sin(t*2.2);
 switch(num){
 case 2:{const lock=ease(t,2.8,3.15);rot('Head',.14*lock,.75*Math.sin(t*2.8)*(1-lock)+.4*lock);rot('Spine',.22*lock);break;}
 case 5:j.Hips.position.y+=.032*R*Math.abs(beat);break;
 case 7:rot('Spine',-.24*pulse(1,2)+.06*nod);rot('LeftFoot',-.22*pulse(.8,1.8));break;
 case 9:rot('Head',0,.85*pulse(1.85,2.8));break;
 case 10:rot('RightFoot',.21*Math.abs(Math.sin(t*5)));rot('Neck',-.16*pulse(1,2.5));break;
 case 12:for(const side of ['Left','Right'])rot(side+'Arm',.52*pulse(.2,1.55)-.3*late);break;
 case 14:case 15:rot('Head',-.17,0,.24);break;
 case 16:rot('RightForeArm',-.55-1.05*approach);break;
 case 17:rot('Head',.09+.15*Math.abs(nod));break;
 case 18:rot('Head',.23);break;
 case 19:rot('Head',-.52*hit);rot('LeftHand',-.32*hit);rot('RightArm',-.51-.58*late,-.45*late,.18);rot('RightForeArm',-1.52*late);break;
 case 20:rot('RightArm',-.88,.22,.28);rot('RightHand',.35+.36*Math.sin(t*9)*late,1.5*late);break;
 case 22:rot('RightHand',.15,.65*pulse(2,3.4));break;
 case 23:rot('Hips',0,0,.08*sway);rot('Spine',0,0,.12*sway);rot('RightArm',-.6,0,-.35);rot('RightForeArm',-.87+.29*nod);rot('RightHand',.22*nod);a._eyes.forEach(e=>e.scale.y*=.1);a._mouth.scale.y*=1.2+.34*nod;break;
 case 24:rot('LeftArm',-2.66,-.45,.12);rot('RightArm',-2.66,.45,-.12);break;
 case 25:rot('RightArm',-1.12,.24,-.47);rot('RightForeArm',-1.52);rot('LeftUpLeg',-.53);rot('LeftLeg',.8);break;
 case 26:rot('Hips',0,2.9*ease(t,.3,1.3));break;
 case 30:rot('LeftArm',-.65,-.28,.12);rot('LeftForeArm',-1.57);break;
 case 31:{const dip=pulse(1.8,2.18),rub=pulse(3.8,5);rot('LeftLeg',.03);rot('RightLeg',.03);rot('LeftUpLeg',-.02);rot('RightUpLeg',-.02);rot('Spine',.11+.07*sway);rot('Head',.46*dip-.22*pulse(2.6,3.4));a._mouth.scale.y*=1+1.1*pulse(2.6,3.4);for(const side of ['Left','Right']){rot(side+'Arm',-1.1*rub,0,(side==='Left'?1:-1)*.28);rot(side+'ForeArm',-.2-1.55*rub);rot(side+'Hand',.17*nod*rub);}break;}
 case 33:for(const side of ['Left','Right'])for(const finger of ['Index','Middle','Ring','Pinky'])for(let k=1;k<=3;k++)rot(side+'Hand'+finger+k,-.58*(1-late));break;
 case 35:rot('LeftLeg',.17);rot('LeftUpLeg',-.12+.11*beat);break;
 case 36:for(const [side,sign] of [['Left',1],['Right',-1]]){rot(side+'Arm',-2.5,0,sign*(.35+.21*nod));rot(side+'Hand',0,0,sign*.25*nod);}j.Hips.position.y+=R*.09*(pulse(2,2.25)+pulse(3.5,3.75));break;
 case 37:rot('RightArm',-1.3,0,-.78-.22*nod);break;
 case 38:rot('Head',.13*pulse(2.3,2.8));break;
 case 39:rot('Head',.23*Math.abs(nod)*(1-late));for(const side of ['Left','Right']){rot(side+'Arm',-.63,0,(side==='Left'?1:-1)*.26);rot(side+'ForeArm',-.9+.34*nod*late);rot(side+'Hand',.19*nod*late);}break;
 case 41:rot('LeftArm',-.87,-.4,.2);rot('LeftForeArm',-1.63);rot('RightArm',-.85-.55*late,.18,-.19);rot('RightForeArm',-1.6+1.46*late);break;
 case 42:rot('RightArm',-1.15,0,-.23);rot('RightForeArm',-.22);rot('Head',0,.64*ease(t,2.2,3.35));break;
 case 43:rot('RightHand',.17,.55*Math.sin(t*4)*(1-approach));rot('Spine',.14+.24*late);break;
 }
 posePalms(a);
 plantSteps(a,num,t);
 if(num<32 || num>35)applyHandTargets(a,num,t);
}
export function playBase(a,track,seconds,duration,partner){
 const context = trackContext.get(track);
 if (a._rig && (slapScenes.has(context?.id) || context?.id==='S81_slap_mediation')) {
   neutral(a);
   const t = clamp(seconds / duration) * 6;
   sampleActionFace(a, 0, t, {role: context.role, mood: context.role ? 'wary' : 'angry'});
   if(context.id==='S81_slap_mediation') sampleSlapMediation(a,context.role,t,partner);
   else sampleSlap(a, context.role, t, partner);
   preventBodyClipping(a);
   active.add(a);
   return true;
 }
 if(a._rig && dramaticTracks.has(track)){neutral(a);sampleDramatic(a,track,clamp(seconds/duration)*6);const {id,role}=trackContext.get(track);sampleActionFace(a,0,seconds,{role,mood:sceneMood(id,role),speech:role===0&&seconds<1.35,...reactionAt(id,role,seconds/duration)});active.add(a);preventBodyClipping(a);return true;}
 const ids=lookup.get(track);if(!a._rig||!ids?.length)return false;
 const frame=clamp(seconds/duration)*ids.length,index=Math.min(ids.length-1,Math.floor(frame));
 const num=Number(ids[index].slice(2));
 let local=(frame-index)*6;
 if(num===199){
   if(splitCupTracks.has(track)&&index===0)local*=.5;
   else local=3+local*.5;
 }
 if(track===delayedDiscovery)local=Math.max(0,Math.min(6,(seconds/duration-.27)*6/.73));
 apply(a,num,local);const {id,role}=trackContext.get(track);sampleActionFace(a,num,local,{role,...reactionAt(id,role,seconds/duration)});partnerContact(a,num,local,partner);active.add(a);preventBodyClipping(a,jumpClearance(num,local,a._rig.R));if(num>=32 && num<=35)chestContact(a,num,local);if(num>=199)showWorkObjects(a,num,local);return true;
}
export const baseReview={catalog:new Map(Object.entries(assets.poses).map(([id,r])=>[id,{id,label:r.name,description:r.description,acceptance:r.acceptance,tracks:[id]}])),sample(a,id,t){const num=Number(id.slice(2));apply(a,num,t);sampleActionFace(a,num,t);preventBodyClipping(a,jumpClearance(num,t,a._rig.R));if(num>=32 && num<=35)chestContact(a,num,t);if(num>=199)showWorkObjects(a,num,t);}};
