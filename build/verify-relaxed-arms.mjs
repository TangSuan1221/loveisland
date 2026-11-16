import {build} from 'esbuild';
import {chromium} from 'playwright';
const contents=`
import {mountLiveIsland} from './src/artStudy/liveIsland.js';
import {createCharacters} from './src/characters.js'; import {Scene} from 'three';
import {performTrack} from './src/action-playback.js';
const ids=['lin','zhou','qiao','lu'];
const cast=createCharacters(new Scene());cast.configureCast(ids.map(id=>({id})));const actors=cast.actors;
let walking=false;
cast.setSimulation({getActor(id){return {activity:'idle',gesture:walking?'walk':'idle',moving:walking,x:(ids.indexOf(id)-1.5)*1.65,z:0,facing:walking?1.4:0}}});
cast.update(0,1/30);
const state={cast:ids,selectedMap:'island',phase:'build',facilities:[],speed:1};
mountLiveIsland(document.querySelector('main'),{getState:()=>state,getActorState:()=>null,getVisualActors:()=>actors,dispatch:()=>{}});
for(let i=0;i<7;i++)document.querySelector('[data-live-tool="zoom-in"]').click();
window.pose=()=>{walking=true;for(let i=0;i<60;i++)cast.update(i/30,1/30);};
`;
const bundle=await build({stdin:{contents,resolveDir:process.cwd()},bundle:true,write:false,outdir:'build',format:'iife',loader:{'.css':'empty','.csv':'text'}});
const browser=await chromium.launch({channel:'chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:960,height:620}});page.on('pageerror',e=>console.error(e));
 await page.setContent('<style>*{margin:0}main,section,canvas{width:100vw;height:100vh}section>div{display:none}</style><main></main>');
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.screenshot({path:'docs/assets/turntable/camp52-relaxed-idle.png'});
 await page.evaluate(()=>window.pose());
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.screenshot({path:'docs/assets/turntable/camp52-relaxed-walk.png'});
}finally{await browser.close();}
