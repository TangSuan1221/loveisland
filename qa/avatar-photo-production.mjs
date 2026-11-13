import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const b=await chromium.launch({channel:'msedge',headless:true});
const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
try {
 await p.goto('http://127.0.0.1:5190/');await p.locator('[data-action=editAppearance]').first().click();await p.locator('.av-preview-loading').waitFor({state:'hidden'});await p.locator('[data-photo-open]').click();
 await p.route('**/face_landmarker.task',route=>route.abort());
 await p.locator('[data-photo-input]').setInputFiles('qa/fixtures/face-portrait.jpg');await p.waitForFunction(()=>document.querySelector('.av-photo-panel').getAttribute('aria-busy')==='false');assert.match(await p.locator('.av-photo-progress').innerText(),/资源加载失败/);console.log('PASS production missing model reports recoverable error');
 await p.unroute('**/face_landmarker.task');await p.locator('[data-photo-input]').setInputFiles('qa/fixtures/face-portrait.jpg');await p.waitForFunction(()=>document.querySelector('.av-photo-panel').getAttribute('aria-busy')==='false');assert.match(await p.locator('.av-photo-progress').innerText(),/匹配完成/);await p.locator('[data-photo-apply]').click();assert.equal(await p.locator('.avatar-studio [data-action=undo]').isEnabled(),true);assert.deepEqual(errors,[]);console.log('PASS production bundled model/runtime retries and applies successfully');
} finally {await b.close();}

