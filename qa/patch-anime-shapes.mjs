import fs from 'node:fs';
const root='src/';
let p=root+'avatar-schema.js',s=fs.readFileSync(p,'utf8');
const marker='out.faceArt=normalizeFaceArt(input.faceArt);';
if(!s.includes(marker))throw Error('normalization anchor missing');
s=s.replace(marker,`// Ordered handles keep edited eyelids monotonic, including imported files.
 for(const [inner,outer]of [['eyeUpperInnerX','eyeUpperOuterX'],['eyeLowerInnerX','eyeLowerOuterX']])if(out[inner]>out[outer])[out[inner],out[outer]]=[out[outer],out[inner]];
 ${marker}`);
fs.writeFileSync(p,s);
p=root+'avatar-model.js';s=fs.readFileSync(p,'utf8');
s=s.replace('oval:[1,1,1],','oval:[1,1,1],anime_pentagon:[1,1,1],');
s=s.replace("if(shape==='square')",`// A continuous 3D perimeter with straight cheeks and an explicit jaw corner.
 // Radial X remapping preserves the shared skin/paint/feature projection.
 if(shape==='anime_pentagon'&&y<0){const v=Math.min(1,-y),radius=Math.sqrt(Math.max(0,1-v*v));const edge=v<.68?1-.12*v/.68:.88*(1-v)/.32;if(radius>.00001)x*=edge/radius;}
 if(shape==='square')`);
fs.writeFileSync(p,s);
const baseline=JSON.parse(fs.readFileSync('qa/anime-revision-appearances.json','utf8')).outputs.find(x=>x.id==='makima');
if(!fs.existsSync('qa/anime-reference-baseline.json'))fs.writeFileSync('qa/anime-reference-baseline.json',JSON.stringify(baseline.appearance,null,2));
