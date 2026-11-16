import {sampleActionFace,clearActionFace,sceneMood} from './action-face.js';
import {dramaticScenes} from './dramatic-scenes.js';
import {releaseAuthored,sampleAuthored} from './authored-motion.js';
import {playBase,releaseBase,initializeBase} from './base-motion.js';
import {preventBodyClipping} from './body-collision.js';
import {articulate} from './humanoid-rig.js';
import clips from './retargeted-motion.json' with {type:'json'};
import {performances} from './action-catalog.js';
import {playPhrase} from './action-pose.js';

export function playRetargeted(actor,name,seconds,weight=1) {
  const clip=clips[name];
  const pos=(seconds % clip.duration)/clip.duration*(clip.frames.length-1);
  const i=Math.floor(pos), a=clip.frames[i], b=clip.frames[i+1] || a;
  for(const [j,limb] of [...actor._arms,...actor._legs].entries()){
    for(const [offset,axis] of ['x','z'].entries()){
      let delta=b[j*2+offset]-a[j*2+offset];
      if(Math.abs(delta)>3142) delta-=Math.sign(delta)*6283;
      const angle=(a[j*2+offset]+delta*(pos-i))*.001;
      limb.rotation[axis]+=weight*(angle-limb.rotation[axis]);
    }
  }
}
export function performTrack(actor, track, seconds, duration, partner) {
  if(playBase(actor,track,seconds,duration,partner)){actor._articulated=true;return;}
  releaseBase(actor);
  if(sampleAuthored(actor,track,seconds/duration)){preventBodyClipping(actor);actor._articulated=true;return;}
  releaseAuthored(actor);
  const pose=playPhrase(actor,track,seconds,duration);
  const clip={step:'Walking',wave:'Wave',dance:'Dance'}[pose];
  if(clip) playRetargeted(actor,clip,seconds,.85);
  articulate(actor,pose,seconds);sampleActionFace(actor,0,seconds,{mood:sceneMood(pose,0),speech:pose==='talk'});preventBodyClipping(actor);actor._articulated=true;
  return pose;
}
const solo={drink:'A12',warm:'A19',watch:'A17',queue:'A08',interview:'A26'};
function relaxedArms(actor,walking,time){
  for(const [i,l] of actor._rig.limbs.entries()){
    const side=i?1:-1;
    const swing=walking?Math.max(-.40,Math.min(.40,-l.thigh.rotation.x*.63)):.022*Math.sin(time*1.6+actor._phase);
    l.arm.parent.rotation.set(0,0,0);
    l.arm.rotation.set(swing+.035,0,side*.12);
    l.forearm.rotation.set(-.16-Math.max(0,-swing)*.24,0,0);
    l.hand.rotation.set(0,0,0);
  }
}
export function updateActorPerformance(actor,state,scene,time,show,partner) {
  clearActionFace(actor);initializeBase(actor);
  actor._articulated=false;
  presentActor(actor,state,scene,time,show,partner);
  if(!actor._articulated){
    releaseBase(actor);
    articulate(actor,state?.moving?'walk':state?.gesture,time);
    preventBodyClipping(actor);
    if(actor._rig && (state?.moving || ['idle','waiting','observe'].includes(state?.activity) || !state))
      relaxedArms(actor,!!state?.moving,time);
    sampleActionFace(actor,0,time,{mood:sceneMood(state?.activity??'',0),speech:!!state?.speech});
  }
}
function presentActor(actor,state,scene,time,show,partner) {
  if(!state)return;
  // The live cast has already sampled opposite thigh swings in actor space.
  // Keep that gait as the reference for the opposite arm on each side.
  if(state.moving)return;
  const stageRole=show?.participants.indexOf(actor.id) ?? -1;
  if(show?.phase==='playing'&&stageRole>=0){
    performTrack(actor,performances.get(show.key).tracks[stageRole],show.elapsed,6,partner);
    const mark=dramaticScenes[show.key]?.marks[stageRole];
    if(mark&&show.stageCenter){
      const dx=show.stageCenter[0]+mark[0]-actor.mesh.position.x,dz=show.stageCenter[1]+mark[1]-actor.mesh.position.z;
      const angle=actor.mesh.rotation.y;
      actor._body.position.x+=Math.cos(angle)*dx-Math.sin(angle)*dz;
      actor._body.position.z+=Math.sin(angle)*dx+Math.cos(angle)*dz;
    }
    return;
  }
  if(state.activity==='idle' && state.actionResult){
    const {outcome,role}=state.actionResult;
    const responses={
      'feelings-declined':['shy','stop'],'mutual-feeling':['shy','nod'],
      'alliance-declined':['look','stop'],'borrow-declined':['look','guard'],
      'item-borrowed':['inspect','nod'],'item-returned':['nod','inspect'],
      'water-shared':['nod','drink'],'sharing-unavailable':['inspect','retreat'],
      'boundary-respected':['nod','retreat'],disagreed:['guard','retreat']
    };
    const response=responses[outcome]?.[role];
    if(response){
      performTrack(actor,[response],1,1);
      return;
    }
  }
  const task=state.attributes?.task;
  const practiceKey={gather:'S55_clear_land',hunt:'S76_scout_alone',cook:'S30_cook_together',build:'S43_build_wall',med:'S06_tend_sick',craft:'S25_teach_skill',combat:'contest',social:'chat'}[task?.kind];
  if(state.activity==='practice' && practiceKey){
    performTrack(actor,performances.get(practiceKey).tracks[0],time%6,6);
    return;
  }
  let role=scene?.participants?.indexOf(actor.id) ?? -1;
  const inScene=role>=0 && scene.phase!=='approach';
  const key=inScene?(scene.branch || (scene.kind==='mole-task'?'mole':scene.kind)):solo[state.activity];
  const entry=performances.get(key);
  if(!entry)return;
  const track=entry.tracks[Math.min(Math.max(0,role),entry.tracks.length-1)];
  const duration=inScene?(scene.branch?9:18):6;
  const seconds=inScene?Math.min(duration-.001,scene.elapsed || 0):time%duration;
  const actingTrack=(key==='resource-share' && role===1)?['look','ask','look']:track;
  performTrack(actor,actingTrack,seconds,duration,partner);
  if(state.voicePhrase?.expression && state.speech===state.voicePhrase.display){
    sampleActionFace(actor,0,seconds,{role,mood:state.voicePhrase.expression,speech:true});
  }
}
