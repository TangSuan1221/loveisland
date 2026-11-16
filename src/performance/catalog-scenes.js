import {previewProps} from '../catalog-props.js';
export {previewProps};
import firstBlocking from './catalog-block-first.js';
import laterBlocking from './catalog-block-later.js';
import {performances} from '../action-catalog.js';

export const catalogScenes=new Map([...performances].filter(([key])=>/^S\d{2}_/.test(key)));

export function sceneForEvent(event){
  const key=event.performanceKey??event.sceneId??event.type;
  return catalogScenes.get(key);
}

// Cuts are placed on the six-second action track, including pauses before a reaction.
const blocking={
  S47_steal_stock:[[0,'watch'],[2.15,'hand'],[4.1,'waist']],
  S48_steal_medicine:[[0,'hand'],[2.4,'waist'],[4.35,'listener']],
  S49_torn_clothes:[[0,'waist'],[2.75,'hand']],
  S50_share_clothes:[[0,'listener'],[2,'both'],[4.25,'shoulder']],
  S51_wash_clothes:[[0,'ground'],[1.9,'work'],[4.05,'rise']],
  S52_cloth_gift:[[0,'hand'],[2.05,'both'],[4.3,'listener']],
  S53_build_shelter:[[0,'master'],[2.1,'work'],[4.18,'rise']],
  S54_dig_pit:[[0,'ground'],[2.1,'work'],[4.4,'inspect']],
  S55_clear_land:[[0,'inspect'],[2.2,'ground'],[4.1,'wide']],
  S56_mark_path:[[0,'wide'],[2.1,'ground'],[4.05,'watch']],
  S57_ask_about_past:[[0,'shoulder'],[3.15,'listener']],
  S58_ask_about_death:[[0,'both'],[2.8,'listener']],
  S59_ask_why_stay:[[0,'watch'],[2.5,'shoulder'],[4.25,'both']],
  S60_trade_item:[[0,'both'],[2.2,'hand'],[4.2,'listener']],
  S61_show_treasure:[[0,'waist'],[1.7,'hand'],[4.1,'listener']],
  S62_lose_item:[[0,'ground'],[2.5,'watch'],[4.3,'wide']],
  S63_decorate:[[0,'inspect'],[2.1,'work'],[4.45,'wide']],
  S64_rearrange:[[0,'master'],[2.0,'work'],[4.5,'inspect']],
  S65_share_room:[[0,'wide'],[2.8,'both']],
  S66_visit_grave:[[0,'wide'],[2.85,'ground']],
  S67_tell_story_of_dead:[[0,'waist'],[2.8,'listener']],
  S68_leave_behind:[[0,'both'],[2.15,'listener'],[4.1,'wide']],
  S69_watch_stars:[[0,'ground'],[2.3,'both'],[4.15,'rise']],
  S70_sing_together:[[0,'waist'],[1.85,'listener'],[3.8,'both']],
  S71_become_couple:[[0,'shoulder'],[2.25,'couplePortrait'],[4.15,'both']],
  S72_child_birth:[[0,'waist'],[2.25,'work'],[4,'both']]
};
const framing={
  watch:['profile','F',1,2.9,.40,-.25,.38,.47,43],hand:['insert','hand',.40,1.3,-.26,0,.54,.52,40],
  waist:['profile','F',1.1,2.15,.1,-.36,.46,.49,42],listener:['faceT','T',-1.5,1.3,.05,-.10,.58,.45,37],
  couplePortrait:['pair','mid',-.18,2.55,.05,-.20,.50,.46,37],
  both:['pair','mid',.65,3.8,.27,-.56,.5,.50,43],shoulder:['shoulderF','T',-2.75,1.05,.07,-.2,.65,.47,42],
  ground:['wide','F',.6,3.30,1.65,-.83,.46,.58,46],work:['profile','F',.78,2.40,.53,-.68,.50,.54,44],
  rise:['wide','mid',.55,4.25,-.38,-.47,.54,.56,45],master:['wide','mid',-1.2,4.9,1.25,-.65,.50,.57,46],
  inspect:['wide','mid',.56,3.95,2.45,-.85,.49,.59,45],wide:['wide','mid',-1.15,4.78,.85,-.65,.43,.55,45]
};
function shotAt([seconds,key]){
  const [kind,aimRole,along,side,height,aimY,screenX,screenY,fov]=framing[key];
  return {at:Math.round(seconds*1000),kind,motion:'still',fx:'none',
    composition:{aimRole,along,side,height,aimY,screenX,screenY,fov,endSide:side*(key==='wide'?1.12:key==='watch'?.91:1)}};
}
// Rehearsal, island staging and the screening room all use the same six-second clock.
export function catalogEdit(plan,event,entry){
  const total=6000;
  const setup={at:0,kind:entry.tracks.length===1?'profile':'pair',motion:'still',fx:'none',
    composition:{aimRole:entry.tracks.length===1?'F':'mid',along:.15,side:4.2,height:.18,aimY:-.65,screenX:.50,screenY:.48,fov:40}};
  const authored=plan.generated ? null : plan.cinemaShots;
  const marks=blocking[entry.id] || ((authored?.length??0)<2 && (firstBlocking[entry.id] || laterBlocking[entry.id]));
  const shots=marks ? marks.map(shotAt) : (authored||[]).map(shot=>({...shot,at:Math.round(shot.at*total/plan.total)}));
  for(const shot of shots)if(shot.composition?.aimRole==='hand')shot.catalogProp=event.equipment?.[0]??previewProps[entry.id]?.[0]?.[0];
  const faceCues=plan.generated ? [] : plan.cues
    .filter(cue=>cue.kind==='say'||(cue.emote && cue.kind==='face'))
    .map(cue=>({...cue,
      t:Math.round(cue.t*total/plan.total),dur:Math.round(cue.dur*total/plan.total)}));
  return {...plan,generated:false,title:entry.label,tier:'T2',hold:true,total,
    cinemaShots:shots.length?shots:[setup],cinemaEffects:[],cues:[
      {t:0,dur:1350,kind:'callout',channel:'callout',text:entry.label+' · '+entry.id},
      {t:1350,dur:4650,kind:'wait'},
      ...faceCues,{t:total,dur:0,kind:'end'}
    ].sort((a,b)=>a.t-b.t)};
}
