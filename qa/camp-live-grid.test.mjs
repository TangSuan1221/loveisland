import assert from 'node:assert/strict';
import test from 'node:test';
import {createProduction} from '../src/production-engine.js';
import {catalog,editCamp,makeGrid,newCamp,newIslandCamp,overlapsFacility} from '../src/camp/model.js';
import {pack,unpack} from '../src/camp/archive.js';
import {cellToWorld,createLiveGrid,placementBounds,worldToCell} from '../src/artStudy/liveGrid.js';
import {FACILITY_FOOTPRINTS,facilityRect,facilityPosition,landmarkAt} from '../src/camp/footprints.js';

function startIsland(){
  const game=createProduction({spatial:true,starterCamp:true});
  game.dispatch('start');
  for(const person of game.getState().candidates.slice(0,4))game.dispatch('toggleCast',{id:person.id});
  assert(game.dispatch('confirmCast').ok);
  return game;
}
test('all 24 camp structures and nine facilities rotate around their occupied cells',()=>{
  for(const d of catalog)for(let rot=0;rot<4;rot++){
    const r=placementBounds(d.id,22,31,rot);
    assert.equal(r.w,rot%2?d.h:d.w);assert.equal(r.h,rot%2?d.w:d.h);
    assert.equal(r.width,r.w*.75);assert.deepEqual({x:r.x,z:r.z},cellToWorld(22+(r.w-1)/2,31+(r.h-1)/2));
  }
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const p=cellToWorld(x,y);assert.deepEqual(worldToCell(p.x,p.z),{x,y});
  }
  for(const [id,[w,h]] of Object.entries(FACILITY_FOOTPRINTS))for(let rot=0;rot<4;rot++){
    const p=facilityPosition(id,1.19,2.38,rot),r=facilityRect({type:id,...p});
    assert.equal(r.w,rot%2?h:w);assert.equal(r.h,rot%2?w:h);
    assert.deepEqual(facilityPosition(id,p.x,p.z,rot),p);
  }
});
test('starter camp assets survive archive save/load, keep valid terrain and cannot mint sale proceeds',()=>{
  const initial=newIslandCamp(),grid=makeGrid({...newCamp(),mapVersion:initial.mapVersion},99);
  for(const b of initial.placed){
    assert(grid.canPlace(grid.kinds.get(b.kind),b.x,b.y,b.rot).ok);
    assert.equal(landmarkAt(b.x,b.y),false);
  }
  const pier=initial.placed.find(b=>b.kind==='pier');
  assert.equal(pier.rot,1);assert.equal(grid.terrainKey(pier.x+6,pier.y),'shallow');
  assert.deepEqual(unpack(pack(initial)).placed,initial.placed);
  const clinic=initial.placed[0],wood=initial.wood;
  assert(editCamp(initial,1,{op:'store',id:clinic.id}).ok);
  const stored=unpack(pack(initial));
  assert(editCamp(stored,1,{op:'place',kind:clinic.kind,x:clinic.x,y:clinic.y,rot:0}).ok);
  assert(editCamp(stored,1,{op:'dismantle',id:stored.placed.at(-1).id}).ok);
  assert.equal(stored.wood,wood);
  assert(editCamp(initial,1,{op:'sell',kind:clinic.kind}).ok);
  assert.equal(initial.wood,wood);
});
test('normal game actions preserve old saves, reject overlaps atomically and open recording',()=>{
  const game=startIsland(),live=createLiveGrid(game),initial=game.serialize();
  assert.equal(initial.camp.placed.length,5);
  const starter=initial.camp.placed.find(s=>s.kind==='clinic');
  assert.equal(live.at(starter.x+5,starter.y+4).kind,'clinic');
  const site=cellToWorld(starter.x,starter.y);
  assert.equal(game.previewFacility('camera',site.x,site.z).ok,false);
  assert.equal(game.dispatch('place',{type:'camera',...site}).ok,false);
  const clinic=initial.camp.placed[0],blocked={kind:'clinic',id:clinic.id,x:25,y:19,rot:0};
  assert.equal(live.preview(blocked).ok,false);assert.equal(live.place(blocked).ok,false);
  assert.deepEqual(game.serialize().camp,initial.camp);
  assert(game.dispatch('autoBuild').ok);assert.equal(game.getState().facilities.length,6);
  assert(game.dispatch('startRecording').ok);
  const restored=createProduction({spatial:true,saved:JSON.stringify(game.serialize()),starterCamp:true});
  assert.deepEqual(restored.getState().camp,game.getState().camp);
  const legacy={...initial,camp:newCamp()};
  assert.equal(createProduction({spatial:true,saved:legacy,starterCamp:true}).getState().camp.placed.length,0);
  const table={type:'table',...facilityPosition('table',0,0,1)};
  const r=facilityRect(table);
  assert(overlapsFacility({kind:'fire_pit',x:r.x+r.w-1,y:r.y+r.h-1,rot:0},table));
  assert(!overlapsFacility({kind:'fire_pit',x:r.x+r.w,y:r.y,rot:0},table));
});
test('map v2 keeps a curved protected creek, reachable resource sites and a true ocean pier',()=>{
  const camp=newIslandCamp(),grid=makeGrid(camp,99),legacy=makeGrid(newCamp(),1);
  assert(grid.sites.every(site=>grid.reachable(site.x,site.y)));
  for(const [x,y] of [[25,15],[20,21],[21,25],[17,29],[11,35]]){
    assert(grid.isRiver(x,y));
    assert.equal(grid.terrainKey(x,y),'shallow');
  }
  assert.equal(grid.isRiver(46,35),false);
  assert.equal(legacy.isRiver(46,35),true);
  assert.equal(legacy.terrainKey(46,35),'shallow');
  assert.equal(grid.kinds.get('clinic').w,6);
  assert.equal(legacy.kinds.get('clinic').w,3);
  const pier=camp.placed.find(b=>b.kind==='pier');
  const covered=grid.cellsOf(pier.x,pier.y,7,2);
  assert(covered.filter(c=>grid.terrainKey(c.x,c.y)==='shallow').length>=7);
  assert(covered.every(c=>grid.occ[c.y*64+c.x]===pier.id));
  assert.equal(overlapsFacility({kind:'clinic',x:35,y:29,rot:0},{type:'camera',...cellToWorld(40,33)},camp),true);
  assert.equal(overlapsFacility({kind:'clinic',x:35,y:29,rot:0},{type:'camera',...cellToWorld(40,33)},newCamp()),false);
  const target={x:24,y:16},unchanged=structuredClone(camp);
  assert.equal(editCamp(camp,99,{op:'fill',cells:[target]}).ok,false);
  assert.deepEqual(camp,unchanged);
  Object.assign(camp,{wood:99,inventory:{bridge:1},bought:{...camp.bought,bridge:1}});
  assert(editCamp(camp,99,{op:'place',kind:'bridge',x:24,y:15,rot:0}).ok);
  assert(makeGrid(camp,99).isWalkable(target.x,target.y));
  const restored=unpack(pack(camp)),rebuilt=makeGrid(restored,99);
  assert.equal(restored.mapVersion,2);assert.deepEqual(rebuilt.base,grid.base);
  assert.deepEqual(restored.tiles,{});assert(rebuilt.isWalkable(target.x,target.y));
});
test('existing island before map v2 preserves its straight channel and original footprint dimensions',()=>{
  const legacy={...newCamp(),islandArtGrid:true};
  legacy.placed=[{id:1,kind:'clinic',x:31,y:27,rot:0,homeOf:[],interior:'bare',hp:60,damaged:false}];
  legacy.nextId=2;legacy.bought.clinic=1;
  const game=startIsland(),saved={...game.serialize(),camp:legacy};
  const loaded=createProduction({spatial:true,saved,starterCamp:true});
  const grid=makeGrid(loaded.getState().camp,1),archive=unpack(pack(legacy));
  assert.equal(loaded.getState().camp.mapVersion,undefined);
  assert.equal(grid.kinds.get('clinic').w,3);assert.equal(grid.terrainKey(46,35),'shallow');
  assert.equal(grid.occ[27*64+34],0);assert.deepEqual(archive.placed,legacy.placed);
});
test('the field station and market carry their illustrated props inside their own real footprints',async()=>{
  const THREE=await import('three');
  const {createLiveBuilding}=await import('../src/artStudy/liveBuildings.js');
  const grid=makeGrid(newIslandCamp(),1);
  for(const [id,parts] of [['clinic',['flag','solar']],['shop',['solar-east']]]){
    const def=grid.kinds.get(id),w=def.w*.75,d=def.h*.75;
    const model=createLiveBuilding(THREE,id,w,d);
    model.updateMatrixWorld(true);
    for(const name of parts){
      const prop=model.getObjectByName(name);
      assert(prop,id+' should contain '+name);
      const box=new THREE.Box3().setFromObject(prop,true);
      assert(box.max.x-box.min.x>1,'prop is wide enough to read in the island camera');
    }
    for(let rot=0;rot<4;rot++){
      model.rotation.y=-rot*Math.PI/2;
      const {width,depth}=placementBounds(def,0,0,rot);
      const box=new THREE.Box3().setFromObject(model,true);
      assert(box.min.x>=-width/2&&box.max.x<=width/2);
      assert(box.min.z>=-depth/2&&box.max.z<=depth/2);
    }
  }
});
