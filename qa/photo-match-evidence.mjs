import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const path=process.argv[2]||'C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-8669abe2-22e8-4ca5-b1b9-00e2c3b3adef.png';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:5188/'))external.push(r.url());});
try{
 await page.goto('http://127.0.0.1:5188/qa/avatar-cast-expansion.html');await page.waitForFunction(()=>window.done);
 await page.evaluate(()=>{const input=document.createElement('input');input.type='file';input.id='evidence';document.body.append(input)});await page.locator('#evidence').setInputFiles(path);
 const evidence=await page.evaluate(async()=>{
  const bitmap=await createImageBitmap(document.querySelector('#evidence').files[0]),width=bitmap.width,height=bitmap.height,canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);const original=ctx.getImageData(0,0,width,height);
  const result=await new Promise((resolve,reject)=>{const worker=new Worker('/avatar-photo-worker.js'),timer=setTimeout(()=>{worker.terminate();reject(new Error('worker timeout'));},120000);worker.onmessage=({data})=>{if(['geometry','progress'].includes(data.type))return;clearTimeout(timer);worker.terminate();data.type==='result'?resolve(data):reject(new Error(data.message));};worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(new Error(e.message));};worker.postMessage({bitmap,baseURL:location.origin+'/vendor/mediapipe'},[bitmap]);});
  const {mapPhotoToAppearance}=await import('/src/avatar-photo-mapping.js'),{analyzePhotoAttributes}=await import('/src/avatar-photo-attributes.js');
  const mapped=mapPhotoToAppearance(result.landmarks,{width,height,imageData:original,blendshapes:result.blendshapes,parsing:result.parsing}),attributes=result.parsing?analyzePhotoAttributes(result.parsing,{appearance:mapped.values}):null;
  return {width,height,landmarks:result.landmarks,blendshapes:result.blendshapes,attributeWarning:result.attributeWarning,mapped,attributes,parsing:result.parsing?{...result.parsing,mask:Array.from(result.parsing.mask),imageData:{width:512,height:512,data:Array.from(result.parsing.imageData.data)}}:null};
 });
 writeFileSync(process.argv[3]||'qa/photo-fit-evidence.json',JSON.stringify(evidence));
 console.log(JSON.stringify({width:evidence.width,height:evidence.height,mapped:evidence.mapped,attributes:evidence.attributes,warning:evidence.attributeWarning},null,2));
 assert.equal(evidence.landmarks.length,478);assert(evidence.parsing);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS real local worker completed segmentation; zero page errors and external HTTP calls');
}finally{await browser.close();}
