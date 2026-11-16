import {makeGrid,newCamp,catalog,catalogFor} from './model.js';
import {rleEncode,rleDecode,fnv1a} from './grid.js';
import {interiors} from './works.js';
const keys=new Map(catalog.map((s,i)=>[s.id,i]));
const int=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max;
function crc(bytes){
  let value=-1;
  for(const b of bytes){value^=b;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);}
  return ((value^-1)>>>0).toString(16).padStart(8,'0');
}
export function snapshot(c,day){
  const p=c?.placed||[],a=fn=>p.map(fn);
  return {gridVersion:c?.gridRevision??c?.version??0,stage:c?.stage||0,budgetMax:c?(c.crew??1)*9:0,budgetUsed:c?.day===day?c.used:0,structCount:p.length,structId:a(s=>s.id),structKind:a(s=>keys.get(s.kind)),structX:a(s=>s.x),structY:a(s=>s.y),structRot:a(s=>s.rot),structState:a(s=>Number(!!s.damaged)),structBeds:a(s=>s.homeOf?.length||0),structBeauty:a(s=>interiors[s.interior]?.[2]||0),inventoryCount:catalog.map(d=>c?.inventory[d.id]||0)};
}
export function validateCamp(c){
  if(!c||!Number.isFinite(c.wood)||c.wood<0||!int(c.stage||0,2)||!int(c.crew??1,3)||!Array.isArray(c.placed)||!c.inventory)throw Error('营地存档字段无效。');
  const ids=new Set(),residents=new Set(),cells=new Set();
  for(const s of c.placed){
    const d=catalogFor(c)[keys.get(s.kind)];
    if(!d||!int(s.id,65535)||!s.id||ids.has(s.id)||!int(s.x,63)||!int(s.y,63)||!int(s.rot,3))throw Error('建筑编号或坐标无效。');
    const w=s.rot%2?d.h:d.w,h=s.rot%2?d.w:d.h;
    if(s.x+w>64||s.y+h>64||(s.homeOf||[]).length>d.beds)throw Error('建筑超出范围或床位不足。');
    for(let y=s.y;y<s.y+h;y++)for(let x=s.x;x<s.x+w;x++){const i=y*64+x;if(cells.has(i))throw Error('建筑占地重叠。');cells.add(i);}
    for(const npc of s.homeOf||[]){if(residents.has(npc))throw Error('床位分配重复。');residents.add(npc);}
    ids.add(s.id);
  }
  if(!Number.isSafeInteger(c.nextId)||c.nextId<=Math.max(0,...ids))throw Error('建筑序号异常。');
  for(const [i,v] of Object.entries(c.tiles||{}))if(!int(Number(i),4095)||!Array.isArray(v)||!int(v[0],7)||!int(v[1],3)||!int(v[2],3))throw Error('地块数据无效。');
  for(const d of catalog){
    const stock=c.inventory[d.id]||0,owned=c.placed.filter(s=>s.kind===d.id).length+stock;
    if(!int(c.starterStock?.[d.id]||0,stock))throw Error('继承物库存无效。');
    if(!int(stock,d.max_count)||owned>d.max_count)throw Error('库存超出上限。');
    if(c.bought&&owned+(c.sold?.[d.id]||0)+(c.dismantled?.[d.id]||0)!==(c.bought[d.id]||0))throw Error('营地物品对账失败。');
  }
  return c;
}
export function gridDelta(c,knownVersion){
  if(!c||knownVersion===(c.gridRevision??c.version??0))return null;
  const g=makeGrid(c,c.day);
  return {version:c.gridRevision??c.version??0,base:g.base,skin:g.skin,road:g.road,occ:g.occ,blocked:g.blocked,walkStruct:g.walkStruct};
}
export function hashCamp(c){
  const grid=makeGrid(c,c.day);
  let hash=fnv1a(grid.base);hash=fnv1a(grid.skin,hash);hash=fnv1a(grid.road,hash);
  const counts=catalog.map(d=>[c.inventory[d.id]||0,c.bought?.[d.id]||0,c.sold?.[d.id]||0,c.dismantled?.[d.id]||0]);
  const structs=c.placed.map(st=>[st.id,st.kind,st.x,st.y,st.rot,st.hp,!!st.damaged,st.interior,st.homeOf]);
  return fnv1a(new TextEncoder().encode(JSON.stringify([c.day,c.stage,c.wood,c.stone,c.crew,c.used,c.nextId,c.strain||0,counts,structs])),hash);
}
export function pack(c){
  validateCamp(c);
  const g=makeGrid(c,c.day),{tiles,undo,redo,...state}=c;
  const bytes=new TextEncoder().encode(JSON.stringify({v:3,hash:hashCamp(c),state,layers:[g.base,g.skin,g.road].map(rleEncode)}));
  let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
  return 'CI-BP2.'+btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')+'.'+crc(bytes);
}
export function unpack(code){
  if(typeof code!=='string'||code.length>2000000)throw Error('蓝图过大。');
  const m=/^CI-BP2\.([\w-]+)\.([0-9a-f]{8})$/.exec(code.trim());if(!m)throw Error('蓝图格式错误。');
  const bytes=Uint8Array.from(atob(m[1].replaceAll('-','+').replaceAll('_','/')),ch=>ch.charCodeAt(0));
  if(crc(bytes)!==m[2])throw Error('蓝图校验失败。');
  const doc=JSON.parse(new TextDecoder().decode(bytes));if(doc.v!==3||doc.layers?.length!==3)throw Error('蓝图版本不兼容。');
  const c=Object.assign(newCamp(),doc.state,{tiles:{}}),base=makeGrid({...newCamp(),mapVersion:c.mapVersion},1).base;
  const layers=doc.layers.map((a,k)=>{if(!Array.isArray(a)||a.length>8192||a.length%2)throw Error('图层异常。');let n=0;for(let i=0;i<a.length;i+=2){if(!int(a[i],[7,3,3][k])||!int(a[i+1],4096)||!a[i+1])throw Error('图层数据异常。');n+=a[i+1];}if(n!==4096)throw Error('图层长度异常。');return rleDecode(a,4096);});
  for(let i=0;i<4096;i++){const [b,s,r]=layers.map(a=>a[i]);if(b!==base[i]||s||r)c.tiles[i]=[b,s,r];}
  validateCamp(c);if(doc.hash!==undefined&&doc.hash!==hashCamp(c))throw Error('建筑状态校验失败。');return c;
}
