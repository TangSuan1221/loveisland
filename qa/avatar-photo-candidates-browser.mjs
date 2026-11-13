import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {appearanceForCandidate} from '../src/avatar-schema.js';
// UI contract test with a mocked recognition response, not inference validation.
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
try{
 await page.route('**/src/avatar-photo.js*',route=>route.fulfill({contentType:'application/javascript',body:`export function createPhotoMatcher(){return {dispose(){},async analyze(file,options){if(!options.appearance?.artStyle)throw new Error('missing appearance');return {values:{skinColor:'#cda17f',hairColor:'#777777'},summary:['UI测试候选'],warnings:[],candidates:[{field:'hairStyle',label:'发型待确认',reason:'轮廓接近多个发型',options:[{value:'side'},{value:'crop'},{value:'bogus'}]},{field:'glasses',label:'眼镜待确认',options:[{value:'square'},{value:'round'}]}]}}}}`}))
 await page.goto('http://127.0.0.1:5188/?qa');await page.locator('[data-action=editAppearance]').first().click();await page.locator('.av-preview-loading').waitFor({state:'hidden'});
 await page.locator('[data-category=hair]').click();await page.locator('[data-field=hairFront][data-value=curtain_2]').click();await page.locator('[data-field=hairBack][data-value=twinbraids_3]').click();await page.locator('.avatar-studio [data-action=save]').click();
 const before=await page.evaluate(()=>window.__avatarDiagnostics().production.candidates.find(c=>c.id==='lin'));
 const original=appearanceForCandidate(before),av=s=>page.locator('.avatar-studio '+s),action=a=>av(`[data-action="${a}"]`).first().click();
 await av('[data-photo-open]').click();await av('[data-photo-input]').setInputFiles('qa/fixtures/face-portrait.jpg');await av('[data-photo-preserve=hairStyle]').waitFor();
 assert.equal(await av('[data-photo-preserve=hairStyle]').getAttribute('aria-pressed'),'true');assert.equal(await av('[data-photo-value=bogus]').count(),0);
 await av('[data-photo-choice=hairStyle][data-photo-value=side]').click();await av('[data-photo-choice=glasses][data-photo-value=square]').click();
 assert.deepEqual(await page.evaluate(()=>window.__avatarDiagnostics().production.candidates.find(c=>c.id==='lin')),before);
 await av('[data-photo-preserve=hairStyle]').click();
 await page.setViewportSize({width:390,height:844});await av('[data-photo-choice=glasses][data-photo-value=square]').scrollIntoViewIfNeeded();const box=await av('[data-photo-choice=glasses][data-photo-value=square]').boundingBox();assert(box.x>=0&&box.x+box.width<=390);
 await av('[data-photo-apply]').click();await action('save');
 const matched=await page.evaluate(()=>window.__avatarDiagnostics().production.candidates.find(c=>c.id==='lin').appearance);
 assert.equal(matched.hairStyle,original.hairStyle);assert.equal(matched.hairFront,'curtain_2');assert.equal(matched.hairBack,'twinbraids_3');assert.equal(matched.hairColor,'#777777');assert.equal(matched.glasses,'square');
 await action('undo');await action('save');assert.deepEqual(await page.evaluate(()=>window.__avatarDiagnostics().production.candidates.find(c=>c.id==='lin').appearance),original);
 await av('[data-photo-open]').click();await av('[data-photo-input]').setInputFiles('qa/fixtures/face-portrait.jpg');await av('[data-photo-choice=hairStyle][data-photo-value=side]').click();await av('[data-photo-apply]').click();await action('save');const replaced=await page.evaluate(()=>window.__avatarDiagnostics().production.candidates.find(c=>c.id==='lin').appearance);assert.equal(replaced.hairStyle,'side');assert.equal(replaced.hairFront,'auto');assert.equal(replaced.hairBack,'auto');
 console.log('PASS mocked candidate UI: defaults preserve, invalid options filtered, selections pending until apply, manual preserve, mobile width, single undo');
}catch(error){console.log(await page.locator('.av-photo-progress').textContent());throw error;}finally{await browser.close();}
