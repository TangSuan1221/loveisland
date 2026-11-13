import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCustomActor,disposeCustomActor} from '../src/avatar-model.js';
import {fitFaceContour} from '../src/avatar-photo-fit.js';
import {normalizeAppearance,APPEARANCE_RANGES,APPEARANCE_OPTIONS} from '../src/avatar-schema.js';

// Expected silhouettes come from actual triangulated render meshes, not the
// solver's faceSurfacePoint helper. Hold out alternating latitude rings.
function meshRows(input){
 const a=normalizeAppearance(input),actor=makeCustomActor({id:'fit-test',appearance:a});
 try{
  const p=actor.mesh.getObjectByName('face-skin').geometry.attributes.position,rows=new Map();
  for(let i=0;i<p.count;i++){
   const y=p.getY(i)*a.faceHeight,key=Math.round(y*1e7),x=Math.abs(p.getX(i)*a.faceWidth);
   if(!rows.has(key)||x>rows.get(key).x)rows.set(key,{x,y});
  }
  return [...rows.values()].sort((a,b)=>a.y-b.y);
 }finally{disposeCustomActor(actor);}
}
function measuredError(rows,expected){
 return expected.reduce((sum,p)=>{
  const upper=rows.findIndex(q=>q.y>=p.y);
  if(upper<=0)return sum+.05;
  const a=rows[upper-1],b=rows[upper],t=(p.y-a.y)/(b.y-a.y),x=a.x+(b.x-a.x)*t;
  return sum+(x-p.x)**2;
 },0)/expected.length;
}
test('catalog-shape bounded fit improves held-out real mesh silhouette in each art style',()=>{
 for(const artStyle of ['drama','organic','satire']){
  const desired={artStyle,faceShape:'square',faceWidth:1.08,faceHeight:1.02,jawWidth:1.18,chinLength:.94};
  const rows=meshRows(desired),usable=rows.filter(p=>p.y>-.23&&p.y<.19),train=usable.filter((_,i)=>i%2===0),held=usable.filter((_,i)=>i%2===1);
  const initial={artStyle,faceShape:'heart',faceWidth:.94,faceHeight:1.1,jawWidth:.78,chinLength:1.16};
  const result=fitFaceContour({samples:train,chin:rows[0].y},initial);
  assert.equal(result.diagnostics.candidates,APPEARANCE_OPTIONS.faceShape.length);assert.ok(result.diagnostics.afterError<result.diagnostics.beforeError);
  const before=measuredError(meshRows(initial),held),after=measuredError(meshRows({...initial,...result.values}),held);
  assert.ok(after<before*.25,`${artStyle} held-out mesh error ${before} -> ${after}`);
  for(const [key,value]of Object.entries(result.values))if(APPEARANCE_RANGES[key])assert.ok(value>=APPEARANCE_RANGES[key][0]&&value<=APPEARANCE_RANGES[key][1]);
 }
});
test('insufficient silhouette observations preserve bounded initial values without fake improvement',()=>{
 const initial={artStyle:'drama',faceShape:'long',jawWidth:.9};
 const result=fitFaceContour({samples:[{x:.2,y:0}],chin:-.28},initial);
 assert.equal(result.values.faceShape,'long');assert.equal(result.values.jawWidth,.9);
 assert.equal(result.diagnostics.method,'insufficient-contour');assert.equal(result.diagnostics.candidates,0);
});
