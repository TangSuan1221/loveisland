import assert from 'node:assert/strict';
import {createProduction} from '../src/production-engine.js';
import {createSimulation} from '../src/npc-simulation.js';
// Independent regression of the original paused accepted-interview loss.
function start(){const p=createProduction();const act=(t,v={})=>assert(p.dispatch(t,v).ok,t);act('start');for(const id of ['lin','zhou','qiao','lu'])act('toggleCast',{id});act('confirmCast');act('autoBuild');act('startRecording');p.drainEffects();return p;}
let p=start();const before=p.getState().cash;
assert(p.dispatch('pause').ok);assert(p.dispatch('intervene',{kind:'interview',a:'lin',b:'zhou'}).ok);
assert.equal(p.getState().cash,before-450);assert.equal(p.getState().interventions.at(-1).executionState,'queued');assert.equal(p.getState().interventions.at(-1).response,undefined);assert.equal(p.drainEffects().length,0);
const queued=p.serialize();p=createProduction({saved:queued});assert.equal(p.getState().pendingInterventions.length,1);assert.equal(p.drainEffects().length,0);
assert(p.dispatch('pause').ok);const effects=p.drainEffects();assert.equal(effects.filter(e=>e.type==='interview').length,1);assert.equal(p.getState().pendingInterventions.length,0);
const sim=createSimulation({actors:p.getState().candidates.filter(c=>p.getState().cast.includes(c.id))});const reply=sim.interview(effects.find(e=>e.type==='interview').a);assert(reply.ok);
let lastEvent=0;function bridge(){for(const e of sim.getEvents()){if(e.id<=lastEvent)continue;lastEvent=e.id;const event={...e,id:`review:${e.id}`};assert(p.canCaptureEvent(event));assert(p.dispatch('observe',{event}).ok);}}
bridge();assert.equal(p.getState().facts.length,1);assert.equal(p.getState().clips.length,1);assert.equal(p.getState().clips[0].part,'context');bridge();assert.equal(p.getState().clips.length,1);p=createProduction({saved:p.serialize()});assert.equal(p.drainEffects().length,0);assert.equal(p.getState().clips.length,1);
const q=start(),cash=q.getState().cash;assert(q.dispatch('pause').ok);assert(q.dispatch('intervene',{kind:'interview',a:'lin'}).ok);assert(q.dispatch('finishRecording').ok);assert.equal(q.getState().cash,cash);assert.equal(q.getState().directorPoints,3);assert.equal(q.getState().interventions.at(-1).executionState,'cancelled');assert(!q.drainEffects().some(e=>e.type==='interview'));assert.equal(q.getState().ledger.filter(e=>e.id?.startsWith('intervention-refund-')).length,1);assert(!q.dispatch('finishRecording').ok);assert.equal(q.getState().cash,cash);
console.log('PASS: paused interview queues across reload, resumes once, real NPC context captured once; cancelled unsent command refunds once without effect');
const background=start(),event={id:'background-prune',type:'continuation-abandoned',participants:['lin','zhou'],text:'话题已过期',sourcePart:'context',x:0,z:0,thumbnail:'test-media'};assert.equal(background.canCaptureEvent(event),false);assert(background.dispatch('observe',{event}).ok);assert.equal(background.getState().clips.length,0);assert.equal(background.getState().facts[0].thumbnail,null);
const legacy=background.serialize();delete legacy.pendingInterventions;const migrated=createProduction({saved:legacy});assert.deepEqual(migrated.getState().pendingInterventions,[]);
console.log('PASS: background abandonment archives without film/thumbnail; missing queue field migrates safely');
