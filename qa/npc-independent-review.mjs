import { createSimulation } from '../src/npc-simulation.js';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const anchors=[[-3,1],[-1,2],[1,0],[3,2],[-2,4],[2,4]];
const actors=['lin','zhou','qiao','lu','tang','chen'].map((id,i)=>({id,name:id,anchor:anchors[i]}));
const sim=createSimulation({actors,seed:20261112});
let closest={distance:99}, overlaps=0, invalid=0;
let closestConversation={distance:99}, conversationSamples=0;
const regions={northernReadingSamples:0,southernWatchingSamples:0,minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity,minPostDistance:Infinity,minFireDistance:Infinity,minSouthPlanterDistance:Infinity};
for(let i=0;i<18000;i++) {
  sim.update(.1); const snapshot=sim.getSnapshot();
  if(snapshot.scene&&snapshot.scene.phase!=='approach') {
    const pair=snapshot.scene.participants.map(id=>snapshot.actors.find(a=>a.id===id));
    const distance=Math.hypot(pair[0].x-pair[1].x,pair[0].z-pair[1].z);conversationSamples++;
    if(distance<closestConversation.distance)closestConversation={distance,time:snapshot.time,phase:snapshot.scene.phase,ids:pair.map(a=>a.id)};
  }
  for(const actor of snapshot.actors) {
    if(!Number.isFinite(actor.x)||!Number.isFinite(actor.z)) invalid++;
    regions.minX=Math.min(regions.minX,actor.x);regions.maxX=Math.max(regions.maxX,actor.x);regions.minZ=Math.min(regions.minZ,actor.z);regions.maxZ=Math.max(regions.maxZ,actor.z);
    if(actor.activity==='read'&&actor.z<-9)regions.northernReadingSamples++;
    if(actor.activity==='watch'&&actor.z>12)regions.southernWatchingSamples++;
    for(const x of [-3.1,3.1])regions.minPostDistance=Math.min(regions.minPostDistance,Math.hypot(actor.x-x,actor.z+1.9));
    regions.minFireDistance=Math.min(regions.minFireDistance,Math.hypot(actor.x,actor.z-7));
    regions.minSouthPlanterDistance=Math.min(regions.minSouthPlanterDistance,Math.hypot(actor.x-6.7,actor.z-14.5));
  }
  for(let a=0;a<6;a++) for(let b=a+1;b<6;b++) {
    const first=snapshot.actors[a], second=snapshot.actors[b];
    const distance=Math.hypot(first.x-second.x,first.z-second.z);
    if(distance<.25) overlaps++;
    if(distance<closest.distance) closest={distance,time:snapshot.time,ids:[first.id,second.id],activities:[first.activity,second.activity]};
  }
}
const original=createSimulation({actors,seed:20261112});
for(let i=0;i<203;i++) original.update(.1);
const restored=createSimulation({actors,saved:original.serialize()});
for(let i=0;i<1500;i++){original.update(.1);restored.update(.1);}
const corruption=[];
for(const key of ['relationships','personality','route']) {
  const save=createSimulation({actors}).serialize();delete save.actors[0][key];
  let phase='construction';
  try {const candidate=createSimulation({actors,saved:save});phase='update';for(let i=0;i<300;i++) candidate.update(.1);corruption.push({key,result:'accepted-and-survived'});}
  catch(error){corruption.push({key,result:'rejected',phase,error:error.message});}
}
const source=new URL('../src/npc-simulation.js',import.meta.url);
const legacy=createSimulation({actors}).serialize();
Object.assign(legacy.facilities.find(f=>f.id==='books'),{x:3.9,z:-3,owner:'lin'});
Object.assign(legacy.actors[0],{x:3.9,z:-3,activity:'read',moving:false,destination:{kind:'facility',id:'books',activity:'read'},route:[]});
legacy.actors[0].relationships.zhou.affinity=49;legacy.actors[0].memories=[{kind:'connected',otherId:'zhou',topic:'旧岛故事',text:'周屿与旧岛故事',time:0}];
const migrated=createSimulation({actors,saved:legacy});const loaded=migrated.serialize();
for(let i=0;i<600;i++)migrated.update(.1);
const migration={booksZ:loaded.facilities.find(f=>f.id==='books').z,rerouted:loaded.actors[0].moving,affinityPreserved:loaded.actors[0].relationships.zhou.affinity===49,memoryPreserved:loaded.actors[0].memories[0].topic==='旧岛故事',rngPreserved:loaded.rng===legacy.rng,subsequentSixtySecondsCompleted:true};
const closeSource=createSimulation({actors,seed:20261112});
for(let i=0;i<2000;i++){closeSource.update(.1);if(closeSource.getActiveScene()&&closeSource.getActiveScene().phase!=='approach')break;}
const closeSave=closeSource.serialize();if(!closeSave.scene)throw new Error('Unable to create close-scene fixture');
const closePair=closeSave.scene.participants.map(id=>closeSave.actors.find(a=>a.id===id));closePair[0].x=0;closePair[1].x=.1;closePair[0].z=closePair[1].z=.6;
const closeRestore=createSimulation({actors,saved:closeSave}),closeLoaded=closeRestore.serialize();
for(let i=0;i<100;i++)closeRestore.update(.1);
const closeAfter=closeRestore.serialize(),afterPair=closeSave.scene.participants.map(id=>closeAfter.actors.find(a=>a.id===id));
const closeSceneMigration={phaseOnLoad:closeLoaded.scene?.phase,sceneIdPreserved:closeLoaded.scene?.id===closeSave.scene.id,relationsPreserved:JSON.stringify(closeLoaded.actors.map(a=>a.relationships))===JSON.stringify(closeSave.actors.map(a=>a.relationships)),completedCountUnchangedOnLoad:closeLoaded.stats.completed===closeSave.stats.completed,phaseAfterTenSeconds:closeAfter.scene?.phase,distanceAfterTenSeconds:Math.hypot(afterPair[0].x-afterPair[1].x,afterPair[0].z-afterPair[1].z)};
const result={recordedAt:new Date().toISOString(),sourceSha256:createHash('sha256').update(readFileSync(source)).digest('hex'),scope:'independent logic review; 1800 simulated seconds, not real-time browser play',seed:20261112,stats:sim.getSnapshot().stats,closest,closestConversation,conversationSamples,regions,migration,closeSceneMigration,overlapPairSamplesBelowQuarterUnit:overlaps,nonFinitePositionSamples:invalid,saveResumeIdentical:JSON.stringify(original.serialize())===JSON.stringify(restored.serialize()),corruption};
writeFileSync(new URL('./npc-independent-results.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
