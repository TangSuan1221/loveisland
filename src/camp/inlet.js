import {W,H,idx} from './grid.js';

// The creek widens into a west-coast inlet. Near the spring it stays one tile wide
// so a three-tile bridge can touch both banks. The outlet has a deeper tidal pool.
const creek=[
  [27,13,.65],[25,15,.66],[23,17,.7],[21,19,.84],[20,21,.8],[20.2,23,.86],
  [21,25,.92],[21.2,26.2,.9],[20,27.8,1.05],[17.5,29.1,1.34],[15.2,29.4,1.42],
  [13.8,30.5,1.35],[13.1,32.5,1.65],[11,34.8,2.1],[8,36.2,2.5],[2,37.4,2.8]
];
const reservedWater=new Uint8Array(W*H);
function creekDistance(x,y){
  let min=Infinity;
  for(let i=1;i<creek.length;i++){
    const [x0,y0,r0]=creek[i-1],[x1,y1,r1]=creek[i],dx=x1-x0,dy=y1-y0;
    const t=Math.max(0,Math.min(1,((x-x0)*dx+(y-y0)*dy)/(dx*dx+dy*dy)));
    min=Math.min(min,Math.hypot(x-x0-t*dx,y-y0-t*dy)/(r0+(r1-r0)*t));
  }
  return min;
}
const stands=[[16,20,3.5,4.5],[12,43,3.6,3],[25,15,3.2,2.2],[47,22,4.4,2.8],[48,40,2.8,3.1],[34,47,4,1.7]];
const ridges=[[13,27,1.6,2],[42,17,2,1.5],[48,45,2,1.5]];
const inside=(x,y,[cx,cy,rx,ry])=>((x-cx)/rx)**2+((y-cy)/ry)**2<1;
const rows=[];
for(let y=0;y<H;y++){
  let row='';
  for(let x=0;x<W;x++){
    const dx=(x-32)/24,dy=(y-32)/19.4,a=Math.atan2(dy,dx);
    const edge=1+.045*Math.sin(3*a+.4)+.036*Math.sin(5*a-.7)+.019*Math.cos(9*a);
    const distance=(Math.abs(dx)**2.75+Math.abs(dy)**2.75)**(1/2.75)/edge;
    const d=creekDistance(x,y);
    if(d<=1)reservedWater[idx(x,y)]=1;
    let c='~';
    if(distance<1.15){
      c=distance>1?'-':distance>.875?'.':',';
      if(c===','&&stands.some(s=>inside(x,y,s)))c='T';
      if(c===','&&ridges.some(s=>inside(x,y,s)))c='^';
      if(distance<=1&&d<1.5)c=d<=1?'-':'.';
    }
    row+=c;
  }
  rows.push(row);
}
export const inletMask=rows.join('\n');
export const isCreek=(x,y)=>reservedWater[idx(x,y)]===1;
export const inletSites=[
  {id:'E01_spring_north',x:28,y:14},{id:'E02_spring_east',x:52,y:30},
  {id:'E03_grove_west',x:13,y:41},{id:'E04_grove_south',x:36,y:47},
  {id:'E05_berry_patch',x:28,y:26},{id:'E06_fish_cove',x:53,y:22}
];
