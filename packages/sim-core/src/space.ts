export const WORLD_SCALE = 0.12;
export const CAMP = { x: 0, z: 0 };
const SITE_ORIGIN = { x: 200, y: 130 };

export function siteWorld(sx: number, sy: number) {
  return { x: (sx - SITE_ORIGIN.x) * WORLD_SCALE, z: (sy - SITE_ORIGIN.y) * WORLD_SCALE };
}


export function slotPosition(group:number,index:number,site?:{x:number,y:number}){
  const center=site ? siteWorld(site.x,site.y) : CAMP;
  const angle=index*2.39996+group;
  const radius=(site?1.2:1.6)+0.55*Math.sqrt(index);
  return {x:center.x+Math.cos(angle)*radius,z:center.z+Math.sin(angle)*radius};
}
export function canHear(a:{x:number,z:number},b:{x:number,z:number}){
  return Math.hypot(a.x-b.x,a.z-b.z)<=15;
}
