import * as T from 'three';
import {W,H,inBounds,T as LAND} from '../camp/grid.js';
import {worldToCell,cellToWorld,facilityRect,landmarkAt} from '../camp/footprints.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A tidal grazer uses the habitat door as its scale reference.
export function addGrazers(scene) {
 const parts=[];
 function paint(geometry,color) {
  const c=new T.Color(color),p=geometry.attributes.position;
  const colors=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++) c.toArray(colors,i*3);
  geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  if(geometry.index) geometry=geometry.toNonIndexed();
  geometry.deleteAttribute('uv');parts.push(geometry);
 }
 function oval(x,y,z,a,b,c,color,tilt=0){
  const g=new T.SphereGeometry(1,14,10);g.scale(a,b,c);g.rotateZ(tilt);g.translate(x,y,z);paint(g,color);
 }
 function limb(points,radii,color){
  for(let i=1;i<points.length;i++){
   const a=new T.Vector3(...points[i-1]),b=new T.Vector3(...points[i]),d=b.clone().sub(a);
   const g=new T.CylinderGeometry(radii[i],radii[i-1],d.length(),8);
   g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));
   const mid=a.lerp(b,.5);g.translate(mid.x,mid.y,mid.z);paint(g,color);
  }
 }
 oval(0,.56,0,.63,.29,.26,'#859f9d');
 oval(-.17,.7,0,.4,.23,.22,'#b4c7b7',-.12);
 oval(-.54,.77,.01,.29,.22,.22,'#ced2b4',-.22);
 oval(-.77,.71,.02,.15,.09,.15,'#889a8a');
 for(const s of [-1,1]){
  const z=s*.15;
  limb([[-.54,.91,z],[-.32,1.17,z*1.3],[-.12,1.28,z*1.55]],[.091,.062,.004],'#a45b7e');
  oval(-.68,.81,s*.188,.051,.063,.026,'#302e45');
  oval(-.7,.834,s*.211,.014,.014,.005,'#f4eacb');
  for(const x of [-.36,.37]){
   const dx=x>0?.15:-.1;
   limb([[x,.48,z],[x+dx,.27,z*1.33],[x-.04,.07,z*1.55],[x-.15,.045,z*1.6]],[.088,.056,.037,.013],'#58696d');
  }
 }
 limb([[.38,.55,0],[.77,.44,0],[1.06,.53,.05],[1.32,.82,.10],[1.61,.91,.12]],[.15,.09,.058,.035,.005],'#849e97');
 for(let i=0;i<5;i++) oval(-.28+i*.15,.78+Math.sin(i*.85)*.025,.16,.062,.038,.047,'#66667d');
 const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());
 const material=new T.MeshLambertMaterial({vertexColors:true});
 geometry.computeBoundingBox();
 const herd=[];
 for(const [x,z,size,angle] of [[-6.6,5.2,1.06,-.65],[-7.8,5.7,.65,-1.1],[7,-4,.8,.6]]){
  const animal=new T.Mesh(geometry,material);animal.position.set(x,0,z);animal.scale.setScalar(size);animal.rotation.y=angle;animal.castShadow=true;scene.add(animal);
  const bounds=new T.Box3().setFromObject(animal,true);
  herd.push({animal,x,z,size,extent:[bounds.min.x-x,bounds.max.x-x,bounds.min.z-z,bounds.max.z-z]});
 }
 return {sync(grid,facilities=[]){
   const reserved=new Set();
   for(const f of facilities){
     const b=facilityRect(f);if(!b)continue;
     for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)if(inBounds(x,y))reserved.add(y*W+x);
   }
   const settled=[];
   function free(member,x,z) {
     const e=member.extent,start=worldToCell(x+e[0],z+e[2]),end=worldToCell(x+e[1],z+e[3]);
     if(!inBounds(start.x,start.y)||!inBounds(end.x,end.y))return false;
     if(settled.some(p=>Math.hypot(x-p.x,z-p.z)<.56*(p.size+member.size)))return false;
     for(let row=start.y;row<=end.y;row++)for(let col=start.x;col<=end.x;col++){
       const i=row*W+col,terrain=grid.base[i];
       if(terrain!==LAND.GRASS&&terrain!==LAND.SAND&&terrain!==LAND.SOIL)return false;
       if(grid.occ[i]||grid.road[i]||reserved.has(i)||landmarkAt(col,row))return false;
     }
     return true;
   }
   for(const member of herd){
     let destination={x:member.x,z:member.z};
     if(!free(member,member.x,member.z)){
       destination=null;
       const candidates=[];
       for(let row=0;row<H;row++)for(let col=0;col<W;col++){
         if(grid.base[row*W+col]!==LAND.GRASS)continue;
         const p=cellToWorld(col,row);
         const distance=(p.x-member.x)**2+(p.z-member.z)**2;
         candidates.push({...p,distance});
       }
       candidates.sort((a,b)=>a.distance-b.distance);
       destination=candidates.find(p=>free(member,p.x,p.z))||null;
     }
     member.animal.visible=Boolean(destination);
     if(destination){
       member.animal.position.set(destination.x,0,destination.z);
       settled.push({...destination,size:member.size});
     }
   }
 }};
}
