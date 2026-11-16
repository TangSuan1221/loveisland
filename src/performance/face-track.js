import {EMOTES} from './runtime.js';

const roles=['F','T','A'];
const feelings=[
  ['濒临崩溃','Desperate'],['饥饿','Starving'],['消沉','Depress'],['愤怒','Angry'],
  ['沮丧','Deject'],['烦躁','Irritate'],['担忧','Worry'],['恍惚','Careless'],
  ['愉快','Good'],['平常','Neutral']
];

export function buildFaceTrack(plan,event){
  const effects=new Map();
  for(const token of (event.effect||'').split(';')){
    const [kind,role,value]=token.split(':');
    if(kind==='feeling' && roles.includes(role) && EMOTES.has(value))effects.set(role,value);
  }
  const ending=event.participants.slice(0,3).map((id,i)=>{
    const values=event.resultFeelings?.[i]||[];
    return effects.get(roles[i])||feelings.find(([label])=>values.includes(label))?.[1]||'Neutral';
  });
  const settleAt=Math.max(0,plan.total-600);
  const authored=plan.cues.filter(c=>['face','say'].includes(c.kind)&&EMOTES.has(c.emote)&&c.t<settleAt);
  // Reserve the last change for settlement. Prefer deliberate face beats over dialogue defaults.
  const beats=[...new Set([...authored.filter(c=>c.kind==='face'),...authored].map(c=>c.t))].slice(0,2);
  return [...authored.filter(c=>beats.includes(c.t)).map(c=>({...c,dur:Math.min(c.dur,settleAt-c.t)})),
    ...ending.map((emote,i)=>({kind:'face',role:roles[i],emote,t:settleAt,dur:plan.total-settleAt+1,settlement:true}))];
}
