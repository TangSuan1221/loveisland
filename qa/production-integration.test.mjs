import assert from 'node:assert/strict';
import {createProduction} from '../src/production-engine.js';
import {createSimulation} from '../src/npc-simulation.js';
import {createNavigation} from '../src/production-navigation.js';
import {writeFileSync} from 'node:fs';
const reports=[];
for(const mode of ['tutorial','standard']){
const p=createProduction({seed:1937});
const act=(t,v={})=>{const r=p.dispatch(t,v);assert(r.ok,`${mode} ${t}: ${r.message}`);};
act('start',{mode});let s=p.getState();for(const c of s.candidates.slice(0,s.castSize))act('toggleCast',{id:c.id});act('confirmCast');act('autoBuild');s=p.getState();
const sim=createSimulation({actors:s.cast.map((id,i)=>({...s.candidates.find(c=>c.id===id),anchor:[(i%3-1)*2,Math.floor(i/3)*2+1]})),seed:1938});
sim.setLayout(s.facilities,createNavigation(s.facilities));sim.setServiceHandler(request=>p.dispatch('consumeService',request));sim.setProductionRules({day:s.day,rule:s.publicRules?.water});let last=0;const types={};
const observe=()=>{for(const e of sim.getEvents()){if(e.id<=last)continue;last=e.id;types[e.type]=(types[e.type]||0)+1;p.dispatch('observe',{event:{...e,id:`real-${e.id}`}});}};
const effects=()=>{for(const e of p.drainEffects()){if(e.type==='public-rule')sim.setProductionRules({day:p.getState().day,rule:e.rule});if(e.type==='public-reward')sim.applyPublicReward(e);if(e.type==='contest-reward')sim.onContestReward(e);if(e.type==='environment-state'){const a=sim.getActor(e.id);if(a){a.needs.environment=e.environment;a.needs.privacy=e.privacy;}}if(e.type==='feedback')sim.teachTopic(e.a,e.text);if(e.type==='support'&&e.kind==='rest'){const a=sim.getActor(e.id);if(a)for(const k of ['energy','hunger','thirst','environment','privacy'])a.needs[k]=Math.max(10,(a.needs[k]||0)-35);}if(e.type==='mole-task'||e.type==='contest-request'){const r=sim.requestDirectorTask({...e,kind:e.type==='contest-request'?'contest':'mole-task'});p.dispatch('reportIntervention',{message:r.reason,accepted:r.ok});observe();}
 if(e.type==='checkpoint'||e.type==='recording-stop'){sim.endSegment();observe();}if(e.type==='health-status')sim.setAvailability(e.id,e.status==='available');if(e.type==='day-start'){sim.setProductionRules({day:p.getState().day,rule:p.getState().publicRules?.water});for(const id of p.getState().cast){const a=sim.getActor(id);a.needs.energy=Math.max(15,a.needs.energy-45);a.needs.hunger=Math.max(20,a.needs.hunger-35);for(const k of ['thirst','environment','privacy'])a.needs[k]=Math.max(10,(a.needs[k]||0)-40);sim.setAvailability(id,p.getState().status[id]==='available');}}}};
effects();const days=[];
for(let d=0;d<s.seasonDays;d++){
for(const kind of ['food','water','power']){const st=p.getState(),need=kind==='power'?3:st.cast.length*3;if(st.inventory[kind]<need)act('supply',{kind,amount:need-st.inventory[kind]});}act('startRecording');effects();
let steps=0;
while(p.getState().phase==='recording'){
 const st=p.getState();
 sim.update(1);observe();p.dispatch('syncActors',{actors:sim.getSnapshot().actors,elapsed:1});p.update(1);effects();assert(++steps<900,'recording terminates');if(steps>=st.segmentBaseDuration*3){act('finishRecording');effects();}
}
assert.equal(p.getState().phase,'editing');let r=p.dispatch('autoEdit');let broadcast=p.dispatch('broadcast',{mode:r.ok?'normal':'rescue'});if(!broadcast.ok)broadcast=p.dispatch('broadcast',{mode:'skip'});assert(broadcast.ok);const day=p.getState();days.push({day:day.day,facts:day.facts.filter(f=>f.day===day.day).length,mode:day.lastBroadcast.mode,revenue:day.lastBroadcast.revenue,cash:day.cash});act('nextDay');effects();
}
s=p.getState();assert.equal(s.phase,'season');assert.equal(s.episodes.length,s.seasonDays);assert.equal(s.cash,s.initialCash+s.ledger.reduce((v,t)=>v+t.amount,0));assert(sim.getSnapshot().stats.completed>0,'actual autonomous social scenes completed');assert(types.routine>0,'placed facilities used');assert(s.episodes.some(e=>e.mode!=='skip'),'actual material broadcast');
reports.push({adapter:'candidate metadata + actual production day + browser overnight recovery; pre-fix shallow-only result INVALID as gameplay evidence',mode,days,types,phase:s.phase,cash:s.cash,npcStats:sim.getSnapshot().stats});
}
writeFileSync('qa/production-integration-results.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
