import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const input=process.argv[2]||'C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-8669abe2-22e8-4ca5-b1b9-00e2c3b3adef.png',tag=process.argv[3]||'after';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:5188/'))external.push(r.url());});
try{
 await page.goto('http://127.0.0.1:5188/?qa');await page.locator('[data-action=editAppearance]').first().click();await page.locator('.av-preview-loading').waitFor({state:'hidden'});
 await page.locator('[data-photo-open]').click();await page.locator('[data-photo-input]').setInputFiles(input);
 await page.waitForFunction(()=>document.querySelector('.av-photo-panel').getAttribute('aria-busy')==='false',null,{timeout:120000});
 const summary=await page.locator('.av-photo-result').innerText();assert(await page.locator('[data-photo-apply]').isVisible(),await page.locator('.av-photo-progress').innerText());
 await page.screenshot({path:`qa/photo-match-${tag}-suggestions.png`});
 // Deliberately no candidate selection, preset, style change or manual adjustment.
 await page.locator('[data-photo-apply]').click();await page.waitForTimeout(500);await page.locator('.avatar-studio [data-action=save]').click();
 const diagnostics=await page.evaluate(()=>window.__avatarDiagnostics()),appearance=diagnostics.production.candidates.find(c=>c.id==='lin').appearance;
 assert.equal(diagnostics.preview.backend,'webgpu');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await page.screenshot({path:`qa/photo-match-${tag}-automatic.png`});
 writeFileSync(`qa/photo-match-${tag}-result.json`,JSON.stringify({appearance,summary,manualSelections:0,errors,external},null,2));console.log(JSON.stringify({appearance,manualSelections:0,errors,external},null,2));
}finally{await browser.close();}
