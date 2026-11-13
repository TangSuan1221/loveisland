import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {appearanceForCandidate} from '../src/avatar-schema.js';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:5188/'))external.push(r.url());});
page.setDefaultTimeout(30000);
const av=s=>page.locator('.avatar-studio '+s),diag=()=>page.evaluate(()=>window.__avatarDiagnostics());
const action=s=>av('[data-action="'+s+'"]').first().click();
const done=()=>page.waitForFunction(()=>document.querySelector('.av-photo-panel')?.getAttribute('aria-busy')==='false');
const record=s=>{checks.push(s);console.log('PASS',s);};
try{
 await page.goto('http://127.0.0.1:5188/?qa');await page.locator('[data-action=editAppearance]').first().click();await av('.av-preview-loading').waitFor({state:'hidden'});
 const original=(await diag()).production.candidates.find(c=>c.id==='lin'),originalAppearance=appearanceForCandidate(original);
 await av('[data-photo-open]').click();await av('[data-photo-input]').setInputFiles('qa/fixtures/face-portrait.jpg');await done();
 assert.match(await av('.av-photo-progress').innerText(),/匹配完成/);
 assert.deepEqual((await diag()).production.candidates.find(c=>c.id==='lin'),original);
 await page.screenshot({path:'qa/photo-match-result.png'});record('real local model detects a face; suggestions do not modify saved character');
 await page.setViewportSize({width:390,height:844});await av('[data-photo-apply]').scrollIntoViewIfNeeded();await page.screenshot({path:'qa/photo-match-mobile.png'});
 const bounds=await av('[data-photo-apply]').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390);await page.setViewportSize({width:1440,height:1000});
 await av('[data-photo-apply]').click();assert.equal(await av('[data-action=undo]').isEnabled(),true);
 await page.screenshot({path:'qa/photo-match-applied.png'});
 await action('save');const matched=(await diag()).production.candidates.find(c=>c.id==='lin');assert.notDeepEqual(matched.appearance,originalAppearance);
 for(const key of ['outfit','artStyle','strokes','height'])assert.deepEqual(matched.appearance[key],originalAppearance[key]);
 await action('undo');await action('save');assert.deepEqual((await diag()).production.candidates.find(c=>c.id==='lin').appearance,originalAppearance);
 await action('redo');await action('save');assert.deepEqual((await diag()).production.candidates.find(c=>c.id==='lin').appearance,matched.appearance);record('apply, save, undo and redo preserve unobserved styling; mobile button stays usable');
 const download=page.waitForEvent('download');await action('export');await(await download).saveAs('qa/photo-avatar-export.json');
 await action('close');await page.reload();await page.locator('[data-action=editAppearance]').first().click();await av('.av-preview-loading').waitFor({state:'hidden'});
 assert.deepEqual((await diag()).production.candidates.find(c=>c.id==='lin').appearance,matched.appearance);
 assert.equal(await av('.av-photo-image').getAttribute('src'),null);
 const storage=await page.evaluate(()=>JSON.stringify(localStorage));assert(!storage.includes('data:image')&&!storage.includes('blob:')&&!storage.includes('faceLandmarks'));record('saved parameters reload without persisting the photo or landmarks');
 const fixtures=await page.evaluate(async()=>{
  const image=await createImageBitmap(await(await fetch('/qa/fixtures/face-portrait.jpg')).blob());
  const c=document.createElement('canvas');c.width=1000;c.height=650;const ctx=c.getContext('2d');ctx.fillStyle='#eee';ctx.fillRect(0,0,1000,650);const blank=c.toDataURL();
  ctx.drawImage(image,0,0,500,625);ctx.drawImage(image,500,0,500,625);const multi=c.toDataURL();image.close();return{blank,multi};
 });
 await av('[data-photo-open]').click();
 for(const [name,expected]of [['blank',/没有识别到/],['multi',/多张人脸/]]){
  await av('[data-photo-input]').setInputFiles({name:name+'.png',mimeType:'image/png',buffer:Buffer.from(fixtures[name].split(',')[1],'base64')});await done();assert.match(await av('.av-photo-progress').innerText(),expected);assert.equal(await av('.av-photo-result').isVisible(),false);
  assert.deepEqual((await diag()).production.candidates.find(c=>c.id==='lin').appearance,matched.appearance);
 }record('actual model rejects blank and multi-person photos without mutating characters');
 await av('[data-photo-input]').setInputFiles({name:'broken.jpg',mimeType:'image/jpeg',buffer:Buffer.from('broken')});await done();assert.equal(await av('.av-photo-progress').getAttribute('data-error'),'true');
 await av('[data-photo-input]').setInputFiles('qa/fixtures/face-portrait.jpg');await av('[data-person=zhou]').click();await page.waitForTimeout(1200);assert.equal(await av('.av-photo-panel').isVisible(),false);assert.equal(await av('.av-preview-name').innerText(),'周屿');
 await av('[data-photo-open]').click();await av('[data-photo-input]').setInputFiles('qa/fixtures/face-portrait.jpg');await av('[data-photo-close]').click();await page.waitForTimeout(500);assert.equal(await av('.av-photo-panel').isVisible(),false);record('invalid file, switching person and closing cancel safely');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);record('no external HTTP requests, no page errors; rendering remains WebGPU');assert.equal((await diag()).preview.backend,'webgpu');
 writeFileSync('qa/avatar-photo-browser-results.json',JSON.stringify({result:'PASS',checks,errors,external},null,2));
}finally{await browser.close();}
