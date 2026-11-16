import assert from 'node:assert/strict';
import {build} from 'vite';
import {chromium} from 'playwright';

// Use the actual Vite CSV imports and runtime bridge, without a GPU or a test-only simulation.
const entry = 'virtual:cinema-production-check';
const fixture = `
import {createSimulation} from '/src/npc-simulation.js';
import {createPerformance} from '/src/performance/director.js';
import {createCinemaStage} from '/src/performance/cinema-stage.js';
import {portraitActor} from '/src/characters.js';
import {Scene,PerspectiveCamera,Vector3} from 'three';
const people=['lin','zhou','qiao','lu'].map((id,i)=>({id,name:id,anchor:[i,1]}));
const sim=createSimulation({actors:people,seed:7});
let event;
for(let i=0;i<4000&&!event;i++){
  sim.update(.1);
  if(i%8===0)event=sim.getEvents().find(e=>e.type==='connected');
}
if(!event)throw Error('Simulation did not emit the expected social result');
const snapshot=JSON.stringify(sim.serialize());
const root=document.querySelector('main'),scene=new Scene(),camera=new PerspectiveCamera(38,16/9,.1,220);
camera.position.set(2,2,7);
const actors=event.participants.map(id=>{
  const a=portraitActor(id,{groundY:.48}), live=sim.getActor(id);
  a.mesh.position.set(live.x,.48,live.z);a.mesh.rotation.y=live.facing;scene.add(a.mesh);return a;
});
scene.updateMatrixWorld(true);
const controls={enabled:true,target:new Vector3(0,1,0)};
const stage=createCinemaStage({camera,controls,actors,root,scene});
const director=createPerformance(root,stage);
const state={phase:'recording',season:1,day:1,candidates:people};
const transform=()=>JSON.stringify(actors.map(a=>[a.mesh.position.toArray(),a.mesh.quaternion.toArray(),a._head.rotation.toArray()]));
const roots=()=>JSON.stringify(actors.map(a=>a.mesh.position.toArray()));
const before=transform(),beforeRoots=roots();
const check=(ok,what)=>{if(!ok)throw Error(what)};
const unchanged=()=>{check(transform()===before,'actor pose leaked');check(JSON.stringify(sim.serialize())===snapshot,'simulation changed');};
const select=root.querySelector('select');
select.value='off';select.dispatchEvent(new Event('change'));director.observe(event,state);director.update(250,state);
check(!director.holding,'off mode still holds');unchanged();
select.value='all';select.dispatchEvent(new Event('change'));
director.observe(event,state);director.update(600,state);
check(director.holding&&director.shot?.composition,'missing authored setup');
root.querySelector('.island-performance>button').click();check(!director.holding,'skip failed');unchanged();
director.observe(event,state);
const shots=new Set();let moved=false;
for(let t=0;t<9000;t+=100){
 director.update(100,state);
 if(director.shot)shots.add(director.shot);
 moved ||= roots()!==beforeRoots;
}
check(moved,'blocking did not move either performer');check(shots.size>=2,'sequence did not cut');
check(!director.holding,'natural end failed');unchanged();
const camp={...event,id:'camp:1:12:key',type:'camp-story',sceneId:'S_new_home',result:'B1',x:0,z:2,text:'营地新家'};
director.observe(camp,state);director.update(120,state);
check(director.holding && director.shot,'camp string id failed');director.stop();unchanged();
window.checkResult={event:event.type,cuts:shots.size,moved,campId:camp.id};
`;
const {output}=await build({logLevel:'error',plugins:[{name:'cinema-integration',
 resolveId(id){if(id===entry)return '\0'+entry;},load(id){if(id==='\0'+entry)return fixture;}}],
 build:{write:false,cssCodeSplit:false,rollupOptions:{input:entry,output:{inlineDynamicImports:true}}}});
const script=output.find(f=>f.type==='chunk').code;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-crash-reporter','--disable-breakpad','--disable-crashpad-for-testing']});
try{
 const page=await browser.newPage();
 await page.setContent('<main><div class="game-scene-tools"></div></main>');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addScriptTag({type:'module',content:script});
 for(let i=0;i<100 && !errors.length&&!await page.evaluate(()=>!!window.checkResult);i++)await page.waitForTimeout(100);
 assert.deepEqual(errors,[]);const result=await page.evaluate(()=>window.checkResult);assert.ok(result);
 console.log(result);
}finally{await browser.close();}
