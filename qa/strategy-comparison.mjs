import {createProduction} from '../src/production-engine.js';
import assert from 'node:assert/strict';
const act=(g,t,p={})=>{const r=g.dispatch(t,p);assert(r.ok,`${t}: ${r.message}`);};
const results=[];
for(const strategy of ['care','conflict','intervention']){
 const g=createProduction({seed:1701});act(g,'start',{mode:'standard'});for(const id of ['lin','zhou','qiao','lu','tang','chen'])act(g,'toggleCast',{id});act(g,'confirmCast');act(g,'autoBuild');
 for(let day=1;day<=7;day++){
  if(g.getState().regulation.status==='suspended'){for(const c of g.getState().cases.filter(c=>!c.corrected))act(g,'resolveCase',{id:c.id,method:'context'});act(g,'remediate');act(g,'maintenanceDay');continue;}
  act(g,'selectCommission',{id:strategy==='conflict'?'conflict':'observation',protagonistId:'lin'});
  for(const kind of ['food','water','power']){const need=(kind==='power'?3:18)-g.getState().inventory[kind];if(need>0)act(g,'supply',{kind,amount:need});}
  act(g,'startRecording');
  for(let segment=0;segment<3;segment++){
   if(strategy==='intervention')act(g,'intervene',{kind:segment%2?'interview':'group',a:'lin',b:'zhou'});
   for(const who of g.getState().cast)for(const kind of ['water','food'])act(g,'consumeService',{actorId:who,kind,facilityId:g.getState().facilities.find(f=>f.type===(kind==='water'?'water':'table')).id});
   for(const [index,part]of ['context','action','reaction','result'].entries())act(g,'observe',{event:{id:`${day}-${segment}-${index}`,sceneId:`${day}-${segment}`,sourcePart:part,sourceType:'connected',type:part==='result'?'connected':'beat',participants:['lin','zhou'],text:'同种子共同夹具：两人协作完成活动',x:0,z:1}});
   for(let i=0;i<75;i++)g.update(1);if(segment<2)act(g,'nextSegment');
  }
  act(g,'autoEdit');if(strategy==='conflict')act(g,'setTimeline',{slots:g.getState().timeline.map(t=>({...t,style:'conflict',music:'tense',clipIds:t.clipIds.filter(id=>g.getState().clips.find(c=>c.id===id).part!=='result')}))});
  act(g,'broadcast',{mode:'normal'});act(g,'nextDay');
 }
 const s=g.getState();results.push({strategy,cash:s.cash,rating:s.seasonReport.rating,trust:s.audiences.reduce((n,a)=>n+a.trust,0)/3,exits:Object.values(s.status).filter(x=>x==='left').length,cases:s.cases.length,interventionSpend:-s.ledger.filter(l=>l.label.startsWith('导演干预')).reduce((n,l)=>n+l.amount,0),episodes:s.episodes.length});
}
const dominates=(a,b)=>a.cash>=b.cash&&a.rating>=b.rating&&a.trust>=b.trust&&a.exits<=b.exits&&a.cases<=b.cases&&(a.cash>b.cash||a.rating>b.rating||a.trust>b.trust||a.exits<b.exits||a.cases<b.cases);const dominance=results.flatMap(a=>results.filter(b=>b!==a&&dominates(a,b)).map(b=>({winner:a.strategy,dominated:b.strategy})));
console.log(JSON.stringify({nonDominancePassed:dominance.length===0,dominance,seed:1701,scope:'External deterministic event fixtures, equal actual footage; no NPC motivation model or blind play. Measures economics and edit consequences, not claimed full strategy balance.',results},null,2));
