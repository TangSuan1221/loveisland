import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createProduction} from '../src/production-engine.js';
import {createSimulation} from '../src/npc-simulation.js';
import {createNavigation} from '../src/production-navigation.js';
const act=(p,t,v={})=>{const r=p.dispatch(t,v);assert(r.ok,`${t}: ${r.message} (${p.getState().phase})`);};
const prep=p=>{for(const c of p.getState().candidates.slice(0,6))act(p,'toggleCast',{id:c.id});act(p,'confirmCast');act(p,'autoBuild');};
// Growth is explicitly an external footage fixture, not an autonomous NPC campaign.
// All contracts, supply/service costs, recording clocks, seasons and unlocks use public APIs.
const growth=createProduction({seed:481});act(growth,'start',{mode:'standard'});let serial=0;const growthSeasons=[];
for(let season=0;season<20;season++){
 prep(growth);
 for(let day=0;day<7;day++){
  for(const kind of ['food','water','power']){const need=(kind==='power'?3:18)-growth.getState().inventory[kind];if(need>0)act(growth,'supply',{kind,amount:need});}act(growth,'startRecording');
  for(let segment=0;segment<3;segment++){const s=growth.getState();for(const actorId of s.cast)for(const kind of ['food','water'])act(growth,'consumeService',{actorId,kind,facilityId:s.facilities.find(f=>f.type===(kind==='food'?'table':'water')).id});for(let j=0;j<3;j++)act(growth,'observe',{event:{id:`growth-fixture-${serial++}`,type:'connected',participants:['lin','zhou'],text:'外部成长夹具：真实事件接口的合作场景样本',x:0,z:1}});for(let t=0;t<growth.getState().segmentBaseDuration;t++)growth.update(1);}
  act(growth,'finishRecording');act(growth,'autoEdit');act(growth,'broadcast',{mode:'normal'});act(growth,'nextDay');
 }
 const s=growth.getState();growthSeasons.push({season:s.season,cash:s.cash,experience:s.experience,reputation:s.reputation});if(s.cash>=180000&&s.experience>=140&&s.reputation>=65)break;act(growth,'nextSeason');
}
assert.equal(growth.getState().phase,'season');assert(growth.getState().cash>=150000);const base=growth.serialize(),reports=[];
for(const mapId of ['snow','villa']){
 const p=createProduction({saved:base});act(p,'unlockMap',{id:mapId});act(p,'nextSeason');act(p,'selectMap',{id:mapId});prep(p);
 if(mapId==='villa'){const fire=p.getState().facilities.find(f=>f.type==='fire');act(p,'remove',{id:fire.id});act(p,'place',{type:'privacy',x:0,z:7});}
 const st=p.getState(),sim=createSimulation({seed:482,actors:st.cast.map((id,i)=>({...st.candidates.find(c=>c.id===id),anchor:[(i%3-1)*2,Math.floor(i/3)*2+1]}))});sim.setLayout(st.facilities,createNavigation(st.facilities));sim.setServiceHandler(request=>p.dispatch('consumeService',request));sim.setProductionRules({day:st.day,rule:st.publicRules?.water});let last=0,warmFrames=0,coldFrames=0,privateFrames=0,privateMinimum=100,privateEvents=0,medicalEntries=0,powerConsumed=0,privateLeaks=0;const days=[];
 const observe=()=>{for(const event of sim.getEvents()){if(event.id<=last)continue;last=event.id;const id=`${mapId}-real-${event.id}`;p.dispatch('observe',{event:{...event,id}});if(event.type!=='interview'&&p.getRuntime().facilities.some(f=>f.type==='privacy'&&Math.hypot(f.x-event.x,f.z-event.z)<2)){privateEvents++;const fact=p.getState().facts.find(f=>f.sourceId===id);if(fact&&p.getState().clips.some(c=>c.eventId===fact.id))privateLeaks++;}}};
 const effects=()=>{for(const e of p.drainEffects()){if(e.type==='public-rule')sim.setProductionRules({day:p.getState().day,rule:e.rule});if(e.type==='public-reward')sim.applyPublicReward(e);if(e.type==='contest-reward')sim.onContestReward(e);if(e.type==='checkpoint'||e.type==='recording-stop'){sim.endSegment();observe();}if(e.type==='health-status'){sim.setAvailability(e.id,e.status==='available');if(e.status==='medical')medicalEntries++;}if(e.type==='environment-state'){const a=sim.getActor(e.id);a.needs.environment=e.environment;a.needs.privacy=e.privacy;if(mapId==='snow'){if(e.warm)warmFrames++;else coldFrames++;}else if(p.getRuntime().facilities.some(f=>f.type==='privacy'&&Math.hypot(f.x-a.x,f.z-a.z)<3)){privateFrames++;privateMinimum=Math.min(privateMinimum,e.privacy);}}if(e.type==='day-start')sim.setProductionRules({day:p.getState().day,rule:p.getState().publicRules?.water});if(e.type==='day-start')for(const id of p.getState().cast){const a=sim.getActor(id);a.needs.energy=Math.max(15,a.needs.energy-45);a.needs.hunger=Math.max(20,a.needs.hunger-35);for(const key of ['thirst','environment','privacy'])a.needs[key]=Math.max(10,(a.needs[key]||0)-40);sim.setAvailability(id,p.getState().status[id]==='available');}}};effects();
 for(let day=0;day<7;day++){
  for(const kind of ['food','water','power']){const need=(kind==='power'?(mapId==='snow'?21:6):18)-p.getState().inventory[kind];if(need>0)act(p,'supply',{kind,amount:need});}
  const start=p.dispatch('startRecording');if(!start.ok){act(p,'maintenanceDay');effects();days.push({day:day+1,exit:'maintenance',reason:start.message});continue;}
  let steps=0;while(p.getRuntime().phase==='recording'){const s=p.getRuntime();sim.update(1);observe();p.dispatch('syncActors',{actors:sim.getSnapshot().actors,elapsed:1});const before=p.getRuntime().inventory.power;p.update(1);powerConsumed+=before-p.getRuntime().inventory.power;effects();assert(++steps<900);if(steps>=s.segmentBaseDuration*3){act(p,'finishRecording');effects();}}
  p.dispatch('autoEdit');const preview=p.getState().preview;act(p,'broadcast',{mode:preview?.validNormal?'normal':preview?.validRescue?'rescue':'skip'});days.push({day:day+1,exit:p.getState().lastBroadcast.mode,revenue:p.getState().lastBroadcast.revenue});act(p,'nextDay');effects();
 }
 const end=p.getState();assert.equal(end.phase,'season');assert.equal(end.cash,end.initialCash+end.ledger.reduce((n,l)=>n+l.amount,0));assert.equal(privateLeaks,0);if(mapId==='snow'){assert(warmFrames>0&&coldFrames>0);assert(powerConsumed>0);}else {assert(privateFrames>0,'real actors reached privacy recovery area');assert(privateMinimum<82,'actual privacy activity lowers villa pressure');}
 reports.push({map:mapId,phase:end.phase,cash:end.cash,days,warmFrames,coldFrames,medicalEntries,powerConsumed,privateFrames,privateMinimum,privateEvents,privateLeaks,privacyCameraEvidence:privateEvents?'real private-area events had no film':'No event occurred within 2m camera exclusion; geometry policy not empirically exercised by this seed.',medicalExitEvidence:medicalEntries?'actual medical entries plus seven-day delivery/maintenance exits':'no medical transition this seed; pressure exercised only'});
}
const hashes=Object.fromEntries(['src/production-engine.js','src/npc-simulation.js'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));const report={result:'PASS',adapter:'Full candidate definitions, production calendar and browser overnight recovery; old simplified social-distribution evidence superseded',scope:'Growth: external observed-event fixtures with legal public economy APIs, no cash/xp injection. Each map season: actual NPC events, facilities, services, environment feedback and health. Not browser or real player completion.',hashes,growthSeasons,reports};writeFileSync('qa/production-maps-integration-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
