import {catalogScenes} from '../src/performance/catalog-scenes.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {editScene} from '../src/performance/cinema-edit.js';
import {degradeToT0, parseCsv, planScene, SkitPlayer} from '../src/performance/runtime.js';

const tables = {};
for (const [key,file] of Object.entries({defs:'def', beats:'beat', lines:'line', choices:'choice', shots:'shot'})) {
  tables[key] = parseCsv(readFileSync(new URL('../src/performance/data/skit-'+file+'.csv', import.meta.url),'utf8'));
}

test('authored event cuts leave room for reactions and result subtitles', () => {
  const signatures = new Set(), cutCounts=new Set();
  for (const row of tables.defs.filter(r=>r.skit_id.startsWith('IS_'))) {
    const event = {type:row.scene_id, text:'两人就刚刚发生的事情进行了交谈。'};
    const plan = planScene({tables, seed:1, tick:1, sceneId:event.type, branchId:'result', ids:{F:0,T:1,A:null}});
    const edited = editScene(plan,event);
    const {cinemaShots, total, cues} = edited;
    assert.equal(plan.total,4250);
    assert.ok(total>=5000 && total<=8000);
    assert.equal(cinemaShots[0].at,0);
    assert.ok(cinemaShots.length>=1);
    cutCounts.add(cinemaShots.length);
    assert.ok(cinemaShots.every(s=>s.composition),event.type);
    for(let i=0;i<cinemaShots.length;i++) {
      const until=cinemaShots[i+1]?.at??total;
      assert.ok(until-cinemaShots[i].at>=1000, event.type+' '+cinemaShots[i].kind);
    }
    const pause = cues.find(c=>c.kind==='wait'), caption = cues.find(c=>c.kind==='caption');
    assert.ok(pause.dur>=1000 && pause.t+pause.dur===caption.t);
    assert.equal(caption.t+caption.dur,total);
    assert.ok(caption.dur>=2650);
    const seen=[];
    const player=new SkitPlayer(edited,{onCue:c=>seen.push(c.kind)});
    player.step(total-1);
    assert.equal(player.done,false);
    player.step(1);
    assert.deepEqual(seen,cues.map(c=>c.kind));
    assert.deepEqual(editScene(degradeToT0(edited),event).cinemaShots,[]);
    assert.equal(editScene(plan,{...event,text:'长'.repeat(100)}).total,8000);
    signatures.add(JSON.stringify(cinemaShots));
  }
  assert.equal(signatures.size,18);
  assert.ok(cutCounts.size>=3 && cutCounts.has(1),'include an intentional master shot and vary the pace');
});

test('camp and reference scenes inherit their actual authored cues', () => {
  for(const row of tables.defs.filter(r=>!r.skit_id.startsWith('IS_'))){
    const plan=planScene({tables,seed:1,tick:1,sceneId:row.scene_id,branchId:row.branch_id,ids:{F:0,T:1,A:2}});
    const camp=row.skit_id.startsWith('CAMP_');
    const revised=editScene(plan,{type:camp?'camp-story':row.scene_id,participants:['a','b','c']});
    assert.equal(revised.total,plan.total);
    assert.equal(revised.cues,plan.cues);
    for(const cue of plan.cues.filter(c=>c.kind==='cam'))
      assert.ok(revised.cinemaShots.some(s=>s.at===cue.t&&s.sourceShot===cue.shot),cue.shot);
    if(camp){
      assert.equal(revised.cinemaShots[0].kind,'location');
      assert.equal(revised.cinemaShots[1].at,plan.cues.find(c=>c.kind==='caption').t);
    }
    for(const fx of revised.cinemaEffects)
      assert.ok(plan.cues.some(c=>c.kind==='fx'&&c.t===fx.at&&c.fx===fx.sourceFx));
    if(row.skit_id==='SK09_bad_song') assert.ok(revised.cinemaShots.some(c=>c.kind==='faceA'));
    if(row.skit_id==='SK07_last_food') assert.ok(revised.cinemaEffects.some(c=>c.sourceFx==='snow'));
  }
});

test('every numbered screening runs a timed sequence through the normal edit path',()=>{
  for(const [id,entry] of catalogScenes){
    const event={type:'catalog-scene',performanceKey:id,sceneId:id,participants:['a','b','c'].slice(0,entry.tracks.length)};
    const branchId=tables.defs.find(row=>row.scene_id===id)?.branch_id??'B1';
    const original=planScene({tables,seed:1,tick:1,sceneId:id,branchId,ids:{F:0,T:1,A:2}});
    const {cinemaShots:shots,total}=editScene(original,event);
    assert.ok(shots.length>=2,id+' needs a second camera setup');
    assert.equal(shots[0].at,0,id);
    shots.forEach((shot,i)=>assert.ok(shot.at<(shots[i+1]?.at??total),id+' cuts must be ordered'));
  }
});
