import test from 'node:test';
import assert from 'node:assert/strict';
import { createProduction } from '../src/production-engine.js';

const fresh = saved => createProduction({saved,resetProgress:true});

test('reopening resets every business field rather than resuming the previous phase',()=>{
 const baseline=createProduction().serialize();
 for(const phase of ['title','casting','build','recording','editing','broadcast','season','management','crisis','victory','bankrupt']){
  const saved=structuredClone(baseline);
  Object.assign(saved,{phase,cash:1234,season:6,day:7,businessDay:44,experience:500,reputation:99,selectedMap:'villa',maps:['island','snow','villa'],cast:['lin','qiao'],facilities:[{id:'old'}],facts:[{id:'old'}],clips:[{thumbnail:'media:old'}],timeline:[{id:'old'}],episodes:[{id:'old'}],cases:[{id:'old'}],ledger:[{id:'old'}],pendingInterventions:[{id:'queued'}],segmentElapsed:30,segmentExtensionsUsed:2,paused:true,speed:4,loan:{remaining:6000},serial:99});
  const before=structuredClone(saved);
  assert.deepEqual(fresh(saved).serialize(),baseline,phase);
  assert.deepEqual(saved,before,'source snapshot is not mutated');
 }
});

test('reopening preserves authored names and appearances but clears learned character history',()=>{
 const previous=createProduction();
 const created=previous.dispatch('createCandidate',{name:'保留的自建角色',appearance:{},sourceId:'qiao'});
 assert.equal(created.ok,true);
 assert.equal(previous.dispatch('customizeCandidate',{id:'lin',name:'保留的原人物外观',appearance:{}}).ok,true);
 const saved=previous.serialize();
 for(const person of saved.candidates){person.secretKnown=true;person.hasAppeared=true;}
 saved.cash=4321;saved.season=4;saved.phase='recording';
 const reopened=fresh(saved);const state=reopened.getState();
 assert.equal(state.phase,'title');assert.equal(state.cash,100000);
 assert.equal(state.candidates.find(c=>c.id==='lin').name,'保留的原人物外观');
 const custom=state.candidates.find(c=>c.id===created.id);
 assert.equal(custom.name,'保留的自建角色');
 assert.deepEqual(custom.appearance,saved.candidates.find(c=>c.id===created.id).appearance);
 assert.equal(custom.secretKnown,false);assert.equal(custom.hasAppeared,false);
 assert.equal(state.candidates.find(c=>c.id==='lin').secretKnown,false);
 const second=reopened.dispatch('createCandidate',{name:'新的一局新增',appearance:{}});
 assert.equal(second.ok,true);assert.notEqual(second.id,created.id);
 assert.equal(new Set(reopened.getState().candidates.map(c=>c.id)).size,state.candidates.length+1);
 assert.deepEqual(fresh(reopened.serialize()).getState().candidates,reopened.getState().candidates);
});

test('a broken business snapshot does not prevent opening a fresh game with its character library',()=>{
 const saved={version:-1,phase:'invalid',cash:null,candidates:createProduction().getState().candidates};
 assert.equal(fresh(JSON.stringify(saved)).getState().cash,100000);
 assert.throws(()=>createProduction({saved}),/不兼容/);
});

test('normal engine restore remains available to existing simulations and tests',()=>{
 const p=createProduction();p.dispatch('start',{mode:'standard'});p.dispatch('toggleCast',{id:'lin'});
 const saved=p.serialize();assert.deepEqual(createProduction({saved}).serialize(),saved);
});

// Exercise the actual browser startup/save code with isolated storage, without a GPU.
const {readFileSync}=await import('node:fs');
const {runInNewContext}=await import('node:vm');
const source=readFileSync(new URL('../src/game.js',import.meta.url),'utf8');
const startup=source.slice(source.indexOf("const SAVE="),source.indexOf('let avatarEditor;'));
const saveFunction=source.split('\n').find(line=>line.startsWith('function save('));
function reopen(storage){
 const context={createProduction,localStorage:storage,document:{hidden:false},note:()=>{},output:null};
 runInNewContext(`${startup}\nlet mediaRun='new-session';\n${saveFunction}\nsave(true);\noutput=JSON.stringify({phase:state.phase,cash:state.cash,history:npcHistory,lastEvent,sim,bundle,loadError});`,context);
 return JSON.parse(context.output);
}
function memoryStorage(initial){
 const entries=new Map(Object.entries(initial));
 return {getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,String(value))};
}
test('actual startup replaces saved progress and drops NPC history without clearing unrelated storage',()=>{
 const p=createProduction();p.dispatch('start');
 const storage=memoryStorage({'ratings-tyrant-production-v1':JSON.stringify({production:p.serialize(),npc:{old:true},history:{lin:{memories:['old']}},lastEvent:75,mediaRun:'old-run',castKey:'old-cast'}),unrelated:'keep'});
 const state=reopen(storage);
 assert.equal(state.phase,'title');assert.equal(state.cash,100000);
 assert.deepEqual(state.history,{});assert.equal(state.sim,null);assert.equal(state.bundle,null);assert.equal(state.lastEvent,0);
 const saved=JSON.parse(storage.getItem('ratings-tyrant-production-v1'));
 assert.equal(saved.production.phase,'title');assert.equal(saved.npc,undefined);assert.equal(saved.mediaRun,'new-session');assert.deepEqual(saved.history,{});
 assert.equal(storage.getItem('unrelated'),'keep');
 assert.equal(reopen(storage).phase,'title');
});
test('broken or unavailable browser storage still opens a clean title screen',()=>{
 const storage=memoryStorage({'ratings-tyrant-production-v1':'invalid-json'});
 assert.equal(reopen(storage).phase,'title');
 assert.equal(storage.getItem('ratings-tyrant-production-v1-recovery'),'invalid-json');
 const blocked={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
 assert.equal(reopen(blocked).phase,'title');
});
test('only browser history-cache restoration triggers a fresh reload, not a normal pageshow',()=>{
 let handler,reloads=0;
 const listener=source.split('\n').find(line=>line.startsWith("window.addEventListener('pageshow'"));
 runInNewContext(listener,{window:{addEventListener:(name,callback)=>{assert.equal(name,'pageshow');handler=callback;}},location:{reload:()=>reloads++}});
 handler({persisted:false});assert.equal(reloads,0);
 handler({persisted:true});assert.equal(reloads,1);
});
