import test from 'node:test';
import assert from 'node:assert/strict';
import {mapPhotoToAppearance,detectVisibleTeeth} from '../src/avatar-photo-mapping.js';
import {APPEARANCE_RANGES,APPEARANCE_OPTIONS} from '../src/avatar-schema.js';
import {makeCustomActor,disposeCustomActor} from '../src/avatar-model.js';
import * as THREE from 'three';

function face(){
 const points=Array.from({length:478},()=>({x:.5,y:.5,z:0}));
 const set=(id,x,y)=>{points[id]={x,y,z:0};};
 for(const [id,x,y]of [[10,.5,.15],[152,.5,.8],[234,.25,.45],[454,.75,.45],[172,.31,.67],[397,.69,.67],[127,.26,.3],[356,.74,.3],
  [33,.32,.4],[133,.425,.4],[159,.3725,.386],[145,.3725,.414],[362,.575,.4],[263,.68,.4],[386,.6275,.386],[374,.6275,.414],
  [70,.31,.35],[63,.34,.34],[105,.38,.337],[107,.425,.35],[336,.575,.35],[334,.62,.337],[293,.66,.34],[300,.69,.35],
  [1,.5,.54],[2,.5,.57],[168,.5,.425],[98,.45,.56],[327,.55,.56],
  [61,.41,.65],[291,.59,.65],[0,.5,.635],[17,.5,.67],[13,.5,.648],[14,.5,.652],
  [50,.32,.52],[280,.68,.52],[101,.36,.55],[330,.64,.55]])set(id,x,y);
 return points;
}
const map=p=>mapPhotoToAppearance(p,{width:1000,height:1000});
test('facial proportions change the actual bounded parameters and do not overwrite unobserved appearance',()=>{
 const p=face(),base=map(p),wide=structuredClone(p);
 wide[33].x-=.018;wide[133].x+=.018;wide[362].x-=.018;wide[263].x+=.018;
 wide[61].x-=.025;wide[291].x+=.025;wide[98].x-=.03;wide[327].x+=.03;
 const changed=map(wide);
 assert.ok(changed.values.eyeWidth>base.values.eyeWidth);
 assert.ok(changed.values.mouthWidth>base.values.mouthWidth);
 assert.ok(changed.values.noseSize>base.values.noseSize);
 assert.equal(changed.values.noseStyle,'wide');
 for(const key of ['hairStyle','hairColor','artStyle','glasses','outfit','height','strokes','facialHair','eyeColor','noseBridge'])assert.ok(!(key in base.values),`${key} is not observed`);
 for(const [key,value]of Object.entries(changed.values))if(APPEARANCE_RANGES[key]){const [min,max]=APPEARANCE_RANGES[key];assert.ok(value>=min&&value<=max,`${key} bounded`);}
});
test('in-plane rotation and non-square image dimensions do not change the face measurement',()=>{
 const p=face(),base=map(p).values,a=.34,c=Math.cos(a),s=Math.sin(a);
 const rotated=p.map(v=>({...v,x:.5+(v.x-.5)*c-(v.y-.5)*s,y:.5+(v.x-.5)*s+(v.y-.5)*c}));
 const wide=p.map(v=>({...v,x:v.x*1000/1400,y:v.y*1000/1100}));
 for(const result of [map(rotated).values,mapPhotoToAppearance(wide,{width:1400,height:1100}).values])for(const key of Object.keys(base)){
  if(typeof base[key]==='number')assert.ok(Math.abs(result[key]-base[key])<.00002,`${key}: ${result[key]} vs ${base[key]}`);
  else assert.equal(result[key],base[key],key);
 }
});
test('larger eye separation and lowered mouths produce distinct location parameters',()=>{
 const p=face(),base=map(p).values;
 for(const id of [33,133,159,145])p[id].x-=.02;
 for(const id of [362,263,386,374])p[id].x+=.02;
 for(const id of [61,291,0,17,13,14])p[id].y+=.025;
 const changed=map(p).values;
 assert.ok(changed.eyeSpacing>base.eyeSpacing);assert.ok(changed.mouthY<base.mouthY);
});
test('forehead landmark is not treated as the crown and mouth width uses the real mesh units',()=>{
 const p=face();
 // The real portrait QA has eye line ~30% down from landmark 10 to the chin.
 // Mapping that span directly to the whole head had put the eyes in the hair.
 const eyeLine=.15+.65*.30;
 for(const id of [33,133,159,145,362,263,386,374])p[id].y+=eyeLine-.4;
 const result=map(p).values;
 assert.ok(result.eyeY<.025,'eyes stay below the fringe');
 const units=Math.sqrt((.51*.564)/((.75-.25)*(.8-.15)*1.22));
 const expectedMouthWidth=(.59-.41)*units;
 const renderedMouthWidth=.10*result.mouthSize*result.mouthWidth*result.faceWidth;
 assert.ok(Math.abs(renderedMouthWidth-expectedMouthWidth)<.00001,'mouth has the observed proportional width');
});
test('skin and lip colors come from image pixels; photographs are not returned',()=>{
 const width=200,height=200,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const lip=x>90&&x<110&&y>=126&&y<135,rgb=lip?[133,64,75]:[178,131,99];data.set([...rgb,255],(y*width+x)*4);
 }
 const result=mapPhotoToAppearance(face(),{width:1000,height:1000,imageData:{width,height,data}});
 assert.equal(result.values.skinColor,'#b28363');assert.equal(result.values.mouthColor,'#85404b');
 assert.deepEqual(Object.keys(result).sort(),['fit','summary','values','warnings']);
 assert.ok(!JSON.stringify(result).includes('landmarks'));
});
test('invalid, cropped, too small, closed-eye and side-facing photos fail with actionable messages',()=>{
 assert.throws(()=>map([]),/完整面部/);
 const nan=face();nan[10].x=NaN;assert.throws(()=>map(nan),/完整面部/);
 const cropped=face();cropped[152].y=1.2;assert.throws(()=>map(cropped),/完整进入/);
 const small=face().map(p=>({...p,x:.5+(p.x-.5)*.08,y:.5+(p.y-.5)*.08}));assert.throws(()=>map(small),/人脸太小/);
 const closed=face();closed[159].y=closed[145].y;closed[386].y=closed[374].y;assert.throws(()=>map(closed),/眼睛闭合/);
 const side=face();side[1].x=.64;assert.throws(()=>map(side),/偏侧面/);
});
test('moderate turn is accepted with conservative midline alignment; strong side view is still rejected',()=>{
 const turned=face();
 // Similar projected midline displacement to the real slightly turned photo:
 // both eyes remain equally visible, while forehead/bridge/chin shift together.
 for(const id of [10,152,168,1,2,98,327,61,291,0,17,13,14])turned[id].x+=.06;
 const result=map(turned);
 assert.ok(result.warnings.some(w=>w.includes('中轴保守对齐')));
 assert.ok(Math.abs(result.values.noseX)<.006,'camera turn must not permanently move the nose right');
 assert.ok(Math.abs(result.values.mouthX)<.006,'camera turn must not permanently move the mouth right');
 const strong=structuredClone(turned);strong[1].x=.70;
 assert.throws(()=>map(strong),/偏侧面/);
 const occluded=face();occluded[133].x=occluded[33].x+.025;
 assert.throws(()=>map(occluded),/偏侧面/);
 const frontal=face();for(const id of [1,98,327,61,291])frontal[id].x+=.015;
 const asym=map(frontal);
 assert.ok(asym.values.noseX>.01,'near-frontal observed asymmetry is not erased');
 assert.ok(asym.values.mouthX>.01,'near-frontal observed asymmetry is not erased');
});
test('open mouth is disclosed while geometry stays a neutral editable face',()=>{
 const p=face();p[14].y=.69;const result=map(p);
 assert.equal(result.values.mouthStyle,'neutral');assert.ok(result.warnings.some(w=>w.includes('嘴巴张开')));
});
test('visible smile and expression scores choose real expression components without GPT',()=>{
 const smiling=face();smiling[61].y-=.02;smiling[291].y-=.02;
 assert.equal(map(smiling).values.mouthStyle,'smile');
 smiling[14].y=.69;assert.equal(map(smiling).values.mouthStyle,'grin');
 const neutral=face();
 const scores=[{categoryName:'mouthSmileLeft',score:.72},{categoryName:'mouthSmileRight',score:.68}];
 assert.equal(mapPhotoToAppearance(neutral,{width:1000,height:1000,blendshapes:scores}).values.mouthStyle,'smile');
 const frown=[{categoryName:'mouthSmileLeft',score:0},{categoryName:'mouthFrownLeft',score:.7},{categoryName:'mouthFrownRight',score:.7}];
 assert.equal(mapPhotoToAppearance(neutral,{width:1000,height:1000,blendshapes:frown}).values.mouthStyle,'frown');
});

test('eyebrow tilt is not misclassified as an arched eyebrow',()=>{
 const p=face();
 for(const ids of [[70,63,105,107],[336,334,293,300]]){
  const first=p[ids[0]],last=p[ids.at(-1)];
  for(const id of ids)p[id].y=.32+(p[id].x-first.x)/(last.x-first.x)*.055;
 }
 const result=map(p).values;assert.equal(result.browStyle,'straight');
 assert.equal(result.browSize,1);assert.equal(result.browHeight,1,'measured width must not also exaggerate arch height and thickness');
});

test('eyebrow color uses bilateral dark-region evidence and preserves uncertain skin-like labels',()=>{
 const width=64,height=64,mask=new Uint8Array(width*height).fill(1),data=new Uint8ClampedArray(width*height*4),landmarks=face();
 for(let i=0;i<mask.length;i++)data.set([190,130,100,255],i*4);
 for(const[label,left]of [[2,15],[3,39]])for(let y=18;y<23;y++)for(let x=left;x<left+7;x++){mask[y*width+x]=label;data.set([55,50,46,255],(y*width+x)*4);}
 const parsing={width,height,mask,landmarks,imageData:{width,height,data}};
 assert.equal(mapPhotoToAppearance(landmarks,{width:1000,height:1000,parsing}).values.browColor,'#37322e');
 for(let i=0;i<mask.length;i++)if(mask[i]===2||mask[i]===3)data.set([182,126,97,255],i*4);
 const result=mapPhotoToAppearance(landmarks,{width:1000,height:1000,parsing});assert.ok(!('browColor'in result.values));assert.ok(result.warnings.some(x=>x.includes('眉色保留原样')));
});

test('visible teeth require a real opening and an interior contrast patch, not bright glossy lips',()=>{
 const p=face();p[14].y=.666;
 const width=200,height=200,data=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<width*height;i++)data.set([190,130,100,255],i*4);
 for(let y=129;y<=134;y++)for(let x=89;x<=111;x++)data.set([35,25,25,255],(y*width+x)*4);
 for(let y=130;y<=131;y++)for(let x=94;x<=106;x++)data.set([220,214,199,255],(y*width+x)*4);
 const imageData={width,height,data};assert.equal(detectVisibleTeeth(imageData,p),true);
 const result=mapPhotoToAppearance(p,{width:1000,height:1000,imageData,blendshapes:[{categoryName:'mouthSmileLeft',score:.7},{categoryName:'mouthSmileRight',score:.7}]});assert.equal(result.values.mouthStyle,'grin');assert.equal(result.values.mouthHeight,.6);
 const closed=structuredClone(p);closed[14].y=closed[13].y+.002;assert.equal(detectVisibleTeeth(imageData,closed),false);
 for(let y=129;y<=134;y++)for(let x=89;x<=111;x++)data.set([235,225,215,255],(y*width+x)*4);
 assert.equal(detectVisibleTeeth(imageData,p),false,'uniform exposure is not teeth evidence');
 for(let y=129;y<=134;y++)for(let x=89;x<=111;x++)data.set([35,25,25,255],(y*width+x)*4);
 for(let y=130;y<=131;y++)for(let x=94;x<=106;x++)data.set([220,70,90,255],(y*width+x)*4);
 assert.equal(detectVisibleTeeth(imageData,p),false,'saturated lip highlights are not teeth');
});
test('after fitting, actual rendered eye and mouth placement use the fixed photo coordinate frame',()=>{
 const p=face();for(const id of [61,291,0,17,13,14])p[id].y-=.03;
 for(const [l,r,x,y]of [[93,323,.25,.50],[132,361,.27,.58],[58,288,.30,.64],[136,365,.34,.70],[150,379,.38,.74],[149,378,.42,.77],[176,400,.46,.79],[148,377,.48,.795]]){
  p[l]={x,y,z:0};p[r]={x:1-x,y,z:0};
 }
 for(const artStyle of ['drama','organic','satire']){
  const {values,fit}=mapPhotoToAppearance(p,{width:1000,height:1000,appearance:{artStyle}});
  assert.equal(fit.candidates,APPEARANCE_OPTIONS.faceShape.length);
  const actor=makeCustomActor({id:'projection-test',appearance:{...values,artStyle}});actor.mesh.updateMatrixWorld(true);
  try{
   const origin=actor._head.getWorldPosition(new THREE.Vector3()),scale=artStyle==='satire'?.88:.78;
   const projected=o=>o.getWorldPosition(new THREE.Vector3()).sub(origin).divideScalar(scale);
   const eyeL=projected(actor._eyes[0]),eyeR=projected(actor._eyes[1]),mouth=projected(actor._mouth);
   const fw=.5,fh=.65,headHeight=fh*1.22,units=Math.sqrt((.51*.564)/(fw*headHeight));
   const expectedEyeDistance=(.6275-.3725)*units;
   const expectedEyeY=(headHeight/2-(.4-(.15-fh*.22)))*units;
   assert.ok(Math.abs(eyeR.x-eyeL.x-expectedEyeDistance)<.00002,`${artStyle}: eye spacing uses fitted inverse scale`);
   assert.ok(Math.abs(eyeL.y-expectedEyeY)<.00002,`${artStyle}: eye height uses fitted inverse scale`);
   const expectedMouthY=(headHeight/2-(.62-(.15-fh*.22)))*units;
   // If the destination slider clips, report the bound rather than expecting
   // an impossible match. This fixture stays inside the mouth travel range.
   assert.ok(Math.abs(mouth.y-expectedMouthY)<.00002,`${artStyle}: mouth height uses fitted inverse scale`);
  }finally{disposeCustomActor(actor);}
 }
});
