import assert from 'node:assert/strict';
import * as THREE from 'three';
import {faceSurfacePoint,createFacePaintGeometry} from '../src/avatar-model.js';
import {normalizeAppearance,APPEARANCE_OPTIONS} from '../src/avatar-schema.js';
import {portraitActor,disposeActor} from '../src/characters.js';
for(const {value:faceShape} of APPEARANCE_OPTIONS.faceShape)for(const artStyle of ['drama','organic','satire']){
 const a=normalizeAppearance({faceShape,artStyle}),b=normalizeAppearance({...a,muzzleDepth:.1,muzzleWidth:1.3});
 for(let y=-.95;y<1;y+=.1)for(let x=-.9;x<1;x+=.1){
  const z=Math.sqrt(Math.max(0,1-x*x-y*y));
  const p=faceSurfacePoint(faceShape,x,y,z,a),q=faceSurfacePoint(faceShape,x,y,z,b);
  assert.deepEqual(p,faceSurfacePoint(faceShape,x,y,z,{...a,muzzleDepth:0,muzzleWidth:.7}),'zero depth exactly retains skin');
  assert.deepEqual(p.slice(0,2),q.slice(0,2),'head width and height must not change');
  assert.ok(q.every(Number.isFinite)&&q[2]>=p[2]&&q[2]-p[2]<=.100001);
  assert.deepEqual(faceSurfacePoint(faceShape,x,y,-z,a),faceSurfacePoint(faceShape,x,y,-z,b),'rear skull unaffected');
  if(y>=0)assert.deepEqual(p,q,'upper face unaffected');
 }
 const oldPaint=createFacePaintGeometry(a),newPaint=createFacePaintGeometry(b),oldP=oldPaint.attributes.position,newP=newPaint.attributes.position;
 for(let i=0;i<oldP.count;i++){assert.equal(oldP.getX(i),newP.getX(i));assert.equal(oldP.getY(i),newP.getY(i));assert.ok(newP.getZ(i)>=oldP.getZ(i)-1e-7);}
 oldPaint.dispose();newPaint.dispose();
}
for(const mouthStyle of ['smile','grin','mouth_smirk_normal']){
 const appearance={artStyle:'satire',hairStyle:'bald',mouthStyle,muzzleDepth:.07,muzzleWidth:1,muzzleTint:true,muzzleColor:'#b49a70'};
 const actor=portraitActor('muzzle-test',{appearance});actor.mesh.updateMatrixWorld(true);
 const skin=actor.mesh.getObjectByName('face-skin'),mouth=actor.mesh.getObjectByName('mouth'),tint=actor.mesh.getObjectByName('muzzle-tint');
 assert.ok(tint,'tint available independently');assert.ok(mouth.position.z>.24,'mouth attaches to protruding oral surface');
 // Ray-test the actual rendered mouth vertices against the actual skin mesh.
 const ray=new THREE.Raycaster(),v=new THREE.Vector3();let checked=0;
 mouth.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/40))){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);ray.set(new THREE.Vector3(v.x,v.y,v.z+1),new THREE.Vector3(0,0,-1));const hit=ray.intersectObject(skin,false)[0];assert.ok(hit);const lift=v.z-hit.point.z;assert.ok(lift>-.002&&lift<.025,`${mouthStyle}: projected mouth lift ${lift}`);checked++;}});
 assert.ok(checked>10);const encoded=JSON.parse(JSON.stringify(actor.appearance));assert.deepEqual(normalizeAppearance(encoded),actor.appearance);disposeActor(actor);
}
const defaultActor=portraitActor('default-muzzle',{appearance:{}});assert.equal(defaultActor.appearance.muzzleDepth,0);assert.equal(defaultActor.mesh.getObjectByName('muzzle-tint'),undefined);disposeActor(defaultActor);
for(const faceShape of ['long','heart','square','diamond'])for(const muzzleWidth of [.7,1.3]){
 const actor=portraitActor('tint-surface',{appearance:{faceShape,muzzleWidth,muzzleDepth:.1,muzzleTint:true,chinLength:1.25,jawWidth:.7}});actor.mesh.updateMatrixWorld(true);
 const skin=actor.mesh.getObjectByName('face-skin'),tint=actor.mesh.getObjectByName('muzzle-tint'),p=tint.geometry.attributes.position,index=tint.geometry.index,ray=new THREE.Raycaster();let count=0;
 for(let i=64*6;i<index.count;i+=39){const v=new THREE.Vector3();for(let j=0;j<3;j++)v.add(new THREE.Vector3().fromBufferAttribute(p,index.getX(i+j)));v.multiplyScalar(1/3).applyMatrix4(tint.matrixWorld);ray.set(v.clone().add(new THREE.Vector3(0,0,1)),new THREE.Vector3(0,0,-1));const hit=ray.intersectObject(skin,false)[0];assert.ok(hit,'tint must remain within actual skin silhouette');assert.ok(v.z-hit.point.z>.0003&&v.z-hit.point.z<.007,'triangle interior must stay visibly on the skin');count++;}
 assert.ok(count>100);disposeActor(actor);
}
for(const noseStyle of ['nose_capsule','nose_ball'])for(const noseSize of [.35,1.8]){
 const actor=portraitActor('rounded-nose',{appearance:{noseStyle,noseSize,muzzleDepth:.07}}),nose=actor.mesh.getObjectByName('rounded-nose');assert.ok(nose);assert.ok(nose.position.toArray().every(Number.isFinite));assert.ok(nose.scale.z>0);assert.ok(actor.mesh.getObjectByName('nose').children.every(o=>o===nose),'rounded nose must not include old triangular bridge');disposeActor(actor);
}
// Actual failure combination from the Homer benchmark: legacy stubble used to
// cover the lower tint with a solid beard wash, even though skin-clearance passed.
{
 const actor=portraitActor('muzzle-stubble',{appearance:{artStyle:'satire',faceShape:'round',jawWidth:1.12,chinLength:.9,faceWidth:1.1,bodyRatio:.88,facialHair:'stubble',facialHairColor:'#a08155',muzzleDepth:.07,muzzleWidth:1,muzzleTint:true,muzzleColor:'#c3a075',noseStyle:'nose_capsule',mouthStyle:'mouth_grit_wide',mouthSize:1.15,hairStyle:'bald',hairFront:'none',hairBack:'none'}});actor.mesh.updateMatrixWorld(true);
 for(const x of [-.045,.045]){
  const point=actor._head.localToWorld(new THREE.Vector3(x,-.177,1)),ray=new THREE.Raycaster(point,new THREE.Vector3(0,0,-1));
  const hit=ray.intersectObject(actor._head,true)[0];assert.equal(hit?.object.name,'muzzle-tint','legacy stubble must not obscure coloured muzzle');
 }
 disposeActor(actor);
}
console.log('Muzzle: 16 shapes × 3 styles bounded local relief, unchanged XY/back/upper face, zero-depth compatibility, paint projection, real-mouth attachment and roundtrip pass.');
{
 const skinColor='#e5bb94',topColor='#416da2',blush=.7;
 const actor=portraitActor('computed-colours',{appearance:{skinColor,topColor,blush,noseStyle:'small'}});
 const expected=[new THREE.Color(topColor).multiplyScalar(.64),new THREE.Color(skinColor).multiplyScalar(.54),new THREE.Color(skinColor).lerp(new THREE.Color('#c47d76'),blush*.45)];
 const colours=new Set([...actor._resources.material].filter(m=>m.color).map(m=>m.color.getHexString()));
 for(const colour of expected)assert.ok(colours.has(colour.getHexString()),`distinct computed colour ${colour.getHexString()} must survive material caching`);
 assert.equal(new Set(expected.map(c=>c.getHexString())).size,3);disposeActor(actor);
}
