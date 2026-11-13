import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {APPEARANCE_OPTIONS,APPEARANCE_RANGES,DEFAULT_APPEARANCE,normalizeAppearance,appearanceForCandidate} from '../src/avatar-schema.js';
import {portraitActor,disposeActor} from '../src/characters.js';
import {CANDIDATES} from '../src/production-engine.js';
import {ART_PRESETS} from '../src/avatar-schema.js';
import {featureIcon} from '../src/avatar-feature-catalog.js';
import {detailPartIcon} from '../src/avatar-detail-catalog.js';
import {hairPartIcon} from '../src/avatar-hair-catalog.js';

// Independent acceptance targets. Compatibility controls are not new shapes.
const minimum={faceShape:16,hairFront:83,hairBack:111,browStyle:43,eyeStyle:76,noseStyle:32,mouthStyle:53,earStyle:5,glasses:58,eyeLashes:6,lowerLashes:2,upperEyeFold:3,lowerEyeFold:3,eyeHighlight:10,upperWrinkles:9,lowerWrinkles:15,stubbleStyle:15,mustacheStyle:16,beardStyle:14};
const geometryFields=['faceShape','hairStyle','hairFront','hairBack','browStyle','eyeStyle','noseStyle','mouthStyle','glasses','facialHair','earStyle','freckles','wrinkles','makeup','eyeLashes','lowerLashes','upperEyeFold','lowerEyeFold','eyeHighlight','upperWrinkles','lowerWrinkles','stubbleStyle','mustacheStyle','beardStyle'];
const options=key=>(APPEARANCE_OPTIONS[key]||[]).filter(x=>x.value!=='auto');
const quantize=n=>Math.round(n*1e6);
function inspect(actor){
 actor.mesh.updateMatrixWorld(true);
 const hash=createHash('sha256'),point=new THREE.Vector3();let meshCount=0;
 actor.mesh.traverseVisible(object=>{
  if(!object.isMesh||object.userData.isOutline)return;
  meshCount++;
  assert.ok(!object.material.isShaderMaterial,'must retain WebGPU-compatible materials');
  const positions=object.geometry.getAttribute('position');assert.ok(positions,'renderable mesh has positions');
  const transformed=[];
  for(let i=0;i<positions.count;i++){
   point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);
   assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z),'finite world geometry');
   transformed.push(quantize(point.x),quantize(point.y),quantize(point.z));
  }
  hash.update(JSON.stringify(transformed));
  hash.update(JSON.stringify(object.geometry.index?Array.from(object.geometry.index.array):null));
  for(const material of Array.isArray(object.material)?object.material:[object.material])hash.update(JSON.stringify({color:material.color?.getHexString(),opacity:material.opacity,transparent:material.transparent,side:material.side}));
 });
 assert.ok(meshCount>0);return hash.digest('hex');
}
function release(actor){
 const owned=Object.values(actor._resources).flatMap(set=>[...set]);
 const disposed=new Set();for(const resource of owned)resource.addEventListener('dispose',()=>disposed.add(resource));
 disposeActor(actor);
 for(const resource of owned)assert.ok(disposed.has(resource),'owned resource emitted dispose');
 for(const set of Object.values(actor._resources))assert.equal(set.size,0);
}
function make(appearance){return portraitActor('catalog-check',{appearance:normalizeAppearance(appearance)});}

test('catalog meets declared component targets without counting auto controls',()=>{
 for(const[key,count]of Object.entries(minimum))assert.ok(options(key).length>=count,`${key}: ${options(key).length} < ${count}`);
 for(const[key,list]of Object.entries(APPEARANCE_OPTIONS)){
  assert.equal(new Set(list.map(x=>x.value)).size,list.length,`${key}: duplicate stable IDs`);
  assert.ok(list.every(x=>x.label&&x.value),`${key}: missing labels`);
 }
});

for(const field of geometryFields)test(`${field}: each choice changes actual visible mesh/material data, remains finite and releases resources`,()=>{
 assert.ok(APPEARANCE_OPTIONS[field],`${field} catalog exists`);
 const seen=new Map();
 for(const {value}of options(field)){
  const actor=make({[field]:value});
  try{
   assert.equal(actor.appearance[field],value,`${field}:${value} survives normalization`);
   const signature=inspect(actor);
   assert.ok(!seen.has(signature),`${field}:${value} is an exact rendered-data alias of ${seen.get(signature)}`);
   seen.set(signature,value);
  }finally{release(actor);}
 }
});

test('new catalog values and boundary controls survive JSON roundtrip',()=>{
 const keys=Object.keys(APPEARANCE_OPTIONS);
 for(let i=0;i<111;i++){
  const input={...DEFAULT_APPEARANCE};
  for(const key of keys){const list=APPEARANCE_OPTIONS[key];input[key]=list[(i*7+keys.indexOf(key))%list.length].value;}
  for(const[key,[min,max]]of Object.entries(APPEARANCE_RANGES))input[key]=i%2?min:max;
  const normalized=normalizeAppearance(input);
  assert.deepEqual(normalizeAppearance(JSON.parse(JSON.stringify(normalized))),normalized);
 }
});

test('48 cross-category combinations across three styles and parameter extremes build finite models',()=>{
 for(let i=0;i<48;i++){
  const input={artStyle:['drama','organic','satire'][i%3]};
  for(const[key,list]of Object.entries(APPEARANCE_OPTIONS))if(key!=='artStyle')input[key]=list[(i*13+Object.keys(APPEARANCE_OPTIONS).indexOf(key)*7)%list.length].value;
  for(const key of ['faceWidth','faceHeight','jawWidth','chinLength','eyeSize','eyeRotation','noseSize','mouthRotation','earSize'])if(APPEARANCE_RANGES[key])input[key]=APPEARANCE_RANGES[key][i%2];
  const actor=make(input);try{inspect(actor);}finally{release(actor);}
 }
});

test('legacy cast hair identifiers and unknown-value fallback remain compatible',()=>{
 const hair={lin:'bob',zhou:'crop',qiao:'bun',lu:'side',tang:'braids',chen:'curls',yao:'ponytail',xu:'quiff',song:'afro',he:'long',ning:'pixie',bai:'twintop'};
 for(const candidate of CANDIDATES)assert.equal(appearanceForCandidate(candidate).hairStyle,hair[candidate.id]);
 for(const key of Object.keys(APPEARANCE_OPTIONS))assert.equal(normalizeAppearance({[key]:'__unknown__'})[key],normalizeAppearance({})[key]);
});

// These checks reject aliases and malformed models. They do not prove perceptual
// uniqueness, visual quality, absence of occlusion, or parity with a commercial game.
test('all original presets refer to valid IDs and generated thumbnails contain finite coordinates',()=>{
 for(const preset of ART_PRESETS)for(const [field,value]of Object.entries(preset.values))if(APPEARANCE_OPTIONS[field])assert.ok(APPEARANCE_OPTIONS[field].some(o=>o.value===value),`${preset.name}: ${field} ${value}`);
 for(const[field,list]of Object.entries(APPEARANCE_OPTIONS))for(const{value}of list){const svg=featureIcon(field,value)||detailPartIcon(field,value)||(['hairFront','hairBack'].includes(field)?hairPartIcon(field,value):'');if(svg)assert.doesNotMatch(svg,/NaN|undefined|Infinity|�/,`${field}:${value}`);}
});
test('new precision controls and lens mode affect rendered appearance',()=>{
 for(const [field,value,base]of [['browWidth',1.4,{}],['browHeight',1.6,{}],['glassesSize',1.2,{glasses:'glasses_wire'}],['glassesY',.03,{glasses:'glasses_wire'}],['glassesThickness',.5,{glasses:'glasses_wire'}],['glassesLens','opaque',{glasses:'glasses_wire'}],['moleX',-.13,{moleStyle:'round'}],['moleY',-.06,{moleStyle:'round'}],['moleSize',1.8,{moleStyle:'round'}]]){const before=make(base),after=make({...base,[field]:value});try{assert.notEqual(inspect(before),inspect(after),field);}finally{release(before);release(after);}}
});



