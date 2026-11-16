import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',args:['--disable-crash-reporter','--disable-breakpad','--disable-crashpad-for-testing','--enable-unsafe-webgpu','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
try{
  const page=await browser.newPage({viewport:{width:1350,height:900}});
  page.setDefaultTimeout(60000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.voiceBuffers=[];
    const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){
      if(this.buffer?.sampleRate===16000)window.voiceBuffers.push({samples:this.buffer.length,
        peak:this.buffer.getChannelData(0).reduce((p,v)=>Math.max(p,Math.abs(v)),0)});
      return start.apply(this,args);
    };
  });
  const root=path.resolve(process.argv[2]??'dist');
  await page.route('http://localhost/**',async route=>{
    const url=new URL(route.request().url());
    const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
    if(!file.startsWith(root+path.sep))return route.abort();
    const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.json':'application/json','.wasm':'application/wasm'};
    try{await route.fulfill({body:await fs.readFile(file),contentType:types[path.extname(file)]??'application/octet-stream'});}
    catch{await route.fulfill({status:404,body:''});}
  });
  await page.goto('http://localhost/?qa',{waitUntil:'domcontentloaded'});
  await page.locator('[data-action=start]').first().click();
  for(let i=0;i<4;i++)await page.locator('[data-action=toggleCast]').nth(i).click();
  await page.locator('[data-action=confirmCast]').click();
  await page.locator('[data-action=autoBuild]').click();
  await page.locator('[data-action=startRecording]').click();
  await page.locator('#game-voice').click();
  await page.waitForFunction(()=>window.voiceBuffers.some(b=>b.peak>0)&&document.querySelector('.game-captions:not([hidden]) div')?.textContent);
  console.log('recording caption:',await page.locator('.game-captions').textContent(),await page.evaluate(()=>window.voiceBuffers.at(-1)));
  await page.locator('#game-voice').click();
  assert.equal(await page.locator('#game-voice').getAttribute('aria-pressed'),'false');
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
