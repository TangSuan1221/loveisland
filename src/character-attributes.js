const bound=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
export const parts=['head','torso','armL','armR','legL','legR'];
export const skills={gather:'采集',hunt:'捕鱼',cook:'备餐',build:'修整营地',med:'护理',combat:'体能对练',craft:'制作护具',social:'交谈'};
export const labels={satiety:'饱食',hydration:'水分',rest:'睡眠',stamina:'体力',warmth:'体温舒适',hygiene:'卫生',pain:'疼痛',infection:'感染',despair:'心理压力',health:'健康'};
const limits={satiety:10,hydration:12,rest:12,stamina:5,warmth:20,hygiene:15,pain:70,infection:60,despair:70,health:25};
const highBad=new Set(['pain','infection','despair']);
export function initialize(a){
 if(a.attributes){
  const v=a.attributes;
  const numeric=['stamina','warmth','hygiene','pain','infection','despair','health','insulation','protection'];
  if(!numeric.every(k=>Number.isFinite(v[k])&&v[k]>=0&&v[k]<=100)||!parts.every(k=>Number.isFinite(v.parts?.[k])&&v.parts[k]>=0&&v.parts[k]<=100)||!Object.keys(skills).every(k=>Number.isFinite(v.xp?.[k])&&v.xp[k]>=0)||!v.innate||!v.habits||!Array.isArray(v.danger))throw Error('角色属性存档无效');
  return;
 }
 const p=a.personality;
 const innate={agree:p.kindness,extra:p.sociability,open:p.quirkiness,body:p.energy,neuro:1-p.directness,consc:(p.directness+p.kindness)/2,grit:(p.directness+p.energy)/2};
 const habits={eating:p.energy>.7?'快':'慢',stomach:p.energy>.6?'强':'弱',anger:p.directness>.6?'爆发':'隐忍',positive:p.sociability>.6?'明显':'克制',negative:p.directness>.6?'明显':'克制',greeting:p.sociability>.5?'主动':'回避',walk:p.energy>.6?'轻快':'平缓',sleep:p.energy>.7?'浅':'沉',stance:p.directness>.6?'挺直':'放松',blink:p.quirkiness>.6?'频繁':'平稳',expression:p.sociability>.6?'丰富':'含蓄',voice:p.directness>.6?'响亮':'轻柔'};
 a.attributes={innate,habits,xp:Object.fromEntries(Object.keys(skills).map(k=>[k,0])),parts:Object.fromEntries(parts.map(k=>[k,100])),stamina:100,warmth:80,hygiene:90,pain:0,infection:0,despair:0,health:100,insulation:0,protection:0,danger:[]};
}
export function stocks(a){const v=a.attributes;return {satiety:100-a.needs.hunger,hydration:100-(a.needs.thirst||0),rest:100-a.needs.energy,stamina:v.stamina,warmth:v.warmth,hygiene:v.hygiene,pain:v.pain,infection:v.infection,despair:v.despair,health:v.health};}
export const level=(a,k)=>Math.min(20,Math.floor(((a.attributes.xp[k]||0)/40)**(1/1.55)));
export function derive(a){
 const s=stocks(a),v=a.attributes,legs=Number(v.parts.legL<=0)+Number(v.parts.legR<=0);
 const feelings=[];
 if(s.satiety<10)feelings.push('饥饿');
 if(s.despair>=90||(s.satiety<10&&s.hydration<12))feelings.push('濒临崩溃');
 if(s.despair>=70)feelings.push('消沉');else if(s.despair>=40)feelings.push('沮丧');
 if(a.mood==='angry')feelings.push('愤怒');
 if(s.pain>=40||s.rest<30)feelings.push('烦躁');
 if(s.infection>=30||a.mood==='worried'||v.worryTime>0)feelings.push('担忧');
 if(s.stamina<20)feelings.push('恍惚');
 if(a.mood==='happy'&&s.despair<30)feelings.push('愉快');
 if(!feelings.length)feelings.push('平常');
 const danger=Object.keys(limits).filter(k=>highBad.has(k)?s[k]>=limits[k]:s[k]<=limits[k]);
 const wounds=parts.filter(k=>v.parts[k]<75).length;
 const critical=s.health<=10||v.parts.head<=0||legs===2||s.infection>=85;
 return {feelings,danger,wounds,critical,move:(legs===2?0:legs===1?.55:1)*(1-.003*s.pain),work:(.5+.005*s.stamina)*(1-.004*s.pain)*(.85**parts.filter(k=>v.parts[k]<=0).length)};
}
export function advanceVitals(a,dt,world=worldFor(),camp=null){
 const v=a.attributes,n=a.needs,work=!!v.task||a.moving||['exercise','dance','contest'].includes(a.activity);
 if(v.worryTime>0)v.worryTime=Math.max(0,v.worryTime-dt);
 if(v.lossUntil>0)v.lossUntil=Math.max(0,v.lossUntil-dt);
 const stress=Math.max(0,Math.max(n.hunger,n.thirst||0,n.privacy||0,n.environment||0)-65)/35;
 const recovery=(n.hunger>75?.5:1)*(n.energy>70?.6:1)*(v.infection>=30?.4:1);
 v.stamina=bound(v.stamina+dt*(work?-.24*(1.25-.5*v.innate.body):(a.activity==='rest'?1.1:.32)*recovery));
 const feels=(camp?.temperature===undefined?world.feels:camp.temperature+(world.feels-world.temp))+(camp?.warmth||0)+(camp?.indoor||0)+(a.activity==='warm'||v.heated?16:0)+v.insulation*.4+v.protection*.2;
 const target=bound(100-Math.max(0,12-feels)*6-Math.max(0,feels-24)*5-(n.environment||0)*.12);
 v.warmth+=bound(target-v.warmth,-.32*dt,.32*dt);
 v.hygiene=bound(v.hygiene-dt*(work?.033:.018));
 const wounds=parts.filter(k=>v.parts[k]<75).length;
 v.infection=bound(v.infection+dt*(wounds*(v.hygiene<40?.12:.045)*(world.toxin>30?1.5:1)-.017));
 v.pain=bound(v.pain-dt*.025);
 v.despair=bound(v.despair+dt*(stress*.16*(1-.55*v.innate.grit)*(v.lossUntil>0?1.5:1)-.028*(1+(a.activity==='rest'&&camp?.indoor? .05*(camp.beauty||0):0))));
 if(v.warmth<=5){for(const k of ['armL','armR','legL','legR'])v.parts[k]=bound(v.parts[k]-dt*.10);}
 const harm=(v.warmth<20?.22:0)+(v.infection>=60?.18:0)+(n.thirst>=98?.12:0)+(n.hunger>=98?.06:0);
 v.health=bound(v.health+dt*(harm?-harm:.026));
 const previous=v.danger,d=derive(a);v.danger=d.danger;
 return d.danger.filter(k=>!previous.includes(k));
}
export function practice(a,kind,random){
 const v=a.attributes,L=level(a,kind),gain=1+.045*L;
 if(kind==='med'&&random()>.45+.025*L){v.infection=bound(v.infection+2);v.hygiene=bound(v.hygiene+20);}
 else if(kind==='med'){v.pain=bound(v.pain-20-2*L);v.infection=bound(v.infection-15-2*L);for(const k of parts)v.parts[k]=bound(v.parts[k]+12*gain);v.health=bound(v.health+8*gain);v.hygiene=bound(v.hygiene+20);}
 if(kind==='build')v.insulation=bound(v.insulation+4*gain,0,20);
 if(kind==='craft')v.protection=bound(v.protection+3*gain,0,15);
 if(['gather','hunt','cook'].includes(kind))a.needs.hunger=bound(a.needs.hunger-({gather:9,hunt:16,cook:12}[kind])*gain);
 if(kind==='social')v.despair=bound(v.despair-5*gain);
 if(kind==='combat')v.stamina=bound(v.stamina-8);
 let injury=null;
 if(['hunt','build','combat'].includes(kind)&&random()<.22*(1-.03*L)*(1-v.protection/50)){
  injury=parts[Math.floor(random()*parts.length)];v.parts[injury]=bound(v.parts[injury]-30);v.pain=bound(v.pain+16);v.health=bound(v.health-6);
 }
 v.xp[kind]=Math.min(4200,v.xp[kind]+40);return injury;
}
export function recover(a){const v=a.attributes;v.health=Math.max(65,v.health);v.infection=Math.min(25,v.infection);v.pain=Math.min(25,v.pain);v.despair=Math.min(55,v.despair);v.stamina=Math.max(50,v.stamina);for(const k of parts)v.parts[k]=Math.max(50,v.parts[k]);}
export function relationship(a,b){
 const r=a.relationships[b.id],bond=bound(100+r.affinity,0,200);
 const ranks=['绝交','仇敌','敌对','恶感','冷淡','疏远','认识','友好','亲近','挚友','至亲','誓约'];
 const tier=bond===0?0:bond===200?11:Math.min(10,Math.floor(bond/20)+1);
 const tags=[];
 if(r.alliance||r.trust>=35)tags.push('朋友');
 if(r.romance)tags.push('恋人');
 if(r.bond)tags.push(r.bond);
 if(r.exRomance)tags.push('前任');if(r.exFriend)tags.push('曾是朋友');
 if(r.resentment>=65)tags.push('对手');
 if(r.resourceDebt>0)tags.push('欠物');if(r.resourceDebt<0)tags.push('债主');
 if(a.beliefs?.some(v=>!v.resolved&&v.otherId===b.id))tags.push('存疑');
 return {bond,tier:r.lockedTier??tier,rank:ranks[r.lockedTier??tier],tags};
}
export function socialEvent(a,b,outcome,day,initiator=true){
 const r=a.relationships[b.id];
 r.fear??=0;r.resourceDebt??=0;r.favorDebt??=0;r.grudge??=0;
 if(outcome==='item-borrowed')r.resourceDebt+=initiator?1:-1;
 if(outcome==='item-returned')r.resourceDebt-=initiator?1:-1;
 if(outcome==='supported'||outcome==='comforted')r.favorDebt+=initiator?-1:1;
 if(outcome==='boundary-disagreed'||outcome==='disagreed')r.fear=bound(r.fear+4);
 if(outcome==='disagreed'&&r.affinity < -50 &&r.alliance){r.alliance=false;r.exFriend=true;}
 if(outcome==='boundary-disagreed'&&r.resentment>=80&&r.romance){r.romance=false;r.exRomance=true;}
 if(outcome==='reconciled')r.fear=bound(r.fear-6);
 if(outcome==='promise-discussed')r.grudge=bound(r.grudge+1);
 if(outcome==='abandoned')r.lastAbandonDay=day;
 if(outcome==='last-water-kept'||outcome==='feelings-declined')r.lockedTier=relationship(a,b).tier;
 else delete r.lockedTier;
}
export function senses(a){
 const v=a.attributes;return [v.hygiene<40&&'衣着脏乱',v.infection>=30&&'面色发热',v.hygiene<15&&'有异味',v.warmth<30&&'发抖',v.pain>=70&&'回避触碰',v.despair>=70&&'沉默'].filter(Boolean);
}
export function worldFor(map='island',storm=false,supply=1){
 const temp=({snow:-6,villa:22,island:26})[map]??26;
 return {map,temp,weather:storm?'风暴':map==='snow'?'雪':'晴',feels:temp-(storm?5:0),toxin:storm&&map==='island'?35:0,supply:bound(supply,0,1)};
}
export function conditionTags(a){
 const v=a.attributes,d=derive(a),s=stocks(a),edges=Object.values(a.relationships);
 return [d.wounds&&('伤口 '+d.wounds),(v.stamina<=0||d.move===0)&&'行动受限',(s.rest<=0||v.health<=10)&&'意识不清',
  s.satiety<10&&'饥饿',d.feelings.includes('濒临崩溃')&&'濒临崩溃',v.infection>=30&&'生病',v.hygiene<40&&'脏污',
  edges.some(r=>r.grudge>0)&&'受过辜负',v.lossUntil>0&&'面对离别',a.unavailable&&'暂停录制',
  edges.some(r=>r.resourceDebt>0)&&'欠物',edges.some(r=>r.resourceDebt<0)&&'借出物品'].filter(Boolean);
}
export function impulses(a,b,world){
 const r=a.relationships[b.id],v=a.attributes;
 const distance=1-bound((100+r.affinity)/200,0,1),scarcity=1-world.supply;
 return {take:(1-v.innate.consc)*distance*(a.needs.hunger/100)*scarcity,
  abandon:(1-v.innate.agree)*distance*(v.despair/100)*scarcity};
}
export function crisisEncounter(a,b,world,day){
 const intent=impulses(a,b,world),v=a.attributes;
 if(intent.abandon>.6&&b.attributes.health<=15&&a.relationships[b.id].lastAbandonDay!==day){
  a.relationships[b.id].lastAbandonDay=day;b.relationships[a.id].grudge=bound((b.relationships[a.id].grudge||0)+1);
  return {kind:'abandoned',text:a.name+'看到'+b.name+'需要帮助，选择走开。'};
 }
 if(intent.take>.55&&a.needs.hunger>90&&a.mood==='angry'&&b.attributes.rations>0){
  b.attributes.rations--;a.needs.hunger=bound(a.needs.hunger-22);b.relationships[a.id].resentment=bound(b.relationships[a.id].resentment+25);
  return {kind:'ration-taken',text:a.name+'拿走并吃掉了'+b.name+'留下的口粮。'};
 }
 return null;
}
// Normalized stocks use 0–100 regardless of the actor's absolute carrying and endurance capacities.
export function capabilities(a,world=worldFor()){
 const v=a.attributes,t=v.innate,s=stocks(a),d=derive(a);
 const staminaFactor=(.5+s.stamina/200)*(s.satiety<25?.6:1)*(s.hydration<12?.6:1);
 return {
  maxHP:60+40*t.body+10*t.grit,maxStamina:60+40*t.body,maxPain:100,maxWarmth:100,
  capacity:8+12*t.body,loadRatio:(v.rations||0)/(8+12*t.body),legFactor:v.parts.legL<=0&&v.parts.legR<=0?0:Math.min(v.parts.legL,v.parts.legR)<=0?.55:1,
  moveSpeed:d.move,workSpeed:d.work*staminaFactor,socialHit:bound(.45+.025*level(a,'social')+.15*t.agree+.001*s.hygiene-.002*s.despair,0,1),
  panicRisk:bound(.3+.7*t.neuro+.004*s.despair-.3*t.grit,0,1),perception:bound(1-.002*s.despair-.002*(100-s.rest)-(s.hydration<=0?.4:0),.2,1),
  woundCount:d.wounds,disabledSegments:parts.filter(k=>v.parts[k]<=0).length,critical:d.critical,
  recovery:staminaFactor,appetite:s.infection>=30?.8:1,foodUse:s.warmth<20?1.35:1,waterUse:s.infection>=30?1.5:1,
  restUse:v.habits.sleep==='浅'?1.3:1,workload:1+.045*level(a,v.task?.kind||'build'),skillSuccess:.45+.025*level(a,v.task?.kind||'med'),
  insulation:v.insulation+v.protection,feels:world.feels+v.insulation*.4+v.protection*.2,
  resourcePressure:1-world.supply,staminaFactor,painFactor:1-.0025*s.pain,moodFactor:s.despair>=70?.7:s.despair>=40?.8:1,
  dirty:s.hygiene<40,sick:s.infection>=30,immobile:v.stamina<=0||d.move===0,unconscious:s.rest<=0||s.health<=10,
  ...Object.fromEntries(['濒临崩溃','饥饿','消沉','沮丧','愤怒','烦躁','担忧','恍惚','愉快','平常'].map(k=>[k,d.feelings.includes(k)])),
  shelterBonus:2+.4*level(a,'build'),carePower:15+2*level(a,'med')
 };
}
