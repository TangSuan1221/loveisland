import {createServer} from 'vite';
import {chromium} from 'playwright';
import fs from 'node:fs';
const server=await createServer({plugins:[{name:'baseline',enforce:'pre',load(id){if(process.argv[3]==='before' && id.endsWith('/src/avatar-model.js'))return fs.readFileSync('build/avatar-model-before-profile.js','utf8')}}],server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();await page.goto(server.resolvedUrls.local[0]+'qa/portrait-preview.html');
 const png=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js');
 const {portraitActor}=await import('/src/characters.js');
 const actor=portraitActor('lin'),scene=new T.Scene();scene.background=new T.Color('#e7dfcf');scene.add(actor.mesh,new T.HemisphereLight(0xfff3dc,0xe0d6c8,2));const key=new T.DirectionalLight(0xfff0dd,2);key.position.set(-3,5,4);scene.add(key);
 const render=(await (await import('/src/gpu-renderer.js')).createGPURenderer({forceWebGL:true}));render.setSize(260,300);
 const sheet=document.createElement('canvas');sheet.width=1040;sheet.height=900;const ctx=sheet.getContext('2d');
 for(let i=0;i<12;i++){const angle=(i%8)*Math.PI/4;const size=i<8?.39:1.15;const target=new T.Vector3();actor._head.getWorldPosition(target);if(i>=8)target.y=.95;
 const cam=new T.OrthographicCamera(-size*260/300,size*260/300,size,-size,.01,20);cam.position.copy(target).add(new T.Vector3(4*Math.sin(angle),0,4*Math.cos(angle)));cam.lookAt(target);render.render(scene,cam);ctx.drawImage(render.domElement,(i%4)*260,Math.floor(i/4)*300);}
 return sheet.toDataURL().split(',')[1]});
 fs.writeFileSync(process.argv[2],Buffer.from(png,'base64'));
} finally {await browser.close();await server.close();}


