import assert from 'node:assert/strict';
import test from 'node:test';
import {createSimulation} from '../src/npc-simulation.js';
import {stocks,derive,conditionTags,skills,level,practice,advanceVitals,recover,relationship,crisisEncounter,worldFor} from '../src/character-attributes.js';
const actors=['a','b','c'].map((id,i)=>({id,name:id,anchor:[i*2,1]}));
const game=saved=>createSimulation({actors,seed:123,saved});
test('旧存档迁移保留需求与关系，六段和技能完整',()=>{
 const s=game().serialize();for(const a of s.actors)delete a.attributes;
 s.actors[0].needs.hunger=72;const a=game(s).getActor('a');
 assert.equal(stocks(a).satiety,28);assert.equal(Object.keys(stocks(a)).length,10);
 for(const [key,count]of Object.entries({innate:7,habits:12,xp:8,parts:6}))assert.equal(Object.keys(a.attributes[key]).length,count);
});
test('伤病与压力可同时表现，阈值不重复触发，护理允许再次触发',()=>{
 const a=game().getActor('a');a.attributes.pain=80;a.attributes.despair=80;
 assert(advanceVitals(a,1).includes('pain'));assert(!advanceVitals(a,1).includes('pain'));
 assert(derive(a).feelings.includes('消沉'));assert(derive(a).feelings.includes('烦躁'));
 const old=structuredClone(a.relationships);recover(a);advanceVitals(a,1);a.attributes.pain=80;assert(advanceVitals(a,1).includes('pain'));assert.deepEqual(a.relationships,old);
});
test('六段受伤、温度、技能等级和活动中断',()=>{
 const sim=game(),a=sim.getActor('a');
 for(const k of Object.keys(skills)){practice(a,k,()=>.99);assert.equal(level(a,k),1);}
 a.attributes.parts.legL=0;assert(derive(a).move<=.55);a.attributes.parts.legR=0;assert(derive(a).critical);
 recover(a);assert(!derive(a).critical);const w=a.attributes.warmth;advanceVitals(a,12,worldFor('snow',true));assert(a.attributes.warmth<w);
 assert(sim.requestPractice('a','craft').ok);const save=sim.serialize(),restored=game(save);sim.update(18);restored.update(18);assert.deepEqual(sim.serialize(),restored.serialize());
 const cancelled=game(save);cancelled.endSegment();cancelled.update(1);assert.equal(cancelled.getActor('a').attributes.xp.craft,40);
});
test('稀缺事件有方向，只能夺取真实存在的一份食物',()=>{
 const sim=game(),a=sim.getActor('a'),b=sim.getActor('b'),r=a.relationships.b;
 a.attributes.innate.consc=0;r.affinity=-100;a.needs.hunger=95;a.mood='angry';b.attributes.rations=1;
 assert.equal(crisisEncounter(a,b,worldFor('island',false,0),1).kind,'ration-taken');assert.equal(b.attributes.rations,0);assert.equal(a.needs.hunger,73);
 assert.equal(crisisEncounter(a,b,worldFor('island',false,0),1),null);
 r.resourceDebt=1;assert(conditionTags(a).includes('欠物'));assert.equal(relationship(a,b).rank,'绝交');
});
test('连续30个模拟日积分，存量有界且回放一致',()=>{
 function run(){
  const a=game().getActor('a'),states=[];
  for(let day=1;day<=30;day++){
   const world=worldFor(day%3?'island':'snow',day%5===0,.5);
   for(let tick=0;tick<120;tick++){
    a.needs.thirst=(tick*3)%100;a.needs.hunger=(tick*2)%100;
    advanceVitals(a,10,world);
    if(derive(a).critical)recover(a);
    assert(Object.values(stocks(a)).every(n=>Number.isFinite(n)&&n>=0&&n<=100));
   }
   states.push(stocks(a));
  }
  return states;
 }
 assert.deepEqual(run(),run());
});
test('危重伤病接入医务，停止活动，恢复后能再次录制',async()=>{
 const {createProduction}=await import('../src/production-engine.js');
 const production=createProduction();
 const dispatch=(kind,p={})=>assert(production.dispatch(kind,p).ok,kind);
 dispatch('start',{mode:'tutorial'});let st=production.getState();
 for(const c of st.candidates.slice(0,st.castSize))dispatch('toggleCast',{id:c.id});
 dispatch('confirmCast');dispatch('autoBuild');dispatch('startRecording');st=production.getState();
 const sim=createSimulation({actors:st.cast.map(id=>({id,name:id}))});
 const a=sim.getActor(st.cast[0]);a.attributes.parts.head=0;
 dispatch('syncActors',{actors:[a],elapsed:1});assert.equal(production.getState().status[a.id],'medical');
 sim.setAvailability(a.id,false,'medical');assert(!sim.requestPractice(a.id,'cook').ok);
 sim.setAvailability(a.id,true,'available');assert(!derive(a).critical);assert(a.attributes.parts.head>=50);
});
