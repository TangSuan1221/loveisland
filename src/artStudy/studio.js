import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildTerrain } from './terrain.js';
import { buildCamp } from './camp.js';
import { buildFlora } from './flora.js';
import './studio.css';
import { addGrazers } from './fauna.js';
import { addHorizon } from './horizon.js';

document.title = '荒岛心跳 · 场景美术校准';
const mount = document.querySelector('#app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
mount.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x5ba9cf);
const alignHorizon = addHorizon(scene);
addGrazers(scene);
const camera = new THREE.OrthographicCamera(-24, 24, 14, -14, .1, 400);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * .44;
controls.minPolarAngle = .12;
controls.minZoom = .65;
controls.maxZoom = 4;
scene.add(new THREE.HemisphereLight(0xfff0d7, 0x9e94ad, 1.65));
const sun = new THREE.DirectionalLight(0xffedd5, 2.05);
sun.position.set(-16, 31, 18);
sun.castShadow = true;
Object.assign(sun.shadow.camera, {left:-28,right:28,top:28,bottom:-28,far:100});
sun.shadow.mapSize.set(2048,2048);
sun.shadow.normalBias = .025;
sun.shadow.bias = -.00025;
scene.add(sun);
const updates = [buildTerrain, buildCamp, buildFlora].map(build => build(THREE,scene)).filter(fn => typeof fn === 'function');
const shots = {
 vista: {name:'海平线', target:[0,3,0], offset:[7,5,34], width:42},
 island: {name:'全岛', target:[0,1.7,0], offset:[24,31,34], width:50},
 camp: {name:'营地', target:[0,1.4,1], offset:[11,10,21], width:23},
 flora: {name:'异星林地', target:[-5,3,-7], offset:[12,7,19], width:23}
};
let shot;
function resize(){
 const aspect = innerWidth / innerHeight;
 const width = Math.max(shot.width,shot.width * aspect / 1.91);
 Object.assign(camera,{left:-width/2,right:width/2,top:width/(2*aspect),bottom:-width/(2*aspect)});
 camera.updateProjectionMatrix();
 renderer.setSize(innerWidth,innerHeight);
}
function select(key){
 shot = shots[key] || shots.island;
 controls.target.fromArray(shot.target);
 camera.position.fromArray(shot.offset).multiplyScalar(3).add(controls.target);
 camera.zoom=1;
 controls.update();
 resize();
 document.querySelectorAll('[data-shot]').forEach(b=>b.setAttribute('aria-pressed',String(shots[b.dataset.shot]===shot)));
}
const query = new URLSearchParams(location.search);
if(!query.has('clean')){
 const bar = document.createElement('nav');
 bar.setAttribute('aria-label','场景校准机位');
 for(const [key,view] of Object.entries(shots)){
  const button = document.createElement('button');
  button.textContent = view.name;
  button.dataset.shot = key;
  button.onclick = () => select(key);
  bar.append(button);
 }
 mount.append(bar);
}
select(query.get('shot'));
addEventListener('resize',resize);
renderer.setAnimationLoop(ms=>{
 controls.update();
 for(const update of updates) update(query.has('clean') ? 0 : ms*.001);
 alignHorizon(camera,controls.target);
 renderer.render(scene,camera);
});






