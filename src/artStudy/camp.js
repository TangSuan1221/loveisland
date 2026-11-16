import {makeCampfire,updateCampfire} from './campfire.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// All dimensions are metres. Front of the shelter faces +Z.
export function buildCamp(T, scene, { separateParts = false } = {}) {
  const root = new T.Group();
  root.name = 'Camp / salt-weathered field station';
  scene.add(root);
  const solids = [], strokes = [], strokeColors = [];
  const marks = [];
  function beginPart(name) {
    marks.push({name, solid: solids.length, line: strokes.length});
  }
  beginPart('shelter');
  const ink = '#332e37', wood = '#aa805e', iron = '#51616b', cream = '#edeee9';
  let randomState = 93204;
  function rand() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  }
  const v = a => new T.Vector3(...a);
  function stroke(points, color = ink) {
    const c = new T.Color(color);
    for (let i = 1; i < points.length; i++) {
      strokes.push(...points[i-1], ...points[i]);
      strokeColors.push(c.r,c.g,c.b,c.r,c.g,c.b);
    }
  }
  function shape(geo, pos, color, rotation, scale, edges=false) {
    const matrix = new T.Matrix4().compose(v(pos), rotation || new T.Quaternion(), v(scale || [1,1,1]));
    geo.applyMatrix4(matrix);
    if(edges) {
      const eg = new T.EdgesGeometry(geo, 40);
      const attr = eg.getAttribute('position');
      for(let i=0;i<attr.count;i+=2) stroke([[attr.getX(i),attr.getY(i),attr.getZ(i)],[attr.getX(i+1),attr.getY(i+1),attr.getZ(i+1)]]);
      eg.dispose();
    }
    const flat = geo.index ? geo.toNonIndexed() : geo;
    if(flat!==geo) geo.dispose();
    flat.deleteAttribute('uv');
    const base = new T.Color(color);
    const attr = flat.getAttribute('position');
    const colors = new Float32Array(attr.count*3);
    for(let i=0; i<attr.count; i++) base.toArray(colors,i*3);
    flat.setAttribute('color',new T.BufferAttribute(colors,3));
    solids.push(flat);
  }
  const rot = (x=0,y=0,z=0) => new T.Quaternion().setFromEuler(new T.Euler(x,y,z));
  function box(pos,size,color,rotation,edges=true) {
    shape(new T.BoxGeometry(...size),pos,color,rotation,null,edges);
  }
  function post(a,b,r,c,r2=r,n=9) {
    const start=v(a),end=v(b),delta=end.clone().sub(start);
    shape(new T.CylinderGeometry(r2,r,delta.length(),n),start.add(end).multiplyScalar(.5).toArray(),c,new T.Quaternion().setFromUnitVectors(v([0,1,0]),delta.normalize()));
  }
  function skin(vertices,faces,color) {
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(vertices.flat(),3));
    g.setIndex(faces);
    g.computeVertexNormals();
    shape(g,[0,0,0],color);
  }
  function pebble(p,s,c) {
    shape(new T.IcosahedronGeometry(1,0),p,c,rot(rand(),rand()*6,rand()),s);
  }
  // Vaulted salvage hull, individual plates and salt stains.
  const cx=-.2, cz=-1.8, radius=2, half=2.35;
  const at=(a,z,offset=0)=>[cx+(radius+offset)*Math.cos(a),1+(radius+offset)*Math.sin(a),cz+z];
  const arch=Array.from({length:17},(_,i)=>i*Math.PI/16);
  for(let i=0;i<16;i++) {
    const shade=i<2?'#adabb0':i<5?'#d8dbd9':i<11?cream:'#d8d5d2';
    skin([at(arch[i],-half),at(arch[i],half),at(arch[i+1],half),at(arch[i+1],-half)],[0,1,2,0,2,3],shade);
  }
  for(const z of [-half, -1.14,.12,1.3,half]){
    stroke(arch.map(a=>at(a,z,.009)));
    for(let i=1;i<15;i+=2){
      const a=arch[i]+rand()*.055;
      stroke([at(a,z+.04,.012),at(a+.017,z+.045,.012)],'#775e53');
    }
  }
  for(let i=0;i<65;i++){
    const a=.08+rand()*2.9,z=rand()*4.3-2.15;
    if(i%3===0) stroke([at(a,z,.012),at(a+.025,z+.09,.014),at(a+.01,z+.13,.014)],'#a4866f');
  }
  for(const end of [-1,1]){
    const z=cz+end*half, pts=[[cx-radius,.02,z],[cx+radius,.02,z],...arch.map(a=>at(a,end*half))];
    const faces=[];
    for(let i=1;i<pts.length-1;i++) faces.push(0,i,i+1);
    skin(pts,faces,end===1?'#d4d5d1':'#aaa5a2');
    stroke([...pts,pts[0]]);
  }
  for(const side of [-1,1]) box([cx+side*(radius-.035),.51,cz],[.07,1,2*half],side>0?'#9b9da2':'#b4ada4');
  const faceZ=cz+half;
  box([cx-.28,1.09,faceZ+.055],[1.52,2.18,.14],'#514a4e');
  box([cx-.28,1.03,faceZ+.15],[1.28,2.03,.09],'#677c7b');
  box([cx-.28,1.54,faceZ+.21],[.75,.59,.06],'#2d363f');
  box([cx-.28,1.55,faceZ+.25],[.64,.47,.02],'#568490');
  stroke([[cx-.53,1.36,faceZ+.263],[cx-.24,1.75,faceZ+.263]],'#99bbc0');
  box([cx+.13,.85,faceZ+.22],[.09,.23,.10],'#d5be8b');
  box([cx-.28,.09,faceZ+.48],[1.65,.18,.8],'#7b7d79');
  for(let i=0;i<5;i++) stroke([[cx-1,.187,faceZ+.22+i*.12],[cx+.42,.187,faceZ+.22+i*.12]],'#53585b');
  box([cx+1.12,1.26,faceZ+.02],[.47,.64,.07],'#ad6352');
  stroke([[cx+1,1.40,faceZ+.065],[cx+1.23,1.40,faceZ+.065]],'#ffe2b2');
  for(const z of [-1.02,.22,1.45]){
    const win=[at(.18,z-.51,.065),at(.18,z+.51,.065),at(.54,z+.51,.065),at(.54,z-.51,.065)];
    skin(win,[0,1,2,0,2,3],'#3e586c');
    stroke([...win,win[0]]);
    stroke([at(.23,z-.4,.074),at(.46,z-.19,.074)],'#a5b8b0');
  }
  post([cx,2.8,cz-.95],[cx,3.14,cz-.95],.43,iron);
  post([cx,3.1,cz-.95],[cx,4.36,cz-.95],.20,'#667984');
  post([cx,4.31,cz-.95],[cx,4.48,cz-.95],.26,'#363e4a');
  post([cx-.75,2.73,cz-1.7],[cx-.75,4.75,cz-1.7],.045,iron);
  // Recessed front lip, structural datum, rivets and service cabling.
  const outer=arch.map(a=>at(a,half+.014));
  const inner=outer.map(([x,y,z])=>[cx+(x-cx)*.945,1+(y-1)*.945,z+.032]);
  for(let i=0;i<16;i++) skin([outer[i],outer[i+1],inner[i+1],inner[i]],[0,1,2,0,2,3],'#a3a3a0');
  stroke(inner,'#5d5b5b');
  for(const side of [-1,1]) {
    box([cx+side*1.935,.49,faceZ+.033],[.12,.98,.07],'#a3a3a0');
    for(const y of [.29,.87,1.65]) {
      const x=cx+side*(y>1?1.62:1.8);
      stroke([[x,y,faceZ+.041],[x+.035,y+.019,faceZ+.041]],'#796f67');
    }
  }
  box([cx-.28,2.22,faceZ+.076],[1.69,.13,.21],'#858680');
  box([cx-.28,2.21,faceZ+.194],[.45,.057,.026],'#d9bd83',undefined,false);
  for(const dy of [.32,.53,1.79])box([cx-.90,dy,faceZ+.215],[.13,.14,.08],'#7f827f');
  box([cx-.36,.46,faceZ+.21],[.65,.28,.038],'#596562');
  for(let i=0;i<4;i++)stroke([[cx-.61,.36+i*.055,faceZ+.235],[cx-.1,.36+i*.055,faceZ+.235]],'#343e42');
  const hose=[];
  for(let i=0;i<=32;i++){
    const a=i*Math.PI/15;
    hose.push([cx+1.35+Math.cos(a)*.22,.58+Math.sin(a)*.28,faceZ+.09]);
  }
  for(let i=1;i<hose.length;i++)post(hose[i-1],hose[i],.035,'#575858',.035,5);
  post([cx+1.55,.61,faceZ+.09],[cx+1.78,.18,faceZ+.09],.032,'#575858');
  // Twin collar, louvered roof vent and enamel service hatch.
  for(const yy of [3.28,4.2])post([cx,yy,cz-.95],[cx,yy+.065,cz-.95],.215,'#aeb4ae');
  const hatchA=1.16,hatchZ=.66;
  const hatch=[at(hatchA,hatchZ-.55,.035),at(hatchA,hatchZ+.53,.035),at(hatchA+.37,hatchZ+.53,.035),at(hatchA+.37,hatchZ-.55,.035)];
  skin(hatch,[0,1,2,0,2,3],'#6e7f85');stroke([...hatch,hatch[0]]);
  for(let i=0;i<8;i++)stroke([at(hatchA+.055,hatchZ-.4+i*.12,.045),at(hatchA+.31,hatchZ-.4+i*.12,.045)],'#38464f');
  for(let i=0;i<36;i++){
    const seam=[-1.14,.12,1.3][i%3], a=.18+rand()*2.45, sz=.014+rand()*.036,z=seam+.035+rand()*.045;
    const chip=[at(a,z,.02),at(a+sz,z+.03,.02),at(a+sz*.8,z+.11,.02),at(a+sz*.13,z+.06,.02)];
    skin(chip,[0,1,2,0,2,3],i%3?'#af9a89':'#a47760');
  }
  beginPart('flag');
  // Field communications pole: bent dipole, pennant and a loose cable.
  const pole=[-2.8,0,-1.0];
  box([pole[0],.19,pole[2]],[.51,.37,.46],'#777c7d');
  post([pole[0],.15,pole[2]],[pole[0],5.25,pole[2]],.057,'#655d5a');
  const flag=[[-2.8,5.05,-1],[-3.32,5.09,-.92],[-3.83,4.99,-1.02],[-4.35,5.0,-1.11],[-4.35,4.28,-1.11],[-3.83,4.23,-1.02],[-3.32,4.32,-.92],[-2.8,4.31,-1]];
  skin(flag,[0,1,7,1,6,7,1,2,6,2,5,6,2,3,5,3,4,5],'#3e5159');stroke([...flag,flag[0]]);
  const sign=[[-3.91,4.61,-.988],[-3.69,4.85,-.97],[-3.48,4.67,-.94],[-3.51,4.45,-.94],[-3.87,4.44,-.985]];
  skin(sign,[0,1,2,0,2,3,0,3,4],'#f4eacb');
  stroke([[-2.8,3.85,-1],[-2.14,3.35,-1.28],[-1.58,3.39,-1.7],[cx-.75,4.28,cz-1.7]],'#66605a');
  post([cx-1.48,4.67,cz-1.7],[cx-.12,4.71,cz-1.7],.032,iron);
  beginPart('canopy');
  // Four-point saddle canopy. Seams lie on the surface of the sagging cloth.
  const corners=[[2.35,2.52,-.5],[6.25,2.82,-.75],[6.1,2.12,2.5],[2.48,2.83,2.6]];
  const sheet=(u,w)=>{
    const p = new T.Vector3().lerpVectors(v(corners[0]),v(corners[1]),u);
    const q = new T.Vector3().lerpVectors(v(corners[3]),v(corners[2]),u);
    const r=p.lerp(q,w);
    r.y-=.27*(Math.sin(Math.PI*u)+Math.sin(Math.PI*w));
    return r.toArray();
  };
  for(let i=0;i<8;i++)for(let j=0;j<7;j++){
    skin([sheet(i/8,j/7),sheet((i+1)/8,j/7),sheet((i+1)/8,(j+1)/7),sheet(i/8,(j+1)/7)],[0,2,1,0,3,2],i<2?'#d8783b':i<6?'#f09a45':'#e98b40');
  }
  for(const u of [0,.25,.75,1]) stroke(Array.from({length:15},(_,i)=>sheet(u,i/14)),u===0||u===1?ink:'#a96135');
  for(const w of [0,1]) stroke(Array.from({length:15},(_,i)=>sheet(i/14,w)));
  for(const w of [.025,.975]) stroke(Array.from({length:25},(_,i)=>{
    const p=sheet(i/24,w);p[1]+=.008;return p;
  }),'#c07746');
  for(let i=0;i<14;i++){
    const u=.012+i*.07,p=sheet(u,.046),q=sheet(u+.025,.046);
    p[1]+=.011;q[1]+=.011;stroke([p,q],'#ebb277');
  }
  for(const [x,y,z] of corners){
    post([x,.01,z],[x,y+.12,z],.055,wood);
    const xx=x+(x<4?-.39:.45), zz=z+(z<0?-.46:.45);
    stroke([[x,y+.03,z],[xx,.12,zz]],'#6b5944');
    post([xx,.01,zz],[xx+.02,.25,zz],.035,iron);
  }
  function crate(x,z,w=.77,h=.69){
    box([x,h*.5,z],[w,h,w*.87],'#99714e');
    const f=z+w*.435+.012, e=x+w*.5+.012;
    for(const dx of [-.39,.39])box([x+dx*w,h*.48,f],[w*.105,h*.9,.04],wood,undefined,false);
    for(const y of [.11,.86])box([x,h*y,f],[w*.94,h*.12,.04],wood,undefined,false);
    stroke([[x-w*.35,h*.17,f+.025],[x+w*.35,h*.77,f+.025],[x+w*.27,h*.79,f+.025],[x-w*.36,h*.26,f+.025]],'#624d42');
    for(let i=1;i<4;i++)stroke([[x-w*.48,h+.006,z-w*.43+i*w*.21],[x+w*.48,h+.006,z-w*.43+i*w*.21]],'#705946');
    stroke([[e,h*.11,z-w*.4],[e,h*.85,z+w*.4]],'#655344');
  }
  beginPart('market');
  crate(3.1,.4); crate(3.92,.3,.72,.61); crate(5.4,1.8); crate(6.5,2.9,.6,.55);
  box([4.62,.91,-.11],[2.07,.13,.67],'#ad845e');
  for(const x of [3.76,5.48])for(const z of [-.34,.13])post([x,0,z],[x,.86,z],.045,iron);
  // Drinking-water drum and a lantern with a protective wire cage.
  const drum=[5.15,.02,2.8];
  post(drum,[drum[0],.88,drum[2]],.29,'#6c8582');
  for(const y of [.12,.73,.87])post([drum[0],y,drum[2]],[drum[0],y+.04,drum[2]],.305,'#4e5d62');
  beginPart('lantern');
  box([-2.62,.33,4.2],[.51,.66,.48],'#bba478');
  post([-2.62,.56,4.2],[-2.62,2.74,4.2],.052,'#66625c');
  post([-2.81,2.73,4.2],[-2.43,2.73,4.2],.052,'#66625c');
  box([-2.62,2.60,4.2],[.31,.17,.22],'#f4dba1');
  for(const dx of [-.13,0,.13])stroke([[-2.62+dx,2.50,4.32],[-2.62+dx,2.7,4.32]],'#575553');
  beginPart('farm');
  // Wood-framed beds, each with a different row crop.
  for(let b=0;b<2;b++){
    const bx=-4.4-b*.35,bz=1.35+b*2.0;
    box([bx,.14,bz],[3.25,.24,1.52],'#654c44');
    for(const z of [-.8,.8])box([bx,.25,bz+z],[3.47,.23,.11],wood);
    for(const x of [-1.66,1.66])box([bx+x,.25,bz],[.10,.23,1.64],wood);
    for(let j=0;j<2;j++) for(let i=0;i<7;i++) {
      const x=bx-1.32+i*.44,z=bz-.39+j*.76;
      for(let k=0;k<5;k++){
        const a=k*2.4+i, len=(b?.32:.23)+rand()*.10, h=(b?.43:.26)+rand()*.11;
        const dx=Math.cos(a), dz=Math.sin(a);
        const pts=[[x,.28,z],[x+dx*len*.5+dz*.09,.28+h*.65,z+dz*len*.5-dx*.09],[x+dx*len,.28+h,z+dz*len],[x+dx*len*.5-dz*.09,.28+h*.65,z+dz*len*.5+dx*.09],[x+dx*len*.48,.28+h*.82,z+dz*len*.48]];
        skin(pts,[0,1,4,1,2,4,2,3,4,3,0,4],['#68824b','#8f9c49','#647d5b','#a7ae53'][k%4]);
      }
    }
  }
  function panel(x,z,w,h) {
    const angle=1.0, p=(u,vv)=>[x+u,1.05+vv*Math.sin(angle),z-vv*Math.cos(angle)];
    const poly=[p(-w/2,-h/2),p(w/2,-h/2),p(w/2,h/2),p(-w/2,h/2)];
    skin(poly,[0,1,2,0,2,3],'#476c84');
    for(let i=0;i<=8;i++) stroke([p(-w/2+i*w/8,-h/2),p(-w/2+i*w/8,h/2)],'#9aa7a8');
    for(let i=0;i<=6;i++) stroke([p(-w/2,-h/2+i*h/6),p(w/2,-h/2+i*h/6)],'#92a2aa');
    for(let i=0;i<4;i++)post(poly[i],poly[(i+1)%4],.044,'#a6a99d',.044,6);
    for(const d of [-.36,.36]){
      post([x+d*w,.02,z+.55],p(d*w,.2),.05,iron);
      post([x+d*w,.02,z-.65],p(d*w,.2),.05,iron);
    }
  }
  beginPart('solar');
  panel(-3.82,-2.07,1.82,1.42);
  beginPart('solar-east');
  panel(6.95,-1.2,1.78,1.35);
  beginPart('fire');
  const fireX=.75, fireZ=4.62;
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6;
    pebble([fireX+.74*Math.cos(a),.13,fireZ+.61*Math.sin(a)],[.23,.18,.22],['#736a70','#8d8481','#656474'][i%3]);
  }
  for(let i=0;i<5;i++){
    const a=i*2.4;
    post([fireX+.48*Math.cos(a),.13,fireZ+.45*Math.sin(a)],[fireX-.17*Math.cos(a),.52,fireZ-.16*Math.sin(a)],.085,'#624338');
  }
  const flame=makeCampfire(T);
  flame.position.set(fireX,.15,fireZ);
  root.add(flame);
  beginPart('pier');
  // Rail and weathered boards lead out across the southeast shore.
  const firstPierSolid=solids.length, firstPierStroke=strokes.length;
  const pierX=0, pierZ=0;
  for(let i=0;i<23;i++){
    const z=pierZ+i*.38, x=pierX+Math.sin(i*1.8)*.026;
    box([x,.31,z],[1.97+rand()*.13,.16,.37],['#947767','#a3856e','#aa8c75','#92786b'][i%4]);
    for(let g=0;g<2;g++){
      const gx=x-.9+rand()*.8, gz=z-.14+rand()*.24;
      stroke([[gx,.393,gz],[gx+.28,.393,gz+.013],[gx+.53,.393,gz-.008]],'#756358');
    }
    if(i%5===0)for(const side of [-1,1]){
      post([pierX+side*.87,-.96,z],[pierX+side*.87,.62+(side<0?.38:0),z],.10,'#715e54');
      if(side<0&&i<20)stroke([[pierX-.87,.91,z],[pierX-.87,.78,z+.95],[pierX-.87,.91,z+1.90]],'#574a46');
    }
  }
  crate(pierX+.45,pierZ+6.95,.65,.62);
  // The landing widens into a tie-up berth with twin flotation pontoons.
  for(let i=0;i<8;i++)box([1.79,.31,5.73+i*.37],[1.59,.16,.355],i%2?'#997c68':'#b09880');
  for(const x of [1.2,2.39])post([x,-.15,5.48],[x,-.15,8.83],.23,'#85979a',.23,12);
  for(const x of [1.14,2.48])for(const z of [5.78,8.23])post([x,.38,z],[x,1.93,z],.043,iron);
  const cover=[[.91,1.87,5.58],[2.70,1.74,5.58],[2.70,1.74,8.43],[.91,1.87,8.43]];
  skin(cover,[0,2,1,0,3,2],'#dfae59');stroke([...cover,cover[0]]);
  const orientPier = new T.Matrix4().makeRotationY(Math.PI/2).setPosition(10.6,0,6.6);
  for(let i=firstPierSolid;i<solids.length;i++)solids[i].applyMatrix4(orientPier);
  for(let i=firstPierStroke;i<strokes.length;i+=3){
    const x=strokes[i];strokes[i]=strokes[i+2]+10.6;strokes[i+2]=6.6-x;
  }

  const paint=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
  // Retain local pigment in shade, as on the ink-and-gouache model sheet.
  paint.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
      'outgoingLight = mix(outgoingLight, diffuseColor.rgb, 0.21);\n#include <opaque_fragment>');
  };
  const lineMaterial = new T.LineBasicMaterial({vertexColors:true, depthWrite:false});
  const parts = separateParts ? marks : [{name:'ensemble', solid:0, line:0}];
  for (let i=0; i<parts.length; i++) {
    const part=parts[i], next=parts[i+1] || {solid:solids.length, line:strokes.length};
    const group=new T.Group();
    group.name=part.name;
    root.add(group);
    const mesh=new T.Mesh(mergeGeometries(solids.slice(part.solid,next.solid)),paint);
    mesh.castShadow=true; mesh.receiveShadow=true;
    group.add(mesh);
    if(next.line>part.line) {
      const lines=new T.BufferGeometry();
      lines.setAttribute('position',new T.Float32BufferAttribute(strokes.slice(part.line,next.line),3));
      lines.setAttribute('color',new T.Float32BufferAttribute(strokeColors.slice(part.line,next.line),3));
      group.add(new T.LineSegments(lines,lineMaterial));
    }
    if(part.name==='fire')group.add(flame);
  }
  solids.forEach(g=>g.dispose());
  return time=>updateCampfire(flame,time);
}


