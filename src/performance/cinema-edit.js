import {sceneForEvent,catalogEdit} from './catalog-scenes.js';
import extra,{extraTitles} from './cases/social-extra.js';
import relationships from './cases/relationships.js';
import alliance from './cases/alliance.js';
import water from './cases/water.js';
import {editCamp} from './cases/camp.js';

const edits={...relationships,...alliance,...water,...extra};
// Start the result subtitle after the reaction. Confessions and refusals leave
// longer silence; a queue change can be understood in a shorter setup.
const pacing = {
  'mutual-feeling': [1650, 1750], 'feelings-declined': [1600, 1800],
  reconciled: [1550, 1500], unresolved: [1350, 1750],
  disagreed: [1200, 1450], connected: [1550, 1250],
  allied: [1400, 1400], 'alliance-declined': [1350, 1700],
  'boundary-respected': [1350, 1550], 'boundary-disagreed': [1500, 1650],
  clarified: [1550, 1650], 'created-together': [1550, 1300],
  'queue-apology': [1300, 1500], 'queue-yield': [1150, 1100],
  'queue-argue': [1250, 1350], 'queue-avoid': [1350, 1650],
  'water-shared': [1500, 1550], supported: [1450, 1750],
};

const sourceShots = {
  LOC:['location','push'], WIDE:['wide','pull'], '2SHOT':['pair','still'],
  OTS_F:['shoulderF','still'], OTS_T:['shoulderT','still'], CU_F:['faceF','still'],
  CU_T:['faceT','still'], CU_A:['faceA','still'], INSERT:['insert','still'],
  SKY:['wide','still'], POV_F:['faceT','still'], REVERSE:['profile','still'],
  DOLLY_IN:['pair','push'], LOW:['pair','still'], HIGH:['wide','still'], STATIC:['wide','still'],
};
const sourceEffects = {
  heart:'hearts', hearts_burst:'hearts', fire_glow:'warm', flash:'impact', shake:'impact',
  zoom_punch:'impact', black:'vignette', vignette:'vignette', rain:'cool', snow:'cool',
  spark:'spark', dust:'spark', star:'spark', rainbow:'warm',
};

// Single-person observational coverage is keyed to the activity in the actual NPC event.
const soloCoverage={
  eat:['insert','hand',.28,1.25,-.24,0,.39,.59,36],
  drink:['profile','F',1.4,1.75,-.09,-.18,.62,.47,35],
  read:['insert','F',1.5,.57,.42,-.48,.43,.57,31],
  warm:['profile','F',-.48,2.65,-.50,-.58,.70,.58,48],
  rest:['wide','F',-1.9,4.6,.68,-.60,.31,.58,40],
  sing:['faceF','F',1.72,.58,-.14,-.08,.57,.46,33],
  exercise:['wide','F',.15,3.80,-.44,-.75,.48,.54,44],
  watch:['shoulderF','F',-1.08,.95,-.12,-.2,.19,.53,53],
  walk:['profile','F',-.35,3.42,-.32,-.73,.67,.51,42],
  'meal-refused':['insert','hand',.34,1.15,-.39,0,.66,.6,34],
  'service-unavailable':['wide','F',-1.10,4.35,.81,-.5,.28,.58,45],
  'contest-reward':['faceF','F',1.76,1.25,-.19,-.12,.55,.44,37],
  'public-reward':['pair','F',2.20,2.05,.27,-.54,.42,.52,44]
};
function singleCamera(event){
  if(event.participants?.length!==1)return null;
  const spec=soloCoverage[event.type]||soloCoverage[event.activity];
  if(!spec)return null;
  const [kind,aimRole,along,side,height,aimY,screenX,screenY,fov]=spec;
  return {kind,motion:'still',fx:'none',at:0,composition:{aimRole,along,side,height,aimY,screenX,screenY,fov}};
}
function fromScript(plan, event) {
  const cinemaShots = [];
  const cinemaEffects = [];
  for (const cue of plan.cues) {
    if(cue.kind==='cam' && sourceShots[cue.shot]) {
      const [kind,motion]=sourceShots[cue.shot];
      cinemaShots.push({at:cue.t, kind, motion, fx:'none', sourceShot:cue.shot});
    }
    if(cue.kind==='fx' && sourceEffects[cue.fx]) {
      cinemaEffects.push({at:cue.t, until:Math.min(plan.total,cue.t+Math.max(320,cue.dur)), fx:sourceEffects[cue.fx], sourceFx:cue.fx});
    }
  }
  const solo=plan.generated && singleCamera(event);
  return {...plan,cinemaShots:editCamp(plan,event)??(solo?[solo]:cinemaShots),cinemaEffects};
}

export function editScene(plan, event) {
  if (!plan.hold || plan.tier === 'T0')
    return {...plan, cinemaShots: [], cinemaEffects: []};
  const entry=sceneForEvent(event);
  if(entry && (event.performanceKey||event.type==='catalog-scene'))return catalogEdit(fromScript(plan,event),event,entry);
  if (!Object.hasOwn(edits,event.type)) return fromScript(plan,event);

  const extraCase=Object.hasOwn(extraTitles,event.type);
  const [setup,reaction]=pacing[event.type]||[Math.round(700+edits[event.type][1].fraction*1800),1350];
  if(extraCase && plan.generated){
    plan={...plan,generated:false,tier:'T2',title:extraTitles[event.type],cues:[
      {kind:'callout',channel:'callout',text:extraTitles[event.type]},
      {kind:'wait'},{kind:'caption',channel:'caption',text:event.text},{kind:'end'}
    ]};
  }
  const reveal = setup + reaction;
  const text = event.text ?? plan.cues.find(c => c.kind === 'caption')?.text ?? '';
  const reading = Math.max(2650, 600 + [...text].length * 110);
  const total = Math.min(8000, Math.max(5000, reveal + reading));
  const cues = plan.cues.map(cue => {
    switch (cue.kind) {
      case 'callout': return {...cue, t:0, dur:setup};
      case 'cam': return {...cue, t:cue.t === 0 ? 0 : setup};
      case 'wait': return {...cue, t:setup, dur:reaction};
      case 'caption': return {...cue, t:reveal, dur:total-reveal};
      case 'end': return {...cue, t:total};
      default: return {...cue};
    }
  });
  const cinemaShots = edits[event.type].map(({fraction,...shot}) => ({
    ...shot, at: Math.floor(fraction * total), totalMs:total,
  }));
  return {...plan, total, cues, cinemaShots};
}

// Live coverage follows the activity known to the islanders at this point.
// Only the camera setup is reused here; no result animation or outcome is played.
const coverage={
  confess:'mutual-feeling',alliance:'allied',question:'clarified',help:'supported',
  boundary:'boundary-respected',collaborate:'created-together',complain:'disagreed',
  'resource-share':'water-shared',borrow:'item-borrowed','return-item':'item-returned',
  comfort:'comforted','clarify-belief':'belief-corrected','missed-promise':'promise-discussed',
  celebrate:'milestone-celebrated',mediate:'mediation-offered',contest:'contest-completed',
  'mole-task':'mole-question-answered',argue:'queue-argue',apologize:'queue-apology',
  play:'enjoyed',chat:'connected'
};
export function liveCoverage(event){
  const sequence=edits[coverage[event.kind]]||edits.connected;
  if(event.phase==='approach')return {kind:'wide',motion:'track'};
  const beat={greeting:0,topic:1,response:2,resolution:sequence.length-1}[event.phase]??0;
  const {kind,motion,composition}=sequence[Math.min(beat,sequence.length-1)];
  return {kind,motion,composition};
}
