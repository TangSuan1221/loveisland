import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const av=s=>page.locator(`.avatar-studio ${s}`);
const action=id=>av(`[data-action=${id}]`).first().click();
const saved=()=>page.evaluate(()=>window.__avatarDiagnostics().production.candidates.find(c=>c.name==='发型结构验收'));
try{
 await page.goto(process.env.AVATAR_QA_URL||'http://127.0.0.1:5188/?qa');
 await page.locator('[data-action=editAppearance]').first().click();await av('.av-preview-loading').waitFor({state:'hidden'});
 await action('new');await av('.av-name').fill('发型结构验收');await av('[data-category=hair]').click();
 await av('[data-part-family-filter=hairFront]').selectOption('closepart');
 const visible=av('[data-catalog=hairFront] .av-part:visible');assert(await visible.count()>0);
 assert((await visible.evaluateAll(els=>els.map(e=>e.dataset.value))).every(v=>v.startsWith('closepart_')));
 const chosen=await visible.first().getAttribute('data-value');await visible.first().click();
 assert.equal(await av('[data-part-family-filter=hairFront]').inputValue(),'closepart','selection must not reset filter');
 await av('[data-part-search=hairFront]').fill('不存在');assert.equal(await visible.count(),0);
 assert(await av('[data-catalog=hairFront] .av-catalog-empty').isVisible());await av('[data-part-search=hairFront]').fill('');
 await av('[data-part-family-filter=hairBack]').selectOption('ringlets');await av('[data-catalog=hairBack] .av-part:visible').first().click();
 for(const [key,value]of Object.entries({hairFrontLength:1.22,hairBackLength:1.35,hairVolume:1.14})){
  const slider=av(`[data-range=${key}]`);await slider.focus();await slider.fill(String(value));await slider.dispatchEvent('change');
 }
 await av('[data-category=face]').click();
 await av('[data-toggle=muzzleTint]').check();
 const muzzle=av('[data-range=muzzleDepth]');await muzzle.focus();await muzzle.fill('0.07');await muzzle.dispatchEvent('change');
 await av('[data-category=hair]').click();
 await action('save');const original=(await saved()).appearance;
 assert.equal(original.muzzleTint,true);assert.equal(original.muzzleDepth,.07);
 assert.equal(original.hairFront,chosen);assert.equal(original.hairFrontLength,1.22);assert.equal(original.hairBackLength,1.35);assert.equal(original.hairVolume,1.14);
 await av('[data-nudge=hairBackLength][data-direction="1"]').click();await action('undo');await action('save');assert.deepEqual((await saved()).appearance,original);
 const download=page.waitForEvent('download');await action('export');const data=JSON.parse(readFileSync(await(await download).path(),'utf8'));assert.deepEqual(data.appearance,original);
 await av('[data-category=eyes]').click();await av('[data-category=hair]').click();assert.equal(await av('[data-part-family-filter=hairFront]').inputValue(),'closepart');
 await page.screenshot({path:'qa/hair-expansion-editor.png'});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.querySelector('.avatar-studio').scrollWidth<=innerWidth+1));
 await action('close');await page.reload();await page.locator('[data-action=editAppearance]').first().waitFor();assert.deepEqual((await saved()).appearance,original);
 assert.deepEqual(errors,[]);console.log('PASS structure filters, search intersection, retained filters, new hair controls, save/export/undo/reload and mobile layout');
}finally{await browser.close();}
