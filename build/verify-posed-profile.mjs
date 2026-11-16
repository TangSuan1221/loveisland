import {build} from 'esbuild';
import {chromium} from 'playwright';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();
 const renderSheet=async()=>{
 const T=await import('three');
 const {portraitActor}=await import('./src/characters.js');
 const {performTrack}=await import('./src/action-playback.js'); const actor=portraitActor('lin'), partner=portraitActor('zhou'),scene=new T.Scene();scene.background=new T.Color('#e7dfcf');scene.add(actor.mesh,new T.HemisphereLight(0xfff3dc,0xe0d6c8,2));const key=new T.DirectionalLight(0xfff0dd,2);key.position.set(-3,5,4);scene.add(key);
 const render=(await (await import('./src/gpu-renderer.js')).createGPURenderer({forceWebGL:true}));render.setSize(260,300);
 const sheet=document.createElement('canvas');sheet.width=1040;sheet.height=900;const ctx=sheet.getContext('2d');
 const rows=[['sit'],['shy'],['sit']];
 for(let row=0;row<3;row++){
   const pair=row===2;
   if(pair){scene.add(partner.mesh); actor.mesh.position.x=-.53; partner.mesh.position.x=.53; actor.mesh.rotation.y=.58; partner.mesh.rotation.y=-.58;}
   performTrack(actor,rows[row],1,1,partner);
   if(pair)performTrack(partner,['sit'],1,1,actor);
   for(let col=0;col<4;col++){
     const angle=[0,45,90,135][col]*Math.PI/180, size=pair?1.30:1.15;
     const target=new T.Vector3(0,pair?.85:.95,0);
     const cam=new T.OrthographicCamera(-size*260/300,size*260/300,size,-size,.01,20);
     cam.position.copy(target).add(new T.Vector3(4*Math.sin(angle),.15,4*Math.cos(angle)));
     cam.lookAt(target); await new Promise(requestAnimationFrame); render.render(scene,cam); ctx.drawImage(render.domElement,col*260,row*300);
   }
 } return sheet.toDataURL().split(',')[1]};
 const bundle=await build({stdin:{contents:'window.capture='+renderSheet.toString(),resolveDir:process.cwd()},bundle:true,format:'iife',write:false});
 await page.addScriptTag({content:bundle.outputFiles[0].text}); const png=await page.evaluate(()=>window.capture());
 fs.writeFileSync(process.argv[2],Buffer.from(png,'base64'));
} finally {await browser.close();}


