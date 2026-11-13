import {chromium} from 'playwright';
import {writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const runLabel=process.argv[2]||'';if(runLabel&&!/^[a-z0-9-]+$/.test(runLabel))throw new Error('invalid evidence label');
const suffix=runLabel?'-'+runLabel:'';
if(runLabel)for(const path of ['qa/avatar-eye-extremes'+suffix+'.png','qa/avatar-eye-extremes-results'+suffix+'.json'])assert.ok(!existsSync(path),'choose a new immutable evidence label');
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1100,height:930}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5188/qa/avatar-reference-review.html');
 await page.waitForFunction(()=>window.done,{},{timeout:120000});
 const result=await page.evaluate(async()=>{
  const transformed=await(await fetch('/src/characters.js')).text();
  const dependency=transformed.match(/import \* as THREE from ["']([^"']+)["']/)?.[1];
  if(!dependency)throw new Error('Cannot resolve production Three module');
  const THREE=await import(dependency);
  const {createGPURenderer}=await import('/src/gpu-renderer.js');
  const {portraitActor,disposeActor}=await import('/src/characters.js');
  const {normalizeAppearance}=await import('/src/avatar-schema.js');
  const {ANIME_PRESETS}=await import('/src/avatar-anime.js');
  const base=ANIME_PRESETS.find(p=>p.name==='金环赤发').values;
  const A={eyeLid:1,eyeInnerY:.4,eyeOuterY:.4,eyeUpperInnerX:-.95,eyeUpperOuterX:-.95,eyeUpperInnerY:.2,eyeUpperOuterY:.2,eyeLowerInnerX:.95,eyeLowerOuterX:.95,eyeLowerInnerY:-.05,eyeLowerOuterY:-.05};
  const B={...A,eyeInnerY:-.3,eyeOuterY:-.3,eyeUpperInnerX:.95,eyeUpperOuterX:.95,eyeLowerInnerX:-.95,eyeLowerOuterX:-.95};
  const mirror=a=>({...a,eyeInnerY:a.eyeOuterY,eyeOuterY:a.eyeInnerY,eyeUpperInnerX:-a.eyeUpperOuterX,eyeUpperOuterX:-a.eyeUpperInnerX,eyeLowerInnerX:-a.eyeLowerOuterX,eyeLowerOuterX:-a.eyeLowerInnerX});
  const samples=[A,B,mirror(A),mirror(B)],scene=new THREE.Scene();scene.background=new THREE.Color('#e7e2d7');
  const renderer=await createGPURenderer({alpha:false});renderer.setSize(520,430);renderer.outputColorSpace=THREE.SRGBColorSpace;
  document.body.innerHTML='<h1>极端自由眼形 · 原生渲染与资源检查（不是相似度验收）</h1><main id="extremes" style="display:grid;grid-template-columns:repeat(2,520px)"></main>';
  const records=[];let invalidNumbers=0;
  for(let i=0;i<16;i++){
   const appearance=normalizeAppearance({...base,...samples[i%4],irisSize:1.35,irisAspect:1.2,irisX:i%2?.012:-.012});
   const start=performance.now(),actor=portraitActor(`extreme-${i}`,{appearance});scene.add(actor.mesh);actor.mesh.updateMatrixWorld(true);
   actor.mesh.traverse(o=>{const v=o.geometry?.attributes?.position?.array;if(v)for(const n of v)if(!Number.isFinite(n))invalidNumbers++;});
   const center=actor._head.getWorldPosition(new THREE.Vector3());center.y-=.035;
   const camera=new THREE.PerspectiveCamera(30,520/430,.01,20);camera.position.copy(center).add(new THREE.Vector3(0,0,1.50));camera.lookAt(center);
   renderer.render(scene,camera);
   if(i<4){const c=document.createElement('canvas');c.width=520;c.height=430;c.getContext('2d').drawImage(renderer.domElement,0,0);document.querySelector('#extremes').append(c);}
   records.push({iteration:i,elapsedMs:performance.now()-start,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures});disposeActor(actor);
  }
  const backend=renderer.backend.constructor.name;renderer.dispose();return{backend,records,invalidNumbers};
 });
 assert.equal(result.backend,'WebGPUBackend');assert.equal(result.invalidNumbers,0);assert.deepEqual(errors,[]);
 const mem=result.records.slice(4);assert.ok(Math.max(...mem.map(r=>r.geometries))-Math.min(...mem.map(r=>r.geometries))<=2,'geometry cache plateaus after warmup');
 assert.ok(Math.max(...mem.map(r=>r.textures))-Math.min(...mem.map(r=>r.textures))<=1,'texture cache plateaus after warmup');
 await page.screenshot({path:'qa/avatar-eye-extremes'+suffix+'.png',fullPage:true});
 writeFileSync('qa/avatar-eye-extremes-results'+suffix+'.json',JSON.stringify({result:'PASS',runLabel,capturedAt:new Date().toISOString(),...result,errors},null,2));
 console.log('PASS: 16 real WebGPU renders, 4 extreme crossing shapes, finite geometry and bounded renderer resources. Timings are recorded, not a frame-rate claim.');
}finally{await browser.close();}

