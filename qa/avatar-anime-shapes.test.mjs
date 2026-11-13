import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAppearance,APPEARANCE_OPTIONS} from '../src/avatar-schema.js';
import {EYE_CURVE_DEFAULTS,ANIME_PRESETS,animeEyeContour,drawAnimeEye,drawAnimeBrow,drawAnimeMouth,drawAnimeNose} from '../src/avatar-anime.js';
import {faceSurfacePoint} from '../src/avatar-model.js';
const ovalPoints=(cx,cy,rx,ry,n=48)=>Array.from({length:n},(_,i)=>[cx+rx*Math.cos(i*2*Math.PI/n),cy+ry*Math.sin(i*2*Math.PI/n)]);
function eye(raw,side=1){const a=normalizeAppearance({eyeStyle:'anime_designed',...raw}),patches=[],lines=[];assert.equal(drawAnimeEye({a,e:{},side,eyeColor:a.eyeColor,ovalPoints,facialPatch:(e,points,color,center,lift)=>patches.push({points,color,lift}),facialLine:(e,points,color,width)=>lines.push({points,color,width})}),true);return {a,patches,lines};}
test('new choices are unique and each authored preset roundtrips without invalid fields',()=>{
 for(const [key,values]of Object.entries(APPEARANCE_OPTIONS))assert.equal(new Set(values.map(x=>x.value)).size,values.length,key);
 for(const p of ANIME_PRESETS){const a=normalizeAppearance(p.values);for(const [k,v]of Object.entries(p.values))assert.deepEqual(a[k],v,p.name+':'+k);assert.deepEqual(normalizeAppearance(JSON.parse(JSON.stringify(a))),a);}
});
test('imported crossed X handles are ordered; nonfinite values recover and colors remain safe',()=>{
 const a=normalizeAppearance({eyeUpperInnerX:.9,eyeUpperOuterX:-.8,eyeLowerInnerX:.95,eyeLowerOuterX:-.95,eyeInnerY:NaN,noseInkColor:'url(foo)'});
 assert.equal(a.eyeUpperInnerX,-.8);assert.equal(a.eyeUpperOuterX,.9);assert.equal(a.eyeLowerInnerX,-.95);assert.equal(a.eyeLowerOuterX,.95);assert.equal(a.eyeInnerY,EYE_CURVE_DEFAULTS.eyeInnerY);assert.equal(a.noseInkColor,'#a56f62');
});
test('edited upper and lower curves meet at both canthi, including eyelid compression',()=>{
 for(const eyeLid of [0,.5,1]){const a=normalizeAppearance({eyeStyle:'anime_designed',eyeLid,eyeInnerY:-.25,eyeOuterY:.3}),c=animeEyeContour(a);for(const x of [-c.w,c.w])assert.ok(Math.abs(c.top(x)-c.bottom(x))<2e-7);assert.equal(c.upper.length,49);assert.equal(c.lower.length,49);}
});
test('all six editable handles change the actual eye geometry, not just the editor graphic',()=>{
 const base=eye({}),before=JSON.stringify(base.patches[0].points);
 for(const [key,v]of Object.entries(EYE_CURVE_DEFAULTS)){const changed=eye({[key]:v+(key.includes('Lower')&&key.endsWith('Y')?-.1:.1)});assert.notEqual(JSON.stringify(changed.patches[0].points),before,key);}
});
test('left and right graphics are mirrored exactly; lashes are optional, rings layered, and iris clips to eye white',()=>{
 const preset=ANIME_PRESETS.find(x=>x.name==='金环赤发').values,r=eye(preset,1),l=eye(preset,-1),c=animeEyeContour(r.a);
 assert.equal(r.patches.length,l.patches.length);r.patches.forEach((p,i)=>p.points.forEach(([x,y],j)=>{assert.ok(Math.abs(x+l.patches[i].points[j][0])<1e-9);assert.equal(y,l.patches[i].points[j][1]);}));
 const iris=r.patches.filter(p=>p.lift>=.0045&&p.lift<=.007);assert.equal(iris.length,7);for(const p of iris)for(const [x,y]of p.points){assert.ok(y>=c.bottom(x)-1e-6);assert.ok(y<=c.top(x)+1e-6);}
 for(let i=1;i<iris.length;i++)assert.ok(iris[i].lift>iris[i-1].lift,'concentric layers must not cover a higher-detail layer');
 assert.equal(r.patches.length-eye({...preset,eyeLashes:'none',lowerLashes:'none'}).patches.length,6);
 const solid=eye({...preset,irisPattern:'solid'});assert.notDeepEqual(solid.patches,r.patches);
});
test('round iris aspect, ink thickness, nose color and smooth smile all affect production primitives',()=>{
 assert.notDeepEqual(eye({irisAspect:.55}).patches,eye({irisAspect:1.2}).patches);
 assert.notDeepEqual(eye({eyeInk:.5}).patches,eye({eyeInk:2}).patches);
 const a=normalizeAppearance(ANIME_PRESETS.find(x=>x.name==='金环赤发').values);let brow,mouth,nose;
 drawAnimeBrow({a,b:{},side:1,facialPatch:(_,p)=>brow=p});assert.equal(brow.length,66);
 drawAnimeMouth({a,mouth:{},facialLine:(_,p,color,width)=>mouth={p,color,width}});assert.equal(mouth.p.length,25);assert.ok(mouth.p[12][1]<mouth.p[0][1]);
 drawAnimeNose({a,n:{},facialPatch:(_,p,color)=>nose=color,facialLine:()=>{},ovalPoints});assert.equal(nose,a.noseInkColor);
});
test('pentagonal jaw keeps a continuous finite silhouette, tapers cheeks and retains a defined corner',()=>{
 const a=normalizeAppearance({faceShape:'anime_pentagon',artStyle:'anime'}),edge=v=>faceSurfacePoint('anime_pentagon',Math.sqrt(1-v*v),-v,0,a);
 for(let i=0;i<=100;i++){const p=edge(i/100);assert.ok(p.every(Number.isFinite));if(i)assert.ok(p[0]<=edge((i-1)/100)[0]+1e-8);}
 assert.ok(Math.abs(edge(.68-1e-6)[0]-edge(.68+1e-6)[0])<2e-6);assert.equal(edge(1)[0],0);assert.ok(edge(.5)[0]>.201&&edge(.5)[0]<.206,'revised cheek keeps the reviewed width rather than the over-narrow round2 silhouette');
 const slopeBefore=(edge(.67)[0]-edge(.66)[0])/.01,slopeAfter=(edge(.70)[0]-edge(.69)[0])/.01;assert.ok(slopeAfter<slopeBefore*2,'jaw must change slope after the corner');
});

test('designed eyes carry deliberate upper-lid weight without changing iris scale',()=>{
 const raw=ANIME_PRESETS.find(x=>x.name==='金环赤发').values,{a,patches}=eye(raw),lid=patches.find(p=>p.lift===.009),n=animeEyeContour(a).upper.length;
 assert.equal(lid.points.length,2*n+18);const center=24,p=lid.points[center],q=lid.points[n+9+n-1-center],thickness=Math.hypot(q[0]-p[0],q[1]-p[1]);
 assert.ok(thickness>.011&&thickness<.014,'filled lid, not a thin stroke or giant outer wing');
 assert.equal(a.irisSize,.64);assert.equal(a.mouthWidth,1.32);assert.equal(a.chinLength,1.08);
});


test('reviewed upper cheeks are straighter without narrowing mouth-height skin',()=>{
 const a=normalizeAppearance(ANIME_PRESETS.find(x=>x.name==='金环赤发').values);
 const edge=v=>faceSurfacePoint('anime_pentagon',Math.sqrt(1-v*v),-v,0,a)[0];
 const old=v=>(1-.25*v/.68)*.255*(1-.045*v);
 assert.ok(old(.2)-edge(.2)>.018&&old(.2)-edge(.2)<.022);
 assert.ok(edge(.2)-edge(.4)<.009,'upper cheek side should be near vertical');
 assert.ok(Math.abs(edge(.5)-old(.5))<1e-10,'preserve the already reviewed mouth-height width');
});

test('reference eye opening narrows while the iris world-space width is preserved',()=>{
 const raw=ANIME_PRESETS.find(x=>x.name==='金环赤发').values,{a,patches}=eye(raw);
 assert.ok(a.eyeWidth<1.03);assert.ok(Math.abs(a.eyeWidth*a.irisAspect-1.03)<1e-10);
 const lid=patches.find(p=>p.lift===.009),n=animeEyeContour(a).upper.length;
 for(const i of [0,n-1]){const p=lid.points[i],q=lid.points[n+9+n-1-i];assert.ok(Math.hypot(q[0]-p[0],q[1]-p[1])>.0075,'short inner taper retains visible ink');}
 for(const start of [n,2*n+9]){const cap=lid.points.slice(start,start+9),v=cap.at(-1).map((x,i)=>x-cap[0][i]),len=Math.hypot(...v);for(const p of cap){const off=Math.abs((p[0]-cap[0][0])*v[1]-(p[1]-cap[0][1])*v[0])/len;assert.ok(off<len*.11,'oblique cut must not balloon into a round cap');}}

 const lashes=patches.filter(p=>p.lift===.0095);assert.equal(lashes.length,3);
 for(const {points:p}of lashes){assert.equal(p.length,26);assert.ok(p[12][1]>Math.max(p[0][1],p.at(-1)[1]));assert.ok(p[0][0]-p.at(-1)[0]>.004,'narrow but connected brush roots');assert.ok(p.every(q=>q.every(Number.isFinite)));}
});


test('designed lashes project beyond the outer ink rim and the outer-only choice stays at the outer corner',()=>{
 const preset=ANIME_PRESETS.find(x=>x.name==='金环赤发').values;
 for(const eyeInk of [.5,1.75,2])for(const animeLashLength of [.25,1.28,2]){
  const {a,patches}=eye({...preset,eyeInk,animeLashLength}),c=animeEyeContour(a);
  const lashes=patches.filter(p=>p.lift===.0095);
  for(let i=0;i<3;i++){
   const t=[.51,.77,.94][i],x=-c.w+2*c.w*t,dx=.0001,slope=(c.top(x+dx)-c.top(x-dx))/(2*dx),ny=1/Math.hypot(slope,1);
   const v=Math.min(1,(1-t)/.16),rimY=c.top(x)+ny*.0099*eyeInk*(.58+.18*t)*(.70+.30*v*v*(3-2*v)),tip=lashes[i].points[12];
   assert.ok(tip[1]-rimY>=.011*animeLashLength*.849,'lash must remain outside ink even at maximum lid weight');
  }
 }
 const {patches}=eye({...preset,eyeLashes:'outer'}),lash=patches.find(p=>p.lift===.0095);
 assert.ok(lash.points[0][0]>.05,'outer-only lashes must not appear above the central pupil');
});

test('central designed lash is slimmer without hiding the outer fan or changing eyelid body',()=>{
 const {patches}=eye(ANIME_PRESETS.find(x=>x.name==='金环赤发').values),lashes=patches.filter(p=>p.lift===.0095);
 const rootWidth=p=>p.points[0][0]-p.points.at(-1)[0];
 assert.ok(rootWidth(lashes[0])<rootWidth(lashes[1])*.7);
 assert.ok(rootWidth(lashes[0])>.0045);assert.ok(rootWidth(lashes[1])>.007);
});

test('outer fan ends upward with a bounded inward finish instead of a horizontal tooth',()=>{
 const {a,patches}=eye(ANIME_PRESETS.find(x=>x.name==='金环赤发').values),c=animeEyeContour(a),lashes=patches.filter(p=>p.lift===.0095),outer=lashes[2].points;
 assert.ok(outer[12][1]>outer[10][1],'tip finishes upward');
 assert.ok(outer[12][0]<outer[10][0],'tip curls back inward');
 const lid=patches.find(p=>p.lift===.009),n=c.upper.length,w=i=>Math.hypot(lid.points[i][0]-lid.points[n+9+n-1-i][0],lid.points[i][1]-lid.points[n+9+n-1-i][1]);
 assert.ok(w(n-1)<w(n-9)*.8,'outer end narrows over a short run');
 assert.ok(w(n-1)>.009,'avoid a long hairline tail');
});

test('outer lashes have a curved ribbon midline and taper continuously to the fixed tip',()=>{
 const {patches}=eye(ANIME_PRESETS.find(x=>x.name==='金环赤发').values);
 for(const {points:p}of patches.filter(p=>p.lift===.0095).slice(1)){
  const centers=Array.from({length:13},(_,i)=>p[i].map((v,k)=>(v+p[25-i][k])/2)),start=centers[0],end=centers.at(-1),v=end.map((a,k)=>a-start[k]),len=Math.hypot(...v);
  const off=centers.map(p=>Math.abs((p[0]-start[0])*v[1]-(p[1]-start[1])*v[0])/len);
  const bend=Math.max(...off)/len;
  assert.ok(bend>.04&&bend<.20,'shallow curved midline; reject both a straight tooth and an exaggerated hook');
  assert.ok(Math.max(...centers.map(c=>c[0]))-end[0]<.0018,'end must not wrap into a crescent');
  const widths=centers.map((_,i)=>p[i][0]-p[25-i][0]);
  for(let i=1;i<widths.length;i++)assert.ok(widths[i]<=widths[i-1]+1e-12);
  assert.equal(widths.at(-1),0);assert.ok(widths[6]>.003,'middle stays readable, not a hairline needle');
 }
});
