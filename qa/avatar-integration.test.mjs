import test from 'node:test';
import assert from 'node:assert/strict';
import { createProduction } from '../src/production-engine.js';
import { createSimulation } from '../src/npc-simulation.js';
import { createNavigation } from '../src/production-navigation.js';

// Independent rule/simulation integration checks. These do not certify visuals,
// browser storage, editor gestures, or parity with a commercial game.
const person = (p, id) => p.getState().candidates.find(c => c.id === id);
const create = (p, name = '自建嘉宾', appearance = {}, sourceId = 'zhou') => {
  const r = p.dispatch('createCandidate', { name, appearance, sourceId });
  assert.equal(r.ok, true, r.message);
  assert.equal(typeof r.id, 'string');
  return r.id;
};
const start = p => assert.equal(p.dispatch('start').ok, true);

test('customization preserves identity and all unrelated production state', () => {
  const p = createProduction(); start(p);
  p.dispatch('toggleCast', { id: 'lin' });
  const before = p.serialize();
  assert.equal(p.dispatch('customizeCandidate', { id: 'lin', name: '  新名字  ', appearance: {} }).ok, true);
  const after = p.serialize();
  assert.equal(person(p, 'lin').name, '新名字');
  assert.ok(person(p, 'lin').appearance);
  const expected = structuredClone(before);
  expected.candidates[0].name = '新名字';
  expected.candidates[0].appearance = person(p, 'lin').appearance;
  assert.deepEqual(after, expected);
  assert.ok(p.drainEffects().some(e => e.type === 'appearance-changed' && e.id === 'lin'));
});

test('invalid input is rejected atomically, and names have bounded clean storage', () => {
  const p = createProduction();
  for (const type of ['createCandidate', 'customizeCandidate']) {
    for (const bad of [{name:''}, {name:'   '}, {name:42}, {name:'\u0000'}, {name:'可用',appearance:null}, {name:'可用',appearance:[]}, {name:'可用',appearance:'{}'}]) {
      const before = p.serialize();
      assert.equal(p.dispatch(type, {id:'lin',appearance:{},...bad}).ok, false, JSON.stringify(bad));
      assert.deepEqual(p.serialize(), before);
    }
  }
  const before = p.serialize();
  assert.equal(p.dispatch('customizeCandidate', {id:'missing',name:'角色',appearance:{}}).ok, false);
  assert.deepEqual(p.serialize(), before);
  const id = create(p, '甲'.repeat(100) + '\u0000');
  assert.equal(person(p,id).name.length, 24);
  assert.equal(/[\u0000-\u001f\u007f]/.test(person(p,id).name), false);
});

test('multiple characters and serialized copies are independent', () => {
  const p = createProduction();
  const a = create(p,'同名角色'), b = create(p,'同名角色',{},a);
  assert.notEqual(a,b);
  assert.equal(person(p,a).knownRelation,null);
  assert.equal(person(p,b).experienceRequired,0);
  const untouched = person(p,b);
  assert.equal(p.dispatch('customizeCandidate',{id:a,name:'只修改甲',appearance:{}}).ok,true);
  assert.deepEqual(person(p,b),untouched);
  const snapshot = p.serialize();
  snapshot.candidates.find(c=>c.id===a).name='外部篡改';
  assert.equal(person(p,a).name,'只修改甲');
  const restored = createProduction({saved:JSON.stringify(p.serialize())});
  assert.deepEqual(restored.getState().candidates,p.getState().candidates);
  assert.notEqual(create(restored,'重新加载后新增'),a);
});

test('appearance boundaries and painting survive roundtrip without aliasing or unsafe fields', () => {
  const p=createProduction();
  const input={hairStyle:'spiky',hairColor:'#12ABEF',height:999,eyeSize:-999,eyeY:NaN,
    faceShape:'not-a-face',heterochromia:true,unknown:'discard',
    strokes:[{color:'#ab12cd',width:99,points:[[-4,3],[.25,.75],[NaN,.4],['x',1]]}]};
  const id=create(p,'边界角色',input);
  const a=person(p,id).appearance;
  assert.equal(a.hairStyle,'spiky'); assert.equal(a.hairColor,'#12abef');
  assert.equal(a.height,1.3); assert.equal(a.eyeSize,.55); assert.equal(a.eyeY,0);
  assert.equal(a.faceShape,'oval'); assert.equal(a.heterochromia,true);
  assert.equal('unknown' in a,false);
  assert.equal(a.strokes[0].width,.2);
  assert.deepEqual(a.strokes[0].points,[[0,1],[.25,.75]]);
  input.strokes[0].points[0][0]=.8;
  assert.equal(person(p,id).appearance.strokes[0].points[0][0],0);
  const restored=createProduction({saved:JSON.stringify(p.serialize())});
  assert.deepEqual(person(restored,id).appearance,a);
  const dirty=p.serialize();
  dirty.candidates.find(c=>c.id===id).appearance={height:Infinity,strokes:[null,{points:null}]};
  const repaired=createProduction({saved:dirty});
  assert.equal(person(repaired,id).appearance.height,1);
  assert.deepEqual(person(repaired,id).appearance.strokes,[]);
});

test('old saves without appearance retain their original candidate data', () => {
  const p = createProduction(); start(p);
  const old = p.serialize();
  for (const c of old.candidates) delete c.appearance;
  const restored = createProduction({saved:old});
  assert.deepEqual(restored.getState().candidates,old.candidates);
  assert.equal(restored.getState().phase,'casting');
});

test('sixty custom characters are supported and the next create is atomic', () => {
  const p = createProduction();
  const ids = new Set();
  for(let i=0;i<60;i++) ids.add(create(p,`角色${i}`));
  assert.equal(ids.size,60);
  assert.equal(p.getState().candidates.filter(c=>c.custom).length,60);
  const before=p.serialize();
  assert.equal(p.dispatch('createCandidate',{name:'超额',appearance:{}}).ok,false);
  assert.deepEqual(p.serialize(),before);
  assert.equal(p.dispatch('customizeCandidate',{id:[...ids][0],name:'满库仍可编辑',appearance:{}}).ok,true);
});

test('liquidation restarts business but retains custom library and built-in edits', () => {
  const p=createProduction();
  const a=create(p,'保留自建角色');
  p.dispatch('customizeCandidate',{id:'lin',name:'保留原人物修改',appearance:{}});
  start(p);
  p.dispatch('investigate',{id:'lin'});
  assert.equal(p.dispatch('liquidate').ok,true);
  assert.equal(p.dispatch('start').ok,true);
  assert.equal(p.getState().phase,'casting');
  assert.equal(person(p,a).name,'保留自建角色');
  assert.equal(person(p,'lin').name,'保留原人物修改');
  assert.ok(person(p,'lin').appearance);
  assert.equal(person(p,'lin').secretKnown,false);
  assert.equal(p.getState().cash,100000);
  assert.deepEqual(p.getState().cast,[]);
  assert.notEqual(create(p,'新经营新增'),a);
});

test('deletion protects built-ins and appeared identities, but an independent copy remains deletable', () => {
  const p=createProduction();
  const unused=create(p,'未参演'),appeared=create(p,'已参演');
  assert.equal(p.dispatch('deleteCandidate',{id:'lin'}).ok,false);
  assert.equal(p.dispatch('deleteCandidate',{id:'missing'}).ok,false);
  assert.equal(p.dispatch('deleteCandidate',{id:unused}).ok,true);
  assert.equal(person(p,unused),undefined);
  start(p);
  for(const id of [appeared,'lin','zhou','qiao'])p.dispatch('toggleCast',{id});
  const selected=p.serialize();
  assert.equal(p.dispatch('deleteCandidate',{id:appeared}).ok,false);
  assert.deepEqual(p.serialize(),selected);
  assert.equal(p.dispatch('confirmCast').ok,true);
  assert.equal(person(p,appeared).hasAppeared,true);
  const copy=create(p,'独立副本',{},appeared);
  assert.notEqual(copy,appeared);
  assert.notEqual(person(p,copy).hasAppeared,true,'copy must not inherit source participation');
  assert.equal(p.dispatch('deleteCandidate',{id:copy}).ok,true);
  p.dispatch('liquidate'); p.dispatch('start');
  const afterRestart=p.serialize();
  assert.equal(p.dispatch('deleteCandidate',{id:appeared}).ok,false,'historical identity protected after a business restart');
  assert.deepEqual(p.serialize(),afterRestart);
  assert.equal(p.dispatch('customizeCandidate',{id:appeared,name:'仍可改形象',appearance:{}}).ok,true);
});

test('custom cast participates in actual NPC navigation, services and observed facts', () => {
  const p=createProduction({seed:514});
  const custom=create(p,'独立模拟角色');
  start(p);
  for(const id of [custom,'lin','qiao','lu']) assert.equal(p.dispatch('toggleCast',{id}).ok,true);
  assert.equal(p.dispatch('confirmCast').ok,true);
  assert.equal(p.dispatch('autoBuild').ok,true);
  const initial=p.getState();
  const definitions=initial.cast.map((id,i)=>({...person(p,id),anchor:[i*1.5,3]}));
  const sim=createSimulation({seed:514,actors:definitions});
  sim.setLayout(initial.facilities,createNavigation(initial.facilities));
  let delivered=0,last=0;
  sim.setServiceHandler(r=>{const result=p.dispatch('consumeService',r);if(result.ok)delivered++;return result;});
  assert.equal(p.dispatch('startRecording').ok,true);
  for(let tick=0;tick<1350;tick++){
    sim.update(.1);
    for(const event of sim.getEvents())if(event.id>last){last=event.id;p.dispatch('observe',{event});}
    p.update(.1);
  }
  assert.ok(delivered>0,'real facility services occurred');
  assert.ok(p.getState().facts.some(f=>f.participants.includes(custom)),'custom identity appears in real simulation facts');
  assert.ok(p.getState().clips.some(c=>c.participants.includes(custom)),'custom identity produces captured footage');
  const before=sim.serialize();
  assert.equal(p.dispatch('customizeCandidate',{id:custom,name:'仍是同一个人',appearance:{}}).ok,true);
  assert.deepEqual(sim.serialize(),before,'engine edits do not reinitialize the independent simulation');
  const restored=createSimulation({actors:definitions,seed:514,saved:sim.serialize()});
  assert.deepEqual(restored.getActor(custom).needs,sim.getActor(custom).needs);
  assert.deepEqual(restored.getActor(custom).relationships,sim.getActor(custom).relationships);
});
