import {campfireEffectName} from './campfire.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCamp } from './camp.js';

const libraries = new WeakMap();
const wood = '#a07958', oak = '#765b4f', sunwood = '#c39869';
const slate = '#596170', iron = '#58646b', stone = '#a39e97', paper = '#e2d9bf';
const panels = ['#a37e60', '#ac8665', '#98745a', '#b08b6c'];

function makeLibrary(T) {
  const study = new T.Group();
  buildCamp(T, study, {separateParts:true});
  return {study:study.children[0], templates:new Map()};
}

// Produce one coloured mesh and one set of ink strokes per hand-built asset.
function workshop(T) {
  const parts=[], strokes=[];
  const temp=new T.Object3D();
  const vector=a=>new T.Vector3(...a);
  function part(geometry,xyz,color,rotation,draw=true) {
    temp.position.fromArray(xyz);
    temp.quaternion.identity();
    if (rotation?.isQuaternion) temp.quaternion.copy(rotation);
    else if(rotation) temp.rotation.set(...rotation);
    temp.updateMatrix();
    geometry.applyMatrix4(temp.matrix);
    if(draw) {
      const edges=new T.EdgesGeometry(geometry,42);
      strokes.push(...edges.attributes.position.array);
      edges.dispose();
    }
    const g=geometry.index?geometry.toNonIndexed():geometry;
    if(g!==geometry)geometry.dispose();
    g.deleteAttribute('uv');
    const pigment=new T.Color(color), rgb=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<rgb.length;i+=3)pigment.toArray(rgb,i);
    g.setAttribute('color',new T.BufferAttribute(rgb,3));
    parts.push(g);
  }
  const box=(x,y,z,w,h,d,c,r)=>part(new T.BoxGeometry(w,h,d),[x,y,z],c,r);
  function beam(a,b,r,c,rTop=r,segments=8) {
    const d=vector(b).sub(vector(a));
    part(new T.CylinderGeometry(rTop,r,d.length(),segments),vector(a).lerp(vector(b),.5).toArray(),c,new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));
  }
  const disk=(x,y,z,r,rt,h,c,n=12)=>beam([x,y,z],[x,y+h,z],r,c,rt,n);
  function face(points,c) {
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));
    const indices=[];
    for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1);
    g.setIndex(indices);g.computeVertexNormals();
    part(g,[0,0,0],c);
  }
  function roof(y,rise,w,d,c) {
    for(const sign of [-1,1])face([[0,y+rise,-d],[sign*w,y,-d],[sign*w,y,d],[0,y+rise,d]],c);
    beam([0,y+rise,-d],[0,y+rise,d],.035,oak);
  }
  function frame(x,y,z,w,h,d,c=wood) {
    for(const dx of [-1,1])for(const dz of [-1,1])beam([x+dx*w,y,z+dz*d],[x+dx*w,y+h,z+dz*d],.052,c);
  }
  function boards(x,y,z,w,d,n,c=panels) {
    for(let i=0;i<n;i++)box(x,y,z+d*((i+.5)/n-.5),w,.10,d/n*.96,c[i%c.length]);
  }
  function window(x,y,z) {
    box(x,y,z,.39,.35,.06,oak);box(x,y,z+.036,.31,.27,.025,'#5e8491');
    box(x,y,z+.052,.026,.28,.018,paper);
  }
  function housing(kind) {
    const long=kind==='longhouse',stoneHouse=kind==='house',warehouse=kind==='storage';
    const w=long?1.65:1,d=.84,h=warehouse?1.12:.98;
    box(0,.10,0,w*1.97,.20,d*1.96,slate);
    if(stoneHouse){
      box(0,.65,0,w*1.8,.95,d*1.8,'#8c9091');
      for(let row=0;row<4;row++)for(let i=0;i<6;i++){
        const x=(i-2.5)*.31+(row%2)*.06;
        box(x,.29+row*.235,d*.925,.29,.20,.07,['#afa99f','#bbb4a8','#9fa2a1'][(row+i)%3]);
      }
      disk(.62,1.04,-.42,.16,.16,.88,stone,6);
    } else {
      for(let i=0;i<7;i++)box(0,.20+(i+.5)*h/7,0,w*1.87,h/7*.96,d*1.85,panels[i%4]);
      frame(0,.12,0,w*.93,h+.1,d*.93,oak);
    }
    const eave=1.18;
    for(const z of [-d*.92,d*.92])face([[-w*.95,eave,z],[w*.95,eave,z],[0,eave+.47,z]],warehouse?slate:sunwood);
    roof(eave,.54,w*1.09,d*1.12,warehouse?'#627a7c':stoneHouse?'#78868a':long?'#9e684f':'#b27e54');
    for(let i=0;i<=6;i++)for(const sign of [-1,1])beam([0,eave+.55,(i-3)*d*.34],[sign*w*1.05,eave+.035,(i-3)*d*.34],.014,warehouse?slate:oak);
    box(-.18,.57,d*.96,warehouse?.87:.48,.91,.08,oak);
    if(warehouse){
      for(let i=0;i<6;i++)box(-.52+i*.14,.57,d*1.017,.127,.85,.07,panels[i%4]);
      beam([-.57,.20,d*1.07],[.23,.90,d*1.07],.026,iron);
      box(.62,.22,d*1.14,.40,.40,.4,sunwood);
    } else {
      box(-.18,.56,d*1.023,.38,.78,.045,'#58747a');
      window(.58,.75,d*.96);
      if(long){window(-1.00,.75,d*.96);frame(0,0,d*1.17,1.5,.93,.22);boards(0,.10,d*1.12,w*1.9,.42,3);}
    }
  }
  function fireTower(kind) {
    if(kind==='lighthouse'){
      disk(0,0,0,.58,.52,.15,slate);
      disk(0,.15,0,.45,.37,.82,paper);disk(0,.97,0,.37,.32,.61,'#ad6252');
      disk(0,1.58,0,.32,.28,.60,paper);disk(0,2.18,0,.42,.42,.10,iron);
      disk(0,2.28,0,.26,.26,.36,'#ebc578');
      for(let i=0;i<6;i++){const x=.28*Math.cos(i*Math.PI/3),z=.28*Math.sin(i*Math.PI/3);beam([x,2.26,z],[x,2.67,z],.021,iron);}
      disk(0,2.64,0,.39,.035,.22,slate);
      box(0,.37,.4,.17,.40,.061,oak);
    } else {
      frame(0,0,0,.54,1.98,.5,oak);
      for(const x of [-.54,.54]){
        beam([x,.12,-.5],[x,1.78,.5],.045,wood);
        beam([x,.12,.5],[x,1.78,-.5],.045,sunwood);
      }
      for(let i=0;i<7;i++)box(0,.14+i*.25,.52,.32,.045,.075,sunwood);
      for(const x of [-.19,.19])beam([x,0,.58],[x,1.86,.50],.035,wood);
      boards(0,1.88,0,1.48,1.4,8);
      frame(0,1.9,0,.6,.92,.55);
      for(const z of [-.62,.62])box(0,2.18,z,1.35,.18,.07,sunwood);
      roof(2.81,.30,.85,.78,'#708a89');
    }
  }
  function make(kind) {
    if(['hut','house','longhouse','storage'].includes(kind))housing(kind);
    else if(kind==='tent'){
      roof(.04,1.14,.87,.85,'#c99358');
      for(const side of [-1,1])face([[0,1.15,.85],[side*.87,.04,.85],[side*.33,.04,.94]],'#c08050');
      boards(0,.03,0,1.40,1.63,6);
      for(const x of [-.91,.91])for(const z of [-.94,.94])beam([x*.80,.27,z*.78],[x,.03,z],.014,oak);
    } else if(kind==='watchtower'||kind==='lighthouse')fireTower(kind);
    else if(kind==='fence'||kind==='gate'){
      for(const x of [-.62,.62]){disk(x,0,0,.085,.075,.80,oak,6);disk(x,.80,0,.083,.02,.095,sunwood,6);}
      if(kind==='gate'){
        for(let i=0;i<6;i++)box((i-2.5)*.19,.39,0,.15,.61,.09,panels[i%4]);
        beam([-.53,.15,.06],[.53,.65,.06],.042,oak);box(.38,.57,.08,.16,.055,.04,iron);
      } else for(const y of [.26,.58])box(0,y,0,1.27,.13,.085,sunwood);
    } else if(kind==='bridge'){
      for(let i=0;i<12;i++){const z=(i-5.5)*.19;box(0,.19+.09*Math.cos(z*1.33),z,.87,.085,.181,panels[i%4]);}
      for(const x of [-.39,.39])for(const z of [-.94,0,.94])beam([x,.1,z],[x,.80,z],.04,oak);
      for(const x of [-.39,.39])beam([x,.72,-.94],[x,.72,.94],.024,sunwood);
    } else if(kind==='bench'){
      for(const x of [-.51,.51]){beam([x,.02,-.18],[x,.89,-.23],.051,iron);beam([x,0,.18],[x,.45,.18],.052,iron);}
      boards(0,.42,0,1.55,.5,3);
      for(const y of [.68,.85])box(0,y,-.22,1.57,.13,.075,sunwood);
    } else if(kind==='sign'){
      for(const x of [-.34,.34])beam([x,0,0],[x,1.34,0],.048,oak);
      box(0,.95,0,1.15,.67,.11,wood);box(0,1.31,0,1.25,.095,.23,slate);
      for(let i=0;i<3;i++){box((i-1)*.29,1+(i%2)*.055,.067,.22,.31,.015,i%2?paper:'#c3c09e',[0,0,(i-1)*.09]);}
    } else if(kind==='woodpile'){
      for(let j=0;j<3;j++)for(let i=0;i<4-j;i++){
        const z=(i-(3-j)/2)*.19,y=.12+j*.168;
        beam([-.62,y,z],[.62,y,z],.114,panels[i%4],.103,9);
        beam([.62,y,z],[.63,y,z],.084,sunwood,.083,8);
      }
    } else if(kind==='well'){
      disk(0,.02,0,.56,.57,.44,stone,12);disk(0,.46,0,.46,.46,.025,'#457c80');
      for(const x of [-.47,.47])beam([x,.14,0],[x,1.52,0],.066,oak);
      beam([-.58,.99,0],[.62,.99,0],.072,wood);beam([0,.99,0],[0,.68,0],.017,oak);disk(0,.61,0,.097,.122,.15,iron);
      roof(1.41,.31,.68,.49,'#748689');
    } else if(kind==='plaza'){
      disk(0,0,0,1.22,1.22,.09,'#bfb3a0',12);disk(0,.09,0,.88,.83,.23,stone,12);
      disk(0,.32,0,.76,.76,.022,'#72bdb8');disk(0,.33,0,.21,.13,.61,stone);
      disk(0,.91,0,.17,.43,.12,paper);disk(0,1.03,0,.38,.38,.021,'#88cec7');
      disk(0,1.05,0,.065,.031,.27,'#b8e6db');
    } else if(kind==='drying_rack'){
      for(const x of [-.86,.86])for(const z of [-.22,.22])beam([x,0,z],[x,1.05,0],.048,wood);
      beam([-.96,1.03,0],[.96,1.03,0],.060,oak);
      for(let i=0;i<5;i++){const x=(i-2)*.32;beam([x,1.02,0],[x,.9,0],.014,iron);face([[x,.91,0],[x+.08,.78,.02],[x+.03,.48,.04],[x-.07,.57,.04],[x-.08,.8,.02]],i%2?'#b47858':'#b6a17a');}
    } else if(kind==='camera'){
      const pivot=[0,1.29,0];
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3;beam([.40*Math.sin(a),.02,.40*Math.cos(a)],pivot,.033,iron);}
      box(0,1.47,0,.42,.34,.56,'#465363');
      beam([0,1.47,.25],[0,1.47,.42],.14,slate,.18,12);
      beam([0,1.47,.42],[0,1.47,.44],.134,'#65909c',.133,12);
      box(-.23,1.48,-.10,.11,.19,.26,iron);box(.11,1.65,.09,.073,.048,.08,'#c46c55');
    } else if(kind==='interview'){
      boards(0,.1,0,1.78,1.32,8);
      frame(0,.15,-.38,.77,1.78,.06,iron);
      box(0,1.13,-.39,1.56,1.44,.06,'#627c80');
      for(const x of [-.32,.32])for(const z of [.1,.52])beam([x,.13,z],[x,.55,z],.045,oak);
      box(0,.57,.30,.78,.10,.56,wood);box(0,.82,.04,.78,.54,.065,'#bf8c56');
      beam([.64,.16,.50],[.64,1.28,.50],.027,slate);
      beam([.64,1.28,.50],[.41,1.39,.38],.031,iron);beam([.42,1.39,.38],[.32,1.45,.34],.064,slate);
    } else if(kind==='heater'){
      box(0,.46,0,.7,.76,.62,'#737d80');box(0,.52,.325,.51,.44,.05,oak);
      box(0,.52,.355,.41,.34,.023,'#dc9553');
      for(const x of [-.14,0,.14])box(x,.52,.375,.029,.35,.02,iron);
      disk(.13,.8,-.1,.11,.11,.65,slate);disk(.13,1.45,-.1,.145,.125,.05,iron);
      for(const x of [-.25,.25])for(const z of [-.22,.22])disk(x,0,z,.048,.048,.12,iron);
    } else if(kind==='privacy'){
      for(let i=0;i<8;i++)box((i-3.5)*.19,.75,-.48,.18,1.48-.025*Math.cos(i*2),.075,panels[i%4]);
      for(let i=0;i<4;i++)box(-.71,.74,(i-1)*.19,.075,1.42,.18,panels[i%4]);
      boards(0,.41,.05,1.13,.43,3);
      for(const x of [-.44,.44])beam([x,.03,.04],[x,.40,.04],.062,oak);
    } else if(kind==='water'){
      disk(0,0,0,.51,.52,.12,slate);disk(0,.12,0,.48,.48,.94,'#769b96');
      for(const y of [.21,.86,1.05])disk(0,y,0,.498,.498,.05,iron);
      disk(0,1.1,0,.49,.35,.08,'#91a79d');disk(.19,1.18,-.12,.10,.10,.065,slate);
      beam([0,.37,.46],[0,.37,.68],.040,iron);beam([0,.37,.68],[0,.27,.68],.04,iron);
      box(0,.11,.65,.46,.12,.27,paper);box(0,.177,.65,.39,.018,.21,'#72aaa8');
    } else if(kind==='kitchen'){
      frame(0,0,0,.88,1.35,.47);roof(1.35,.22,1.03,.62,'#a87453');
      box(0,.40,0,1.64,.78,.84,stone);box(0,.82,0,1.78,.085,.98,slate);
      box(-.35,.39,.44,.56,.48,.04,oak);
      disk(.28,.87,0,.25,.26,.22,iron);disk(.28,1.09,0,.29,.06,.08,slate);disk(.28,1.17,0,.045,.045,.055,oak);
      disk(-.54,1.36,-.33,.096,.096,.64,slate);
    } else throw new RangeError('Unknown building: '+kind);
    const root=new T.Group(), mesh=new T.Mesh(mergeGeometries(parts),new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide}));
    root.add(mesh);mesh.castShadow=true;mesh.receiveShadow=true;
    parts.forEach(g=>g.dispose());
    const ink=new T.BufferGeometry();ink.setAttribute('position',new T.Float32BufferAttribute(strokes,3));
    root.add(new T.LineSegments(ink,new T.LineBasicMaterial({color:'#3a333a',depthWrite:false})));
    return root;
  }
  return make;
}

const studyParts = {
  tent_canopy:['canopy'], canopy:['canopy'], station:['shelter'], clinic:['shelter'],
  shop:['canopy','market'], market:['market'], solar:['solar'], flag:['flag'],
  lantern:['lantern'], table:['canopy','market'], cabin:['shelter'], farm:['farm'], pier:['pier'], fire_pit:['fire'], bonfire:['fire'], fire:['fire']
};

function template(T,lib,id) {
  if(lib.templates.has(id))return lib.templates.get(id);
  let asset;
  if(studyParts[id]){
    asset=new T.Group();
    for(const key of studyParts[id])asset.add(lib.study.getObjectByName(key).clone());
    if(id==='clinic'||id==='shop'){
      // Mount each field prop on the owning plot before the normal footprint fit.
      // Both stay selectable, movable and removable with their station or market.
      const panel=lib.study.getObjectByName(id==='clinic'?'solar':'solar-east').clone();
      if(id==='clinic'){
        const pennant=lib.study.getObjectByName('flag').clone();
        pennant.position.set(.52,0,.68);
        asset.add(pennant);
        panel.position.set(5.12,0,3.64);
      }else{
        panel.position.set(-.95,0,4.90);
      }
      asset.add(panel);
    }
    if(id==='pier')asset.rotation.y=-Math.PI/2;
    if(id==='clinic'){
      const m=new T.MeshBasicMaterial({color:'#a54e43'});
      for(const size of [[.34,.105,.025],[.105,.34,.025]]){
        const cross=new T.Mesh(new T.BoxGeometry(...size),m);
        cross.position.set(.92,1.26,.623);asset.add(cross);
      }
    }
    if(id==='bonfire'){
      asset.getObjectByName(campfireEffectName).scale.set(1.22,1.55,1.22);
      // Tall crossed timbers distinguish the communal fire from a small hearth.
      const oakMaterial=new T.MeshLambertMaterial({color:oak});
      for(let i=0;i<5;i++){
        const angle=i*Math.PI*.4,start=new T.Vector3(.75+.60*Math.cos(angle),.08,4.62+.55*Math.sin(angle)),end=new T.Vector3(.75-.1*Math.cos(angle),1.25,4.62-.1*Math.sin(angle));
        const log=new T.Mesh(new T.CylinderGeometry(.085,.105,start.distanceTo(end),7),oakMaterial);
        log.position.copy(start).lerp(end,.5);
        log.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).normalize());asset.add(log);
      }
    }
  }else asset=workshop(T)(id);
  // Board placement follows the stationary hearth, independently of rising particles.
  const effect=asset.getObjectByName(campfireEffectName),fireParent=effect?.parent;
  effect?.removeFromParent();
  const bounds=new T.Box3().setFromObject(asset,true),center=bounds.getCenter(new T.Vector3());
  if(fireParent)fireParent.add(effect);
  const size=bounds.getSize(new T.Vector3());
  asset.position.set(-center.x, id==='pier' ? 0 : -bounds.min.y, -center.z);
  const normalized=new T.Group();normalized.add(asset);
  const result={normalized,size};lib.templates.set(id,result);
  return result;
}

// All footprints point toward +Z before the caller applies -rot * PI/2.
export function createLiveBuilding(T, buildingId, width=1, depth=1) {
  let lib=libraries.get(T);
  if(!lib){lib=makeLibrary(T);libraries.set(T,lib);}
  const {normalized,size}=template(T,lib,buildingId);
  const root=normalized.clone();
  const envelope = {
    lantern:[.53,.53], fence:[.98,.22], gate:[.98,.25], sign:[.95,.35],
    watchtower:[.89,.89], lighthouse:[.79,.79]
  }[buildingId] || [.95,.95];
  const sx=width*envelope[0]/size.x,sz=depth*envelope[1]/size.z;
  root.name=buildingId;
  root.scale.set(sx,Math.min(sx,sz),sz);
  return root;
}
