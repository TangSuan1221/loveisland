import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {T,W,H} from '../camp/grid.js';
import {cellToWorld} from '../camp/footprints.js';

const labels={
  E01_spring_north:'北泉',E02_spring_east:'东泉',
  E03_grove_west:'西林木场',E04_grove_south:'南林木场',
  E05_berry_patch:'浆果丛',E06_fish_cove:'鱼湾'
};
const vector=p=>new THREE.Vector3(...p);

// A landmark occupies its protected gathering cell. Decorative chips and ink
// are baked into two draws so all six sites stay legible in the recording view.
function siteArt(id) {
  const geometry=[],ink=[],inkColors=[],transform=new THREE.Object3D();
  let seed=[...id].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0),1)>>>0;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  function stroke(points,color='#413f49'){
    const c=new THREE.Color(color);
    for(let k=1;k<points.length;k++){ink.push(...points[k-1],...points[k]);inkColors.push(c.r,c.g,c.b,c.r,c.g,c.b);}
  }
  function solid(g,p,scale,color,q) {
    transform.position.fromArray(p);transform.scale.fromArray(scale);transform.quaternion.identity();
    if(q)transform.quaternion.copy(q);
    transform.updateMatrix();g.applyMatrix4(transform.matrix);
    const shape=g.index?g.toNonIndexed():g;if(shape!==g)g.dispose();shape.deleteAttribute('uv');
    const rgb=new THREE.Color(color),colors=new Float32Array(shape.attributes.position.count*3);
    const normal=shape.attributes.normal;
    for(let j=0;j<normal.count;j++){
      const light=normal.getY(j)*.72+normal.getX(j)*-.43+normal.getZ(j)*.28;
      const shade=light>.42?1:light>-.12?.82:.63;
      colors[j*3]=rgb.r*shade;colors[j*3+1]=rgb.g*shade;colors[j*3+2]=rgb.b*(shade+.035);
    }
    shape.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.push(shape);
  }
  const oval=(p,sz,col)=>solid(new THREE.SphereGeometry(1,12,7),p,sz,col);
  function stick(a,b,r1,r2,col){
    const dir=vector(b).sub(vector(a));
    solid(new THREE.CylinderGeometry(r2,r1,dir.length(),9),vector(a).lerp(vector(b),.5).toArray(),[1,1,1],col,
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()));
  }
  function arc(x,y,z,rx,rz,start,end,col,wobble=0) {
    const points=[];
    for(let i=0;i<=20;i++){
      const a=start+(end-start)*i/20, r=1+wobble*Math.sin(3*a+.7);
      points.push([x+Math.cos(a)*rx*r,y,z+Math.sin(a)*rz*r]);
    }
    stroke(points,col);
  }
  if(id.includes('spring')){
    oval([0,.035,0],[.79,.04,.62],'#8e8c72');
    oval([0,.066,.03],[.68,.035,.49],'#509a9a');
    oval([-.04,.082,.05],[.56,.028,.40],'#57b6ac');
    arc(.01,.116,.10,.37,.18,.28,2.68,'#c0e8cd',.06);
    arc(-.10,.112,-.005,.41,.24,3.46,5.81,'#85d2c2',.09);
    for(let i=0;i<10;i++){
      const a=2.3+i*.43,r=.13+rand()*.13;
      oval([Math.cos(a)*.64,r*.39,Math.sin(a)*.49],[r,r*.72,r*.76],i%3?'#80828b':'#969a85');
      if(i%3===0)oval([Math.cos(a)*.64,r*.92,Math.sin(a)*.49],[r*.8,r*.29,r*.66],'#8d9e68');
    }
    for(let i=0;i<9;i++){
      const x=-.57+rand()*.18,z=-.27+rand()*.28,y=.24+rand()*.34;
      stick([x,.02,z],[x+(rand()-.5)*.22,y,z+.06],.025,.005,i%2?'#7d9453':'#607b53');
    }
  }else if(id.includes('grove')){
    const a=[-.25,.04,-.11],b=[-.21,.50,-.10];
    stick(a,b,.34,.27,'#7f6956');oval(b,[.274,.025,.271],'#ba9a71');
    arc(b[0],.529,b[2],.18,.17,0,Math.PI*2,'#88745e',.08);
    arc(b[0],.529,b[2],.09,.08,.8,5.9,'#88745e',.06);
    for(let k=0;k<5;k++){const angle=k*1.256;stick(a,[a[0]+.45*Math.cos(angle),.025,a[2]+.37*Math.sin(angle)],.105,.022,'#79664f');}
    for(const [x,z,len,h] of [[.22,.17,.69,.115],[.36,-.01,.92,.12]]){
      stick([x-len*.35,h,z-.15],[x+len*.51,h+.03,z+.17],h,h*.80,'#95765a');
      stroke([[x-len*.32,h*1.82,z-.14],[x+.07,h*1.92,z+.04],[x+len*.45,h*1.84,z+.13]],'#63594d');
    }
    stick([-.30,.07,.22],[-.52,.49,.28],.04,.019,'#6d6a4f');
    oval([-.51,.47,.27],[.17,.10,.10],'#778c57');
    oval([-.42,.41,.35],[.13,.07,.09],'#94a565');
  }else if(id.includes('berry')){
    for(let j=0;j<7;j++){
      const a=j*2.399963,h=.35+rand()*.31,x=Math.cos(a)*(.25+rand()*.20),z=Math.sin(a)*(.20+rand()*.17);
      stick([0,.02,0],[x,h,z],.036,.014,'#66554d');
      oval([x,h,z],[.23,.17,.18],j%3?'#61895e':'#81985e');
      for(let k=0;k<4;k++){
        const phi=k*1.7,p=[x+Math.cos(phi)*.16,h+.035+rand()*.10,z+Math.sin(phi)*.13];
        oval(p,[.064,.073,.057],k%2?'#b45470':'#d37383');
        oval([p[0]-.012,p[1]+.046,p[2]+.028],[.017,.012,.014],'#e8a2a0');
      }
    }
  }else{
    // Rope-framed wicker trap and two cork floats, placed on the dry fishing bank.
    stick([-.48,.02,-.22],[-.49,.73,-.22],.056,.039,'#8b775e');
    stick([.43,.02,-.19],[.48,.57,-.17],.046,.032,'#a08865');
    const rim=angle=>[-.02+.24*Math.cos(angle),.22+.15*Math.sin(angle),.36+.07*Math.sin(angle)];
    const tail=angle=>[.08+.095*Math.cos(angle),.12+.082*Math.sin(angle),-.27+.03*Math.sin(angle)];
    for(let i=0;i<15;i++){
      const a=i*Math.PI*2/15,mid=vector(rim(a)).lerp(vector(tail(a+.24)),.48).toArray();
      stroke([rim(a),mid,tail(a+.24)],'#835f47');
    }
    for(const t of [0,.23,.46,.7,.9,1]){
      const ring=[];for(let i=0;i<=22;i++){const a=i*Math.PI/11;ring.push(vector(rim(a)).lerp(vector(tail(a+.24)),t).toArray());}
      stroke(ring,'#513f36');
    }
    const cord=[[-.49,.66,-.22],[-.18,.48,.04],[.17,.40,.13],[.46,.51,-.17]];
    stroke(cord,'#695b4d');
    oval(cord[1],[.082,.118,.080],'#d4905a');oval(cord[2],[.072,.097,.064],'#c4ab71');
  }
  const group=new THREE.Group(),merged=mergeGeometries(geometry,false);
  geometry.forEach(g=>g.dispose());
  const mesh=new THREE.Mesh(merged,new THREE.MeshBasicMaterial({vertexColors:true}));
  mesh.castShadow=true;group.add(mesh);
  const drawing=new THREE.BufferGeometry();
  drawing.setAttribute('position',new THREE.Float32BufferAttribute(ink,3));
  drawing.setAttribute('color',new THREE.Float32BufferAttribute(inkColors,3));
  group.add(new THREE.LineSegments(drawing,new THREE.LineBasicMaterial({vertexColors:true})));
  group.userData.siteId=id;group.userData.siteName=labels[id];group.name=id;
  return group;
}
function bankAngle(grid,site){
  let shortest=Infinity,best=0;
  for(let y=Math.max(0,site.y-6);y<Math.min(H,site.y+7);y++)for(let x=Math.max(0,site.x-6);x<Math.min(W,site.x+7);x++){
    if(grid.base[y*W+x]>T.SHALLOW)continue;
    const dx=x-site.x,dz=y-site.y,d=dx*dx+dz*dz;
    if(d>0&&d<shortest){shortest=d;best=Math.atan2(dx,dz);}
  }
  return best;
}
export function createResourceSites(scene){
  const root=new THREE.Group();root.name='Island gathering sites';scene.add(root);
  const built=new Map(),byCell=new Map();
  return {root,at:(x,y)=>byCell.get(y*W+x),sync(grid){
    byCell.clear();
    const active=new Set();
    for(const site of grid.sites){
      if(!labels[site.id])continue;
      active.add(site.id);
      let art=built.get(site.id);if(!art){art=siteArt(site.id);built.set(site.id,art);root.add(art);}
      const p=cellToWorld(site.x,site.y);art.visible=true;art.position.set(p.x,0,p.z);byCell.set(site.y*W+site.x,art);
      if(site.id==='E06_fish_cove')art.rotation.y=bankAngle(grid,site);
    }
    for(const [id,art] of built)art.visible=active.has(id);
  }};
}
