import {propAt} from './catalog-props.js';
import * as THREE from 'three';

const sphere=new THREE.SphereGeometry(1,14,10);
const box=new THREE.BoxGeometry(1,1,1);
const cylinder=new THREE.CylinderGeometry(.5,.5,1,14);
const colors=new Map();
function part(parent,geometry,color,x,y,z,w,h,d){
  if(!colors.has(color))colors.set(color,new THREE.MeshStandardMaterial({color}));
  const mesh=new THREE.Mesh(geometry,colors.get(color));
  mesh.scale.set(w,h,d);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
const cupShape=new THREE.LatheGeometry([[.035,0],[.05,.115],[.045,.115],[.032,.012],[0,.012]].map(([x,y])=>new THREE.Vector2(x,y)),16);
const models={
  cup(g){part(g,cupShape,0x388eaa,0,0,0,1,1,1);},
  parcel(g){part(g,box,0xca824d,0,0,0,.14,.105,.08);},
  snack(g){part(g,sphere,0xd3a362,0,0,0,.075,.045,.065);},
  book(g){part(g,box,0x5d8a78,0,0,0,.3,.025,.18);part(g,box,0xfff1d8,0,.017,0,.28,.012,.16);},
  baby(g){part(g,sphere,0x94bcca,0,-.07,0,.105,.2,.1);part(g,sphere,0xe6b69a,0,.09,.02,.08,.087,.075);g.rotation.z=.85;},
  shovel(g){part(g,cylinder,0x875735,0,.04,0,.035,.72,.035);part(g,box,0x556873,0,-.34,0,.15,.18,.035);},
  timber(g){part(g,cylinder,0x9f744e,0,0,0,.12,.64,.12).rotation.z=1.3;},
  cloth(g){part(g,box,0x728dbb,0,-.09,0,.23,.27,.022);part(g,box,0xaac2dc,.015,-.08,.02,.17,.23,.017);},
  bucket(g){part(g,cylinder,0x6a8588,0,-.14,0,.21,.19,.21);part(g,cylinder,0x8dc6d2,0,-.047,0,.19,.006,.19);},
  medicine(g){part(g,box,0xf2e8cc,0,0,0,.105,.13,.05);part(g,box,0xb54d4d,0,0,.028,.06,.015,.004);part(g,box,0xb54d4d,0,0,.029,.015,.06,.004);},
  flower(g){part(g,cylinder,0x57895d,0,0,0,.013,.19,.013);part(g,sphere,0xf5cf89,0,.10,0,.05,.032,.05);},
  spoon(g){part(g,cylinder,0xa27a56,0,0,0,.018,.22,.018);part(g,sphere,0xba9169,0,-.12,0,.035,.05,.023);},
};

export const propNames={cup:'水杯',snack:'点心',book:'书',parcel:'包裹',baby:'襁褓',shovel:'铲子',timber:'木料',cloth:'布料',bucket:'水桶',medicine:'药盒',flower:'花',spoon:'勺子'};
const attachments=new WeakMap();
export function createPropModel(kind){
  if(!Object.hasOwn(models,kind))return null;
  const model=new THREE.Group();
  model.name='held-prop:'+kind;
  models[kind](model);
  return model;
}
export function equipProp(actor,kind){
  const current=attachments.get(actor.mesh);
  if(current?.kind===kind)return;
  if(current){current.mesh.removeFromParent();attachments.delete(actor.mesh);}
  const held=createPropModel(kind);
  if(!held)return;
  const hand=actor._rig?.limbs[1].hand || actor._arms[1];
  held.position.set(.006,actor._rig?-.078*actor._rig.R:-.35,.035);
  hand.add(held);attachments.set(actor.mesh,{kind,mesh:held});
}
const activities={drink:'cup',eat:'snack',read:'book'};
const practice={cook:'spoon',med:'medicine',build:'timber'};
export function updateHeldProp(actor,state,scene,show){
  let kind=null;
  const performer=show?.participants.indexOf(actor.id)??-1;
  const role=scene?.participants.indexOf(actor.id)??-1;
  if(performer>=0)kind=propAt(show.key,performer,show.equipment?.[performer],show.phase==='playing'?show.elapsed:0);
  else if(state&&!state.unavailable&&!state.moving){
    if(scene?.phase!=='approach'&&role>=0){
      if((scene.kind==='borrow'&&role===1)||(scene.kind==='return-item'&&role===0))kind='parcel';
    }else if(state.activity==='idle'&&state.actionResult){
      const {outcome,role:recipient}=state.actionResult;
      if((outcome==='item-borrowed'&&recipient===0)||(outcome==='item-returned'&&recipient===1))kind='parcel';
      if(outcome==='water-shared'&&recipient===1)kind='cup';
    }else if(state.activity==='practice')kind=practice[state.attributes?.task?.kind];
    else kind=activities[state.activity];
  }
  equipProp(actor,kind);
}
