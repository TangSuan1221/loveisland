import {sceneKey} from './emotion-stage.js';
import {previewProps,propAt} from '../catalog-props.js';
import {suspendActionFace,sampleActionFace,clearActionFace,sceneMood,reactionAt} from '../action-face.js';
import {settleFeet} from '../foot-ground.js';
import {sceneForEvent} from './catalog-scenes.js';

import {initializeBase,releaseBase} from '../base-motion.js';
import {releaseAuthored} from '../authored-motion.js';
import {Quaternion, Vector3} from 'three';
import {applyPose,playPhrase} from '../action-pose.js';
import {performances} from '../action-catalog.js';
import {performTrack,playRetargeted} from '../action-playback.js';
import {articulate} from '../humanoid-rig.js';
import {createPropModel} from '../action-props.js';

const smooth = x => { const t=Math.min(1,Math.max(0,x));return t*t*(3-2*t); };
const turn = angle => Math.atan2(Math.sin(angle),Math.cos(angle));

// Knots are authored on the event clock. Moving into a new camera setup never restarts a step.
// A knot describes time, pose, travel toward the partner, travel to the actor's right, and turn away.
const k = (time,pose,forward=0,side=0,yaw=0) => ({time,pose,forward,side,yaw});
const duets = {
  'mutual-feeling': [
    [k(0,'shy'),k(.23,'step',.18),k(.46,'offer',.22),k(.72,'shy',.23),k(1,'nod',.24)],
    [k(0,'look'),k(.32,'shy',-.08),k(.60,'step',.12),k(.78,'nod',.20),k(1,'joy',.22)]],
  'feelings-declined': [
    [k(0,'shy'),k(.25,'offer',.20),k(.56,'look',.20),k(.78,'guard',.08),k(1,'mourn',.02,0,.20)],
    [k(0,'look'),k(.34,'stop',-.13),k(.57,'retreat',-.35,.10,.35),k(1,'hide',-.39,.22,.65)]],
  reconciled: [
    [k(0,'guard'),k(.25,'bow',.05),k(.57,'step',.25),k(.80,'offer',.30),k(1,'nod',.32)],
    [k(0,'hide',0,0,-.28),k(.34,'look'),k(.58,'nod',.05),k(.83,'take',.18),k(1,'clap',.20)]],
  unresolved: [
    [k(0,'ask'),k(.30,'offer',.14),k(.62,'guard',.06),k(1,'look',-.12,-.25,-.65)],
    [k(0,'guard'),k(.37,'stop',-.02),k(.67,'retreat',-.23,.20,.49),k(1,'step',-.42,.38,1.05)]],
  disagreed: [
    [k(0,'ask'),k(.24,'point',.12),k(.57,'stop',.15),k(1,'guard',-.08,-.10)],
    [k(0,'look'),k(.26,'guard',-.13),k(.53,'point',.07),k(.76,'stop',.09),k(1,'retreat',-.16)]],
  connected: [
    [k(0,'wave'),k(.29,'point',0,.14,.40),k(.66,'step',.02,.38,.63),k(1,'look',.09,.59,.85)],
    [k(0,'look'),k(.28,'nod'),k(.58,'wave',.10,-.13,-.44),k(1,'step',.18,-.44,-.85)]],
  allied: [
    [k(0,'point'),k(.26,'step',.21),k(.49,'offer',.34),k(.76,'nod',.34),k(1,'point',.29,.14,.5)],
    [k(0,'inspect'),k(.35,'nod',.05),k(.55,'take',.26),k(.76,'clap',.23),k(1,'step',.20,-.12,-.50)]],
  'alliance-declined': [
    [k(0,'point'),k(.32,'offer',.22),k(.61,'ask',.17),k(1,'wipe',.03)],
    [k(0,'inspect'),k(.32,'guard',-.06),k(.55,'stop',-.16),k(1,'step',-.40,.38,1.32)]],
  'boundary-respected': [
    [k(0,'guard'),k(.25,'stop',-.12),k(.60,'look',-.05),k(1,'nod',-.05)],
    [k(0,'step',.09),k(.30,'stop',.07),k(.58,'retreat',-.36),k(1,'nod',-.40,-.08)]],
  'boundary-disagreed': [
    [k(0,'stop'),k(.30,'guard',-.12),k(.59,'point',-.12),k(1,'retreat',-.33,-.25)],
    [k(0,'look'),k(.27,'ask',.17),k(.58,'point',.23),k(1,'guard',.20)]],
  clarified: [
    [k(0,'inspect'),k(.27,'point',0,-.14,-.70),k(.50,'ask',.07,-.22),k(1,'nod',.13,-.12)],
    [k(0,'guard'),k(.31,'look',.10,.13,.63),k(.63,'inspect',.25,.13,.42),k(1,'nod',.18)]],
  'created-together': [
    [k(0,'kneel'),k(.30,'stir',.11),k(.53,'inspect',.15),k(.77,'offer',.14),k(1,'joy',0,-.15)],
    [k(0,'take'),k(.31,'kneel',.19),k(.58,'push',.22),k(.75,'inspect',.15),k(1,'clap',.05)]],
  'queue-apology': [
    [k(0,'stop'),k(.30,'bow',.04),k(.56,'retreat',-.24,.12),k(1,'step',-.59,.33,1.12)],
    [k(0,'guard'),k(.35,'look'),k(.63,'nod',.05),k(1,'step',.21,-.11)]],
  'queue-yield': [
    [k(0,'look'),k(.27,'retreat',-.09,.28),k(.47,'offer',-.08,.48),k(1,'wave',-.05,.51,.60)],
    [k(0,'ask'),k(.35,'nod'),k(.60,'step',.33,-.05),k(1,'step',.76,-.11)]],
  'queue-argue': [
    [k(0,'point'),k(.25,'step',.16),k(.44,'stop',.19),k(.72,'guard',.11),k(1,'point',.08)],
    [k(0,'guard'),k(.25,'ask',-.13),k(.48,'point',.07),k(.70,'stop',.15),k(1,'guard',.06)]],
  'queue-avoid': [
    [k(0,'look'),k(.25,'hide',-.07,.09,.40),k(.54,'step',-.24,.37,1.20),k(1,'step',-.53,.72,1.78)],
    [k(0,'ask'),k(.31,'offer',.12),k(.62,'look',.14,-.06,-.30),k(1,'wipe',.02)]],
  'water-shared': [
    [k(0,'inspect'),k(.20,'step',.16),k(.38,'offer',.34),k(.58,'offer',.36),k(.78,'nod',.15),k(1,'look',.07)],
    [k(0,'look'),k(.31,'ask',.06),k(.51,'take',.28),k(.68,'inspect',.22),k(.84,'drink',.15),k(1,'nod',.12)]],
  supported: [
    [k(0,'look'),k(.25,'step',.28,.07),k(.48,'kneel',.38),k(.74,'offer',.36),k(1,'nod',.29)],
    [k(0,'mourn'),k(.29,'wipe',-.08),k(.56,'look',-.04),k(.77,'take',.06),k(1,'nod',.10)]]
};

function snapshot(actor){
  const entries=[];
  actor.mesh.traverse(node=>entries.push({
    node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone(),visible:node.visible
  }));
  return ()=>{
    for(const {node,p,q,s,visible} of entries){
      if(!node.position.equals(p))node.position.copy(p);
      if(!node.quaternion.equals(q))node.quaternion.copy(q);
      if(!node.scale.equals(s))node.scale.copy(s);
      node.visible=visible;
    }
  };
}

function duetPose(player,track,fraction,seconds){
  const end=track.findIndex(key=>key.time>=fraction);
  const b=track[end<0?track.length-1:end],a=track[Math.max(0,(end<0?track.length-1:end)-1)];
  const u=a===b?0:Math.min(1,(fraction-a.time)/(b.time-a.time));
  const w=smooth(u),mix=(x,y)=>x+(y-x)*w;
  const actor=player.actor;
  const distance=mix(a.forward,b.forward)*player.maxApproach;
  const side=mix(a.side,b.side);
  actor.mesh.position.addScaledVector(player.direction,distance).addScaledVector(player.right,side);
  const start=actor.mesh.rotation.y;
  actor.mesh.rotation.y=start+turn(player.yaw-start)*smooth(seconds/.36)+mix(a.yaw,b.yaw);
  if(!actor._arms?.length||!actor._legs?.length||!actor._body)return;
  applyPose(actor,a.pose,b.pose,u,seconds);
  const walk=Math.hypot(b.forward-a.forward,b.side-a.side);
  if(walk>.14 && u>0 && u<1){
    // Use the existing walk cycle only for feet. The gesture above remains legible.
    const armAngles=actor._arms.map(limb=>limb.rotation.clone());
    playRetargeted(actor,'Walking',seconds,Math.min(.9,walk*2.8)*Math.sin(Math.PI*u));
    actor._arms.forEach((limb,i)=>limb.rotation.copy(armAngles[i]));
  }
  articulate(actor,b.pose,seconds);settleFeet(actor);
}

const cuePoses={
  sit:'sit',stand:'idle',turn:'look',step_in:'step',step_back:'retreat',hop:'joy',spin:'dance',
  lean_in:'ask',recoil:'guard',tremble:'cold',fall:'kneel',freeze:'guard',point:'point',offer:'offer',
  reach:'take',cover_face:'hide',slump:'mourn',walk_past:'step',kick:'guard',shiver:'cold',
  wipe:'wipe',play:'sing',dance:'dance',carry:'carry'
};
const daily={
  eat:['take','eat','nod'],drink:['take','drink','nod'],read:['take','read','look'],
  warm:['cold','offer','nod'],rest:['sit','sleep','look'],exercise:['stretch','step','stretch'],
  sing:['look','sing','wave'],watch:['step','look','nod'],queue:['step','look','guard'],
  walk:['look','step','step'],practice:['inspect','stir','wipe'],idle:['look','nod','idle']
};
const roles=['F','T','A'];
function sceneTrack(event,role){
  for(const key of [event.performanceKey,event.sceneId,event.sourceType,event.type,event.activity]){
    const tracks=performances.get(key)?.tracks;
    if(tracks)return tracks[role]||tracks[0];
  }
  return daily[event.activity] || (role===0?['look','ask','offer']:['look','nod','look']);
}
function skitPose(player,cast,role,cues,event,shot,ms){
  const {actor}=player;
  if(!actor._arms?.length||!actor._legs?.length||!actor._body||!actor._head)return;
  const seconds=ms/1000;
  let act,previous,mark;
  const root=cast[0];
  for(const cue of cues){
    if(cue.t>ms)break;
    if(cue.role!==roles[role])continue;
    if(cue.kind==='act'){previous=act;act=cue;}
    if(cue.kind==='move' && cue.to && root){
      const target=root.base.clone().addScaledVector(root.direction,cue.to[0]).addScaledVector(root.right,cue.to[1]);
      mark=(mark||player.base.clone()).lerp(target,smooth((ms-cue.t)/Math.max(1,cue.dur)));
    }
  }
  if(mark){actor.mesh.position.x=mark.x;actor.mesh.position.z=mark.z;}
  let pose;
  if(!act || (event.type==='routine' && daily[event.activity])){
    const track=sceneTrack(event,role);
    pose=playPhrase(actor,track,seconds,(shot.totalMs||6000)/1000);
  }else{
    const u=Math.max(0,Math.min(1,(ms-act.t)/Math.max(1,act.dur)));
    const w=smooth(u),beat=Math.sin(Math.PI*u),osc=Math.sin(seconds*17);
    pose=cuePoses[act.act]||'look';
    applyPose(actor,cuePoses[previous?.act]||'idle',pose,Math.min(1,2*u),seconds);
    switch(act.act){
      case 'turn': actor.mesh.rotation.y+=w*.74;break;
      case 'spin': actor.mesh.rotation.y+=w*Math.PI*2;break;
      case 'step_in': actor.mesh.position.addScaledVector(player.direction,.30*w);break;
      case 'step_back': actor.mesh.position.addScaledVector(player.direction,-.34*w);break;
      case 'walk_past': actor.mesh.position.addScaledVector(player.direction,.76*w).addScaledVector(player.right,.38*w);break;
      case 'hop': actor.mesh.position.y+=.19*beat;break;
      case 'lean_in': actor._body.rotation.x+=.18*w;break;
      case 'recoil': actor._body.rotation.x-=.20*beat;actor.mesh.position.addScaledVector(player.direction,-.15*w);break;
      case 'fall': actor._body.position.y-=.12*w;actor._body.rotation.z+=.74*w;break;
      case 'kick': actor._legs[0].rotation.x-=.88*beat;actor._arms[1].rotation.x-=.38*beat;break;
      case 'tremble': case 'shiver':actor._body.rotation.z+=.026*osc;actor._arms[0].rotation.x+=.035*osc;break;
    }
  }
  if(pose==='step'||pose==='dance')playRetargeted(actor,pose==='step'?'Walking':'Dance',seconds,.65);
  articulate(actor,pose,seconds);settleFeet(actor);
}
const smiles=new Set(['mutual-feeling','connected','reconciled','allied','created-together','queue-apology','water-shared']);
const refusals=new Set(['feelings-declined','alliance-declined','unresolved','queue-avoid']);
const conflicts=new Set(['disagreed','queue-argue','boundary-disagreed']);

// Facial ink is modeled as curved meshes laid against the skin. Bend a private
// copy of the mouth corners instead of scaling the whole face or writing into
// a user's appearance material. A baked paint layer is left untouched.
function prepareFace(actor,type) {
  const mouth=actor._mouth;
  if(!mouth || !(smiles.has(type)||refusals.has(type)||conflicts.has(type)||type==='supported'))return null;
  const brows=actor._head?.children.filter(child=>child.name==='brow')||[];
  const surfaces=[];
  mouth.traverse(node=>{
    const original=node.geometry;
    const positions=original?.getAttribute('position');
    if(!positions||positions.itemSize!==3)return;
    original.computeBoundingBox();
    const bounds=original.boundingBox;
    const width=bounds.max.x-bounds.min.x;
    // A separate chin line and facial decorations must keep their original shape.
    if(width<.042 || bounds.max.y<-.015 || width>.17)return;
    const geometry=original.clone(), vertices=geometry.getAttribute('position');
    const middle=(bounds.min.x+bounds.max.x)*.5,halfWidth=width*.5;
    const weights=new Float32Array(vertices.count);
    for(let i=0;i<weights.length;i++){
      const x=Math.min(1,Math.abs((positions.getX(i)-middle)/halfWidth));
      weights[i]=smooth((x-.26)/.74);
    }
    node.geometry=geometry;
    surfaces.push({node,original,geometry,vertices,positions,weights});
  });
  return {brows,surfaces,restore(){
    for(const surface of surfaces){surface.node.geometry=surface.original;surface.geometry.dispose();}
  }};
}

function express(player,type,role,fraction,seconds){
  const {actor,face}=player;
  if(!face)return;
  const beat=(at,width)=>smooth((fraction-at)/width);
  let lid=1,corner=0,browLift=0,browTilt=0,press=0,speak=0;
  if(smiles.has(type)){
    const warmth=beat(role===1?.24:.13,.28);
    corner=(type==='mutual-feeling'?.011:.0075)*warmth;
    lid-=warmth*(type==='mutual-feeling'?.22:.13);
    browLift=.0032*warmth;
    browTilt=.037*warmth;
  }else if(refusals.has(type)){
    const hesitation=beat(role===1?.12:.36,.21);
    corner=-.004*hesitation;press=.23*hesitation;
    lid-=.12*hesitation;browTilt=.070*hesitation;
    if(role===1)actor._head.rotation.y+=.085*hesitation;
  }else if(conflicts.has(type)){
    const emphasis=beat(.08,.15);
    const turn=role===0?1-smooth((fraction-.47)/.12):smooth((fraction-.38)/.12);
    const syllable=Math.sin(seconds*12+role)**2;
    speak=.27*syllable*turn*emphasis;
    lid-=.12*emphasis;browTilt=-.093*emphasis;
    corner=-.003*emphasis;
  }else if(type==='supported'){
    const attention=beat(role===0?.08:.30,.24);
    corner=attention*(role===0?.004:.002);browLift=.004*attention;
    browTilt=.074*attention;lid-=attention*.10;
  }
  for(const eye of actor._eyes||[])eye.scale.y=(eye.userData.baseScaleY||eye.scale.y)*lid;
  for(const brow of face.brows){
    const side=Math.sign(brow.position.x)||1;
    brow.rotation.z-=side*browTilt;
    brow.position.y+=browLift;
  }
  actor._mouth.scale.y*=1-press+speak;
  actor._mouth.position.y-=speak*.008;
  for(const {vertices,positions,weights} of face.surfaces){
    for(let i=0;i<weights.length;i++){
      const displacement=corner*weights[i];
      vertices.setY(i,positions.getY(i)+displacement);
      vertices.setZ(i,positions.getZ(i)+Math.max(0,displacement)*.60);
    }
    vertices.needsUpdate=true;
  }
}
export function createCinemaActing(actors){
  let cast=[],activeRestore=()=>{},eventType='',sourceEvent={};
  let entry;
  const worldOrientation=new Quaternion();
  function begin(event){
    activeRestore();
    sourceEvent=event||{};
    eventType=sourceEvent.type;
    entry=sceneForEvent(sourceEvent);
    const roles=(event?.participants||[]).map(id=>actors.find(actor=>actor.id===id));
    cast=roles.map((actor,role)=>{
      if(!actor?.mesh)return null;
      if(entry)initializeBase(actor);
      const partner=roles[role===0?1:0];
      const delta=partner?partner.mesh.position.clone().sub(actor.mesh.position).setY(0):new Vector3();
      const separation=delta.length();
      if(separation>.001)delta.normalize();
      else delta.set(Math.sin(actor.mesh.rotation.y),0,Math.cos(actor.mesh.rotation.y));
      const routineHand=eventType==='routine' ? actor._rig?.joints?.LeftHand||actor._arms?.[1] : null;
      const hand=routineHand||actor._rig?.joints?.RightHand||actor._arms?.[0];
      const resumeFace=suspendActionFace(actor);const reset=snapshot(actor);
      const held=[];
      actor.mesh.traverse(node=>{if(node.name.startsWith('held-prop:'))held.push(node);});
      return {
        actor,reset,resumeFace,held,face:prepareFace(actor,eventType),props:new Map(),hand,
        base:actor.mesh.position.clone(),direction:delta,right:new Vector3(delta.z,0,-delta.x),
        yaw:Math.atan2(delta.x,delta.z),maxApproach:Math.min(1,Math.max(0,separation-.70))
      };
    });
    const saved=cast;
    activeRestore=()=>{
      if(saved!==cast)return;
      for(const player of saved)if(player){if(entry){releaseBase(player.actor);releaseAuthored(player.actor);}clearActionFace(player.actor);player.face?.restore();for(const prop of player.props.values())prop.removeFromParent();player.reset();player.resumeFace();}
      cast=[];activeRestore=()=>{};
    };
    return activeRestore;
  }
  function frame(shot,progress,elapsedMs,cues=[]){
    const fraction=Math.min(1,Math.max(0,elapsedMs/(shot.totalMs||6000)));
    const seconds=Math.max(0,elapsedMs/1000);
    if(entry){
      for(const [role,player] of cast.entries()){
        if(!player || !entry.tracks[role])continue;
        player.reset();
        performTrack(player.actor,entry.tracks[role],Math.min(6,seconds),6);
        if(sourceEvent.equipment || previewProps[entry.id]){
          for(const prop of player.held)prop.visible=false;
          const kind=propAt(entry.id,role,sourceEvent.equipment?.[role],seconds,sourceEvent.propStart?.[role]);
          if(kind && !player.props.has(kind)){
            const prop=createPropModel(kind);
            if(prop){
              const actor=player.actor, hand=actor._rig?.limbs[1].hand||actor._arms[1];
              prop.position.set(.006,actor._rig?-.078*actor._rig.R:-.35,.035);
              prop.name='cinema-catalog:'+kind;hand.add(prop);player.props.set(kind,prop);
            }
          }
        }
        for(const [kind,prop] of player.props)prop.visible=kind===propAt(entry.id,role,sourceEvent.equipment?.[role],seconds,sourceEvent.propStart?.[role]);
      }
      return;
    }
    const tracks=duets[eventType];
    const scripted=typeof shot.action==='function' && (eventType==='camp-story' || (cast[0]?.actor && cast[1]?.actor));
    for(const [role,player] of cast.entries()){
      if(!player)continue;
      player.reset();
      // Real emitted scenes may have ended with the guests facing their next task.
      // Anchor relative shoulder/hand choreography to the actual partner line.
      if(scripted && eventType!=='camp-story' && shot.actionMode!=='overlay'){
        player.actor.mesh.rotation.y+=turn(player.yaw-player.actor.mesh.rotation.y)*smooth(seconds/.28);
      }
      if(tracks?.[role]&&(!scripted||shot.actionMode==='overlay'))duetPose(player,tracks[role],fraction,seconds);
      else if(!scripted)skitPose(player,cast,role,cues,sourceEvent,shot,elapsedMs);
    }
    if(scripted)shot.action(cast.map(player=>player?.actor),progress);
    for(const [role,player] of cast.entries()){
      if(!player)continue;
      express(player,eventType,role,fraction,seconds);
      const mood=sceneMood(eventType,role);
      const speaks=cues.some(c=>c.kind==='say')
        ? cues.some(c=>c.kind==='say' && c.role===['F','T','A'][role] && c.t<=elapsedMs && elapsedMs<c.t+c.dur)
        : cast.length>1&&role===Math.floor(seconds/1.8)%cast.length;
      sampleActionFace(player.actor,0,seconds,{role,mood,speech:speaks,blush:mood==='tender',
        ...reactionAt(sceneKey(sourceEvent),role,fraction)});
      const dailyProp=eventType==='routine' && ({drink:'cup',read:'book',eat:'snack'})[sourceEvent.activity];
      const propCue=shot.prop || (dailyProp ? {kind:dailyProp,role:'F'} : null) || (eventType==='water-shared'
        ? {kind:'cup',role:shot.cupRole || (fraction>=.52?'T':'F')} : null);
      for(const prop of player.props.values())prop.visible=false;
      if(propCue&&player.hand){
        player.held.forEach(prop=>{prop.visible=false;});
        // Keep one mesh on each hand to allow a reverse cut (or seek) across an exchange.
        let prop=player.props.get(propCue.kind);
        if(!prop){
          prop=createPropModel(propCue.kind);
          if(!prop)continue;
          prop.name=propCue.kind==='cup'?'cinema-water-cup':'cinema-prop:'+propCue.kind;
          prop.scale.setScalar(propCue.kind==='cup'?1.24:1);
          prop.position.set(.035,player.actor._rig?.joints?.RightHand?-.095:-.35,.035);
          player.hand.add(prop);player.props.set(propCue.kind,prop);
        }
        prop.visible=role===(propCue.role==='T'?1:0);
        if(prop.visible&&propCue.kind==='cup')prop.quaternion.copy(player.hand.getWorldQuaternion(worldOrientation)).invert();
      }
    }
  }
  return {begin,frame};
}
