import {Mesh,MeshBasicMaterial,SphereGeometry,Vector3} from 'three';

import {EMOTES} from './runtime.js';
const roles=['F','T','A'];
export function faceCueAt(cues,time,role){
  let current;
  for(const c of cues||[]){
    if((c.kind!=='face'&&c.kind!=='say')||(c.role||c.speaker)!==role||
       !EMOTES.has(c.emote)||time<c.t||time>=c.t+(c.dur||0))continue;
    if(!current||c.t>current.t||(c.t===current.t&&c.kind==='face'))current=c;
  }
  return current;
}
export function createAuthoredFaces(actors,rows){
  const looks=new Map(rows.map(row=>[row.expr_id,row]));
  const target=new Vector3();
  let cast=[];
  function restoreGaze(face){
    if(face.gazeApplied){
      face.actor._head.rotation.y-=face.gazeApplied;
      face.gazeApplied=0;
    }
  }
  function clear(){
    for(const face of cast)if(face)restoreGaze(face);
    for(const face of cast)if(face?.drop){
      face.drop.removeFromParent();face.drop.geometry.dispose();face.drop.material.dispose();
    }
    cast=[];
  }
  function begin(event){
    clear();
    cast=event.participants.map(id=>{
      const actor=actors.find(a=>a.id===id);
      if(!actor?._head)return null;
      return {actor,brows:actor._head.children.filter(n=>n.name==='brow').map(n=>[n,n.rotation.z,n.position.y]),drop:null};
    });
  }
  function beforePose(){
    for(const face of cast)if(face)restoreGaze(face);
  }
  function frame(cues,time,track=cues){
    const speech=cues?.findLast(c=>c.kind==='say' && c.t<=time && time<c.t+c.dur);
    const speaker=cast[roles.indexOf(speech?.role||speech?.speaker)];
    for(const [i,face] of cast.entries()){
      if(!face)continue;
      restoreGaze(face);
      if(speaker && speaker!==face){
        const head=face.actor._head;
        speaker.actor._head.getWorldPosition(target);
        head.worldToLocal(target);
        const w=Math.min(1,(time-speech.t)/160,(speech.t+speech.dur-time)/140);
        face.gazeApplied=w*Math.max(-.38,Math.min(.38,Math.atan2(target.x,target.z)));
        head.rotation.y+=face.gazeApplied;
      }
      if(face.drop)face.drop.visible=false;
      const cue=faceCueAt(track,time,roles[i]),look=looks.get(cue?.emote);
      if(!look)continue;
      const {actor}=face,name=cue.emote,lid=+look.eyes,tilt=+look.brow_tilt,rise=+look.brow_y,lip=look.mouth;
      const layer=actor._head.getObjectByName('performance-face');
      const elapsed=time-cue.t,weight=Math.min(1,elapsed/Number(look.blend_ms),cue.settlement?1:(cue.dur-elapsed)/95);
      const blend=(from,to)=>from+(to-from)*weight;
      for(const [side,e] of (actor._eyes||[]).entries()){
        if(!e.visible)continue;
        const base=e.userData.baseScaleY??1;
        const asymmetry=name==='smug'&&side===0?.58:1;
        e.scale.y=blend(e.scale.y,base*lid*asymmetry*(layer?.userData.blinkScale??1));
      }
      for(const [b,z,y] of face.brows){
        const side=Math.sign(b.position.x),offset=name==='smug'&&side>0?.018:0;
        b.rotation.z=blend(b.rotation.z,z-side*tilt);
        b.position.y=blend(b.position.y,y+rise+offset);
      }
      if(weight>.32 && layer?.visible){
        // Keep the existing speaking mouth on voiced syllables.
        const speaking=layer.userData.voicing;
        if(!speaking){
          for(const node of layer.children)if(node.name.startsWith('mouth-'))node.visible=node.name==='mouth-'+lip;
          if(actor._mouth)actor._mouth.visible=lip==='base';
        }
        for(const node of layer.children)if(node.name==='blush-stroke')node.visible=look.paint==='cheek';
      }else if(actor._mouth && !layer?.visible){
        const scale=actor._mouthBaseScale?.y??1;
        const opening={oh:1.72,ah:1.55,frown:.73,pressed:.47,smile:.81}[lip];
        actor._mouth.scale.y=blend(actor._mouth.scale.y,scale*(opening??1));
      }
      if((look.paint==='tear'||look.paint==='sweat')&&actor._faceDepth){
        if(!face.drop){
          face.drop=new Mesh(new SphereGeometry(1,12,8),new MeshBasicMaterial({color:0xa7dfef}));
          actor._head.add(face.drop);
        }
        const x=name==='sweat'?.16:.095,y=(name==='sweat'?.055:-.025)-.032*((elapsed%850)/850);
        face.drop.position.set(x,y,actor._faceDepth(x,y)+.01);
        face.drop.scale.set(.009*weight,.020*weight,.004);face.drop.visible=weight>.12;
      }
    }
  }
  return {begin,beforePose,frame,clear};
}
