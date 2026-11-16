import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,newCamp,makeGrid,editCamp} from '../src/camp/model.js';
import {pack,unpack,validateCamp,snapshot} from '../src/camp/archive.js';
import {campStory,condition} from '../src/camp/stories.js';
import {campClimate,advanceCamp} from '../src/camp/day.js';
import {idx,T} from '../src/camp/grid.js';
function fixture(day=50){
  const c=newCamp();c.wood=10000;
  return {c,run:(op,p={},opts={})=>editCamp(c,day,{op,...p},{cast:['a','b'],...opts})};
}
function tile(c,base){const g=makeGrid(c,1),i=g.base.indexOf(base);return {x:i%64,y:i>>6};}
function good(r){assert.ok(r.ok,r.code+' '+r.message);}
test('建筑目录、地形、河道与资源点',()=>{
 const g=makeGrid(newCamp(),1);
 for(const a of [g.base,g.skin,g.road,g.occ,g.blocked,g.walkStruct])assert.equal(a.length,4096);
 assert.equal(catalog.length,24);assert.equal(g.sites.length,6);
 for(const d of catalog){assert.ok(d.door_x<d.w&&d.door_y<d.h&&d.tags.length);if(d.upgrade_to)assert.ok(g.kinds.has(d.upgrade_to));}
 for(const p of g.sites)assert.ok(g.isWalkable(p.x,p.y));
 assert.equal(g.terrainAt(46,32),T.SHALLOW);
});
test('仓库限额、售出、永久拆除和 200 次操作对账',()=>{
 const {c,run}=fixture();
 for(let i=0;i<3;i++)good(run('buy',{kind:'fire_pit'}));
 assert.equal(run('buy',{kind:'fire_pit'}).code,'MAX_COUNT');
 good(run('sell',{kind:'fire_pit'}));
 good(run('place',{kind:'fire_pit',x:29,y:31}));const wood=c.wood;
 good(run('dismantle',{id:1}));assert.equal(c.wood,wood+2);assert.equal(c.inventory.fire_pit,1);
 let rng=17;
 for(let i=0;i<200;i++){rng=(Math.imul(rng,1664525)+1013904223)>>>0;run(['buy','place','sell','store'][rng%7%4],{kind:'fence',x:20+(rng%17),y:20+((rng>>>8)%17),id:c.placed.at(-1)?.id});validateCamp(c);}
});
test('购入、占格、旋转、封门和改建原子性',()=>{
 const {c,run}=fixture();const p=(kind,x,y)=>{good(run('buy',{kind}));good(run('place',{kind,x,y}));};
 p('tent',20,20);good(run('assign',{id:1,npc:'a'}));good(run('rotate',{id:1}));good(run('move',{id:1,x:22,y:20,rot:0}));
 assert.equal(makeGrid(c,50).occ[idx(20,20)],0);assert.deepEqual(c.placed[0].homeOf,['a']);
 p('fence',24,20);const before=pack(c);
 assert.equal(run('upgrade',{id:1,kind:'hut'}).code,'NEED_MOVE');assert.equal(pack(c),before);
 assert.equal(run('move',{id:2,x:22,y:22}).code,'SEALS_OFF');assert.equal(pack(c),before);
 good(run('store',{id:2}));good(run('upgrade',{id:1,kind:'hut'}));good(run('interior',{id:1,value:'warm'}));
 good(run('assign',{id:1,npc:'b'}));assert.equal(campClimate(c,-7.5,-9,'a').beauty,1);validateCamp(c);
});
test('河道搭桥–撤桥与东岸可达性',()=>{
 const {c,run}=fixture();
 assert.equal(makeGrid(c,50).reachable(50,32),false);
 good(run('buy',{kind:'bridge'}));good(run('place',{kind:'bridge',x:45,y:32,rot:1}));
 assert.ok(makeGrid(c,50).reachable(50,32));good(run('store',{id:1}));assert.equal(makeGrid(c,50).reachable(50,32),false);
});
test('工程批处理、木料、产出、换皮和工班日结',()=>{
 const {c,run}=fixture();const forest=tile(c,T.FOREST),rock=tile(c,T.ROCK),land={x:28,y:29};
 good(run('clear',{cells:[forest]}));assert.equal(c.wood,10003);assert.equal(c.used,4);
 const before=pack(c);assert.equal(run('clear',{cells:[rock]}).code,'NO_BUDGET');assert.equal(pack(c),before);
 good(run('pave',{cells:[land],value:1}));assert.equal(c.used,4.25);assert.equal(c.wood,10002.75);
 assert.equal(makeGrid(c,50).moveCost(land.x,land.y),2);
 good(run('unpave',{cells:[land]}));assert.equal(c.wood,10002.85);
 good(run('skin',{cells:[land],value:1},{winter:true}));
 for(const op of ['clear','pave','unpave','fill','expand'])assert.equal(run(op,{cells:[land]},{winter:true}).code,'WINTER_LOCK');
 assert.equal(run('fill',{cells:[{x:46,y:32}]}).code,'TERRAIN');
 advanceCamp({camp:c,businessDay:51,cast:[],status:{},inventory:{water:0,food:0},seed:1});assert.equal(c.used,0);
});
test('两次扩岛、门槛与水域保护',()=>{
 const {c,run}=fixture();assert.equal(run('expand').code,'LOCKED');
 for(let i=0;i<12;i++){good(run('buy',{kind:'fence'}));good(run('place',{kind:'fence',x:18+i,y:24}));}
 const g=makeGrid(c,50);
 good(run('expand'));assert.equal(c.stage,1);assert.equal(c.used,9);
 assert.equal(run('expand').code,'NO_BUDGET');good(editCamp(c,51,{op:'expand'}));assert.equal(c.stage,2);
 assert.equal(editCamp(c,52,{op:'expand'}).code,'MAX_STAGE');const expanded=makeGrid(c,52);
 for(let i=0;i<4096;i++){if(g.base[i]===T.SHALLOW||i%64===46)assert.equal(expanded.base[i],g.base[i]);}
});
test('蓝图校验、确定性、可逆操作和快照',()=>{
 const {c,run}=fixture();good(run('buy',{kind:'tent'}));good(run('place',{kind:'tent',x:20,y:20}));
 good(run('undo'));assert.equal(c.placed.length,0);good(run('redo'));assert.equal(c.placed.length,1);
 const code=pack(c),copy=unpack(code);assert.equal(pack(copy),code);assert.throws(()=>unpack(code+'a'));
 assert.deepEqual(snapshot(c,50),snapshot(copy,50));
 good(editCamp(c,51,{op:'move',id:1,x:23,y:22}));good(editCamp(copy,51,{op:'move',id:1,x:23,y:22}));assert.equal(pack(c),pack(copy));
});
test('六类晚间营地事件和居住条件',()=>{
 for(const [op,kind,expected] of [['expand','','S_island_grew'],['assign','','S_new_home'],['upgrade','','S_upgrade'],['place','bridge','S_first_cross'],['place','fence','S_wall_dispute'],['none','','S_homeless']]){
   const c=newCamp();c.events=[{day:46,op,kind}];const s={camp:c,businessDay:46,status:{},cast:['a','b'],candidates:[]};
   assert.equal(campStory(s)?.sceneId,expected);assert.equal(campStory(s),null);
 }
 const {c,run}=fixture();good(run('buy',{kind:'hut'}));good(run('place',{kind:'hut',x:20,y:20}));
 good(run('assign',{id:1,npc:'a'}));good(run('assign',{id:1,npc:'b'}));assert.ok(condition(c,['a','b'],'shares_home:a,b'));assert.ok(condition(c,[],'at:bed',c.placed[0]));
});
test('围栏隔开西岸后，第二次扩岛打开南端绕行通道并改变资源点通勤',()=>{
 const c=newCamp();c.wood=1000;
 const run=(day,op,p)=>good(editCamp(c,day,{op,...p}));
 run(20,'fill',{cells:[{x:29,y:57},{x:30,y:57},{x:31,y:57}]});
 for(let y=7;y<=57;y++){run(20,'buy',{kind:'fence'});run(20,'place',{kind:'fence',x:30,y});}
 run(21,'expand',{});const before=makeGrid(c,21);assert.equal(before.reachable(12,34),false);
 run(40,'expand',{});const after=makeGrid(c,40);
 assert.ok(after.reachable(12,34));assert.ok(after.commuteFactor(12,34)>before.commuteFactor(12,34));
});
