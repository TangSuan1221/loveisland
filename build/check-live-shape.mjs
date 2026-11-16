import fs from 'node:fs';
import * as T from 'three';
import {makeCustomActor} from '../src/avatar-model.js';
import {appearanceForCandidate} from '../src/avatar-schema.js';
const actor=makeCustomActor({id:'lin',appearance:appearanceForCandidate({id:'lin'})}),root=actor.mesh;
root.updateMatrixWorld(true);
const parts=[],bounds=new Map(),v=new T.Vector3(),j=actor._rig.joints;
let max=0,zero=0,bad=0,count=0;
root.traverseVisible(o=>{
 if(!o.isMesh||o.userData.isOutline)return;
 const p=o.geometry.attributes.position, w=o.geometry.attributes.skinWeight;
 const box=new T.Box3(),vs=[];
 for(let i=0;i<p.count;i++){
 o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);box.expandByPoint(v);vs.push([v.x,-v.z,v.y]);
 if(w){let weights=[w.getX(i),w.getY(i),w.getZ(i),w.getW(i)];count++;let n=weights.filter(x=>x>0).length;max=Math.max(max,n);if(!n)zero++;if(Math.abs(weights.reduce((a,b)=>a+b)-1)>.001)bad++;}
 }
 bounds.set(o,box);parts.push({name:o.name||'part',v:vs,i:o.geometry.index?Array.from(o.geometry.index.array):Array.from({length:p.count},(_,i)=>i),c:o.material.color?.toArray()||[1,1,1]});
});
const obj=n=>root.getObjectByName(n),size=o=>bounds.get(o).getSize(new T.Vector3()),pos=n=>j[n].getWorldPosition(new T.Vector3());
const head=obj('face-skin'),headSize=size(head),hh=headSize.y,hw=headSize.x;
const sole=[...bounds.keys()].find(o=>o.isSkinnedMesh&&o.geometry.type==='SphereGeometry'&&o.parent.name==='leg');
const H=bounds.get(head).max.y-bounds.get(sole).min.y,torso=obj('tailored-torso'),p=torso.geometry.attributes.position;
const ring=(row,axis)=>{let a=[];for(let i=row*21;i<row*21+21;i++){torso.getVertexPosition(i,v).applyMatrix4(torso.matrixWorld);a.push(v[axis]);}return Math.max(...a)-Math.min(...a)};
const ratios=[hh/H,ring(3,'x')/hw,headSize.z/hw,ring(2,'z')/ring(2,'x'),ring(1,'x')/ring(2,'x'),ring(0,'x')/ring(2,'x'),(pos('LeftArm').distanceTo(pos('LeftForeArm'))+pos('LeftForeArm').distanceTo(pos('LeftHand')))/H,(pos('LeftUpLeg').y-pos('LeftFoot').y)/H,size(obj('rounded-hand')).y/hh,size(sole).z/hh];
const joints=Object.values(j).map(b=>({name:b.name,parent:b.parent.name,offset:b.position.length()}));
console.log(JSON.stringify({heads:H/hh,ratios},null,2));
