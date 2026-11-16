import {
  BufferGeometry, CatmullRomCurve3, Color, DoubleSide, Float32BufferAttribute,
  Group, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, SphereGeometry, TubeGeometry, Vector3
} from 'three';
import { STAGES } from './stage-data.js';
import { ART_PRESETS } from '../../avatar-schema.js';

const turn = Math.PI * 2;
const mix = (a, b, t) => new Color(a).lerp(new Color(b), t);

// Live cast belongs to the island. Drive detached anchors with the exact actor
// transforms so stage-only wardrobe never changes their hierarchy or materials.
export function createStageCostumeOverlay(actor, stageId, slot = 0) {
  const joints = actor?._rig?.joints;
  if (slot || !STAGES[stageId] || !actor?.appearance || !joints?.Spine2 || !joints.Hips || !actor._head) return null;
  const root = new Group();
  const resources = {geometry: new Set(), material: new Set()};
  const sources = [joints.Spine2, joints.Hips, actor._head];
  const mirrors = sources.map(() => {
    const group = new Group();
    group.matrixAutoUpdate = false;
    root.add(group);
    return group;
  });
  applyStageCostume({
    appearance: actor.appearance, _head: mirrors[2], _resources: resources,
    _rig: {joints: {Spine2: mirrors[0], Hips: mirrors[1], LeftArm: joints.LeftArm}}
  }, stageId);
  function update() {
    for (let i = 0; i < sources.length; i++) mirrors[i].matrix.copy(sources[i].matrixWorld);
    root.updateWorldMatrix(false, true);
  }
  update();
  return {root, update, dispose() {
    for (const item of resources.geometry) item.dispose();
    for (const item of resources.material) item.dispose();
    root.clear();
  }};
}

// Local coordinates follow the island skeleton (+Z toward the actor's gaze).
// Every piece uses the existing untextured actor batch and its stage lighting.
export function applyStageCostume(actor, stageId, slot = 0) {
  if (slot || !STAGES[stageId] || !actor?._rig?.joints || !actor._resources) return;
  const joints = actor._rig.joints;
  if (joints.Spine2.getObjectByName('stage-costume-' + stageId)) return;
  const recipe = STAGES[stageId], look = actor.appearance, resources = actor._resources;
  const R = look.bodyRatio || 1;
  const materials = new Map();
  function part(parent, geometry, color) {
    const pigment = new Color(color), key = pigment.getHexString();
    if (!materials.has(key)) {
      const material = new MeshBasicMaterial({color: pigment, side: DoubleSide});
      materials.set(key, material);
      resources.material.add(material);
    }
    resources.geometry.add(geometry);
    const mesh = new Mesh(geometry, materials.get(key));
    parent.add(mesh);
    return mesh;
  }
  function anchor(parent, name, scale = 1) {
    const group = new Group();
    group.name = name;
    group.scale.setScalar(scale);
    parent.add(group);
    return group;
  }
  const chest = anchor(joints.Spine2, 'stage-costume-' + stageId);
  // All tailoring positions below are measured in neutral body-ratio units.
  chest.scale.y = R;
  function bead(parent, pos, size, color) {
    const mesh = part(parent, new SphereGeometry(1, 12, 8), color);
    mesh.position.set(...pos);
    mesh.scale.set(...size);
    return mesh;
  }
  function stitch(parent, points, color, width) {
    const curve = new CatmullRomCurve3(points.map(p => new Vector3(...p)));
    return part(parent, new TubeGeometry(curve, Math.max(6, points.length * 2), width, 5, false), color);
  }
  function sheet(parent, surface, color, around = 48, rows = 5, reverse = false) {
    const vertices = [], indices = [];
    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j <= around; j++) {
        vertices.push(...surface(j / around, i / rows));
        if (i < rows && j < around) {
          const a = i * (around + 1) + j;
          const b = a + 1, c = a + around + 1, d = c + 1;
          if (reverse) indices.push(a,c,b,b,c,d);
          else indices.push(a,b,c,b,d,c);
        }
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return part(parent, geometry, color);
  }
  function emblem(parent, location, radius, color, motif) {
    const shape = new Shape();
    if (motif === 'moon') {
      shape.moveTo(.46, .93);
      shape.bezierCurveTo(-1.34, 1.10, -1.38, -1.13, .25, -.95);
      shape.quadraticCurveTo(.81, -.91, .98, -.47);
      shape.bezierCurveTo(-.21, -.86, -.71, .43, .46, .93);
    } else if (motif === 'flower') {
      for (let i = 0; i <= 90; i++) {
        const theta = i / 90 * turn;
        const radial = .55 + .38 * Math.cos(5 * theta) - .10 * Math.cos(10 * theta);
        const x = Math.sin(theta) * radial, y = Math.cos(theta) * radial;
        if (i) shape.lineTo(x,y); else shape.moveTo(x,y);
      }
      shape.closePath();
    } else {
      shape.moveTo(0,1); shape.quadraticCurveTo(.13,.16,.7,0);
      shape.quadraticCurveTo(.13,-.12,0,-1); shape.quadraticCurveTo(-.12,-.16,-.7,0);
      shape.quadraticCurveTo(-.12,.18,0,1);
    }
    const mesh = part(parent, new ShapeGeometry(shape, 16), color);
    mesh.position.set(...location); mesh.scale.setScalar(radius);
    return mesh;
  }
  const gold = stageId === 'orb' ? recipe.lights[0].color : mix(recipe.hazeColor, recipe.fx.find(f => f.type === 'petal' || f.type === 'ember')?.color || recipe.rimColor, .7);
  const cream = STAGES.hanami.grade.highTint;
  if (stageId === 'hanami') {
    const blush = recipe.grade.shadowTint, leather = look.hairColor;
    // Double piping follows the sloping crossover placket. The satin sash
    // crosses it in the opposite direction, terminating underneath the satchel.
    stitch(chest,[[-.087,.135,.052],[-.055,.09,.104],[.015,.026,.125],[.096,-.074,.11]],cream,.009);
    stitch(chest,[[.097,.112,.067],[.080,.078,.11],[.026,.012,.133],[-.091,-.106,.106]],blush,.015);
    const belt = (u,v) => {
      const a = u * turn;
      const shoulder = (joints.LeftArm?.position.x || .058) + (look.artStyle === 'anime' ? .08 : .095);
      return [Math.sin(a) * (shoulder * .75 + .006),-.27 + v * .072 + .01 * Math.sin(a),Math.cos(a) * .106];
    };
    sheet(chest,belt,blush);
    sheet(chest,(u,v) => belt(u, .80 + .12*v).map((x,i) => i === 1 ? x : x*1.015),cream,48,1);
    const strap = (u,v) => {
      const x = .113 - u * .272 + (v-.5)*.031;
      const y = .119 - u * .55;
      return [x,y,.071 + .073 * Math.sin(Math.PI * u) + .015 * u];
    };
    sheet(chest,strap,leather,24,1);
    sheet(chest,(u,v) => {const p=strap(u,.18+.12*v); p[2]+=.002; return p;},gold,24,1);
    const hip = anchor(joints.Hips,'stage-flower-satchel');
    hip.scale.y = R;
    const bag = anchor(hip,'satchel');
    bag.position.set(-.16,-.006,.102); bag.rotation.z = -.13; bag.rotation.y = -.35;
    bead(bag,[0,0,0],[.099,.084,.039],leather);
    bead(bag,[0,.018,.018],[.101,.055,.033],mix(leather,blush,.35));
    stitch(bag,[[-.082,.011,.033],[-.043,-.018,.049],[0,-.031,.053],[.049,-.016,.046],[.081,.010,.032]],gold,.0036);
    emblem(bag,[0,-.007,.053],.029,cream,'flower');
    bead(bag,[0,-.007,.055],[.006,.006,.003],gold);
    const pin = anchor(actor._head,'cherry-brooch');
    pin.position.set(.214,.116,.130); pin.rotation.y = .53;
    for(const [x,y,r] of [[0,0,.058],[-.048,.035,.033],[.043,-.022,.029]]) {
      const bloom = emblem(pin,[x,y,.008],r,blush,'flower');
      bloom.rotation.z=x*9;
      emblem(pin,[x,y,.011],r*.76,cream,'flower');
      bead(pin,[x,y,.014],[r*.17,r*.17,.004],gold);
    }
    // Leave the leg silhouette alone on actors wearing trousers.
    if (look.outfit !== 'robe' && look.outfit !== 'dress') return;
    const bottom = look.outfit === 'robe' ? -.72 : -.39;
    const build = look.build || 1;
    const hem = (u,v) => {
      const a = u*turn;
      return [Math.sin(a)*(.253-.011*v)*build,bottom + .086*v,Math.cos(a)*(.152-.006*v)];
    };
    sheet(hip,hem,mix(look.bottomColor,blush,.46));
    sheet(hip,(u,v)=>hem(u,.19+.10*v).map((x,i)=>i===1?x:x*1.01),cream,48,1);
    for(let i=-2;i<=2;i++){
      const a=i*.43, mark=emblem(hip,[.25*Math.sin(a)*build,bottom+.056,.152*Math.cos(a)],.014,i%2?blush:cream,'flower');
      mark.rotation.y=a;
    }
  } else if (stageId === 'cabin') {
    const yarn = mix(recipe.stops[0].color,recipe.fx[0].color,.42);
    const dark = mix(recipe.grade.shadowTint,recipe.stops[0].color,.32);
    const oat = mix(cream,recipe.hazeColor,.65);
    // Soft double cowl with a long loose end. Knit ribs are low relief; the
    // chevron borders stay recognizable when the actor is framed waist-up.
    const cowl = (u,v) => {
      const a=u*turn, radius=.127 + .031*Math.sin(Math.PI*v);
      return [Math.sin(a)*radius,.048+.113*v-.022*Math.cos(a)-.025*Math.sin(a),Math.cos(a)*radius*.87];
    };
    sheet(chest,cowl,yarn);
    for(const [start,width,col] of [[.18,.075,dark],[.70,.045,oat],[.82,.08,dark]]){
      sheet(chest,(u,v)=>cowl(u,start+width*v).map((x,i)=>i===1?x:x*1.015),col,48,1);
    }
    const tail = (u,v) => {
      const w=.092+.014*v;
      return [-.061+.064*v+(u-.5)*w,.072-.329*v-.015*Math.cos(Math.PI*u),.145+.016*Math.sin(v*Math.PI)+.004*Math.sin(u*Math.PI*6)];
    };
    sheet(chest,tail,yarn,10,14,true);
    for(const [start,width,col] of [[.66,.035,oat],[.71,.055,dark],[.84,.055,oat]]){
      sheet(chest,(u,v)=>{const p=tail(u,start+width*v+.028*Math.abs((u*4)%2-1));p[2]+=.003;return p;},col,20,1,true);
    }
    for(let i=0;i<9;i++){
      const p=tail(i/8,1);
      stitch(chest,[p,[p[0]+.004,p[1]-.011,p[2]],[p[0]-.004,p[1]-.029+(i%3)*.003,p[2]+.003]],i%3?yarn:oat,.0033);
    }
    bead(chest,[.043,.035,.123],[.026,.027,.011],dark);
    emblem(chest,[.043,.035,.136],.023,gold,'star');

    // Hand-sewn mushroom cap. The lamellae radiate from its inner lining;
    // patches sit tangentially on the dome and follow its asymmetric slouch.
    const hat = anchor(actor._head,'forager-cap');
    hat.position.set(-.022,.180,-.013);
    hat.rotation.z=.105;
    const berry = mix(STAGES.orb.stops[2].color, STAGES.hanami.grade.shadowTint, .23);
    const lining = mix(oat, STAGES.hanami.grade.shadowTint, .31);
    const moss = ART_PRESETS.find(p => p.name === '林间信使').values.topColor;
    const dome=(u,v)=>{
      const a=u*turn, phi=v*Math.PI/2, ring=Math.sin(phi);
      const fold=.013*Math.cos(7*a+.5)*ring*ring;
      return [Math.sin(a)*(.308+fold)*ring-.088*Math.cos(phi),.238*Math.cos(phi)+.029*Math.sin(a)*ring,Math.cos(a)*(.267+fold)*ring];
    };
    sheet(hat,dome,berry,64,14,true);
    const underside=(u,v)=>{
      const a=u*turn, edge=dome(u,1);
      return [Math.sin(a)*.210*(1-v)+edge[0]*v,-.020*(1-v)+edge[1]*v-.016*Math.sin(Math.PI*v), Math.cos(a)*.195*(1-v)+edge[2]*v];
    };
    sheet(hat,underside,lining,64,5);
    for(let i=0;i<26;i++){
      const u=i/26;
      stitch(hat,[underside(u,.06),underside(u,.44),underside(u,.88)].map(p=>[p[0],p[1]-.002,p[2]]),oat,.0024);
    }
    stitch(hat,Array.from({length:61},(_,i)=>dome(i/60,1)),dark,.0075);
    // Broken stitches make the brim read as sewn fabric instead of porcelain.
    for(let i=0;i<25;i++){
      const uv=i/25, pts=[0,.22,.46].map(n=>dome(uv+n/25,.96));
      stitch(hat,pts,cream,.0029);
    }
    for(const [u,v,rx,ry] of [[.02,.52,.033,.024],[.15,.74,.041,.030],[.24,.40,.025,.021],[-.13,.70,.047,.031],[-.23,.43,.029,.021],[.34,.78,.030,.026],[.48,.52,.034,.024],[-.37,.76,.038,.027],[.02,.82,.018,.013]]){
      const pos = dome(u,v), normal = new Vector3(Math.sin(u*turn)*Math.sin(v*Math.PI/2),Math.cos(v*Math.PI/2),Math.cos(u*turn)*Math.sin(v*Math.PI/2)).normalize();
      const patch=bead(hat,[pos[0]+normal.x*.003,pos[1]+normal.y*.003,pos[2]+normal.z*.003],[rx,ry,.006],lining);
      patch.quaternion.setFromUnitVectors(new Vector3(0,0,1),normal);
    }
    for(const sign of [-1,1]){
      const ear=bead(hat,[sign*.212,-.094,.035],[.036,.121,.068],berry);
      ear.rotation.z=sign*.19;
      stitch(hat,[[sign*.225,-.021,.084],[sign*.239,-.095,.099],[sign*.231,-.172,.060]],lining,.004);
      bead(hat,[sign*.230,-.201,.046],[.025,.027,.022],oat);
    }
    stitch(hat,[[-.086,.231,-.004],[-.107,.267,-.004],[-.123,.29,0]],moss,.007);
    for(const [x,y,z,r] of [[-.140,.278,.003,.95],[-.086,.276,-.008,-.66]]){
      const leaf=bead(hat,[x,y,z],[.016,.044,.009],moss);
      leaf.rotation.z=r;
    }
  } else if (stageId === 'orb') {
    const midnight = mix(mix(recipe.stops[2].color,look.hairColor,.55),look.hairSecondaryColor,.11);
    const velvet = mix(recipe.stops[2].color,look.topColor,.30);
    const lilac = mix(look.hairSecondaryColor,recipe.glowColor,.30);
    const cape = (u,v) => {
      const a = u*turn, front=.5+.5*Math.cos(a);
      const radius = .083+(.113+.006*Math.cos(9*a))*v;
      return [Math.sin(a)*radius,.153-v*(.25+.075*(1-front)+.032*Math.cos(a*3)),Math.cos(a)*(.083+.065*v)];
    };
    sheet(chest,cape,velvet,64,9,true);
    for(const [start,width,col] of [[.09,.08,midnight],[.72,.12,midnight],[.88,.03,gold],[.97,.03,lilac]]){
      sheet(chest,(u,v)=>cape(u,start+width*v).map((x,i)=>i===1?x:x*1.017),col,64,2,true);
    }
    for(let i=-3;i<=3;i++){
      const u=i/17, p=cape(u,.55), a=u*turn;
      p[0]*=1.03;p[2]*=1.04;
      const moon=emblem(chest,p,i===0?.035:.015,i%2?lilac:gold,i%2?'star':'moon');
      moon.rotation.y=a;
    }
    const hood=anchor(actor._head,'moon-hood');
    // Open horseshoe arc; its front rim sits outside the original facial oval.
    const drape=(u,v)=>{
      const a=.86 + u*(turn-1.72), r=.226+.068*Math.sin(v*Math.PI);
      return [Math.sin(a)*r,.282-.60*v+.019*Math.cos(a*4)*v,Math.cos(a)*r*.97-.034-.015*v];
    };
    sheet(hood,drape,midnight,56,12,true);
    for (const u of [0,1]){
      const points=Array.from({length:14},(_,i)=>drape(u,i/13));
      stitch(hood,points,lilac,.011);
      stitch(hood,points.map(p=>[p[0]*1.025,p[1],p[2]-.003]),gold,.0038);
    }
    const crown=(u,v)=>{
      const a=u*turn, p=v*Math.PI/2, r=.238*Math.sin(p);
      return [Math.sin(a)*r,.258+.129*Math.cos(p),Math.cos(a)*r*.95-.008];
    };
    sheet(hood,crown,midnight,36,7,true);
    stitch(hood,Array.from({length:25},(_,i)=>crown((i/24-.5)*.40,1)),velvet,.008);
    emblem(hood,[0,.274,.220],.033,gold,'moon');
  }
}
