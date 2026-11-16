import {createShoreRipples} from './shoreRipples.js';
import {makeEscarpment} from './terrain.js';
import {T,W,H} from '../camp/grid.js';

const TILE=.75, EXTENT=64, RES=1536, PAD=14;
const grass=[[153,165,93],[161,172,95],[177,182,102],[143,157,87]];
const sand=[[241,209,155],[246,215,163],[235,202,148],[249,221,173]];
const water=[[68,151,177],[76,164,185],[84,177,190],[100,193,197],[128,211,205]];
const noise=new Float32Array(128*128);
let seed=1932480;
function next(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<noise.length;i++)noise[i]=next();
function field(x,z){
 const a=Math.floor(x),b=Math.floor(z),u=x-a,v=z-b;
 const row=(b&127)*128,second=((b+1)&127)*128;
 return (noise[row+(a&127)]*(1-u)+noise[row+((a+1)&127)]*u)*(1-v)
       +(noise[second+(a&127)]*(1-u)+noise[second+((a+1)&127)]*u)*v;
}
// Distances are measured from cell centers. The zero contour falls halfway
// between authoritative water and land cells, also after a single-cell edit.
function coastField(grid){
 const n=W+2*PAD,m=H+2*PAD;
 const dist=new Float32Array(n*m),land=new Uint8Array(n*m);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)land[(y+PAD)*n+x+PAD]=Number(grid.base[y*W+x]>=T.SAND);
 for(let y=0;y<m;y++)for(let x=0;x<n;x++){
  const i=y*n+x;
  dist[i]=((x>0&&land[i-1]!==land[i])||(x+1<n&&land[i+1]!==land[i])||
   (y>0&&land[i-n]!==land[i])||(y+1<m&&land[i+n]!==land[i]))?.5:100;
 }
 for(let i=n+1;i<n*(m-1)-1;i++)dist[i]=Math.min(dist[i],dist[i-1]+1,dist[i-n]+1,dist[i-n-1]+1.414,dist[i-n+1]+1.414);
 for(let i=n*(m-1)-2;i>n;i--)dist[i]=Math.min(dist[i],dist[i+1]+1,dist[i+n]+1,dist[i+n+1]+1.414,dist[i+n-1]+1.414);
 for(let i=0;i<dist.length;i++)if(!land[i])dist[i]*=-1;
 return dist;
}
function paintMap(canvas,grid){
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(RES,RES),pixels=image.data;
 const distance=coastField(grid), stride=W+2*PAD;
 for(let iy=0;iy<RES;iy++){
  const z=(iy+.5)*EXTENT/RES-EXTENT/2,gy=z/TILE+32;
  const b=Math.floor(gy),v=gy-b;
  for(let ix=0;ix<RES;ix++){
   const x=(ix+.5)*EXTENT/RES-EXTENT/2,gx=x/TILE+32,a=Math.floor(gx),u=gx-a;
   const index=(b+PAD)*stride+a+PAD;
   const inside=a>=-1&&b>=-1&&a<W&&b<H;
   const wash=field(x*.65,z*.65),grain=field(x*4,z*4);
   const d=((distance[index]*(1-u)+distance[index+1]*u)*(1-v)+(distance[index+stride]*(1-u)+distance[index+stride+1]*u)*v)+(grain-.5)*.24;
   const tile=Math.round(gy)*W+Math.round(gx),kind=inside?grid.base[tile]:0;
   let col;
   if(d<0){
    const band=-d+(wash-.5)*1.4;
    col=water[band>8?0:band>5?1:band>2.8?2:band>1.2?3:4];
    if(d>-.115||(d<-.50&&d>-.57&&wash>.45))col=[218,243,221];
   }else{
    const patch=field(x*.68+grain*.7,z*.85);
    const tint=patch>.81?3:patch>.55?2:patch>.25?1:0;
    const clearing=((x-.8)/8.6)**2+((z-2.2)/(z>2?9:5.2))**2;
    // Interpolate the four categorical samples at their centers. Tile picking
    // keeps exact integer bounds, while pigment and worn edges cross seams.
    const corners=[grid.base[b*W+a],grid.base[b*W+a+1],grid.base[(b+1)*W+a],grid.base[(b+1)*W+a+1]];
    const cover=k=>(Number(corners[0]===k)*(1-u)+Number(corners[1]===k)*u)*(1-v)+(Number(corners[2]===k)*(1-u)+Number(corners[3]===k)*u)*v;
    const edge=.5+(grain-.5)*.54+(wash-.5)*.26;
    col=cover(T.SAND)>edge||d<1.14+(wash-.5)*.5||clearing+wash*.24<1?sand[tint]:grass[tint];
    if(cover(T.FOREST)>edge)col=[[132,151,87],[138,155,90],[150,162,97],[121,145,87]][tint];
    if(cover(T.ROCK)>edge||kind===T.CLIFF)col=[[151,150,109],[147,147,109],[159,157,122],[142,144,105]][tint];
    if(cover(T.SOIL)>edge)col=[[221,189,144],[214,184,142],[228,198,149],[219,196,155]][tint];
    if(grid.skin[tile])col=[col[0]*.94,col[1]*.92,col[2]*.86];
    if(grid.road[tile])col=[[0,0,0],[177,141,100],[153,152,143],[149,111,82]][grid.road[tile]]||col;
   }
   const p=(iy*RES+ix)*4,shade=(grain-.5)*2.6;
   pixels[p]=col[0]+shade;pixels[p+1]=col[1]+shade;pixels[p+2]=col[2]+shade;pixels[p+3]=255;
  }
 }
 ctx.putImageData(image,0,0);
 let state=12049;
 const rnd=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 ctx.save();ctx.translate(RES/2,RES/2);ctx.scale(RES/EXTENT,RES/EXTENT);
 for(let j=0;j<8700;j++){
  const x=(rnd()-.5)*EXTENT,z=(rnd()-.5)*EXTENT,tx=Math.round(x/TILE)+32,ty=Math.round(z/TILE)+32;
  const k=tx<0||ty<0||tx>=W||ty>=H?0:grid.base[ty*W+tx];
  const wet=k<2;
  if(!wet&&(grid.road[ty*W+tx]||rnd()>.67))continue;
  const length=wet?.11+rnd()**3*1.6:.024+rnd()*.14;
  ctx.strokeStyle=wet?'rgba(215,241,221,.22)':k===T.SAND?'rgba(166,123,81,.44)':'rgba(107,117,67,.52)';
  ctx.lineWidth=wet?.023:.018;ctx.beginPath();ctx.moveTo(x,z);ctx.quadraticCurveTo(x+length*.5,z-.035,x+length,z);ctx.stroke();
 }
 // Submerged reef gardens are painted in the same blue as the water. Silhouettes
 // lose contrast offshore and leave the bright foam contour unobstructed.
 const shoreDistance=(x,y)=>distance[(y+PAD)*stride+x+PAD];
 for(let j=0;j<270;j++){
  const tx=Math.floor(rnd()*W),ty=Math.floor(rnd()*H);
  const d=shoreDistance(tx,ty);
  if(d> -2.3||d< -8.5||rnd()<.43)continue;
  const x=(tx-32)*TILE,z=(ty-32)*TILE,spread=.28+rnd()*.7;
  ctx.fillStyle='rgba(42,103,143,.105)';ctx.beginPath();
  ctx.ellipse(x,z,spread*1.7,spread*.62,-.11,0,2*Math.PI);ctx.fill();
  for(let k=0;k<10;k++){
   const dx=(rnd()-.5)*spread*1.9,stem=spread*(.45+rnd()*.98),sway=(rnd()-.42)*stem;
   const px=x+dx,pz=z+(rnd()-.5)*spread*.42;
   ctx.fillStyle=k%3?'rgba(48,123,153,.31)':'rgba(58,138,157,.43)';
   ctx.beginPath();ctx.moveTo(px,pz);ctx.bezierCurveTo(px-sway*.33,pz-stem*.39,px+sway-.14,pz-stem*.66,px+sway,pz-stem);
   ctx.quadraticCurveTo(px+sway+.17,pz-stem*.55,px,pz);ctx.fill();
  }
 }
 for(let j=0;j<3500;j++){
  const tx=Math.floor(rnd()*W),ty=Math.floor(rnd()*H),i=ty*W+tx,k=grid.base[i];
  if(grid.road[i]||(k!==T.GRASS&&k!==T.FOREST)||shoreDistance(tx,ty)<1.7)continue;
  const x=(tx-32+rnd()-.5)*TILE,z=(ty-32+rnd()-.5)*TILE;
  if(((x-.8)/8.6)**2+((z-2.2)/(z>2?9:5.2))**2<1.09)continue;
  const h=.045+rnd()*.105;
  ctx.strokeStyle='rgba(75,99,64,.48)';ctx.lineWidth=.019;
  ctx.beginPath();ctx.moveTo(x-.08,z);ctx.lineTo(x-.12,z-h*.68);
  ctx.moveTo(x-.025,z-.008);ctx.lineTo(x-.044,z-h);ctx.moveTo(x+.03,z);
  ctx.quadraticCurveTo(x+.065,z-h*.66,x+.13,z-h*.84);ctx.stroke();
 }
 ctx.restore();
}
function addReefs(THREE,group,grid){
 const positions=[],colors=[],ink=[],foam=[],color=new THREE.Color();
 let sequence=8732;
 const r=()=>((sequence=(Math.imul(sequence,1664525)+1013904223)>>>0)/4294967296);
 const point=(u,v,t)=>u.map((c,i)=>c*(1-t)+v[i]*t);
 function face(a,b,c,tint){
  positions.push(...a,...b,...c);color.set(tint);
  for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);
 }
 const distance=coastField(grid);
 for(let k=0;k<240;k++){
  const ix=2+Math.floor(r()*60),iz=2+Math.floor(r()*60);
  const bed=grid.base[iz*W+ix];
  if(bed!==T.DEEP && bed!==T.ROCK)continue;
  const d=-distance[(iz+PAD)*(W+2*PAD)+ix+PAD];
  if(bed===T.DEEP && (d<2.4||d>7.3))continue;
  const x=(ix-32)*TILE,z=(iz-32)*TILE;
  const angle=Math.atan2(z,x);
  if(bed===T.DEEP && Math.sin(angle*6+.8*Math.sin(angle*3-1.1))<-.16)continue;
  const scale=.64+field(x*.38,z*.38)*.84;
  if(bed===T.DEEP){
   for(let k=0;k<24;k++){
    if(k%9===0||k%11===0)continue;
    const pts=[k,k+1].map(v=>{
     const a=v*Math.PI/12;
     return [x+Math.cos(a)*(1.03+.08*Math.cos(3*a))*scale,-.024,z+Math.sin(a)*.89*scale];
    });
    foam.push(...pts[0],...pts[1]);
   }
  }
  for(let j=0;j<3;j++){
   const cx=x+(r()-.5)*1.1,cz=z+(r()-.5)*1.1;
   const size=(j===0?.64:.25)*(.72+r()*.65)*scale,h=size*(.80+r()*.84);
   const a=[],b=[],c=[],n=7,phase=r()*6.28;
   for(let i=0;i<n;i++){
    const ang=phase+i*Math.PI*2/n,wx=Math.cos(ang)*size*(.85+r()*.20),wz=Math.sin(ang)*size*.78;
    a.push([cx+wx,-.03,cz+wz]);b.push([cx+wx*(.62+r()*.29)-.08,h*(.42+r()*.41),cz+wz*.82]);
    c.push([cx+wx*.48+.06,h*(.80+r()*.18),cz+wz*.45]);
   }
   for(let i=0;i<n;i++){
    const p=(i+1)%n,tint=['#4e566d','#65677b','#797787','#92838b','#8d7e84','#74707d','#595a70'][i];
    face(a[i],a[p],b[i],tint);face(a[p],b[p],b[i],tint);face(b[i],b[p],c[p],tint);face(b[i],c[p],c[i],tint);
    face(c[i],c[p],[cx+.04,h,cz],'#a49896');
    if(i%2===0)ink.push(...point(a[i],b[i],.15),...b[i],...b[i],...c[i]);
   }
  }
 }
 const shape=new THREE.BufferGeometry();shape.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));shape.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const rocks=new THREE.Mesh(shape,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));rocks.castShadow=true;group.add(rocks);
 const edges=new THREE.BufferGeometry();edges.setAttribute('position',new THREE.Float32BufferAttribute(ink,3));
 group.add(new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:'#4c4a5a',transparent:true,opacity:.65})));
 const ripples=new THREE.BufferGeometry();ripples.setAttribute('position',new THREE.Float32BufferAttribute(foam,3));
 group.add(new THREE.LineSegments(ripples,new THREE.LineBasicMaterial({color:'#d9efdf',transparent:true,opacity:.88})));
}

// The recording stage and the construction camera can render the same survey.
// Share a completed, immutable canvas while keeping their GPU textures independent.
const mapLayers=['base','skin','road'];
let recentMap;
function sameMap(layers,grid){
 return layers && mapLayers.every((key,j)=>grid[key].every((value,i)=>value===layers[j][i]));
}
function paintedMap(grid){
 if(sameMap(recentMap?.layers,grid))return recentMap;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=RES;
 paintMap(canvas,grid);
 recentMap={canvas,layers:mapLayers.map(key=>grid[key].slice())};
 return recentMap;
}
export function buildLiveGround(THREE,scene,grid){
 const texture=new THREE.CanvasTexture();texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
 const root=new THREE.Group();scene.add(root);
 const geometry=new THREE.PlaneGeometry(EXTENT,EXTENT);geometry.rotateX(-Math.PI/2);
 const surface=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture}));surface.position.y=-.04;root.add(surface);
 const ocean=new THREE.Mesh(new THREE.PlaneGeometry(330,330),new THREE.MeshBasicMaterial({color:'#4497b1'}));
 ocean.rotation.x=-Math.PI/2;ocean.position.y=-.06;root.add(ocean);
 const shadows=new THREE.Mesh(geometry,new THREE.ShadowMaterial({opacity:.25,color:'#37445e',depthWrite:false}));shadows.position.y=-.035;shadows.receiveShadow=true;root.add(shadows);
 let rng=128362;
 makeEscarpment(THREE,root,()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296));
 const reefGroup=new THREE.Group();root.add(reefGroup);
 const ripples=createShoreRipples(THREE,root);
 let previous;
 function sync(g){
  if(!g?.base)return;
  if(sameMap(previous,g))return;
  if(!previous||!g.base.every((v,i)=>v===previous[0][i])){
   for(const reef of [...reefGroup.children]){reefGroup.remove(reef);reef.geometry.dispose();reef.material.dispose();}
   addReefs(THREE,reefGroup,g);ripples.sync(g);
  }
  const map=paintedMap(g);
  texture.image=map.canvas;texture.needsUpdate=true;previous=map.layers;
 }
 sync(grid);
 return {sync,update:time=>ripples.update(time),dispose(){
  root.removeFromParent();texture.dispose();
  const geometries=new Set(),materials=new Set();
  root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 }};
}






