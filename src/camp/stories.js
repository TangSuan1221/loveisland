import {isCampWinter} from './day.js';
import tables from './tables.json' with {type:'json'};
import {catalog} from './model.js';
import {interiors} from './works.js';

const defs=new Map(catalog.map(d=>[d.id,d]));
export function condition(c,cast,term,at){
  const houses=c.placed.filter(b=>!b.damaged&&defs.get(b.kind).beds);
  if(term==='homeless')return cast.some(id=>!houses.some(b=>b.homeOf?.includes(id)));
  if(term==='interior_unequal')return new Set(houses.filter(b=>b.homeOf?.length).map(b=>interiors[b.interior||'bare'][2])).size>1;
  if(term.startsWith('shares_home:')){const ids=term.slice(12).split(',');return houses.some(b=>ids.every(id=>b.homeOf?.includes(id)));}
  if(term.startsWith('at:'))return !!at&&defs.get(at.kind).tags.includes(term.slice(3));
  if(term.startsWith('struct:'))return c.placed.some(b=>!b.damaged&&b.kind===term.slice(7));
  const m=/^struct_cat:(\w+)>=(\d+)$/.exec(term);
  return !!m&&c.placed.filter(b=>!b.damaged&&defs.get(b.kind).cat===m[1]).length>=Number(m[2]);
}
const scenes=[
  ['S_island_grew',e=>e.op==='expand',['沿着新露出的沙地走了一圈。','在新岸线上规划下一间屋子。','站在岸边，谈起刚上岛时的营地。']],
  ['S_new_home',e=>e.op==='assign',['接过钥匙，试了试新床。','把行李搬进了新家。','在门口商量床边的位置。']],
  ['S_upgrade',e=>e.op==='upgrade',['领着同伴参观翻新的房子。','被问起新房花掉的木料。','在门口给旧屋留了一张照片。']],
  ['S_first_cross',e=>e.op==='place'&&e.kind==='bridge',['抢先走过新桥。','在桥头等同伴先行。','扶着栏杆试了试桥板。']],
  ['S_wall_dispute',e=>['place','fences'].includes(e.op)&&e.kind==='fence',['停在新栅栏前商量拆掉一段。','绕过了新栅栏。','为绕路多花的时间争了几句。']],
  ['S_homeless',e=>e.op==='coldNight',['在寒夜里询问能否挤一张床。','因为床位不够起了争执。','把毯子分给了露宿的同伴。']]
];
export function campStory(s){
  const c=s.camp,cast=s.cast.filter(id=>!['medical','left'].includes(s.status[id]));
  if(!cast.length||c.storyDay===s.businessDay)return null;
  const events=c.events.filter(e=>e.day===s.businessDay);
  if(isCampWinter(s.businessDay)&&condition(c,cast,'homeless'))events.push({op:'coldNight'});
  for(const [sceneId,test,lines] of scenes){
    if(sceneId==='S_first_cross'&&c.crossingSeen)continue;
    const e=events.find(test);if(!e)continue;
    const st=c.placed.find(v=>v.id===e.id)||c.placed.find(v=>v.kind===e.kind);
    const first=cast.includes(e.npc)?e.npc:cast[0],participants=[first,...cast.filter(id=>id!==first).slice(0,1)];
    const rows=tables.scenes.filter(row=>row.scene_id===sceneId);
    let draw=((Math.imul(s.businessDay,2654435761)^(st?.id||0)^(s.seed||0))>>>0)%100;
    const branch=Math.max(0,rows.findIndex(row=>(draw-=Number(row.rate))<0));
    c.storyDay=s.businessDay;if(sceneId==='S_first_cross')c.crossingSeen=true;
    const site=st||(sceneId==='S_homeless'?c.placed.find(b=>!b.damaged&&defs.get(b.kind)?.beds):null);
    const def=site&&defs.get(site.kind);
    const turn=site?.rot||0, swapped=turn%2;
    const stageAnchor=def?{
      x:(site.x-32+((swapped?def.h:def.w)-1)/2)*.75,
      z:(site.y-32+((swapped?def.w:def.h)-1)/2)*.75,
      yaw:-turn*Math.PI/2,width:def.w*.7,depth:def.h*.7
    }:null;
    return {stageAnchor,type:'camp-story',sourceType:sceneId,id:sceneId+'-'+s.businessDay,sceneId,sourcePart:'action',participants,text:(s.candidates.find(p=>p.id===first)?.name||'嘉宾')+lines[branch],result:'B'+(branch+1),x:((st?.x??32)-32)*.75,z:((st?.y??32)-32)*.75};
  }
  return null;
}
