import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
const av=s=>page.locator('.avatar-studio '+s),click=a=>av(`[data-action="${a}"]`).first().click(),diag=()=>page.evaluate(()=>window.__avatarDiagnostics());
const record=s=>{checks.push(s);console.log('PASS',s);};
try{
 await page.goto('http://127.0.0.1:5188/?qa',{waitUntil:'domcontentloaded'});await page.locator('[data-action="editAppearance"]').first().click();await av('.av-preview-loading').waitFor({state:'hidden'});
 const before=(await diag()).production;
 await av('.av-name').fill('存储失败不应生效');
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError');};});await click('save');
 assert.match(await av('.av-status').innerText(),/存储空间不足/);assert.deepEqual((await diag()).production,before);assert.equal(await av('.av-name').inputValue(),'存储失败不应生效');
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem;});await click('close');await av('[data-action="discard"]').click();record('quota failure rolls back authoritative data and retains editable draft');
 await page.locator('[data-action="editAppearance"]').first().click();await av('.av-preview-loading').waitFor({state:'hidden'});await click('new');await av('.av-name').fill('待删除人物');await click('save');
 const count=(await diag()).production.candidates.length;await click('delete');await av('[data-action="delete-stay"]').click();assert.equal((await diag()).production.candidates.length,count);
 await click('delete');await av('[data-action="delete-confirm"]').click();assert.equal((await diag()).production.candidates.length,count-1);record('delete confirmation cancels safely and removes unused custom identity');
 await click('new');await av('.av-name').fill('极端比例检查');await av('[data-category="body"]').click();
 for(const key of ['height','build','headScale'])await av(`[data-range="${key}"]`).evaluate(el=>{el.value=el.max;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 await av('[data-category="face"]').click();for(const key of ['faceWidth','faceHeight'])await av(`[data-range="${key}"]`).evaluate(el=>{el.value=el.max;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 await click('save');const custom=(await diag()).production.candidates.find(c=>c.name==='极端比例检查');assert.equal(custom.appearance.height,1.3);
 for(const view of ['face','side','back','full']){await av(`[data-view="${view}"]`).click();await page.screenshot({path:`qa/avatar-view-${view}.png`});}
 await av('[data-view="face"]').click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await page.screenshot({path:'qa/avatar-mobile-final.png'});const canvasBox=await av('.av-preview-canvas canvas').boundingBox();assert(canvasBox.width>100&&canvasBox.width<390);record('extreme proportions and four camera directions render at desktop and mobile sizes');
 await page.setViewportSize({width:1440,height:1000});await av('input[data-reference-input]').count();
 const refInput=av('.av-reference input[type="file"]');await refInput.setInputFiles('qa/avatar-webgpu-island.png');await av('.av-reference-content img').waitFor({state:'visible'});assert(!JSON.stringify((await diag()).production.candidates.find(c=>c.id===custom.id)).includes('data:image'));await av('[data-reference-remove]').click();record('reference image is local-only and removable');
 await av('.av-name').fill('未保存焦点测试');await click('close');await page.keyboard.press('Tab');assert(await av('.av-confirm:not(.av-delete-confirm)').evaluate(el=>el.contains(document.activeElement)));await page.keyboard.press('Escape');assert(await av('.av-confirm:not(.av-delete-confirm)').evaluate(el=>el.hidden));await click('close');await av('[data-action="discard"]').click();assert.equal((await diag()).production.candidates.find(c=>c.id===custom.id).name,'极端比例检查');record('confirmation traps focus and Escape leaves saved state untouched');
 for(let i=0;i<30;i++){await page.locator('[data-action="editAppearance"]').first().click();await av('.av-preview-loading').waitFor({state:'hidden'});assert.equal((await diag()).preview.backend,'webgpu');await click('close');}record('30 open/close cycles initialize and release independent WebGPU previews');
 const unsupported=await context.newPage();await unsupported.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined}));await unsupported.goto('http://127.0.0.1:5188/',{waitUntil:'domcontentloaded'});await unsupported.locator('#game-loading span').filter({hasText:'WebGPU'}).waitFor();assert.equal(await unsupported.locator('#scene canvas').count(),0);await unsupported.close();record('unsupported WebGPU shows actionable error without claiming fallback success');
 assert.deepEqual(errors,[]);writeFileSync('qa/avatar-browser-edgecases-results.json',JSON.stringify({result:'PASS',checks,errors},null,2));
}catch(error){await page.screenshot({path:'qa/avatar-edgecase-failure.png'}).catch(()=>{});writeFileSync('qa/avatar-browser-edgecases-results.json',JSON.stringify({result:'FAIL',checks,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}
