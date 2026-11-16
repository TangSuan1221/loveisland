import * as THREE from 'three';
import {interiors} from './works.js';
import {catalog,catalogFor,makeGrid,newCamp} from './model.js';

const kinds=new Map(catalog.map(d=>[d.id,d]));
const services={fire_pit:'heater',bonfire:'fire',tent:'tent',hut:'cabin',house:'cabin',longhouse:'cabin',well:'water',kitchen:'table',shop:'table',bench:'privacy',plaza:'privacy',clinic:'cabin'};
export function campFacility(st,camp){
  const def=camp?catalogFor(camp).find(d=>d.id===st.kind):kinds.get(st.kind),swap=st.rot%2;
  return {id:'camp-'+st.id,name:def.name,type:services[st.kind],enabled:!st.damaged,bedResidents:def.beds?(st.homeOf||[]):undefined,beauty:interiors[st.interior]?.[2]||0,
    x:(st.x-32+((swap?def.h:def.w)-1)/2)*.75,z:(st.y-32+((swap?def.w:def.h)-1)/2)*.75};
}
export function createCampScene(scene){
  const root=new THREE.Group(),land=new THREE.Group();scene.add(root,land);
  const initial=makeGrid(newCamp(),1),chunks=new Map(),landMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98});
  const palette=[0x527e92,0x83b8b8,0xdcc998,0x94ac78,0x628461,0x989a8e,0xaf987e,0x716e67],roads=[0,0xa68962,0x9b9d96,0x956e4d];
  const cube=new THREE.BoxGeometry(),cylinder=new THREE.CylinderGeometry(.5,.5,1,10),cone=new THREE.ConeGeometry(.65,1,4),materials=new Map();
  let last='';
  function draw(st,camp){
    const def=catalogFor(camp).find(d=>d.id===st.kind),w=def.w*.7,h=def.h*.7,group=new THREE.Group(),f=campFacility(st,camp);
    root.add(group);group.position.set(f.x,.5,f.z);group.rotation.y=-st.rot*Math.PI/2;
    function part(geo,color,x,y,z,a,b,c){
      if(st.damaged)color=0x72665c;
      if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.9}));
      const m=new THREE.Mesh(geo,materials.get(color));m.position.set(x,y,z);m.scale.set(a,b,c);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;
    }
    const wood=0x916445,stone=0x9caaa2,roof=st.interior&&st.interior!=='bare'?0x667f81:0xa95841;
    const box=(color,x,y,z,a,b,c)=>part(cube,color,x,y,z,a,b,c);
    const round=(color,x,y,z,a,b,c)=>part(cylinder,color,x,y,z,a,b,c);
    const top=(color,y,a,b,c)=>part(cone,color,0,y,0,a,b,c);
    if(['fire_pit','bonfire'].includes(st.kind)){
      for(let i=0;i<8;i++)round(stone,Math.sin(i*.785)*w*.38,.1,Math.cos(i*.785)*h*.38,.18,.2,.18);
      top(0xff812e,.35,w*.65,.65,h*.65);top(0xffc454,.25,w*.43,.52,h*.43);
    }else if(['bridge','pier','gate','fence','bench','drying_rack'].includes(st.kind)){
      for(const x of [-.38,.38])for(const z of [-.38,.38])box(wood,x*w,.32,z*h,.1,.64,.1);
      const deck=['bridge','pier'].includes(st.kind);
      if(deck){for(let i=0;i<8;i++)box(wood,0,.26,(i-3.5)*h/8,w,.1,h/9);}
      else box(wood,0,st.kind==='bench'?.33:.6,0,w,.14,st.kind==='bench'?h:.14);
    }else if(['well','plaza','farm','woodpile'].includes(st.kind)){
      if(st.kind==='farm'){box(wood,0,.05,0,w,.1,h);for(let i=0;i<5;i++)box(0x577c47,0,.16,(i-2)*h/5,w*.85,.2,.12);}
      else if(st.kind==='woodpile'){for(let i=0;i<3;i++)box(wood,0,.11+i*.13,0,w*(1-i*.16),.14,h);}
      else{round(stone,0,.23,0,w,.46,h);round(0x629faf,0,.47,0,w*.79,.03,h*.79);if(st.kind==='plaza')round(stone,0,.75,0,.3,.65,.3);}
    }else if(['lantern','sign','watchtower','lighthouse'].includes(st.kind)){
      const tall=def.cat==='landmark'?2.8:1.05;
      round(st.kind==='lighthouse'?0xe7e1cf:wood,0,tall/2,0,w*.4,tall,h*.4);
      box(st.kind==='sign'?wood:0xffce78,0,tall,0,w*.7,.35,h*.55);
      if(st.kind!=='sign')top(roof,tall+.36,w,.45,h);
    }else{
      if(st.kind!=='tent')box(st.kind==='house'||st.kind==='clinic'?stone:wood,0,.45,0,w,.9,h);
      const hat=top(st.kind==='tent'?0xd3b68a:roof,st.kind==='tent'?.55:1.2,w*1.45,st.kind==='tent'?1.1:.68,h*1.45);hat.rotation.y=Math.PI/4;
      box(0x483d35,0,.29,h*.49,.32,.58,.05);
      if(st.kind==='clinic'){box(0xf4f2e6,0,.8,h*.51,.47,.3,.05);box(0xa6403a,0,.8,h*.55,.08,.24,.03);box(0xa6403a,0,.8,h*.56,.22,.07,.03);}
    }
  }
  const pending=new Map(),rising=new Map();
  let stage=0;
  const river=[];for(let i=0;i<4096;i++)if(i%64===46&&initial.base[i]===1)river.push([i,[1,0,0]]);
  function terrain(camp,active){
    const groups=new Map();
    for(const [key,tile] of (active?[...river,...Object.entries(camp?.tiles||{})]:[])){
      const i=Number(key),x=i%64,y=i>>6,chunk=(x>>3)+8*(y>>3);
      if(!groups.has(chunk))groups.set(chunk,[]);groups.get(chunk).push([i,...tile]);
    }
    for(const k of new Set([...chunks.keys(),...pending.keys(),...groups.keys()])){
      const rows=groups.get(k)||[],signature=JSON.stringify(rows),prev=chunks.get(k);
      if(prev?.signature===signature){pending.delete(k);continue;}
      pending.set(k,{rows,signature,animate:(camp?.stage||0)>stage});
    }
    stage=camp?.stage||0;
  }
  function update(dt){
    for(const [mesh,time] of rising){const next=Math.min(.6,time+dt);mesh.position.y=-.48*(1-next/.6);if(next===.6)rising.delete(mesh);else rising.set(mesh,next);}
    let remaining=4;for(const [k,{rows,signature,animate}] of pending){
      if(!remaining--)break;pending.delete(k);const prev=chunks.get(k);
      if(prev){rising.delete(prev.mesh);land.remove(prev.mesh);prev.mesh.geometry.dispose();chunks.delete(k);}
      if(!rows.length)continue;
      const positions=[],colors=[];
      for(const [i,base,skin,road] of rows){
        if(base===initial.base[i]&&!skin&&!road&&i%64!==46)continue;
        const x=(i%64-32)*.75,z=((i>>6)-32)*.75,color=new THREE.Color(roads[road]||palette[base]);if(skin)color.multiplyScalar(.8);
        for(const [a,b] of [[-1,-1],[-1,1],[1,1],[-1,-1],[1,1],[1,-1]]){positions.push(x+a*.375,.553,z+b*.375);colors.push(color.r,color.g,color.b);}
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,landMaterial);mesh.receiveShadow=true;if(animate){rising.set(mesh,0);mesh.position.y=-.48;}land.add(mesh);chunks.set(k,{mesh,signature});
    }
  }
  function instanceBuildings(){
    const batches=new Map();root.updateMatrixWorld(true);
    root.traverse(m=>{if(m.isMesh){const key=m.geometry.uuid+m.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(m);}});
    root.clear();
    for(const items of batches.values()){
      const mesh=new THREE.InstancedMesh(items[0].geometry,items[0].material,items.length);
      items.forEach((m,i)=>mesh.setMatrixAt(i,m.matrixWorld));mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    }
  }
  return {update,sync(camp,active){
    terrain(camp,active);
    const key=active?JSON.stringify([camp?.mapVersion,camp?.placed||[]]):'';
    if(last===key)return;last=key;for(const m of root.children)m.dispose?.();root.clear();if(active){for(const st of camp?.placed||[])draw(st,camp);instanceBuildings();}
  }};
}

