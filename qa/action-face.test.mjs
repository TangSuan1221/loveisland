import assert from 'node:assert/strict';
import {portraitActor,disposeActor} from '../src/characters.js';
import {baseReview} from '../src/base-motion.js';
import {performTrack} from '../src/action-playback.js';
import {performances} from '../src/action-catalog.js';
import {sampleActionFace,clearActionFace,cueExpression} from '../src/action-face.js';
const a=portraitActor('lin');
const visible=(name)=>a._head.getObjectByName('performance-face')?.children.some(m=>m.visible&&m.name===name);
for(const [id] of baseReview.catalog){
  const blink=[];
  for(let frame=0;frame<=105;frame++){baseReview.sample(a,id,frame/30);blink.push(visible('closed-eyelid'));}
  assert.ok(blink.includes(true)&&blink.includes(false),id+' blink');
}
for(const entry of performances.values())for(const track of entry.tracks){
  clearActionFace(a);performTrack(a,track,2,6);assert.ok(a._head.getObjectByName('performance-face'),entry.id);
}
baseReview.sample(a,'BP057',2.8);assert.ok(visible('blush-stroke')&&visible('closed-eyelid'));
const forms=new Set();
for(let i=0;i<75;i++){baseReview.sample(a,'BP044',i/30);forms.add(a._head.getObjectByName('performance-face').children.find(m=>m.visible&&m.name.startsWith('mouth-'))?.name);}
for(const form of ['mouth-ah','mouth-ee','mouth-oh'])assert.ok(forms.has(form));
const cues=[{kind:'say',role:'F',t:0,dur:1000,emote:'blush'},{kind:'say',role:'T',t:1400,dur:900,emote:'shock'}];
assert.deepEqual(cueExpression(cues,700,0),{speech:true,mood:'tender',blush:true});
assert.equal(cueExpression(cues,700,1).speech,false);assert.equal(cueExpression(cues,1200,0).speech,false);
assert.equal(cueExpression(cues,1700,1).mood,'wary');
sampleActionFace(a,44,1,{speech:false});assert.ok(!visible('mouth-ah'));
clearActionFace(a);assert.ok(a._mouth.visible&&a._eyes.every(e=>e.visible));disposeActor(a);
console.log('207 base actions, all catalog role tracks, blink, blush, speech shapes, turn taking and restoration passed');
