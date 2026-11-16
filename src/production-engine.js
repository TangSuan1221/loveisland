import {snapshot,gridDelta,validateCamp,unpack} from './camp/archive.js';
import {campStory} from './camp/stories.js';
import {isCampWinter,advanceCamp} from './camp/day.js';
import {facilityPosition,facilityConflict} from './camp/footprints.js';
import {editCamp,newCamp,newIslandCamp,makeGrid,overlapsFacility} from './camp/model.js';
// Production rules are independent of rendering and NPC dialogue. Only observe()
// can turn an actual, external scene event into immutable facts and film cards.
import { normalizeAppearance } from './avatar-schema.js';
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (v, min=0, max=100) => Math.max(min, Math.min(max,v));
export const SUPPLY_PRICES={food:45,water:25,power:60};
export const FACILITY_TYPES = [
 {id:'water',name:'公共水站',cost:2400,maintenance:120,capacity:2,radius:1.2,description:'提供饮水，排队与距离改变共同活动机会。'},
 {id:'table',name:'共享餐台',cost:2600,maintenance:150,capacity:4,radius:1.5,description:'食物服务与共同用餐，靠近水站可提高相遇机会。'},
 {id:'tent',name:'普通营地',cost:3600,maintenance:100,capacity:6,radius:1.7,description:'基础睡眠与遮蔽，开录前需要足够床位。'},
 {id:'cabin',name:'舒适小屋',cost:7000,maintenance:260,capacity:2,radius:2,description:'缓解疲惫和环境压力，公开奖励可形成差异。'},
 {id:'fire',name:'篝火谈话区',cost:2200,maintenance:100,capacity:4,radius:1.5,description:'安排共同活动，创造交流机会但不指定结果。'},
 {id:'interview',name:'公共采访间',cost:4800,maintenance:180,capacity:1,radius:1.5,description:'允许采访取得语境；被采访者可以拒绝。'},
 {id:'camera',name:'固定机位',cost:4200,maintenance:160,capacity:1,radius:.7,coverage:11,description:'摄录范围内的真实行为，多个机位提高语境覆盖。'},
 {id:'privacy',name:'独处花园',cost:2800,maintenance:80,capacity:2,radius:1.5,description:'缓解隐私压力；范围内不摄录私人活动。'},
 {id:'heater',name:'集中暖炉',cost:6500,maintenance:220,capacity:4,radius:1,coverage:6,description:'雪山每台可为附近4人提供暖区，每段消耗2电力。'}
];
export const MAPS=[
 {id:'island',name:'初见海岛',cost:0,xp:0,reputation:0,prepFee:8000,description:'温暖海岛：共享补给与公共动线决定相遇机会。',mechanics:{environment:20,privacy:38,heating:false,powerPerSegment:0}},
 {id:'snow',name:'霜岭雪山',cost:35000,xp:80,reputation:55,prepFee:10000,description:'寒冷提高环境不适；暖炉有范围与容量，电力成为新的共享资源。',mechanics:{environment:92,privacy:45,heating:true,powerPerSegment:2}},
 {id:'villa',name:'楚门别墅',cost:60000,xp:140,reputation:65,prepFee:16000,description:'舒适环境降低生存压力，全天摄录提高隐私需要，独处区可恢复边界。',mechanics:{environment:8,privacy:82,heating:false,powerPerSegment:1}}
];
export const STYLES = [
 {id:'documentary',name:'如实观察',description:'保留起因与结果，让行为自己说话。',genre:'observation',claim:'documentary'},
 {id:'connection',name:'关系升温',description:'强调共同经历；需要合作或亲近证据。',genre:'relationship',claim:'connection'},
 {id:'conflict',name:'针锋相对',description:'聚焦分歧；没有冲突证据会构成误导。',genre:'conflict',claim:'conflict'},
 {id:'rejection',name:'被拒绝的人',description:'以拒绝为主线；邀请未成不等于被背叛。',genre:'relationship',claim:'rejection'},
 {id:'repair',name:'冲突后的修复',description:'让道歉、帮助和澄清成为故事结果。',genre:'relationship',claim:'repair'},
 {id:'cliffhanger',name:'未完待续',description:'保留悬念，须在后两集交代真实结果。',genre:'conflict',claim:'cliffhanger'}
];
export const UPGRADES = [
 {id:'lenses',name:'多机位工作流',cost:12000,xp:20,description:'摄录覆盖增加3米，完整上下文更容易获得。'},
 {id:'research',name:'人物研究组',cost:10000,xp:25,description:'试镜调查费用减半；解锁更复杂的招募。'},
 {id:'studio',name:'专业后期室',cost:18000,xp:45,description:'可理解性提升，仍不能消除事实矛盾。'},
 {id:'agency',name:'MCN经纪部',cost:20000,xp:55,description:'开放三个管理席位；签约者可录制、商务或休养。'},
 {id:'weather',name:'环境控制台',cost:26000,xp:80,description:'解锁人工天气指令，保障达标才可实施。'}
];
const names=[['lin','林夏','气氛担当','建立真正的朋友','害怕被当成工具人',['热心','合照'],'zhou'],['zhou','周屿','户外玩家','证明自己的组织能力','不愿承认最近失业',['行动派','公平'],'lin'],['qiao','乔乔','创作歌手','争取首支单曲机会','新单曲制作费尚未筹齐，不愿被剪成只谈旧情的人',['音乐','敏感'],'lu'],['lu','陆知','理性观察员','保护个人边界','答应过乔乔不公开分手原因，担心制作方逼问',['克制','直接'],'qiao'],['tang','唐米','甜点主理人','推广自己的小店','店铺现金流紧张',['照顾人','甜点'],'chen'],['chen','陈野','自由摄影师','拍到真实的人','不愿替节目组摆拍',['好奇','自主'],'tang'],['yao','姚晴','过气偶像','寻找重新出发的机会','担心旧人设被推翻',['外向','谨慎'],'xu'],['xu','许舟','职场新人','摆脱配角的位置','欠着培训贷款',['求胜','慢热'],'yao'],['song','宋沅','旅行博主','争取长期品牌合作','流量远低于对外宣称',['表达欲','竞争'],'he'],['he','何川','前运动员','找到退役后的方向','旧伤需要休息',['纪律','公平'],'song'],['ning','宁芙','园艺师','认识工作以外的人','曾拒绝商业人设包装',['温和','隐私'],'bai'],['bai','白野','创业者','修复公众形象','上一家公司已经破产',['自信','防御'],'ning']];
export const CANDIDATES=names.map((r,i)=>({id:r[0],name:r[1],role:r[2],goal:r[3],secret:r[4],traits:r[5],knownRelation:i===2||i===3?{id:r[6],label:'前任'}:null,cost:1800+i*180,avatarId:names[i%6][0],cooperation:80,secretKnown:false,mole:i===0||i===8,experienceRequired:i<6?0:15}));
const PART_NAMES={context:'起因',action:'行动',reaction:'回应',result:'结果'};
const GENRE={'water-shared':'relationship',comforted:'relationship','milestone-celebrated':'relationship','item-borrowed':'observation','item-returned':'observation','belief-corrected':'observation','belief-unresolved':'observation','promise-discussed':'observation','mediation-offered':'observation','sharing-unavailable':'observation','borrow-declined':'observation',allied:'relationship','mutual-feeling':'relationship','created-together':'relationship',supported:'relationship','feelings-declined':'relationship','alliance-declined':'relationship','boundary-disagreed':'conflict','queue-argue':'conflict','queue-apology':'relationship','boundary-respected':'observation',clarified:'observation','concern-raised':'observation','queue-yield':'observation','queue-avoid':'observation',connected:'relationship',reconciled:'relationship',enjoyed:'relationship',declined:'relationship',disagreed:'conflict',unresolved:'conflict',share:'relationship',play:'relationship',argue:'conflict',apologize:'relationship',invitation:'observation',interview:'observation',activity:'observation',cancelled:'observation'};
const PHASES=['title','casting','build','recording','editing','broadcast','season','management','crisis','victory','bankrupt'];
export function createProduction({saved=null,seed=20261112,resetProgress=false,spatial=false,starterCamp=false}={}){
 let s={version:1,seed:seed>>>0,phase:'title',mode:'tutorial',cash:100000,initialCash:100000,season:1,day:1,businessDay:1,seasonDays:3,castSize:4,candidates:clone(CANDIDATES),cast:[],facilities:[],facts:[],clips:[],timeline:[],episodes:[],cases:[],ledger:[],audiences:[{id:'relationship',name:'关系观众',size:42,trust:75,fatigue:0,satisfaction:50},{id:'conflict',name:'冲突观众',size:35,trust:70,fatigue:0,satisfaction:50},{id:'observation',name:'观察观众',size:38,trust:80,fatigue:0,satisfaction:50}],inventory:{food:24,water:32,power:20},directorPoints:3,experience:0,reputation:55,upgrades:[],roster:[],rivals:[{id:'old',name:'老东家·星潮台',valuation:70000,share:28,acquired:false},{id:'group',name:'镜界传媒集团',valuation:110000,share:40,acquired:false}],segment:0,segmentElapsed:0,segmentDuration:45,segmentReady:false,paused:false,speed:1,interventions:[],cooperation:{},publicImpressions:{},knowledge:{},health:{},status:{},warnings:[],promises:[],preview:null,lastBroadcast:null,seasonReport:null,loan:null,loanUsedSeason:0,profitableSeasons:0,seasonStartCash:100000,seasonCapital:0,sponsorPaid:0,adRate:180,seenEvents:[],serial:0,unpaid:[],resumePhase:null,objective:'接下第一季委托，成为真正的综艺制作人。',selectedMap:'island',maps:['island'],catalog:{facilities:clone(FACILITY_TYPES),styles:clone(STYLES),upgrades:clone(UPGRADES)}};
 // Reopening keeps authored characters only, never money, contracts or NPC history.
 if(saved&&resetProgress){
  const previous=typeof saved==='string'?JSON.parse(saved):clone(saved);
  if(!Array.isArray(previous?.candidates))throw new Error('人物库无法读取');
  for(const person of previous.candidates){
   if(!person||typeof person.id!=='string')continue;
   const original=s.candidates.find(c=>c.id===person.id);
   if(original){
    if(typeof person.name==='string'&&person.name.trim())original.name=person.name;
    if(person.appearance)original.appearance=person.appearance;
   }else if(person.custom){
    s.candidates.push({...person,secretKnown:false,hasAppeared:false});
    const serial=Number(person.id.split('-').at(-1));
    if(Number.isSafeInteger(serial)&&serial>=0)s.serial=Math.max(s.serial,serial);
   }
  }
 }
 if(saved&&!resetProgress){const c=typeof saved==='string'?JSON.parse(saved):clone(saved);if(c?.version!==1||!PHASES.includes(c.phase)||!Number.isFinite(c.cash)||!Array.isArray(c.ledger)||!Array.isArray(c.facts)||!Array.isArray(c.clips)||!Array.isArray(c.cases)||!Array.isArray(c.cast)||!c.inventory||!c.cooperation)throw new Error('制作人存档不兼容；请保留原档并开始新档。');if(c.camp)validateCamp(c.camp);s=c;}
 if(spatial){s.camp??=(starterCamp&&(!saved||resetProgress)?newIslandCamp():newCamp());if(starterCamp)s.camp.islandArtGrid=true;if(!s.camp.bought){const previous=s.camp;s.camp=Object.assign(newCamp(),previous);for(const kind of new Set([...Object.keys(previous.inventory),...previous.placed.map(v=>v.kind)]))s.camp.bought[kind]=(previous.inventory[kind]||0)+previous.placed.filter(v=>v.kind===kind).length;}}
 for(const person of s.candidates)if(person.appearance)person.appearance=normalizeAppearance(person.appearance);
 s.market??={pool:160,report:[]};s.rivals.forEach((r,i)=>{r.baseValuation??=r.valuation;r.budget??=12000+i*6000;r.quality??=52+i*6;});
 s.catalog.maps=clone(MAPS);s.catalog.facilities=clone(FACILITY_TYPES);s.regulation??={level:0,status:'normal',untilBusinessDay:0,trainingDone:false,reason:''};
 for(const promise of s.promises){const sources=s.facts.filter(f=>(promise.sourceEvents||[]).includes(f.id));promise.sourceSceneIds??=[...new Set(sources.map(f=>f.sceneId).filter(x=>x!==null&&x!==undefined))];promise.participants??=[...new Set(sources.flatMap(f=>f.participants||[]))];promise.sourceIds??=[...new Set(sources.map(f=>f.sourceId))];}
 s.pendingInterventions??=[];
 s.segmentExtensionsUsed??=0;s.segmentBaseDuration??=s.segmentDuration-s.segmentExtensionsUsed*15;s.recordingElapsed??=0;if(s.segmentReady){s.segmentReady=false;s.segment++;s.segmentElapsed=0;s.segmentDuration=s.segmentBaseDuration;}
 s.reserves??=[];s.replacementHistory??=[];s.replacementCount??=0;s.unavailableSince??={};for(const who of s.cast)if(['left','medical'].includes(s.status[who]))s.unavailableSince[who]??=s.medicalSince?.[who]?.day??s.day;
 s.dailyCommission??=null;s.catalog.music=[{id:'none',name:'现场原声'},{id:'warm',name:'温暖'},{id:'tense',name:'紧张'},{id:'sad',name:'伤感'}];
 s.publicRules??={water:null};s.publicRuleLog??=[];s.publicRewards??=[];
 let effects=[];
 const id=p=>`${p}-${s.season}-${s.day}-${++s.serial}`;
 const result=(ok,message)=>({ok,message});
 const emit=(type,data={})=>effects.push({type,...clone(data)});
 const facility=id=>FACILITY_TYPES.find(f=>f.id===id);
 const candidate=id=>s.candidates.find(c=>c.id===id);
 const map=()=>MAPS.find(m=>m.id===s.selectedMap)||MAPS[0];
 const openingReserve=()=>map().prepFee+20000+(s.selectedMap==='snow'?13000:0)+12000;
 // Recording has no forced cut-off; time-of-day periods roll over without interrupting guests.
 const canExtendRecording=()=>false;
 const resetSegmentClock=()=>{s.segmentElapsed=0;s.segmentExtensionsUsed=0;s.segmentDuration=s.segmentBaseDuration;};
 const buildWindow=()=>s.phase==='build'||(s.phase==='recording'&&s.paused)||s.phase==='crisis';
 function ledger(key,amount,label,{necessary=false}={}){
  if(s.ledger.some(t=>t.id===key))return true;
  amount=Math.round(amount);if(!Number.isFinite(amount))return false;
  if(amount<0&&s.cash+amount<0){if(necessary&&!s.unpaid.some(t=>t.id===key)){s.unpaid.push({id:key,amount,label});if(s.phase!=='crisis')s.resumePhase=s.phase;s.phase='crisis';s.objective='必要费用到期：出售资产、申请过桥贷款或清算公司。';}return false;}
  const before=s.cash;s.cash+=amount;s.ledger.push({id:key,day:s.businessDay,season:s.season,amount,label,before,after:s.cash});return true;
 }
 function settleUnpaid(){for(const t of [...s.unpaid])if(ledger(t.id,t.amount,t.label))s.unpaid=s.unpaid.filter(x=>x.id!==t.id);if(!s.unpaid.length&&s.phase==='crisis'){s.phase=s.resumePhase||'build';s.resumePhase=null;if(s.pendingMaintenanceSeasonEnd){s.pendingMaintenanceSeasonEnd=false;endSeason();}}}
 function placementValid(type,x,z,ignore=null,rot=0){
  if(!facility(type)||!Number.isFinite(x)||!Number.isFinite(z)||x< -8||x>9||z< -10||z>10)return '请放在可建设的平坦生活区内。';
  if(Math.abs(x)<1.6&&z<3&&z> -2)return '中央通行与应急走廊必须保持畅通。';
  if(spatial&&s.selectedMap==='island')return facilityConflict(makeGrid(s.camp||newCamp(),s.businessDay),{type,x,z,rot},s.facilities,ignore);
  const radius=facility(type).radius;
  if(spatial&&s.selectedMap==='island'&&s.camp?.placed.some(b=>overlapsFacility(b,{x,z,radius})))return '这里已有营地建筑。';
  if(s.facilities.some(f=>f.id!==ignore&&Math.hypot(f.x-x,f.z-z)<facility(f.type).radius+radius+.3))return '设施间距不足，入口和应急道路需要留空。';
  return null;
 }
 function previewFacility(type,x,z,rot=0,ignore=null){
  const pos=spatial&&s.selectedMap==='island'?facilityPosition(type,x,z,rot):{x,z};
  if(!pos)return {ok:false,message:'设施坐标或旋转无效。'};
  const message=placementValid(type,pos.x,pos.z,ignore,rot);return {...pos,ok:!message,message:message||''};
 }
 function place(type,x,z,rot=0){const placement=previewFacility(type,x,z,rot);if(!placement.ok)return result(false,placement.message);const f=facility(type);if(!ledger(id('build'),-f.cost,`建造${f.name}`))return result(false,'现金不足，无法购买设施。');s.facilities.push({id:id('facility'),type,name:f.name,x:placement.x,z:placement.z,...(placement.rot===undefined?{}:{rot:placement.rot}),cost:f.cost,condition:100,movedDay:0,enabled:true});emit('placement',{facilities:s.facilities});return result(true,`${f.name}已建成。`);}
 function currentDayClips(){return s.clips.filter(c=>c.season===s.season&&c.day===s.day);}
 function captureEligibility(event){
  if(s.phase!=='recording'||s.paused||s.segmentReady)return {ok:false,reason:'当前不在运行录制时段。'};
  if(!event||typeof event.type!=='string'||typeof event.text!=='string'||!Array.isArray(event.participants)||!event.participants.some(p=>s.cast.includes(p))||(typeof event.id!=='string'&&!Number.isFinite(event.id)))return {ok:false,reason:'事件格式或对象无效。'};
  if(s.seenEvents.includes(`${s.season}:${event.id}`))return {ok:false,reason:'事件已归档。'};
  if(['interrupted','cancelled','interview-declined','continuation-abandoned'].includes(event.type))return {ok:false,reason:'后台过程没有可播摄录。'};
  const x=Number.isFinite(event.x)?event.x:0,z=Number.isFinite(event.z)?event.z:1;
  // A designated private space retains its camera exclusion even while worn out;
  // only physically removing that facility removes the protected boundary.
  if(s.facilities.some(f=>f.type==='privacy'&&Math.hypot(f.x-x,f.z-z)<2))return {ok:false,reason:'独处区禁止任何摄录，包括采访。'};
  if(s.inventory.power<=0)return {ok:false,reason:'电力不足，没有可播素材。'};
  const cameras=s.facilities.filter(f=>f.type==='camera'&&f.enabled&&Math.hypot(f.x-x,f.z-z)<facility('camera').coverage+(s.upgrades.includes('lenses')?3:0));
  const forceCapture=event.type==='interview'&&s.facilities.some(f=>f.type==='interview'&&f.enabled);
  if(!cameras.length&&!forceCapture)return {ok:false,reason:'有效机位或采访间未覆盖，没有可播素材。'};
  return {ok:true,reason:'允许摄录。',cameras,forceCapture};
 }
 function addFact(event){
  if(!event||typeof event.type!=='string'||!Array.isArray(event.participants)||typeof event.text!=='string')return result(false,'事件格式不完整。');
  const participants=[...new Set(event.participants.filter(p=>s.cast.includes(p)))];if(!participants.length)return result(false,'事件没有本季嘉宾。');
  if(typeof event.id!=='string'&&!Number.isFinite(event.id))return result(false,'事件需要稳定的源ID。');
  const key=`${s.season}:${event.id}`;if(s.seenEvents.includes(key))return result(false,'此事件已经归档。');const capture=captureEligibility(event);s.seenEvents.push(key);
  const x=Number.isFinite(event.x)?event.x:0,z=Number.isFinite(event.z)?event.z:1;
  const fact={id:id('fact'),sourceId:event.id,resolvesSceneId:event.resolvesSceneId??null,resolvesSourceId:event.resolvesSourceId??null,resolvesEventId:event.resolvesEventId??null,instructionId:event.instructionId??null,winnerId:event.winnerId??null,scores:event.scores??null,sceneId:event.sceneId??null,sourcePart:event.sourcePart??null,sourceType:event.sourceType??event.type,season:s.season,day:s.day,businessDay:s.businessDay,segment:s.segment,type:event.type,participants,text:event.text,x,z,reason:event.reason||'嘉宾根据当下需求与关系自主行动',result:event.result||event.type,genre:GENRE[event.type]||GENRE[event.sourceType]||'observation',witnesses:[...participants],thumbnail:capture.ok&&typeof event.thumbnail==='string'?event.thumbnail:null};s.facts.push(fact);
  if(!capture.ok)return result(true,`事实已记录；${capture.reason}`);
  const {forceCapture,cameras}=capture;
  const parts=PART_NAMES[event.sourcePart]?[event.sourcePart]:event.type==='interrupted'?['action','reaction']:forceCapture||cameras.length>1?['context','action','reaction','result']:['action','reaction','result'];
  for(const part of parts)s.clips.push({id:id('clip'),eventId:fact.id,sceneId:fact.sceneId,season:s.season,day:s.day,part,partName:PART_NAMES[part],participants:[...participants],text:fact.text,genre:fact.genre,title:`${participants.map(p=>candidate(p)?.name||p).join('与')} · ${PART_NAMES[part]}`,coverage:event.sourcePart?1:parts.length/4,emotion:['disagreed','declined','reconciled'].includes(event.type)?.85:.55,used:0,thumbnail:fact.thumbnail});
  return result(true,`摄录归档：${parts.length}张真实素材卡。`);
 }
 function evaluate(slots=s.timeline){
  const errors=[],all=[],genres={relationship:0,conflict:0,observation:0};let bias=0,quality=0;const risks=[];
  for(const [index,slot]of slots.entries()){
   const cards=(slot.clipIds||[]).map(cid=>s.clips.find(c=>c.id===cid)).filter(Boolean);const style=STYLES.find(t=>t.id===slot.style)||STYLES[0];
   if(cards.length<2||cards.length>4||cards.length!==(slot.clipIds||[]).length)errors.push(`第${index+1}段需要2至4张有效素材卡。`);
   if(new Set(slot.clipIds||[]).size!==cards.length)errors.push(`第${index+1}段不可重复使用同一张卡。`);
   const facts=cards.map(c=>s.facts.find(f=>f.id===c.eventId));const types=facts.flatMap(f=>[f.type,f.sourceType]);const parts=cards.map(c=>c.part);let d=0;
   const music=['warm','tense','sad'].includes(slot.music)?slot.music:'none';if(music!=='none'){quality+=.02;if((music==='tense'&&!types.some(t=>['disagreed','unresolved','argue'].includes(t)))||(music==='sad'&&!types.some(t=>['declined','unresolved'].includes(t)))||(music==='warm'&&types.includes('disagreed')))d+=.06;}
   if(style.id==='connection'&&!types.some(t=>['connected','enjoyed','reconciled','allied','mutual-feeling','created-together','supported','water-shared','comforted','milestone-celebrated'].includes(t)))d+=.6;
   if(style.id==='conflict'&&!types.some(t=>['disagreed','unresolved','boundary-disagreed','queue-argue'].includes(t)))d+=.65;
   if(style.id==='rejection'&&!types.some(t=>['declined','feelings-declined','alliance-declined'].includes(t)))d+=.7;
   if(style.id==='repair'&&!types.some(t=>['reconciled','queue-apology'].includes(t)))d+=.55;
   if(new Set(cards.map(c=>c.sceneId||c.eventId)).size>1&&!slot.recap)d+=.16;
   if(cards.some(c=>c.day!==s.day||c.season!==s.season)&&!slot.recap)d+=.2;
   const order={context:0,action:1,reaction:2,result:3};if(cards.some((c,i)=>i&&(c.sceneId||c.eventId)===(cards[i-1].sceneId||cards[i-1].eventId)&&order[c.part]<order[cards[i-1].part]))d+=.18;
   if(style.id!=='documentary'&&!parts.includes('result'))d+=.16;
   const fresh=cards.reduce((v,c)=>v+(c.used? .35:1),0)/Math.max(cards.length,1);
   const completeness=(parts.includes('context')?.2:0)+(parts.includes('action')?.25:0)+(parts.includes('reaction')?.2:0)+(parts.includes('result')?.35:0);
   quality+=.3*completeness+.25*(cards.reduce((v,c)=>v+c.emotion,0)/Math.max(cards.length,1))+.25*(new Set(cards.map(c=>c.sceneId||c.eventId)).size===1?1:.5)+.2*fresh;
   d=clamp(d,0,1);bias+=d;genres[style.genre]++;if(d>.15)risks.push(`第${index+1}段：${d>.5?'命题与证据不符':'语境或时间顺序有偏差'}`);all.push(...cards);
  }
  const shared=slots.length?slots.map(slot=>new Set((slot.clipIds||[]).flatMap(cid=>s.clips.find(c=>c.id===cid)?.participants||[]))).reduce((a,b)=>new Set([...a].filter(x=>b.has(x)))):new Set();
  if(slots.length>1&&!shared.size)errors.push('三个段落需要至少一位共同主角，不能拼成无关片段合集。');
  const unique=new Set(all.map(c=>c.id));if(unique.size<all.length)risks.push('重复素材不重复贡献新鲜度。');
  quality=clamp(quality/Math.max(slots.length,1)+(s.upgrades.includes('studio')?.08:0),0,1);quality*=unique.size/Math.max(all.length,1);bias/=Math.max(slots.length,1);
  const crowd=s.audiences.map(a=>{const match=genres[a.id]/Math.max(slots.length,1);const appeal=clamp(.3+quality*.7+match*.25+(a.id==='conflict'?Math.min(.25,bias*.25):0),0,1.25);const retention=clamp((a.trust/100)*(.85-a.fatigue*.003),.2,1);return {id:a.id,name:a.name,viewers:Math.round(a.size*appeal*retention),match};});
  const controversyBoost=Math.min(.25,Math.max(0,bias)*.4);for(const c of crowd)c.viewers=Math.round(c.viewers*(1+controversyBoost));
  const raw=crowd.reduce((sum,c)=>sum+c.viewers,0),rivalDemand=s.rivals.filter(r=>!r.acquired).reduce((sum,r)=>sum+r.budget/1000+r.quality*.6,0),allocation=Math.min(1,s.market.pool/Math.max(raw+rivalDemand,1));
  for(const c of crowd)c.viewers=Math.floor(c.viewers*allocation);
  const rating=crowd.reduce((sum,c)=>sum+c.viewers,0),revenue=rating*s.adRate;
  const target=s.dailyCommission,actual=all.map(c=>s.facts.find(f=>f.id===c.eventId));const proof=target&&actual.some(f=>(target.id==='observation'||f.genre===target.id)&&f.participants.includes(target.protagonistId));const eligible=!!(target&&genres[target.id]>=2&&shared.has(target.protagonistId)&&bias<=.2&&proof);const commission={eligible,bonus:eligible?1200:0,reason:eligible?'主角、真实主题与受众命题达标。':'需两段指定受众命题、共同主角与真实主题证据，偏差不超过20。'};
  return {commission,controversyBoost,quality:Math.round(quality*100),bias:Math.round(bias*100),rating,revenue,risks,errors,validNormal:slots.length===3&&!errors.length,validRescue:slots.length===1&&!errors.length,audiences:crowd,protagonists:[...shared],genres};
 }
 function autoEdit(){
  const groups=new Map();for(const c of s.clips.filter(c=>c.season===s.season)) {const key=c.sceneId||c.eventId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}
  const usable=[...groups.values()].filter(g=>g.length>=2).sort((a,b)=>Number(b.some(c=>c.part==='action')&&b.some(c=>c.part==='result'))-Number(a.some(c=>c.part==='action')&&a.some(c=>c.part==='result'))||b[0].day-a[0].day);
  const editingActors=s.dailyCommission?.protagonistId?[s.dailyCommission.protagonistId]:s.cast;let selected=[];for(const actor of editingActors){const matches=usable.filter(g=>g[0].participants.includes(actor));if(matches.length>selected.length)selected=matches;}
  let count=selected.length>=3?3:selected.length?1:0;s.timeline=selected.slice(0,count).map(g=>({clipIds:['context','action','reaction','result'].map(part=>g.find(c=>c.part===part)).filter(Boolean).map(c=>c.id),style:'documentary',recap:g[0].day!==s.day}));
  if(count<3){let daily=[];for(const actor of editingActors){const cards=s.clips.filter(c=>c.season===s.season&&c.day===s.day&&c.participants.includes(actor));if(cards.length>daily.length)daily=cards;}if(daily.length>=6){count=3;s.timeline=[0,1,2].map(i=>({clipIds:daily.slice(i*2,i*2+2).map(c=>c.id),style:'documentary',recap:true}));}else if(!count&&daily.length>=2){count=1;s.timeline=[{clipIds:daily.slice(0,4).map(c=>c.id),style:'documentary',recap:true}];}}
  s.preview=evaluate();return result(!!count,count===3?'已按共同主角组成三段真实记录；跨活动组接已标注回顾。':count?'素材只能组成补救节目；仍可选择停更。':s.dailyCommission?'委托主角缺少合法素材，请手动调整剪辑、停更或次日改善摄录。':'没有合法素材。请停更并在次日改善摄录。');
 }
 function dueCases(){
  for(const c of s.cases){if(c.status==='latent'&&s.businessDay>=c.revealDay){c.status='open';c.deadline=s.businessDay+1;s.warnings.push(`${candidate(c.person)?.name||'嘉宾'}投诉节目误导，请在经营日${c.deadline}前回应。`);for(const a of s.audiences)a.trust=clamp(a.trust-c.severity*.08);if(c.severity>=60){s.regulation.level++;s.regulation.status=s.regulation.level>=2?'suspended':'warning';s.regulation.reason=s.regulation.level>=2?'连续严重误导节目：先处理已公开案件并完成制作整改。':'收到一次严重节目失实警告。';if(s.regulation.status==='suspended'){s.regulation.untilBusinessDay=s.businessDay+1;s.regulation.trainingDone=false;emit('recording-stop');}}}
   if(c.status==='open'&&s.businessDay>c.deadline){c.status='upheld';ledger(`case-${c.id}`,-c.amount,'争议赔付',{necessary:true});s.reputation=clamp(s.reputation-5);s.cooperation[c.person]=clamp((s.cooperation[c.person]??70)-10);}
  }
 }
 function refreshRegulation(){if(s.regulation.status==='suspended'&&s.businessDay>=s.regulation.untilBusinessDay&&s.regulation.trainingDone&&!s.cases.some(c=>['open','upheld'].includes(c.status))){s.regulation.status='normal';s.regulation.level=0;s.regulation.reason='整改通过，次日可恢复制作。';s.warnings.push('行业审查：整改已通过，可以复工。');}}
 function cancelQueuedInterventions(reason='当前录制段已结束'){
  for(const task of s.pendingInterventions){const record=s.interventions.find(i=>i.id===task.instructionId);if(!record||record.executionState!=='queued')continue;ledger(`intervention-refund-${record.id}`,record.cost,'未执行导演指令退款');s.directorPoints=Math.min(3,s.directorPoints+record.points);record.executionState='cancelled';record.refundAmount=record.cost;record.refundedPoints=record.points;record.cancellationReason=reason;}
  s.pendingInterventions=[];
 }
 function sendIntervention(task){
  const p=task.payload,record=s.interventions.find(i=>i.id===task.instructionId);if(!record||record.executionState!=='queued')return;record.executionState='sent';
  if(p.kind==='group')emit('introduce',{a:p.a,b:p.b,source:p.kind,instructionId:record.id});else if(p.kind==='mole'){emit('mole-task',{a:p.a,b:p.b,instructionId:record.id,topic:String(p.topic||'你认为今天的资源分配公平吗？').slice(0,80)});s.cooperation[p.a]=clamp(s.cooperation[p.a]-4);}else if(p.kind==='contest')emit('contest-request',{a:p.a,b:p.b,instructionId:record.id,prize:{kind:'food',units:1}});
  else if(p.kind==='interview')emit('interview',{a:p.a,instructionId:record.id});else if(p.kind==='feedback'){const text=s.lastBroadcast.comments[0];s.knowledge[p.a]=[...(s.knowledge[p.a]||[]),{episode:s.lastBroadcast.id,text}];s.cooperation[p.a]=clamp(s.cooperation[p.a]-(s.lastBroadcast.bias>35?12:-3));emit('feedback',{a:p.a,text,instructionId:record.id});}else emit('weather',{kind:'rain',instructionId:record.id});
 }
 function flushQueuedInterventions(){const queued=s.pendingInterventions;s.pendingInterventions=[];for(const task of queued)sendIntervention(task);}
 function endSeason(){
  cancelQueuedInterventions('本季已结束，未发送指令取消');
  if(s.seasonReport?.season===s.season){s.phase='season';return result(true,'本季已结算。');}
  for(const f of s.facilities)ledger(`salvage-${f.id}`,Math.round(f.cost*.4*f.condition/100),`${f.name}季末残值`);
  const episodes=s.episodes.filter(e=>e.season===s.season),revenue=episodes.reduce((v,e)=>v+e.revenue,0),expenses=-s.ledger.filter(l=>l.season===s.season&&l.amount<0).reduce((v,l)=>v+l.amount,0),profit=s.ledger.filter(l=>l.season===s.season&&!l.label.includes('借款')&&!l.label.includes('收购')).reduce((v,l)=>v+l.amount,0);
  const rating=episodes.length?Math.round(episodes.reduce((v,e)=>v+e.rating,0)/episodes.length):0;
  for(const p of s.promises.filter(p=>p.season===s.season&&!p.closed)){p.expired=true;if(!p.penalized){p.penalized=true;s.reputation=clamp(s.reputation-2);}}
  s.profitableSeasons=profit>0?s.profitableSeasons+1:0;s.experience+=12+Math.round(rating/5);s.reputation=clamp(s.reputation+(rating>=55?4:-2));
  const active=s.rivals.filter(r=>!r.acquired),demand=active.reduce((v,r)=>v+r.budget/1000+r.quality*.6,0),available=Math.max(0,s.market.pool-rating);
  s.market.report=active.map(r=>{const viewers=Math.min(r.budget/1000+r.quality*.6,available*((r.budget/1000+r.quality*.6)/Math.max(demand,1)));r.share=Math.round(viewers/s.market.pool*100);r.valuation=Math.round(r.baseValuation*(.8+r.share/100));r.quality=clamp(r.quality+(rating>r.quality?2:-1),40,80);r.budget=Math.round(r.baseValuation*.15+r.share*120);return {id:r.id,name:r.name,viewers:Math.round(viewers),share:r.share,valuation:r.valuation,nextQuality:r.quality};});
  s.seasonReport={season:s.season,rating,revenue,expenses,profit,episodes:episodes.length,experienceGained:12+Math.round(rating/5),grade:rating>=85?'S':rating>=65?'A':rating>=45?'B':'C',unresolvedCases:s.cases.filter(c=>!['closed','dismissed'].includes(c.status)).length,market:clone(s.market)};
  s.facilities=[];emit('placement',{facilities:[]});s.phase=s.rivals.every(r=>r.acquired)&&profit>0?'victory':'season';s.objective=s.phase==='victory'?'收购老东家与镜界集团后完成盈利季，传媒帝国成立。':'本季落幕：签约、升级，然后用新的判断制作下一季。';return result(true,'本季残值、节目与成长已经结算。');
 }
 function dayExpenses(){const maintenance=s.facilities.reduce((v,f)=>v+facility(f.type).maintenance,0);const cost=4800+maintenance;ledger(`daily-${s.season}-${s.day}`,-cost,'团队工资、场租与设施维护',{necessary:true});return cost;}
 function broadcast(mode){
  if(s.regulation.status==='suspended')return result(false,'停播期间不能发布节目；请处理案件、整改并结束维护日。');
  const key=`episode-${s.season}-${s.day}`;if(s.episodes.some(e=>e.id===key))return result(false,'今天已经结算，不会重复入账。');
  const p=evaluate();if(mode==='normal'&&!p.validNormal)return result(false,p.errors[0]||'正常节目需要三个合法段落。');if(mode==='rescue'&&!p.validRescue)return result(false,p.errors[0]||'补救节目需要一段、2至4张素材。');
  const factor=mode==='normal'?1:mode==='rescue'?.4:0,rating=mode==='skip'?0:p.rating,ad=Math.round(p.revenue*factor),sponsor=mode==='normal'&&p.quality>=55&&s.sponsorPaid<s.seasonDays*2000?2000:0;
  const bonus=mode==='normal'?p.commission.bonus:0;if(bonus)ledger(`${key}-commission`,bonus,'自选日委托奖金');const revenue=ad+sponsor+bonus;ledger(`${key}-ad`,ad,'节目广告收入');if(sponsor){ledger(`${key}-sponsor`,sponsor,'正常节目交付赞助');s.sponsorPaid+=sponsor;}
  const cards=s.timeline.flatMap(t=>t.clipIds||[]);if(mode!=='skip')for(const c of s.clips)if(cards.includes(c.id))c.used++;
  if(mode!=='skip')for(const [i,slot]of s.timeline.entries()){
   const pair=slot.clipIds.flatMap(cid=>s.clips.find(c=>c.id===cid)?.participants||[]);for(const who of new Set(pair))s.publicImpressions[who]=clamp((s.publicImpressions[who]||0)+rating/15);
   if(slot.style==='cliffhanger'&&!s.promises.some(x=>!x.closed&&!x.expired&&x.season===s.season&&x.person===pair[0]))s.promises.push({id:id('promise'),person:pair[0],season:s.season,createdEpisode:key,createdDay:s.day,sourceEvents:slot.clipIds.map(cid=>s.clips.find(c=>c.id===cid)?.eventId),sourceSceneIds:[...new Set(slot.clipIds.map(cid=>s.clips.find(c=>c.id===cid)?.sceneId).filter(x=>x!==null&&x!==undefined))],participants:[...new Set(pair)],sourceIds:[...new Set(slot.clipIds.map(cid=>s.facts.find(f=>f.id===s.clips.find(c=>c.id===cid)?.eventId)?.sourceId))],due:s.episodes.length+3,closed:false,penalized:false});
  }
  if(mode!=='skip'&&p.bias>=35){const person=p.protagonists[0]||s.cast[0];s.cases.push({id:id('case'),person,episodeId:key,season:s.season,status:'latent',severity:p.bias,amount:Math.round(1500+p.bias*55),revealDay:s.businessDay+1,deadline:null,corrected:false,evidence:cards.slice(),sourceEvents:[...new Set(cards.map(cid=>s.clips.find(c=>c.id===cid)?.eventId))]});}
  for(const a of s.audiences){const own=p.audiences.find(c=>c.id===a.id);a.satisfaction=clamp(mode==='skip'?a.satisfaction-8:p.quality+(own?.match||0)*15);a.fatigue=clamp(a.fatigue+(mode==='skip'? -8:own?.match>.5?8:-3));}
  for(const promise of s.promises.filter(x=>!x.closed&&!x.expired)){
   const eligibleCards=mode==='skip'?[]:s.timeline.filter(slot=>!slot.recap).flatMap(slot=>slot.clipIds||[]);
   const evidence=eligibleCards.map(cid=>s.clips.find(c=>c.id===cid)).find(c=>{if(c?.part!=='result'||!c.participants.includes(promise.person)||promise.createdEpisode===key||s.day<=promise.createdDay||promise.sourceEvents?.includes(c.eventId))return false;const fact=s.facts.find(f=>f.id===c.eventId);if(!fact||fact.day!==s.day||fact.season!==promise.season)return false;return (fact.sceneId!==null&&promise.sourceSceneIds?.includes(fact.sceneId))||(fact.resolvesSceneId!==null&&promise.sourceSceneIds?.includes(fact.resolvesSceneId))||(fact.resolvesSourceId!==null&&promise.sourceIds?.includes(fact.resolvesSourceId))||(fact.resolvesEventId!==null&&promise.sourceEvents?.includes(fact.resolvesEventId));});
   if(evidence&&promise.season===s.season&&s.episodes.length+1<=promise.due){promise.closed=true;promise.resolution={clipId:evidence.id,eventId:evidence.eventId,sceneId:evidence.sceneId??null,episodeId:key,day:s.day,season:s.season};}
   else if(s.episodes.length+1>=promise.due&&!promise.penalized){promise.expired=true;promise.penalized=true;s.reputation=clamp(s.reputation-3);}
  }
  const segmentParts=s.timeline.map(slot=>({style:slot.style,parts:new Set((slot.clipIds||[]).map(cid=>s.clips.find(c=>c.id===cid)?.part))}));
  const unresolvedCliffhanger=segmentParts.some(slot=>slot.style==='cliffhanger'&&!slot.parts.has('result'));
  const allResponsesAndResults=segmentParts.length>0&&segmentParts.every(slot=>slot.parts.has('reaction')&&slot.parts.has('result'));
  const missingResult=segmentParts.some(slot=>!slot.parts.has('result'));
  const completenessComment=unresolvedCliffhanger?'还有一段关系没有答案，等后续把结果交代清楚。':missingResult?'有些片段还没有交代结果，现在下结论太早。':!allResponsesAndResults?'结果出现了，但有些回应还没有看到。':p.bias>35?'这个剪法是不是省略了什么？':'这次把回应和结果都留下了。';
  const cost=4800+s.facilities.reduce((v,f)=>v+facility(f.type).maintenance,0);const ep={id:key,season:s.season,day:s.day,mode,title:mode==='skip'?'本日停更':mode==='rescue'?'岛上的一天 · 补救短片':`荒岛恋综 第${s.day}集`,rating,revenue,cost,profit:revenue-cost,quality:mode==='skip'?0:p.quality,bias:mode==='skip'?0:p.bias,timeline:mode==='skip'?[]:clone(s.timeline),comments:mode==='skip'?['今天没有新节目，我们明天还会回来吗？']:[p.quality>=60?'这一集的节奏挺顺，想继续看看他们接下来怎么相处。':'人物之间的来龙去脉还不够清楚。',completenessComment,`关系观众 ${p.audiences[0].viewers} · 冲突观众 ${p.audiences[1].viewers} · 观察观众 ${p.audiences[2].viewers}`]};
  s.episodes.push(ep);s.lastBroadcast=ep;s.phase='broadcast';dayExpenses();s.objective='核对本集收入与观众反馈，处理争议后进入下一日。';return result(true,mode==='skip'?'停更已结算，日期仍将推进。':'节目已锁片播出，历史不能改写。');
 }
 function beginDay(){s.dailyCommission=null;s.segment=0;resetSegmentClock();s.segmentReady=false;s.paused=false;s.speed=1;s.directorPoints=3;s.timeline=[];s.preview=null;s.interventions=[];s.phase='build';s.objective=`第${s.day}日晨间：检查补给、机位与嘉宾合作，准备录制。`;s.businessDay++;if(spatial&&s.camp&&s.selectedMap==='island')advanceCamp(s);dueCases();emit('day-start',{day:s.day,inventory:s.inventory,cooperation:s.cooperation});}
 function finishRecording(){cancelQueuedInterventions('录制结束，未发送指令取消');s.phase='editing';s.paused=false;s.segmentReady=false;s.objective='把真实镜头剪成同一条人物主线；低偏差、争议与停更都可以选择。';s.preview=evaluate();emit('recording-stop');return result(true,`今日取得${currentDayClips().length}张素材。进入剪辑室。`);}
 function segmentEnd(){

  for(const f of s.facilities){f.condition=Math.max(0,f.condition-(f.type==='camera'?1.5:1));if(f.condition<20)f.enabled=false;}
  s.inventory.power=Math.max(0,s.inventory.power-s.facilities.filter(f=>f.type==='camera').length-s.facilities.filter(f=>f.type==='heater'&&f.enabled).length*2-map().mechanics.powerPerSegment);
  if(s.inventory.food<s.cast.length||s.inventory.water<s.cast.length){s.warnings.push(`段末保障检查：当时食物${s.inventory.food}、饮水${s.inventory.water}；最低保障线为每类${s.cast.length}（任一低于即触发）。应急采购金额1800，追加食物${s.cast.length*2}、饮水${s.cast.length*2}。`);ledger(id('emergency'),-1800,'应急补给保障',{necessary:true});s.inventory.food+=s.cast.length*2;s.inventory.water+=s.cast.length*2;}
  if(spatial&&s.camp&&s.selectedMap==='island'&&s.segment===1){const event=campStory(s);if(event){addFact(event);emit('camp-story',event);}}
  emit('period',{day:s.day,segment:s.segment});s.segment++;s.objective=s.segment===1?'已到下午：嘉宾继续自由生活，上午的关系会影响接下来的选择。':s.segment===2?'已到晚间：补齐主线结果，素材足够时随时收工。':'夜深了：嘉宾仍在生活，素材足够就可以收工进入剪辑。';
 }
 function syncActors(actors,elapsed=1){
  if(s.phase!=='recording'||s.paused||s.segmentReady)return result(false,'非运行中的录制不更新现场压力。');
  const dt=clamp(Number(elapsed)||1,0,4);s.pressure??={};s.dangerTime??={};s.medicalSince??={};
  const warm=new Set();if(s.selectedMap==='snow'&&s.inventory.power>0)for(const heater of s.facilities.filter(f=>f.type==='heater'&&f.enabled)){const nearby=(actors||[]).filter(a=>Number.isFinite(a.x)&&Number.isFinite(a.z)&&Math.hypot(a.x-heater.x,a.z-heater.z)<=6).sort((a,b)=>Math.hypot(a.x-heater.x,a.z-heater.z)-Math.hypot(b.x-heater.x,b.z-heater.z));for(const a of nearby.filter(a=>!warm.has(a.id)).slice(0,4))warm.add(a.id);}
  for(const a of actors||[]){if(!s.cast.includes(a.id)||s.status[a.id]==='left')continue;const n=a.needs||{},old=s.status[a.id];
   const privateSpace=s.facilities.some(f=>f.type==='privacy'&&f.enabled&&Number.isFinite(a.x)&&Math.hypot(a.x-f.x,a.z-f.z)<3);
   const environmentFloor=s.selectedMap==='snow'?(warm.has(a.id)?15:92):map().mechanics.environment,privacyFloor=privateSpace?10:map().mechanics.privacy;
   const hunger=clamp(n.hunger||0),thirst=clamp(n.thirst??(s.inventory.water<=0?95:hunger*.6)),fatigue=clamp(n.energy||0),environment=clamp(s.selectedMap==='snow'?environmentFloor:n.environment??environmentFloor),privacy=clamp(Math.max(n.privacy||0,privacyFloor));
   if(s.selectedMap!=='island')emit('environment-state',{id:a.id,environment,privacy,warm:warm.has(a.id)});
   const pressure=Math.max(a.attributes?.despair||0,hunger*.25+thirst*.2+fatigue*.25+environment*.15+privacy*.15);s.pressure[a.id]=Math.round(pressure);
   if(old==='medical'){
    s.health[a.id]=Math.max(0,(s.health[a.id]||0)-dt*.8);const since=s.medicalSince[a.id];if(s.health[a.id]<30&&since&&(s.day>since.day||(!since.untilNextDay&&s.segment>since.segment)))s.status[a.id]='available';
   }else{
    s.dangerTime[a.id]=thirst>=90||environment>=90?(s.dangerTime[a.id]||0)+dt:0;
    if(s.dangerTime[a.id]>=12)s.health[a.id]=clamp((s.health[a.id]||0)+dt*2);else s.health[a.id]=Math.max(0,(s.health[a.id]||0)-dt*.05);
    s.cooperation[a.id]=clamp((s.cooperation[a.id]??80)+(pressure>=70?-dt*.1:pressure<35?dt*.01:0));
    if(a.attributes&&(a.attributes.health<=10||a.attributes.infection>=85||a.attributes.parts.head<=0||(a.attributes.parts.legL<=0&&a.attributes.parts.legR<=0)))s.health[a.id]=Math.max(s.health[a.id],80);
    if(s.health[a.id]>=60){s.status[a.id]='medical';s.unavailableSince[a.id]=s.day;s.medicalSince[a.id]={day:s.day,segment:s.segment,untilNextDay:s.health[a.id]>=80};ledger(id('rescue'),-1500,'场外医务保障',{necessary:true});}
    else if(s.cooperation[a.id]<15)s.status[a.id]='negotiating';else if(s.cooperation[a.id]<30)s.status[a.id]='refusing';else s.status[a.id]='available';
   }
   if(s.status[a.id]!==old){emit('health-status',{id:a.id,status:s.status[a.id],health:s.health[a.id],cooperation:s.cooperation[a.id]});s.warnings.push(`${candidate(a.id)?.name}：${({medical:'已停止行动并进入医务',negotiating:'提出退出协商',refusing:'拒绝常规任务',available:'恢复录制资格'})[s.status[a.id]]||'状态变化'}`);}
  }
  if(s.phase==='recording'&&s.cast.filter(c=>s.status[c]==='available').length<3){finishRecording();s.warnings.push('可录制人数不足3名，常规录制提前结束，已有素材仍可使用。');}
  return result(true,'现场压力与录制资格已同步。');
 }
 function dispatch(type,p={}){
  if(type==='campDecision'&&spatial&&s.phase==='recording'&&s.camp){
    const fact=s.facts.findLast(f=>f.sceneId===p.sceneId&&f.businessDay===s.businessDay);
    if(!fact||fact.playerChoice||!['C1','C2'].includes(p.option))return result(false,'当前没有可回应的营地事件。');
    fact.playerChoice=p.option;fact.result+=' · '+p.text;return result(true,'已记录制作人回应。');
  }
  if(type==='campEdit'){
    if(!spatial||s.selectedMap!=='island'||!(buildWindow()||s.phase==='recording')||s.speed>=16)return {ok:false,code:'LOCKED',message:'当前无法编辑营地。'};
    if(p.op==='loadBlueprint'){try{const loaded=unpack(p.code);if(loaded.placed.some(b=>s.facilities.some(f=>overlapsFacility(b,{...f,radius:facility(f.type).radius},loaded))))return result(false,'蓝图中的建筑与当前节目设施重叠。');if(loaded.day!==s.businessDay)loaded.used=0;loaded.day=s.businessDay;if(isCampWinter(s.businessDay))loaded.crew=0;loaded.version=Math.max(loaded.version,s.camp?.version||0)+1;loaded.gridRevision=Math.max(loaded.gridRevision||0,s.camp?.gridRevision||0)+1;loaded.events=[];s.camp=loaded;emit('placement',{facilities:s.facilities});return result(true,'营地蓝图已恢复。');}catch(e){return result(false,e.message);}}
    const camp=s.camp||newCamp();
    const r=editCamp(camp,s.businessDay,p,{facilities:s.facilities.map(f=>({...f,radius:facility(f.type).radius})),cast:s.cast.filter(id=>!['left','medical'].includes(s.status[id])),winter:isCampWinter(s.businessDay)});
    if(r.ok){s.camp=camp;emit('placement',{facilities:s.facilities});}
    return r;
  }
  if(type==='deleteCandidate'){
   const c=candidate(p.id);if(!c?.custom)return result(false,'只能删除自建人物。');
   if(c.hasAppeared||s.cast.includes(c.id)||s.roster.some(r=>r.id===c.id)||s.reserves.some(r=>r.id===c.id)||s.facts.some(f=>f.participants?.includes(c.id)))return result(false,'这位人物已有参演或合约记录，需保留身份与历史；仍可编辑形象。');
   s.candidates=s.candidates.filter(x=>x.id!==c.id);return result(true,'已删除未参演的自建人物。');
  }
  if(type==='customizeCandidate'||type==='createCandidate'){
   const name=typeof p.name==='string'?p.name.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,24):'';
   if(!name)return result(false,'请填写人物名字（最多24字）。');
   if(!p.appearance||typeof p.appearance!=='object'||Array.isArray(p.appearance))return result(false,'人物外观数据无效。');
   if(type==='customizeCandidate'){
    const c=candidate(p.id);if(!c)return result(false,'没有找到这位人物。');
    c.name=name;c.appearance=normalizeAppearance(p.appearance);emit('appearance-changed',{id:c.id});
    return result(true,'人物形象已保存，身份与岛上关系保持不变。');
   }
   if(s.candidates.filter(c=>c.custom).length>=60)return result(false,'自建人物库已达60人上限。');
   const source=candidate(p.sourceId)||s.candidates[0];
   const c={...clone(source),id:id('custom'),name,custom:true,hasAppeared:false,avatarId:source.avatarId||source.id,appearance:normalizeAppearance(p.appearance),knownRelation:null,secretKnown:false,experienceRequired:0,cost:1800,mole:false};
   s.candidates.push(c);emit('appearance-changed',{id:c.id});return {...result(true,'新人物已加入候选库，可在选角时邀请上岛。'),id:c.id};
  }
  if(type==='extendRecording'){
   if(!canExtendRecording())return result(false,'录制已没有计时限制，无需延拍；素材足够时自行收工即可。');
   const key=`extension-${s.season}-${s.day}-${s.segment}-${s.segmentExtensionsUsed+1}`;if(!ledger(key,-300,'录制延拍15秒'))return result(false,'延拍预算不足。');s.segmentExtensionsUsed++;s.segmentDuration+=15;return result(true,'本段延拍15秒；只延长现场时间，不生成任何素材。');
  }

  if(type==='reserveCandidate'&&s.phase==='build'){
   const c=candidate(p.id);if(!c||s.cast.includes(p.id)||s.reserves.some(r=>r.season===s.season&&r.id===p.id))return result(false,'候选不存在、已在录或已经预签。');
   if(s.experience<c.experienceRequired||s.roster.some(r=>r.id===p.id&&r.job!=='show')||(s.health[p.id]??0)>=30||(s.cooperation[p.id]??c.cooperation)<30)return result(false,'候选尚未解锁、状态不适合录制或本季已有商务/休养安排。');
   if(s.reserves.filter(r=>r.season===s.season).length>=2)return result(false,'每季最多预签两位替补。');
   const fee=Math.ceil(c.cost*.25);if(!ledger(`reserve-${s.season}-${c.id}`,-fee,'替补预签定金'))return result(false,'预签预算不足。');s.reserves.push({id:c.id,season:s.season,reservedDay:s.day,fee,status:'reserved'});return result(true,'已预签替补；次日起可在退出或医务席位上补签入岛，定金不退。');
  }
  if(type==='activateReserve'&&s.phase==='build'){
   const r=s.reserves.find(r=>r.id===p.id&&r.season===s.season&&r.status==='reserved'),c=candidate(p.id);
   if(!r||!c||s.cast.includes(p.id)||!s.cast.includes(p.replaces)||!['left','medical'].includes(s.status[p.replaces]))return result(false,'需要预签替补与当前离岛或医务席位。');
   if(s.replacementCount>=2)return result(false,'本季两次替补机会已用完。');if(s.day<=r.reservedDay||s.day<=(s.unavailableSince[p.replaces]??s.day))return result(false,'预签及离岛/医务处理完成后的次日才能替换。');
   if(s.experience<c.experienceRequired||s.roster.some(a=>a.id===p.id&&a.job!=='show')||(s.health[p.id]??0)>=30||(s.cooperation[p.id]??c.cooperation)<30)return result(false,'替补当前不满足参演资格。');
   if(!ledger(`activate-${s.season}-${c.id}`,-(c.cost-r.fee),'替补录制合约余款'))return result(false,'补签余款不足。');
   s.cast=s.cast.map(who=>who===p.replaces?c.id:who);r.status='activated';r.activatedDay=s.day;r.replaces=p.replaces;s.replacementCount++;s.replacementHistory.push({season:s.season,day:s.day,added:c.id,removed:p.replaces,contractCost:c.cost});s.cooperation[c.id]??=c.cooperation;s.health[c.id]??=0;s.status[c.id]='available';
   if(s.publicRules.water&&(s.publicRules.water.leaderId===p.replaces||s.publicRules.water.priorityId===p.replaces)){s.publicRules.water=null;emit('public-rule',{rule:null});}if(s.dailyCommission?.protagonistId===p.replaces)s.dailyCommission=null;
   emit('cast-changed',{cast:s.cast,added:c.id,removed:p.replaces,candidates:s.cast.map(candidate),preserveHistory:true});return result(true,'替补合约生效；离场演员与既有节目、事实和关系历史全部保留。');
  }

  if(type==='selectCommission'&&s.phase==='build'){if(!['relationship','conflict','observation'].includes(p.id)||!s.cast.includes(p.protagonistId))return result(false,'请选择受众主题与本季主角。');s.dailyCommission={id:p.id,protagonistId:p.protagonistId,bonus:1200,day:s.day,season:s.season};return result(true,'已接自选日委托：达标额外奖励1200，不达标不扣基础收入。');}
  if(type==='setPublicRule'){
   if(!(s.phase==='build'||(s.phase==='recording'&&s.paused)))return result(false,'公开规则只能在晨间筹备或录制暂停时宣布。');
   if(!s.cast.includes(p.leaderId)||s.status[p.leaderId]!=='available')return result(false,'请选择一位当前可出勤的值日负责人。');
   if(!['rotation','priority','reward'].includes(p.policy))return result(false,'请选择轮流、优先或守序奖品规则。');
   if(p.policy==='priority'&&!s.cast.includes(p.priorityId))return result(false,'优先规则需要一位明确的本季嘉宾。');
   const units=p.rewardUnits??1;if(!Number.isInteger(units)||units<1||units>3)return result(false,'每次公开奖励需为1至3份食物。');
   const rule={leaderId:p.leaderId,policy:p.policy,priorityId:p.policy==='priority'?p.priorityId:null,rewardKind:'food',rewardUnits:units,version:(s.publicRules.water?.version||0)+1,announcedDay:s.day,season:s.season};
   s.publicRules.water=rule;s.publicRuleLog.push({id:id('rule'),type:'public-rule',day:s.day,season:s.season,businessDay:s.businessDay,rule:clone(rule),text:`${candidate(rule.leaderId).name}负责水站值日；规则：${{rotation:'按到场顺序轮流',priority:'指定嘉宾优先',reward:'守序取水获得食物奖励'}[rule.policy]}。`});emit('public-rule',{rule});return result(true,'规则与负责人已公开，嘉宾将根据真实现场情况响应。');
  }

  if(type==='reportIntervention'){const last=p.instructionId?s.interventions.find(i=>i.id===p.instructionId):s.interventions.find(i=>i.day===s.day&&i.executionState==='sent'&&!i.response&&['group','mole','interview','contest'].includes(i.kind));if(s.phase!=='recording'||!last||last.executionState!=='sent'||last.day!==s.day||typeof p.message!=='string')return result(false,'没有本段可回执的导演指令。');last.response={message:p.message.slice(0,240),accepted:!!p.accepted};return result(true,'导演回执已保存。');}
  if(type==='syncActors')return syncActors(p.actors,p.elapsed);
  if(type==='consumeService'){
   if(s.phase!=='recording'||s.paused||s.segmentReady)return result(false,'非运行录制期间不交付现场物资。');if(!s.cast.includes(p.actorId)||!['food','water'].includes(p.kind))return result(false,'服务对象或物资类型不合法。');const building=s.selectedMap==='island'&&s.camp?.placed.find(v=>'camp-'+v.id===p.facilityId);const f=s.facilities.find(f=>f.id===p.facilityId)||(building&&{id:p.facilityId,enabled:!building.damaged,type:({well:'water',kitchen:'table',shop:'table'})[building.kind]});if(!f||!f.enabled||f.type!==(p.kind==='food'?'table':'water'))return result(false,'设施无法提供这项服务。');if(s.inventory[p.kind]<1)return result(false,'库存不足，服务未交付；请补给后再试。');s.inventory[p.kind]--;
   const rule=s.publicRules.water,key=`reward-${s.season}-${s.day}-${s.segment}-${p.actorId}`;
   if(p.kind==='water'&&p.ruleCompliant===true&&rule?.policy==='reward'&&rule.season===s.season&&!s.publicRewards.some(r=>r.id===key)){
    if(s.inventory.food>=rule.rewardUnits){s.inventory.food-=rule.rewardUnits;const reward={id:key,day:s.day,season:s.season,segment:s.segment,actorId:p.actorId,leaderId:rule.leaderId,facilityId:f.id,units:rule.rewardUnits,ruleVersion:rule.version};s.publicRewards.push(reward);s.publicRuleLog.push({...reward,type:'public-reward',text:`${candidate(p.actorId).name}遵守公开水站规则，领取${rule.rewardUnits}份食物。`});emit('public-reward',reward);}
    else emit('public-reward-unavailable',{actorId:p.actorId,ruleVersion:rule.version,reason:'食物库存不足，公开承诺未兑现。'});
   }
   return {...result(true,'已交付一单位物资。'),lastUnit:s.inventory[p.kind]===0};
  }
  if(type==='unlockMap'&&['season','management'].includes(s.phase)){const m=MAPS.find(m=>m.id===p.id);if(!m||s.maps.includes(m.id))return result(false,'该场地不存在或已经解锁。');if(s.experience<m.xp||s.reputation<m.reputation)return result(false,`需要经验${m.xp}、信誉${m.reputation}。`);if(!ledger(`map-${m.id}`,-m.cost,`购买${m.name}场地资格`))return result(false,'场地购买资金不足。');s.maps.push(m.id);return result(true,`${m.name}已解锁，下季选角阶段可选择场地。`);}
  if(type==='selectMap'&&s.phase==='casting'){if(!s.maps.includes(p.id))return result(false,'需要先在公司经营购买该场地资格。');s.selectedMap=p.id;emit('map-changed',{id:p.id,mechanics:map().mechanics});return result(true,`${map().name}已选定，筹备费用与环境规则随场地变化。`);}
  if(type==='observe'){const interruption=p.event?.type==='interrupted'&&['recording','editing'].includes(s.phase);if(!interruption&&(s.phase!=='recording'||s.paused||s.segmentReady))return result(false,'当前不在录制时段。');const observed=addFact(p.event);
   if(observed.ok&&p.event?.type==='contest-completed'){
    const e=p.event,i=s.interventions.find(i=>i.id===e.instructionId&&i.kind==='contest'&&i.day===s.day);
    if(i&&!i.settled&&e.sourcePart==='result'&&e.participants?.length===2&&e.participants.includes(i.a)&&e.participants.includes(i.b)&&[i.a,i.b].includes(e.winnerId)&&Array.isArray(e.scores)&&e.scores.length===2&&e.scores.every(Number.isFinite)){
     i.settled=true;i.winnerId=e.winnerId;i.resultSourceId=e.id;
     if(s.inventory.food>=1){s.inventory.food--;emit('contest-reward',{instructionId:i.id,actorId:e.winnerId,units:1});i.prizeDelivered=true;}else{emit('contest-reward-unavailable',{instructionId:i.id,actorId:e.winnerId,reason:'比赛完成，但食物奖品库存不足。'});i.prizeDelivered=false;}
    }
   }return observed;}
  if(type==='start'&&s.phase==='bankrupt'){const library=clone(s.candidates);s=createProduction({seed:s.seed,spatial,starterCamp}).serialize();for(const c of library){const original=s.candidates.find(x=>x.id===c.id);if(original){original.name=c.name;if(c.appearance)original.appearance=c.appearance;}else if(c.custom)s.candidates.push({...c,secretKnown:false});}s.serial=Math.max(s.serial,...library.filter(c=>c.custom).map(c=>Number(c.id.split('-').at(-1))||0));effects=[];}
  if(type==='start'&&s.phase==='title'){s.mode=p.mode==='standard'?'standard':'tutorial';s.castSize=s.mode==='standard'?6:4;s.seasonDays=s.mode==='standard'?7:3;s.segmentBaseDuration=s.mode==='standard'?120:90;resetSegmentClock();s.phase='casting';s.objective=`从${s.candidates.length}名候选中选择${s.castSize}名，预留建设与两日运行费用。`;return result(true,'第一季招募开始。');}
  if(type==='toggleCast'&&s.phase==='casting'){const c=candidate(p.id);if(!c)return result(false,'没有这位候选。');if(s.roster.some(r=>r.id===c.id&&r.job!=='show'))return result(false,'此艺人本季安排了商务或休养，不能同时录制。');if(s.experience<c.experienceRequired)return result(false,`招募需要制作经验${c.experienceRequired}。`);if(s.cast.includes(c.id))s.cast=s.cast.filter(x=>x!==c.id);else{if(s.cast.length>=s.castSize)return result(false,`本季最多${s.castSize}人。`);s.cast.push(c.id);}return result(true,'候选阵容已更新。');}
  if(type==='investigate'&&s.phase==='casting'){const c=candidate(p.id);if(!c||c.secretKnown)return result(false,'该信息已经调查或人物不存在。');if(!ledger(id('investigate'),s.upgrades.includes('research')?-350:-700,'试镜与背景访谈'))return result(false,'调查预算不足。');c.secretKnown=true;return result(true,`${c.name}的隐藏诉求：${c.secret}`);}
  if(type==='confirmCast'&&s.phase==='casting'){
   if(s.cast.length!==s.castSize)return result(false,`请选择${s.castSize}名嘉宾。`);if(s.cast.some(id=>s.roster.some(r=>r.id===id&&r.job!=='show')))return result(false,'商务或休养艺人不能同时参演。');const fees=s.cast.reduce((v,c)=>v+candidate(c).cost,0);if(s.cash<fees+openingReserve())return result(false,'需预留场地筹备、基础建设与两日运营费，当前阵容超出承受能力。');
   for(const who of s.cast)if(candidate(who).custom)candidate(who).hasAppeared=true;
   ledger(`contracts-${s.season}`,-fees,'开季嘉宾合约');ledger(`preparation-${s.season}`,-map().prepFee,'场地筹备与制作团队');s.cooperation=Object.fromEntries(s.cast.map(c=>[c,s.cooperation[c]??80]));s.health=Object.fromEntries(s.cast.map(c=>[c,0]));s.status=Object.fromEntries(s.cast.map(c=>[c,'available']));s.segment=0;resetSegmentClock();s.segmentReady=false;s.paused=false;s.directorPoints=3;s.interventions=[];s.phase='build';s.objective='营地是空的：布置水站、餐台、床位和机位，让节目真正能开拍。';emit('cast',{cast:s.cast,candidates:s.cast.map(candidate)});emit('map-changed',{id:s.selectedMap,mechanics:map().mechanics});return result(true,'合约已签，进入场地布置。');
  }
  if(type==='place'&&buildWindow())return place(p.type,Number(p.x),Number(p.z),p.rot??0);
  if(type==='autoBuild'&&buildWindow()){
   const plan=[['water',-6,-1],['table',6,2],['tent',...(spatial&&s.selectedMap==='island'?[-5.25,-6]:[-3,-7])],['camera',2,-3],['fire',0,7],['interview',6,-6]];const missing=plan.filter(([t])=>!s.facilities.some(f=>f.type===t));if(s.selectedMap==='snow'){const count=s.facilities.filter(f=>f.type==='heater').length;if(count<1)missing.push(['heater',-5,4]);if(count<2)missing.push(['heater',5,6]);}const cost=missing.reduce((v,[t])=>v+facility(t).cost,0);if(s.cash<cost)return result(false,'基础方案预算不足，可逐项建设或降低规模。');let count=0;for(const [t,x,z]of missing){const r=place(t,x,z);if(r.ok)count++;}return result(count>0,count?`已按基础方案付费建设${count}项设施。`:'所需设施已存在，或原位被占用。');
  }
  if(type==='remove'&&buildWindow()){const f=s.facilities.find(f=>f.id===p.id);if(!f)return result(false,'设施不存在。');ledger(`remove-${f.id}`,f.cost*.4*f.condition/100,`拆除${f.name}回收`);s.facilities=s.facilities.filter(x=>x.id!==f.id);emit('placement',{facilities:s.facilities});settleUnpaid();return result(true,'设施已拆除，回收40%残值。');}
  if(type==='move'&&buildWindow()){const f=s.facilities.find(f=>f.id===p.id);if(!f||f.movedDay===s.businessDay)return result(false,'设施不存在或今天已经移动过。');const placement=previewFacility(f.type,Number(p.x),Number(p.z),p.rot??f.rot??0,f.id);if(!placement.ok)return result(false,placement.message);if(!ledger(id('move'),-f.cost*.1,`移位${f.name}`))return result(false,'移位费不足。');f.x=placement.x;f.z=placement.z;if(placement.rot!==undefined)f.rot=placement.rot;f.movedDay=s.businessDay;emit('placement',{facilities:s.facilities});return result(true,'支付10%施工费，动线已改变。');}
  if(type==='repair'&&buildWindow()){const f=s.facilities.find(f=>f.id===p.id);if(!f||f.condition>=100)return result(false,'设施不存在或无需维修。');const cost=Math.ceil(f.cost*.25*(100-f.condition)/100);if(!ledger(id('repair'),-cost,`维修${f.name}`))return result(false,'维修费用不足。');f.condition=100;f.enabled=true;emit('placement',{facilities:s.facilities});return result(true,`${f.name}已恢复完好，花费${cost}。`);}
  if(type==='supply'&&buildWindow()){const amount=Math.floor(Number(p.amount)||12),prices=SUPPLY_PRICES;if(!prices[p.kind]||amount<=0||amount>100)return result(false,'请选择1至100单位合法补给。');if(!ledger(id('supply'),-amount*prices[p.kind],`采购${p.kind}`))return result(false,'采购预算不足。');s.inventory[p.kind]+=amount;return result(true,'补给已抵达。');}
  if(type==='support'&&['build','recording','broadcast'].includes(s.phase)){
   if(!s.cast.includes(p.id))return result(false,'请选择本季嘉宾。');if(p.kind==='release'){s.status[p.id]='left';s.unavailableSince[p.id]??=s.day;emit('health-status',{id:p.id,status:'left',health:s.health[p.id],cooperation:s.cooperation[p.id]});return result(true,'接受离岛，已有素材保留。');}
   if(!['apologize','rest'].includes(p.kind))return result(false,'请选择道歉沟通、休息或接受离岛。');if(!ledger(id('support'),p.kind==='rest'?-350:-200,'嘉宾沟通与恢复'))return result(false,'沟通资源不足。');s.cooperation[p.id]=clamp(s.cooperation[p.id]+(p.kind==='rest'?9:6));if(s.cooperation[p.id]>=30&&['refusing','negotiating'].includes(s.status[p.id]))s.status[p.id]='available';emit('health-status',{id:p.id,status:s.status[p.id],health:s.health[p.id],cooperation:s.cooperation[p.id]});emit('support',{id:p.id,kind:p.kind});return result(true,'沟通与条件已改善，原有私人关系不会被付款重置。');
  }
  if(type==='startRecording'&&s.phase==='build'){
   if(s.regulation.status==='suspended')return result(false,'节目处于停播整改，请处理案件、完成整改并结束维护日。');
   for(const t of ['water','table','tent'])if(!s.facilities.some(f=>f.type===t))return result(false,`先建设${facility(t).name}，或选择提前收季。`);
   if(s.selectedMap==='snow'&&(s.facilities.filter(f=>f.type==='heater'&&f.enabled).length*4<s.cast.length||s.inventory.power<6))return result(false,'雪山开录需要足够暖炉容量及至少6单位电力。');
   if(s.cast.filter(c=>s.status[c]==='available').length<3)return result(false,'可录制嘉宾少于3人，请补救或提前收季。');s.phase='recording';s.paused=false;s.segmentReady=false;resetSegmentClock();s.recordingElapsed=0;s.objective='嘉宾自由生活，时段推进不会打断互动；素材足够时由你决定何时收工。';emit('recording-start',{cast:s.cast,facilities:s.facilities});return result(true,'摄像机开机，嘉宾开始自由生活。');
  }
  if(type==='pause'&&s.phase==='recording'&&!s.segmentReady){s.paused=!s.paused;if(!s.paused)flushQueuedInterventions();return result(true,s.paused?'现场暂停。':'现场继续。');}
  if(type==='speed'&&s.phase==='recording'&&[1,2,4].includes(Number(p.value))){s.speed=Number(p.value);return result(true,`${s.speed}倍现场速度。`);}
  if(type==='nextSegment')return result(false,'录制不再强制分段：时段会自动推进，嘉宾的互动不会被打断。');
  if(false){s.segment++;resetSegmentClock();s.segmentReady=false;s.paused=false;s.objective=s.segment===1?'下午录制：上一时段的关系会影响接下来的选择。':'晚间录制：补齐主线结果，不要只留下冲突开头。';emit('segment-start',{segment:s.segment});return result(true,'下一时段开拍。');}
  if(type==='finishRecording'&&s.phase==='recording')return finishRecording();
  if(type==='remediate'&&['build','management','season'].includes(s.phase)){if(s.regulation.status!=='suspended')return result(false,'当前无需停播整改。');if(s.regulation.trainingDone)return result(false,'制作整改已经完成。');if(!ledger(id('remediation'),-2500,'制作流程整改与人员培训'))return result(false,'整改资金不足，可先处理资产。');s.regulation.trainingDone=true;refreshRegulation();return result(true,'制作流程已整改；公开案件仍须处理，监管日期仍须推进。');}
  if(type==='maintenanceDay'&&['build','management','season'].includes(s.phase)){
   const active=s.phase==='build',previous=s.phase,before=s.businessDay;s.dailyCommission=null;ledger(`maintenance-${before}`,-(active?4800+s.facilities.reduce((v,f)=>v+facility(f.type).maintenance,0):3000),'维护日团队与保障费用',{necessary:true});s.businessDay++;if(spatial&&s.camp&&s.selectedMap==='island')advanceCamp(s);
   for(const who of s.cast){if(s.status[who]==='medical'){s.health[who]=Math.max(0,s.health[who]-35);if(s.health[who]<30){s.status[who]='available';emit('health-status',{id:who,status:'available',health:s.health[who],cooperation:s.cooperation[who]});}}s.cooperation[who]=clamp((s.cooperation[who]??70)+3);}
   dueCases();refreshRegulation();if(s.phase==='crisis'){if(active){if(s.day>=s.seasonDays)s.pendingMaintenanceSeasonEnd=true;else{s.day++;s.segment=0;resetSegmentClock();s.directorPoints=3;s.interventions=[];s.timeline=[];s.preview=null;emit('day-start',{day:s.day,inventory:s.inventory,cooperation:s.cooperation});}}return result(true,'维护日与经营日期已推进，结清必要费用后继续。');}
   if(active){if(s.day>=s.seasonDays)return endSeason();s.day++;s.segment=0;resetSegmentClock();s.directorPoints=3;s.interventions=[];s.timeline=[];s.preview=null;s.phase='build';}else s.phase=previous;
   emit('day-start',{day:s.day,inventory:s.inventory,cooperation:s.cooperation});s.objective=s.regulation.status==='suspended'?'停播整改继续：处理案件与流程整改，维护日没有广告收入。':'维护日结束，可以重新安排录制。';return result(true,'维护日已消耗经营日期和必要费用，没有节目或广告收入。');
  }
  if(type==='intervene'&&s.phase==='recording'&&!s.segmentReady){
   const costs={group:[1,300],mole:[1,900],interview:[1,450],feedback:[1,200],contest:[2,1100],weather:[3,2200]},rule=costs[p.kind];if(!rule)return result(false,'没有这种导演指令。');
   if(!s.cast.includes(p.a))return result(false,'先选择一位在场嘉宾。');if(['group','mole','contest'].includes(p.kind)&&(!s.cast.includes(p.b)||p.a===p.b))return result(false,'此指令需要两位不同的嘉宾。');
   if(s.interventions.some(i=>i.day===s.day&&i.segment===s.segment&&i.kind===p.kind))return result(false,'同一时段不能反复使用同类干预。');
   if(p.kind==='mole'&&!candidate(p.a)?.mole)return result(false,'这位嘉宾没有签内应合约。');if(p.kind==='interview'&&!s.facilities.some(f=>f.type==='interview'))return result(false,'先建设公共采访间。');if(p.kind==='feedback'&&!s.lastBroadcast)return result(false,'还没有真实播出反馈。');if(p.kind==='weather'&&!s.upgrades.includes('weather'))return result(false,'尚未解锁人工天气设备。');
   if(s.directorPoints<rule[0])return result(false,'今日导演额度不足。');if(!ledger(id('intervene'),-rule[1],`导演干预：${p.kind}`))return result(false,'干预现金不足。');s.directorPoints-=rule[0];const instruction={id:id('instruction'),day:s.day,segment:s.segment,kind:p.kind,a:p.a,b:p.b,cost:rule[1],points:rule[0],executionState:'queued'};s.interventions.push(instruction);const task={instructionId:instruction.id,payload:clone(p)};
   if(s.paused){s.pendingInterventions.push(task);return result(true,'指令已排队，恢复录制后才向嘉宾传达；尚未执行或获得回应。');}
   sendIntervention(task);return result(true,'指令已发出；是否接受与结果由嘉宾决定，已发送额度不退款。');
  }
  if(type==='setTimeline'&&s.phase==='editing'){if(!Array.isArray(p.slots)||p.slots.length>3)return result(false,'时间线最多三个段落。');s.timeline=clone(p.slots.map(x=>({clipIds:Array.isArray(x.clipIds)?x.clipIds.slice(0,4):[],style:STYLES.some(t=>t.id===x.style)?x.style:'documentary',music:['none','warm','tense','sad'].includes(x.music)?x.music:'none',recap:!!x.recap})));s.preview=evaluate();return result(true,'时间线已更新，事实记录保持不变。');}
  if(type==='autoEdit'&&s.phase==='editing')return autoEdit();
  if(type==='preview'&&s.phase==='editing'){s.preview=evaluate();return result(true,'这是预计效果；实际结算受交付类型与受众状态影响。');}
  if(type==='broadcast'&&s.phase==='editing'&&['normal','rescue','skip'].includes(p.mode||'normal'))return broadcast(p.mode||'normal');
  if(type==='nextDay'&&s.phase==='broadcast'){if(s.day>=s.seasonDays)return endSeason();s.day++;beginDay();return result(true,'进入次日；未结案件和合同继续有效。');}
  if(type==='resolveCase'&&['build','broadcast','season','management','crisis'].includes(s.phase)){
   const c=s.cases.find(c=>c.id===p.id);if(!c||c.status==='dismissed'||(c.status==='closed'&&(c.corrected||p.method==='pay')))return result(false,'案件不存在或该处理已经完成。');if(c.status==='latent')return result(false,'尚未公开的证据不能预先买断。');
   if(p.method==='context'||p.method==='correct'){const sourceEvents=c.sourceEvents||c.evidence.map(cid=>s.clips.find(x=>x.id===cid)?.eventId);const scenes=new Set(s.facts.filter(f=>sourceEvents.includes(f.id)&&f.sceneId).map(f=>f.sceneId));const clip=s.clips.find(x=>(sourceEvents.includes(x.eventId)||(x.sceneId&&scenes.has(x.sceneId)))&&x.part==='result');if(!clip)return result(false,'没有可公开的结果镜头，无法凭空澄清。');if(!ledger(`correction-${c.id}`,-700,'公开语境与更正'))return result(false,'更正费用不足。');c.corrected=true;c.status='closed';for(const a of s.audiences)a.trust=clamp(a.trust+3);s.reputation=clamp(s.reputation+2);return result(true,'更正作为新公开记录追加，原节目仍保留。');}
   if(p.method==='pay'){if(!ledger(`case-${c.id}`,-c.amount,'争议赔付'))return result(false,'赔付现金不足。');c.status='closed';return result(true,'责任已赔付；未更正的叙事仍保留真实性债务。');}return result(false,'请选择提供语境、更正或赔付。');
  }
  if(type==='endSeason'&&['build','recording','editing','broadcast','crisis'].includes(s.phase))return endSeason();
  if(type==='returnManagement'&&s.phase==='casting'&&s.season>1){s.resumeCasting=true;s.phase='management';return result(true,'返回公司经营；本次筹备日期和已选阵容保留，不重复发放商务收入。');}
  if(type==='management'&&s.phase==='season'){s.phase='management';return result(true,'进入公司经营。');}
  if(type==='upgrade'&&['season','management'].includes(s.phase)){const u=UPGRADES.find(x=>x.id===p.id);if(!u||s.upgrades.includes(u.id))return result(false,'升级不存在或已购买。');if(s.experience<u.xp)return result(false,`需要制作经验${u.xp}。`);if(!ledger(`upgrade-${u.id}`,-u.cost,u.name))return result(false,'升级预算不足。');s.upgrades.push(u.id);return result(true,`${u.name}已启用。`);}
  if(type==='sign'&&['season','management'].includes(s.phase)){if(!s.upgrades.includes('agency'))return result(false,'先建立MCN经纪部。');if(s.roster.length>=3||s.roster.some(r=>r.id===p.id))return result(false,'管理席位不足或已签约。');if(!candidate(p.id)||(s.cooperation[p.id]??50)<45||(s.health[p.id]??0)>=30||['medical','left'].includes(s.status[p.id]))return result(false,'对方目前不愿与公司长期合作。');if(!ledger(id('sign'),-4500,'艺人签约费'))return result(false,'签约预算不足。');s.roster.push({id:p.id,job:'rest',lastPaidSeason:0});return result(true,'签约成功；每季只能选择一种主业。');}
  if(type==='assign'&&['season','management'].includes(s.phase)){const r=s.roster.find(r=>r.id===p.id);if(!r||!['show','commerce','rest'].includes(p.job))return result(false,'请选择合法艺人主业。');r.job=p.job;return result(true,'下季主业已安排。');}
  if(type==='acquire'&&['season','management'].includes(s.phase)){const r=s.rivals.find(x=>x.id===p.id);if(!r||r.acquired)return result(false,'目标不存在或已经收购。');if(s.profitableSeasons<2||s.reputation<50||s.cases.some(c=>c.status==='upheld'))return result(false,'收购需要连续两个盈利季、信誉50及无待执行处罚。');if(!ledger(`acquire-${r.id}`,-r.valuation,`收购${r.name}`))return result(false,'收购现金不足。');r.acquired=true;s.objective='完成收购后再制作一个盈利季，完成整合。';return result(true,`${r.name}已收购；需以一个盈利季完成整合。`);}
  if(type==='nextSeason'&&['season','management','victory'].includes(s.phase)){
   if(s.resumeCasting){s.resumeCasting=false;s.phase='casting';return result(true,'返回本季选角，筹备不重复结算。');}
   if(s.loan){const debt=Math.ceil(s.loan.principal*1.1);if(!ledger(`repay-${s.loan.season}`,-debt,'偿还过桥贷款本息'))return result(false,'需先偿还贷款才能开下一季。');s.loan=null;}
   if(s.unpaid.length){settleUnpaid();if(s.unpaid.length)return result(false,'存在到期未付责任，请先处理或清算。');}
   const minimum=s.candidates.filter(c=>!s.roster.some(r=>r.id===c.id&&r.job!=='show')).sort((a,b)=>a.cost-b.cost).slice(0,6).reduce((v,c)=>v+c.cost,0)+openingReserve();if(s.cash<minimum)return result(false,`开季最低自有资金为${minimum}；请留在经营界面处理资产或清算公司。`);
   s.season++;s.replacementCount=0;s.dailyCommission=null;s.publicRules.water=null;s.day=1;s.businessDay++;if(spatial&&s.camp&&s.selectedMap==='island')advanceCamp(s);s.adRate=clamp(180+Math.round((s.reputation-55)*1.5),140,260);s.mode='standard';s.castSize=6;s.seasonDays=7;s.segmentBaseDuration=120;resetSegmentClock();s.seasonStartCash=s.cash;s.seasonReport=null;s.cast=[];s.facilities=[];s.inventory={food:36,water:42,power:24};s.sponsorPaid=0;s.timeline=[];s.preview=null;s.phase='casting';s.objective=`第${s.season}季招募：过去的关系与争议不会重置。`;dueCases();
   for(const r of s.roster){if(r.job==='commerce'){const value=1800+(s.publicImpressions[r.id]||0)*60;ledger(`commerce-${s.season}-${r.id}`,value-700,'艺人商务扣除保底后收益');}else if(r.job==='rest')s.cooperation[r.id]=clamp((s.cooperation[r.id]||60)+8);else ledger(`retainer-${s.season}-${r.id}`,-700,'签约艺人保底');r.lastPaidSeason=s.season;}
   return result(true,'新季筹备已消耗一个经营日，旧案件继续计时。');
  }
  if(type==='loan'&&['build','crisis','season','management'].includes(s.phase)){if(s.loan||s.loanUsedSeason===s.season)return result(false,'本季过桥贷款已经使用。');const assets=s.facilities.reduce((v,f)=>v+f.cost*.4,0),principal=Math.floor(assets*.5);if(principal<500)return result(false,'可清算资产不足以支持贷款。');s.loan={principal,season:s.season};s.loanUsedSeason=s.season;ledger(`loan-${s.season}`,principal,'过桥借款（非经营收入）');settleUnpaid();return result(true,`获得${principal}过桥资金，下季前偿还110%。`);}
  if(type==='liquidate'&&['crisis','season','management','build','casting'].includes(s.phase)){cancelQueuedInterventions('公司清算，未发送指令取消');for(const f of s.facilities)ledger(`salvage-${f.id}`,f.cost*.4*f.condition/100,`${f.name}清算残值`);s.facilities=[];s.phase='bankrupt';s.objective='本次经营结束。制作档案保留供复盘，新档不继承资金。';emit('placement',{facilities:[]});return result(true,'公司已清算，经营档结束。');}
  return result(false,'当前阶段不能执行此操作。');
 }
 return {previewFacility,canCaptureEvent:event=>captureEligibility(event).ok,getRuntime:()=>clone({...snapshot(spatial?s.camp:null,s.businessDay),phase:s.phase,paused:s.paused,speed:s.speed,day:s.day,season:s.season,segment:s.segment,segmentReady:s.segmentReady,segmentElapsed:s.segmentElapsed,recordingElapsed:s.recordingElapsed||0,segmentDuration:s.segmentDuration,segmentBaseDuration:s.segmentBaseDuration,segmentExtensionsUsed:s.segmentExtensionsUsed,segmentExtensionsRemaining:2-s.segmentExtensionsUsed,canExtendRecording:canExtendRecording(),cast:s.cast,facilities:s.facilities,status:s.status,cooperation:s.cooperation,inventory:s.inventory,selectedMap:s.selectedMap,mapMechanics:map().mechanics,regulation:s.regulation,publicRules:s.publicRules}),getSpatialGrid:version=>gridDelta(spatial?s.camp:null,version),getSpatialSnapshot:()=>snapshot(spatial?s.camp:null,s.businessDay),getState(){const out=clone(s);out.segmentExtensionsRemaining=2-s.segmentExtensionsUsed;out.canExtendRecording=canExtendRecording();out.catalog.supplyPrices=clone(SUPPLY_PRICES);out.buildWindow=buildWindow();out.availableClips=currentDayClips().length;out.authenticityDebt=s.cases.filter(c=>!c.corrected).reduce((v,c)=>v+c.severity,0);out.nextDailyCost=4800+s.facilities.reduce((v,f)=>v+facility(f.type).maintenance,0);return out;},serialize:()=>clone(s),dispatch,drainEffects(){const out=effects;effects=[];return out;},update(dt){if(s.phase!=='recording'||s.paused||s.segmentReady||!Number.isFinite(dt)||dt<=0)return;const step=Math.min(dt,2)*s.speed;s.recordingElapsed=(s.recordingElapsed||0)+step;s.segmentElapsed+=step;while(s.phase==='recording'&&s.segmentDuration>0&&s.segmentElapsed>=s.segmentDuration){s.segmentElapsed-=s.segmentDuration;segmentEnd();}}};
}
