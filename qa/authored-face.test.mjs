import {readFileSync} from 'node:fs';
import {parseCsv} from '../src/performance/runtime.js';
const rows=parseCsv(readFileSync(new URL('../src/performance/data/skit-expression.csv',import.meta.url),'utf8'));
import test from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {EMOTES} from '../src/performance/runtime.js';
import {createAuthoredFaces,faceCueAt} from '../src/performance/authored-face.js';

function actor(id){
  const head=new Group(),eye=new Group(),brow=new Group(),mouth=new Group();
  brow.name='brow';brow.position.x=.1;eye.userData.baseScaleY=1;head.add(eye,brow,mouth);
  return {id,_head:head,_eyes:[eye],_mouth:mouth,_faceDepth:()=>.18};
}

test('all 18 script emotes produce distinct poses on the addressed performer',()=>{
  const poses=new Set();
  for(const emote of EMOTES){
    const f=actor('f'),t=actor('t'),stage=createAuthoredFaces([f,t],rows);
    stage.begin({participants:['f','t']});
    const cue={kind:'face',role:'T',emote,t:200,dur:500};
    stage.frame([cue],440);
    assert.equal(f._eyes[0].scale.y,1);
    const brow=t._head.getObjectByName('brow');
    const pose=[t._eyes[0].scale.y,brow.rotation.z,brow.position.y,t._mouth.scale.y];
    if(emote==='Neutral')assert.deepEqual(pose,[1,0,0,1]);
    poses.add(JSON.stringify(pose));stage.clear();
    assert.equal(t._head.children.length,3);
  }
  assert.equal(poses.size,18);
});
test('speaker, timing, reset and same-frame face override',()=>{
  const say={kind:'say',speaker:'A',emote:'smug',t:400,dur:480};
  const face={kind:'face',role:'A',emote:'Neutral',t:400,dur:220};
  assert.equal(faceCueAt([face,say],412,'A'),face);
  assert.equal(faceCueAt([face,say],620,'A'),say);
  assert.equal(faceCueAt([face,say],880,'A'),undefined);
  assert.equal(faceCueAt([face,say],412,'F'),undefined);
});
import {buildFaceTrack} from '../src/performance/face-track.js';
import {lockCinemaFace,sampleCinemaChannels,sampleActionFace,clearActionFace} from '../src/action-face.js';

test('two authored changes leave the last beat for each participant’s settlement',()=>{
  const plan={total:2600,cues:['smile','cry','shock','smug'].map((emote,i)=>({
    kind:i===2?'face':'say',t:i*400,dur:800,role:'F',emote
  }))};
  const track=buildFaceTrack(plan,{participants:['f','t','a'],effect:'feeling:T:Good',
    resultFeelings:[['饥饿','濒临崩溃'],['愤怒'],['担忧']]});
  assert.equal(new Set(track.map(c=>c.t)).size,3);
  assert.equal(faceCueAt(track,950,'F').emote,'shock');
  assert.deepEqual(['F','T','A'].map(role=>faceCueAt(track,2600,role).emote),['Desperate','Good','Worry']);
});

test('listener tracks the speaker, can seek and releases head rotation on exit',()=>{
  const f=actor('f'),t=actor('t'),stage=createAuthoredFaces([f,t],rows);
  f._head.position.x=1;
  const cues=[{kind:'say',role:'F',t:0,dur:1000}];
  stage.begin({participants:['f','t']});
  stage.frame(cues,500);
  const yaw=t._head.rotation.y;
  assert.ok(yaw>0);
  assert.equal(f._head.rotation.y,0);
  stage.beforePose();stage.frame(cues,500);assert.equal(t._head.rotation.y,yaw);
  stage.frame(cues,1100);assert.equal(t._head.rotation.y,0);
  stage.frame(cues,500);stage.clear();assert.equal(t._head.rotation.y,0);
});

test('only the performance writes the face while locked, release restores normal playback',()=>{
  const f=actor('f');f._mouthBaseScale={x:1,y:1};
  const unlock=lockCinemaFace(f,42);
  sampleCinemaChannels([f],[],400,()=>sampleActionFace(f,0,.4,{closed:true}));
  const layer=f._head.getObjectByName('performance-face');
  assert.ok(layer.visible);
  sampleActionFace(f,0,1);clearActionFace(f);
  assert.equal(f._eyes[0].visible,false);
  assert.ok(layer.parent);
  unlock();clearActionFace(f);assert.equal(layer.parent,null);
  assert.equal(f._eyes[0].visible,true);
});
