import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('dist');
const b=await chromium.launch({channel:'chrome',headless:true,args:['--disable-crash-reporter','--disable-breakpad','--disable-crashpad-for-testing','--enable-unsafe-webgpu','--enable-unsafe-swiftshader']});
try{
  const page=await b.newPage({viewport:{width:1350,height:900}});page.setDefaultTimeout(60000);
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  await page.route('**/*',async r=>{
    const pathname=decodeURIComponent(new URL(r.request().url()).pathname);
    const f=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!f.startsWith(root+path.sep))return r.abort();
    try{const body=await fs.readFile(f);await r.fulfill({body,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.wasm':'application/wasm'})[path.extname(f)]||'application/octet-stream'});}catch{await r.fulfill({status:404,body:''});}
  });
  const archiveKey='island-camp-save-v3';
  const world=page.locator('.game-island-world');
  const editor=page.locator('dialog.camp-editor');
  const production=()=>page.evaluate(()=>window.__avatarDiagnostics().production);
  const archive=()=>page.evaluate(key=>localStorage.getItem(key),archiveKey);
  async function beginSeason(){
    await page.locator('[data-action=start]').first().click();
    const cast=page.locator('[data-action=toggleCast]');
    for(let i=0;i<4;i++)await cast.nth(i).click();
    await page.locator('[data-action=confirmCast]').click();
    await world.locator('canvas[data-live-island-canvas]').waitFor();
    assert.equal(await world.getAttribute('data-view'),'embedded');
  }

  await page.goto('http://localhost/?qa',{waitUntil:'domcontentloaded'});
  await page.locator('[data-action=viewIsland]').click();
  await world.locator('[data-live-tool=close]').click();
  await world.waitFor({state:'hidden'});
  await beginSeason();
  const initial=(await production()).camp;
  assert.equal(initial.placed.length,5);
  assert.deepEqual(new Set(initial.placed.map(b=>b.kind)),new Set(['clinic','shop','farm','fire_pit','pier']));
  assert.ok(['webgpu','webgl2'].includes(await page.evaluate(()=>window.__avatarDiagnostics().backend)));

  await page.locator('#game-overview').click();
  await world.locator('[data-live-tool=build]').click();
  await world.locator('[data-live-tool=advanced]').click();
  await editor.locator('[data-kind]').selectOption('fire_pit');
  await editor.locator('[data-buy]').click();
  const canvas=editor.locator('canvas'),box=await canvas.boundingBox();
  await canvas.click({position:{x:box.width*31.5/64,y:box.height*31.5/64}});
  await editor.locator('output').filter({hasText:'火塘已落成。'}).waitFor();
  await editor.locator('[data-close]').click();
  await world.locator('[data-live-tool=close]').click();
  assert.equal(await world.getAttribute('data-view'),'embedded');
  const edited=(await production()).camp;
  const added=edited.placed.find(b=>!initial.placed.some(old=>old.id===b.id));
  assert.equal(edited.placed.length,initial.placed.length+1);
  assert.equal(added?.kind,'fire_pit');
  assert.deepEqual([added.x,added.y],[31,31]);
  assert.equal(edited.wood,initial.wood-4);
  const saved=await archive();
  assert.ok(saved?.startsWith('CI-BP2.'));

  await page.reload({waitUntil:'domcontentloaded'});
  await beginSeason();
  assert.equal((await production()).camp.placed.length,initial.placed.length);
  assert.equal(await archive(),saved,'fresh season must preserve the previous camp archive');
  await page.locator('[data-action=campOpen]').click();
  await editor.locator('summary').filter({hasText:'营地蓝图'}).click();
  await editor.locator('[data-last]').click();
  await page.waitForFunction(id=>window.__avatarDiagnostics().production.camp.placed.some(b=>b.id===id&&b.x===31&&b.y===31),added.id);
  await editor.locator('[data-close]').click();
  await page.locator('[data-action=autoBuild]').click();
  await page.locator('[data-action=startRecording]').click();
  await page.waitForFunction(()=>window.__avatarDiagnostics().production.phase==='recording');
  assert.ok(await page.evaluate(id=>window.__avatarDiagnostics().npc.facilities.some(f=>f.facilityId==='camp-'+id),added.id));
  await page.keyboard.press('b');
  await editor.waitFor();
  assert.deepEqual(errors,[]);
  console.log('Production island overview, starter camp, construction, archive restore and recording passed');
}finally{await b.close();}
