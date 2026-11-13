import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCustomActor,disposeCustomActor,faceSurfacePoint} from '../src/avatar-model.js';
import {ANIME_PRESETS} from '../src/avatar-anime.js';

const check=(raw,fn)=>{const actor=makeCustomActor({id:'neck-fit',appearance:raw});try{fn(actor);}finally{disposeCustomActor(actor);}};
test('large anime heads leave a short neck above the collar, with no detached neck',()=>{
 for(const faceShape of ['anime_pentagon','oval','long'])for(const bodyRatio of [.8,1,1.3])for(const headScale of [.8,1.16,1.25]){
  check({artStyle:'anime',faceShape,bodyRatio,headScale,faceHeight:1.2,chinLength:1.25},actor=>{
   const a=actor.appearance,chin=actor._head.position.y+faceSurfacePoint(a.faceShape,0,-1,0,a)[1]*actor._head.scale.y;
   assert.ok(chin>=1.48*a.bodyRatio-1e-8,'chin must not enter the crew neck');
   const neck=actor.mesh.getObjectByName('neck');neck.geometry.computeBoundingBox();
   assert.ok(neck.geometry.boundingBox.max.y>chin+.02*a.bodyRatio,'neck must overlap head, not float below it');
   const ring=actor.mesh.getObjectByName('anime-crew-collar');assert.ok(ring);
   assert.ok(Array.from(ring.geometry.attributes.position.array).every(Number.isFinite));
  });
 }
});
test('reference head shape and local feature positions are not distorted to expose the neck',()=>{
 const preset=ANIME_PRESETS.find(p=>p.name==='金环赤发').values;
 check(preset,actor=>{const a=actor.appearance;assert.deepEqual(actor._head.scale.toArray(),[a.headScale*a.faceWidth*.88,a.headScale*a.faceHeight*.88,a.headScale*.88]);assert.ok(actor._head.position.y>1.75&&actor._head.position.y<1.78);assert.equal(actor.appearance.eyeY,preset.eyeY);assert.equal(actor.appearance.chinLength,preset.chinLength);});
});
test('non-anime placement and non-tee collars preserve legacy behavior',()=>{
 for(const artStyle of ['drama','organic','satire'])check({artStyle,headScale:1.25,bodyRatio:.8},actor=>{assert.equal(actor._head.position.y,1.68*.8);assert.equal(actor.mesh.getObjectByName('anime-crew-collar'),undefined);});
 for(const outfit of ['uniform','robe','hoodie','jacket'])check({artStyle:'anime',outfit},actor=>assert.equal(actor.mesh.getObjectByName('anime-crew-collar'),undefined));
});

test('reviewed crew neck narrows skin and collar together without changing height',()=>{
 const preset=ANIME_PRESETS.find(p=>p.name==='金环赤发').values;
 check(preset,actor=>{
  const neck=actor.mesh.getObjectByName('neck'),ring=actor.mesh.getObjectByName('anime-crew-collar');
  neck.geometry.computeBoundingBox();ring.geometry.computeBoundingBox();
  const b=neck.geometry.boundingBox,c=ring.geometry.boundingBox;
  assert.ok(b.max.x>.067&&b.max.x<.070,'neck radial width must reflect the narrower authored section');
  assert.ok(c.max.x>.081&&c.max.x<.085,'collar follows the smaller neck, not the old wide ring');
  assert.ok(Math.abs(b.min.y-1.39*actor.appearance.bodyRatio)<1e-6,'keep vertical placement');
 });
});
