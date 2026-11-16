import {catalogScenes} from '../src/performance/catalog-scenes.js';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {extraTitles} from '../src/performance/cases/social-extra.js';
import first from '../src/performance/emotion-s-first.js';
import later from '../src/performance/emotion-s-later.js';
import stories from '../src/performance/emotion-stories.js';
const emotionCues={...first,...later,...stories};

const build = path.resolve(process.env.CINEMA_BUILD || 'dist');
const output = path.resolve(process.env.CINEMA_FRAMES || path.join(os.tmpdir(),'island-cinema-frames'));
await fs.mkdir(output, {recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.wasm':'application/wasm','.webp':'image/webp','.svg':'image/svg+xml'};
const browser=await chromium.launch({channel:'chrome',headless:true,args:[
  '--disable-crash-reporter','--disable-breakpad','--disable-crashpad-for-testing',
  '--enable-unsafe-webgpu','--enable-unsafe-swiftshader',
]});
try {
  const width=Number(process.env.CINEMA_WIDTH||1024);
  const height=Number(process.env.CINEMA_HEIGHT||576);
  const page=await browser.newPage({viewport:{width,height}, deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror', e=>{errors.push(e.message); console.error(e.message);});
  page.on('console',msg=>{
    if(/GPUValidationError|device lost|shader compilation failed/i.test(msg.text()))errors.push(msg.text());
  });
  page.setDefaultTimeout(90000);
  await page.route('http://localhost/**', async route=>{
    const url=new URL(route.request().url());
    const file=path.resolve(build,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
    if(!file.startsWith(build+path.sep))return route.abort();
    try {
      await route.fulfill({body:await fs.readFile(file),contentType:types[path.extname(file)]||'application/octet-stream'});
    } catch {await route.fulfill({status:404,body:''});}
  });
  const frames=process.argv.slice(2);
  if(!frames.length)frames.push('mutual-feeling:400','mutual-feeling:2500','feelings-declined:2600','water-shared:1200','queue-argue:1800');
  const stills=[];
  for(const frame of frames){
    const [event,at]=frame.split(':');
    const address='http://localhost/?cinema-review='+encodeURIComponent(event)+'&at='+Number(at);
    if(page.url()==='about:blank'){
      await page.goto(address,{waitUntil:'domcontentloaded'});
    }else{
      await page.evaluate(url=>{
        history.replaceState(null,'',url);
        dispatchEvent(new PopStateEvent('popstate'));
      },address);
    }
    await page.locator('main.cinema-review[data-playback=paused][data-shot]').waitFor();
    await page.locator('canvas[data-backend=webgpu]').first().waitFor({state:'visible'});
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const image=await page.screenshot({style:process.env.CINEMA_MONTAGE ? ".cinema-review-tools,.island-performance{visibility:hidden!important}" : "",path:path.join(output,event+'-'+at+'.png')});
    stills.push({image:image.toString('base64'),title:await page.locator('[data-cinema-event] option:checked').textContent(),at});
    console.log(JSON.stringify({frame,shot:await page.locator('main.cinema-review').getAttribute('data-shot'),fx:await page.locator('main.cinema-review').getAttribute('data-effect'),file:path.join(output,event+'-'+at+'.png')}));
  }
  if(process.env.CINEMA_MONTAGE){
    const board=await browser.newPage({viewport:{width:1440,height:720},deviceScaleFactor:1});
    await board.setContent('<style>*{box-sizing:border-box}body{margin:0;background:#192422;color:#eee;font:17px system-ui,sans-serif}main{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px}figure{margin:0}img{width:100%;display:block}figcaption{padding:6px 4px 9px}</style><main></main>');
    await board.evaluate(items=>{
      for(const item of items){
        const f=document.createElement('figure'),img=new Image(),cap=document.createElement('figcaption');
        img.src='data:image/png;base64,'+item.image;cap.textContent=item.title+' · '+(Number(item.at)/1000).toFixed(2)+' s';
        f.append(img,cap);document.querySelector('main').append(f);
      }
    },stills);
    await board.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
    await board.locator('main').screenshot({path:process.env.CINEMA_MONTAGE,quality:90});
    await board.close();
  }
  if(process.env.CINEMA_STILLS_ONLY){
    assert.deepEqual(errors,[]);
    console.log(stills.length+' rendered stills passed.');
  } else {
    const review=page.locator('main.cinema-review');
    await page.locator('[data-cinema-replay]').click();
    await page.waitForFunction(()=>Number(document.querySelector('.cinema-review')?.dataset.frameMs)>200);
    await page.locator('[data-cinema-pause]').click();
    const pausedAt=await review.getAttribute('data-frame-ms');
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    assert.equal(await review.getAttribute('data-frame-ms'),pausedAt);
    await page.locator('[data-cinema-pause]').click();
    await page.locator('.island-performance button').first().click();
    await page.locator('.cinema-review[data-playback=ended]').waitFor();
    assert.equal(await page.locator('.cinema-playing').count(),0);
    const select=page.locator('[data-cinema-event]');
    const choices=await select.locator('option').evaluateAll(options=>options.map(o=>o.value));
    const rows=(await fs.readFile(new URL('../src/performance/data/skit-def.csv',import.meta.url),'utf8')).split(/\r?\n/).filter(Boolean).slice(1);
    const authored=rows.map(line=>line.split(',')).filter(([id])=>id.startsWith('IS_')||id.startsWith('CAMP_'));
    const expected=authored.map(([id,scene])=>id.startsWith('CAMP_')?id:scene);
    expected.push(...Object.keys(extraTitles),...catalogScenes.keys());
    assert.equal(choices.length,expected.length);
    for(const key of expected)assert(choices.includes(key),'missing review option '+key);
    assert.equal(new Set(choices).size,choices.length,'review options must be distinct');
    // Seek to the settlement frame, resume its post-demo hold, and verify normal release.
    await page.evaluate(()=>{
      const url=new URL(location.href);
      url.searchParams.set('cinema-review','S32_food_hoarding');
      url.searchParams.set('at','6000');
      history.replaceState(null,'',url);
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.locator('.cinema-review[data-playback=paused].cinema-playing').waitFor();
    await page.locator('[data-cinema-pause]').click();
    await page.locator('.cinema-review[data-playback=ended]').waitFor();
    assert.equal(await page.locator('.cinema-playing').count(),0);
    const contactSheet=process.env.CINEMA_CONTACT_DIR;
    let sheet, tiles=[];
    if(contactSheet){
      await fs.mkdir(contactSheet,{recursive:true});
      await page.addStyleTag({content:'.cinema-review-tools,.island-performance{opacity:0!important}'});
      sheet=await browser.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:1});
      await page.bringToFront();
    }
    for(const event of choices){
      await select.selectOption(event);
      await page.locator('.cinema-review[data-playback=playing][data-shot]').waitFor();
      assert.ok(await review.getAttribute('data-shot'),event);
      const duration=Number(await review.getAttribute('data-cinema-duration-ms'));
      assert.ok(duration>0,event+' has no running timeline');
      const [theme,start,end]=emotionCues[event];
      const at=Math.round((start+end)*.5*duration);
      await page.evaluate(({event,at})=>{
        const url=new URL(location.href);
        url.searchParams.set('cinema-review',event);
        url.searchParams.set('at',at);
        history.replaceState(null,'',url);
        dispatchEvent(new PopStateEvent('popstate'));
        return new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
      },{event,at});
      assert.equal(await review.getAttribute('data-emotion-theme'),theme,event+' reaction frame at '+at);
      assert.equal(await review.getAttribute('data-playback'),'paused',event);
      if(sheet){
        tiles.push({event,at,image:(await page.screenshot({type:'jpeg',quality:75})).toString('base64')});
        if(tiles.length===20 || event===choices.at(-1)){
          await sheet.setContent('<style>*{box-sizing:border-box}body{margin:0;background:#202c29;color:#fff;font:14px system-ui}main{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:4px}img{display:block;width:100%}</style><main></main>');
          await sheet.evaluate(async tiles=>{
            for(const tile of tiles){
              const div=document.createElement('div'), img=new Image();
              img.src='data:image/jpeg;base64,'+tile.image;
              div.append(img,tile.event+' · '+tile.at+' ms');
              document.querySelector('main').append(div);
            }
            await Promise.all([...document.images].map(i=>i.decode()));
          },tiles);
          const batch=Math.ceil((choices.indexOf(event)+1)/20);
          await sheet.locator('main').screenshot({path:path.join(contactSheet,'review-'+batch+'.jpg'),quality:85});
          console.log('Captured reaction sheet '+batch+' through '+event);tiles=[];
        }
      }
    }
    console.log(choices.length+' live event starts and rendered reaction frames, replay, pause, resume, skip and cleanup passed.');
    await page.goto('http://localhost/',{waitUntil:'domcontentloaded'});
    await page.getByRole('link',{name:'演出放映室'}).click();
    await page.locator('.cinema-review[data-playback=playing]').waitFor();
    await page.waitForFunction(()=>Boolean(document.querySelector('.cinema-review')?.dataset.shot));
    console.log('Main game title to review room playback passed.');
    assert.deepEqual(errors,[]);
  }
} finally {await browser.close();}
