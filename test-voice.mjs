import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {loadVoice} from './packages/npc-voice/src/data-voice.ts';
import {parseLine,render} from './packages/npc-voice/src/line.ts';
import {synthesize,buildSynthParams,fields} from './packages/npc-voice/src/voice.ts';
import {runScene} from './packages/npc-voice/src/script.ts';
import {pickBark} from './packages/npc-voice/src/bark.ts';
import {captionPages} from './packages/npc-voice/src/caption.ts';
test('caption budgets preserve content and style across pages',()=>{
  const line=parseLine({text:'{{sys:color id="teal"}}'+ '海'.repeat(40)+'{{sys:pageBreak}}{{sys:ruby text="重" rt="chóng"}}',style:'bubble'});
  const pages=captionPages(line,{});
  assert.deepEqual(pages.map(page=>page.map(p=>p.text).join('')),['海'.repeat(18)+'\n'+'海'.repeat(18),'海'.repeat(4),'重']);
  assert.equal(pages[1][0].style.color,'teal');assert.equal(pages[2][0].ruby,'chóng');
});
const names={lines:'lines',vocab:'vocab',voices:'voices',rules:'bark-rules',flow:'scenes/daily/water/water.flow',sceneLines:'scenes/daily/water/water.lines'};
const files=Object.fromEntries(Object.entries(names).map(([k,v])=>[k,readFileSync(new URL('./data/voice/'+v+'.csv',import.meta.url),'utf8')]));
const data=loadVoice(files);
const ctx={minute:0,bond:0,mood:'calm',memories:[]};
test('A1 unknown tag',()=>assert.throws(()=>parseLine('{{nope:x}}'),/UnknownTag/));
test('A2 name pronunciation',()=>{
  const line=parseLine('{{speaker:nickname}}'),ctx={speaker:{nickname:{name:'小明',voice:'xiǎo míng'}}};
  assert.equal(render(line,ctx),'小明');assert.equal(render(line,ctx,'speak'),'xiǎo míng');
});
test('A3 vocabulary references',()=>{
  for(const line of data.lines.values()) for(const tag of line.tags) if(tag.group==='world')assert.ok(data.vocab.has(tag.args.id));
});
const base={...data.voices.get('lin'),text:'啊啊啊',speedScale:1};
test('A4 six audible parameters',()=>{
  for(const key of fields){
    const low=synthesize({...base,[key]:0}).pcm,high=synthesize({...base,[key]:100}).pcm;
    assert.notDeepEqual(low,high);
    if(key==='pitch'){
      const crossings=s=>s.reduce((n,v,i)=>n+Number(v>0&&s[i-1]<=0),0);
      assert.ok(crossings(high)/crossings(low)>=1.3);
    }
  }
});
test('A5 three voices preserve text and change duration',()=>{
  const times=[0,50,100].map(speed=>{
    const p=buildSynthParams({text:'海风来了',attrs:{}},{...base,speed});
    assert.equal(p.text,'海风来了');return synthesize(p).durationMs;
  });assert.ok(times[0]>times[1]*1.1&&times[1]>times[2]*1.1);
});
test('A6 water queue outcomes',()=>{
  ['queue-yield','queue-argue','queue-apology','queue-avoid'].forEach((id,outcome)=>{
    const steps=[...runScene(data.scene,{variable:()=>outcome})].filter(s=>s.type==='msg');
    assert.deepEqual(steps.map(s=>s.lineId),[id+'0',id+'1',id+'2']);
  });
});
test('A7 serialized scene cursor',()=>{
  const api={variable:()=>1},steps=runScene(data.scene,api);steps.next();
  const save=JSON.parse(JSON.stringify(steps.next().value.save));
  assert.deepEqual([...runScene(data.scene,api,save)],[...steps]);
});
test('A8 cooldown and expiry',()=>{
  const r=pickBark(ctx,data.rules,{},()=>0);
  assert.equal(pickBark(ctx,data.rules,r.cooling,()=>0),null);
  assert.equal(pickBark({...ctx,minute:2},data.rules,r.cooling,()=>0).lineId,r.lineId);
});
test('A9 weighted draw',()=>{
  const rules=[{line_id:'a',weight:10,cooldown_min:1},{line_id:'b',weight:1,cooldown_min:1}];
  let seed=1,count=0;
  for(let i=0;i<1000;i++){
    const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
    if(pickBark(ctx,rules,{},rng).lineId==='a')count++;
  }
  assert.ok(count/(1000-count)>=8&&count/(1000-count)<=12);
});
test('A10 empty pronunciation',()=>assert.throws(()=>loadVoice({...files,vocab:files.vocab.replace('yē zi','')})));
test('A11 invalid tables rejected',()=>{
  assert.throws(()=>loadVoice({...files,voices:files.voices.replace(',55,',',101,')}));
  assert.throws(()=>loadVoice({...files,rules:files.rules.replace('breeze','nonexistent')}));
  assert.throws(()=>loadVoice({...files,vocab:files.vocab+'\n'+files.vocab.trim().split('\n').at(-1)}));
});
test('A12 selection budget for 100 NPCs',()=>{
  const start=performance.now();for(let i=0;i<100;i++)pickBark(ctx,data.rules,{},()=>0.3);
  assert.ok(performance.now()-start<2);
});
