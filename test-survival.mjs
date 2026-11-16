import assert from 'node:assert/strict';
import { World, DATA } from './packages/sim-core/src/index.ts';
import { arbitrate } from './packages/sim-core/src/arbiter.ts';
import { survivalTick, sceneActors, zeroDamage } from './packages/sim-core/src/needs.ts';
import './tools/check-tiers.mjs';

function setup(seed=1){
  const w=new World({seed,days:60,npcCount:4});
  for(const n of w.alive){
    for(const k of Object.keys(n.stocks))n.stocks[k]=85;
    survivalTick(w,n);
  }
  return [w,w.npcs[0]];
}
const tests=[];
function check(name,f){tests.push([name,f])}
check('A1 重度缺水',()=>{
  for(let i=0;i<100;i++){const [w,n]=setup(i);n.stocks.Hydration=8;survivalTick(w,n);assert.equal(n.survival.tier,'M84')}
  const [w,actor]=setup();
  w.tick=10;w.store.food=0;actor.stocks.Satiety=0;actor.job='food';actor.sleeping=false;
  const patch=w.sites.find(site=>site.resource==='food' && site.state==='known');
  const stock=patch.stock;
  survivalTick(w,actor);
  assert.equal(actor.survival.tier,'M96');assert.equal(actor.survival.behavior,'SeekFood');
  assert.ok(patch.stock<stock && actor.stocks.Satiety>0);assert.equal(w.store.food,0);
  return '100/100 M84；空仓采集从已知点位扣除食物';
});
check('A2 危机拒绝改派',()=>{
  const [w,n]=setup();n.stocks.Hydration=0;survivalTick(w,n);assert.equal(n.survival.tier,'M96');
  assert.equal(w.applyCommand({type:'assignJob',npcId:n.id,job:'food'}).reason,'survival');
  n.stocks.Health=9;survivalTick(w,n);assert.equal(n.survival.tier,'M99');
  const before=n.stocks.Health;n.stocks.Hydration=0;zeroDamage(w,n);
  assert.equal(before-n.stocks.Health,1.5);
  n.stocks.Health=0;w.checkDeaths();assert.equal(n.alive,false);assert.equal(w.griefDays,3);
  assert.ok(w.alive.every(p=>p.memories.some(m=>m.id==='M60:Mourn:'+n.id)));
  return 'M96 / M99；每小时损失 1.5 健康；哀悼三天';
});
check('A3 双重危机按同档分选择',()=>{
  const [w,n]=setup();n.stocks.Hydration=8;n.stocks.Satiety=15;w.store.rot=1;n.traits.consc=0;n.traits.neuro=0;
  survivalTick(w,n);assert.equal(n.survival.behavior,'EatRot');
  const active={id:'food',tierId:'M84',act:8.4,run:8.4,score:1,tag:'food'};
  const other={...active,id:'water',score:1.14};
  for(let minute=0;minute<30;minute++)assert.equal(arbitrate([other],active).chosen,active);
  assert.equal(arbitrate([{...other,score:1.16}],active).chosen.id,'water');
  return 'EatRot / 30 次同档复核无抖动';
});
check('A4 性格影响讨食',()=>{
  const counts=[0,0];
  for(const grit of [0,1])for(let seed=1;seed<=20;seed++){
    const [w,n]=setup(seed);n.stocks.Satiety=25;n.traits.grit=grit;w.relOf(0,1).bond=200;
    w.npc(1).survival.effects.Ration=1;survivalTick(w,n);counts[grit]+=Number(n.survival.behavior==='BegFood');
  }
  assert.ok(counts[0]-counts[1]>=6);return counts.join(' vs ');
});
check('A5 无可用手段',()=>{
  const [w,n]=setup();n.stocks.Satiety=12;survivalTick(w,n);assert.equal(n.survival.tier,'M02');
  assert.equal(n.survival.retryAt,w.tick*60+1);
  w.store.rot=1;survivalTick(w,n,n.survival.retryAt);
  assert.equal(n.survival.behavior,'EatRot');assert.equal(w.store.rot,0);
  return 'M02 / 第一分钟发现腐食并消耗';
});
check('A6 技能门',()=>{
  const [w,n]=setup();w.fireActive=true;n.stocks.Hydration=15;n.skills={Fire:3};
  survivalTick(w,n);assert.notEqual(n.survival.behavior,'BoilWater');n.skills.Fire=4;
  survivalTick(w,n);assert.equal(n.survival.behavior,'BoilWater');return '3 禁止 / 4 烧水';
});
check('A7 求助关系门',()=>{
  const [w,n]=setup();w.store.food=0;n.stocks.Satiety=25;w.npc(1).survival.effects.Ration=1;
  w.relOf(0,1).bond=119;survivalTick(w,n);assert.notEqual(n.survival.behavior,'BegFood');
  w.relOf(0,1).bond=120;survivalTick(w,n);assert.equal(n.survival.behavior,'BegFood');return '119 禁止 / 120 允许';
});
check('A8 拒绝后不再向同一人讨食',()=>{
  const [w,n]=setup();w.store.food=0;n.stocks.Satiety=25;n.traits.grit=1;w.npc(1).traits.agree=0;
  w.npc(1).survival.effects.Ration=1;w.relOf(0,1).bond=200;survivalTick(w,n);
  assert.equal(n.survival.cooldown.ask1,w.tick*60+30);survivalTick(w,n);assert.notEqual(n.survival.behavior,'BegFood');return '30 游戏分钟';
});
check('A9 饥荒禁止闲暇演出，产生冲突',()=>{
  const [w]=setup();w.rationHistory.push({res:'food',ratio:0,tick:0});assert.equal(sceneActors(w,'Cloth').length,0);
  const crisis=new World({seed:20260101,days:60,workforceScale:0.3});crisis.run();
  const fights=crisis.sceneLog.filter(s=>s.cat==='Fight');assert.ok(fights.length>0);return 'M60 候选 0 / Fight '+fights.length;
});
check('A10 高分不能跨档',()=>{
  const high={id:'group',tierId:'M94',act:9.4,run:9.4,score:1,tag:'group'};
  const low={...high,id:'eat',tierId:'M84',act:8.4,run:8.4,score:100};assert.equal(arbitrate([low],high).chosen,high);return 'M94';
});
check('A11 档位引用',()=>{assert.equal(new Set(DATA.aiPriority.map(t=>t.id)).size,33);return '33/33'});
check('A12 连续 60 天无抖动',()=>{
  const w=new World({seed:777,days:60});let peak=0;let last=new Map(),daily=new Map();
  while(!w.isOver){if(w.hour===0)daily=new Map();w.tickOnce();for(const n of w.alive){
    if(last.has(n.id)&&last.get(n.id)!==n.survival?.tier)daily.set(n.id,(daily.get(n.id)??0)+1);
    last.set(n.id,n.survival?.tier);peak=Math.max(peak,daily.get(n.id)??0);
  }}assert.ok(peak<=40);return '每日最多 '+peak+' 次';
});
let passed=0;
for(const [name,f] of tests){try{console.log(name, f());passed++}catch(e){console.error(name,e.message)}}
console.log(passed+'/'+tests.length);if(passed!==tests.length)process.exitCode=1;
