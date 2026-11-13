import assert from 'node:assert/strict';
import {createFacePaintGeometry} from '../src/avatar-model.js';
import {normalizeAppearance,APPEARANCE_OPTIONS} from '../src/avatar-schema.js';
// Independent inverse of the documented skin silhouette. No production mapper
// is called: test actual interpolated triangles against the analytic boundary.
const scales={anime_pentagon:[1,1],oval:[1,1],round:[1.08,.92],square:[1.08,.95],heart:[1,.98],long:[.89,1.12],diamond:[.95,1.04]};
const variants={pear:['oval',1.02,1,-.14,.18],triangle:['heart',1.08,1.03,.03,-.17],rectangle:['square',.94,1.14,0,.06],trapezoid:['square',1.06,1,-.12,.22],oblong:['long',.9,1.08,0,-.06],cheekbone:['diamond',1.08,1.02,.04,-.03],softsquare:['square',1.04,1.02,.08,-.08],button:['round',1.06,.87,0,.05],tapered:['oval',.98,1.08,.10,-.24],broad:['oval',1.2,.95,.02,.15]};
function ellipseDistance(a,p){
 const v=variants[a.faceShape],shape=v?.[0]||a.faceShape,s=scales[shape];
 let x=p[0]/(.255*s[0]*(v?.[1]||1)),y=p[1]/(.282*s[1]*(v?.[2]||1));
 if(a.artStyle!=='satire'&&y<-.9)y=-.9+(y+.9)/.65;
 if(y<0)y/=a.chinLength*(a.artStyle==='anime'?.9:1);
 const lower=Math.max(0,-y);
 x/=a.artStyle==='anime'?1-.045*lower:a.artStyle==='drama'?1-.18*lower:a.artStyle==='organic'?1-.07*Math.abs(y)+.035*Math.sin(y*4):1+.08*lower;
 x/=1+(a.jawWidth-1)*Math.min(1,lower*2)*.65;
 if(shape==='anime_pentagon'&&y<0){const v=Math.min(1,-y),ramp=t=>t*t*(3-2*t),inset=.08*ramp(Math.min(1,v/.16))*(1-ramp(Math.min(1,Math.max(0,(v-.16)/.34)))),edge=(v<.68?1-.25*v/.68:.75*(1-v)/.32)-inset; if(edge>1e-8)x*=Math.sqrt(Math.max(0,1-v*v))/edge;}
 if(shape==='heart'&&y<0)x/=1+y*.33;
 if(shape==='diamond')x/=1-Math.abs(y)*.2;
 if(shape==='square')x=Math.sign(x)*Math.abs(x)**(1/(a.artStyle==='satire'?.73:.90));
 if(v)x/=1+v[3]*Math.max(0,y)+v[4]*Math.max(0,-y);
 return x*x+y*y;
}
function meshPoint(position,u,v){const gx=u*64,gy=v*64,col=Math.min(63,Math.floor(gx)),row=Math.min(63,Math.floor(gy)),tx=gx-col,ty=gy-row,a=row*65+col,b=a+65,c=b+1,d=a+1;const ids=tx+ty<=1?[a,b,d]:[b,c,d],weights=tx+ty<=1?[1-tx-ty,ty,tx]:[1-tx,tx+ty-1,1-ty];return [0,1,2].map(k=>ids.reduce((sum,id,j)=>sum+position.array[id*3+k]*weights[j],0));}
let samples=0,combos=0,max=0;
for(const {value:faceShape}of APPEARANCE_OPTIONS.faceShape)for(const artStyle of ['anime','drama','organic','satire'])for(const extreme of [false,true]){
 const input={faceShape,artStyle,...(extreme?{jawWidth:.72,chinLength:1.3}:{})},a=normalizeAppearance(input),g=createFacePaintGeometry(input),p=g.getAttribute('position');
 const full=createFacePaintGeometry(a);assert.deepEqual([...p.array],[...full.attributes.position.array]);full.dispose();assert([...p.array].every(Number.isFinite));
 for(let y=0;y<512;y+=extreme?4:1)for(let x=0;x<512;x+=extreme?4:1){
  if(Math.hypot(x+.5-256,y+.5-256)>251.5)continue;
  const point=meshPoint(p,(x+.5)/512,(y+.5)/512),r=ellipseDistance(a,point);assert.ok(r<=1,`${faceShape}/${artStyle} at ${x},${y}: outside skin (${r})`);max=Math.max(max,r);samples++;
 }
 assert(ellipseDistance(a,meshPoint(p,.84,.84))<1);g.dispose();combos++;
}
console.log(`PASS paint containment: ${samples} raster samples, ${combos} configurations, max radius² ${max.toFixed(6)}; partial/full normalization match.`);
