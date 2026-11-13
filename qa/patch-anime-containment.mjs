import{readFileSync,writeFileSync}from'node:fs';
const p='qa/avatar-paint-containment.test.mjs';let s=readFileSync(p,'utf8');s=s.replace('const scales={oval:',"const scales={anime_pentagon:[1,1],oval:");s=s.replace(" if(shape==='heart'", " if(shape==='anime_pentagon'&&y<0){const v=Math.min(1,-y),edge=v<.68?1-.30*v/.68:.70*(1-v)/.32; if(edge>1e-8)x*=Math.sqrt(Math.max(0,1-v*v))/edge;}\n if(shape==='heart'");writeFileSync(p,s);
const b='qa/avatar-anime-benchmarks.js';s=readFileSync(b,'utf8').replace('肩前长辫与平静眼线','拱形眼线与贴脸长鬓发');writeFileSync(b,s);
