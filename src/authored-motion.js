import interview from './motions/A26.json' with {type:'json'};
import lead from './motions/play-lead.json' with {type:'json'};
import follow from './motions/play-follow.json' with {type:'json'};
import {Quaternion} from 'three';
import idle from './motions/A01.json' with {type:'json'};
import avoid from './motions/A27.json' with {type:'json'};
import {performances} from './action-catalog.js';

const clips=new Map([[performances.get('A01').tracks[0],idle],[performances.get('A27').tracks[0],avoid]]);
clips.set(performances.get('play').tracks[0],lead);
clips.set(performances.get('play').tracks[1],follow);
clips.set(performances.get('A26').tracks[0],interview);
const scratch=new Quaternion();
const cached=new WeakMap();
export function releaseAuthored(actor){
  const rig=actor._rig,record=cached.get(rig);
  if(!record?.active)return;
  for(const [i,bone] of record.bones.entries())bone.quaternion.copy(record.rest[i]);
  rig.joints.Hips.position.set(0,.86*rig.R,0);
  record.active=false;
}
export function sampleAuthored(actor,track,fraction){
  const clip=clips.get(track),rig=actor._rig;
  if(!clip||!rig)return false;
  let record=cached.get(rig);
  if(!record){
    const bones=clip.bones.map(name=>rig.joints[name]);
    record={bones,rest:bones.map(b=>new Quaternion()),active:false};
    // Neutral fingers retain the authored thumb splay on either side.
    clip.bones.forEach((n,i)=>{if(n.endsWith('HandThumb1'))record.rest[i].setFromAxisAngle({x:0,y:0,z:1},n.startsWith('Right')?.65:-.65);});
    cached.set(rig,record);
  }
  const frame=Math.min(1,Math.max(0,fraction))*(clip.samples.length-1);
  const i=Math.floor(frame),t=frame-i,a=clip.samples[i],b=clip.samples[Math.min(i+1,clip.samples.length-1)];
  actor._body.rotation.set(0,0,0);actor._body.position.set(0,0,0);actor._head.rotation.set(0,0,0);
  // Exported keys are rounded. Normalize both endpoints before slerping so
  // nearly coincident rotations still reach the authored frame exactly.
  record.bones.forEach((bone,j)=>bone.quaternion.fromArray(a.q[j]).normalize().slerp(scratch.fromArray(b.q[j]).normalize(),t));
  const hips=rig.joints.Hips;
  hips.position.fromArray(a.p);
  hips.position.x+=(b.p[0]-a.p[0])*t;
  hips.position.y+=(b.p[1]-a.p[1])*t;
  hips.position.z+=(b.p[2]-a.p[2])*t;
  hips.position.multiplyScalar(rig.R);hips.position.y+=.86*rig.R;
  record.active=true;return true;
}
