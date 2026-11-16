import assert from 'node:assert/strict';
import {portraitActor,disposeActor} from '../src/characters.js';
import {equipProp,updateHeldProp,propNames} from '../src/action-props.js';
import {performTrack} from '../src/action-playback.js';
import {performances} from '../src/action-catalog.js';
import {cloneActorView} from '../src/clone-actor-view.js';

const actor=portraitActor('lin');
const hand=actor._rig.limbs[1].hand;
const held=()=>hand.children.filter(child=>child.name.startsWith('held-prop:'));
for(const entry of performances.values()){
  for(const track of entry.tracks){
    for(const time of [.5,2.5,4.5])performTrack(actor,track,time,6);
    assert.equal(held().length,0,entry.id);
  }
}
for(const kind of Object.keys(propNames)){
  equipProp(actor,kind);
  const [item]=held();
  assert.equal(item.name,'held-prop:'+kind);
  for(const pose of ['drink','read','eat','carry','idle']){
    performTrack(actor,[pose],1,1);
    assert.deepEqual(held(),[item]);
  }
}
updateHeldProp(actor,{activity:'drink'},null,{participants:[actor.id],equipment:['flower']});
assert.equal(held()[0].name,'held-prop:flower');
updateHeldProp(actor,{activity:'drink'},null,null);
assert.equal(held()[0].name,'held-prop:cup');
updateHeldProp(actor,{activity:'idle'},null,null);
assert.equal(held().length,0);
const emptyView=cloneActorView(actor.mesh,{watchAttachments:true});
equipProp(actor,'cup');
assert.equal(emptyView.attachmentsChanged,true);
emptyView.dispose();
const equippedView=cloneActorView(actor.mesh,{watchAttachments:true});
assert.ok(equippedView.copy.getObjectByName('held-prop:cup'));
updateHeldProp(actor,{activity:'idle'},null,null);
assert.equal(equippedView.attachmentsChanged,true);
equippedView.dispose();
disposeActor(actor);
console.log('PASS: empty-handed playback across 140 performances, 12 interchangeable props, independent stage and gameplay equipment.');
