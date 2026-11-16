import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3} from 'three';
import {portraitActor,disposeActor} from '../src/characters.js';
import {parseCsv,planScene} from '../src/performance/runtime.js';
import {editScene} from '../src/performance/cinema-edit.js';
import {createCinemaActing} from '../src/performance/cinema-acting.js';
import {stageCampActors} from '../src/performance/cases/camp.js';
import {extraTitles} from '../src/performance/cases/social-extra.js';

const tables=Object.fromEntries(Object.entries({defs:'def', beats:'beat', lines:'line', choices:'choice', shots:'shot'}).map(([key,name])=>
  [key,parseCsv(readFileSync(new URL('../src/performance/data/skit-'+name+'.csv',import.meta.url),'utf8'))]));
test('every authored outcome drives both actual rigs through its released edit and restores the stage',()=>{
  const native=tables.defs.filter(d=>d.skit_id.startsWith('IS_')||d.skit_id.startsWith('CAMP_'));
  const rows=native.concat(Object.keys(extraTitles).map(id=>({scene_id:id,branch_id:'result',skit_id:id})));
  assert.equal(rows.length,54);
  const actors=['lin','zhou'].map(id=>portraitActor(id));
  actors.forEach((a,i)=>{a.mesh.position.set(i?1:-1,.48,2);a.mesh.rotation.y=i?-Math.PI/2:Math.PI/2;});
  const acting=createCinemaActing(actors);
  const point=()=>new Vector3();
  for(const row of rows){
    const camp=row.skit_id.startsWith('CAMP_');
    const event={type:camp?'camp-story':row.scene_id,sceneId:row.scene_id,result:row.branch_id,text:'已经发生的结果',participants:actors.map(a=>a.id),x:0,z:2};
    const raw=planScene({tables,seed:1,tick:2,sceneId:row.scene_id,branchId:camp?row.branch_id:'result',ids:{F:0,T:1}});
    const plan=editScene(raw,event);
    const undoMark=stageCampActors(actors,event),undoPose=acting.begin(event);
    const samples=[[],[]];
    for(let step=0;step<33;step++){
      const t=(step+.1)*plan.total/33, index=plan.cinemaShots.findLastIndex(s=>s.at<=t);
      const shot=plan.cinemaShots[index],end=plan.cinemaShots[index+1]?.at??plan.total;
      acting.frame(shot,(t-shot.at)/(end-shot.at),t,plan.cues);
      for(let i=0;i<actors.length;i++){
        const a=actors[i], joints=a._rig.joints;
        // Local-to-chest distances distinguish limb articulation from rigid root travel.
        const inv=joints.Spine2;
        const hand=inv.worldToLocal(joints.RightHand.getWorldPosition(point()));
        const other=inv.worldToLocal(joints.LeftHand.getWorldPosition(point()));
        samples[i].push([...hand.toArray(),...other.toArray(),...a.mesh.position.toArray()]);
      }
    }
    for(const track of samples){
      assert.ok(track.flat().every(Number.isFinite),row.skit_id);
      const range=k=>Math.max(...track.map(v=>v[k]))-Math.min(...track.map(v=>v[k]));
      assert.ok(Math.max(...Array.from({length:6},(_,k)=>range(k)))>.012,row.skit_id+' moving arms');
    }
    undoPose();undoMark();
    assert.deepEqual(actors.map(a=>a.mesh.position.toArray()),[[-1,.48,2],[1,.48,2]],row.skit_id);
  }
  actors.forEach(disposeActor);
});
