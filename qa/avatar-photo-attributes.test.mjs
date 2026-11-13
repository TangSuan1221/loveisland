import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePhotoAttributes} from '../src/avatar-photo-attributes.js';
import {APPEARANCE_OPTIONS} from '../src/avatar-schema.js';
import {FEATURE_PROFILES} from '../src/avatar-feature-catalog.js';
import {HAIR_FRONT_DESIGNS,HAIR_BACK_DESIGNS} from '../src/avatar-hair-catalog.js';
import {HAIR_ATLAS} from '../src/avatar-photo-hair-atlas.js';

function fixture(){
 const width=128,height=128,mask=new Uint8Array(width*height),data=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<width*height;i++)data.set([250,250,250,255],i*4);
 const landmarks=Array.from({length:478},()=>({x:.5,y:.5,z:0}));
 Object.assign(landmarks,{10:{x:.5,y:.27},152:{x:.5,y:.80},234:{x:.25,y:.49},454:{x:.75,y:.49},33:{x:.32,y:.44},133:{x:.44,y:.44},362:{x:.56,y:.44},263:{x:.68,y:.44}});
 function rect(x1,y1,x2,y2,id,rgb){for(let y=y1;y<y2;y++)for(let x=x1;x<x2;x++){const i=y*width+x;mask[i]=id;data.set([...rgb,255],i*4);}}
 return {width,height,mask,landmarks,imageData:{width,height,data},rect};
}
test('gray hair samples segmented interior, not the white photograph background',()=>{
 const f=fixture();f.rect(27,15,101,36,17,[142,145,148]);f.rect(27,34,34,60,17,[142,145,148]);f.rect(94,34,101,60,17,[142,145,148]);
 // Deliberate anti-aliased boundary contamination should not bleach hair.
 f.rect(27,15,101,16,17,[250,250,250]);f.rect(27,35,101,36,17,[250,250,250]);
 const r=analyzePhotoAttributes(f);assert.equal(r.values.hairColor,'#8e9194');
 assert.equal(r.values.hairStyle,undefined);assert.equal(r.diagnostics.hairMatch.frontCount,Object.values(HAIR_FRONT_DESIGNS).filter(d=>d.family!=='anime').length);assert.equal(r.diagnostics.hairMatch.backCount,Object.values(HAIR_BACK_DESIGNS).filter(d=>d.family!=='anime').length);
 assert.match(r.values.hairBack,/^(cropped|sweptback|taper)_/,'short observed contour must not invent a long back or tied style');
 assert.equal(r.values.facialHair,undefined);assert.equal(r.values.skinColor,undefined);
});
test('long silhouette produces long-hair candidates instead of short-hair ones',()=>{
 const f=fixture();f.landmarks[152].y=.70;f.rect(22,12,106,34,17,[45,35,30]);f.rect(22,32,35,116,17,[45,35,30]);f.rect(93,32,106,116,17,[45,35,30]);
 const r=analyzePhotoAttributes(f),options=r.candidates.find(c=>c.field==='hairBack').options;
 const entry=HAIR_ATLAS.entries.find(e=>e.field==='hairBack'&&e.value===options[0].value),last=entry.rows.findLastIndex(row=>row!==0);assert.ok(HAIR_ATLAS.grid.yMin+(last+.5)*(HAIR_ATLAS.grid.yMax-HAIR_ATLAS.grid.yMin)/HAIR_ATLAS.grid.height>.6,'long visible sides must select an actually long rendered contour');assert.doesNotMatch(r.values.hairBack||'',/^(bun|doublebun|ponytail|twintails|braid|twinbraids)_/,'unseen tied arrangement is a candidate, not an automatic assertion');assert.equal(r.values.hairColor,'#2d231e');
});
test('bilateral eye-region masks produce glasses while isolated false labels do not',()=>{
 const f=fixture();
 for(const x of [37,69]){f.rect(x,48,x+23,51,6,[38,40,42]);f.rect(x,61,x+23,64,6,[38,40,42]);f.rect(x,48,x+3,64,6,[38,40,42]);f.rect(x+20,48,x+23,64,6,[38,40,42]);}
 f.rect(58,53,72,55,6,[38,40,42]);
 const r=analyzePhotoAttributes(f);assert.equal(r.values.glasses,'square');assert.equal(r.values.glassesColor,'#26282a');
 const noise=fixture();noise.rect(35,51,37,53,6,[30,30,30]);assert.equal(analyzePhotoAttributes(noise).values.glasses,undefined);
});
test('thin black frames are sampled at lens boundaries instead of warm skin or pupils',()=>{
 const f=fixture();
 for(const x of [34,69]){
  f.rect(x,46,x+25,66,6,[155,99,72]);
  // Actual one-pixel frame lies outside the region assigned to the lens.
  f.rect(x-1,45,x+26,46,1,[24,26,28]);f.rect(x-1,66,x+26,67,1,[24,26,28]);
  f.rect(x-1,45,x,67,1,[24,26,28]);f.rect(x+25,45,x+26,67,1,[24,26,28]);
 }
 f.rect(47,55,50,58,6,[0,0,0]);f.rect(78,55,81,58,6,[0,0,0]);
 const r=analyzePhotoAttributes(f);assert.ok(APPEARANCE_OPTIONS.glasses.some(o=>o.value===r.values.glasses));assert.equal(r.diagnostics.glassesMatch.candidates,57);assert.equal(r.values.glassesColor,'#181a1c');
});
test('missing or tiny segmented regions never erase an existing style or infer baldness',()=>{
 const f=fixture();f.rect(65,10,67,12,17,[80,80,80]);const r=analyzePhotoAttributes(f);
 assert.equal(r.values.hairStyle,undefined);assert.equal(r.values.glasses,undefined);assert.equal(r.values.hairColor,undefined);assert(r.warnings.length);
});
test('invalid masks return editable warnings without invented parameters or retained photos',()=>{
 const r=analyzePhotoAttributes({mask:new Uint8Array(1),width:128,height:128});assert.deepEqual(r.values,{});assert(r.warnings.length);assert(!JSON.stringify(r).includes('landmarks'));
});
test('tilted portraits retain hair candidates after eye-line alignment',()=>{
 const f=fixture();f.rect(27,15,101,36,17,[142,145,148]);const expected=analyzePhotoAttributes(f).candidates[0].options[0].value;
 const angle=.3,c=Math.cos(angle),s=Math.sin(angle),mask=new Uint8Array(128*128),data=new Uint8ClampedArray(128*128*4);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const sx=Math.round((x-64)*c+(y-64)*s+64),sy=Math.round(-(x-64)*s+(y-64)*c+64);
  if(sx>=0&&sx<128&&sy>=0&&sy<128){mask[y*128+x]=f.mask[sy*128+sx];data.set(f.imageData.data.slice((sy*128+sx)*4,(sy*128+sx)*4+4),(y*128+x)*4);}
 }
 const landmarks=f.landmarks.map(p=>({x:(p.x-.5)*c-(p.y-.5)*s+.5,y:(p.x-.5)*s+(p.y-.5)*c+.5}));
 const actual=analyzePhotoAttributes({...f,mask,landmarks,imageData:{width:128,height:128,data}});
 assert.equal(actual.candidates[0].options[0].value,expected);assert.equal(actual.values.hairColor,'#8e9194');
});

test('equal outer hair bounds with different forehead coverage select different actual front components',()=>{
 const open=fixture();open.rect(27,15,101,26,17,[100,95,90]);open.rect(27,25,34,60,17,[100,95,90]);open.rect(94,25,101,60,17,[100,95,90]);
 const fringe=fixture();fringe.rect(27,15,101,47,17,[100,95,90]);fringe.rect(27,46,34,60,17,[100,95,90]);fringe.rect(94,46,101,60,17,[100,95,90]);
 const a=analyzePhotoAttributes(open),b=analyzePhotoAttributes(fringe);
 assert.notEqual(a.values.hairFront,b.values.hairFront);
 assert.ok(a.diagnostics.hairMatch.features.foreheadExposure>b.diagnostics.hairMatch.features.foreheadExposure+.15);
 assert.equal(a.values.hairStyle,undefined);assert.equal(b.values.hairStyle,undefined);
});

test('rectangular lens corner coverage contributes to frame shape and size is measured',()=>{
 const f=fixture();for(const x of [34,69])f.rect(x,46,x+25,66,6,[155,99,72]);
 const r=analyzePhotoAttributes(f);assert.ok(r.diagnostics.glassesMatch.cornerFill>.8);
 assert.ok(['rect','brow'].includes(FEATURE_PROFILES[r.values.glasses]?.shape)||r.values.glasses==='square');
 assert.ok(r.values.glassesSize>=.7&&r.values.glassesSize<=1.3);
 assert.equal(r.values.glassesLens,'clear');
 assert(r.candidates.find(o=>o.field==='glasses').options[0].patch.glassesSize);
});

test('candidate dependent controls are explicit and hair matching never invents colour gradients',()=>{
 const f=fixture();f.rect(27,15,101,26,17,[130,130,130]);f.rect(27,25,34,60,17,[130,130,130]);f.rect(94,25,101,60,17,[130,130,130]);
 const r=analyzePhotoAttributes(f),front=r.candidates.find(o=>o.field==='hairFront');
 assert(front.options.every(o=>typeof o.patch.hairMirror==='boolean'&&o.patch.hairTwoTone===false));
 assert(r.diagnostics.hairMatch.hairBack.every(o=>o.mirror===r.values.hairMirror));
 assert.equal(r.values.hairTwoTone,false);assert.equal(r.values.hairSecondaryColor,undefined);
});

test('frame retrieval compares the rendered face-scaled aspect ratio rather than the local profile',()=>{
 const f=fixture();for(const x of [34,69])f.rect(x,46,x+25,66,6,[155,99,72]);
 const tall=analyzePhotoAttributes(f,{appearance:{faceWidth:.8,faceHeight:1.2}}),wide=analyzePhotoAttributes(f,{appearance:{faceWidth:1.2,faceHeight:.8}});
 assert.notEqual(tall.values.glasses,wide.values.glasses,'the same local frame would stretch differently with the fitted face');
 for(const r of [tall,wide]){const {ratio,renderedRatio,faceAspectScale}=r.diagnostics.glassesMatch;assert.ok(Math.abs(Math.log(renderedRatio/ratio))<.14,`projected ratio ${renderedRatio} should fit observed ${ratio}`);const p=FEATURE_PROFILES[r.values.glasses];if(p)assert.equal(renderedRatio,p.w/p.h*faceAspectScale);}
});

test('frame vertical placement uses lens bound centres and compensates nonuniform head scaling',()=>{
 const f=fixture();for(const x of [34,69]){f.rect(x,48,x+25,57,6,[35,35,35]);f.rect(x,66,x+25,68,6,[35,35,35]);f.rect(x,48,x+2,68,6,[35,35,35]);f.rect(x+23,48,x+25,68,6,[35,35,35]);}
 const normal=analyzePhotoAttributes(f),tall=analyzePhotoAttributes(f,{appearance:{faceWidth:.8,faceHeight:1.2}});
 assert.ok(Math.abs(normal.diagnostics.glassesMatch.lensCenterY-57.5)<1,'dense upper rim must not pull the centre upward');
 assert.ok(Math.abs(tall.values.glassesY-normal.values.glassesY*(.8/1.2))<.00015);
});

test('complete close-cropped hair never keeps an old long back or invents large curl crowns',()=>{
 const f=fixture();f.rect(27,12,101,23,17,[90,85,80]);f.rect(27,22,33,53,17,[90,85,80]);f.rect(95,22,101,53,17,[90,85,80]);
 const r=analyzePhotoAttributes(f);
 assert.match(r.values.hairBack,/^(cropped|sweptback|taper)_/,'coarse short length is reliable even if fine silhouette distance is not');
 assert.doesNotMatch(r.values.hairFront||'',/^(curl|coils|quiff|spikes|mohawk|fan)_/,'thin compact crown does not justify large decorative volume');
 assert.equal(r.diagnostics.hairMatch.frontComparedCount,Object.values(HAIR_FRONT_DESIGNS).filter(d=>d.family!=='anime').length+1,'the real no-extra-front cap participates beside every decorative design');
 assert(r.candidates.find(c=>c.field==='hairFront').options.some(o=>o.value==='none'));
});
