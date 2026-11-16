import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createProduction} from '../src/production-engine.js';

test('营地建筑购买、放置、回仓与读档保持资产一致',()=>{
  const game=createProduction({spatial:true});
  game.dispatch('start',{mode:'tutorial'});
  for(const c of game.getState().candidates.slice(0,game.getState().castSize)){
    game.dispatch('toggleCast',{id:c.id});
  }
  assert.ok(game.dispatch('confirmCast').ok);
  const edit=payload=>game.dispatch('campEdit',payload);
  const place={op:'place',kind:'fire_pit',x:31,y:31};
  assert.ok(edit({op:'buy',kind:'fire_pit'}).ok);
  const before=game.serialize().camp;
  assert.equal(edit({...place,x:0,y:0}).ok,false);
  assert.deepEqual(game.serialize().camp,before);
  assert.ok(edit(place).ok);
  assert.ok(edit({op:'store',id:1}).ok);
  const restored=createProduction({spatial:true,saved:game.serialize()});
  assert.ok(restored.dispatch('campEdit',place).ok);
  const camp=restored.getState().camp;
  assert.equal(camp.wood,2);
  assert.equal(camp.inventory.fire_pit,0);
  assert.equal(camp.placed.length,1);
});
