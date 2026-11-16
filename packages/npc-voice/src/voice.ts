export const fields=['pitch','speed','quality','tone','accent','intonation'];
export function profileOf(npc) {
  let hash=2166136261;
  for(const c of String(npc.id)) hash=Math.imul(hash^c.charCodeAt(0),16777619);
  const profile={preset:'adult'};
  for(const key of fields){
    hash=(Math.imul(1664525,hash)+1013904223)>>>0;
    profile[key]=25+hash%51;
  }
  if(Number.isFinite(npc.personality?.energy)) profile.speed=Math.round(25+50*npc.personality.energy);
  return profile;
}
export function buildSynthParams(line,profile,text=line.text){
  const offsets={child:[20,10,0,8,0,10],adult:[0,0,0,0,0,0],elder:[-12,-20,-12,0,8,-4],
    idol:[10,5,5,8,-4,16],shout:[14,12,15,12,5,12],flat:[0,-3,0,-12,0,-30],hushed:[-8,-10,-25,-8,0,-10]};
  const preset=line.attrs.preset??profile.preset;
  const result={...profile,...line.attrs,text,preset,speedScale:line.attrs.speed??1};
  for(const [i,key] of fields.entries())result[key]=Math.min(100,Math.max(0,profile[key]+(offsets[preset]?.[i]??0)));
  return result;
}
export function synthesize(p){
  const sampleRate=16000;
  const units=p.readMode==='char'?Array.from(p.text).filter(c=>c.trim()):p.text.match(/[a-zA-Z\u00c0-\u024f]+|[^\s]/gu)||[];
  const samples=[],base=115*2**(p.pitch/100);
  for(let i=0;i<Math.round(sampleRate*(p.pauseMs||0)/1000);i++) samples.push(0);
  for(const [index,unit] of units.entries()){
    const x=index/Math.max(1,units.length-1), code=unit.codePointAt(0);
    const length=Math.round(sampleRate*(.16-.08*p.speed/100)/p.speedScale*
      (1+(index===0?(p.firstSylLen||0):index===units.length-1?(p.lastSylLen||0):0)/16));
    const silent=/^\p{P}$/u.test(unit);
    let phase=0;
    for(let i=0;i<length;i++){
      const t=i/length;
      const hz=base*(1+(1-x)**3*p.tone/400-x**3*p.accent/450+
        Math.sin(index*1.7+t*(1-(p.pitchSmooth??0)/120))*p.intonation/500+
        Math.sin(i/sampleRate*2*Math.PI*(1+(p.vibratoRate??0)/30))*(p.vibratoWidth??0)/1500);
      phase+=2*Math.PI*hz/sampleRate;
      const envelope=Math.min(t*10,1,(1-t)*5);
      samples.push(silent?0:envelope*(Math.sin(phase)*.13+Math.sin(phase*(2+code%4))*p.quality*.0006));
    }
    if(p.readMode==='word'||p.readMode==='char'||(p.readMode==='line'&&silent)){
      const pause=Math.round(sampleRate*(p.readMode==='line'?.16:.045));
      for(let i=0;i<pause;i++)samples.push(0);
    }
  }
  const pcm=Float32Array.from(samples);
  return {pcm,sampleRate,durationMs:pcm.length/sampleRate*1000};
}
