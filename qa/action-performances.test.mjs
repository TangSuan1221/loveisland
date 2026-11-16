import assert from 'node:assert/strict';
import {performances} from '../src/action-catalog.js';
import {knownPose} from '../src/action-pose.js';
import {createSimulation} from '../src/npc-simulation.js';
import {createCharacters} from '../src/characters.js';
import {Scene} from 'three';
import {createNavigation} from '../src/production-navigation.js';
const visuals=createCharacters(new Scene());
const actors=visuals.actors.slice(0,3).map((a,i)=>({id:a.id,name:a.name,anchor:[i*1.5,1]}));
assert.equal(performances.size,141);
for(const entry of performances.values()){
  assert.ok(entry.tracks.flat().every(knownPose),entry.id);
  const sim=createSimulation({actors,seed:52});
  sim.setLayout([],createNavigation([]));
  visuals.setSimulation(sim);
  assert.ok(sim.startPerformance(entry.id).ok,entry.id);
  let playing=false;
  for(let i=0;i<700&&sim.getPerformance();i++){
    sim.update(.1);
    if(sim.getPerformance()?.phase==='playing'){
      visuals.update(i/10,.1);
      playing=true;
      for(const actor of visuals.actors.slice(0,entry.tracks.length)){
        assert.equal(actor._rig.skeleton.bones.length,52);
        actor.mesh.updateMatrixWorld(true);
        for(const bone of actor._rig.skeleton.bones){
          assert.ok(bone.matrixWorld.elements.every(Number.isFinite),entry.id+' '+actor.id+' '+bone.name);
          assert.ok(Math.abs(1-bone.quaternion.lengthSq())<.001,entry.id+' '+bone.name+' rotation');
        }
      }
    }
  }
  assert.ok(playing,entry.id);
  assert.ok(sim.getEvents().some(e=>e.type==='staged-performance'&&e.sourcePart==='result'),entry.id);
}
const sim=createSimulation({actors});
sim.startPerformance('S28_three_way_tension');sim.endSegment();
assert.equal(sim.getPerformance(),undefined);
assert.ok(!sim.getEvents().some(e=>e.sourcePart==='result'));
console.log('140 island performances completed, all pose tracks sampled; interruption passed.');

