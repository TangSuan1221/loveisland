import fs from 'node:fs/promises';
import path from 'node:path';
import { randomInt, createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { measureFrame } from './stage-frame-metrics.mjs';

const output = path.resolve(process.env.STAGE_REVIEW_DIR || 'qa/stage-review');
const reference = path.resolve(process.env.STAGE_REFERENCE || '../荒岛恋爱游戏参考/演出背景/evidence');
const base = process.env.STAGE_BASE_URL || 'http://127.0.0.1:5188/';
const stages = ['hanami', 'cabin', 'orb'];
const boardOnly = process.argv.includes('--boards-only');
const previousRound=process.env.STAGE_COMPARE_WITH;
const namedCapture=process.env.STAGE_CAPTURE_ROUND;
if(previousRound && !boardOnly)throw new Error('Version comparisons use existing captures; pass --boards-only.');
const selected = process.env.STAGE_NAMES?.split(',') || stages;
const digest = buffer => createHash('sha256').update(buffer).digest('hex');
const salt = process.env.STAGE_ROUND || Date.now().toString(36);
await fs.mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:process.env.STAGE_BROWSER || 'chrome', headless:true,
  args:['--disable-crashpad-for-testing','--disable-breakpad','--enable-unsafe-swiftshader','--enable-unsafe-webgpu']});
try {
  const comparison = await browser.newPage({viewport:{width:previousRound?2400:1600,height:490}});
  const evidence = {};
  const key = {};
  for(const name of selected){
    const stillFile = path.join(output, name+(namedCapture?'-'+namedCapture:'')+'.png');
    if(!boardOnly){
      const shot = await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
      if(process.env.STAGE_BUILD_DIR){
        const build=path.resolve(process.env.STAGE_BUILD_DIR);
        const media={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.wasm':'application/wasm'};
        await shot.route(new URL(base).origin+'/**',async route=>{
          const requestPath=decodeURIComponent(new URL(route.request().url()).pathname);
          const file=path.resolve(build,'.'+(requestPath==='/'?'/index.html':requestPath));
          if(!file.startsWith(build+path.sep))return route.abort();
          try{await route.fulfill({body:await fs.readFile(file),contentType:media[path.extname(file)]||'application/octet-stream'});}
          catch(error){if(error.code!=='ENOENT')throw error;await route.fulfill({status:404,body:''});}
        });
      }
      shot.setDefaultTimeout(90000);
      const errors = [];
      shot.on('pageerror', error=>errors.push(error.message));
      shot.on('console', msg=>{if(/THREE.WebGLProgram: Shader Error|GPUValidationError/i.test(msg.text())) errors.push(msg.text());});
      const url = new URL(base);
      if(process.env.STAGE_FRAMING)url.searchParams.set('framing',process.env.STAGE_FRAMING);
      Object.entries({perf:name,t:'2',still:'1',seed:'7'}).forEach(([k,v])=>url.searchParams.set(k,v));
      const capture = async ()=>{
        await shot.goto(url.toString(),{waitUntil:'domcontentloaded'});
        await shot.locator('canvas[data-stage-ready="true"]').waitFor({state:'visible'});
        return shot.screenshot({animations:'disabled'});
      };
      const first = await capture();
      await fs.writeFile(stillFile, first);
      await fs.writeFile(path.join(output,name+'-'+salt+'.png'),first);
      const second = await capture();
      let noActors;
      let stats;
      let highlights,fxHighlights,foreground;
      if(await shot.evaluate(()=>typeof window.renderStageStill==='function')){
        stats=await shot.evaluate(async()=>await window.renderStageStill({}));
        async function pass(options){
          await shot.evaluate(async value=>await window.renderStageStill(value),options);
          await shot.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
          return (await shot.screenshot()).toString('base64');
        }
        noActors=await pass({showActors:false});
        if(process.env.STAGE_CHECK_HIGHLIGHTS){
          highlights=await pass({debugView:'highlights'});
          fxHighlights=await pass({debugView:'highlights',showActors:false,showLayers:false});
        }
        if(process.env.STAGE_CHECK_FOREGROUND)foreground=await pass({debugView:'foreground',showActors:false,showFx:false});
      }
      const metrics = await comparison.evaluate(measureFrame,{image:first.toString('base64'),noActors,highlights,fxHighlights,foreground,name,framing:url.searchParams.get('framing')});
      let timing;
      if(process.env.STAGE_PERF_SAMPLES && stats){
        timing = await shot.evaluate(async samples=>{
          const canvas=document.querySelector('canvas[data-stage-ready="true"]');
          const gl=canvas.getContext('webgl2');
          const ext=gl.getExtension('WEBGL_debug_renderer_info');
          const device=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
          const frameTimes=[],rafIntervals=[];
          let lastStamp;
          for(let i=0;i<samples+2;i++){
            const stamp=await new Promise(requestAnimationFrame);
            if(i>=2)rafIntervals.push(stamp-lastStamp);
            lastStamp=stamp;
            const start=performance.now();
            window.renderStageStill({time:2+i/30,adaptive:false});
            if(i>=2)frameTimes.push(performance.now()-start);
          }
          frameTimes.sort((a,b)=>a-b);
          const elapsed=rafIntervals.reduce((a,b)=>a+b,0);
          rafIntervals.sort((a,b)=>a-b);
          return {device,samples,meanFps:samples*1000/elapsed,
            medianRafMs:rafIntervals[Math.floor(samples*.5)],p95RafMs:rafIntervals[Math.floor(samples*.95)],
            medianSubmissionMs:frameTimes[Math.floor(samples*.5)]};
        },Math.max(1,Math.min(240,Number(process.env.STAGE_PERF_SAMPLES)||1)));
      }
      evidence[name]={url:url.toString(),sha256:digest(first),secondSha256:digest(second),deterministic:first.equals(second),errors,stats,metrics,timing};
      console.log(name,JSON.stringify(evidence[name]));
      await fs.writeFile(path.join(output,'metrics-'+salt+'.json'),JSON.stringify(evidence,null,2));
      await shot.close();
    }
    const original='S'+(stages.indexOf(name)+1)+'_'+name+'.png';
    const refs=[path.join(reference,'clean',original),path.join(reference,'src',original),path.join(reference,original),path.join(reference,name+'.png')];
    let refFile;
    for(const candidate of refs){
      try{await fs.access(candidate);refFile=candidate;break;}catch(error){if(error.code!=='ENOENT')throw error;}
    }
    if(!refFile)throw new Error('Missing reference image for '+name+' in '+reference);
    const candidateLeft = randomInt(2)===0;
    const opponent=previousRound?path.join(output,name+'-'+previousRound+'.png'):refFile;
    const files=candidateLeft?[stillFile,opponent]:[opponent,stillFile];
    if(previousRound)files.push(refFile);
    const images=await Promise.all(files.map(async file=>(await fs.readFile(file)).toString('base64')));
    const id = String(stages.indexOf(name)+1);
    key[id]={scene:name,candidate:candidateLeft?'A':'B',opponent:candidateLeft?'B':'A',opponentSource:previousRound||'original'};
    const labels=previousRound?['A','B','参考目标']:['A','B'];
    await comparison.setContent('<style>*{box-sizing:border-box}body{margin:0;display:flex;gap:8px;background:#202124;color:#eee;font:20px system-ui}figure{margin:0;flex:1;min-width:0}img{width:100%;height:448px;object-fit:contain;display:block}figcaption{text-align:center;padding:6px}</style>'+labels.map(label=>'<figure><img><figcaption>'+label+'</figcaption></figure>').join(''));
    await comparison.evaluate(async images=>{
      const imgs=[...document.images];
      imgs.forEach((img,i)=>{img.src='data:image/png;base64,'+images[i];});
      await Promise.all(imgs.map(img=>img.decode()));
    },images);
    await comparison.screenshot({path:path.join(output,'pair-'+salt+'-'+id+'.png')});
    if(previousRound && name==='cabin' && process.env.STAGE_HAND_DETAIL){
      // Both candidates use the same 16:9 camera. Crop identically from the full-size captures.
      await comparison.setViewportSize({width:1280,height:520});
      await comparison.setContent('<style>body{margin:0;background:#202124;display:flex;color:white;font:20px system-ui;text-align:center}figure{margin:0}canvas{display:block;width:640px;height:474px}figcaption{padding:8px}</style><figure><canvas></canvas><figcaption>A</figcaption></figure><figure><canvas></canvas><figcaption>B</figcaption></figure>');
      await comparison.evaluate(async images=>{
        await Promise.all([...document.querySelectorAll('canvas')].map(async(c,i)=>{
          const img=new Image();img.src='data:image/png;base64,'+images[i];await img.decode();
          c.width=640;c.height=474;
          c.getContext('2d').drawImage(img,Math.round(img.width*.22),Math.round(img.height*.56),Math.round(img.width*.17),Math.round(img.height*.224),0,0,640,474);
        }));
      },images);
      await comparison.screenshot({path:path.join(output,'detail-'+salt+'-'+id+'.png')});
      await comparison.setViewportSize({width:2400,height:490});
    }
  }
  await fs.writeFile(path.join(output,'key-'+salt+'.json'),JSON.stringify(key,null,2));
  console.log('Round',salt,'in',output);
} finally {await browser.close();}
