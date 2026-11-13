import test from 'node:test';
import assert from 'node:assert/strict';
import {photoCoordinateFrame,photoContourTarget} from '../src/avatar-photo-fit.js';
import {estimatePhotoCrown} from '../src/avatar-photo-mapping.js';

test('photo coordinates preserve measured aspect instead of widening portraits',()=>{
 for(const aspect of [1,1.15,1.35,1.6,1.85]){
  const fw=180,fh=fw*aspect,headHeight=fh*1.22,frame=photoCoordinateFrame({faceWidth:fw,headHeight});
  assert.ok(Math.abs(frame.height/frame.width-headHeight/fw)<1e-12);
  assert.ok(Math.abs(frame.width/fw-frame.height/headHeight)<1e-12,'one pixel scale on both axes');
 }
});

test('symmetric contour target is invariant to projected midline shifts',()=>{
 const p=Array.from({length:478},()=>({x:0,y:100}));
 for(const[l,r,x,y]of [[127,356,80,30],[234,454,90,80],[93,323,88,100],[132,361,82,120],[58,288,74,140],[172,397,68,150],[136,365,58,165],[150,379,44,175],[149,378,34,183],[176,400,22,190],[148,377,12,194]]){p[l]={x:100-x,y};p[r]={x:100+x,y};}
 p[152]={x:100,y:200};
 const args={faceWidth:180,faceHeight:200,crownY:-44,headHeight:244,centerX:100};
 const a=photoContourTarget(p,args),b=photoContourTarget(p,{...args,centerX:128});
 assert.deepEqual(a,b,'jaw width uses opposing boundary span, not displaced nose/midline');
 assert.ok(a.samples.slice(0,3).every(x=>x.weight>a.samples.at(-1).weight),'dense chin landmarks do not dominate cheek measurements');
});

function parseFixture({top=20,wide=false,clipped=false}={}){
 const width=256,height=256,mask=new Uint8Array(width*height),landmarks=Array.from({length:478},()=>({x:.5,y:.5}));
 for(const[id,x,y]of [[10,.5,.32],[152,.5,.90],[234,.25,.54],[454,.75,.54],[33,.32,.5],[133,.42,.5],[362,.58,.5],[263,.68,.5]])landmarks[id]={x,y};
 for(let y=clipped?0:top;y<85;y++)for(let x=wide?15:68;x<(wide?241:188);x++)mask[y*width+x]=17;
 return{width,height,mask,landmarks};
}
test('head-top evidence is bounded, crop-sensitive and rejects bulky hair as skull',()=>{
 const valid=estimatePhotoCrown(parseFixture());assert.equal(valid.source,'bounded-hair-silhouette');assert.ok(valid.ratio>.25&&valid.ratio<.4);
 for(const input of [undefined,parseFixture({clipped:true}),parseFixture({wide:true}),parseFixture({top:1})])assert.equal(estimatePhotoCrown(input).source,'anatomical-prior');
 const small=estimatePhotoCrown(parseFixture({top:55}));assert.ok(small.ratio<valid.ratio,'measured high scalp is not a fixed forehead multiplier');
});
