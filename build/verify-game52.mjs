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
  await beginSeason();
  await page.evaluate(()=>{
    for(let i=0;i<6;i++)document.querySelector('[data-live-tool=zoom-in]').click();
  });
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:'docs/assets/turntable/game52-start.png'});
  assert.deepEqual(errors,[]);
  console.log('Production selection and entry verified', (await production()).cast);
}finally{await b.close();}