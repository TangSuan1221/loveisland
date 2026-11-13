import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const av=s=>page.locator(`.avatar-studio ${s}`),check=name=>{checks.push(name);console.log('PASS',name);};
const appearance=()=>page.evaluate(()=>JSON.stringify(window.__avatarDiagnostics().preview.appearance));
const ref='C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-bb1f579c-afaf-4996-8112-de27960fd757.png';
try{
 await page.goto('http://127.0.0.1:5188/?qa');await page.locator('[data-action="editAppearance"]').first().click();await av('.av-preview-loading').waitFor({state:'hidden'});
 const before=await appearance();assert(before,'diagnostic appearance missing');const beforeHistory=await page.evaluate(()=>window.__avatarDiagnostics().preview.historyLength);
 await page.evaluate(()=>{window.__referenceURLs={created:[],revoked:[]};const c=URL.createObjectURL.bind(URL),r=URL.revokeObjectURL.bind(URL);URL.createObjectURL=o=>{const u=c(o);window.__referenceURLs.created.push(u);return u;};URL.revokeObjectURL=u=>{window.__referenceURLs.revoked.push(u);r(u);};});
 await av('.av-reference-file').setInputFiles(ref);await av('.av-reference-thumb').waitFor({state:'visible'});assert.match(await av('.av-status').innerText(),/不会上传/);check('local reference loads without changing appearance');
 await av('[data-reference-overlay]').check();assert(await av('.av-reference-layer').isVisible());
 const change=async(key,value)=>av(`[data-reference-control="${key}"]`).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
 await change('scale',2);await change('x',-16);await change('y',12);await change('rotation',8);await change('opacity',.4);
 const styles=await av('.av-reference-layer img').evaluate(el=>({transform:el.style.transform,left:el.style.left,top:el.style.top,opacity:el.style.opacity,fit:getComputedStyle(el).objectFit,pointer:getComputedStyle(el.parentElement).pointerEvents}));
 assert.equal(styles.transform,'translate(-50%, -50%) rotate(8deg) scale(2)');assert.equal(styles.left,'34%');assert.equal(styles.top,'62%');assert.equal(styles.opacity,'0.4');assert.equal(styles.fit,'contain');assert.equal(styles.pointer,'none');check('uniform scale, translation, rotation and opacity; no stretch and no blocked model controls');
 await av('[data-reference-gray]').check();assert.equal(await av('.av-preview-canvas > canvas').evaluate(el=>getComputedStyle(el).filter),'grayscale(1)');assert.equal(await av('.av-reference-thumb').evaluate(el=>getComputedStyle(el).filter),'grayscale(1)');check('grayscale affects both actual WebGPU model and reference');
 await av('[data-reference-toggle]').click();assert(!(await av('.av-reference-content').isVisible()));assert(await av('.av-reference-layer').isVisible());assert.equal(await av('[data-reference-toggle]').getAttribute('aria-expanded'),'false');check('collapse adjustment panel without losing overlay');
 assert.equal(await appearance(),before);assert.equal(await page.evaluate(()=>window.__avatarDiagnostics().preview.historyLength),beforeHistory);check('reference alignment is excluded from appearance and undo history');
 await av('[data-reference-toggle]').click();await av('[data-reference-reset]').click();assert.equal(await av('[data-reference-control="scale"]').inputValue(),'1');assert.equal(await av('[data-reference-control="rotation"]').inputValue(),'0');
 const validURL=await av('.av-reference-thumb').getAttribute('src');await av('.av-reference-file').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not png')});await page.waitForFunction(()=>document.querySelector('.avatar-studio .av-status').dataset.error==='true');assert.equal(await av('.av-reference-thumb').getAttribute('src'),validURL);check('invalid replacement preserves valid reference');
 await page.setViewportSize({width:390,height:844});const bounds=await av('.av-reference-content').boundingBox();await page.screenshot({path:'qa/avatar-reference-calibration-mobile.png'});assert(bounds.x>=0&&bounds.x+bounds.width<=390,JSON.stringify(bounds));assert(await av('[data-action="save"]').isVisible());await page.screenshot({path:'qa/avatar-reference-calibration-mobile.png'});check('mobile calibration panel remains in viewport with save accessible');
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'qa/avatar-reference-calibration-desktop.png'});
 await av('[data-reference-remove]').click();assert(!(await av('.av-reference-layer').isVisible()));assert.equal(await av('.av-preview-canvas > canvas').evaluate(el=>getComputedStyle(el).filter),'none');assert.equal(await av('.av-reference-thumb').getAttribute('src'),null);check('removal clears images, overlay and grayscale');
 await av('.av-reference-file').setInputFiles(ref);await av('.av-reference-thumb').waitFor({state:'visible'});await av('[data-action="close"]').first().click();await page.locator('.avatar-studio').waitFor({state:'detached'});
 const urls=await page.evaluate(()=>window.__referenceURLs);assert.equal(urls.created.length,3);for(const u of urls.created)assert(urls.revoked.includes(u),`URL not released ${u}`);check('invalid, removed and session images all release their object URLs');
 assert.deepEqual(errors,[]);writeFileSync('qa/avatar-reference-calibration-results.json',JSON.stringify({result:'PASS',checks,errors},null,2));
}finally{await browser.close();}

