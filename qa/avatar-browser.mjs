import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';

const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
page.setDefaultTimeout(20000);
const diag=()=>page.evaluate(()=>window.__avatarDiagnostics());
const av=selector=>page.locator(`.avatar-studio ${selector}`);
const click=action=>av(`[data-action="${action}"]`).first().click();
const save=async()=>{await click('save');assert.match(await av('.av-status').innerText(),/已保存/);};
const open=async()=>{await page.locator('[data-action="editAppearance"]').first().click();await av('.av-preview-loading').waitFor({state:'hidden'});};
const close=async()=>{await click('close');await page.locator('.avatar-studio').waitFor({state:'detached'});};
const record=name=>{checks.push(name);console.log('PASS',name);};
try{
 await page.goto(process.env.AVATAR_QA_URL||'http://127.0.0.1:5188/?qa',{waitUntil:'domcontentloaded'});
 await page.locator('[data-action="editAppearance"]').first().waitFor();
 assert.equal((await diag()).backend,'webgpu');
 await open();assert.equal((await diag()).preview.backend,'webgpu');record('main and editor use native WebGPU');
 await click('new');await av('.av-name').fill('晴空测试角色');await av('[data-preset="0"]').click();
 await av('[data-category="eyes"]').click();
 await av('#av-eyeWidth').evaluate(el=>{el.value='1.25';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
 await av('[data-toggle="heterochromia"]').check();
 await av('[data-category="paint"]').click();await av('[data-art-tool="pen"]').click();
 await av('.av-paint-canvas').scrollIntoViewIfNeeded();let rect=await av('.av-paint-canvas').boundingBox();
 await page.mouse.move(rect.x+rect.width*.25,rect.y+rect.height*.60);await page.mouse.down();await page.mouse.move(rect.x+rect.width*.39,rect.y+rect.height*.64,{steps:8});await page.mouse.up();
 await av('[data-art-tool="star"]').click();await av('.av-paint-canvas').scrollIntoViewIfNeeded();rect=await av('.av-paint-canvas').boundingBox();await page.mouse.click(rect.x+rect.width*.68,rect.y+rect.height*.63);
 await save();let state=await diag();const custom=state.production.candidates.find(c=>c.name==='晴空测试角色');assert(custom);assert.equal(custom.appearance.eyeWidth,1.25);assert.equal(custom.appearance.faceArt.length,2);
 await page.screenshot({path:'qa/avatar-browser-painted.png'});record('create, precision controls, heterochromia and drawing persist');
 await click('undo');await save();assert.equal((await diag()).production.candidates.find(c=>c.id===custom.id).appearance.faceArt.length,1);
 await click('redo');await save();assert.equal((await diag()).production.candidates.find(c=>c.id===custom.id).appearance.faceArt.length,2);record('undo and redo affect actual saved appearance');
 const dl=page.waitForEvent('download');await click('export');await(await dl).saveAs('qa/avatar-export-test.json');const exported=JSON.parse(readFileSync('qa/avatar-export-test.json','utf8'));assert.equal(exported.format,'ratings-tyrant-avatar');
 await click('copy');await av('.av-name').fill('副本测试角色');await av('[data-preset="1"]').click();await save();const copy=(await diag()).production.candidates.find(c=>c.name==='副本测试角色');assert(copy.id!==custom.id);assert.equal((await diag()).production.candidates.find(c=>c.id===custom.id).appearance.hairStyle,custom.appearance.hairStyle);record('copy has independent identity and appearance');
 await av('.av-file-input').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await page.waitForTimeout(100);assert.equal(await av('.av-name').inputValue(),'副本测试角色');
 await av('.av-file-input').setInputFiles('qa/avatar-export-test.json');await page.waitForTimeout(100);assert.equal(await av('.av-name').inputValue(),'晴空测试角色');await av('.av-name').fill('导入测试角色');await save();record('JSON export/import round trip and invalid-file protection');
 await av('.av-name').fill('不应保存');await click('close');await av('[data-action="discard"]').click();await page.locator('.avatar-studio').waitFor({state:'detached'});assert(! (await diag()).production.candidates.some(c=>c.name==='不应保存'));record('discard does not mutate saved character');
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-action="editAppearance"]').first().waitFor();assert.equal((await diag()).production.candidates.find(c=>c.id===custom.id).appearance.faceArt.length,2);record('real localStorage reload restores customized characters');
 await open();await av(`[data-person="${custom.id}"]`).click();await page.setViewportSize({width:390,height:844});await page.screenshot({path:'qa/avatar-browser-mobile.png'});assert(await av('[data-action="save"]').isVisible());assert((await av('[data-action="save"]').boundingBox()).x>=0);await page.setViewportSize({width:1440,height:1000});await close();
 await page.locator('[data-action="start"][data-mode="tutorial"]').click();
 for(const id of [custom.id,'lin','zhou','qiao'])await page.locator(`[data-action="toggleCast"][data-id="${id}"]`).first().click();
 await page.locator('[data-action="confirmCast"]').click();await page.locator('[data-action="autoBuild"]').click();
 await open();await av(`[data-person="${custom.id}"]`).click();const before=await diag();
 await av('[data-category="hair"]').click();await av('[data-field="hairStyle"][data-value="spiky"]').click();await save();const after=await diag();
 assert.deepEqual(after.npc,before.npc);assert.equal(after.production.cash,before.production.cash);assert.deepEqual(after.actors.map(a=>a.position),before.actors.map(a=>a.position));assert.equal(after.actors.find(a=>a.id===custom.id).appearance.hairStyle,'spiky');assert.notEqual(after.portraits[custom.id],before.portraits[custom.id]);record('in-world edit updates model and portrait without resetting NPCs or cash');
 await page.screenshot({path:'qa/avatar-browser-final.png'});
 const samples=[];for(let i=0;i<30;i++){await av(`[data-person="${['lin','zhou','qiao',custom.id][i%4]}"]`).click();await page.waitForTimeout(35);if(i%5===4)samples.push((await diag()).preview.memory);}
 assert(samples.at(-1).geometries<samples[0].geometries+70,JSON.stringify(samples));record('30 preview replacements have bounded geometry counts');
 await close();await page.locator('[data-action="startRecording"]').click();await page.locator('[data-action="speed"][data-value="4"]').click();
 // Continuous recording advances periods; segmentReady is retained only for legacy saves.
 await page.waitForFunction(()=>{const s=window.__avatarDiagnostics().production;return s.segment>=1&&s.recordingElapsed>=s.segmentBaseDuration;},null,{timeout:60000});
 const recorded=(await diag()).production;assert.equal(recorded.phase,'recording');assert.equal(recorded.segmentReady,false);
 await page.locator('[data-action="finishRecording"]').click();await page.waitForFunction(()=>window.__avatarDiagnostics().production.phase==='editing');
 const footage=await page.evaluate(async()=>{const d=await new Promise((res,rej)=>{const r=indexedDB.open('ratings-tyrant-footage',1);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});const all=await new Promise((res,rej)=>{const r=d.transaction('stills').objectStore('stills').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});d.close();return {count:all.length,unique:new Set(all).size,valid:all.every(s=>s.startsWith('data:image/jpeg')&&s.length>2000)};});
 assert(footage.count>=3,JSON.stringify(footage));assert(footage.unique>=3);assert(footage.valid);record('actual recording captures multiple distinct WebGPU event stills');
 assert.deepEqual(errors,[]);const report={result:'PASS',browser:'Microsoft Edge headless, isolated profile',backend:'webgpu',checks,memorySamples:samples,footage,errors};writeFileSync('qa/avatar-browser-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){await page.screenshot({path:'qa/avatar-browser-failure.png'}).catch(()=>{});writeFileSync('qa/avatar-browser-results.json',JSON.stringify({result:'FAIL',checks,errors,error:error.stack},null,2));throw error;}finally{await browser.close();}

