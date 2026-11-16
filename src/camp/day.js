import {makeGrid,catalog} from './model.js';
import {interiors} from './works.js';
const byKind=new Map(catalog.map(d=>[d.id,d]));
export const campSeason=day=>Math.floor(((day-1)%60)/15);
export const isCampWinter=day=>campSeason(day)===3;
export function advanceCamp(s){
  const c=s.camp,day=s.businessDay;
  if(c.day===day)return;
  c.day=day;c.used=0;
  const winter=isCampWinter(day);
  if(winter)c.crew=0;
  const g=makeGrid(c,day),team=s.cast.filter(id=>!['left','medical'].includes(s.status[id]));
  c.crew=Math.min(c.crew,Math.max(0,team.length-1));
  const workers=team.length-c.crew;
  const resources=[['water',0],['food',1],['wood',2]];
  for(const [resource,index] of resources){
    const sites=g.sites.filter(site=>[/spring/,/berry|fish/,/grove/][index].test(site.id)&&g.reachable(site.x,site.y));
    const factor=Math.max(0,...sites.map(site=>g.commuteFactor(site.x,site.y)));
    const amount=Math.floor(workers*factor);
    if(resource==='wood')c.wood+=amount;else s.inventory[resource]+=amount;
  }
  if(winter&&day%5===0){
    const shelters=c.placed.filter(v=>catalog.find(d=>d.id===v.kind)?.beds&&!v.damaged);
    const n=((Math.imul(day,2654435761)^s.seed)>>>0);
    if(shelters.length&&n%3!==0){const hit=shelters[n%shelters.length];hit.hp=Math.max(0,(hit.hp??30)-40);hit.damaged=hit.hp===0;}
  }
  for(const st of c.placed)st.homeOf=(st.homeOf||[]).filter(id=>team.includes(id));
  c.version=(c.version||0)+1;
}
export function campClimate(camp,x,z,id){
  let warmth=0,home=null,indoor=0;
  for(const st of camp?.placed||[]){
    if(st.damaged)continue;
    const d=byKind.get(st.kind),w=st.rot%2?d.h:d.w,h=st.rot%2?d.w:d.h;
    const tx=x/.75+32,ty=z/.75+32;
    if(d.warmth_radius&&(st.x+(w-1)/2-tx)**2+(st.y+(h-1)/2-ty)**2<=d.warmth_radius**2)warmth=Math.max(warmth,d.warmth_bonus);
    if(d.beds&&tx>=st.x-.5&&tx<st.x+w-.5&&ty>=st.y-.5&&ty<st.y+h-.5)indoor=4;
    if(d.beds&&st.homeOf?.includes(id))home=st;
  }
  return {temperature:[18,26,14,2][campSeason(camp?.day||1)],warmth,indoor,home,beauty:interiors[home?.interior]?.[2]||0};
}
