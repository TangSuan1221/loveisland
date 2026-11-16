import test from 'node:test';
import assert from 'node:assert/strict';
import {emotionBeat} from '../src/performance/emotion-stage.js';

test('catalog emotional cutaways resolve from the performance key on a live event',()=>{
  for(const [id,theme] of Object.entries({S11_confession:'blush',S71_become_couple:'floral',S69_watch_stars:'stars',S73_breakup:'subdued'})){
    const event={type:'staged-performance',sceneId:'run-17',performanceKey:id};
    const beats=Array.from({length:120},(_,i)=>emotionBeat(event,i*50,6000)).filter(Boolean);
    assert.ok(beats.some(beat=>beat.theme===theme),id);
    assert.equal(emotionBeat(event,0,6000),null);
    assert.equal(emotionBeat(event,5999,6000),null);
  }
  assert.equal(emotionBeat({type:'unknown-event'},3000,6000),null);
});
