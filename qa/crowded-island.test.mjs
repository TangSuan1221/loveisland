import test from 'node:test';
import assert from 'node:assert/strict';
import {createProduction} from '../src/production-engine.js';
import {createSimulation} from '../src/npc-simulation.js';
import {createNavigation} from '../src/production-navigation.js';
import {campNavigation} from '../src/camp/navigation.js';

test('crowded island facility entrances remain walkable over ten simulated minutes',()=>{
  const game=createProduction({spatial:true,starterCamp:true});
  game.dispatch('start');
  for(const p of game.getState().candidates.slice(0,4))game.dispatch('toggleCast',{id:p.id});
  game.dispatch('confirmCast');
  game.dispatch('autoBuild');
  const {camp,facilities}=game.getState();
  const nav=campNavigation(camp,createNavigation(facilities),facilities);
  const entrance=nav.servicePoint(facilities.find(f=>f.type==='fire'));
  const actors=['lin','zhou','qiao','lu'].map(id=>({id,name:id,anchor:[entrance.x,entrance.z]}));
  const sim=createSimulation({actors});
  sim.setLayout(facilities,nav);
  const moved=new Set();
  for(let tick=0;tick<6000;tick++){
    sim.update(.1);
    for(const {id} of actors){
      const a=sim.getActor(id);
      assert(nav.clear(a.x,a.z),id+' entered a blocked tile at tick '+tick);
      if(tick>3000 && a.moving && Math.hypot(a.x-entrance.x,a.z-entrance.z)>1)moved.add(id);
    }
  }
  assert.equal(moved.size,actors.length);
  assert(sim.getSnapshot().stats.completed>0);
});
