import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createIsland} from '../src/island.js';
import {createProductionEnvironment} from '../src/production-environment.js';
import {createProductionScene} from '../src/production-scene.js';
import {createCharacters} from '../src/characters.js';
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#c6d9e3');scene.fog=new THREE.Fog('#c6d9e3',65,130);scene.add(new THREE.HemisphereLight('#edf6ee','#98aeaa',1.8));const sun=new THREE.DirectionalLight('#fff3df',2.3);sun.position.set(-20,38,24);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30,far:100});sun.shadow.normalBias=.04;scene.add(sun);
const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,180);camera.position.set(24,22,31);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1,1);controls.enableDamping=true;
const island=createIsland(scene,{productionMode:true}),environment=createProductionEnvironment(scene,island),set=createProductionScene(scene,island),cast=createCharacters(scene);set.sync([['water',-6,-1],['table',6,2],['tent',-3,-7],['camera',2,-3],['fire',0,7],['interview',6,-6],['heater',-2,2],['privacy',8,8]].map(([type,x,z],i)=>({id:'preview-'+i,type,x,z,enabled:true})));
function change(map){environment.setMap(map);set.setMap?.(map);scene.background.set(map==='snow'?'#c6d9e3':map==='villa'?'#d4dfda':'#a8dad6');scene.fog.color.copy(scene.background);for(const b of document.querySelectorAll('button[data-map]'))b.setAttribute('aria-pressed',String(b.dataset.map===map));}
for(const b of document.querySelectorAll('button[data-map]'))b.onclick=()=>change(b.dataset.map);change('snow');
function view(mode){camera.position.set(...(mode==='near'?[15,18,27]:[24,22,31]));controls.target.set(0,1,1);controls.update();for(const b of document.querySelectorAll('button[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===mode));}
for(const b of document.querySelectorAll('button[data-view]'))b.onclick=()=>view(b.dataset.view);view('wide');let last=performance.now(),time=0;function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.1);last=now;time+=dt;if(environment.map==='island')island.update(time,dt);environment.update(dt);cast.update(time,dt);controls.update();renderer.render(scene,camera);}requestAnimationFrame(frame);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
