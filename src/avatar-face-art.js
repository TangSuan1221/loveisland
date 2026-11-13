// Original, versioned vector overlays. The same replay is used by UV editor and 3D texture.
export const FACE_ART_KINDS=['pen','curve','lash','ellipse','ring','star','heart','triangle'];
export const FACE_ART_LIMITS={layers:64,pointsPerLayer:256,totalPoints:8192};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const number=(v,f,a,b)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,a,b):f;
export function normalizeFaceArt(input){
 if(!Array.isArray(input))return [];
 const ids=new Set();let budget=FACE_ART_LIMITS.totalPoints;
 return input.slice(0,64).filter(v=>v&&typeof v==='object'&&FACE_ART_KINDS.includes(v.kind)).map((v,i)=>{
  let id=typeof v.id==='string'&&/^[\w-]{1,64}$/.test(v.id)?v.id:`layer-${i}`;let suffix=0;const base=id;while(ids.has(id))id=`${base.slice(0,52)}-${++suffix}`;ids.add(id);
  const points=(Array.isArray(v.points)?v.points:[]).filter(p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(n=>typeof n==='number'&&Number.isFinite(n))).slice(0,Math.min(256,budget)).map(([x,y])=>[clamp(x,-.5,.5),clamp(y,-.5,.5)]);budget-=points.length;
  return {id,kind:v.kind,x:number(v.x,.5,0,1),y:number(v.y,.5,0,1),width:number(v.width,.16,.005,1),height:number(v.height,.10,.005,1),rotation:number(v.rotation,0,-180,180),opacity:number(v.opacity,1,0,1),color:typeof v.color==='string'&&/^#[a-f\d]{6}$/i.test(v.color)?v.color.toLowerCase():'#49303f',visible:v.visible!==false,mirror:v.mirror===true,lineWidth:number(v.lineWidth,.008,.001,.1),bend:number(v.bend,-.35,-1,1),points};
 }).filter(v=>v.kind!=='pen'||v.points.length);
}
export function artLocalPoint(layer,x,y,mirrored=false){
 if(mirrored)x=1-x;const angle=-layer.rotation*Math.PI/180,dx=x-layer.x,dy=y-layer.y;
 return [(dx*Math.cos(angle)-dy*Math.sin(angle))/layer.width,(dx*Math.sin(angle)+dy*Math.cos(angle))/layer.height];
}
export function hitFaceArt(layers,x,y){
 for(const layer of layers.slice().reverse())if(layer.visible&&layer.opacity>0)for(const mirrored of layer.mirror?[false,true]:[false]){const [u,v]=artLocalPoint(layer,x,y,mirrored);if(Math.abs(u)<=.55&&Math.abs(v)<=.55)return {id:layer.id,mirrored};}return null;
}
export function drawFaceArtLayer(ctx,v,size=512,mirrored=false){
 if(!v.visible||v.opacity===0)return;
 ctx.save();ctx.globalAlpha=v.opacity;ctx.globalCompositeOperation='source-over';
 if(mirrored){ctx.translate(size,0);ctx.scale(-1,1);}
 ctx.translate(v.x*size,v.y*size);ctx.rotate(v.rotation*Math.PI/180);ctx.scale(v.width*size,v.height*size);
 ctx.fillStyle=ctx.strokeStyle=v.color;ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=v.lineWidth/Math.sqrt(v.width*v.height);ctx.beginPath();
 if(v.kind==='pen'){
  v.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  if(v.points.length===1){ctx.arc(...v.points[0],ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();
 }else if(v.kind==='curve'||v.kind==='lash'){
  ctx.moveTo(-.5,.25);ctx.quadraticCurveTo(0,v.bend,.5,-.05);
  if(v.kind==='lash'){ctx.quadraticCurveTo(.03,v.bend+.23,-.5,.25);ctx.fill();}else ctx.stroke();
 }else if(v.kind==='ellipse'||v.kind==='ring'){
  ctx.ellipse(0,0,.46,.46,0,0,Math.PI*2);v.kind==='ring'?ctx.stroke():ctx.fill();
 }else if(v.kind==='heart'){
  ctx.moveTo(0,.48);ctx.bezierCurveTo(-.9,-.05,-.35,-.8,0,-.23);ctx.bezierCurveTo(.35,-.8,.9,-.05,0,.48);ctx.fill();
 }else{
  const points=v.kind==='star'?Array.from({length:10},(_,i)=>{const t=-Math.PI/2+i*Math.PI/5,r=i%2?.21:.5;return[Math.cos(t)*r,Math.sin(t)*r];}):[[-.5,.5],[0,-.5],[.5,.5]];
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();
 }
 ctx.restore();
}
export function drawAppearancePaint(ctx,a,size=512){
 ctx.save();ctx.clearRect(0,0,size,size);
 for(const s of a.strokes||[]){if(!s.points.length)continue;ctx.globalCompositeOperation=s.tool==='eraser'?'destination-out':'source-over';ctx.strokeStyle=ctx.fillStyle=s.color;ctx.lineWidth=s.width*size;ctx.lineCap=ctx.lineJoin='round';ctx.beginPath();s.points.forEach(([x,y],i)=>i?ctx.lineTo(x*size,y*size):ctx.moveTo(x*size,y*size));if(s.points.length===1){ctx.arc(s.points[0][0]*size,s.points[0][1]*size,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();}
 for(const v of a.faceArt||[]){drawFaceArtLayer(ctx,v,size);if(v.mirror)drawFaceArtLayer(ctx,v,size,true);}
 ctx.globalAlpha=1;ctx.globalCompositeOperation='destination-in';ctx.beginPath();ctx.ellipse(size/2,size/2,size*250/512,size*250/512,0,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.restore();
}
