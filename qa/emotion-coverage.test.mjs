import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {Scene} from 'three';
import {catalogScenes} from '../src/performance/catalog-scenes.js';
import {extraTitles} from '../src/performance/cases/social-extra.js';
import {emotionBeat,createEmotionStage} from '../src/performance/emotion-stage.js';
import {parseCsv} from '../src/performance/runtime.js';

const definitions=parseCsv(readFileSync(new URL('../src/performance/data/skit-def.csv',import.meta.url),'utf8'));
const screenings=new Map();
for(const row of definitions){
  if(row.skit_id.startsWith('CAMP_')){
    screenings.set(row.skit_id,{type:'camp-story',sceneId:row.scene_id,result:row.branch_id});
  }else if(row.skit_id.startsWith('IS_')){
    screenings.set(row.scene_id,{type:row.scene_id,sceneId:row.scene_id,result:row.branch_id});
  }
}
for(const id of Object.keys(extraTitles))screenings.set(id,{type:id,sceneId:id});
for(const id of catalogScenes.keys())screenings.set(id,{type:'catalog-scene',sceneId:id,performanceKey:id});

const themes=new Set(['blush','floral','stars','music','subdued','warm','discovery','tension','comic']);
test('every selectable performance has a bounded reaction for a valid role',()=>{
  assert.equal(screenings.size,135);
  for(const [id,event] of screenings){
    let frames=0;
    assert.equal(emotionBeat(event,0,6000),null,id+' opening');
    assert.equal(emotionBeat(event,6000,6000),null,id+' exit');
    for(let ms=0;ms<6000;ms+=25){
      const beat=emotionBeat(event,ms,6000);
      if(!beat)continue;
      frames++;
      assert.ok(themes.has(beat.theme),id+' theme '+beat.theme);
      assert.ok(['a','b','both'].includes(beat.role),id+' role '+beat.role);
      assert.ok(beat.t>=0 && beat.t<1,id+' normalized clock');
      assert.ok(Number.isFinite(beat.seconds) && beat.seconds>=0,id+' backdrop clock');
    }
    assert.ok(frames>0,id+' has a playable beat');
  }
});

test('clearing mid-reaction restores a direct render without a backdrop',()=>{
  const scene=new Scene(),stage=createEmotionStage(scene,[]);
  const event={...screenings.get('mutual-feeling'),participants:[]};
  const ms=Array.from({length:120},(_,i)=>i*50).find(t=>emotionBeat(event,t,6000));
  assert.ok(Number.isFinite(ms));
  stage.begin(event);
  stage.frame(event,ms,6000);
  stage.clear();
  let draws=0;
  stage.draw(()=>{draws++;assert.equal(scene.background,null);});
  assert.equal(draws,1);
});


test('all selected actors show a facial change on their rig and restore after interruption',async()=>{
  const {portraitActor,disposeActor}=await import('../src/characters.js');
  const {createCinemaActing}=await import('../src/performance/cinema-acting.js');
  const scene=new Scene();
  const actors=['lin','zhou','qiao'].map(id=>portraitActor(id));
  for(const actor of actors)scene.add(actor.mesh);
  const stage=createEmotionStage(scene,actors),acting=createCinemaActing(actors);
  function face(actor){
    return [...actor._eyes,actor._mouth,...actor._head.children.filter(n=>n.name==='brow')]
      .flatMap(n=>[...n.scale.toArray(),...n.position.toArray(),...n.quaternion.toArray()]);
  }
  try{
    for(const [id,screening] of screenings){
      const cast=actors.slice(0,catalogScenes.get(id)?.tracks.length??2);
      const event={...screening,participants:cast.map(a=>a.id)};
      const timing=Array.from({length:240},(_,i)=>i*25).find(ms=>{
        const beat=emotionBeat(event,ms,6000);
        return beat && beat.t>=.37;
      });
      assert.ok(Number.isFinite(timing),id);
      const beat=emotionBeat(event,timing,6000);
      const before=cast.map(face);
      const beforeChildren=cast.map(a=>a._head.children.length);
      const reset=acting.begin(event);
      stage.begin(event);
      acting.frame({kind:'pair',totalMs:6000},timing/6000,timing);
      const neutral=cast.map(face);
      stage.frame(event,timing,6000);
      const shown=cast.map(face);
      const selected=beat.role==='both'?[0,1].slice(0,cast.length):[beat.role==='b'?1:0];
      for(const i of selected)assert.notDeepEqual(shown[i],neutral[i],id+' actor '+i);
      stage.clear();
      reset();
      assert.ok(cast.every((a,i)=>face(a).every((value,k)=>Math.abs(value-before[i][k])<1e-8)),id+' reset transforms');
      assert.deepEqual(cast.map(a=>a._head.children.length),beforeChildren,id+' reset face meshes');
    }
  }finally{actors.forEach(disposeActor);}
});

