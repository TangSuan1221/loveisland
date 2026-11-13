import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createIsland } from '../src/island.js';

// The factory uses Canvas only to paint textures; geometry needs no DOM/WebGL.
const noop=()=>{};
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect:noop,beginPath:noop,moveTo:noop,lineTo:noop,fill:noop,createRadialGradient:()=>({addColorStop:noop})})})};
const scene=new THREE.Scene();const island=createIsland(scene);scene.updateMatrixWorld(true);
const meshes=[];island.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
const get=(hex)=>meshes.filter(o=>!Array.isArray(o.material)&&o.material.color?.getHexString()===hex);
function metrics(list){const bounds=new THREE.Box3();for(const o of list)bounds.union(new THREE.Box3().setFromObject(o));let area=0,triangles=0;const y=bounds.max.y;for(const o of list){const g=o.geometry,p=g.attributes.position,index=g.index;const n=index?index.count:p.count;for(let i=0;i<n;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(o.matrixWorld),b=new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(o.matrixWorld),c=new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(o.matrixWorld);if(Math.max(Math.abs(a.y-y),Math.abs(b.y-y),Math.abs(c.y-y))<1e-5){area+=Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))/2;triangles++;}}}return {flatTopArea:area,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};}
function original(radius,depth,y){const pts=[];for(let i=0;i<=80;i++){const a=i/80*Math.PI*2,r=radius*(1+.035*Math.sin(a*3+.6)+.023*Math.cos(a*5));pts.push(new THREE.Vector2(Math.cos(a)*r,Math.sin(a)*r*.87));}const s=new THREE.Shape();s.moveTo(pts[0].x,pts[0].y);s.splineThru(pts.slice(1));const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.15,bevelThickness:.12,curveSegments:64});const o=new THREE.Mesh(g);o.rotation.x=-Math.PI/2;o.position.y=y;o.updateMatrixWorld(true);return metrics([o]);}
const grass=meshes.filter(o=>o.material.map?.image?.width===1024);
const current={outerLand:metrics(get('e4c88e')),sand:metrics(get('f0dbac')),grass:metrics(grass)};
const baseline={outerLand:original(12.1,.24,.02),grass:original(10.5,.1,.30)};
const coastRadius=(a,radius)=>{const shore=radius<24?.082:.075;const bay=Math.exp(-Math.pow((a-.55)/.35,2))*.17+Math.exp(-Math.pow((a-3.45)/.28,2))*.12;return radius*(1+shore*Math.sin(a*3+.6)+.055*Math.cos(a*5)+.022*Math.sin(a*7)-bay);};
function coastClearance(x,z){const a=(Math.atan2(-z/.87,x)+Math.PI*2)%(Math.PI*2);return coastRadius(a,25.3)-Math.sqrt(x*x+(z/.87)**2);}
function outsideCoast(list){let count=0,total=0,minClearance=Infinity,maxY=-Infinity,outsideMaxY=-Infinity,outsideMinY=Infinity;for(const o of list){const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);const d=coastClearance(v.x,v.z);minClearance=Math.min(minClearance,d);maxY=Math.max(maxY,v.y);if(d<-.05){count++;outsideMaxY=Math.max(outsideMaxY,v.y);outsideMinY=Math.min(outsideMinY,v.y);}total++;}}return {outsideVertices:count,totalVertices:total,minRadialClearance:minClearance,maxY,outsideMinY:Number.isFinite(outsideMinY)?outsideMinY:null,outsideMaxY:Number.isFinite(outsideMaxY)?outsideMaxY:null};}
const result={sourceSHA256:createHash('sha256').update(readFileSync(new URL('../src/island.js',import.meta.url))).digest('hex'),method:'Actual flat top triangles in runtime geometry; baseline reproduces original 80-point spline and extrusion. Units: scene units and square scene units.',baseline,current,ratios:{outerLand:current.outerLand.flatTopArea/baseline.outerLand.flatTopArea,grass:current.grass.flatTopArea/baseline.grass.flatTopArea},declaredBounds:island.bounds,river:outsideCoast(get('8cbbb2')),hill:outsideCoast(get('8eaa79')),path:metrics(get('d2c39d')),renderObjects:meshes.length,staticBatches:meshes.filter(o=>o.name==='Batched island scenery').length,instancedObjects:meshes.filter(o=>o.isInstancedMesh).length};
console.log(JSON.stringify(result,null,2));
