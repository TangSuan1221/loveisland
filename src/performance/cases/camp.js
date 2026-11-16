import {Vector3} from 'three';
import {playPhrase} from '../../action-pose.js';

// Locations are authored in metres relative to the actual structure: x follows
// its facade; positive z looks out through the entrance. The two camera marks
// are independent of the two optical target marks (crane, pan or tracking).
const loc = (camera, end, aim, aimEnd, fov, fx='none') =>
  ({kind:'location',motion:'track',fx,location:{camera,end,aim,aimEnd,fov}});
const actorShot = (kind, motion, fx, aimRole, along, side, height, aimY, screenX, screenY, fov, endAlong=along, endSide=side, endHeight=height) =>
  ({kind,motion,fx,composition:{aimRole,along,side,height,aimY,screenX,screenY,fov,endAlong,endSide,endHeight}});
// Each path is sampled over the full scene, including cuts. Position, facing
// (degrees clockwise from the building's front) and pose progression stay in
// the same clock. The 'door' reference is outside the footprint.
const path = (marks,poses) => ({marks,poses:poses.split(' ')});
const scenes = {
  S_new_home:{
    // Bag down, try the doorstep: camera descends from eaves to threshold.
    B1:{open:loc([2.8,3.7,5.15],[1.3,1.18,4.85],[0,1.8,.6],[-.2,1.02,1.8],43),
      reveal:actorShot('insert','push','warm','hand',.55,1.4,-.1,0,.42,.49,40,.4,1.05),
      tail:actorShot('pair','pull','none','mid',-.8,4,.35,-.48,.56,.44,44,-1.1,5.1),
      f:path([[-1,2.5,145],[-.35,1.2,175],[-.35,.85,174]],'step take sit nod'),
      t:path([[1.1,1.1,-70],[1.2,.95,-65]],'look step nod')},
    // Inside/outside composition: the second guest remains outside.
    B2:{open:loc([.1,1.4,5.8],[-1.25,1.42,5.3],[.35,1.36,1.15],[.72,1.4,2.05],39,'cool'),
      reveal:actorShot('shoulderF','still','none','T',-2.2,.72,.12,-.07,.68,.4,38),
      tail:loc([-4,2.2,5.2],[-4.7,2.4,6.1],[0,.95,1.35],[.1,.9,1.7],46,'vignette'),
      f:path([[.1,1.45,177],[.05,.7,180],[-.18,.72,52]],'step take look ask'),
      t:path([[1.5,2.5,-120],[1.5,2.5,-132],[1.7,2.9,-138]],'guard cold retreat')},
    // Let the other person go through first, crossing left to right.
    B3:{open:loc([-4,.95,2.6],[-2.5,1.35,2.2],[-.6,1,1.8],[.7,1.12,1.2],46),
      reveal:loc([1.85,2.23,5.48],[1.35,2.16,5.15],[.65,1.62,2.4],[.3,1.67,2.08],40,'warm'),
      tail:loc([.2,2.18,4.85],[-.18,2.12,4.65],[-.86,1.70,2.38],[-1.12,1.74,2.32],41),
      f:path([[-.5,1.55,65],[-1.1,1.25,84],[-1.14,1.2,125]],'step offer point nod'),
      t:path([[1.55,2,-124],[.85,1.15,-148],[.28,.66,-170]],'look nod step step')}},
  S_homeless:{
    B1:{open:loc([2.9,.8,2.45],[1.8,.82,2.35],[.45,.83,1.2],[.1,.8,1.3],41,'cool'),
      reveal:actorShot('pair','track','none','mid',-.35,2.65,.1,-.35,.5,.5,40,.25,2.45),
      f:path([[-1.45,1.7,75],[-.75,1.35,80],[-.35,1.27,85]],'cold ask step sit'),
      t:path([[.3,1.3,-85],[.7,1.2,-83],[.86,1.15,-75]],'sit look step sit')},
    B2:{open:loc([-2.4,1.9,4.15],[-2.4,1.9,4.15],[0,1.12,1.1],[.9,1.3,1.45],32,'vignette'),
      reveal:actorShot('faceF','push','cool','F',1.5,.85,.18,-.08,.32,.42,38,1.04,.69),
      f:path([[-1.6,1.8,72],[-1.15,1.45,77],[-1.65,2.15,20]],'point ask guard retreat'),
      t:path([[.85,.85,-78],[.92,.88,-40]],'stop guard look')},
    B3:{open:loc([-1,.95,5.6],[-.45,1.14,4.65],[0,1.15,2],[0,1.3,2.1],40,'warm'),
      reveal:actorShot('shoulderT','pull','warm','F',1.75,1.2,-.12,-.18,.38,.47,45,2.45,1.65),
      f:path([[-1.1,1.8,77],[-.58,1.58,82],[-1.9,2.35,-55]],'cold offer wave step'),
      t:path([[.65,1.55,-85],[.5,1.55,-78],[.58,1.4,-48]],'cold take cradle look')}},
  S_upgrade:{
    B1:{open:loc([3.4,.83,3.5],[2.5,2.7,3.2],[0,.96,.65],[0,1.97,0],51),
      reveal:actorShot('wide','arc','spark','mid',-1.45,5.7,1.3,-.57,.57,.52,45,-2.35,5.25,.7),
      f:path([[-1.4,2.2,70],[-.74,1.6,154],[-.8,1.6,160]],'step point stretch nod'),
      t:path([[1.7,2.45,-120],[1.22,1.7,-156]],'step inspect look')},
    B2:{open:loc([2.8,.78,1.65],[3.15,1.55,2.9],[.65,.68,.9],[.2,1.25,1.4],36),
      reveal:actorShot('shoulderF','still','none','T',-1.85,.77,-.035,-.12,.7,.46,43),
      f:path([[-1,1.45,83],[-.65,1.35,85]],'inspect ask point'),
      t:path([[.9,1.4,-84],[.98,1.55,-65]],'look guard nod')},
    B3:{open:loc([-.42,1.45,6],[-.42,1.45,6],[0,1.12,0],[0,1.12,0],35),
      reveal:actorShot('faceF','pull','warm','F',1.8,1.3,.1,-.08,.43,.45,44,2.85,2.1),
      f:path([[-.45,2.95,176],[-.45,3.25,176],[-.6,3.25,166]],'inspect take inspect nod'),
      t:path([[1.3,1.38,-160],[1.3,1.4,-165]],'look wave idle')}},
  S_first_cross:{
    B1:{open:loc([3,1.05,-2.6],[3.05,1.2,.2],[0,1,-1.7],[0,1,.8],48),
      reveal:actorShot('profile','track','none','F',.15,3.3,-.42,-.6,.39,.52,45,.9,3.65),
      f:path([[0,-1.8,0],[0,-.3,0],[.08,1.9,0]],'step step step wave'),
      t:path([[.25,-2.6,-5],[.18,-1.6,0]],'look wave step')},
    B2:{open:loc([-.6,1.9,-3.8],[.45,1.45,-3.05],[.1,.85,0],[.25,.69,.58],41),
      reveal:actorShot('shoulderF','still','none','T',-1.78,.8,.22,-.3,.58,.51,42),
      f:path([[-.53,-1.3,9],[-.75,-1.24,22]],'inspect offer look'),
      t:path([[.27,-1.8,0],[.23,-.45,0],[.18,1.2,0]],'look step step')},
    B3:{open:loc([1.35,.73,1.85],[1.05,.68,.7],[.37,.74,.55],[.3,.75,-.24],36),
      reveal:loc([2.5,2.04,.72],[2.28,1.94,.60],[.12,1.52,-.58],[.12,1.46,-.61],40),
      f:path([[.16,-1.2,0],[.19,-.42,0],[.19,-.56,15]],'step stop guard inspect'),
      t:path([[-.2,-1.9,12],[-.22,-1.46,17]],'look step stop')}},
  S_wall_dispute:{
    B1:{open:loc([.8,1.15,3],[-2.85,1.5,2.75],[0,.8,.5],[.45,.85,-.8],42),
      reveal:actorShot('profile','still','none','F',-.85,2.6,.12,-.27,.28,.51,43),
      tail:loc([-.85,3.05,3.9],[-.85,3.05,3.9],[0,.68,0],[0,.68,0],42),
      f:path([[-1,1.1,138],[-.45,.78,155],[-.45,.8,85]],'step stop point ask'),
      t:path([[1.35,1.28,-120],[.98,1.15,-118]],'step inspect nod')},
    B2:{open:loc([.3,5.7,2],[.6,5.7,2.3],[.1,.51,.1],[1.25,.55,.7],48),
      reveal:loc([2.15,4.4,4.1],[3.14,4.25,3.88],[.32,1.13,.73],[1.18,1.15,.45],44),
      tail:loc([4,2.83,3.7],[3.8,2.85,3.4],[1.5,1.25,.7],[1.7,1.27,-.55],44),
      f:path([[-.75,1.05,85],[1.45,1.12,83],[1.7,-1.15,171]],'stop look step step'),
      t:path([[-1.5,1.15,85],[.6,1.17,87],[1.48,-.25,177]],'look step step step')},
    B3:{open:loc([-2.9,.84,.65],[-2.1,.84,.8],[0,.81,.25],[.25,1.12,.72],41,'impact'),
      reveal:actorShot('faceF','push','none','F',1.13,.7,-.18,-.06,.36,.46,37,1,.54),
      tail:actorShot('faceT','still','cool','T',-1.24,.6,.14,-.06,.65,.43,40),
      f:path([[-.88,1.38,72],[-.44,1.08,84],[-.68,1.24,82]],'point step ask guard'),
      t:path([[.98,1.12,-82],[1.05,1.35,-60]],'stop guard retreat')}},
  S_island_grew:{
    B1:{open:loc([-3.9,1.2,2.35],[-2.95,3.85,3.7],[-1.2,.6,.5],[1.2,.68,-.3],52,'warm'),
      reveal:actorShot('wide','track','warm','mid',-2.4,5.7,.9,-.68,.32,.56,52,-1.1,5.2),
      f:path([[-1.7,1.3,68],[-.1,1.4,83],[1.9,1.28,96]],'look point step step'),
      t:path([[-2.4,1.84,73],[-1.05,1.9,84],[.85,1.78,95]],'look wave step step')},
    B2:{open:loc([4.5,4.6,3.3],[2.9,3.95,3.6],[0,.62,0],[-.5,.62,.45],45),
      reveal:actorShot('shoulderT','arc','warm','F',2.35,1.25,.47,-.22,.35,.44,46,2.05,1.65),
      f:path([[-.65,1.25,90],[.6,1.14,87],[.6,1.14,45]],'step point stretch point'),
      t:path([[-1.45,2.15,54],[-1.28,1.91,49]],'inspect look nod')},
    B3:{open:loc([-1.05,1.12,5.02],[-1.05,1.10,4.78],[-.61,1.58,1.35],[-.63,1.71,1.36],37,'vignette'),
      reveal:loc([1.4,1.6,3.1],[4.3,3,7.6],[-.4,1.24,1.2],[0,.9,.45],43,'warm'),
      f:path([[-.75,1.4,170],[-.75,1.4,170]],'look inspect cradle look'),
      t:path([[.28,2.2,-165],[.24,1.52,173]],'step sit look')}}
};

const clamp=t=>Math.min(1,Math.max(0,t));
const ease=t=>t*t*(3-2*t);
function origin(event){
  const a=event.stageAnchor||{x:event.x??0,z:event.z??0,yaw:0,width:1.4,depth:1.4};
  // Authored bridge tracks cross in local +Z. The review island's curved bridge spans X.
  if(event.sceneId==='S_first_cross' && a.width>a.depth)
    return {...a,width:a.depth,depth:a.width,yaw:(a.yaw||0)+Math.PI/2,arched:true};
  return a;
}
function world(out,a,x,y,z){
  const yaw=a.yaw||0, c=Math.cos(yaw),s=Math.sin(yaw);
  return out.set(a.x+x*c+z*s,y,a.z-x*s+z*c);
}
const aim=new Vector3(),position=new Vector3(),forward=new Vector3(),right=new Vector3(),up=new Vector3(0,1,0),delta=new Vector3();
export function frameCampLocation(camera,controls,event,shot,progress){
  const layout=shot.location;
  if(!layout)return false;
  const a=origin(event),t=ease(clamp(progress));
  const vector=(out,from,to)=>world(out,a,...from.map((v,i)=>v+(to[i]-v)*t));
  vector(position,layout.camera,layout.end);
  vector(aim,layout.aim,layout.aimEnd);
  // Keep both the facade and its visitor in narrow viewports.
  const distanceScale=Math.max(1,Math.min(2,1.05/camera.aspect));
  camera.position.copy(position.sub(aim).multiplyScalar(distanceScale).add(aim));
  if(camera.aspect<.9 && shot.performerMarks){
    const tan=Math.tan(layout.fov*Math.PI/360)*camera.aspect;
    forward.copy(aim).sub(camera.position).normalize();
    right.crossVectors(forward,up).normalize();
    let retreat=0;
    for(const mark of shot.performerMarks(progress)){
      delta.copy(mark).sub(camera.position);
      const depth=delta.dot(forward), lateral=Math.abs(delta.dot(right));
      retreat=Math.max(retreat,(lateral+.32)/(tan*.88)-depth);
    }
    camera.position.addScaledVector(forward,-retreat);
  }
  controls.target.copy(aim);camera.lookAt(aim);
  if(camera.fov!==layout.fov){camera.fov=layout.fov;camera.updateProjectionMatrix();}
  camera.updateMatrixWorld();
  return true;
}
function markAt(route,event,progress){
  const a=origin(event),count=route.marks.length;
  const cursor=clamp(progress)*(count-1),index=Math.min(count-2,Math.floor(cursor));
  const start=route.marks[index],end=route.marks[index+1],t=ease(cursor-index);
  const [x,z,yaw]=start.map((v,i)=>v+(end[i]-v)*t);
  const atDoor=['S_new_home','S_upgrade','S_homeless'].includes(event.sceneId);
  let floor=.48;
  if(event.sceneId==='S_first_cross'){
    const onDeck=clamp(((a.depth||2)*.5+.35-Math.abs(z))/.35);
    const top=a.arched ? .74 +.13*Math.cos(clamp(Math.abs(z)/(a.depth*.5))*Math.PI/2):.81;
    floor+=(top-floor)*onDeck;
  }
  return {position:world(new Vector3(),a,x,floor,z+(atDoor ? (a.depth||1.4)/2 : 0)),yaw:(a.yaw||0)+yaw*Math.PI/180};
}
function sampleActor(actor,route,event,progress,seconds,duration) {
  if(!actor?.mesh)return;
  const mark=markAt(route,event,progress);
  actor.mesh.position.copy(mark.position);
  actor.mesh.rotation.y=mark.yaw;
  if(actor._arms&&actor._legs&&actor._body&&actor._head)playPhrase(actor,route.poses,seconds,duration);
}
export function editCamp(plan,event) {
  if(event.type!=='camp-story' || !plan.hold)return null;
  const story=scenes[plan.sceneId]?.[plan.branchId];
  if(!story)return null;
  const reveal=plan.cues.find(c=>c.kind==='caption')?.t??plan.total*.5;
  const beats=[[0,story.open],[reveal,story.reveal]];
  if(story.tail)beats.push([plan.cues.find(c=>c.kind==='choice')?.t??plan.total*.72,story.tail]);
  const present=!!event.participants?.length;
  return beats.map(([at,setup],i)=>{
    const end=beats[i+1]?.[0]??plan.total;
    const shot=!present&&!setup.location ? {...story.open,location:{...story.open.location,camera:story.open.location.end,end:story.open.location.camera}} : setup;
    return {...shot,at,performerMarks(progress){
      if(!present)return [];
      const fraction=(at+clamp(progress)*(end-at))/plan.total;
      return [story.f,story.t].slice(0,event.participants.length).map(route=>markAt(route,event,fraction).position.addScaledVector(up,1.45));
    },...(i===0?{sourceShot:'LOC'}:{}),action(actors,progress){
      const seconds=(at+clamp(progress)*(end-at))/1000,duration=plan.total/1000;
      sampleActor(actors[0],story.f,event,seconds/duration,seconds,duration);
      sampleActor(actors[1],story.t,event,seconds/duration,seconds,duration);
    }};
  });
}
export function stageCampActors(actors,event) {
  const story=event.type==='camp-story' && scenes[event.sceneId]?.[event.result];
  if(!story)return ()=>{};
  const saved=[];
  for(const [role,id] of (event.participants||[]).slice(0,2).entries()){
    const actor=actors.find(a=>a.id===id);
    if(!actor?.mesh)continue;
    saved.push({actor,position:actor.mesh.position.clone(),rotation:actor.mesh.quaternion.clone()});
    const route=role===0?story.f:story.t;
    const [x,z,heading]=route.marks[0];
    const a=origin(event);
    const front=['S_new_home','S_upgrade','S_homeless'].includes(event.sceneId)?(a.depth||1.4)/2:0;
    world(actor.mesh.position,a,x,actor.mesh.position.y,z+front);
    actor.mesh.rotation.y=(a.yaw||0)+heading*Math.PI/180;
    actor.mesh.updateMatrixWorld(true);
  }
  return ()=>{
    for(const item of saved){
      item.actor.mesh.position.copy(item.position);
      item.actor.mesh.quaternion.copy(item.rotation);
      item.actor.mesh.updateMatrixWorld(true);
    }
  };
}
