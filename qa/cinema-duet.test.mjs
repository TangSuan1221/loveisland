import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {portraitActor,disposeActor} from '../src/characters.js';
import {createCinemaActing} from '../src/performance/cinema-acting.js';

const events=['mutual-feeling','feelings-declined','reconciled','unresolved','disagreed','connected','allied','alliance-declined','boundary-respected','boundary-disagreed','clarified','created-together','queue-apology','queue-yield','queue-argue','queue-avoid','water-shared','supported'];
const signature=actor=>{
  const values=[];
  actor.mesh.traverse(node=>values.push([node.name,...node.position.toArray(),...node.quaternion.toArray(),...node.scale.toArray(),node.visible]));
  return JSON.stringify(values,(_,value)=>typeof value==='number'?+value.toFixed(9):value);
};

test('each outcome stages both real avatars with distinct trajectories and restores their live transforms',()=>{
  const actors=['lin','zhou'].map(portrait=>portraitActor(portrait));
  actors[0].mesh.position.x=-.88;actors[1].mesh.position.x=.88;
  const originals=actors.map(signature);
  const acting=createCinemaActing(actors);
  const unique=new Set();
  for(const type of events){
    const reset=acting.begin({type,participants:actors.map(a=>a.id)});
    const samples=[];
    const path=[[],[]];
    for(const time of [0,1100,2550,3800,5200,6000]){
      const shot={kind:'pair',totalMs:6000};
      acting.frame(shot,time/6000,time);
      for(let role=0;role<2;role++){
        const actor=actors[role];
        path[role].push(actor.mesh.position.clone());
        const hand=actor._rig.joints.RightHand.getWorldPosition(new Vector3());
        samples.push([...actor.mesh.position.toArray(),...hand.toArray()].map(n=>n.toFixed(3)).join('/'));
      }
      const pose=actors.map(signature);
      acting.frame(shot,time/6000,time);
      assert.deepEqual(actors.map(signature),pose,type+' absolute sample');
    }
    for(const points of path) assert.ok(points.some(p=>p.distanceTo(points[0])>.02),type+' has actual stage travel');
    unique.add(samples.join(' '));
    reset();assert.deepEqual(actors.map(signature),originals,type+' restores full cast');
  }
  assert.equal(unique.size,events.length);
  actors.forEach(disposeActor);
});

test('case-authored action runs once over clean transforms, with transfer and interrupted replay cleanup',()=>{
  const actors=['lin','zhou'].map(id=>portraitActor(id));
  const originals=actors.map(signature);
  const acting=createCinemaActing(actors);
  const event={type:'water-shared',participants:actors.map(a=>a.id)};
  const reset=acting.begin(event);
  const shot={kind:'insert',cupRole:'T',action:([first,second],p)=>{
    first.mesh.position.x+=p;
    second._rig.joints.LeftForeArm.rotation.x+=p;
  }};
  acting.frame(shot,.37,3200);
  assert.equal(actors[0].mesh.position.x,.37);
  assert.equal(actors[0].mesh.getObjectByName('cinema-water-cup').visible,false);
  assert.equal(actors[1].mesh.getObjectByName('cinema-water-cup').visible,true);
  const pose=actors.map(signature);
  acting.frame(shot,.37,3200);
  assert.deepEqual(actors.map(signature),pose);
  const nextReset=acting.begin({...event,type:'connected'});
  reset();
  acting.frame({kind:'faceT',totalMs:6000},.5,2800);
  nextReset();
  assert.deepEqual(actors.map(signature),originals);
  actors.forEach(disposeActor);
});

test('a single camp guest reaches their mark; a loan changes the visible parcel owner across a cut',()=>{
  const actors=['lin','zhou'].map(id=>portraitActor(id));
  const original=actors.map(signature);
  const acting=createCinemaActing(actors);
  const resetSolo=acting.begin({type:'camp-story',participants:['lin']});
  acting.frame({kind:'location',action:([a],p)=>{a.mesh.position.z+=p;}},.8,1500);
  assert.equal(actors[0].mesh.position.z,.8);
  resetSolo();
  const resetLoan=acting.begin({type:'item-borrowed',participants:['lin','zhou']});
  for(const role of ['T','F']){
    acting.frame({kind:'insert',prop:{kind:'parcel',role}},.4,1200);
    actors.forEach((actor,i)=>assert.equal(actor.mesh.getObjectByName('cinema-prop:parcel').visible,i===(role==='T'?1:0)));
  }
  resetLoan();
  assert.deepEqual(actors.map(signature),original);
  actors.forEach(disposeActor);
});

test('story move/act cues drive root and limbs, and a solo routine reads the actual book',()=>{
  const actors=['lin','zhou'].map(id=>portraitActor(id));
  actors[1].mesh.position.x=2;
  const originals=actors.map(signature);
  const acting=createCinemaActing(actors);
  const reset=acting.begin({type:'S02_hidden_food',participants:['lin','zhou']});
  const cues=[{kind:'move',role:'T',t:0,dur:900,to:[0,0]},{kind:'act',role:'F',act:'hop',t:100,dur:600}];
  acting.frame({kind:'pair'},.4,400,cues);
  assert.ok(actors[0].mesh.position.y>.18,'hop lifts actual actor');
  assert.ok(actors[1].mesh.position.x>0 && actors[1].mesh.position.x<1.5,'mark traversed in local space');
  reset();
  const end=acting.begin({type:'routine',activity:'read',participants:['lin']});
  acting.frame({kind:'faceF',totalMs:6000},.5,3000);
  assert.equal(actors[0]._rig.joints.LeftHand.getObjectByName('cinema-prop:book').visible,true);
  assert.ok(Math.abs(actors[0]._rig.joints.LeftForeArm.rotation.x)>.5,'reader bends the elbow');
  end();
  assert.deepEqual(actors.map(signature),originals);
  actors.forEach(disposeActor);
});

test('smile changes real mouth corners while rejection presses lips, brows respond and shared meshes restore',()=>{
  const actors=['lin','zhou'].map(id=>portraitActor(id));
  const acting=createCinemaActing(actors),actor=actors[1];
  const lip=actor._mouth.children.find(n=>n.geometry);
  const brow=actor._head.children.find(n=>n.name==='brow');
  const original=lip.geometry,vertices=original.getAttribute('position'),reference=Array.from(vertices.array);
  let reset=acting.begin({type:'mutual-feeling',participants:['lin','zhou']});
  acting.frame({kind:'faceT',totalMs:6000},.8,3800);
  assert.notEqual(lip.geometry,original);
  const offset=Array.from({length:vertices.count},(_,i)=>lip.geometry.getAttribute('position').getY(i)-vertices.getY(i));
  assert.ok(Math.max(...offset)>.009 && Math.max(...offset)<.012,'visibly lifted lip corners within 12 millimetres');
  assert.ok(Math.min(...offset)<.00001,'mouth centre remains anchored');
  const warmBrow=brow.rotation.z;
  reset();
  assert.equal(lip.geometry,original); assert.deepEqual(Array.from(vertices.array),reference);
  const resting=actor._mouth.scale.y;
  reset=acting.begin({type:'feelings-declined',participants:['lin','zhou']});
  acting.frame({kind:'faceT',totalMs:6000},.8,3800);
  assert.ok(actor._mouth.scale.y<resting*.83);
  reset();
  reset=acting.begin({type:'queue-argue',participants:['lin','zhou']});
  acting.frame({kind:'faceT',totalMs:6000},.8,4210);
  assert.ok(Math.sign(warmBrow)!==Math.sign(brow.rotation.z));
  reset();actors.forEach(disposeActor);
});
