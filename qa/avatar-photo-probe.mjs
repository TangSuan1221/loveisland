import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'msedge',headless:true});const p=await browser.newPage();
p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,200))});
await p.goto('http://127.0.0.1:5188/qa/cartoon-studies.html');
await p.evaluate(()=>{const i=document.createElement('input');i.type='file';i.id='probe';document.body.append(i)});
await p.locator('#probe').setInputFiles(process.argv[2]||'qa/fixtures/face-portrait.jpg');
const result=await p.evaluate(async()=>{const bitmap=await createImageBitmap(document.querySelector('#probe').files[0]);return new Promise(resolve=>{const w=new Worker('/avatar-photo-worker.js');w.onmessage=async({data})=>{if(data.type==='progress'){console.log(data.message);return;}if(data.type==='result'){const counts={};for(const v of data.parsing?.mask||[])counts[v]=(counts[v]||0)+1;resolve({type:data.type,counts,warning:data.attributeWarning,points:data.landmarks.length,landmarks:data.landmarks});}else resolve(data);w.terminate()};w.onerror=e=>resolve({error:e.message});w.postMessage({bitmap,baseURL:location.origin+'/vendor/mediapipe'},[bitmap]);})});const {landmarks,...small}=result;if(landmarks){const{writeFileSync}=await import('node:fs');writeFileSync('qa/photo-local-landmarks.json',JSON.stringify({landmarks}));}console.log(JSON.stringify(small));await browser.close();
