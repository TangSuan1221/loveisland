import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Controller-only browser doubles: inference and landmark mapping are tested
// separately against the real model and mapping module.
const source=readFileSync(new URL('../src/avatar-photo.js',import.meta.url),'utf8')
 .replace("import {mapPhotoToAppearance} from './avatar-photo-mapping.js';",'const mapPhotoToAppearance=()=>({values:{faceShape:"oval"}});')
 .replace("import {analyzePhotoAttributes} from './avatar-photo-attributes.js';",'const analyzePhotoAttributes=()=>({values:{},summary:[],warnings:[],candidates:[]});')
 .replaceAll('import.meta.env.BASE_URL','"/"');
const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const originals=Object.fromEntries(['Worker','OffscreenCanvas','createImageBitmap','location'].map(k=>[k,globalThis[k]]));
const workers=[];
class WorkerDouble{
 constructor(){this.stopped=false;workers.push(this);}
 postMessage(data){this.data=data;}
 terminate(){this.stopped=true;}
}
function install(decode){
 workers.length=0;globalThis.location={origin:'http://127.0.0.1:5188'};
 globalThis.Worker=WorkerDouble;globalThis.createImageBitmap=decode;
 globalThis.OffscreenCanvas=class{
  constructor(w,h){this.width=w;this.height=h;}
  getContext(){return{drawImage(){},getImageData:()=>({width:this.width,height:this.height,data:new Uint8ClampedArray(this.width*this.height*4)})};}
  transferToImageBitmap(){return{close(){}};}
 };
}
const bitmap=()=>({width:320,height:400,closed:false,close(){this.closed=true;}});
const file={type:'image/jpeg',size:100};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test.after(()=>{for(const [k,v]of Object.entries(originals))v===undefined?delete globalThis[k]:globalThis[k]=v;});

test('unsupported and oversized files never start a worker',async()=>{
 install(async()=>bitmap());const matcher=module.createPhotoMatcher();
 await assert.rejects(matcher.analyze({...file,type:'image/svg+xml'}),/PNG/);
 await assert.rejects(matcher.analyze({...file,size:9*1024*1024}),/8 MB/);
 assert.equal(workers.length,0);matcher.dispose();
});
test('closing during decoding rejects the old request and releases its decoded image',async()=>{
 let resolve;install(()=>new Promise(r=>resolve=r));const matcher=module.createPhotoMatcher();
 const p=matcher.analyze(file);const rejected=assert.rejects(p,{name:'AbortError'});
 matcher.dispose();const image=bitmap();resolve(image);await rejected;
 assert.ok(image.closed);assert.equal(workers.length,0);
});
test('replacement cancels pending inference and a queued old worker error cannot kill the new worker',async()=>{
 install(async()=>bitmap());const matcher=module.createPhotoMatcher();
 const first=matcher.analyze(file);const rejected=assert.rejects(first,{name:'AbortError'});await tick();
 const old=workers[0],second=matcher.analyze(file);await rejected;await tick();
 assert.ok(old.stopped);assert.equal(workers.length,2);const current=workers[1];
 old.onerror({message:'queued old error'});
 assert.equal(current.stopped,false,'stale callback must not terminate replacement worker');
 current.onmessage({data:{type:'result',landmarks:[]}});
 assert.deepEqual(await second,{values:{faceShape:'oval'}});assert.ok(current.stopped);
 matcher.dispose();
});
