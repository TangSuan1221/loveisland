import {bindHumanoid} from './humanoid-rig.js';
import {drawAnimeEye,drawAnimeBrow,drawAnimeNose,drawAnimeMouth} from './avatar-anime.js';
import {drawAppearancePaint} from './avatar-face-art.js';
import {FEATURE_PROFILES,drawCatalogEye,drawCatalogBrow,drawCatalogMouth,drawCatalogGlasses,drawCatalogBeard,drawFacialHairLayers} from './avatar-feature-catalog.js';
import * as THREE from 'three';
import {createCartoonMaterial,addCartoonOutline} from './avatar-material.js';
import {normalizeAppearance} from './avatar-schema.js';
import {buildCustomHair,resolveHairParts,hairCrownLift} from './avatar-hair-catalog.js';
import {FACE_PROFILES,drawFaceDetails,drawEyeDetails} from './avatar-detail-catalog.js';
const FACE_SCALES={oval:[1,1,1],anime_pentagon:[1,1,1],round:[1.08,.92,1],square:[1.08,.95,.96],heart:[1,.98,.98],long:[.89,1.12,1],diamond:[.95,1.04,1]};
for(const [id,p]of Object.entries(FACE_PROFILES))FACE_SCALES[id]=FACE_SCALES[p.base].map((n,i)=>n*p.scale[i]);
// All skin and paint vertices go through this same nonlinear face deformation.
export function faceSurfacePoint(shape,x,y,z,a=null){
 const scale=FACE_SCALES[shape]||FACE_SCALES.oval;
 const profile=FACE_PROFILES[shape];if(profile){x*=1+profile.upper*Math.max(0,y)+profile.lower*Math.max(0,-y);shape=profile.base;}
 // A continuous 3D perimeter with straight cheeks and an explicit jaw corner.
 // Radial X remapping preserves the shared skin/paint/feature projection.
 if(shape==='anime_pentagon'&&y<0){const v=Math.min(1,-y),radius=Math.sqrt(Math.max(0,1-v*v));const smooth=t=>t*t*(3-2*t),cheekInset=.08*smooth(Math.min(1,v/.16))*(1-smooth(Math.min(1,Math.max(0,(v-.16)/.34))));const edge=(v<.68?1-.25*v/.68:.75*(1-v)/.32)-cheekInset;if(radius>.00001)x*=edge/radius;}
 if(shape==='square')x=Math.sign(x)*Math.pow(Math.abs(x),a&&a.artStyle!=='satire'?.90:.73);
 if(shape==='heart'&&y<0)x*=1+y*.33;
 if(shape==='diamond')x*=1-Math.abs(y)*.2;
 if(a){const style=a.artStyle||'drama';const lower=Math.max(0,-y);x*=1+(a.jawWidth-1)*Math.min(1,lower*2)*.65;if(style==='anime')x*=1-.045*lower;else if(style==='drama')x*=1-.18*lower;else if(style==='organic')x*=1-.07*Math.abs(y)+.035*Math.sin(y*4);else x*=1+.08*lower;if(y<0)y*=a.chinLength*(style==='anime'?.9:1);if(style!=='satire'&&y<-.9)y=-.9+(y+.9)*.65;if(z>0&&style!=='satire'){const flat=Math.min(1,z/.52)*(.94-.10*y*y-.025*x*x),round=Math.pow(z,.58);z=style==='organic'?flat*.68+round*.32:flat*.88+round*.12;const bump=(center,width)=>Math.exp(-(((y-center)/width)**2));if(style!=='anime')z*=1+.035*bump(.34,.12)-.055*bump(.10,.13)+.055*bump(-.37,.17)-.038*bump(-.63,.10)+.045*bump(-.79,.13);}else {z=Math.sign(z)*Math.pow(Math.abs(z),.78);if(z<0&&y<-.15)z*=1+Math.max(-.65,y+.15)*.65;}}
 const point=[x*.255*scale[0],y*.282*scale[1],z*(a?.artStyle==='satire'?.205:a?.artStyle ? .19 : .235)*scale[2]];
 // A compact, front-only oral volume. Zero remains byte-for-byte compatible
 // with the original face; every projected feature uses this same surface.
 if(a?.muzzleDepth>0&&z>0){
  const width=Math.max(.7,Math.min(1.3,a.muzzleWidth||1)),depth=Math.min(.10,a.muzzleDepth);
  const radial=(point[0]/(.185*width))**2+((point[1]+.125)/.125)**2;
  if(radial<1){const front=Math.min(1,z/.45);point[2]+=depth*(1-radial)**2*front*front*(3-2*front);}
 }
 return point;
}
export function createFacePaintGeometry(appearance){
 appearance=normalizeAppearance(appearance);
 const geo=new THREE.PlaneGeometry(.49,.53,64,64),position=geo.getAttribute('position');
 for(let i=0;i<position.count;i++){
  const x=position.getX(i)/.255,y=position.getY(i)/.282;
  // The transparent texture is ellipse-clipped. Keep a modest forward lift so
  // face artwork can cover the eyes; XY remains inside the deformed skin outline.
  const z=Math.sqrt(Math.max(0,1-x*x-y*y))*(appearance.artStyle==='anime'?1:1.075);
  const point=faceSurfacePoint(appearance.faceShape,x,y,z,appearance);
  // Anime ink uses shallow ordered layers; paint clears them without a raised mask.
  // Fade it at the perimeter so a painted edge cannot become a floating rim.
  point[2]+=(appearance.artStyle==='anime'?.003:.012)*Math.min(1,Math.max(0,1-x*x-y*y)*8);
  position.setXYZ(i,...point);
 }
 geo.computeVertexNormals();return geo;
}
// Original procedural models. Only built-in materials and geometry: WebGPU compatible.
export function makeCustomActor(data,index=0,groundY=0){
 const a=normalizeAppearance(data.appearance), resources={geometry:new Set(),material:new Set(),texture:new Set()};
 const own=g=>(resources.geometry.add(g),g), sphere=own(new THREE.SphereGeometry(1,28,20)), box=own(new THREE.BoxGeometry(1,1,1));
 const mats=new Map();
 const mat=(color,basic=false)=>{const key=(color?.isColor?color.getHexString():color)+String(basic);if(!mats.has(key)){const m=createCartoonMaterial(color,{style:a.artStyle,basic});mats.set(key,m);resources.material.add(m);}return mats.get(key);};
 const root=new THREE.Group(),body=new THREE.Group(),head=new THREE.Group();root.name=`cast-${data.id}`;root.add(body);body.add(head);head.position.y=1.68*a.bodyRatio;const headRatio=a.artStyle==='anime'?.88:a.artStyle==='satire'?.88:.78;head.scale.set(a.headScale*a.faceWidth*headRatio,a.headScale*a.faceHeight*headRatio,a.headScale*headRatio);
 // Large illustrated heads must meet the neck above, not inside, the shirt.
 // Measure the same deformed chin used by the skin; do not move eyes separately.
 const chinOffset=faceSurfacePoint(a.faceShape,0,-1,0,a)[1]*head.scale.y;
 if(a.artStyle==='anime')head.position.y=Math.max(head.position.y,1.48*a.bodyRatio-chinOffset);
 const chinY=head.position.y+chinOffset;
 root.position.set(data.anchor?.[0]||0,groundY,data.anchor?.[1]||0);root.scale.setScalar(a.height);
 const mesh=(parent,color,pos,scale,geo=sphere,basic=false)=>{const o=new THREE.Mesh(geo,mat(color,basic));o.position.set(...pos);o.scale.set(...scale);o.castShadow=!basic;o.receiveShadow=true;parent.add(o);return o;};
 const line=(parent,points,color,r=.008)=>{const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(parent,color,[0,0,0],[1,1,1],own(new THREE.TubeGeometry(curve,20,r,8,false)));};
 const group=(parent,name,pos=[0,0,0])=>{const g=new THREE.Group();g.name=name;g.position.set(...pos);parent.add(g);return g;};
 const polygon=(parent,points,color,z,depth=.018)=>{const s=new THREE.Shape();s.moveTo(...points[0]);points.slice(1).forEach(p=>s.lineTo(...p));s.closePath();return mesh(parent,color,[0,0,z],[1,1,1],own(new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.007,bevelSize:.007,bevelSegments:2,steps:1})));};
 const ink=a.artStyle==='organic'?'#353831':a.artStyle==='satire'?'#24272a':'#303038';
 const R=a.bodyRatio,shoulder=.24*a.shoulderWidth*a.build,hip=.86*R;
 // Tailored continuous silhouette replaces floating shoulder balls and capsule limbs.
 function loft(parent,name,color,rows,segments=20){rows=[...rows].sort((a,b)=>a[0]-b[0]);const pos=[],idx=[];for(const [y,rx,rz,cx=0,cz=0] of rows)for(let j=0;j<=segments;j++){const t=j/segments*Math.PI*2;pos.push(cx+Math.sin(t)*rx,y,cz+Math.cos(t)*rz);}for(let r=0;r<rows.length-1;r++)for(let j=0;j<segments;j++){const k=r*(segments+1)+j;idx.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}for(const end of [0,rows.length-1]){const row=rows[end],center=pos.length/3;pos.push(row[3]||0,row[0],row[4]||0);for(let j=0;j<segments;j++){const k=end*(segments+1)+j;idx.push(...(end===0?[center,k+1,k]:[center,k,k+1]));}}const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();const o=mesh(parent,color,[0,0,0],[1,1,1],g);o.name=name;addCartoonOutline(o,resources,a.artStyle,.0017);return o;}
 const torso=group(body,'outfit'),neckWidth=a.artStyle==='anime'&&a.outfit==='tee'?.84:1;
 loft(torso,'tailored-torso',a.topColor,[[hip,.17*a.build,.105],[1.02*R,.16*a.build,.105],[1.30*R,shoulder*.92,.115],[1.36*R,shoulder,.105],[1.405*R,shoulder*.72,.088],[1.445*R,.102*neckWidth,.073],[1.45*R,.083*neckWidth,.068]]);
 loft(torso,'neck',a.skinColor,[[1.39*R,.079*neckWidth,.064],[1.54*R,.072*neckWidth,.066],[a.artStyle==='anime'?Math.max(1.57*R,chinY+.085*R):1.57*R,.082*neckWidth,.07]]);
 const skirt=['dress','robe'].includes(a.outfit);
 if(skirt)loft(torso,'skirt',a.outfit==='dress'?a.topColor:a.bottomColor,[[a.outfit==='robe'?.12*R:.46*R,.25*a.build,.15],[.68*R,.215*a.build,.13],[hip+.03,.17*a.build,.105]]);
 else loft(torso,'trousers-hip',a.bottomColor,[[.78*R,.16*a.build,.10],[.94*R,.17*a.build,.105]]);
 if(a.artStyle==='anime'&&a.outfit==='tee'){
  const points=Array.from({length:49},(_,i)=>{const t=i/48*Math.PI*2;return new THREE.Vector3(Math.sin(t)*.092*neckWidth,(1.454-.015*Math.max(0,Math.cos(t)))*R,Math.cos(t)*.076);});
  const curve=new THREE.CatmullRomCurve3(points.slice(0,-1),true),ring=mesh(torso,new THREE.Color(a.topColor).multiplyScalar(.70),[0,0,0],[1,1,1],own(new THREE.TubeGeometry(curve,64,.006,8,true)));ring.name='anime-crew-collar';
 }else line(torso,[[-.078,1.447*R,.072],[0,1.425*R,.082],[.078,1.447*R,.072]],ink,.0024);
 if(a.outfit==='hoodie'){loft(torso,'hood',a.topColor,[[1.34*R,.14,.12,0,-.055],[1.46*R,.15,.11,0,-.07],[1.49*R,.09,.06,0,-.085]]);for(const x of [-.045,.045])line(torso,[[x,1.43*R,.10],[x,1.25*R,.12]],'#e5ddc9',.003);line(torso,[[-.10,1.08*R,.11],[-.075,.99*R,.12],[.075,.99*R,.12],[.10,1.08*R,.11]],ink,.002);}
 if(['uniform','jacket','robe'].includes(a.outfit)){for(const side of [-1,1])polygon(torso,[[side*.07,1.44*R],[side*.165,1.38*R],[side*.10,1.22*R],[side*.025,1.35*R]],a.outfit==='uniform'?'#dcd4bf':a.bottomColor,.083,.002);if(a.outfit==='uniform')polygon(torso,[[-.017,1.36*R],[.017,1.36*R],[.027,1.16*R],[0,1.12*R],[-.027,1.16*R]],a.accessoryColor,.111,.002);else line(torso,[[0,.9*R,.109],[0,1.30*R,.125]],ink,.0025);}
 for(const x of [-.12,.12])line(torso,[[x,1.21*R,.11],[x*.87,1.12*R,.113],[x*.91,1.05*R,.115]],new THREE.Color(a.topColor).multiplyScalar(.64),.0017);
 const legs=[],arms=[];
 for(const side of [-1,1]){
  const leg=group(body,'leg',[side*.095*a.build,hip,0]);legs.push(leg);
  loft(leg,'leg-contour',skirt?a.skinColor:a.bottomColor,[[0,.078,.082],[-.28*R,.065,.068],[-.36*R,.058,.064],[-.395*R,.056,.062],[-.43*R,.055,.061],[-.75*R,.045,.05]]);
  const shoe=mesh(leg,a.shoeColor,[0,-.79*R,.04],[.065,.065*R,.13]);addCartoonOutline(shoe,resources,a.artStyle,.0017);line(leg,[[-.058,-.825*R,.13],[.058,-.825*R,.13]],ink,.002);
  const arm=group(body,'arm',[side*(shoulder-.02),1.37*R,0]);arms.push(arm);arm.rotation.z=side*.075;
  loft(arm,'sleeve',a.topColor,[[.025,.015,.035],[.005,.05,.068],[-.035*R,.073,.085],[-.095*R,.07,.078],[-.20*R,.058,.065]]);
  const longSleeve=['hoodie','jacket','robe'].includes(a.outfit);loft(arm,'forearm',longSleeve?a.topColor:a.skinColor,[[-.16*R,.052,.061],[-.222*R,.05,.056],[-.257*R,.048,.054],[-.289*R,.047,.052],[-.32*R,.046,.05],[-.48*R,.035,.04]]);
  const hand=mesh(arm,a.skinColor,[side*.012,-.53*R,.013],[.045,.083*R,.028]);addCartoonOutline(hand,resources,a.artStyle,.0014);
 }
 const face=group(head,'face');
 const faceScale=FACE_SCALES[a.faceShape];
 const faceGeo=own(new THREE.SphereGeometry(1,64,48));const attr=faceGeo.getAttribute('position');
 // Smooth art-directed normals keep facial relief from producing mask-like shadow bands.
 const faceDepth=[],faceNormals=[],faceNormal=new THREE.Vector3();
 for(let i=0;i<attr.count;i++){
  const x=attr.getX(i),y=attr.getY(i),z=attr.getZ(i);faceDepth.push(z);
  faceNormal.set(x/faceScale[0],y/faceScale[1],z*1.3/faceScale[2]).normalize();
  faceNormals.push(faceNormal.x,faceNormal.y,faceNormal.z);
  attr.setXYZ(i,...faceSurfacePoint(a.faceShape,x,y,z,a));
 }
 faceGeo.setAttribute('normal',new THREE.Float32BufferAttribute(faceNormals,3));
 const skin=mesh(face,a.skinColor,[0,0,0],[1,1,1],faceGeo);skin.name='face-skin';
 if(a.artStyle==='anime'){
  faceGeo.setAttribute('faceSourceDepth',new THREE.Float32BufferAttribute(faceDepth,1));
  skin.material=createCartoonMaterial(a.skinColor,{style:'anime',surface:'face'});
  resources.material.add(skin.material);
 }
 addCartoonOutline(skin,resources,a.artStyle,.0018);
 if(a.muzzleDepth>0)faceGeo.computeVertexNormals();
 // Project illustrated feature meshes onto the very same facial surface.
 const frontAt=(x,y)=>{let lo=-1,hi=1;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(faceSurfacePoint(a.faceShape,0,mid,0,a)[1]<y)lo=mid;else hi=mid;}const yy=(lo+hi)/2;lo=0;hi=1;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(Math.abs(faceSurfacePoint(a.faceShape,mid,yy,0,a)[0])<Math.abs(x))lo=mid;else hi=mid;}const xx=(lo+hi)/2;return faceSurfacePoint(a.faceShape,xx,yy,Math.sqrt(Math.max(.003,1-xx*xx-yy*yy)),a)[2];};
 const featureZ=(parent,x,y,lift)=>{if(a.artStyle==='anime')lift*=.2;if(parent===head)return frontAt(x,y)+lift;const c=Math.cos(parent.rotation.z),s=Math.sin(parent.rotation.z),xx=x*parent.scale.x,yy=y*parent.scale.y;return(frontAt(parent.position.x+xx*c-yy*s,parent.position.y+xx*s+yy*c)+lift-parent.position.z)/parent.scale.z;};
 const facialPatch=(parent,points,color,origin=[0,0],lift=.003,holes=[])=>{const shape=new THREE.Shape();shape.moveTo(...points[0]);points.slice(1).forEach(p=>shape.lineTo(...p));shape.closePath();for(const points of holes){const hole=new THREE.Path();hole.moveTo(...points[0]);points.slice(1).forEach(p=>hole.lineTo(...p));hole.closePath();shape.holes.push(hole);}const flat=new THREE.ShapeGeometry(shape),base=flat.toNonIndexed(),bp=base.attributes.position,vertices=[];const split=(a,b,c,depth=0)=>{const dist=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);if(depth<5&&Math.max(dist(a,b),dist(b,c),dist(c,a))>.022){const mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2],ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);split(a,ab,ca,depth+1);split(ab,b,bc,depth+1);split(ca,bc,c,depth+1);split(ab,bc,ca,depth+1);}else for(const p of [a,b,c])vertices.push(p[0],p[1],featureZ(parent,p[0],p[1],lift));};for(let i=0;i<bp.count;i+=3)split([bp.getX(i),bp.getY(i)],[bp.getX(i+1),bp.getY(i+1)],[bp.getX(i+2),bp.getY(i+2)]);flat.dispose();base.dispose();const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();return mesh(parent,color,[0,0,0],[1,1,1],geo,true);};
 const facialLine=(parent,points,color=ink,r=.002,origin=[0,0],lift=.005)=>{
  const stroke=line(parent,points.map(([x,y])=>[x,y,featureZ(parent,x,y,lift)]),color,r);
  // Anime ink is a flat ribbon, not a raised tube. Keep its XY outline but
  // project every vertex to the face so paint need not float above thick ink.
  if(a.artStyle==='anime'){const p=stroke.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,featureZ(parent,p.getX(i),p.getY(i),lift));p.needsUpdate=true;stroke.geometry.computeVertexNormals();stroke.material=mat(color,true);}
  return stroke;
 };
 const ovalPoints=(cx,cy,rx,ry,n=32)=>Array.from({length:n},(_,i)=>{const t=i/n*Math.PI*2;return[cx+Math.cos(t)*rx,cy+Math.sin(t)*ry];});
 if(a.muzzleTint){
  const width=Math.max(.7,Math.min(1.3,a.muzzleWidth||1));
  const positions=[],indices=[],rings=16,segments=64;
  for(let r=0;r<=rings;r++)for(let j=0;j<=segments;j++){
   const t=j/segments*Math.PI*2,v=r/rings,yy=-.46+Math.sin(t)*.32*v;
   const xx=Math.max(-Math.sqrt(1-yy*yy)*.96,Math.min(Math.sqrt(1-yy*yy)*.96,Math.cos(t)*.57*width*v));
   const q=faceSurfacePoint(a.faceShape,xx,yy,Math.sqrt(Math.max(0,1-xx*xx-yy*yy)),a);q[2]+=.0035;positions.push(...q);
   if(r<rings&&j<segments){const k=r*(segments+1)+j;indices.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2);}
  }
  const geometry=own(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const tint=mesh(head,a.muzzleColor,[0,0,0],[1,1,1],geometry,true);
  tint.name='muzzle-tint';
 }
 for(const side of [-1,1]){
  if(a.blush>.03){const shade=new THREE.Color(a.skinColor).lerp(new THREE.Color('#c47d76'),a.blush*.45);facialPatch(head,ovalPoints(side*.145,-.068,.037,.014),shade,[0,0],.002);}
 }
 const eyes=[];
 drawFaceDetails({a,head,mesh,line,polygon,facialPatch,facialLine,ovalPoints,faceScale,ink,outline:o=>addCartoonOutline(o,resources,a.artStyle,.0014)});
 for(const side of [-1,1]){
  const ex=side*(.089+a.eyeSpacing),ey=.035+a.eyeY,e=group(head,'eye',[ex,ey,frontAt(ex,ey)]);e.rotation.z=side*a.eyeRotation*Math.PI/180;e.scale.set(a.eyeSize*a.eyeWidth,a.eyeSize*a.eyeHeight,a.eyeSize);eyes.push(e);
  const eyeColor=side===1&&a.heterochromia?a.rightEyeColor:a.eyeColor,origin=[ex,ey];
  if(drawAnimeEye({a,e,side,eyeColor,facialPatch,facialLine,ovalPoints})){}
  else if(drawCatalogEye({a,e,side,eyeColor,facialPatch,facialLine,ovalPoints,ink})){}
  else if(a.eyeStyle==='closed')facialLine(e,[[-.049,0],[-.021,.009],[.013,.010],[.048,0]],ink,.0027,origin);
  else if(a.eyeStyle==='dot')facialPatch(e,ovalPoints(0,0,.009,.013),ink,origin,.004);
  else if(a.eyeStyle!=='none'){
   let sx=.054,sy=.025;if(a.eyeStyle==='round'){sx=.044;sy=a.artStyle==='satire'?.038:.028;}if(a.eyeStyle==='anime'){sx=.055;sy=.032;}if(a.eyeStyle==='narrow'){sx=.055;sy=.017;}if(a.eyeStyle==='sleepy'){sx=.052;sy=.019;}if(a.eyeStyle==='sharp')e.rotation.z+=side*.075;
   const lid=1-a.eyeLid*.4;
   const pts=[[-sx,0],[-sx*.60,sy*.72*lid],[-sx*.13,sy*lid],[sx*.45,sy*.8*lid],[sx,sy*.04],[sx*.50,-sy*.64],[0,-sy*.8],[-sx*.62,-sy*.5]];
   facialPatch(e,pts,'#e7e5dc',origin,.003);
   const ry=sy*(a.eyeStyle==='round'?.78:.97),rx=Math.min(ry*.91,sx*.62),clip=points=>points.map(([x,y])=>[x,Math.min(sy*lid*.90,Math.max(-sy*.72,y))]);
   facialPatch(e,clip(ovalPoints(.002,.001,rx,ry)),eyeColor,origin,.005);
   facialPatch(e,clip(ovalPoints(.002,.001,rx*.64,ry*.80)),ink,origin,.006);
   facialLine(e,pts.slice(0,5),ink,a.artStyle==='satire'?.0034:.0025,origin,.007);
   facialLine(e,[pts[4],pts[5],pts[6],pts[7],pts[0]],ink,.0013,origin,.006);
   if(a.artStyle==='drama'||a.eyeStyle==='sleepy')facialLine(e,[[-sx*.77,-sy*1.36],[-sx*.1,-sy*1.58],[sx*.5,-sy*1.28]],new THREE.Color(a.skinColor).multiplyScalar(.62),.0012,origin,.003);
  }
  if(!a.eyeStyle.startsWith('anime_'))drawEyeDetails({a,e,facialPatch,facialLine,ovalPoints,ink,profile:FEATURE_PROFILES[a.eyeStyle]});
  e.userData.baseScaleY=e.scale.y;
  if(a.browStyle!=='none'){
   const bx=side*(.092+a.browSpacing),by=.089+a.browY,b=group(head,'brow',[bx,by,frontAt(bx,by)]);b.scale.set(a.browSize*a.browWidth,a.browSize*a.browHeight,a.browSize);b.rotation.z=side*a.browRotation*Math.PI/180;
   if(!drawAnimeBrow({a,b,side,facialPatch})&&!drawCatalogBrow({a,b,side,facialPatch,facialLine,ovalPoints})){const arch=a.browStyle==='straight'?0:a.browStyle==='arched'?.013:.006,w=a.browStyle==='thick'?.012:a.browStyle==='thin'?.003:.007;
   facialPatch(b,[[-.05,-.003],[-.01,arch],[.036,arch*.2],[.05,-.002],[.03,w+arch*.2],[-.01,w+arch],[-.045,.003]],a.browColor,[bx,by],.005);}
  }
 }
 if(a.noseStyle!=='none'){
  const nx=a.noseX,ny=-.025+a.noseY,n=group(head,'nose',[nx,ny,frontAt(nx,ny)]);n.scale.setScalar(a.noseSize);
  if(!drawAnimeNose({a,n,facialPatch,facialLine,ovalPoints})){
  const np=FEATURE_PROFILES[a.noseStyle],width=np?.w??(a.noseStyle==='wide'?.036:a.noseStyle==='small'?.021:.027),bridge=a.noseBridge*(np?np.depth/.035:(a.noseStyle==='point'?1.3:a.noseStyle==='small'?.7:1));
  if(np?.kind==='capsule'||np?.kind==='ball'){
   const depth=np.depth*Math.max(.6,Math.min(1.5,a.noseBridge));
   const roundNose=mesh(n,a.skinColor,[0,-.005,featureZ(n,0,-.005,depth*.32*a.noseSize)],[np.w,np.h,depth],sphere);
   roundNose.name='rounded-nose';addCartoonOutline(roundNose,resources,a.artStyle,.0012);
  }else{
  const verts=[[-width*.33,.055,frontAt(nx,ny+.055)],[width*.33,.055,frontAt(nx,ny+.055)],[-width,-.045,frontAt(nx-width,ny-.045)+.009],[0,-.038,frontAt(nx,ny-.038)+.035*bridge],[width,-.045,frontAt(nx+width,ny-.045)+.009],[0,-.058,frontAt(nx,ny-.058)+.018*bridge]];
  if(np){for(const v of verts){v[1]*=np.h/.055;if(np.kind==='hook'&&v[0]===0)v[1]-=.018;if(np.kind==='up'&&v[0]===0)v[1]+=.018;if(np.kind==='box')v[0]*=v[1]>0?2:1;if(np.kind==='triangle'&&v[1]>0)v[0]=0;}}
  for(const v of verts){const lift=v[2]-frontAt(nx+v[0],ny+v[1]);v[2]=featureZ(n,v[0],v[1],Math.max(0,lift)*a.noseSize);}
  const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(verts.flat(),3));geo.setIndex([0,2,3,0,3,1,1,3,4,2,5,3,3,5,4]);geo.computeVertexNormals();if(np?.kind==='round'){mesh(n,a.skinColor,[0,-np.h*.32,featureZ(n,0,-np.h*.32,np.depth*.3)],[np.w,np.h*.5,np.depth*.65],sphere);}else if(np?.kind==='line'||np?.kind==='curve'){facialLine(n,[[0,np.h*.6],[-np.w*.18,0],[-np.w*.7,-np.h*.3],[np.w*.3,-np.h*.36]],ink,.0018);}else mesh(n,a.skinColor,[0,0,0],[1,1,1],geo);
  if(np){if(!['round','line','curve'].includes(np.kind)){const lifted=v=>[v[0],v[1],v[2]+.004];line(n,[lifted(verts[0]),lifted(verts[2]),lifted(verts[5])],new THREE.Color(a.skinColor).multiplyScalar(.54),.0018);for(const side of[-1,1]){const edge=side<0?verts[2]:verts[4];line(n,[[edge[0]*.72,edge[1],edge[2]+.008],[edge[0]*.42,verts[5][1],verts[5][2]+.007]],ink,.0016);}}else if(np.kind==='round')facialLine(n,[[-width*.5,-np.h*.6],[0,-np.h*.78],[width*.5,-np.h*.6]],new THREE.Color(a.skinColor).multiplyScalar(.54),.0016,[0,0],np.depth*.8);}
  else{
  line(n,[[-width*.3,.045,verts[0][2]+.003],[-width*.6,-.021,featureZ(n,-width*.6,-.021,.025*bridge*a.noseSize)],[-width,-.045,verts[2][2]+.002]],new THREE.Color(a.skinColor).multiplyScalar(.54),.0015);
  for(const side of [-1,1])line(n,[[side*width*.36,-.049,verts[5][2]+.004],[side*width*.75,-.047,verts[2][2]+.006]],ink,.0018);
  }
  }
 }
 }
 const mx=a.mouthX,my=-.132+a.mouthY,mouth=group(head,'mouth',[mx,my,frontAt(mx,my)]);mouth.scale.set(a.mouthSize*a.mouthWidth,a.mouthSize*a.mouthHeight,a.mouthSize);mouth.rotation.z=a.mouthRotation*Math.PI/180;
 if(a.mouthStyle!=='none'){
  if(!drawAnimeMouth({a,mouth,facialLine})&&!drawCatalogMouth({a,mouth,facialPatch,facialLine,ovalPoints,ink})){const origin=[mx,my],width=a.mouthStyle==='pout'?.032:.050,curve=a.mouthStyle==='smile'?-.006:a.mouthStyle==='frown'?.006:0;
  if(a.mouthStyle==='cat'){facialLine(mouth,[[-width,0],[-width*.5,-.012],[0,0],[width*.5,-.012],[width,0]],ink,.002,origin,.006);}
  else if(a.mouthStyle==='open'||a.mouthStyle==='grin'){facialPatch(mouth,[[-width,.004],[0,.008],[width,.004],[width*.78,-.019],[0,-.024],[-width*.78,-.019]],ink,origin,.004);if(a.mouthStyle==='grin')facialPatch(mouth,[[-width*.82,.002],[width*.82,.002],[width*.7,-.008],[-width*.7,-.008]],'#ddd9c9',origin,.006);}
  else{facialPatch(mouth,[[-width,0],[-width*.25,.004],[0,.002],[width*.23,.004],[width,0],[width*.48,-.009],[0,-.011],[ -width*.50,-.007]],new THREE.Color(a.mouthColor).lerp(new THREE.Color(a.skinColor),.4),origin,.003);facialLine(mouth,[[-width,0],[-width*.3,curve],[width*.25,curve],[width,0]],ink,.0018,origin,.006);}
  facialLine(mouth,[[-width*.37,-.023],[width*.18,-.024]],new THREE.Color(a.skinColor).multiplyScalar(.72),.0012,origin,.003);}
 }
 const stippledMuzzle=a.muzzleTint&&a.facialHair==='stubble';
 if(a.facialHair&&a.facialHair!=='none'&&!stippledMuzzle){
  if(!drawCatalogBeard({a,head,facialPatch,facialLine,ovalPoints})){const fc=a.facialHair==='stubble'?new THREE.Color(a.skinColor).lerp(new THREE.Color(a.facialHairColor),.40):a.facialHairColor;
  if(a.facialHair==='moustache'){for(const side of [-1,1])facialPatch(head,[[side*.004,-.088],[side*.036,-.094],[side*.072,-.116],[side*.014,-.108]],fc,[0,0],.005);}
  else {
   const normalized=[[-.89,-.12],[-.86,-.40],[-.62,-.73],[-.30,-.94],[0,-.985],[.30,-.94],[.62,-.73],[.86,-.40],[.89,-.12],[.65,-.35],[.28,-.33],[0,-.32],[-.28,-.33],[-.65,-.35]];
   const edge=normalized.map(([x,y])=>faceSurfacePoint(a.faceShape,x,y,0,a).slice(0,2));
   const mouthHole=ovalPoints(mx,my-.002,.056,.012,28);
   facialPatch(head,edge,fc,[0,0],.004,[mouthHole]);
   // Wrap sideburns and lower beard around the actual cheek surface.
   const beardPos=[],beardIdx=[],br=20,bc=28;for(let r=0;r<=br;r++){const v=r/br,y=-.15-v*.78;for(let c=0;c<=bc;c++){const t=-Math.PI*.77+c/bc*Math.PI*1.54;const radius=Math.sqrt(Math.max(0,1-y*y));const q=faceSurfacePoint(a.faceShape,Math.sin(t)*radius,y,Math.cos(t)*radius,a);beardPos.push(q[0]*1.018,q[1],q[2]*1.025);if(r<br&&c<bc&&Math.abs(t)>.86){const k=r*(bc+1)+c;beardIdx.push(k,k+1,k+bc+1,k+1,k+bc+2,k+bc+1);}}}const bg=own(new THREE.BufferGeometry());bg.setAttribute('position',new THREE.Float32BufferAttribute(beardPos,3));bg.setIndex(beardIdx);bg.computeVertexNormals();const bm=mesh(head,fc,[0,0,0],[1,1,1],bg);bm.material=mat(fc,true).clone();bm.material.side=THREE.DoubleSide;resources.material.add(bm.material);
  }
 }
 }
 // Legacy stubble is an opaque beard-shaped wash. On a separately coloured
 // muzzle use the existing actual hair marks, so the wash cannot hide its colour
 // or clip the mouth. Existing avatars without the new tint keep their rendering.
 drawFacialHairLayers({a:stippledMuzzle&&a.stubbleStyle==='none'?{...a,stubbleStyle:'stubble_4'}:a,head,facialPatch,facialLine,ovalPoints});
 // Hair is its own layer; changing it never changes clothes, glasses, or jewelry.
 const hair=group(head,'hair');const hc=a.hairColor;
 const customHair=(a.hairFront&&a.hairFront!=='auto')||(a.hairBack&&a.hairBack!=='auto')||a.hairTwoTone;
 const hairParts=resolveHairParts(a);
 const lock=(x,y,z,sx,sy,sz,rz=0)=>{const pos=[],idx=[],rings=14,segments=16;for(let r=0;r<=rings;r++){const v=r/rings,taper=Math.pow(Math.sin(Math.PI*v),.7)*(1-.32*v),sweep=Math.sin(v*Math.PI)*sx*.24;for(let j=0;j<=segments;j++){const t=j/segments*Math.PI*2;pos.push(sweep+Math.sin(t)*sx*taper,(.5-v)*2*sy,Math.cos(t)*sz*taper);}}for(let r=0;r<rings;r++)for(let j=0;j<segments;j++){const k=r*(segments+1)+j;idx.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2);}const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();const m=mesh(hair,hc,[x,y,z],[1,1,1],geo);m.rotation.z=rz;m.name='sculpted-hair-lock';addCartoonOutline(m,resources,a.artStyle,.0012);return m;};
 if(customHair?(hairParts.front!=='none'||hairParts.back!=='none'):a.hairStyle!=='bald'){
 const cap=own(new THREE.SphereGeometry(1,40,24,0,Math.PI*2,0,Math.PI*.49));const cp=cap.getAttribute('position');for(let i=0;i<cp.count;i++){let x=cp.getX(i),y=cp.getY(i),z=cp.getZ(i);const radial=Math.hypot(x,z);if(radial>.00001){const theta=Math.acos(Math.max(-1,Math.min(1,y))),next=theta*(1.57-(customHair?(hairParts.front.startsWith('receding_')?1.10:.90):.48)*Math.max(0,z/radial)-(customHair&&hairParts.front.startsWith('receding_')?.20*(x/radial)**2*Math.max(0,z/radial):0))/(Math.PI*.49),scale=Math.sin(next)/radial;x*=scale;z*=scale;y=Math.cos(next);}const q=faceSurfacePoint(a.faceShape,x,y,z,a);cp.setXYZ(i,q[0]*1.04,q[1]*1.04+.006+(customHair?hairCrownLift(hairParts.front,...q):0),q[2]*1.06);}cap.computeVertexNormals();const crown=mesh(hair,hc,[0,0,0],[1,1,1],cap);crown.name='hair-crown';addCartoonOutline(crown,resources,a.artStyle,.0015);
 if(customHair){buildCustomHair({a,hair,own,mesh,mat,resources,faceScale,frontAt});}else{
 const fringe=(side=1,flat=false)=>{const positions=[],uvs=[],indices=[],cols=32,rows=8;for(let r=0;r<=rows;r++){const v=r/rows;for(let c=0;c<=cols;c++){const u=c/cols,rawX=(u-.5)*1.84;let x=faceSurfacePoint(a.faceShape,rawX,.53,0,a)[0];const top=.17+.10*Math.sqrt(Math.max(0,1-(x/.25)**2)),bottom=flat?.135:.137+.018*Math.sin(u*Math.PI*2+.4)-.035*Math.exp(-(((u-.86)/.10)**2)),y=top*(1-v)+bottom*v;const yn=Math.min(.995,y/(.282*faceScale[1])),edge=Math.abs(faceSurfacePoint(a.faceShape,Math.sqrt(1-yn*yn),yn,0,a)[0]);x=Math.sign(x)*Math.min(Math.abs(x),edge*.98);const z=frontAt(x,y)+.012;positions.push(x*side,y,z);uvs.push(u,v);if(r<rows&&c<cols){const k=r*(cols+1)+c;indices.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}}}const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();const m=mesh(hair,hc,[0,0,0],[1,1,1],geo);m.material=mat(hc).clone();m.material.side=THREE.DoubleSide;resources.material.add(m.material);return m;};
 const back=(length=.3)=>{
  const positions=[],uvs=[],indices=[],cols=40,rows=24;
  for(let r=0;r<=rows;r++){const v=r/rows,y=.29-v*(.45+length);
   // A rounded crown joins inside the cap, opens around the cranium, then
   // gently turns inward toward the hem. No exposed cylindrical top rim.
   const radius=y>=.03?.27*Math.sqrt(Math.max(0,1-((y-.028)/.29)**2))+.008:.278-.028*((.03-y)/(.19+length))**2;
   for(let c=0;c<=cols;c++){const u=c/cols,t=.93+u*(Math.PI*2-1.86);positions.push(Math.sin(t)*radius*faceScale[0],(y+.004*Math.cos(t*7)*v**4)*faceScale[1],(Math.cos(t)*radius*.75-.012)*faceScale[2]);uvs.push(u,v);if(r<rows&&c<cols){const k=r*(cols+1)+c;indices.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}}
  }
  const geo=own(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();const m=mesh(hair,hc,[0,0,0],[1,1,1],geo);m.name='hair-back';m.material=mat(hc).clone();m.material.side=THREE.DoubleSide;resources.material.add(m.material);return m;
 };
 const tails=(double=false)=>{for(const s of double?[-1,1]:[1]){lock(s*(double?.255:.18),.11,-.13,.09,.14,.09,s*.2);lock(s*(double?.30:.21),-.14,-.13,.075,.22,.07,s*.12);mesh(hair,a.accessoryColor,[s*(double?.26:.19),.06,-.12],[.09,.02,.09]);}};
 switch(a.hairStyle){case'crop':for(let j=0;j<4;j++)lock((j-1.5)*.083,.18,.155,.059,.095,.032,-.45);break;case'side':fringe(-1);break;case'bob':back(.15);fringe();for(const s of [-1,1])lock(s*.24,-.015,.015,.043,.205,.10);break;case'bun':lock(0,.31,-.09,.12,.11,.11);fringe();break;case'braids':fringe();for(const s of [-1,1])for(let j=0;j<5;j++)lock(s*(.225+j*.005),-.02-j*.064,-.05,.054-j*.005,.053,.055);break;case'curls':for(let j=0;j<6;j++){const t=j/5*Math.PI;lock(Math.cos(t)*.22,.14+Math.sin(t)*.13,.10,.085,.115,.065,(j-2)*.18);}break;case'ponytail':tails();fringe();break;case'quiff':lock(-.035,.235,.105,.17,.115,.085,-.42);fringe(-1);break;case'afro':for(let j=0;j<9;j++){const t=j/8*Math.PI;lock(Math.cos(t)*.24,.12+Math.sin(t)*.18,.015,.105,.14,.13,(j-4)*-.18);}break;case'long':back(.48);fringe();for(const s of [-1,1])lock(s*.24,-.13,-.02,.045,.27,.08);break;case'twintop':fringe();for(const s of [-1,1])lock(s*.23,.26,-.025,.11,.12,.11);break;case'twintails':tails(true);fringe();break;case'spiky':for(let j=0;j<5;j++){const t=(j-2)*.34;lock(Math.sin(t)*.21,.22+Math.cos(t)*.065,.04,.08,.16,.075,-t-.4);}fringe(-1);break;case'hime':back(.48);fringe(1,true);for(const s of [-1,1])mesh(hair,hc,[s*.225,-.02,.07],[.055,.30,.09],box);break;case'mohawk':for(let j=0;j<5;j++)lock(0,.28+j*.012,.16-j*.075,.065,.11,.07);break;case'pixie':fringe(-1);lock(-.23,.08,.01,.055,.10,.08);break;case'waves':back(.43);fringe();for(const s of [-1,1])for(let j=0;j<3;j++)lock(s*(.23+Math.sin(j*1.8)*.02),-.02-j*.14,-.025,.055,.16,.05,s*(.18-j*.1));break;}
 }}
 if(a.hairMirror&&!customHair)hair.scale.x=-1;
 if(a.glasses!=='none'&&!drawCatalogGlasses({a,head,group,line,polygon})){
  const glasses=group(head,'glasses',[0,.035+a.eyeY+a.glassesY,.190]),size=a.glassesSize,w=.065*size,h=.045*size;
  for(const s of a.glasses==='monocle'?[1]:[-1,1]){const x=s*(.093+a.eyeSpacing);
   if(a.glasses==='square'){const corners=[[x-w,h,0],[x+w,h,0],[x+w,-h,0],[x-w,-h,0]],points=corners.flatMap((p,i)=>{const q=corners[(i+1)%4];return[[p[0]*.97+q[0]*.03,p[1]*.97+q[1]*.03,0],[p[0]*.03+q[0]*.97,p[1]*.03+q[1]*.97,0]];});line(glasses,[...points,points[0]],a.glassesColor,.007*a.glassesThickness);}
   else mesh(glasses,a.glassesColor,[x,0,0],[size,.86*size,1],own(new THREE.TorusGeometry(.064,.007*a.glassesThickness,8,32)));
   if(a.glasses==='sunglasses'&&a.glassesLens==='auto'||a.glassesLens==='opaque'||a.glassesLens==='tint')mesh(glasses,a.glassesLens==='tint'?'#8d9c9b':a.glassesColor,[x,0,0],[.06*size,.047*size,.008],sphere,true);
  }
  if(a.glasses!=='monocle'){const inner=.093+a.eyeSpacing-w;line(glasses,[[-inner,.012,0],[0,.021,.006],[inner,.012,0]],a.glassesColor,.006);}
  for(const side of a.glasses==='monocle'?[1]:[-1,1])line(glasses,[[side*(.093+a.eyeSpacing+w),0,0],[side*.235,-.005,-.075],[side*.25,-.035,-.16]],a.glassesColor,.003);
 }

 const ac=a.accessoryColor;
 if(a.accessory==='bow'){for(const s of [-1,1]){const bow=mesh(head,ac,[s*.058,.29,.10],[.065,.043,.025]);bow.rotation.z=s*.4;}mesh(head,ac,[0,.29,.12],[.024,.025,.025]);}
 if(a.accessory==='flower'){for(let j=0;j<5;j++){const t=j*Math.PI*2/5;mesh(head,ac,[.22+Math.cos(t)*.033,.13+Math.sin(t)*.033,.18],[.026,.026,.012]);}mesh(head,'#fff5d0',[.22,.13,.197],[.018,.018,.008]);}
 if(a.accessory==='catEars'||a.accessory==='horns'){for(const s of [-1,1]){if(a.accessory==='horns'){const horn=mesh(head,ac,[s*.17,.32,0],[1,1,1],own(new THREE.ConeGeometry(.05,.18,16)));horn.rotation.z=-s*.25;}else{polygon(head,[[s*.11,.21],[s*.26,.20],[s*.23,.40]],ac,.015,.045);polygon(head,[[s*.15,.24],[s*.235,.24],[s*.22,.35]],'#edb1b7',.07,.005);}}}
 if(a.accessory==='headband')line(head,[[-.26,.08,0],[-.22,.24,.03],[0,.31,.04],[.22,.24,.03],[.26,.08,0]],ac,.022);
 if(a.accessory==='earrings')for(const s of [-1,1])mesh(head,ac,[s*.27,-.10,.02],[1,1,1],own(new THREE.TorusGeometry(.03,.006,8,24)));
 if((a.strokes.length||a.faceArt.length)&&typeof document!=='undefined'){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;drawAppearancePaint(canvas.getContext('2d'),a,512);
 const geo=own(createFacePaintGeometry(a));const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;resources.texture.add(tex);const pm=new THREE.MeshBasicMaterial({map:tex,toneMapped:false,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});resources.material.add(pm);const paint=new THREE.Mesh(geo,pm);paint.name='face-paint';paint.renderOrder=3;head.add(paint);
 }
 const notes=group(body,'music-notes',[.4,1.64*R,.05]);notes.userData.baseY=1.64*R;for(let n=0;n<2;n++){mesh(notes,'#c18a46',[n*.18,n*.14,0],[.055,.035,.025]);mesh(notes,'#c18a46',[n*.18+.04,n*.14+.09,0],[.015,.2,.025],box);}notes.visible=false;
 const rig=bindHumanoid({body,head,torso,arms,legs,R,resources,mesh,color:a.skinColor});
 root.traverse(o=>{if(o.isMesh)o.userData.actorId=data.id;});
 return {...data,appearance:a,mesh:root,get position(){return root.position;},get facing(){return root.rotation.y;},get faceDirection(){return new THREE.Vector3(Math.sin(root.rotation.y),0,Math.cos(root.rotation.y));},_rig:rig,_body:body,_head:head,_faceDepth:frontAt,_eyes:eyes,_mouth:mouth,_mouthBaseScale:mouth.scale.clone(),_expression:'smile',_legs:legs,_arms:arms,_musicNotes:notes,_phase:index*1.7,_resources:resources};
}
export function disposeCustomActor(actor){const r=actor?._resources;if(!r)return;for(const set of Object.values(r)){for(const item of set)item.dispose();set.clear();}actor.mesh.removeFromParent();}
