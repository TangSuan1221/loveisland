import { createEyeCurve } from './avatar-eye-curve.js';
// Original illustrated features; no extracted game textures or character meshes.
export const EYE_CURVE_DEFAULTS={eyeInnerY:0,eyeOuterY:.05,eyeUpperInnerX:-.65,eyeUpperInnerY:1.25,eyeUpperOuterX:.45,eyeUpperOuterY:1.2,eyeLowerInnerX:-.65,eyeLowerInnerY:-.48,eyeLowerOuterX:.5,eyeLowerOuterY:-.6};
export const ANIME_OPTIONS = {
 browStyle:[['anime_arc','动漫 · 平滑弧眉']],
 faceShape:[['anime_pentagon','动漫 · 折角短下颌']],
 eyeStyle:[['anime_designed','动漫 · 自由曲线眼'],['anime_round','动漫 · 明亮圆眼'],['anime_calm','动漫 · 平静杏眼'],['anime_angular','动漫 · 战斗锐眼']],
 noseStyle:[['anime_dot','动漫 · 点鼻'],['anime_line','动漫 · 折线鼻'],['anime_shadow','动漫 · 小鼻影']],
 mouthStyle:[['anime_line','动漫 · 简线嘴'],['anime_smile','动漫 · 浅笑嘴']],
 irisPattern:[['solid','普通虹膜'],['rings','同心环瞳'],['star','星形瞳孔']]
};
export const ANIME_RANGES={irisSize:[.5,1.35,.01],irisAspect:[.55,1.2,.01],pupilSize:[.12,.85,.01],eyeInk:[.5,2,.01],eyeLowerInk:[.15,2,.01],irisRingInk:[.4,2.5,.01],irisX:[-.012,.012,.001],irisY:[-.012,.012,.001],animeLashLength:[.25,2,.01],mouthCurve:[-.012,.018,.001],mouthInk:[.5,2,.01],
 eyeInnerY:[-.3,.4,.01],eyeOuterY:[-.3,.4,.01],eyeUpperInnerX:[-.95,.95,.01],eyeUpperOuterX:[-.95,.95,.01],eyeLowerInnerX:[-.95,.95,.01],eyeLowerOuterX:[-.95,.95,.01],eyeUpperInnerY:[.2,1.8,.01],eyeUpperOuterY:[.2,1.8,.01],eyeLowerInnerY:[-1.4,-.05,.01],eyeLowerOuterY:[-1.4,-.05,.01]};
export const ANIME_DEFAULTS={...EYE_CURVE_DEFAULTS,irisSize:1,irisAspect:.78,pupilSize:.48,eyeInk:1,eyeLowerInk:1,irisRingInk:1,irisX:0,irisY:0,irisPattern:'solid',eyeInkColor:'#252331',animeLashLength:1,mouthCurve:0,mouthInk:1,noseInkColor:'#a56f62'};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const irisTint=hex=>'#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*.8+255*.2).toString(16).padStart(2,'0')).join('');
const cubic=(p0,p1,p2,p3,t)=>p0*(1-t)**3+3*p1*t*(1-t)**2+3*p2*t*t*(1-t)+p3*t**3;
// Shared with tests: curves have ordered X handles and run inner -> outer.
export function animeEyeContour(a){
 const angular=a.eyeStyle==='anime_angular',calm=a.eyeStyle==='anime_calm',designed=a.eyeStyle==='anime_designed';
 const w=angular?.066:.060,h=angular?.030:calm?.037:.047;
 if(designed){
  const shape=createEyeCurve(a),top=x=>h*shape.top(x,w),bottom=x=>h*shape.bottom(x,w);
  // In constrained mode all consumers use the same polyline, including iris clipping.
  const upper=shape.sampled?shape.upper.map(([x,y])=>[x*w,y*h]):Array.from({length:49},(_,i)=>{const x=-w+2*w*i/48;return[x,top(x)];});
  const lower=shape.sampled?shape.lower.slice().reverse().map(([x,y])=>[x*w,y*h]):Array.from({length:49},(_,i)=>{const x=w-2*w*i/48;return[x,bottom(x)];});
  return {w,h,top,bottom,upper,lower};
 }
 const top=x=>angular?h*(.54+.30*x/w):h*(.12+.90*Math.sqrt(Math.max(0,1-(x/w)**2)))*(1-a.eyeLid*.28);
 const bottom=x=>-h*(angular?.66:.80)*Math.sqrt(Math.max(0,1-(x/w)**2));
 const upper=Array.from({length:49},(_,i)=>{const x=-w+2*w*i/48;return[x,top(x)];});
 const lower=Array.from({length:49},(_,i)=>{const x=w-2*w*i/48;return[x,bottom(x)];});
 return {w,h,top,bottom,upper,lower};
}
export function drawAnimeEye({a,e,side,eyeColor,facialPatch,facialLine,ovalPoints}){
 if(!a.eyeStyle.startsWith('anime_'))return false;
 const angular=a.eyeStyle==='anime_angular',designed=a.eyeStyle==='anime_designed',ink=a.eyeInkColor;
 const {w,h,top,bottom,upper,lower}=animeEyeContour(a),orient=pts=>pts.map(([x,y])=>[x*side,y]);
 const patch=(pts,color,lift)=>facialPatch(e,orient(pts),color,[0,0],lift);
 patch([...upper,...lower],'#fffaf1',.003);
 const ry=h*a.irisSize,rx=Math.min(w*.83,ry*(angular?.65:a.irisAspect));
 const clip=pts=>pts.map(([x,y])=>{x=clamp(x+a.irisX*side,-w+.0005,w-.0005);const lo=bottom(x)+.0001,hi=top(x)-.0001;return[x,clamp(y+a.irisY,Math.min(lo,hi),Math.max(lo,hi))];});
 patch(clip(ovalPoints(0,0,rx,ry,64)),ink,.0045);
 patch(clip(ovalPoints(0,0,rx*.92,ry*.92,64)),eyeColor,.0055);
 const crescent=Array.from({length:25},(_,i)=>{const t=Math.PI+i/24*Math.PI;return[Math.cos(t)*rx*.74,Math.sin(t)*ry*.73];});
 if(a.irisPattern==='rings'){
  // Filled annuli keep the drawn rings planar instead of creating raised wire eyes.
  for(const [outer,inner,lift]of [[.75,.69,.0061],[.48,.42,.0065]]){
   patch(clip(ovalPoints(0,0,rx*outer,ry*outer,64)),ink,lift);
   patch(clip(ovalPoints(0,0,rx*Math.max(inner-.025*(a.irisRingInk-1),.1),ry*Math.max(inner-.025*(a.irisRingInk-1),.1),64)),eyeColor,lift+.0002);
  }
 }else patch(clip([...crescent,...crescent.slice().reverse().map(([x,y])=>[x*.83,y*.78])]),irisTint(eyeColor),.0058);
 const pupil=a.irisPattern==='star'?Array.from({length:10},(_,i)=>{const t=-Math.PI/2+i*Math.PI/5,r=i%2?.42:1;return[Math.cos(t)*rx*a.pupilSize*r,Math.sin(t)*ry*a.pupilSize*r];}):ovalPoints(0,0,rx*a.pupilSize,ry*a.pupilSize,40);
 patch(clip(pupil),ink,.007);
 if(a.eyeHighlight!=='none'){
  patch(clip(ovalPoints(-rx*.32,ry*.35,rx*.21,ry*.20,24)),'#ffffff',.008);
  if(!angular)patch(clip(ovalPoints(rx*.37,-ry*.38,rx*.10,ry*.09,20)),'#fff8dc',.008);
 }
 const thickness=(designed?.0099:.0045)*a.eyeInk;
 // Designed lids keep their weight into the inner corner. The previous sine
 // taper erased the last quarter of the ink and changed the character's gaze.
 const lidWeight=x=>{const t=clamp((x+w)/(2*w),0,1),u=Math.min(1,t/.12),v=Math.min(1,(1-t)/.16),inner=designed?.80+.20*u*u*(3-2*u):1,outer=designed?.70+.30*v*v*(3-2*v):1;return thickness*(designed?.58+.18*t:.4+.6*t)*inner*outer;};
 if(designed){
  // Normal offsets preserve the body weight on sloping lids. A short oblique
  // cut replaces the old semicircular end beads; short tapered ends join the lashes.
  const normals=upper.map((p,i)=>{const p0=upper[Math.max(0,i-1)],p1=upper[Math.min(upper.length-1,i+1)],dx=p1[0]-p0[0],dy=p1[1]-p0[1],len=Math.hypot(dx,dy)||1;return[-dy/len,dx/len];});
  const rim=upper.map(([x,y],i)=>[x+normals[i][0]*lidWeight(x),y+normals[i][1]*lidWeight(x)]);
  const cap=(i,outer)=>{const p=upper[i],q=rim[i],n=normals[i],tangent=[n[1],-n[0]],weight=lidWeight(p[0]),sign=outer?1:-1,start=outer?p:q,end=outer?q:p;
   const c1=start.map((v,k)=>v+(end[k]-v)*.32+sign*tangent[k]*weight*.10),c2=start.map((v,k)=>v+(end[k]-v)*.72+sign*tangent[k]*weight*.06);
   return Array.from({length:9},(_,j)=>[cubic(start[0],c1[0],c2[0],end[0],j/8),cubic(start[1],c1[1],c2[1],end[1],j/8)]);
  };
  patch([...upper,...cap(upper.length-1,true),...rim.slice().reverse(),...cap(0,false)],ink,.009);
 }else patch([...upper,...upper.slice().reverse().map(([x,y])=>[x,y+lidWeight(x)])],ink,.009);
 if(!angular&&!designed)patch([[w*.62,top(w*.62)],[w+thickness*2.6,top(w)+thickness*2],[w*.94,top(w)-thickness*.5]],ink,.009);
 // Existing lash choices now work on illustrated eyes, following the edited lid.
 const counts={outer:1,double:2,fan:3,doll:5,spike:3},count=counts[a.eyeLashes]||0;
 for(let i=0;i<count;i++){
  const t=designed?(count===1?.94:count===2?.70+i*.24:count===3?[.51,.77,.94][i]:.36+i*.59/(count-1)):.58+i*.34/Math.max(1,count-1);
  const x=-w+2*w*t,len=.011*a.animeLashLength;
  if(designed){
   // Place the exposed lash beyond the OUTER ink rim, not inside the lid.
   // Otherwise increasing eyeInk buries most of a nominally long lash.
   // Roots overlap the ink; curved, flared sides meet at a swept-back tip.
   const dx=.0001,slope=(top(clamp(x+dx,-w,w))-top(clamp(x-dx,-w,w)))/(2*dx),norm=Math.hypot(slope,1),nx=-slope/norm,ny=1/norm;
   const weight=lidWeight(x),half=t<.6?.0024:.0036,rootY=top(x)+weight*.42;
   const tipX=x+nx*weight+len*(t<.6?.10:t<.85?.30:.08),tipY=top(x)+ny*weight+len*(t<.6?1.05:t<.85?1.22:1.35);
   const left=[x-half,top(clamp(x-half,-w,w))+lidWeight(clamp(x-half,-w,w))*.42],right=[x+half,top(clamp(x+half,-w,w))+lidWeight(clamp(x+half,-w,w))*.42];
   const edge=(p,outer,reverse=false)=>Array.from({length:13},(_,j)=>{
    const u=reverse?1-j/12:j/12;
    if(t>.6){
     // Both sides follow one shallow curved centerline. Shrinking a triangular wedge
     // cannot produce the visible root-to-middle arc of a drawn lash group.
     const cx=cubic(x,x+nx*weight+len*.20,tipX+len*.12,tipX,u),cy=cubic(rootY,top(x)+ny*weight+len*.40,tipY-len*.30,tipY,u),width=half*(1-Math.pow(u,1.4));
     return[cx+(outer?1:-1)*width,cy];
    }
    return[cubic(p[0],p[0]+len*(outer?.38:.23),tipX+len*(outer?.06:-.02),tipX,u),cubic(p[1],rootY+len*.72,tipY-len*.08,tipY,u)];
   });
   patch([...edge(right,true),...edge(left,false,true)],ink,.0095);
  }else{const y=top(x)+thickness*.6;patch([[x-.0035,y-.001],[x+.003,y-.001],[x+len*(.16+i*.12),y+len*(1-i*.13)]],ink,.0095);}
 }
 facialLine(e,orient(lower.slice(2,-2)),ink,.001*a.eyeInk*a.eyeLowerInk,[0,0],.0075);
 if(a.lowerLashes==='three')for(const t of [.25,.50,.73]){const x=-w+2*w*t,y=bottom(x);patch([[x-.002,y+.0005],[x+.002,y+.0005],[x+.0035,y-.006*a.animeLashLength]],ink,.009);}
 return true;
}
export function drawAnimeBrow({a,b,side,facialPatch}){
 if(a.browStyle!=='anime_arc')return false;
 const edge=Array.from({length:33},(_,i)=>{const t=i/32;return[-.045+.09*t,.006*4*t*(1-t)+.001*t];});
 const pts=[...edge,...edge.slice().reverse().map(([x,y])=>[x,y+.0084*(.7+.3*Math.cos(x/.045*Math.PI/2))])].map(([x,y])=>[side*x,y]);
 facialPatch(b,pts,a.browColor,[0,0],.005);return true;
}
export function drawAnimeNose({a,n,facialPatch,facialLine,ovalPoints}){
 if(!a.noseStyle.startsWith('anime_'))return false;
 if(a.noseStyle==='anime_dot')facialPatch(n,ovalPoints(.002,-.01,.003,.004),a.noseInkColor,[0,0],.004);
 else if(a.noseStyle==='anime_shadow')facialPatch(n,[[.006,.01],[-.009,-.013],[.011,-.010]],a.noseInkColor,[0,0],.004);
 else facialLine(n,[[.003,.014],[-.006,-.009],[.006,-.011]],a.noseInkColor,.0014,[0,0],.005);
 return true;
}
export function drawAnimeMouth({a,mouth,facialLine}){
 if(!a.mouthStyle.startsWith('anime_'))return false;
 const depth=(a.mouthStyle==='anime_smile'?.004:0)+a.mouthCurve;
 const points=Array.from({length:25},(_,i)=>{const t=i/24;return[-.027+.054*t,-depth*4*t*(1-t)+.001*t];});
 facialLine(mouth,points,a.mouthColor,.0017*a.mouthInk,[0,0],.005);return true;
}
const base={artStyle:'anime',faceShape:'oval',faceHeight:.97,jawWidth:1.06,chinLength:.88,headScale:1.16,eyeStyle:'anime_round',eyeSize:1.05,eyeLid:.12,eyeColor:'#3194a2',browStyle:'thin',browSize:.77,browY:.024,noseStyle:'anime_dot',noseSize:.65,mouthStyle:'anime_line',mouthSize:.82,mouthY:.028,mouthColor:'#71505b',skinColor:'#f9dcc7',blush:.04,hairColor:'#4ac1c1',browColor:'#467f89',eyeHighlight:'dot'};
export const ANIME_PRESETS=[
 {name:'青葱双尾',note:'动漫平涂 · 弧形中分 · 长双马尾',color:'#46b8bc',values:{...base,hairFront:'anime_center',hairBack:'anime_twintails',outfit:'uniform',topColor:'#c1cbd0',bottomColor:'#343846',accessoryColor:'#ec7aac'}},
 {name:'绯瞳短发',note:'短脸 · 冷色碎发 · 红色虹膜',color:'#9cbbdf',values:{...base,eyeStyle:'anime_calm',eyeColor:'#bf4353',hairColor:'#a6c5e3',browColor:'#6b849e',hairFront:'anime_swept',hairBack:'anime_bob',eyeHighlight:'dot',skinColor:'#f8e5da',outfit:'uniform',topColor:'#eef2eb',bottomColor:'#43596e'}},
 {name:'金环赤发',note:'参考研究 · 自由拱形眼 · 弧顶齐刘海 · 贴颈侧帘',color:'#d25427',values:{...base,faceShape:'anime_pentagon',faceHeight:1.03,chinLength:1.08,jawWidth:1,faceWidth:1,eyeStyle:'anime_designed',eyeSize:1.18,eyeWidth:.94,eyeHeight:1.02,eyeSpacing:.025,eyeY:-.019,eyeLid:0,irisPattern:'rings',irisSize:.64,irisAspect:1.095744680851064,pupilSize:.19,irisY:.008,irisRingInk:1.1,eyeInk:1.75,eyeInkColor:'#28201d',eyeLowerInk:.40,eyeLashes:'fan',lowerLashes:'three',animeLashLength:1.28,eyeColor:'#f4d353',hairColor:'#cc5025',browColor:'#322822',hairFront:'anime_arcfringe',hairBack:'anime_frame',hairFrontLength:1,hairVolume:1,eyeHighlight:'none',skinColor:'#f0d8bc',blush:0,browStyle:'anime_arc',browSize:1.10,browWidth:1.1,browHeight:1,browY:-.008,browSpacing:.024,noseInkColor:'#392b22',noseSize:.73,noseY:-.04,mouthStyle:'anime_smile',mouthCurve:.001,mouthInk:1.6,mouthColor:'#33251e',mouthSize:1.5,mouthWidth:1.32,mouthY:-.006,outfit:'tee',topColor:'#647ade',bottomColor:'#30313b',accessoryColor:'#30313b'}},
 {name:'破风武者',note:'侧向尖簇 · 锐眼 · 简线鼻嘴',color:'#d98235',values:{...base,faceShape:'square',faceHeight:1.02,jawWidth:.94,chinLength:1,eyeStyle:'anime_angular',eyeSize:1,irisSize:.73,pupilSize:.83,eyeColor:'#34303a',eyeHighlight:'none',browStyle:'thick',browSize:1,browColor:'#252330',browY:.002,browRotation:-12,hairColor:'#292735',hairFront:'anime_fan',hairBack:'anime_short',noseStyle:'anime_line',noseSize:.85,mouthSize:1,outfit:'robe',topColor:'#e57b36',bottomColor:'#304d87',skinColor:'#e9ba94'}}
];
