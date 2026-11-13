import fs from 'node:fs';
let p='src/avatar-anime.js',s=fs.readFileSync(p,'utf8');
s=s.replace("faceShape:[['anime_pentagon'","browStyle:[['anime_arc','动漫 · 平滑弧眉']],\n faceShape:[['anime_pentagon'");
s=s.replace("if(!angular)patch([[w*.62", "if(!angular&&!designed)patch([[w*.62");
s=s.replace("export function drawAnimeNose",`export function drawAnimeBrow({a,b,side,facialPatch}){
 if(a.browStyle!=='anime_arc')return false;
 const edge=Array.from({length:33},(_,i)=>{const t=i/32;return[-.045+.09*t,.006*4*t*(1-t)+.001*t];});
 const pts=[...edge,...edge.slice().reverse().map(([x,y])=>[x,y+.0038*(.7+.3*Math.cos(x/.045*Math.PI/2))])].map(([x,y])=>[side*x,y]);
 facialPatch(b,pts,a.browColor,[0,0],.005);return true;
}
export function drawAnimeNose`);
s=s.replace("browStyle:'brow_arch_fine',browSize:1.05,browWidth:1.08,browHeight:1.05,browY:.001,browSpacing:.019", "browStyle:'anime_arc',browSize:1.10,browWidth:1.1,browHeight:1,browY:-.008,browSpacing:.024");
s=s.replace('eyeSpacing:.019,eyeY:-.019','eyeSpacing:.025,eyeY:-.019');
s=s.replace("noseY:-.032","noseY:-.044").replace("mouthSize:1.24,mouthWidth:1.15","mouthSize:1.5,mouthWidth:1.5");fs.writeFileSync(p,s);
p='src/avatar-model.js';s=fs.readFileSync(p,'utf8');s=s.replace('drawAnimeEye,drawAnimeNose','drawAnimeEye,drawAnimeBrow,drawAnimeNose').replace('if(!drawCatalogBrow({a,b,side,facialPatch,facialLine,ovalPoints}))','if(!drawAnimeBrow({a,b,side,facialPatch})&&!drawCatalogBrow({a,b,side,facialPatch,facialLine,ovalPoints}))');fs.writeFileSync(p,s);
