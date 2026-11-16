import { arbitrate, type Candidate } from './arbiter.ts';
import { compile } from './modifier.ts';
import {canHear,slotPosition} from './space.ts';
import {JOB_INDEX, WORK_HOURS} from './constants.ts';
import { DATA } from './data.generated.ts';
import type { World } from './world.ts';
import type { Npc, StockKey, GameData } from './types.ts';

export function levelOf(stock:number,warn:number,mid:number,crit:number) {
  if(stock<=0)return 'L4';
  if(stock<crit)return 'L3';
  if(stock<mid)return 'L2';
  if(stock<warn)return 'L1';
  return null;
}
const tags:Record<string,string[]> = {
  EatHand:[],SeekFood:['forage','move_or_work'],BegFood:['beg','ask_help','ask_that_person','social'],
  StealFood:['steal'],EatRot:['eat_rot','self_harm'],EatNonFood:['self_harm'],
  DrinkClean:[],BoilWater:['light_fire'],DrinkDirty:['self_harm'],WarmAtFire:[],
  BurnFurniture:[],Huddle:['ask_help','social'],SelfTreat:['self_treat'],CallHelp:['ask_help','ask_that_person'],
};
const clamp=(v:number)=>Math.max(0,Math.min(100,v));
const tierCache=new WeakMap<GameData,Map<string,{act:number;run:number}>>();
function candidate(data:GameData,id:string,tierId:string,score=1,target?:number):Candidate{
  let map=tierCache.get(data);
  if(!map){
    map=new Map();
    let previous=0;
    for(const tier of data.aiPriority){
      const act=Number(tier.act),run=Number(tier.run);
      if(map.has(tier.id) || !(act>previous) || !(run>=act))
        throw Error('Invalid priority row '+tier.id);
      map.set(tier.id,{act,run});
      previous=act;
    }
    if(map.size!==33)throw Error('Expected 33 priority tiers');
    tierCache.set(data,map);
  }
  const tier=map.get(tierId);
  if(!tier)throw Error('Unknown tier '+tierId);
  return {id,tierId,...tier,score,tag:id,target};
}
export function passes(data:GameData,gate:string,values:Record<string,number>){
  const row=data.gates.find(g=>g.gate===gate);
  if(!row)throw Error(gate);
  return row.cond.split(' AND ').every(term=>{
    const m=/^(\w+)(>=|>|<)([\d.]+)$/.exec(term);
    if(!m)return values[term]===1;
    return m[2]==='>='?values[m[1]]>=+m[3]:m[2]==='>'?values[m[1]]>+m[3]:values[m[1]]<+m[3];
  });
}
export const socialScenes: ReadonlySet<string> = new Set(['Cloth','IslandEdit','Other','Question','Goods','RoomStyle']);
export function leisureScene(cat:string,id=''){
  return socialScenes.has(cat) || ['S10_gossip','S22_night_talk','S23_share_secret','S25_teach_skill'].includes(id);
}
export function sceneActors(w:World,cat:string,id=''){
  if(!leisureScene(cat,id))return w.alive;
  if(!surplus(w))return [];
  const data=w.data??DATA;
  const scene=candidate(data,'Scene','M60');
  return w.alive.filter(n=>{
    if(!n.survival)return true;
    const active=candidate(data,n.survival.behavior,n.survival.tier);
    return arbitrate([scene],active).chosen===scene;
  });
}
export function fightAllowed(w:World,rp:number){
  return passes(w.data??DATA,'fight_boost',{RP:rp});
}
export function socialWeight(w:World,cat:string){
  if(!socialScenes.has(cat) && cat!=='Relation')return 1;
  const data=w.data??DATA;
  const alive=w.alive;
  const avgSatiety=alive.reduce((sum,n)=>sum+n.stocks.Satiety,0)/alive.length;
  if(!passes(data,'social_decay',{avgSatiety}))return 1;
  return Number(data.gates.find(g=>g.gate==='social_decay')!.note.match(/^x([\d.]+)/)![1]);
}
export function romance(w:World,a:number,b:number){
  const f=w.npc(a).stocks,t=w.npc(b).stocks;
  return passes(w.data??DATA,'romance',{bothSatiety:Math.min(f.Satiety,t.Satiety),bothWarmth:Math.min(f.Warmth,t.Warmth)});
}
export function surplus(w:World){
  const alive=w.alive;
  return passes(w.data??DATA,'scene_flow',{SupplyRatio:w.supplyRatio(),avgSatiety:alive.reduce((s,n)=>s+n.stocks.Satiety,0)/alive.length,
    no_band_S:+!alive.some(n=>['M96','M97','M98','M99'].includes(n.survival?.tier??''))});
}
export function tendFire(w:World){
  const threshold=Number((w.data??DATA).behaviors.find(row=>row.id==='BoilWater')!.skill_gate);
  for(const n of w.alive){
    if(n.job!=='firewood')continue;
    n.skills??={};
    n.skills.Fire=Math.max(n.skills.Fire??0,threshold);
  }
}
export function reserveRation(w:World,n:Npc){
  const modifier=(w.data??DATA).modifiers.find(row=>row.target==='hoard')!;
  return compile(modifier.expr)({...n.traits})>=1;
}
export function availableWork(w:World,n:Npc){
  if(n.sleeping || n.job==='idle')return 0;
  const state=n.survival;
  if(!state || state.behavior===n.job)return 1;
  if(['M02','M96','M97','M98','M99'].includes(state.tier))return 0;
  const behavior=(w.data??DATA).behaviors.find(b=>b.id===state.behavior);
  return behavior ? Math.max(0,1-Number(behavior.duration_s)/3600) : 0;
}
export function mourn(w:World,person:Npc){
  for(const other of w.alive){
    const state=other.survival??={tier:'M10',behavior:other.job,cooldown:{},effects:{}};
    state.effects.Despair=clamp((state.effects.Despair??0)+30);
    other.memories.push({id:'M60:Mourn:'+person.id,permanent:true,day:w.day});
  }
}
export function zeroDamage(w:World,n:Npc){
  const rows=(w.data??DATA).needLadder;
  n.satietyZeroHours=n.stocks.Satiety<=0?n.satietyZeroHours+1:0;
  n.dehydrateHours=n.stocks.Hydration<=0?n.dehydrateHours+1:0;
  n.hypothermiaHours=n.stocks.Warmth<=0?n.hypothermiaHours+1:0;
  for(const row of rows){
    if(n.stocks[row.need as StockKey]<=0 && Number(row.zero_hours)>0)
      n.stocks.Health-=Number(row.zero_hp)/Number(row.zero_hours);
  }
}
export function survivalTick(w:World,n:Npc,now=w.tick*60){
  const data=w.data??DATA;
  const s=n.survival??={tier:'M10',behavior:n.job,cooldown:{},effects:{}};
  const stock=n.stocks;
  // E3: M12 uses the CSV run threshold to hold a player assignment above M11.
  const list=[candidate(data,n.job,n.jobLockedToday?'M12':'M10')];
  if(s.effects.Danger>0)list.push(candidate(data,'Flee','M97'));
  if(s.effects.Bleeding>0 || s.effects.Choking>0)list.push(candidate(data,'FirstAid','M98'));
  const others=w.alive.filter(p=>p.id!==n.id);
  const holders=others.filter(p=>(p.survival?.effects.Ration??0)>0);
  const holder=holders.sort((a,b)=>(w.relOf(n.id,a.id)?.bond??0)-(w.relOf(n.id,b.id)?.bond??0))[0];
  const helpers=others.filter(p=>(w.relOf(n.id,p.id)?.bond??0)>=120 && !(s.cooldown['ask'+p.id]>now))
    .sort((a,b)=>(w.relOf(n.id,b.id)?.bond??0)-(w.relOf(n.id,a.id)?.bond??0));
  const healthRow=data.needLadder.find(row=>row.need==='Health')!;
  let responder:Npc|undefined;
  if(stock.Health<Number(healthRow.crit) && stock.Health>=10){
    const slots=[0,0,0,0];
    const positions=w.npcs.map(actor=>{
      const group=JOB_INDEX.indexOf(actor.job);
      const site=WORK_HOURS.has(w.hour) ? w.sites?.find(s=>s.resource===actor.job && s.state!=='unknown') : undefined;
      return slotPosition(group,slots[group]++,site);
    });
    responder=helpers.find(peer=>canHear(positions[n.id],positions[peer.id]));
  }
  const helper=helpers[0];
  const donor=helpers.find(p=>(p.survival?.effects.Ration??0)>0);
  const warmDonor=helpers.find(p=>p.stocks.Warmth>=stock.Warmth+2*Number(data.behaviors.find(b=>b.id==='Huddle')!.delta));
  const supply=w.supplyRatio();
  const env:Record<string,number>={...n.traits,...stock,...s.effects,SupplyRatio:supply,RP:w.resourcePressure(),
    // E3: scarcity reaches its maximum at half of required supplies.
    ScarcityNorm:Math.min(1,Math.max(0,(1-supply)/0.5)),bond:helper?(w.relOf(n.id,helper.id)?.bond??0):0,
    Fire:n.skills?.Fire??s.effects.Fire??0,Medical:n.skills?.Medical??s.effects.Medical??0};
  const fieldFood=n.job==='food' && WORK_HOURS.has(w.hour) && !n.sleeping &&
    w.sites?.some(site=>site.resource==='food' && site.state==='known' && site.stock>=1);
  const afford:Record<string,boolean>={
    has_food_in_hand:(s.effects.Ration??0)>0,food_source_nearby:w.policy.rationPerPerson>0 && (w.store.food>=1 || !!fieldFood),
    person_with_food:!!donor,person_holding_food:!!holder,
    rotten_food:(w.store.rot??0)>0,grass_or_leather:(w.store.roots??0)>0,clean_water:w.policy.rationPerPerson>0 && w.store.water>=1,
    fire_and_raw_water:w.fireActive,dirty_water:w.season!=='winter',fire_lit:w.fireActive,
    furniture:(w.store.furniture??0)>0,friend_with_bond_120:!!warmDonor,medkit:(w.store.medkit??0)>0,person_within_15m:!!responder,
  };
  let failed=false;
  for(const row of data.needLadder){
    const need=row.need as StockKey;
    const level=levelOf(stock[need],+row.warn,+row.mid,+row.crit);
    if(!level)continue;
    if(need==='Rest'){list.push(candidate(data,'Rest',row[level==='L4'?'zero_tier':level.toLowerCase()+'_tier']));continue}
    if(level==='L4'||(need==='Health' && stock.Health<=+row.crit)){
      const dying=need==='Health' && stock.Health<10;
      list.push(candidate(data,dying?'Dying':'Survive'+need,dying?'M99':'M96',0));
    }
    let count=0;
    // E3: retain the v5 M84 ranking below authored M85–M87 scene locks.
    for(const b of data.behaviors){
      if(b.need!==need||(level!=='L4' && b.level!==level)||!afford[b.affordance]||s.cooldown[b.id]>now)continue;
      const skill=b.id==='SelfTreat'?env.Medical:env.Fire;
      if(b.skill_gate!=='-'&&skill<+b.skill_gate)continue;
      const target=b.id==='StealFood'?holder:b.id==='BegFood'?donor:b.id==='Huddle'?warmDonor:
        b.id==='CallHelp'?responder:undefined;
      env.bond=target?(w.relOf(n.id,target.id)?.bond??0):0;
      let score=+b.base;
      for(const m of data.modifiers){
        if(!tags[b.id]?.includes(m.target))continue;
        if(m.source==='state' && !(n.feeling===m.key || (m.key==='Pain_ge70' && env.Pain>=70)))continue;
        if(m.source==='memory' && !n.memories.some(x=>x.id===m.key || (target && x.id===m.key+':'+target.id)))continue;
        if(m.source==='context' && !(m.key==='night'?w.hour<6:w.alive.length>2))continue;
        if(m.expr.startsWith('GATE ')){if((env[m.key]??0)<Number(m.expr.slice(5)))score=0;}
        else score*=compile(m.expr)(env);
      }
      if(score>0){count++;list.push(candidate(data,b.id,level==='L4'||b.id==='CallHelp'?'M96':b.tier,score,target?.id))}
    }
    if(!count&&level==='L3')failed=true;
  }
  if(failed && list.length===1){list.length=0;list.push(candidate(data,'Retry','M02'))}
  const current=list.find(c=>c.id===s.behavior && c.tierId===s.tier);
  const choice=arbitrate(list,current??null).chosen!;
  if(s.behavior!==choice.id||s.tier!==choice.tierId)
    w.pushLog('SURVIVAL',n.name+' '+s.tier+' → '+choice.tierId+'/'+choice.id);
  s.behavior=choice.id;s.tier=choice.tierId;s.target=choice.target;
  if(s.tier==='M02'){s.retryAt=now+1;w.pushLog('SURVIVAL',n.name+' M02 retry @ '+s.retryAt);return}
  delete s.retryAt;
  if(choice.id==='Rest' && !n.sleeping){
    const rest=data.stocks.find(row=>row.key==='Rest')!;
    stock.Rest=clamp(stock.Rest+Number(rest.per_hour_sleep)-Number(rest.per_hour_wake));
    n.sleeping=true;
  }
  const b=data.behaviors.find(r=>r.id===choice.id);
  if(!b)return;
  const target=choice.target===undefined?null:w.npc(choice.target);
  if(choice.id==='BegFood' && target && target.traits.agree<n.traits.grit){
    s.cooldown['ask'+target.id]=now+(+b.cooldown_min);
    if(!n.memories.some(m=>m.id==='refused_help:'+target.id))
      n.memories.push({id:'refused_help:'+target.id,permanent:false,day:w.day});
    return;
  }
  const cost:Record<string,string>={SeekFood:'food',DrinkClean:'water',BurnFurniture:'furniture',SelfTreat:'medkit',EatRot:'rot',EatNonFood:'roots'};
  if(cost[b.id]){
    const nutrition = b.id==='DrinkClean'?100:b.id==='SeekFood'?62:0;
    const units = nutrition ? Number(b.delta)/nutrition : 1;
    if(b.id==='SeekFood' && w.store.food<units)w.harvest('food',units);
    else w.store[cost[b.id]]-=units;
  }
  if(b.id==='EatHand')s.effects.Ration--;
  if(b.id==='Huddle' && target)target.stocks.Warmth=clamp(target.stocks.Warmth-Number(b.delta));
  if((b.id==='BegFood'||b.id==='StealFood')&&target?.survival)target.survival.effects.Ration--;
  const need=b.need as StockKey;
  const before=stock[need];
  if(b.id==='SelfTreat')s.effects.Pain=clamp((s.effects.Pain??0)+Number(b.delta));
  else stock[need]=clamp(stock[need]+Number(b.delta));
  for(const term of b.side_effect.split(';').filter(Boolean)){
    const [key,raw]=term.split(':');const v=Number(raw);
    if(key==='Bond' && target){const r=w.relOf(target.id,n.id)!;r.bond=Math.max(0,r.bond+v);r.tags.add('Suspect');
      w.pushLog('STEAL_FOOD',n.name+' 饱食 '+before.toFixed(1)+' → '+choice.tierId+' 抢走'+target.name+'的口粮 → 饱食 '+stock[need].toFixed(1)+'；'+target.name+' 对其 Bond '+v+'，现为 '+r.bond+'，标签 '+[...r.tags].join('/'));}
    else if(key==='Health')stock.Health=clamp(stock.Health+v);
    else if(key!=='FailureInfection'&&key!=='Durability')s.effects[key]=clamp((s.effects[key]??0)+v);
  }
  if(b.id==='EatRot' && !n.memories.some(m=>m.id==='poisoned_by_rot')){
    n.memories.push({id:'poisoned_by_rot',permanent:false,day:w.day});
  }
  if(+b.cooldown_min)s.cooldown[b.id]=now+Number(b.cooldown_min);
}

/** 配给之后的分钟重试。两次世界变化之间，完全相同的失败检查可直接合并。 */
export function retryNeeds(w:World){
  const end=(w.tick+1)*60;
  let waiting=w.alive.filter(n=>n.survival?.tier==='M02');
  let minute=w.tick*60+1;
  while(waiting.length && minute<end){
    for(const n of waiting)survivalTick(w,n,minute);
    const remaining=waiting.filter(n=>n.survival?.tier==='M02');
    if(remaining.length===waiting.length){
      let next=end;
      for(const n of remaining){
        for(const expiry of Object.values(n.survival!.cooldown))
          if(expiry>minute)next=Math.min(next,Math.ceil(expiry));
      }
      // 模拟分钟之间没有生产、移动或存量变化。下一次结果只可能在冷却结束时改变。
      for(const n of remaining)n.survival!.retryAt=next;
      minute=next;
    }else minute++;
    waiting=remaining;
  }
}
