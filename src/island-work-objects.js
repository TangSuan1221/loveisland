import {BoxGeometry,CylinderGeometry,Group,LatheGeometry,Mesh,MeshStandardMaterial,Vector2,Vector3} from 'three';

// Stage objects live in body space, independently of the wrist skeleton.
const displays=new WeakMap();
const box=new BoxGeometry(1,1,1),rod=new CylinderGeometry(.5,.5,1,12);
const bowl=new LatheGeometry([[0,0],[.68,0],[1,.49],[.94,.49],[.62,.06],[0,.06]].map(p=>new Vector2(...p)),24);
const materials=new Map();
function solid(parent,shape,color,size,at=[0,0,0]){
  if(!materials.has(color))materials.set(color,new MeshStandardMaterial({color}));
  const m=new Mesh(shape,materials.get(color));m.scale.fromArray(size);m.position.fromArray(at);parent.add(m);return m;
}
function build(id){
  const g=new Group();
  switch(id){
    case 199:solid(g,bowl,0x568d97,[.058,.19,.058]);break;
    case 200:for(const x of [-.009,.009])solid(g,rod,0xbd8a54,[.007,.19,.007],[x,-.065,0]);break;
    case 201:solid(g,rod,0x927254,[.026,.27,.026]);solid(g,box,0x68797a,[.09,.06,.046],[0,-.125,0]);break;
    case 203:for(let i=0;i<3;i++)solid(g,rod,0x97643e,[.072,.57-i*.045,.072],[0,i===2?.064:0,(i-1)*.045]).rotation.z=1.48;break;
    case 206:solid(g,bowl,0x54848f,[.25,.21,.18]);solid(g,rod,0x8ababe,[.45,.006,.32],[0,.086,0]);break;
    case 207:solid(g,box,0xa47c5a,[.75,.68,.24],[0,-.24,.12]);break;
  }
  return g;
}
export function clearWorkObjects(a){const state=displays.get(a);if(state?.current)state.current.visible=false;if(state?.stage)state.stage.visible=false;}
const left=new Vector3(),right=new Vector3();
export function showWorkObjects(a,id,t){
  clearWorkObjects(a);
  if(![199,200,201,203,205,206,207].includes(id))return;
  let state=displays.get(a);if(!state){state={models:new Map()};displays.set(a,state);}
  let g=state.models.get(id);if(!g){g=build(id);a._body.add(g);state.models.set(id,g);}
  state.current=g;g.visible=true;
  const j=a._rig.joints,R=a._rig.R;
  function grip(b,p){p.set(0,-.065*R,.02*R);a._body.worldToLocal(b.localToWorld(p));}
  grip(j.LeftHand,left);grip(j.RightHand,right);
  g.position.copy(right);g.rotation.set(0,0,0);
  if([199,200,205].includes(id)){
    if(!state.stages)state.stages=new Map();
    let stage=state.stages.get(id);
    if(!stage){
      stage=new Group();state.stages.set(id,stage);a._body.add(stage);
      if(id===199)solid(stage,box,0x9a7558,[.52,.033,.27]);
      if(id===205){solid(stage,box,0x705c4c,[.19,.025,.16]);for(const s of [-1,1])solid(stage,box,0xa18a70,[.016,.055,.16],[s*.09,.026,0]);}
      if(id===200){solid(stage,bowl,0x759ba2,[.095,.075,.09],[-.09,0,.22]);solid(stage,bowl,0xc6ae92,[.13,.045,.13],[-.22,0,.48]);solid(stage,box,0xb87645,[.045,.021,.034],[-.21,.023,.47]);}
    }
    stage.visible=true;state.stage=stage;
    if(id===199){stage.position.copy(a._workCupRest);stage.position.y-=.05*R+.017;}
    if(id===200)stage.position.y=.79*R;
    if(id===205)stage.position.set(-.17,.97*R,.44*R);
  }
  if(id===199){
    // Use the same contact point before grasp and after release, including on seeks.
    if(t<1.3||t>4.52)g.position.copy(a._workCupRest);
    g.position.y-=.05*R;
  }
  if(id===200){
    const morsel=state.stage.children[2];
    if(t<1.8)morsel.position.set(-.21,.023,.47);
    else if(t<2.19)morsel.position.copy(g.position).sub(state.stage.position).y-=.151;
    else morsel.position.set(-.09,.022,.22);
  }
  if(id===201){g.quaternion.copy(j.RightHand.getWorldQuaternion(g.quaternion)).premultiply(a._body.getWorldQuaternion(j.RightHand.quaternion.clone()).invert());}
  if(id===203||id===206){g.position.add(left).multiplyScalar(.5);g.rotation.y=j.Hips.rotation.y;if(id===206)g.position.y-=.086;if(id===203)g.visible=t>=.55&&t<4.57;}
  if(id===207){g.position.set(0,1.35*R,.415*R+.044);}
}
