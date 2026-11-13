import {createProduction} from '../src/production-engine.js';
import {createProductionInterface} from '../src/production-interface.js';

// Deliberately controlled observations, not autonomous NPC play. No localStorage.
const act=(game,type,p={})=>{const result=game.dispatch(type,p);if(!result.ok)throw new Error(`${type}: ${result.message}`);return result;};
export function createStoryFixtures(){
 const snapshots=new Map();
 for(const linked of [false,true]){
  const game=createProduction({seed:43});act(game,'start',{mode:'tutorial'});
  for(const actor of game.getState().candidates.slice(0,4))act(game,'toggleCast',{id:actor.id});
  act(game,'confirmCast');act(game,'autoBuild');let sourceScene;
  for(let day=1;day<=3;day++){
   if(day===2&&!linked)snapshots.set('筹备 · 待交代2次',game.serialize());
   act(game,'startRecording');
   if(day===2&&!linked)snapshots.set('录制 · 待交代2次',game.serialize());
   for(let i=0;i<3;i++)act(game,'observe',{event:{id:`fixture-${linked}-${day}-${i}`,sceneId:`story-${day}-${i}`,resolvesSceneId:linked&&day===3&&i===0?sourceScene:null,type:'connected',participants:['lin','zhou'],text:day===1&&i===0?'林夏与周屿讨论资源分配，观众仍等待后续交代。':linked&&day===3&&i===0?'林夏与周屿明确接续先前分配话题，给出了新的结果。':'林夏与周屿完成了另一次日常合作，并非原话题的续谈。',x:0,z:1}});
   act(game,'finishRecording');const s=game.getState(),facts=s.facts.filter(f=>f.day===day);
   act(game,'setTimeline',{slots:facts.map((f,i)=>({clipIds:s.clips.filter(c=>c.eventId===f.id).map(c=>c.id),style:day===1&&i===0?'cliffhanger':'documentary',recap:false}))});
   if(day===2&&!linked)snapshots.set('后期 · 待交代2次',game.serialize());
   act(game,'broadcast',{mode:'normal'});
   if(day===1){sourceScene=game.getState().promises[0].sourceSceneIds[0];if(!linked)snapshots.set('播出 · 待交代2次',game.serialize());}
   if(day===2&&!linked)snapshots.set('播出 · 待交代1次',game.serialize());
   if(day===3){const promise=game.getState().promises[0];if(promise.closed!==linked||!!promise.expired===linked)throw new Error('真实引擎悬念状态不符合预期');snapshots.set(linked?'播出 · 明确兑现':'播出 · 逾期未解答',game.serialize());act(game,'nextDay');snapshots.set(linked?'季终 · 明确兑现':'季终 · 逾期未解答',game.serialize());}
   else act(game,'nextDay');
  }
 }
 return snapshots;
}
const snapshots=createStoryFixtures(),selector=document.querySelector('#fixture-state'),root=document.querySelector('#fixture-game');
for(const label of snapshots.keys()){const option=document.createElement('option');option.textContent=label;selector.append(option);}
let ui,production;
function select(){ui?.destroy();production=createProduction({saved:snapshots.get(selector.value)});ui=createProductionInterface({production,root,onAction:(type,payload)=>production.dispatch(type,payload)});window.__storyPreview={production,ui,snapshots};}
selector.addEventListener('change',select);select();
