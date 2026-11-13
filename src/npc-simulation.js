// Original, deterministic behavioural approximation; not Nintendo source or algorithms.
// Inspected flat-ground routes connect the clearing, northern benches and
// south-east lookout. The raised deck, hill, stream and dock are excluded.
export const NPC_SAVE_VERSION = 1;
export const NPC_EVENT_TEMPLATES = [
 ['chat','闲谈','社交需要'],['share','共同兴趣','共享兴趣'],['play','一起活动','可用精力'],['argue','意见分歧','直接程度差异'],['apologize','关系修复','双方已有分歧'],
 ['alliance','结伴','信任与熟悉基础'],['confess','表白','吸引基础且双方允许恋爱'],['question','询问旧事','已知前任关系或亲历分歧'],['help','关怀','对方疲惫或饥饿'],['boundary','表达边界','隐私缺口'],['collaborate','共同创作','共同兴趣及长期目标'],['complain','现场诉求','亲历服务失败'],
 ['resource-share','分享饮水','真实水站空闲与对方口渴'],['borrow','借用物品','对方持有自己的物品且已有信任'],['return-item','归还借物','自己持有对方借出的物品'],['comfort','安慰','对方可观察到难过或愤怒'],['clarify-belief','澄清误会','本人有明确来源的主观判断'],['missed-promise','失约沟通','双方已有逾期未履行约定'],['celebrate','庆祝进展','本人达成未庆祝的目标里程碑'],['mediate','调停提议','本人亲眼见过对方与第三人的争执'],
 ['queue-yield','让位','关系偏好或对方更急'],['queue-argue','争执','双方坚持'],['queue-apology','道歉回队','后到者改变计划'],['queue-avoid','回避','先到者避开公开冲突']
].map(([id,name,precondition])=>({id,name,precondition}));
const EXPANDED_KINDS=['resource-share','borrow','return-item','comfort','clarify-belief','missed-promise','celebrate','mediate'];
const STEP = .1;
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const clone = v => JSON.parse(JSON.stringify(v));
const LABELS = {contest:'公开节拍挑战','mole-task':'提出指定问题','resource-share':'分享饮水',borrow:'借用物品','return-item':'归还借物',comfort:'安慰对方','clarify-belief':'澄清误会','missed-promise':'谈谈失约',celebrate:'庆祝进展',mediate:'尝试调停',queue:'等候饮水',alliance:'商量结伴',confess:'表达好感',question:'确认旧事',help:'关心对方',boundary:'表达边界',collaborate:'一起准备作品',complain:'提出诉求',warm:'靠近暖炉取暖',idle:'看看周围',walk:'散步',eat:'享用点心',drink:'喝水',rest:'歇一会儿',read:'安静阅读',sing:'哼唱旋律',exercise:'伸展身体',watch:'欣赏海风',chat:'聊聊近况',share:'分享兴趣',argue:'意见不合',apologize:'尝试和好',play:'一起跳舞'};
const SPOTS = [
 {id:'snack',x:4.65,z:2,activity:'eat',need:'hunger',gesture:'eat'},
 {id:'water',x:-5.25,z:-1,activity:'drink',need:'hunger',gesture:'eat'},
 {id:'quiet',x:-3.9,z:-3,activity:'rest',need:'energy',gesture:'rest'},
 {id:'books',x:-1.2,z:-10.3,activity:'read',need:'fun',gesture:'read',place:'北侧长椅前'},
 {id:'music',x:1.5,z:4.7,activity:'sing',need:'fun',gesture:'dance'},
 {id:'stretch',x:-2.2,z:3.1,activity:'exercise',need:'fun',gesture:'exercise'},
 {id:'breeze',x:8.1,z:13.1,activity:'watch',need:'energy',gesture:'rest',place:'东南海风望台前'}
];
// Nodes avoid the well (-7,-1), table (7,2), fire (0,7), cameras and stream.
const NODES = [[0,-2],[0,1],[0,3],[-3,-2],[3,-2],[-3,1],[3,1],[-2,3],[2,3],[.5,-5],[0,-8],[0,-10],[4,5],[4,9],[4,13],[8,13.1]];
const EDGES = [[0,1],[1,2],[0,3],[0,4],[1,5],[1,6],[2,7],[2,8],[3,5],[4,6],[5,7],[6,8],[0,9],[9,10],[10,11],[6,12],[12,13],[13,14],[14,15]];
const PRESETS = [
 {sociability:.9,energy:.75,directness:.42,kindness:.8,quirkiness:.75,interests:['合照','甜点']},
 {sociability:.58,energy:.95,directness:.68,kindness:.62,quirkiness:.3,interests:['户外','摄影']},
 {sociability:.7,energy:.62,directness:.55,kindness:.68,quirkiness:.95,interests:['音乐','故事']},
 {sociability:.28,energy:.4,directness:.8,kindness:.55,quirkiness:.38,interests:['阅读','故事']},
 {sociability:.8,energy:.58,directness:.3,kindness:.95,quirkiness:.5,interests:['甜点','音乐']},
 {sociability:.5,energy:.78,directness:.75,kindness:.55,quirkiness:.85,interests:['摄影','户外']}
];
// Original classification and thresholds, not the game's undisclosed formula.
const TYPES=['静谧思考者','温柔记录者','清醒观察者','耐心倾听者','独行探索者','悠闲收藏者','果断实践者','安稳陪伴者','灵感漫游者','热心讲述者','直率创作者','善意协调者','活力冒险家','快乐召集者','爽朗挑战者','暖心行动派'];
function personalityFor(index){const p=clone(PRESETS[index%PRESETS.length]);const code=(p.sociability>=.6?8:0)+(p.energy>=.65?4:0)+(p.directness>=.6?2:0)+(p.kindness>=.65?1:0);return {...p,type:TYPES[code],typeIndex:code,quirk:['见面先挥手','先看看天气','随口哼旋律','先听再说','想分享点心','留意新角度'][index%6]};}
const nearest = p => NODES.reduce((best,n,i) => Math.hypot(p.x-n[0],p.z-n[1]) < Math.hypot(p.x-NODES[best][0],p.z-NODES[best][1]) ? i : best,0);
function defaultRoute(from,to) {
 const start=nearest(from),end=nearest(to),q=[start],prev=new Map([[start,null]]);
 while(q.length){const n=q.shift();if(n===end)break;for(const e of EDGES){const next=e[0]===n?e[1]:e[1]===n?e[0]:null;if(next!==null&&!prev.has(next)){prev.set(next,n);q.push(next);}}}
 const ids=[];for(let n=end;n!==null;n=prev.get(n))ids.unshift(n);
 return [...ids.map(i=>({x:NODES[i][0],z:NODES[i][1]})),{x:to.x,z:to.z}];
}
export function createSimulation({actors:definitions,seed=1937,saved=null}={}) {
 let layout=null,serviceHandler=null;const route=(a,b)=>layout?layout.navigation.path(a,b):defaultRoute(a,b);
 if(!Array.isArray(definitions)||definitions.length<2||new Set(definitions.map(a=>a.id)).size!==definitions.length)throw new Error('At least two uniquely identified actors are required');
 let state={version:NPC_SAVE_VERSION,time:0,accumulator:0,rng:seed>>>0||1,eventId:0,scene:null,events:[],stats:{completed:0,rejected:0,invitations:0,activities:{}},facilities:SPOTS.map(s=>({...s,owner:null})),actors:definitions.map((a,i)=>({id:a.id,name:a.name,x:a.anchor?.[0]??0,z:a.anchor?.[1]??0,facing:0,moving:false,activity:'idle',label:LABELS.idle,mood:'calm',gesture:'rest',speech:'',needs:{hunger:30+i*6,energy:22+i*5,social:58+i*3,fun:35+i*4},personality:personalityFor(Math.max(0,['lin','zhou','qiao','lu','tang','chen'].indexOf(a.avatarId||a.id))),relationships:Object.fromEntries(definitions.filter(b=>a.id!==b.id).map(b=>[b.id,{affinity:0,trust:0,familiarity:0,lastInteraction:-999,cooldown:0}])),memories:[],topics:[],preferences:{},route:[],destination:null,timer:2+i*1.2,cooldown:0,lastActivity:null}))};
 if(saved){
  const candidate=typeof saved==='string'?JSON.parse(saved):clone(saved);
  const valid=candidate.version===NPC_SAVE_VERSION && candidate.actors?.length===definitions.length && candidate.actors.every(a=>definitions.some(d=>d.id===a.id)&&['x','z','facing','timer'].every(k=>Number.isFinite(a[k]))&&Object.values(a.needs||{}).length>=4&&Object.values(a.needs).every(Number.isFinite)) && Array.isArray(candidate.facilities)&&(candidate.productionLayout || candidate.facilities.length===SPOTS.length) && Number.isFinite(candidate.time)&&Number.isFinite(candidate.rng);
  const ids=definitions.map(a=>a.id);
  const structurallyValid=valid && new Set(candidate.actors.map(a=>a.id)).size===ids.length && Number.isFinite(candidate.accumulator) && Number.isFinite(candidate.eventId) && Array.isArray(candidate.events) && candidate.events.length<=60 && candidate.stats && Number.isFinite(candidate.stats.completed) && candidate.stats.activities && candidate.actors.every(a=>
   Array.isArray(a.route)&&a.route.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)) && Array.isArray(a.memories)&&a.memories.length<=16 && Array.isArray(a.topics)&&a.topics.length<=8&&a.topics.every(t=>typeof t==='string'&&t.length<=32) && a.preferences && a.personality && ['sociability','energy','directness','kindness','quirkiness'].every(k=>Number.isFinite(a.personality[k])) && Array.isArray(a.personality.interests) && ids.filter(id=>id!==a.id).every(id=>a.relationships?.[id]&&['affinity','trust','familiarity','lastInteraction','cooldown'].every(k=>Number.isFinite(a.relationships[id][k])))) && candidate.facilities.every((f,i)=>(candidate.productionLayout || f.id===SPOTS[i].id)&&(f.owner===null||ids.includes(f.owner))) && (candidate.scene===null || (Array.isArray(candidate.scene?.participants)&&candidate.scene.participants.length===2&&new Set(candidate.scene.participants).size===2&&candidate.scene.participants.every(id=>ids.includes(id))&&Number.isFinite(candidate.scene.elapsed)));
  if(!structurallyValid)throw new Error('Incompatible NPC save');
  if(candidate.queues&&Object.values(candidate.queues).some(q=>!Array.isArray(q.entries)||q.entries.some(e=>!ids.includes(e.id)||!Number.isFinite(e.since))||new Set(q.entries.map(e=>e.id)).size!==q.entries.length))throw new Error('Incompatible NPC queue save');
  if(candidate.resourceScene&&(!Array.isArray(candidate.resourceScene.participants)||candidate.resourceScene.participants.length!==2||candidate.resourceScene.participants.some(id=>!ids.includes(id))||!Number.isFinite(candidate.resourceScene.elapsed)||!['queue-yield','queue-argue','queue-apology','queue-avoid'].includes(candidate.resourceScene.branch)))throw new Error('Incompatible NPC queue scene');
  if(candidate.actors.some(a=>Object.values(a.relationships).some(r=>['attraction','resentment'].some(k=>r[k]!==undefined&&!Number.isFinite(r[k])))||a.goal&&!Number.isFinite(a.goal.progress)||a.knowledge&&(!Array.isArray(a.knowledge)||a.knowledge.length>64)))throw new Error('Incompatible NPC relationship save');
  if(candidate.items&&(!Array.isArray(candidate.items)||candidate.items.some(i=>![...ids,...Object.keys(candidate.alumni||{})].includes(i.ownerId)||![...ids,...Object.keys(candidate.alumni||{})].includes(i.holderId)||!Number.isFinite(i.borrowedAt))||new Set(candidate.items.map(i=>i.id)).size!==candidate.items.length))throw new Error('Incompatible NPC item save');
  if(candidate.commitments&&(!Array.isArray(candidate.commitments)||candidate.commitments.some(v=>!Array.isArray(v.participants)||v.participants.length!==2||v.participants.some(id=>![...ids,...Object.keys(candidate.alumni||{})].includes(id))||!Number.isFinite(v.dueDay))))throw new Error('Incompatible NPC commitment save');
  if(candidate.pendingConversations&&(!Array.isArray(candidate.pendingConversations)||candidate.pendingConversations.some(p=>!Array.isArray(p.participants)||p.participants.length!==2||p.participants.some(id=>!ids.includes(id))||typeof p.originalSceneId!=='string'||typeof p.topic!=='string'||!Number.isFinite(p.createdDay))))throw new Error('Incompatible pending conversation save');
  state=candidate;
  // Coordinate-only migration retains relationship memories and RNG state.
  for(let i=0;!state.productionLayout&&i<SPOTS.length;i++){
   const old=state.facilities[i],next=SPOTS[i],moved=old.x!==next.x||old.z!==next.z;
   Object.assign(old,next);
   if(moved)for(const a of state.actors)if(a.destination?.kind==='facility'&&a.destination.id===next.id){a.route=route(a,next);a.moving=true;a.activity='walk';a.label='前往'+(next.place||LABELS[next.activity]);a.gesture='walk';a.speech='';}
  }
  if(state.scene&&state.scene.phase!=='approach'){
   const pair=state.scene.participants.map(id=>state.actors.find(a=>a.id===id));
   if(Math.hypot(pair[0].x-pair[1].x,pair[0].z-pair[1].z)<1.35){
    // Re-stage a legacy close-contact scene without changing its relationship
    // result or inventing a second completed encounter.
    state.scene.phase='approach';state.scene.elapsed=0;state.scene.beat=-1;
    pair.forEach((a,i)=>{a.route=route(a,{x:i?.85:-.85,z:.6});a.destination={kind:'social'};a.moving=true;a.activity='walk';a.label='调整交谈位置';a.gesture='walk';a.speech='';});
   }
  }
 }
 // Additive migration preserves legacy NPC saves and private history.
 state.pendingConversations??=[];state.alumni??={};state.items??=definitions.map(a=>({id:`keepsake-${a.id}`,name:'随身纪念物',ownerId:a.id,holderId:a.id,borrowedAt:0}));state.commitments??=[];state.queues??={};state.resourceScene??=null;state.queuePairs??={};state.productionRules??={day:1,rule:null};
 for(const a of state.actors){const d=definitions.find(d=>d.id===a.id)||{};a.goal??={text:d.goal||'建立自己的岛上生活',progress:0,kind:/保护|边界|隐私/.test(d.goal||'')?'privacy':/作品|单曲|摄影|小店/.test(d.goal||'')?'creative':'social'};a.romanceAllowed??=d.romanceAllowed!==false;a.knownBond??=d.knownRelation||null;a.knowledge??=[];a.templateCooldowns??={};a.templateDays??={};a.beliefs??=[];a.celebratedProgress??=0;a.emotionUntil??=0;for(const [id,r]of Object.entries(a.relationships)){r.met??=r.familiarity>=5||r.lastInteraction>-999;r.attraction??=0;r.resentment??=Math.max(0,-r.affinity);r.alliance??=false;r.romance??=false;if(!saved&&d.knownRelation?.id===id){r.familiarity=Math.max(r.familiarity,55);r.resentment=12;r.attraction=16;r.bond=d.knownRelation.label||d.knownRelation.type||'前任';}}}
 const byId=id=>state.actors.find(a=>a.id===id);
 const random=()=>{state.rng=(Math.imul(1664525,state.rng)+1013904223)>>>0;return state.rng/4294967296;};
 const remember=(a,kind,text,otherId=null,topic=null)=>{const memory={time:state.time,kind,text,otherId,topic};a.memories.push(memory);if(a.memories.length>16)a.memories.shift();if(!['activity','gift','learned'].includes(kind)){a.knowledge.push({...memory,source:'experienced'});if(a.knowledge.length>64)a.knowledge.shift();}};
 const emit=(type,participants,text,extra={})=>{const person=byId(participants[0]),dominant=person&&Object.entries(person.needs).sort((a,b)=>b[1]-a[1])[0],needNames={hunger:'饥饿',thirst:'口渴',energy:'疲劳',privacy:'独处需要',environment:'环境不适',social:'交流需要',fun:'无聊'};const event={id:++state.eventId,time:+state.time.toFixed(1),type,participants:[...participants],text,x:person?.x??0,z:person?.z??0,activity:person?.activity,reason:dominant?`现场状态：${person.name}的${needNames[dominant[0]]||dominant[0]}为${Math.round(dominant[1])}；正在${person.label||'观察现场'}。`:'现场记录',...(layout?{sourcePart:({declined:'reaction','interview-declined':'reaction'}[type]||'action')}:{}),...extra};state.events.push(event);if(state.events.length>60)state.events.shift();if(layout&&['disagreed','queue-argue'].includes(type)){for(const witness of state.actors.filter(a=>!participants.includes(a.id)&&!a.unavailable&&Math.hypot(a.x-event.x,a.z-event.z)<4)){witness.knowledge.push({time:state.time,kind:type,text,participants:[...participants],source:'witnessed',eventId:event.id});if(witness.knowledge.length>64)witness.knowledge.shift();}}return event;};
 function release(a){for(const q of Object.values(state.queues))q.entries=q.entries.filter(e=>e.id!==a.id);for(const f of state.facilities)if(f.owner===a.id)f.owner=null;a.route=[];a.destination=null;a.moving=false;}
 function idle(a,delay=3){release(a);a.activity='idle';a.label=LABELS.idle;a.gesture='rest';a.speech='';a.timer=delay;}
 function leaveFacility(a){for(const f of state.facilities)if(f.owner===a.id)f.owner=null;if(layout){const safe=layout.navigation.nearest({x:a.x+1.5,z:a.z+1.5});walk(a,safe||{x:0,z:2},{kind:'exit'});a.label='离开设施，让出位置';return;}const node=NODES[nearest(a)],index=state.actors.indexOf(a);walk(a,{x:clamp(node[0]+(index%2?.55:-.55),-5.25,8.8),z:clamp(node[1]+(index%3-1)*.55,-10.8,13.5)},{kind:'exit'});a.label='离开设施，让出位置';}
 function walk(a,target,destination){a.route=route(a,target);a.destination=destination;a.moving=true;a.activity='walk';a.label='前往'+(destination.kind==='social'?'碰面地点':destination.kind==='queue'?'水站队列':target.place||LABELS[destination.activity]);a.gesture='walk';a.speech='';}
 function available(a){return a&&!a.unavailable&&a.activity==='idle'&&a.cooldown<=state.time&&!a.moving;}
 function invite(a,b,source='autonomous',requestedKind=null,continuation=null){
  if(!a||!b||a===b)return {ok:false,reason:'请选择两位不同的岛民'};
  if(state.scene||!available(a)||!available(b))return {ok:false,reason:'有人正在忙，等他们空下来再介绍'};
  if(requestedKind&&!eligible(a,b,requestedKind,!!continuation))return{ok:false,reason:'尚不具备这项互动的关系、经历或需求前提'};
  const relation=b.relationships[a.id];
  if(!continuation&&relation.cooldown>state.time)return {ok:false,reason:'刚刚聊过，给他们一点自己的时间'};
  const shared=a.personality.interests.filter(t=>b.personality.interests.includes(t)),kind=requestedKind||chooseSocialKind(a,b,shared);if(!kind||(layout&&!eligible(a,b,kind,!!continuation)))return{ok:false,reason:'今天这两位已聊过可用话题，先各自活动'};if(layout||EXPANDED_KINDS.includes(kind)){a.templateDays[`${b.id}:${kind}`]=state.productionRules.day;b.templateDays[`${a.id}:${kind}`]=state.productionRules.day;}
  state.stats.invitations++;
  const chance=clamp(.22+b.personality.sociability*.43+b.needs.social*.004+relation.affinity*.002+relation.trust*.0015-b.needs.energy*.003-b.needs.hunger*.002,.12,.94);
  if(b.needs.hunger>85||b.needs.energy>88||random()>chance){
   state.stats.rejected++;a.cooldown=state.time+14;b.cooldown=state.time+8;relation.cooldown=state.time+30;a.relationships[b.id].cooldown=state.time+30;
   a.speech='好，那下次再聊。';b.speech=b.needs.energy>65?'我想先歇一会儿。':'我现在想自己待一会儿。';a.label='给对方一点空间';b.label='想独处一会儿';a.gesture='wave';b.gesture='rest';a.timer=4;b.timer=4;
   remember(a,'declined',`${b.name}这次想自己待着`,b.id);emit('declined',[a.id,b.id],`${a.name}邀请${b.name}，对方婉拒了。`);return {ok:false,reason:'对方婉拒了，关系不会被强制改变'};
  }
  if(!continuation)abandonPending(p=>p.participants.includes(a.id)&&p.participants.includes(b.id),'双方已开始新的话题，旧的待续话题放弃。');
  release(a);release(b);
  const rel=a.relationships[b.id];
  a.templateCooldowns[`${b.id}:${kind}`]=state.time+150;
  const taught=[...a.topics,...b.topics];const disagreement=[...a.memories].reverse().find(m=>m.otherId===b.id&&m.kind==='disagreed');const topic=continuation?continuation.topic:kind==='apologize'&&disagreement?.topic?disagreement.topic:taught.length&&random()<.55?taught[Math.floor(random()*taught.length)]:shared[0]||a.personality.interests[Math.floor(random()*a.personality.interests.length)];
  const id=++state.eventId;
  state.scene={id,participants:[a.id,b.id],speakerId:a.id,phase:'approach',kind,topic,elapsed:0,beat:-1,source,outcome:null,reason:socialReason(a,b,kind),...(continuation?{resolvesSceneId:continuation.originalSceneId,continuationCreatedDay:continuation.createdDay}: {})};
  if(kind==='resource-share'){const slot=state.facilities.find(f=>f.activity==='drink'&&!f.owner);if(!slot){idle(a,2);idle(b,2);state.scene=null;return{ok:false,reason:'水站正在忙，无法预留分享服务'};}slot.owner=a.id;state.scene.resourceSlot=slot.id;}if(kind==='borrow')state.scene.itemId=state.items.find(i=>i.ownerId===b.id&&i.holderId===b.id)?.id;if(kind==='return-item')state.scene.itemId=state.items.find(i=>i.ownerId===b.id&&i.holderId===a.id)?.id;if(kind==='mediate')state.scene.mediationTarget=mediationTarget(a,b);if(continuation?.itemId)state.scene.itemId=continuation.itemId;
  let meet={x:0,z:.6};if(layout){const places=layout.facilities.filter(f=>['fire','table','privacy'].includes(f.type));if(places.length){const place=places.reduce((best,f)=>Math.hypot(f.x-a.x,f.z-a.z)<Math.hypot(best.x-a.x,best.z-a.z)?f:best);meet=layout.navigation.servicePoint(place)||meet;}}if(state.scene.resourceSlot){const f=state.facilities.find(f=>f.id===state.scene.resourceSlot);meet={x:f.x,z:f.z};}const targetA={x:meet.x-.85,z:meet.z},targetB={x:meet.x+.85,z:meet.z};walk(a,layout&&!layout.navigation.clear(targetA.x,targetA.z)?layout.navigation.nearest(targetA):targetA,{kind:'social'});walk(b,layout&&!layout.navigation.clear(targetB.x,targetB.z)?layout.navigation.nearest(targetB):targetB,{kind:'social'});
  emit('invitation',[a.id,b.id],`${a.name}与${b.name}决定碰面。`,{sourcePart:'context',sceneId:String(id),reason:state.scene.reason});return {ok:true,reason:'他们愿意试着聊聊，结果由双方决定'};
 }
 function eligible(a,b,kind,ignoreAttemptCooldown=false){
  const r=a.relationships[b.id];if(!ignoreAttemptCooldown&&(layout||EXPANDED_KINDS.includes(kind))&&(a.templateDays[`${b.id}:${kind}`]===state.productionRules.day||b.templateDays[`${a.id}:${kind}`]===state.productionRules.day))return false;if(!ignoreAttemptCooldown&&(a.templateCooldowns[`${b.id}:${kind}`]||0)>state.time)return false;
  if(kind==='contest'||kind==='mole-task')return a.needs.energy<80&&b.needs.energy<80;
  if(kind==='resource-share')return !!layout&&b.needs.thirst>60&&(a.needs.thirst||0)<55&&a.personality.kindness>.6&&state.facilities.some(f=>f.activity==='drink'&&!f.owner);
  if(kind==='borrow')return (a.needs.fun>35||a.goal.kind==='creative')&&!state.items.some(i=>i.holderId===a.id&&i.ownerId!==a.id)&&r.trust>=3&&state.items.some(i=>i.ownerId===b.id&&i.holderId===b.id);
  if(kind==='return-item')return state.items.some(i=>i.ownerId===b.id&&i.holderId===a.id&&state.time-i.borrowedAt>45);
  if(kind==='comfort')return ['sad','angry'].includes(b.mood)&&a.personality.kindness>.6&&r.familiarity>=5;
  if(kind==='clarify-belief')return a.beliefs.some(v=>v.otherId===b.id&&!v.resolved);
  if(kind==='missed-promise')return state.commitments.some(v=>v.participants.includes(a.id)&&v.participants.includes(b.id)&&v.status==='pending'&&v.dueDay<state.productionRules.day);
  if(kind==='celebrate')return a.goal.progress-a.celebratedProgress>=10&&a.goal.progress>=10;
  if(kind==='mediate')return a.personality.kindness>.6&&!!mediationTarget(a,b);
  if(kind==='alliance')return r.trust>=8&&r.familiarity>=20&&!r.alliance;
  if(kind==='confess')return a.romanceAllowed&&b.romanceAllowed&&r.attraction>=30&&r.familiarity>=30&&!r.romance;
  if(kind==='question')return !!r.bond||a.memories.some(m=>m.otherId===b.id&&['disagreed','queue-argue'].includes(m.kind));
  if(kind==='help')return b.needs.energy>55||b.needs.hunger>65;
  if(kind==='boundary')return (a.needs.privacy||0)>55;
  if(kind==='collaborate')return a.goal.kind==='creative'&&a.personality.interests.some(t=>b.personality.interests.includes(t));
  if(kind==='complain')return [...a.memories,...a.knowledge].some(m=>m.kind==='service-unavailable'||m.kind==='queue-avoid');
  if(kind==='apologize')return r.resentment>=10||r.affinity< -12;
  return ['chat','share','play','argue'].includes(kind);
 }
 function socialReason(a,b,kind){const r=a.relationships[b.id],reasons={
  'resource-share':`${b.name}口渴${Math.round(b.needs.thirst)}，${a.name}口渴${Math.round(a.needs.thirst||0)}，并且水站还有空位。`,
  borrow:`${a.name}希望缓解无聊或推进创作，且对${b.name}已有信任${Math.round(r.trust)}；物品仍由本人持有。`,
  'return-item':`${a.name}实际持有之前向${b.name}借来的物品，借用已超过45秒。`,
  comfort:`${a.name}看到${b.name}显露${b.mood==='angry'?'愤怒':'难过'}，已有熟悉度${Math.round(r.familiarity)}。`,
  'clarify-belief':`${a.name}对与${b.name}亲历的谈话有尚未确认的理解，希望直接求证。`,
  'missed-promise':`双方先前接受过共同约定，期限已过，记录中尚未履行。`,
  celebrate:`${a.name}真实目标进度${Math.round(a.goal.progress)}，较上次庆祝增加至少10。`,
  mediate:`${a.name}曾在近处亲眼见到${b.name}与第三人的争执，因此有资格提出调停建议。`,
  alliance:`双方熟悉度${Math.round(r.familiarity)}、信任${Math.round(r.trust)}，可以尝试约定结伴。`,
  confess:`${a.name}对${b.name}吸引${Math.round(r.attraction)}，双方允许恋爱；回应仍由对方决定。`,
  question:r.bond?`双方有已知${r.bond}关系。`:`${a.name}记得双方亲历的分歧。`,
  help:`${b.name}疲劳${Math.round(b.needs.energy)}、饥饿${Math.round(b.needs.hunger)}，引发关心。`,
  boundary:`${a.name}独处需要${Math.round(a.needs.privacy||0)}，想向对方说明边界。`,
  collaborate:`${a.name}有创作目标，双方至少共享一项兴趣。`,complain:`${a.name}亲历过服务不足或离开水站，想表达具体诉求。`,apologize:`${a.name}与对方仍有怨怼${Math.round(r.resentment)}或负面亲近感。`};return reasons[kind]||`${a.name}交流需要${Math.round(a.needs.social)}；双方关系与共同兴趣参与了本次选择。`;}
 function mediationTarget(a,b){const evidence=[...a.knowledge].reverse().find(k=>k.source==='witnessed'&&['disagreed','queue-argue'].includes(k.kind)&&k.participants?.includes(b.id)&&k.participants.some(id=>id!==b.id&&id!==a.id));return evidence?.participants.find(id=>id!==b.id&&id!==a.id);}
 function chooseSocialKind(a,b,shared){
  if(!layout)return a.relationships[b.id].affinity< -12&&a.personality.kindness>.5?'apologize':shared.length&&random()<.55?'share':random()<.25?'play':'chat';
  const options=[['resource-share',b.needs.thirst+15],['return-item',90],['borrow',a.goal.kind==='creative'?65:a.needs.fun+15],['comfort',75],['clarify-belief',72],['missed-promise',90],['celebrate',80],['mediate',68],['boundary',(a.needs.privacy||0)*1.1],['help',(b.needs.energy+b.needs.hunger)*a.personality.kindness*.65],['complain',70],['apologize',a.relationships[b.id].resentment+50],['question',60],['confess',a.relationships[b.id].attraction+22],['alliance',50+a.relationships[b.id].trust],['collaborate',65-a.goal.progress*.2],['share',shared.length?55:0],['play',a.needs.fun*.5],['chat',35]].filter(([kind])=>eligible(a,b,kind));
  if(!options.length)return null;options.sort((a,b)=>b[1]-a[1]);const near=options.filter(o=>o[1]>=options[0][1]-8);return near[Math.floor(random()*near.length)][0];
 }
 function enqueue(a,slot){
  const fid=slot.facilityId||slot.id;if(state.queues[fid]?.entries.some(e=>e.id===a.id))return;release(a);
  const q=state.queues[fid]??={entries:[]};a.queueCompliant=true;
  const f=layout.facilities.find(f=>f.id===fid),base=layout.navigation.servicePoint(f);
  const marks=Array.from({length:12},(_,i)=>layout.navigation.nearest({x:base.x+2+(i%4)*1.2,z:base.z+2+Math.floor(i/4)*1.2}));const point=marks.find(p=>q.entries.every(e=>!e.point||Math.hypot(p.x-e.point.x,p.z-e.point.z)>.9))||marks[0];q.entries.push({id:a.id,since:state.time,point});walk(a,point,{kind:'queue',facilityId:fid});a.label='前往饮水队列';
  emit('queue-enter',[a.id],`${a.name}口渴，进入${f.name||'水站'}的等候队列。`,{sourcePart:'context',sceneId:`queue-${fid}-${a.id}-${state.time.toFixed(1)}`});
 }
 function interruptQueueScene(reason){const rs=state.resourceScene;if(!rs)return;emit('interrupted',rs.participants,reason,{sceneId:String(rs.id)});state.resourceScene=null;for(const id of rs.participants){const a=byId(id);if(!a)continue;a.activity='queue';a.label='恢复原有队列';a.gesture='rest';a.speech='';a.moving=false;}}
 function beginQueueScene(q,fid,a,b){
  const rule=state.productionRules.rule,priority=rule?.policy==='priority'&&rule.priorityId===b.id;
  const branch=a.personality.directness<.4?'queue-avoid':a.personality.kindness>.85||b.needs.thirst-a.needs.thirst>15||priority?'queue-yield':b.personality.kindness>.7||rule?.leaderId&&rule.policy==='rotation'?'queue-apology':'queue-argue';
  const id=++state.eventId;state.resourceScene={id,participants:[a.id,b.id],speakerId:b.id,facilityId:fid,phase:'greeting',kind:branch==='queue-argue'?'argue':branch==='queue-apology'?'apologize':'chat',topic:'饮水顺序',elapsed:0,beat:-1,branch};
  state.queuePairs[[a.id,b.id].sort().join(':')]=state.productionRules.day;b.queueCompliant=false;
  for(const actor of [a,b]){actor.route=[];actor.moving=false;actor.activity='argue';actor.gesture='listen';actor.label='商量饮水顺序';}
  emit('queue-cut',[a.id,b.id],`${b.name}想先取水，向已经排队的${a.name}提出改变顺序。`,{sourcePart:'action',sceneId:String(id),sourceType:'argue',reason:`水站已有服务；${a.name}先排队，${b.name}后到且想改变顺序，两人口渴均超过50。`});
 }
 function advanceQueues(dt){
  if(!layout)return;
  const rs=state.resourceScene;
  if(rs){rs.elapsed+=dt;const[a,b]=rs.participants.map(byId),beat=Math.floor(rs.elapsed/3);a.facing=Math.atan2(b.x-a.x,b.z-a.z);b.facing=Math.atan2(a.x-b.x,a.z-b.z);
   if(beat!==rs.beat&&beat<3){rs.beat=beat;rs.phase=['topic','response','resolution'][beat];rs.speakerId=beat===1?b.id:a.id;a.speech='';b.speech='';const speaker=byId(rs.speakerId);const lines={
    'queue-yield':['你是不是急着用水？','我现在确实更口渴，谢谢你愿意听。','那这次你先，我保留下一位。'],
    'queue-argue':['我已经在这里等了一会儿。','我也很着急，不想再等了。','先按原队列取水，等冷静下来再说。'],
    'queue-apology':['请先看看排队的顺序。','对不起，我不该直接往前挤。','我们按顺序来，你回到原来的位置。'],
    'queue-avoid':['我不想在镜头前争论。','你要离开这里吗？','我先离开，稍后再找水站。']};speaker.speech=lines[rs.branch][beat];speaker.gesture=rs.branch==='queue-apology'&&speaker===b?'apologize':rs.branch==='queue-argue'?'argue':'talk';emit('dialogue',rs.participants,`${speaker.name}：“${speaker.speech}”`,{sourcePart:'reaction',sceneId:String(rs.id),sourceType:rs.branch==='queue-argue'?'argue':rs.branch==='queue-apology'?'apologize':'chat'});}
   if(rs.elapsed>=9){const q=state.queues[rs.facilityId];const ar=a.relationships[b.id],br=b.relationships[a.id];if(rs.branch==='queue-yield'){const ai=q.entries.findIndex(e=>e.id===a.id),bi=q.entries.findIndex(e=>e.id===b.id);if(ai>=0&&bi>=0)[q.entries[ai],q.entries[bi]]=[q.entries[bi],q.entries[ai]];ar.trust=clamp(ar.trust+2,-100,100);br.trust=clamp(br.trust+5,-100,100);b.queueCompliant=true;}else if(rs.branch==='queue-apology'){ar.resentment=clamp(ar.resentment-3);ar.trust=clamp(ar.trust+2,-100,100);b.queueCompliant=true;}else if(rs.branch==='queue-argue'){ar.resentment=clamp(ar.resentment+7);br.resentment=clamp(br.resentment+6);ar.trust=clamp(ar.trust-3,-100,100);br.trust=clamp(br.trust-3,-100,100);}
    for(const [self,other]of [[a,b],[b,a]]){remember(self,rs.branch,`与${other.name}的饮水顺序：${({'queue-yield':'让位','queue-argue':'各自坚持后恢复原顺序','queue-apology':'道歉后恢复原顺序','queue-avoid':'离开等候'})[rs.branch]}`,other.id,'饮水顺序');self.activity='queue';self.label='继续等待饮水';self.gesture='rest';self.speech='';}
    emit(rs.branch,rs.participants,`${a.name}与${b.name}的饮水顺序事件结束：${({'queue-yield':'先到者让位，后到者先服务','queue-argue':'仍有分歧，保留原队列','queue-apology':'后到者道歉并回到原位','queue-avoid':'先到者暂时离开'})[rs.branch]}。`,{sourcePart:'result',sceneId:String(rs.id),sourceType:rs.branch==='queue-argue'?'argue':rs.branch==='queue-apology'?'apologize':'chat'});state.stats.activities[rs.branch]=(state.stats.activities[rs.branch]||0)+1;state.resourceScene=null;if(rs.branch==='queue-avoid'){idle(a,12);a.cooldown=state.time+12;}}
  }
  for(const[fid,q]of Object.entries(state.queues)){
   q.entries=q.entries.filter(e=>{const a=byId(e.id);return a&&!a.unavailable&&a.destination?.kind==='queue'&&a.destination.facilityId===fid;});
   const slots=state.facilities.filter(f=>f.facilityId===fid&&f.activity==='drink'),ready=q.entries.map(e=>byId(e.id)).filter(a=>a.activity==='queue'&&!a.moving);
   if(!state.resourceScene&&slots.some(f=>f.owner)&&ready.length>=2){const a=ready[0],b=ready[1],key=[a.id,b.id].sort().join(':');if(a.needs.thirst>50&&b.needs.thirst>50&&state.queuePairs[key]!==state.productionRules.day&&(b.personality.directness>.65||state.productionRules.rule?.priorityId===b.id)){beginQueueScene(q,fid,a,b);}}
   for(const f of slots.filter(f=>!f.owner)){const entry=q.entries.find(e=>{const a=byId(e.id);return a.activity==='queue'&&!a.moving&&!state.resourceScene?.participants.includes(a.id);});if(!entry)break;const a=byId(entry.id);q.entries=q.entries.filter(e=>e!==entry);f.owner=a.id;walk(a,f,{kind:'facility',id:f.id,activity:f.activity});a.label='轮到自己取水';}
  }
 }
 function abandonPending(predicate,reason){const removed=state.pendingConversations.filter(predicate);state.pendingConversations=state.pendingConversations.filter(p=>!predicate(p));for(const p of removed)emit('continuation-abandoned',p.participants,reason,{sourcePart:'context',sceneId:p.originalSceneId,reason});}
 function prunePending(){abandonPending(p=>state.productionRules.day>p.createdDay+1||p.participants.some(id=>!byId(id)||byId(id).unavailable),'待续话题已经过期，或参与者无法继续。');}
 function continueConversation(firstId,secondId){prunePending();const pending=state.pendingConversations.find(p=>p.participants.includes(firstId)&&p.participants.includes(secondId));if(!pending)return{ok:false,reason:'双方没有有效的待续话题'};const[a,b]=pending.participants.map(byId);
  if(state.scene||!available(a)||!available(b)||[a,b].some(p=>Math.max(p.needs.hunger,p.needs.energy,p.needs.thirst||0)>75))return{ok:false,reason:'先照顾当前需要，等双方空下来再续谈'};
  if(!eligible(a,b,pending.kind,true)||pending.itemId&&!state.items.some(i=>i.id===pending.itemId&&i.ownerId===b.id&&i.holderId===(pending.kind==='return-item'?a.id:b.id))){abandonPending(p=>p===pending,'原话题的实际前提已改变，双方不再继续这项互动。');return{ok:false,reason:'原话题前提已改变'};}
  state.pendingConversations=state.pendingConversations.filter(p=>p!==pending);const reply=invite(a,b,'continuation',pending.kind,pending);if(!reply.ok)emit('continuation-declined',pending.participants,'双方这次没有同意续谈，待续话题作罢。',{sourcePart:'reaction',sceneId:pending.originalSceneId});return reply;
 }
 function retainConversation(scene){if(['contest','mole-task'].includes(scene.kind)||scene.participants.some(id=>!byId(id)||byId(id).unavailable))return;const createdDay=scene.continuationCreatedDay??state.productionRules.day;if(state.productionRules.day>createdDay+1)return;state.pendingConversations=state.pendingConversations.filter(p=>!scene.participants.every(id=>p.participants.includes(id)));state.pendingConversations.push({originalSceneId:String(scene.resolvesSceneId??scene.id),participants:[...scene.participants],kind:scene.kind,topic:scene.topic,itemId:scene.itemId??null,createdDay});}
 function choose(a){
  const candidates=state.facilities.filter(f=>!f.owner||(layout&&f.activity==='drink'&&a.needs.thirst>50)).map(f=>({f,score:a.needs[f.need]+random()*18-(layout?Math.hypot(f.x-a.x,f.z-a.z)*.8:0)+(f.activity==='sing'&&a.personality.interests.includes('音乐')?22:0)+(f.activity==='read'&&a.personality.interests.includes('阅读')?22:0)-(a.lastActivity===f.activity?20:0)}));
  if(!state.scene){
   const peers=state.actors.filter(b=>b!==a&&available(b)&&a.relationships[b.id].cooldown<=state.time).sort((b,c)=>(a.relationships[c.id].affinity-a.relationships[b.id].affinity));
   const pending=state.pendingConversations.find(p=>p.participants.includes(a.id)&&p.participants.every(id=>available(byId(id)))&&state.productionRules.day<=p.createdDay+1);const continuationPeer=pending&&byId(pending.participants.find(id=>id!==a.id));const urgentPeer=peers.find(b=>EXPANDED_KINDS.some(k=>eligible(a,b,k)));const socialValue=Math.max(a.needs.social+a.personality.sociability*25+random()*15,urgentPeer?82:0);
   if(peers.length&&socialValue>Math.max(...candidates.map(c=>c.score),0)){
    const result=continuationPeer?continueConversation(a.id,continuationPeer.id):invite(a,urgentPeer||peers[Math.floor(random()*Math.min(peers.length,3))]);if(result.ok||a.cooldown>state.time)return;
   }
  }
  candidates.sort((a,b)=>b.score-a.score);const f=candidates[0]?.f;
  if(!f){if(layout&&a.needs.thirst>50){const water=state.facilities.find(f=>f.activity==='drink');if(water){enqueue(a,water);return;}}a.timer=3;return;}if(layout&&f.activity==='drink'){enqueue(a,f);return;}f.owner=a.id;walk(a,f,{kind:'facility',id:f.id,activity:f.activity});
 }
 function advanceActor(a,dt){
  if(a.unavailable)return;
  if(layout){for(const [key,rate]of Object.entries({thirst:.22,environment:.035,privacy:.045}))a.needs[key]=clamp((a.needs[key]||0)+dt*rate);}
  for(const [key,rate]of Object.entries({hunger:.18,energy:.105,social:.15,fun:.13}))a.needs[key]=clamp(a.needs[key]+dt*rate);
  if(state.resourceScene?.participants.includes(a.id)){a.moving=false;return;}
  if(a.moving){
   const p=a.route[0];if(!p){a.moving=false;return;}
   const dx=p.x-a.x,dz=p.z-a.z,dist=Math.hypot(dx,dz),step=dt*(.7+a.personality.energy*.42);
   // Junctions use a body-sized tolerance to avoid traffic lockups. Final
   // staging marks need precision so conversation partners stay face-to-face
   // at a natural distance, instead of stopping nose-to-nose at the corridor.
   const arrival=a.route.length===1?.12:.72;
   if(dist<=arrival){a.route.shift();}else{const travel=Math.min(step,dist);let nx=a.x+dx/dist*travel,nz=a.z+dz/dist*travel;
    // Right-hand yielding prevents a stationary queue from becoming an impassable body wall.
    if(layout&&dist>.35){const blocked=state.actors.some(other=>{if(other===a||other.unavailable)return false;const ox=other.x-a.x,oz=other.z-a.z;return Math.hypot(ox,oz)<1.05&&ox*dx/dist+oz*dz/dist>0&&Math.abs(ox*dz/dist-oz*dx/dist)<.55;});if(blocked){const side=dt*.8;const rx=nx+dz/dist*side,rz=nz-dx/dist*side;if(layout.navigation.clear(rx,rz,.22)){nx=rx;nz=rz;}}}
    a.x=nx;a.z=nz;a.facing=Math.atan2(dx,dz);}
   if(!a.route.length){a.moving=false;if(a.destination?.kind==='facility'){const f=state.facilities.find(f=>f.id===a.destination.id);if(!f){idle(a,3);return;}a.activityEvent=`activity-${a.id}-${state.eventId+1}`;if(layout)emit('routine-start',[a.id],`${a.name}来到${f.place}，开始${LABELS[f.activity]}。`,{sourcePart:'action',sceneId:a.activityEvent});a.activity=f.activity;a.label=LABELS[f.activity];a.gesture=f.gesture;a.timer=12+random()*9;a.lastActivity=f.activity;state.stats.activities[f.activity]=(state.stats.activities[f.activity]||0)+1;}else if(a.destination?.kind==='queue'){a.activity='queue';a.label='排队等候饮水';a.gesture='rest';}else if(a.destination?.kind==='exit'){idle(a,4+random()*5);}else{a.activity='chat';a.label='等待对方';a.gesture='wave';}}
   return;
  }
  if(state.scene?.participants.includes(a.id)||a.destination?.kind==='queue')return;
  if(a.destination?.kind==='facility'){
   const f=state.facilities.find(f=>f.id===a.destination.id);if(!f){idle(a,3);return;}const consumable=['eat','drink'].includes(f.activity);if(!consumable)a.needs[f.need]=clamp(a.needs[f.need]-dt*3.6);a.timer-=dt;
   if(a.timer<=0){if(consumable){const response=serviceHandler?.({actorId:a.id,facilityId:f.facilityId||f.id,kind:f.activity==='eat'?'food':'water',ruleCompliant:!!a.queueCompliant})||{ok:true};if(!response.ok){remember(a,'service-unavailable',`${f.place}没有足够补给`);emit('service-unavailable',[a.id],`${a.name}等待服务完成，但${f.place}补给不足。`,{sourcePart:'result',sceneId:a.activityEvent});a.cooldown=state.time+12;leaveFacility(a);return;}a.needs[f.need]=clamp(a.needs[f.need]-55);a.queueCompliant=false;}remember(a,'activity',LABELS[a.activity]);if(layout)emit('routine',[a.id],`${a.name}${LABELS[a.activity]}，完成了一段日常活动。`,{sourcePart:'result',sceneId:a.activityEvent});if(state.time>=a.emotionUntil)a.mood='happy';leaveFacility(a);}return;
  }
  a.timer-=dt;if(a.timer<=0){a.speech='';a.gesture='rest';if(a.cooldown<=state.time)choose(a);else a.timer=1;}
 }
 function finishExpanded(scene,a,b){
  if(scene.kind==='resource-share'){const slot=state.facilities.find(f=>f.id===scene.resourceSlot&&f.owner===a.id);if(!slot)return 'sharing-unavailable';const r=serviceHandler?.({actorId:b.id,facilityId:slot.facilityId||slot.id,kind:'water',ruleCompliant:false})||{ok:true};if(!r.ok)return 'sharing-unavailable';b.needs.thirst=clamp(b.needs.thirst-45);a.goal.progress=clamp(a.goal.progress+3);return 'water-shared';}
  if(scene.kind==='borrow'){const item=state.items.find(i=>i.id===scene.itemId&&i.ownerId===b.id&&i.holderId===b.id);if(!item||b.personality.kindness<.5&&b.relationships[a.id].trust<10)return 'borrow-declined';item.holderId=a.id;item.borrowedAt=state.time;a.needs.fun=clamp(a.needs.fun-20);return 'item-borrowed';}
  if(scene.kind==='return-item'){const item=state.items.find(i=>i.id===scene.itemId&&i.ownerId===b.id&&i.holderId===a.id);if(!item)return 'borrow-declined';item.holderId=b.id;item.borrowedAt=0;b.relationships[a.id].trust=clamp(b.relationships[a.id].trust+3,-100,100);return 'item-returned';}
  if(scene.kind==='comfort'){b.needs.social=clamp(b.needs.social-20);b.needs.fun=clamp(b.needs.fun-10);a.goal.progress=clamp(a.goal.progress+3);return 'comforted';}
  if(scene.kind==='clarify-belief'){const belief=a.beliefs.find(v=>v.otherId===b.id&&!v.resolved);if(!belief||b.personality.directness<.5&&b.relationships[a.id].trust<5)return 'belief-unresolved';belief.resolved=true;belief.resolvedByScene=String(scene.id);a.relationships[b.id].resentment=clamp(a.relationships[b.id].resentment-5);return 'belief-corrected';}
  if(scene.kind==='missed-promise'){const promise=state.commitments.find(v=>v.participants.includes(a.id)&&v.participants.includes(b.id)&&v.status==='pending'&&v.dueDay<state.productionRules.day);if(promise){promise.status='discussed';promise.discussedScene=String(scene.id);a.relationships[b.id].resentment=clamp(a.relationships[b.id].resentment+2);}return 'promise-discussed';}
  if(scene.kind==='celebrate'){a.celebratedProgress=a.goal.progress;a.needs.fun=clamp(a.needs.fun-25);b.needs.fun=clamp(b.needs.fun-15);remember(b,'learned-milestone',`${a.name}分享了目标进度${a.goal.progress}`,a.id);return 'milestone-celebrated';}
  if(scene.kind==='mediate'){const third=scene.mediationTarget;if(third&&b.relationships[third]){b.relationships[third].resentment=clamp(b.relationships[third].resentment-3);remember(b,'mediation-plan',`愿意考虑与${byId(third)?.name||third}再谈一次`,third);a.goal.progress=clamp(a.goal.progress+2);}return 'mediation-offered';}
 }
 function expandedLines(scene,a,b){return {
  'resource-share':['你看起来很渴。','这里有空余的饮水服务，我陪你取一份。','谢谢，我们按规则向水站领取。','等服务完成再把水交到你手里。'],
  borrow:['我想借用你的随身物品。','我会爱惜它，用完亲手还给你。','我想一下是否愿意借出。','决定好后我们再交接。'],
  'return-item':['我记得还欠你一样东西。','这是之前借来的物品，现在还给你。','谢谢你记得归还。','下次借东西也要说清楚。'],
  comfort:['你看起来不太开心。','我不一定知道发生了什么，但可以陪你一会儿。','谢谢你没有急着替我下结论。','慢慢来，先照顾自己的心情。'],
  'clarify-belief':['我对上次谈话有一个理解，可能并不准确。','当时那句话让我觉得你不愿听我说话。','我可以解释自己当时的意思。','我们根据彼此的解释再判断。'],
  'missed-promise':['我们之前约好一起做一件小事。','约定的时间已经过去了，却没有完成。','确实没做到，我们把原因说清楚。','先承认这次失约，再考虑要不要重新约。'],
  celebrate:['我有个小进展想告诉你。',`我的目标已经推进到${a.goal.progress}，这是真正完成的部分。`,'能坚持做到这里值得高兴。','一起庆祝一下，然后继续努力。'],
  mediate:['我亲眼看到了之前那次争执。',`你愿意考虑和${byId(scene.mediationTarget)?.name||'对方'}再谈一次吗？`,'我可以考虑，但不代表我们已经和好了。','我只传达建议，不替任何人作决定。']};}
 function finishScene(scene,a,b){
  const kind=scene.kind;let outcome=scene.outcome;
  if(kind==='contest'){
   const scores=[a,b].map(p=>Math.round((100-p.needs.energy)*.5+p.personality.energy*25+random()*25));
   const winner=scores[0]===scores[1]?(random()<.5?a:b):scores[0]>scores[1]?a:b;
   for(const p of [a,b]){p.needs.energy=clamp(p.needs.energy+12);p.needs.fun=clamp(p.needs.fun-18);remember(p,p===winner?'contest-won':'contest-finished','完成公开节拍挑战',p===a?b.id:a.id);idle(p,6);}
   emit('contest-completed',[a.id,b.id],`${a.name}与${b.name}完成节拍挑战，成绩${scores.join('比')}，${winner.name}获胜，等待核对奖品库存。`,{sourcePart:'result',sceneId:String(scene.id),instructionId:scene.instructionId,winnerId:winner.id,scores,reason:'双方完成四阶段挑战；相同规则按当前精力、活力与模拟随机流计分。'});
   state.stats.completed++;state.stats.activities.contest=(state.stats.activities.contest||0)+1;state.scene=null;return;
  }
  if(kind==='mole-task'){
   const accepted=b.personality.directness>.5;
   b.relationships[a.id].trust=clamp(b.relationships[a.id].trust-(accepted?1:3),-100,100);
   remember(a,'director-task-completed',`执行导演话题：${scene.topic}`,b.id);remember(b,accepted?'question-answered':'question-refused',`被询问：${scene.topic}`,a.id);
   emit(accepted?'mole-question-answered':'mole-question-refused',[a.id,b.id],`${a.name}提出「${scene.topic}」，${b.name}${accepted?'表达了自己的意见':'拒绝继续这个话题'}。`,{sourcePart:'result',sceneId:String(scene.id),instructionId:scene.instructionId,reason:'内应实际提出导演指定问题；对方自主决定是否回应。'});
   for(const p of [a,b])idle(p,6);state.stats.completed++;state.stats.activities['mole-task']=(state.stats.activities['mole-task']||0)+1;state.scene=null;return;
  }
  if(EXPANDED_KINDS.includes(kind))outcome=finishExpanded(scene,a,b);
  else if(kind==='alliance')outcome=b.relationships[a.id].trust>=8&&b.relationships[a.id].resentment<35?'allied':'alliance-declined';
  else if(kind==='confess')outcome=b.romanceAllowed&&b.relationships[a.id].attraction>=25&&b.relationships[a.id].trust>=8?'mutual-feeling':'feelings-declined';
  else if(kind==='help')outcome='supported';
  else if(kind==='boundary')outcome=b.personality.kindness>.5?'boundary-respected':'boundary-disagreed';
  else if(kind==='question')outcome=b.personality.directness>.5?'clarified':'unresolved';
  else if(kind==='collaborate')outcome='created-together';
  else if(kind==='complain')outcome='concern-raised';
  else if(kind==='apologize')outcome=random()<clamp(.35+b.personality.kindness*.5+b.relationships[a.id].trust*.002,.1,.9)?'reconciled':'unresolved';
  else if(kind==='argue')outcome='disagreed';
  else outcome=kind==='play'?'enjoyed':'connected';
  const base={reconciled:10,unresolved:-1,disagreed:-10,enjoyed:7,connected:5,allied:8,'alliance-declined':0,'mutual-feeling':10,'feelings-declined':-2,supported:7,'boundary-respected':5,'boundary-disagreed':-5,clarified:6,'created-together':8,'concern-raised':1,'water-shared':7,'sharing-unavailable':0,'item-borrowed':4,'borrow-declined':0,'item-returned':7,'comforted':5,'belief-corrected':6,'belief-unresolved':0,'promise-discussed':-2,'milestone-celebrated':5,'mediation-offered':3}[outcome]??0;
  if(outcome==='allied'&&!state.commitments.some(v=>v.status==='pending'&&v.participants.includes(a.id)&&v.participants.includes(b.id)))state.commitments.push({id:`promise-${scene.id}`,participants:[a.id,b.id],dueDay:state.productionRules.day+1,status:'pending'});if(['created-together','enjoyed'].includes(outcome))for(const v of state.commitments)if(v.status==='pending'&&v.participants.includes(a.id)&&v.participants.includes(b.id))v.status='fulfilled';
  for(const [self,other]of [[a,b],[b,a]]){
   const r=self.relationships[other.id];r.affinity=clamp(r.affinity+base*(.8+self.personality.kindness*.4),-100,100);r.trust=clamp(r.trust+base*(self===b?.45:.3),-100,100);r.resentment=clamp(r.resentment+(base<0?Math.abs(base)*.65:-base*.3));if(base>0&&self.romanceAllowed&&other.romanceAllowed&&r.familiarity>=10)r.attraction=clamp(r.attraction+Math.min(3,base*.2)*(self.personality.quirkiness+.5));if(outcome==='allied')r.alliance=true;if(outcome==='mutual-feeling')r.romance=true;r.familiarity=clamp(r.familiarity+5);r.lastInteraction=state.time;r.cooldown=state.time+35;
   self.needs.social=clamp(self.needs.social-(base>0?32:12));self.needs.fun=clamp(self.needs.fun-(base>0?12:0));self.mood=base>0?'happy':kind==='argue'?'angry':'sad';self.cooldown=state.time+7;if(base<0)self.emotionUntil=state.time+60;if(outcome==='comforted')self.emotionUntil=0;
   if(['created-together','allied','supported','boundary-respected','clarified'].includes(outcome))self.goal.progress=clamp(self.goal.progress+5);if(outcome==='boundary-respected')self.needs.privacy=clamp((self.needs.privacy||0)-20);if(outcome==='supported')self.needs.social=clamp(self.needs.social-12);
   if(outcome==='disagreed'){self.beliefs.push({otherId:other.id,issue:scene.topic,source:'direct-conversation',sourceSceneId:String(scene.id),resolved:false});if(self.beliefs.length>16)self.beliefs.shift();}
   remember(self,outcome,`${other.name}：${scene.topic}（${base>0?'聊得不错':'仍有分歧'}）`,other.id,scene.topic);idle(self,6+random()*5);
  }
  emit(outcome,[a.id,b.id],`${a.name}与${b.name}${({reconciled:'尝试和好了',unresolved:'暂时没有和好',disagreed:'产生了分歧',enjoyed:'一起玩得很开心',connected:'更熟悉了一点',allied:'同意结伴完成接下来的任务','alliance-declined':'没有就结伴达成一致','mutual-feeling':'确认了彼此的好感','feelings-declined':'表达了好感，但对方没有接受',supported:'关心了对方的状态','boundary-respected':'就个人边界达成理解','boundary-disagreed':'对个人边界仍有分歧',clarified:'说清了一件彼此亲历的旧事','created-together':'完成了共同创作的小目标','concern-raised':'交流了亲历的服务问题','water-shared':'完成了饮水分享','sharing-unavailable':'未能取得可分享的饮水','item-borrowed':'完成了一次借物交接','borrow-declined':'没有达成借物约定','item-returned':'归还了之前借出的物品','comforted':'通过陪伴缓和了情绪','belief-corrected':'澄清了一项有来源的误会','belief-unresolved':'讨论了误会但尚未认同','promise-discussed':'谈到了共同约定未能履行的原因','milestone-celebrated':'分享并庆祝了真实的目标进展','mediation-offered':'就亲眼见过的争执提出了调停建议'})[outcome]}。`,{sourcePart:'result',sceneId:String(scene.id),...(scene.resolvesSceneId?{resolvesSceneId:scene.resolvesSceneId}: {})});
  state.stats.completed++;state.stats.activities[kind]=(state.stats.activities[kind]||0)+1;state.scene=null;
 }
 function advanceScene(dt){
  const s=state.scene;if(!s)return;const[a,b]=s.participants.map(byId);s.elapsed+=dt;
  if(s.phase==='approach'){
   if(s.elapsed>60){idle(a);idle(b);state.scene=null;emit('cancelled',[a.id,b.id],'碰面暂时取消，双方继续自己的生活。');return;}
   if(a.moving||b.moving)return;s.phase='greeting';s.elapsed=0;
  }
  a.facing=Math.atan2(b.x-a.x,b.z-a.z);b.facing=Math.atan2(a.x-b.x,a.z-b.z);
  const beat=Math.floor(s.elapsed/4.5);if(beat>=4){finishScene(s,a,b);return;}
  if(beat===s.beat)return;s.beat=beat;s.phase=['greeting','topic','response','resolution'][beat];
  if(beat===2&&s.kind==='chat'&&random()<.12+Math.abs(a.personality.directness-b.personality.directness)*.2)s.kind='argue';
  // A is the actual initiator/holder of the stated need; B is its recipient.
  // Keep reciprocal conversations alternating, but attribute self-disclosure to its owner.
  const speakerRoles={borrow:'aabb','return-item':'aabb',celebrate:'aabb','resource-share':'aaba',comfort:'aaba','clarify-belief':'aaba',mediate:'aaba',confess:'aaba',help:'aaba',boundary:'aaba',complain:'aaba',question:'aaba',alliance:'aaba','mole-task':'aaba',contest:'abab'};
  const speaker=(speakerRoles[s.kind]||'baba')[beat]==='a'?a:b,listener=speaker===a?b:a;s.speakerId=speaker.id;a.speech='';b.speech='';
  const lines={chat:['嗨，今天过得怎么样？',`我刚才在想${s.topic}。`,'你的想法和我有点不一样，挺有意思。','下次见面再接着说吧。'],share:['终于碰见你啦！',`说起${s.topic}，我有个新发现。`,'这个我也喜欢！愿意再讲一点吗？','下次我们可以一起试试看。'],play:['要不要一起活动一下？',`就把${s.topic}当作今天的主题！`,'哈哈，我们好像没有跟上同一个节拍。','不过这样也很好玩。'],argue:['我有些不同的想法。',`关于${s.topic}，我可不这么看。`,'这句话让我有点不舒服。','我们先各自冷静一下吧。'],apologize:['上次的事，我一直记着。',`说起${s.topic}时，我可能太直接了。`,'谢谢你愿意说出来，我也需要想一想。','不着急，我们慢慢来。']};
  Object.assign(lines,{alliance:['要不要互相照应？','接下来的任务，我们可以结伴。','我会考虑我们能不能配合。','那明天再一起完成一件小事吧。'],confess:['我想认真说一件事。','相处下来，我对你有了好感。','谢谢你告诉我，我也想清楚自己的感受。','你的选择我会尊重。'],question:['有件旧事我一直没弄明白。','我们都经历过，我想听听你的说法。','我可以告诉你我当时的想法。','至少这次我们说清了一些。'],help:['你看起来有点疲惫。','需要我陪你坐一会儿吗？','谢谢你留意到我的状态。','先照顾好自己，事情可以慢慢来。'],boundary:['我想说一下自己的边界。','有些时候，我需要不被打扰。','我听到了，但也需要你说明白。','我们可以试着找到合适的距离。'],collaborate:['我们喜欢的东西有点相似。',`一起围绕${s.topic}做个小作品吧。`,'我有个可以接上的点子。','这次合作让我离目标近了一点。'],complain:['刚才的服务出了点问题。','这是我亲自遇到的，不是听别人说。','我们先把问题和需求说清。','我希望下次能有明确的处理。']});
  Object.assign(lines,expandedLines(s,a,b));
  lines.contest=['接受公开节拍挑战，奖品是一份食物。','跟着四拍动作，保持自己的节奏。','继续完成动作，最后按同一规则计分。','动作完成了，现在可以公布成绩。'];
  lines['mole-task']=['我有个具体的问题想问你。',s.topic,b.personality.directness>.5?'我愿意说自己的意见，但不接受预设结论。':'我不想回答这个问题，请尊重我的选择。','你的回应我听到了。'];
  speaker.speech=lines[s.kind][beat];if(beat===0&&s.resolvesSceneId)speaker.speech=`接着之前没聊完的「${s.topic}」，我们继续说吧。`;
  if(beat===0&&!s.resolvesSceneId&&['chat','share','play'].includes(s.kind)){
   const memory=[...speaker.memories,...speaker.knowledge.filter(k=>k.source==='experienced')].sort((x,y)=>x.time-y.time).reverse().find(m=>m.otherId===listener.id&&m.topic);
   const known=speaker.relationships[listener.id].met||speaker.relationships[listener.id].familiarity>=5||speaker.relationships[listener.id].lastInteraction>-999;speaker.speech=memory?`还记得上次聊的${memory.topic}吗？${memory.kind==='disagreed'?'这次我想先听听你。':'我后来又想到了。'}`:!known?'我们还没好好认识过，你好！':speaker.speech;
  }
  // Greeting is where two guests actually meet; remember it even if the talk is later cut short.
  if(beat===0)for(const[self,other]of[[a,b],[b,a]]){const r=self.relationships[other.id];if(!r.met){r.met=true;r.familiarity=clamp(r.familiarity+2);}}
  if(layout)emit('dialogue',[a.id,b.id],`${speaker.name}：“${speaker.speech}”`,{sourcePart:beat===0?'context':beat===1?'action':'reaction',sceneId:String(s.id),sourceType:s.kind,speakerId:speaker.id,reason:s.reason});
  speaker.gesture=['borrow','return-item','resource-share'].includes(s.kind)?'share':s.kind==='celebrate'?'dance':s.kind==='play'?'dance':s.kind==='share'?'share':s.kind==='argue'?'argue':s.kind==='apologize'?'apologize':'talk';listener.gesture='listen';if(s.kind==='contest'&&beat>=1){speaker.gesture='dance';listener.gesture='dance';}a.activity=s.kind;b.activity=s.kind;a.label=LABELS[s.kind];b.label=LABELS[s.kind];
 }
 // Local disc separation supplements the route graph. Deterministic ordering and
 // a tie direction avoid zero-distance lockups at shared junctions.
 function separateActors(){
  for(let pass=0;pass<6;pass++){
   // The bunting posts sit beside old plaza waypoints; preserve body clearance.
   for(const a of state.actors)for(const [x,z,r]of (layout?layout.navigation.obstacles.map(o=>[o.x,o.z,o.r+.25]):[[-3.1,-1.9,.46],[3.1,-1.9,.46],[-5,4,.65]])){let dx=a.x-x,dz=a.z-z,d=Math.hypot(dx,dz);if(d>=r)continue;if(d<1e-8){dx=1;dz=0;d=1;}a.x=x+dx/d*r;a.z=z+dz/d*r;}
   for(let i=0;i<state.actors.length;i++)for(let j=i+1;j<state.actors.length;j++){
   const a=state.actors[i],b=state.actors[j];let dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(d>=.62)continue;
   if(d<1e-8){const angle=(i*7+j*11)*1.19;dx=Math.cos(angle);dz=Math.sin(angle);d=1;}else{dx/=d;dz/=d;}
   const distance=Math.hypot(b.x-a.x,b.z-a.z),push=.625-distance;
   // Passers-by yield around established conversation marks instead of
   // shoving two speakers progressively into each other's personal space.
   const heldA=a.destination?.kind==='social'&&!a.moving,heldB=b.destination?.kind==='social'&&!b.moving;
   const shareA=heldA&&!heldB?0:heldB&&!heldA?1:.5,shareB=1-shareA;
   a.x=clamp(a.x-dx*push*shareA,layout?-8.5:-5.25,layout?11:8.8);a.z=clamp(a.z-dz*push*shareA,-10.8,13.6);b.x=clamp(b.x+dx*push*shareB,layout?-8.5:-5.25,layout?11:8.8);b.z=clamp(b.z+dz*push*shareB,-10.8,13.6);
   }
  }
 }
 return {
  update(dt){if(!Number.isFinite(dt)||dt<0)return;state.accumulator+=Math.min(dt,60);while(state.accumulator+1e-9>=STEP){state.accumulator-=STEP;state.time+=STEP;for(const a of state.actors)advanceActor(a,STEP);advanceQueues(STEP);separateActors();advanceScene(STEP);}},
  getActor:id=>byId(id),getEvents:()=>clone(state.events),getActiveScene:()=>state.resourceScene?clone(state.resourceScene):state.scene?clone(state.scene):null,
  getSnapshot:()=>clone(state),serialize:()=>clone(state),
  setLayout(facilities,navigation,{resume=false,keepScene=false}={}){layout={facilities,navigation};state.productionLayout=true;for(const a of state.actors){a.needs.thirst??=25;a.needs.environment??=10;a.needs.privacy??=15;}if(resume&&state.facilities.length)return;if(keepScene&&state.scene&&!state.scene.resourceSlot){interruptQueueScene('设施调整，排队暂停');state.queues={};for(const a of state.actors)if(!state.scene.participants.includes(a.id))idle(a,1+random()*3);}else{state.scene=null;state.resourceScene=null;state.queues={};for(const a of state.actors)idle(a,1+random()*3);}const actions={heater:['warm','environment','rest'],water:['drink','thirst','eat'],table:['eat','hunger','eat'],tent:['rest','energy','rest'],cabin:['rest','energy','rest'],fire:['sing','fun','dance'],privacy:['read','privacy','read'],interview:['watch','energy','rest']};state.facilities=facilities.filter(f=>actions[f.type]).flatMap(f=>{const slots={water:2,table:4,tent:6,cabin:2,fire:4,privacy:2,interview:1,heater:4}[f.type]||1;const[activity,need,gesture]=actions[f.type],base=navigation.servicePoint(f)||navigation.nearest({x:f.x,z:f.z}),radius=Math.hypot(base.x-f.x,base.z-f.z);const points=[];for(let i=0;i<slots;i++){const angle=i/slots*Math.PI*2;const point={x:f.x+Math.sin(angle)*radius,z:f.z+Math.cos(angle)*radius};if(navigation.clear(point.x,point.z)&&navigation.path({x:0,z:2},point).length)points.push(point);}if(!points.length)points.push(base);return points.map((point,i)=>({id:`${f.id}@${i}`,facilityId:f.id,...point,activity,need,gesture,owner:null,place:f.name||LABELS[activity]}));});for(const a of state.actors){if(!navigation.clear(a.x,a.z)){const p=navigation.nearest(a);a.x=p.x;a.z=p.z;}}},
  replaceActor(oldId,definition){
   const old=byId(oldId);if(!old||!definition?.id||!definition?.name||state.actors.some(a=>a.id===definition.id&&a.id!==oldId))return{ok:false,reason:'替补人物或被替换者无效'};
   if(state.resourceScene?.participants.includes(oldId))interruptQueueScene('嘉宾离场，排队争议中断');
   if(state.scene?.participants.includes(oldId)){const participants=state.scene.participants;for(const id of participants)idle(byId(id),2);emit('interrupted',participants,'嘉宾离场，交谈中断。');state.scene=null;}
   abandonPending(p=>p.participants.includes(oldId),'嘉宾离岛或替补入场，原待续话题放弃。');release(old);state.alumni[oldId]=clone(old);
   for(const item of state.items)if(item.holderId===oldId&&item.ownerId!==oldId)item.holderId=item.ownerId;
   const others=state.actors.filter(a=>a!==old),freshDefinitions=[definition,...others.map(a=>({id:a.id,name:a.name,anchor:[a.x,a.z]}))];
   const fresh=state.alumni[definition.id]?clone(state.alumni[definition.id]):clone(createSimulation({actors:freshDefinitions,seed:state.rng}).getActor(definition.id));
   Object.assign(fresh,{id:definition.id,name:definition.name,x:definition.anchor?.[0]??0,z:definition.anchor?.[1]??2,unavailable:false,activity:'idle',label:LABELS.idle,gesture:'rest',speech:'',route:[],destination:null,moving:false,timer:2,cooldown:0});
   const empty=()=>({affinity:0,trust:0,familiarity:0,attraction:0,resentment:0,alliance:false,romance:false,met:false,lastInteraction:-999,cooldown:0});
   for(const other of others){fresh.relationships[other.id]??=empty();other.relationships[fresh.id]??=empty();if(definition.knownRelation?.id===other.id){fresh.relationships[other.id].bond=definition.knownRelation.label||definition.knownRelation.type||'前任';fresh.relationships[other.id].familiarity=Math.max(fresh.relationships[other.id].familiarity,55);}}
   if(layout){fresh.needs.thirst??=25;fresh.needs.environment??=10;fresh.needs.privacy??=15;}
   if(layout&&!layout.navigation.clear(fresh.x,fresh.z)){const safe=layout.navigation.nearest(fresh);fresh.x=safe.x;fresh.z=safe.z;}
   state.actors[state.actors.indexOf(old)]=fresh;if(!state.items.some(i=>i.ownerId===fresh.id))state.items.push({id:`keepsake-${fresh.id}`,name:'随身纪念物',ownerId:fresh.id,holderId:fresh.id,borrowedAt:0});
   return{ok:true,reason:`${fresh.name}已加入，其他嘉宾的经历与模拟时间保留。`};
  },
  setPublicRule(rule){state.productionRules.rule=rule?clone(rule):null;},
  onPublicReward(effect){this.applyPublicReward(effect);},
  setProductionRules({day,rule}={}){state.productionRules={day:day??state.productionRules.day,rule:rule?clone(rule):null};prunePending();},
  applyPublicReward({actorId,units,leaderId}){const a=byId(actorId);if(!a||!Number.isFinite(units)||units<=0)return;a.needs.hunger=clamp(a.needs.hunger-units*8);remember(a,'public-reward',`依公开规则获得${units}份食物奖励`,leaderId);emit('public-reward',[actorId],`${a.name}按公开规则领取了${units}份食物奖励。`,{sourcePart:'result'});},
  resumeConversation:(a,b)=>continueConversation(a,b),
  proposeInteraction:(a,b,kind)=>invite(byId(a),byId(b),'proposal',kind),
  requestDirectorTask({kind,a,b,instructionId,topic}={}){const actor=byId(a),other=byId(b);if(!['contest','mole-task'].includes(kind)||!actor||!other||!instructionId)return{ok:false,reason:'导演任务格式不完整'};
   if(kind==='mole-task'){state.directorOrders??=[];if(state.directorOrders.some(o=>o.instructionId===instructionId))return{ok:false,reason:'指令已经处理'};state.directorOrders.push({instructionId,actorId:a,targetId:b,topic:String(topic||'你认为今天的资源分配公平吗？').slice(0,80),time:state.time});remember(actor,'director-order','收到导演指定质疑话题',b);}
   if(kind==='mole-task'&&random()<actor.personality.kindness*.25){remember(actor,'director-order-refused','拒绝导演的质疑任务',b);return{ok:false,reason:'内应认为话题不合适，拒绝执行'};}const reply=invite(actor,other,'director',kind);if(reply.ok){state.scene.instructionId=instructionId;if(kind==='mole-task')state.scene.topic=state.directorOrders.at(-1).topic;state.scene.reason=kind==='contest'?'公开节拍挑战：双方同意参与，完成后核对一份食物奖品。':'内应收到可拒绝的导演指定话题，对方仍可拒绝回答。';}return reply;
  },
  onContestReward({actorId,units,instructionId}){const a=byId(actorId);if(!a||units!==1)return;state.contestRewards??=[];if(state.contestRewards.includes(instructionId))return;state.contestRewards.push(instructionId);a.needs.hunger=clamp(a.needs.hunger-8);remember(a,'contest-reward','实际领取比赛食物奖品');emit('contest-reward',[actorId],`${a.name}领取一份食物奖品。`,{sourcePart:'result',instructionId});},
  setServiceHandler(handler){serviceHandler=handler;},
  setAvailability(id,enabled){const a=byId(id);if(!a)return;if(!enabled)abandonPending(p=>p.participants.includes(id),'嘉宾医疗休整或离场，待续话题放弃。');if(!enabled&&state.resourceScene?.participants.includes(id))interruptQueueScene('医务或离场中断排队争议');if(!enabled&&state.scene?.participants.includes(id)){const participants=state.scene.participants;for(const pid of participants)idle(byId(pid),3);state.scene=null;emit('interrupted',participants,`${a.name}离开现场，交谈中止。`);}idle(a,2);a.unavailable=!enabled;if(!enabled)a.label='场外休整';},
  endSegment(){interruptQueueScene('录制段结束，排队争议中断');state.queues={};if(state.scene){retainConversation(state.scene);const participants=state.scene.participants;emit('interrupted',participants,'录制段结束，未完成的交谈保留现场记录。',{sceneId:String(state.scene.id)});state.scene=null;}for(const a of state.actors)idle(a,1);},
  interview(id){const a=byId(id);if(!a)return{ok:false,reason:'嘉宾不在场'};if(a.unavailable||a.moving||state.scene?.participants.includes(id)||a.needs.energy>85||a.cooldown>state.time){emit('interview-declined',[id],`${a.name}暂时不愿接受采访。`);return{ok:false,reason:'嘉宾希望稍后再谈'};}const memory=a.memories.at(-1);a.speech=memory?.text||`我现在最在意${a.personality.interests[0]}。`;emit('interview',[id],`${a.name}接受采访：${a.speech}`,{sourcePart:'context',sceneId:`interview-${state.eventId+1}`});return{ok:true,reason:'采访已录制，是否入库取决于机位覆盖'};},
  introduce:(a,b)=>invite(byId(a),byId(b),'player'),
  teachTopic(id,text){const a=byId(id);if(!a||typeof text!=='string')return {ok:false,reason:'请选择岛民并输入话题'};const clean=text.trim().replace(/[\u0000-\u001f]/g,'').slice(0,32);if(!clean)return{ok:false,reason:'话题不能为空'};if(!a.topics.includes(clean)){a.topics.push(clean);if(a.topics.length>8)a.topics.shift();remember(a,'learned',`记住了话题：${clean}`);}return{ok:true,reason:'记住了，也许下次聊天会提起'};},
  gift(id,itemId){const a=byId(id);const items={snack:{interest:'甜点',need:'hunger',name:'小点心'},book:{interest:'阅读',need:'fun',name:'一本书'},music:{interest:'音乐',need:'fun',name:'音乐唱片'}};const item=items[itemId];if(!a||!item)return{ok:false,reason:'未知礼物'};if(!available(a))return{ok:false,reason:a.cooldown>state.time?'现在想自己待一会儿，稍后再送吧':'等他们忙完再送礼物吧'};const likes=a.personality.interests.includes(item.interest);a.preferences[itemId]=likes?'喜欢':'普通';a.needs[item.need]=clamp(a.needs[item.need]-(likes?28:12));remember(a,'gift',`${item.name}：${likes?'很喜欢':'谢谢你的心意'}`);a.speech=likes?'这正是我喜欢的！':'谢谢你的心意。';a.timer=4;a.gesture='wave';return{ok:true,reason:a.speech};}
 };
}

