import {captionPages} from '../packages/npc-voice/src/caption.ts';
import speakers from '../data/voice/speakers.csv?raw';
import assembly from '../data/voice/scenes/daily/water/water.build.csv?raw';
import {csv,loadVoice} from '../packages/npc-voice/src/data-voice.ts';
import {runScene} from '../packages/npc-voice/src/script.ts';
import {render} from '../packages/npc-voice/src/line.ts';
import {pickBark} from '../packages/npc-voice/src/bark.ts';
import {profileOf,buildSynthParams,synthesize} from '../packages/npc-voice/src/voice.ts';
import lines from '../data/voice/lines.csv?raw';
import vocab from '../data/voice/vocab.csv?raw';
import voices from '../data/voice/voices.csv?raw';
import rules from '../data/voice/bark-rules.csv?raw';
import flow from '../data/voice/scenes/daily/water/water.flow.csv?raw';
import sceneLines from '../data/voice/scenes/daily/water/water.lines.csv?raw';
const data=loadVoice({lines,vocab,voices,rules,flow,sceneLines});
const personas=csv(speakers), builds=new Map(csv(assembly).map(row=>[row.label,row]));
function identity(actor){
  const row=personas.find(p=>p.id===actor.id)??personas[profileOf(actor).pitch%personas.length];
  return {...row,...actor,nickname:actor.nickname??actor.name,firstName:actor.firstName??(actor.name.slice(1)||actor.name),
    lastName:actor.lastName??actor.name[0],shortPhrase:row};
}
function phrase(id,actor,cast=[actor]){

  const line=data.lines.get(id);
  const speaker=identity(actor),actors=Object.fromEntries(cast.map(a=>[a.id,identity(a)]));
  const relations=Object.entries(actor.relationships??{}).filter(([id])=>actors[id]).sort((a,b)=>b[1].familiarity-a[1].familiarity);
  const social={speaker:speaker.nickname};
  for(const [i,key] of ['friendA','friendB','friendC','friendD'].entries())social[key]=actors[relations[i]?.[0]]?.nickname??'岛友';
  social.bestFriend=social.friendA;
  for(const [key,label] of Object.entries({lover:'恋人',spouse:'配偶',child:'孩子',parent:'家长',exLover:'前任',sibling:'手足'})){
    const match=relations.find(([,r])=>r.bond===label||(key==='lover'&&r.romance));
    social[key]=actors[match?.[0]]?.nickname??label;
  }
  const ctx={speaker,actors,social,vocab:data.vocab};
  return {display:render(line,ctx),spoken:render(line,ctx,'speak'),pages:captionPages(line,ctx),line};
}
export const islandLanguage={
  queue(scene,actor,beat,cast){
    const outcome=['queue-yield','queue-argue','queue-apology','queue-avoid'].indexOf(scene.branch);
    const fromSave=scene.voiceBeat===beat-1&&scene.voiceCursor;
    const steps=runScene(data.scene,{variable:()=>outcome},fromSave||undefined);
    let skip=fromSave?0:beat,step;
    for(const current of steps)if(current.type==='msg'&&skip--===0){step=current;break;}
    scene.voiceCursor=step.save;scene.voiceBeat=beat;
    const build=builds.get(scene.branch);
    return {...phrase(step.lineId,actor,cast),expression:build.expression.split(',')[beat],camera:build.camera.split(',')[beat]};
  },
  bark(actor,time,rng,cast){
    if(time<(actor.nextBarkAt??0)) return;
    actor.nextBarkAt=time+30+rng()*30;
    const ctx={minute:time/60,bond:Math.max(0,...Object.values(actor.relationships).map(r=>r.familiarity)),
      mood:actor.mood,memories:actor.memories.map(m=>m.kind)};
    const result=pickBark(ctx,data.rules,actor.barkCooling??{},rng);
    if(result){actor.barkCooling=result.cooling;return phrase(result.lineId,actor,cast);}
  }
};
export function voicePlayer(button,onError){
  let audio,source,last;
  button.onclick=async()=>{
    try{
      audio??=new AudioContext();
      const enabled=button.getAttribute('aria-pressed')!=='true';
      if(enabled) await audio.resume(); else {source?.stop();await audio.suspend();}
      button.setAttribute('aria-pressed',String(enabled));button.textContent=enabled?'NPC 声音 · 开':'NPC 声音 · 关';last=null;
    }catch{onError('当前设备无法开启 NPC 声音。');}
  };
  return (actor,key)=>{
    if(key===last)return;
    last=key;source?.stop();source=null;
    if(!actor||audio?.state!=='running')return;
    const entry=actor.voicePhrase?.display===actor.speech?actor.voicePhrase:null;
    const params=buildSynthParams(entry?.line??{attrs:{}},data.voices.get(actor.id)??profileOf(actor),entry?.spoken??actor.speech);
    const {pcm,sampleRate}=synthesize(params);
    if(!pcm.length)return;
    const buffer=audio.createBuffer(1,pcm.length,sampleRate);buffer.copyToChannel(pcm,0);
    source=audio.createBufferSource();source.buffer=buffer;source.connect(audio.destination);source.start();
  };
}
