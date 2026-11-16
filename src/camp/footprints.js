import {W,H,sizeOf} from './grid.js';

export const CELL_SIZE=.75;
const ORIGIN=32;
export const FACILITY_FOOTPRINTS={
  water:[3,2],table:[4,3],tent:[4,3],cabin:[5,4],fire:[3,3],
  interview:[3,3],camera:[1,1],privacy:[4,3],heater:[2,2]
};
export const worldToCell=(x,z)=>({x:Math.floor(x/CELL_SIZE+ORIGIN+.5),y:Math.floor(z/CELL_SIZE+ORIGIN+.5)});
export const cellToWorld=(x,y)=>({x:(x-ORIGIN)*CELL_SIZE,z:(y-ORIGIN)*CELL_SIZE});
export function facilityRect({type,x,z,rot=0}){
  const def=FACILITY_FOOTPRINTS[type];
  if(!def||!Number.isFinite(x)||!Number.isFinite(z)||!Number.isInteger(rot)||rot<0||rot>3)return null;
  const {w,h}=sizeOf(...def,rot);
  const anchor=worldToCell(x-(w-1)*CELL_SIZE/2,z-(h-1)*CELL_SIZE/2);
  return {...anchor,w,h};
}
export function facilityPosition(type,x,z,rot=0){
  const rect=facilityRect({type,x,z,rot});
  if(!rect)return null;
  return {...cellToWorld(rect.x+(rect.w-1)/2,rect.y+(rect.h-1)/2),rot};
}
export function overlaps(a,b){
  return !!a&&!!b&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
}
const formations=[
  [-.1,-10.25,3.2,2.1],[-2.2,-8.9,1.85,1.65],[1.8,-8.3,2.13,1.68],
  [-8,-7.8,.95,.95],[-10.7,-5.6,.6,.6],[-5.9,-9.8,.72,.72],[-9.5,-9.95,.78,.78]
];
export function landmarkAt(x,y){
  const p=cellToWorld(x,y),half=CELL_SIZE/2;
  return formations.some(([cx,cz,rx,rz])=>{
    const dx=Math.max(0,Math.abs(p.x-cx)-half),dz=Math.max(0,Math.abs(p.z-cz)-half);
    return (dx/rx)**2+(dz/rz)**2<1;
  });
}
export function facilityConflict(grid,candidate,facilities,ignore){
  const rect=facilityRect(candidate);
  if(!rect||rect.x<0||rect.y<0||rect.x+rect.w>W||rect.y+rect.h>H)return '设施超出地图边界。';
  if(facilities.some(f=>f.id!==ignore&&overlaps(rect,facilityRect(f))))return '地格已被节目设施占用。';
  for(let y=rect.y;y<rect.y+rect.h;y++)for(let x=rect.x;x<rect.x+rect.w;x++){
    if(landmarkAt(x,y))return '此处有固定地标。';
    if(grid.occ[y*W+x])return '这里已有营地建筑。';
    if(!['grass','sand','soil'].includes(grid.terrainKey(x,y)))return '设施需要完整连片的平坦陆地。';
    if(grid.sites.some(site=>Math.abs(x-site.x)+Math.abs(y-site.y)<=1))return '需要避开资源点。';
  }
  return null;
}
