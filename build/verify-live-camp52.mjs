import {build} from 'esbuild';
import {chromium} from 'playwright';
const contents=`
import {mountLiveIsland} from './src/artStudy/liveIsland.js';
import {portraitActor} from './src/characters.js';
import {performTrack} from './src/action-playback.js';
const ids=['lin','zhou','qiao','lu'];
const actors=ids.map((id,i)=>{const a=portraitActor(id,{groundY:.48});a.mesh.position.set((i-1.5)*1.65,.48,0);return a;});
const state={cast:ids,selectedMap:'island',phase:'build',facilities:[],speed:1};
mountLiveIsland(document.querySelector('main'),{getState:()=>state,getActorState:()=>null,getVisualActors:()=>actors,dispatch:()=>{}});
for(let i=0;i<7;i++)document.querySelector('[data-live-tool="zoom-in"]').click();
window.pose=()=>actors.forEach((a,i)=>performTrack(a,[['sit','wave','shy','idle'][i]],1,1));
`;
const bundle=await build({stdin:{contents,resolveDir:process.cwd()},bundle:true,write:false,outdir:'build',format:'iife',loader:{'.css':'empty','.csv':'text'}});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:960,height:620}});page.on('pageerror',e=>console.error(e));
 await page.setContent('<style>*{margin:0}main,section,canvas{width:100vw;height:100vh}section>div{display:none}</style><main></main>');
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.screenshot({path:'docs/assets/turntable/camp52-entry.png'});
 await page.evaluate(()=>window.pose());
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.screenshot({path:'docs/assets/turntable/camp52-motion.png'});
}finally{await browser.close();}
