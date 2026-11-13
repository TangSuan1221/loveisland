// Free-life recording: the shoot is never cut by a timer, guests keep living
// across time-of-day changes, and acquaintance carries over between days.
import assert from 'node:assert/strict';
import {createProduction} from '../src/production-engine.js';
import {createSimulation} from '../src/npc-simulation.js';
import {createNavigation} from '../src/production-navigation.js';

const p=createProduction({seed:1937});
const act=(t,v={})=>{const r=p.dispatch(t,v);assert(r.ok,`${t}: ${r.message}`);return r;};
act('start',{mode:'tutorial'});let s=p.getState();for(const c of s.candidates.slice(0,s.castSize))act('toggleCast',{id:c.id});act('confirmCast');act('autoBuild');s=p.getState();
const sim=createSimulation({actors:s.cast.map((id,i)=>({...s.candidates.find(c=>c.id===id),anchor:[(i%3-1)*2,Math.floor(i/3)*2+1]})),seed:1938});
sim.setLayout(s.facilities,createNavigation(s.facilities));sim.setServiceHandler(r=>p.dispatch('consumeService',r));sim.setProductionRules({day:1});
let last=0;const greetings=[];
const observe=()=>{for(const e of sim.getEvents()){if(e.id<=last)continue;last=e.id;if(e.type==='dialogue'&&e.text.includes('我们还没好好认识过'))greetings.push({day:p.getState().day,pair:[...e.participants].sort().join('+')});p.dispatch('observe',{event:{...e,id:`free-${e.id}`}});}};
const effects=()=>{for(const e of p.drainEffects()){if(e.type==='recording-stop'){sim.endSegment();observe();}if(e.type==='day-start'){sim.setProductionRules({day:p.getState().day});}}};
const perDay=[];
for(let day=0;day<3;day++){
 for(const kind of ['food','water','power']){const st=p.getState(),need=kind==='power'?6:st.cast.length*4;if(st.inventory[kind]<need)act('supply',{kind,amount:need-st.inventory[kind]});}
 act('startRecording');effects();const before=sim.getSnapshot().stats.completed;
 const minutes=6;for(let t=0;t<minutes*60;t++){sim.update(1);observe();p.dispatch('syncActors',{actors:sim.getSnapshot().actors,elapsed:1});p.update(1);effects();
  const rt=p.getRuntime();assert.equal(rt.phase,'recording','recording only ends when the producer chooses');assert.equal(rt.paused,false,'period change never pauses');}
 const completed=sim.getSnapshot().stats.completed-before,periods=p.getState().segment;
 act('finishRecording');effects();
 const r=p.dispatch('autoEdit');let b=p.dispatch('broadcast',{mode:r.ok?'normal':'rescue'});if(!b.ok)b=p.dispatch('broadcast',{mode:'skip'});assert(b.ok);
 perDay.push({day:day+1,completedInteractions:completed,periodsPassed:periods,clips:p.getState().clips.filter(c=>c.day===day+1).length});
 act('nextDay');effects();
}
assert(perDay.every(d=>d.completedInteractions>0),'guests complete interactions every day');
assert(perDay[0].periodsPassed>=3,'time of day advanced without stopping recording');
const firstMeet={};for(const g of greetings){firstMeet[g.pair]??=[];firstMeet[g.pair].push(g.day);}
assert(Object.keys(firstMeet).length>0,'first meetings are greeted as strangers once');
const repeated=Object.entries(firstMeet).filter(([,days])=>days.length>1);
assert.equal(repeated.length,0,`pairs re-introduced themselves: ${JSON.stringify(repeated)}`);
console.log(JSON.stringify({result:'PASS',perDay,firstMeetings:Object.keys(firstMeet).length},null,2));
