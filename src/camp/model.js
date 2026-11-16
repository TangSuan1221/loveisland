import data from './island.json' with {type:'json'};
import {Island,TERRAIN_KEYS,idx,inBounds} from './grid.js';
import {applyWorks,interiors,fail,ok} from './works.js';

import {inletMask,isCreek,inletSites} from './inlet.js';
import {facilityRect,overlaps,landmarkAt} from './footprints.js';
import tables from './tables.json' with {type:'json'};
export const catalog=tables.structures.map(d=>({...d,name:d.name_zh}));
const enlarged={clinic:[6,5],shop:[5,4],farm:[4,3],pier:[2,7]};
const inletCatalog=catalog.map(d=>{
  if(!enlarged[d.id])return d;
  const [w,h]=enlarged[d.id];
  return {...d,w,h,door_x:Math.floor((w-1)/2),door_y:h-1};
});
export const catalogFor=camp=>camp?.mapVersion===2?inletCatalog:catalog;
const costs=Object.fromEntries(tables.terrain.map(t=>[t.key,t.move_cost]));
const terrainDefs=TERRAIN_KEYS.map(key=>({walkable:Number(costs[key]>0),move_cost:costs[key]}));
const histories=new WeakMap();
const housing=['tent','hut','house','longhouse'];
export function newCamp(){
  return {wood:6,stone:0,inventory:{},placed:[],nextId:1,tiles:{},crew:1,used:0,stage:0,day:1,version:0,gridRevision:0,bought:{},sold:{},dismantled:{},events:[]};
}
export function makeGrid(camp,day){
  const inlet=camp.mapVersion===2;
  const g=new Island({...data,sites:inlet?inletSites:data.sites,mask:inlet?inletMask:data.mask,structures:catalogFor(camp),terrainDefs});
  g.isRiver=inlet?isCreek:(x=>x===46);g.gridVersion=camp.version||0;
  g.day=day;if(camp.islandArtGrid)g.isReservedCell=landmarkAt;
  for(const [i,[base,skin,road]] of Object.entries(camp.tiles||{})){g.base[i]=base;g.skin[i]=skin;g.road[i]=road;}
  for(const building of camp.placed){
    const st={...building,kind:g.kinds.get(building.kind)};
    g.structs.push(st);g._stamp(st);
  }
  return g;
}
export function overlapsFacility(building,facility,camp){
  const d=catalogFor(camp).find(d=>d.id===building.kind);
  if(!d)return false;
  const w=building.rot%2?d.h:d.w,h=building.rot%2?d.w:d.h;
  const rect=facilityRect(facility);
  if(rect)return overlaps({x:building.x,y:building.y,w,h},rect);
  const left=(building.x-32-.5)*.75,top=(building.y-32-.5)*.75;
  const dx=Math.max(left-facility.x,0,facility.x-left-w*.75),dz=Math.max(top-facility.z,0,facility.z-top-h*.75);
  return dx*dx+dz*dz<facility.radius**2;
}
function buildingPermit(c,st,kind,day){
  return {day:(st?.starter||c.starterStock?.[kind.id])?Math.max(day,kind.unlock_day):day};
}
function change(c,day,p,context){
  const g=makeGrid(c,day),def=g.kinds.get(p.kind),st=p.op==='place'?undefined:c.placed.find(v=>v.id===p.id);
  const stock=k=>c.inventory[k]||0;
  const owned=k=>stock(k)+c.placed.filter(s=>s.kind===k).length;
  const add=(account,k,n=1)=>{account[k]=(account[k]||0)+n;};
  if(p.op==='crew'&&context.cast&&p.value>Math.max(0,context.cast.length-1))return fail('LOCKED','至少留一名嘉宾负责取水。');
  if(['fill','clear','pave','unpave','skin','crew','expand'].includes(p.op))return applyWorks(c,g,day,p,context.winter);
  if(p.op==='buy'||p.op==='sell'){
    if(!def)return fail('NOT_FOUND','建筑不存在。');
    if(p.op==='sell'){
      if(!stock(def.id))return fail('NOT_IN_INVENTORY','仓库中没有这件建筑。');
      add(c.inventory,def.id,-1);add(c.sold,def.id);if(c.starterStock?.[def.id])add(c.starterStock,def.id,-1);else c.wood+=def.wood*.5;return ok('建筑已卖回。');
    }
    if(day<def.unlock_day)return fail('LOCKED','第 '+def.unlock_day+' 天解锁。');
    if(owned(def.id)>=def.max_count)return fail('MAX_COUNT','已达拥有上限。');
    if(c.wood<def.wood)return fail('NO_MATERIALS','木料不足。');
    c.wood-=def.wood;add(c.inventory,def.id);add(c.bought,def.id);return ok(def.name+'已放入仓库。');
  }
  if(p.op!=='place'&&!st)return fail('NOT_FOUND','建筑不存在。');
  const old=st&&g.kinds.get(st.kind);
  if(p.op==='assign'){
    if(!context.cast?.includes(p.npc))return fail('NOT_FOUND','嘉宾不在岛上。');
    if((st.homeOf||[]).length>=old.beds||st.homeOf?.includes(p.npc))return fail('BLOCKED','床位已满或已入住。');
    for(const s of c.placed)s.homeOf=(s.homeOf||[]).filter(id=>id!==p.npc);
    st.homeOf.push(p.npc);c.strain=(c.strain||0)+4;return ok('已分配床位。');
  }
  if(p.op==='interior'||p.op==='repair'){
    const set=interiors[p.value];
    if(p.op==='interior'&&(!set||old.cat!=='shelter'||set[3]>day))return fail('LOCKED','套装未解锁或建筑不适用。');
    if(p.op==='repair'&&!st.damaged)return fail('LOCKED','这栋建筑完好。');
    const cost=p.op==='repair'?Math.ceil(Math.ceil(old.wood*.25)*(context.winter?1.5:1)):set[1];
    if(c.wood<cost)return fail('NO_MATERIALS','木料不足。');
    c.wood-=cost;
    if(p.op==='repair'){st.damaged=false;st.hp=old.hp||30;}else st.interior=p.value;
    return ok('已完成'+(p.op==='repair'?'修缮。':'装修。'));
  }
  const before=g.structs.filter(s=>s.id!==st?.id&&s.kind.access==='land').map(s=>({...g.doors(s.kind,s.x,s.y,s.rot).access,name:s.kind.name})).filter(p=>g.reachable(p.x,p.y));
  if(st){const prior=g.structs.find(s=>s.id===st.id);g._unstamp(prior);g.structs=g.structs.filter(s=>s!==prior);g._distCache=null;}
  if(p.op==='store'||p.op==='dismantle'){
    if(st.homeOf?.length){c.strain=(c.strain||0)+(p.op==='store'?4:8);c.events.push({day,op:'structureRemoved',id:st.id,residents:[...st.homeOf]});}
    c.placed=c.placed.filter(s=>s!==st);
    if(p.op==='store'){add(c.inventory,st.kind);if(st.starter)add(c.starterStock??={},st.kind);}
    else{add(c.dismantled,st.kind);if(!st.starter)c.wood+=old.wood*.5;}
  }else{
    if(!['place','move','rotate','upgrade'].includes(p.op))return fail('NOT_FOUND','未知操作。');
    const target=p.op==='place'||p.op==='upgrade'?def:old;
    if(!target)return fail('NOT_FOUND','建筑不存在。');
    const x=p.x??st?.x,y=p.y??st?.y,rot=p.op==='rotate'?((st.rot+1)%4):(p.rot??st?.rot??0);
    if(!Number.isInteger(x)||!Number.isInteger(y)||!inBounds(x,y))return fail('OUT_OF_BOUNDS','超出了岛的范围。');
    if(!Number.isInteger(rot)||rot<0||rot>3||(!target.rotatable&&rot))return fail('LOCKED','这座建筑不能转向。');
    const footprint=g.kindSize(target,rot);if(x+footprint.w>64||y+footprint.h>64)return fail('OUT_OF_BOUNDS','超出了岛的范围。');
    if(!st&&!stock(target.id))return fail('NOT_IN_INVENTORY','仓库里没有这件建筑。');
    if(p.op==='upgrade'){
      if(!housing.includes(old.id)||housing.indexOf(target.id)<=housing.indexOf(old.id)||day<target.unlock_day)return fail('LOCKED','无法升级至这类建筑。');
      if(owned(target.id)>=target.max_count)return fail('MAX_COUNT','升级目标已达上限。');
      const cost=target.wood-old.wood;
      if(c.wood<cost)return fail('NO_MATERIALS','升级差价需要 '+cost+' 木料。');
      c.wood-=cost;add(c.bought,target.id);add(c.dismantled,old.id);
    }
    if(context.facilities?.some(f=>overlapsFacility({kind:target.id,x,y,rot},f,c)))return fail(p.op==='upgrade'?'NEED_MOVE':'BLOCKED','这里已被节目设施占用。');
    const check=g.canPlace(target,x,y,rot,buildingPermit(c,st,target,day));
    if(!check.ok)return fail(p.op==='upgrade'?'NEED_MOVE':check.code,[check.reason,check.detail].filter(Boolean).join(' · '),check.detail);
    const building=st||{id:c.nextId++,homeOf:[],interior:'bare'};
    Object.assign(building,{kind:target.id,x,y,rot});
    if(!st||p.op==='upgrade'){building.hp=target.hp||30;building.damaged=false;}
    if(!st){if(c.starterStock?.[target.id]){add(c.starterStock,target.id,-1);building.starter=true;}add(c.inventory,target.id,-1);c.placed.push(building);}
    g._stamp({...building,kind:target});g._distCache=null;
    if(!g.reachable(32,32))return fail('SEALS_OFF','需要保留营地中心通道。');
    if(target.access==='land'){const door=g.doors(target,x,y,rot).access;if(!g.reachable(door.x,door.y))return fail('NO_ACCESS','建筑入口无法到达。');}
  }
  const sealed=before.find(p=>!g.reachable(p.x,p.y));
  if(sealed)return fail('SEALS_OFF','会堵住'+sealed.name+'的入口。');
  return ok(({store:'建筑已收回仓库。',dismantle:'建筑已拆除，返还一半木料。',move:'建筑已移动。',rotate:'建筑已旋转。',upgrade:'升级完成。',place:(def?.name||'建筑')+'已落成。'})[p.op]);
}
export function editCamp(camp,day,p,context={}){
  const c=Object.assign(newCamp(),structuredClone(camp));
  if(!camp.bought)for(const d of catalog)c.bought[d.id]=(c.inventory[d.id]||0)+c.placed.filter(s=>s.kind===d.id).length;
  if(c.day!==day){c.used=0;c.day=day;}
  const historyState=histories.get(camp);const sameDay=historyState?.day===day;
  const history=sameDay?historyState.undo:[],future=sameDay?historyState.redo:[];delete c.undo;delete c.redo;
  if(p.op==='undo'||p.op==='redo'){
    const stack=p.op==='undo'?history:future,other=p.op==='undo'?future:history;
    if(!stack.length||camp.day!==day)return fail('LOCKED','没有可恢复的操作。');
    const restored=stack.at(-1);
    if(restored.placed.some(b=>context.facilities?.some(f=>overlapsFacility(b,f,restored))))return fail('BLOCKED','原位置已被节目设施占用。');
    other.push(structuredClone(c));stack.pop();
    Object.assign(camp,restored,{version:c.version+1,gridRevision:(c.gridRevision||0)+1});histories.set(camp,{day,undo:history,redo:future});
    return ok(p.op==='undo'?'已撤销。':'已重做。');
  }
  const before=structuredClone(c);
  let r;
  if(p.op==='fences'){
    if(!Array.isArray(p.cells)||!p.cells.length||p.cells.length>64)return fail('BLOCKED','请选择 1–64 个栅栏落点。');
    for(const cell of p.cells){r=change(c,day,{...cell,kind:'fence',op:'place',rot:0},context);if(!r.ok)break;}
  }else r=change(c,day,p,context);
  if(r.ok){
    const reversible=['place','fences','move','rotate','store','skin','pave','unpave'].includes(p.op);
    histories.set(camp,{day,undo:reversible?[...history,before].slice(-100):[],redo:[]});
  }
  if(r.ok){if(['place','fences','move','rotate','store','dismantle','upgrade','expand','skin','fill','clear','pave','unpave'].includes(p.op))c.gridRevision=(c.gridRevision||0)+1;c.version++;c.events.push({day,op:p.op,id:p.id??(p.op==='place'?c.nextId-1:null),kind:p.kind??null,npc:p.npc??null});c.events=c.events.slice(-100);Object.assign(camp,c);}
  return r;
}
export function newIslandCamp(){
  const camp={...newCamp(),islandArtGrid:true,mapVersion:2},grid=makeGrid(camp,1);
  const inherit=[
    ['clinic',35,29,0],['shop',34,35,0],['farm',22,33,0],
    ['fire_pit',32,38,0],['pier',53,44,1]
  ];
  for(const [id,x,y,rot] of inherit){
    const kind=grid.kinds.get(id);
    const check=grid.canPlace(kind,x,y,rot,{day:Math.max(1,kind.unlock_day)});
    if(!check.ok)throw new Error('初始建筑 '+id+' 无法落位 '+check.code);
    const building={id:camp.nextId++,kind:id,x,y,rot,starter:true,homeOf:[],interior:'bare',hp:kind.hp||30,damaged:false};
    camp.placed.push(building);camp.bought[id]=1;
    const record={...building,kind};
    grid.structs.push(record);grid._stamp(record);grid._distCache=null;
  }
  return camp;
}
