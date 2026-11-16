import assert from 'node:assert/strict';
import {Vector3,PerspectiveCamera} from 'three';
import {portraitActor,disposeActor} from '../src/characters.js';
import {performances} from '../src/action-catalog.js';
import {performTrack} from '../src/action-playback.js';

// CPU depth pass over the deformed render meshes, using the review front camera.
function facePixels(actor){
 const size=440,depth=new Float32Array(size*size).fill(Infinity),labels=new Uint8Array(size*size);
 const camera=new PerspectiveCamera(32,1,.1,60);camera.position.set(0,1.6,4.9);camera.lookAt(0,1,0);camera.updateMatrixWorld();
 actor.mesh.updateMatrixWorld(true);
 actor.mesh.traverseVisible(mesh=>{
  if(!mesh.isMesh||mesh.userData.isOutline)return;
  let label=mesh.name==='face-skin'?2:0;
  for(let p=mesh;p;p=p.parent)if(['eye','nose','mouth','brow'].includes(p.name))label=1;
  const geom=mesh.geometry,positions=geom.attributes.position,points=[];
  for(let i=0;i<positions.count;i++){
    const p=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld).project(camera);
    points.push([(p.x+1)*size/2,(1-p.y)*size/2,p.z]);
  }
  const index=geom.index?.array;
  for(let i=0;i<(index?.length??points.length);i+=3){
    const [a,b,c]=[0,1,2].map(k=>points[index?index[i+k]:i+k]);
    const dx=b[0]-a[0],dy=b[1]-a[1],ex=c[0]-a[0],ey=c[1]-a[1],den=dx*ey-dy*ex;
    if(Math.abs(den)<.00001)continue;
    for(let y=Math.max(0,Math.ceil(Math.min(a[1],b[1],c[1])));y<=Math.min(size-1,Math.max(a[1],b[1],c[1]));y++)
     for(let x=Math.max(0,Math.ceil(Math.min(a[0],b[0],c[0])));x<=Math.min(size-1,Math.max(a[0],b[0],c[0]));x++){
      const u=((x-a[0])*ey-(y-a[1])*ex)/den,v=(dx*(y-a[1])-dy*(x-a[0]))/den;
      if(u<0||v<0||u+v>1)continue;
      const d=a[2]+u*(b[2]-a[2])+v*(c[2]-a[2]),j=y*size+x;
      if(d<depth[j]){depth[j]=d;labels[j]=label;}
     }
  }
 });
 return [1,2].map(k=>labels.reduce((n,v)=>n+(v===k),0));
}
for(const key of ['A26','A27','play']){
 for(const [i,track] of performances.get(key).tracks.entries()){
  const a=portraitActor(i?'zhou':'lin'),l=a._rig.limbs[1],skin=l.oldArm.getObjectByName('forearm');
  const palm=l.hand.children.find(o=>o.isMesh&&o.geometry.type==='SphereGeometry');
  const pos=skin.geometry.attributes.position;
  let tip=0;for(let k=1;k<pos.count;k++)if(pos.getY(k)<pos.getY(tip))tip=k;
  let first,elbow=0,wrist=0;
  for(let f=0;f<=180;f++){
   performTrack(a,track,f/30,6);a.mesh.updateMatrixWorld(true);
   const e=l.arm.worldToLocal(skin.localToWorld(skin.getVertexPosition(tip,new Vector3())));
   const w=l.forearm.worldToLocal(palm.localToWorld(new Vector3(0,-1,0)));
   first??=[e.clone(),w.clone()];elbow=Math.max(elbow,e.distanceTo(first[0]));wrist=Math.max(wrist,w.distanceTo(first[1]));
   if(key==='A27'&&[0,42,72,120].includes(f)){
     const [features,headSkin]=facePixels(a);
     assert.ok(f===0?features>0:features===0,'visible face features at frame '+f);
     console.log('front frame',f,'features,head skin',features,headSkin);
   }
  }
  console.log(key,i,'forearm and palm displacement relative to upstream joint',elbow,wrist);
  assert.ok(elbow>.1&&wrist<.00001);disposeActor(a);
 }
}
