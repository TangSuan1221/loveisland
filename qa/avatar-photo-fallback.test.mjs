import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeAppearance} from '../src/avatar-schema.js';
// Exercise controller merge/fallback with the real attribute mapper; detection
// is a browser double here, not a claim of actual ONNX model inference.
const source=readFileSync(new URL('../src/avatar-photo.js',import.meta.url),'utf8')
 .replace("import {mapPhotoToAppearance} from './avatar-photo-mapping.js';",'const mapPhotoToAppearance=()=>({values:{faceShape:"oval",mouthStyle:"smile"},summary:["geometry"],warnings:[]});')
 .replace("'./avatar-photo-attributes.js'",JSON.stringify(new URL('../src/avatar-photo-attributes.js',import.meta.url).href))
 .replaceAll('import.meta.env.BASE_URL','"/"');
const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const originals=Object.fromEntries(['Worker','OffscreenCanvas','createImageBitmap','location'].map(k=>[k,globalThis[k]]));
let activeWorker;
function install(){
 globalThis.location={origin:'http://127.0.0.1:5188'};
 globalThis.Worker=class {constructor(){activeWorker=this;this.stopped=false;}postMessage(){}terminate(){this.stopped=true;}};
 globalThis.createImageBitmap=async()=>({width:320,height:400,close(){}});
 globalThis.OffscreenCanvas=class {constructor(w,h){this.width=w;this.height=h;}getContext(){return{drawImage(){},getImageData:()=>({width:this.width,height:this.height,data:new Uint8ClampedArray(this.width*this.height*4)})};}transferToImageBitmap(){return{close(){}};}};
}
const tick=()=>new Promise(r=>setImmediate(r));
const original=normalizeAppearance({hairStyle:'long',hairColor:'#ababab',glasses:'square',glassesColor:'#123456',artStyle:'organic'});
const unchangedFields=['hairStyle','hairColor','glasses','glassesColor','artStyle'];
test.after(()=>{for(const [k,v]of Object.entries(originals))v===undefined?delete globalThis[k]:globalThis[k]=v;});
async function run(detection){install();const matcher=module.createPhotoMatcher();const request=matcher.analyze({type:'image/jpeg',size:100},{appearance:original});await tick();activeWorker.onmessage({data:{type:'result',landmarks:[],...detection}});const result=await request;assert.equal(activeWorker.stopped,true);matcher.dispose();return result;}
function verifyPatch(result){const applied=normalizeAppearance({...original,...result.values});for(const key of unchangedFields){assert.equal(applied[key],original[key],key);assert.equal(Object.hasOwn(result.values,key),false,key+' must not be overwritten');}assert.equal(applied.mouthStyle,'smile');assert.equal(Object.hasOwn(result,'parsing'),false);assert.equal(Object.hasOwn(result,'landmarks'),false);}
test('segmentation loading failure retains geometry and does not erase existing hair or glasses',async()=>{
 const result=await run({parsing:null,attributeWarning:'分割模型暂不可用'});verifyPatch(result);assert.deepEqual(result.warnings,['分割模型暂不可用']);
});
test('malformed attribute mask degrades to unchanged styling rather than removing it',async()=>{
 const result=await run({parsing:{mask:new Uint8Array(1),width:512,height:512}});verifyPatch(result);assert.match(result.warnings.join(''),/分割数据不完整/);assert.deepEqual(result.candidates,[]);
});

function fakeInferenceTimer(){
 const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
 let callback=null,cleared=false;const timer={fakeInferenceTimer:true};
 globalThis.setTimeout=(fn,delay,...args)=>{if(delay===90000){callback=fn;return timer;}return originalSet(fn,delay,...args);};
 globalThis.clearTimeout=id=>{if(id===timer){cleared=true;return;}return originalClear(id);};
 return {fire(){assert.ok(callback,'inference timeout must be installed');callback();},get cleared(){return cleared;},restore(){globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;}};
}
test('segmentation timeout uses completed geometry and retains styling without waiting 90 seconds',async()=>{
 install();const timer=fakeInferenceTimer(),matcher=module.createPhotoMatcher();
 try{
  const request=matcher.analyze({type:'image/jpeg',size:100},{appearance:original});await tick();
  activeWorker.onmessage({data:{type:'geometry',landmarks:[],blendshapes:[]}});
  assert.equal(activeWorker.stopped,false,'geometry message must not end the pending attribute stage');
  timer.fire();const result=await request;verifyPatch(result);
  assert.match(result.warnings.join(''),/头发与眼镜识别超时/);assert.equal(activeWorker.stopped,true);assert.equal(timer.cleared,true);
 }finally{matcher.dispose();timer.restore();}
});
test('timeout before any completed geometry remains an actionable failure',async()=>{
 install();const timer=fakeInferenceTimer(),matcher=module.createPhotoMatcher();
 try{
  const request=matcher.analyze({type:'image/jpeg',size:100},{appearance:original});const rejected=assert.rejects(request,/识别超时/);await tick();
  timer.fire();await rejected;assert.equal(activeWorker.stopped,true);assert.equal(timer.cleared,true);
 }finally{matcher.dispose();timer.restore();}
});
