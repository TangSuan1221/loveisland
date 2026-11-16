import {idx,inBounds,T} from './grid.js';
import tables from './tables.json' with {type:'json'};
export const roads=tables.roads.map(r=>r.wood_per_tile);
export const interiors=Object.fromEntries(tables.interiors.map(r=>[r.id,[r.name_zh,r.wood,r.beauty,r.unlock_day]]));
export const stages=tables.expansion.map(r=>[r.radius,r.need_day,r.need_built,r.wood]);
const rules=new Map(tables.engineering.map(r=>[r.action,r]));
export const fail=(code,message,detail=null)=>({ok:false,code,message,reason:message,detail});
export const ok=message=>({ok:true,code:'OK',message});
export function applyWorks(c,g,day,p,winter){
  if(p.op==='crew'){
    if(!Number.isInteger(p.value)||p.value<0||p.value>3||winter)return fail('LOCKED','可安排 0–3 名工人，冬季停工。');
    c.crew=p.value;return ok('工班已调整。');
  }
  const left=winter?0:Math.max(0,c.crew*9-c.used);
  if(winter&&p.op!=='skin')return fail('WINTER_LOCK','冻土期不能动土。');
  if(p.op==='expand'){
    const stage=stages[c.stage+1];
    if(!stage)return fail('MAX_STAGE','岛屿已扩至最大。');
    const [radius,minDay,count,wood]=stage;
    if(day<minDay||c.placed.length<count)return fail('LOCKED','需要第 '+minDay+' 天并建成 '+count+' 座建筑。');
    if(c.wood<wood)return fail('NO_MATERIALS','扩岛需要 '+wood+' 木料。');
    if(left<9)return fail('NO_BUDGET','扩岛需要 9 工时。');
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){
      const i=idx(x,y);
      if(!g.isRiver(x,y)&&(x-32)**2+(y-32)**2<=radius**2&&g.base[i]===T.DEEP)c.tiles[i]=[T.SAND,0,0];
    }
    c.stage++;c.used+=9;c.wood-=wood;return ok('岛屿扩建完成。');
  }
  if(!p.cells?.length||p.cells.length>4096)return fail('OUT_OF_BOUNDS','请选择岛内地块。');
  let cost=0,hours=0,wood=0,stone=0;
  const changes=new Map();
  for(const {x,y} of p.cells){
    if(!Number.isInteger(x)||!Number.isInteger(y)||!inBounds(x,y))return fail('OUT_OF_BOUNDS','超出了岛的范围。');
    const i=idx(x,y);
    if(changes.has(i))continue;
    let base=g.base[i],skin=g.skin[i],road=g.road[i];
    if(g.occ[i]&&p.op!=='skin')return fail('BLOCKED','建筑占用了这块地。');
    const land=[T.GRASS,T.SAND,T.SOIL].includes(base);
    switch(p.op){
      case 'fill':
        if(g.isRiver(x,y)||base!==T.SHALLOW)return fail('TERRAIN','只可填沿岸浅水，河道须保留。');
        base=T.SAND;cost+=rules.get('fill').wood_per_tile;hours+=rules.get('fill').hours_per_tile;break;
      case 'clear':
        if(base===T.FOREST){const rule=rules.get('clear_forest');wood+=Number(rule.output.split(':')[1]);hours+=rule.hours_per_tile;}
        else if(base===T.ROCK){const rule=rules.get('clear_rock');stone+=Number(rule.output.split(':')[1]);hours+=rule.hours_per_tile;}
        else return fail('TERRAIN','请选择森林或岩地。');
        base=T.SOIL;break;
      case 'pave':
        if(!land||road||!Number.isInteger(p.value)||!roads[p.value])return fail('TERRAIN','需要未铺装的陆地。');
        road=p.value;cost+=roads[road];hours+=tables.roads[road].hours_per_tile;break;
      case 'unpave':
        if(!road)return fail('TERRAIN','这里没有铺装。');
        road=0;wood+=Number(rules.get('unpave').output.split(':')[1]);hours+=rules.get('unpave').hours_per_tile;break;
      case 'skin':
        if(!land||![0,1].includes(p.value))return fail('TERRAIN','仅草地、沙地和泥土可换皮。');
        skin=p.value;break;
      default:return fail('NOT_FOUND','未知工程。');
    }
    changes.set(i,[base,skin,road]);
  }
  if(cost>c.wood+1e-8)return fail('NO_MATERIALS','木料不足。');
  if(hours>left+1e-8)return fail('NO_BUDGET','今天的剩余工时不足。');
  c.wood=Math.round((c.wood-cost+wood)*100)/100;c.stone+=stone;c.used=Math.round((c.used+hours)*100)/100;
  for(const [i,tile] of changes)c.tiles[i]=tile;
  return ok('工程完成，共 '+changes.size+' 格。');
}
