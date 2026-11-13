import * as THREE from 'three';
import {makeCustomActor,disposeCustomActor} from './avatar-model.js';
import {appearanceForCandidate,normalizeAppearance} from './avatar-schema.js';

// Original, hand-built island cast. Geometry and materials are shared across actors.
const sphere = new THREE.SphereGeometry(1, 20, 14);
const cap = new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.54);
const propBox = new THREE.BoxGeometry(1, 1, 1);
// Original presentation habits, not a reconstruction of Nintendo's unlockable quirk system.
const DEFAULT_QUIRKS = { lin: 'wave', zhou: 'weather', qiao: 'hum', lu: 'think', tang: 'sway', chen: 'curious-step' };
const QUIRK_NAMES = { '见面先挥手': 'wave', '先看看天气': 'weather', '随口哼旋律': 'hum', '先听再说': 'think', '想分享点心': 'sway', '留意新角度': 'curious-step' };
const materials = new Map();
const fabricPixels = new Uint8Array(32 * 32 * 4);
for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
  const i = (y * 32 + x) * 4;
  const value = 241 + ((x % 4 === 0 || y % 4 === 0) ? 0 : 10) + ((x * 13 + y * 7) % 4);
  fabricPixels[i] = fabricPixels[i + 1] = fabricPixels[i + 2] = value;
  fabricPixels[i + 3] = 255;
}
const fabricTexture = new THREE.DataTexture(fabricPixels, 32, 32);
fabricTexture.wrapS = fabricTexture.wrapT = THREE.RepeatWrapping;
fabricTexture.repeat.set(5, 5);
fabricTexture.needsUpdate = true;
function cloth(color) {
  const key = `cloth:${color}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, map: fabricTexture, roughness: 0.95 }));
  return materials.get(key);
}
// One continuous open-front bob surface, rather than separate spherical side locks.
function hairBackGeometry() {
  const vertices = [], uvs = [], indices = [];
  const columns = 30, rows = 10;
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const angle = 0.93 + u * (Math.PI * 2 - 1.86);
      const radius = 0.249 + Math.sin(v * Math.PI) * 0.018 - v * v * 0.006;
      vertices.push(Math.sin(angle) * radius, 0.12 - v * 0.37 + Math.cos(angle * 5) * 0.004 * v, Math.cos(angle) * radius * 0.94 - 0.015);
      uvs.push(u, v);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
const bobGeometry = hairBackGeometry();
function sweptFringe(parent, color, mirrored = false) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.235, 0.12);
  shape.bezierCurveTo(-0.21, 0.31, 0.14, 0.32, 0.24, 0.12);
  shape.bezierCurveTo(0.19, 0.14, 0.11, 0.10, 0.045, 0.08);
  shape.bezierCurveTo(-0.03, 0.06, -0.10, 0.075, -0.15, 0.12);
  shape.bezierCurveTo(-0.19, 0.08, -0.20, 0.025, -0.23, -0.005);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.018, bevelThickness: 0.018, curveSegments: 12 });
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.z = 0.174;
  if (mirrored) mesh.scale.x = -1;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function material(color, roughness = 0.78) {
  const key = `${color?.isColor ? color.getHexString() : color}:${roughness}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return materials.get(key);
}
function form(parent, color, position, scale, geometry = sphere) {
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function curve(parent, points, color, radius = 0.012) {
  const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, 10, radius, 5, false), material(color));
  parent.add(mesh);
  return mesh;
}
const shirtGeometry = new THREE.LatheGeometry([
  new THREE.Vector2(0.14, 0), new THREE.Vector2(0.19, 0.025),
  new THREE.Vector2(0.205, 0.11), new THREE.Vector2(0.185, 0.29),
  new THREE.Vector2(0.145, 0.34), new THREE.Vector2(0.08, 0.36),
], 20);
const skirtGeometry = new THREE.LatheGeometry([
  new THREE.Vector2(0.23, 0), new THREE.Vector2(0.235, 0.03),
  new THREE.Vector2(0.20, 0.15), new THREE.Vector2(0.15, 0.25),
], 20);
const sleeveGeometry = new THREE.LatheGeometry([
  new THREE.Vector2(0.062, -0.145), new THREE.Vector2(0.068, -0.13),
  new THREE.Vector2(0.073, -0.075), new THREE.Vector2(0.070, -0.015),
  new THREE.Vector2(0.054, 0.025), new THREE.Vector2(0.018, 0.042),
  new THREE.Vector2(0, 0.044),
], 16);
const cuffGeometry = new THREE.TorusGeometry(0.062, 0.007, 6, 18);
const CAST = [
  { id: 'lin', name: '林夏', role: '气氛担当', color: '#e88966', skin: '#f4c6a0', hair: '#583d31', pants: '#f1dfb6', style: 'bob', anchor: [-3, 1], description: '总想把每个人拉进合照。珊瑚色上衣和一枚小花发夹，是她的岛上标记。' },
  { id: 'zhou', name: '周屿', role: '户外玩家', color: '#648e77', skin: '#dca984', hair: '#302e2b', pants: '#d5c3a1', style: 'crop', anchor: [-1, 2], description: '习惯先看看天气，再决定今天的计划。随身斜挎包里似乎什么都有。' },
  { id: 'qiao', name: '乔乔', role: '创作歌手', color: '#c49cd4', skin: '#f3c7aa', hair: '#6b4838', pants: '#ece3d2', style: 'bun', anchor: [1, 0], description: '脑海里总有新的旋律。紫色背心、圆耳环和高丸子头让她在人群中很好认。' },
  { id: 'lu', name: '陆知', role: '理性观察员', color: '#77a8bf', skin: '#efc39f', hair: '#3c3534', pants: '#56687a', style: 'side', anchor: [3, 2], description: '话不多，却记得所有人的小习惯。眼镜后面的目光，总比镜头多看一步。' },
  { id: 'tang', name: '唐米', role: '甜点主理人', color: '#e4bb60', skin: '#edb68f', hair: '#92583a', pants: '#8ea99a', style: 'braids', anchor: [-2, 4], description: '愿意用一份甜点交换一个故事。双辫子和薄荷色半裙带来轻快的好心情。' },
  { id: 'chen', name: '陈野', role: '自由摄影师', color: '#df8177', skin: '#bd8c6d', hair: '#322b29', pants: '#738989', style: 'curls', anchor: [2, 4], description: '喜欢寻找没人注意到的角度。米色遮阳帽下，是对这座岛永远不减的好奇。' },
  {id:'yao',color:'#aa547b',skin:'#edbfa0',hair:'#392d3c',pants:'#dfcbb8',style:'ponytail',anchor:[0,0]},
  {id:'xu',color:'#344d73',skin:'#d6a07e',hair:'#a79c8c',pants:'#c6b49c',style:'quiff',anchor:[0,0]},
  {id:'song',color:'#e19845',skin:'#bb8568',hair:'#342d28',pants:'#496c70',style:'afro',anchor:[0,0]},
  {id:'he',color:'#437d86',skin:'#f0c9ad',hair:'#2f3439',pants:'#ece1c9',style:'long',anchor:[0,0]},
  {id:'ning',color:'#925f49',skin:'#e1b28c',hair:'#714a36',pants:'#484e64',style:'beanie',anchor:[0,0]},
  {id:'bai',color:'#d6d3e4',skin:'#c99379',hair:'#bba785',pants:'#6b5681',style:'twintop',anchor:[0,0]},
];

function makeActor(data, index, groundY) {
  if(data.appearance)return makeCustomActor(data,index,groundY);
  const root = new THREE.Group();
  root.name = `cast-${data.id}`;
  root.position.set(data.anchor[0], groundY, data.anchor[1]);
  const body = new THREE.Group();
  root.add(body);
  const torso = new THREE.Mesh(shirtGeometry, cloth(data.color));
  torso.position.y = 0.53;
  torso.scale.z = 0.78;
  torso.castShadow = true;
  body.add(torso);
  // Rolled hem, a chest pocket and topstitching give the garment a tailored front.
  curve(body, [[-0.155, 0.575, 0.086], [-0.09, 0.565, 0.139], [0, 0.56, 0.154], [0.09, 0.565, 0.139], [0.155, 0.575, 0.086]], data.color, 0.008);
  const pocketShape = new THREE.Shape();
  pocketShape.moveTo(0, 0); pocketShape.lineTo(0.065, 0); pocketShape.lineTo(0.061, -0.065); pocketShape.lineTo(0.032, -0.078); pocketShape.lineTo(0.004, -0.065); pocketShape.closePath();
  const pocket = new THREE.Mesh(new THREE.ShapeGeometry(pocketShape), cloth(data.color));
  pocket.position.set(0.055, 0.765, 0.148);
  body.add(pocket);
  curve(body, [[0.059, 0.763, 0.151], [0.061, 0.705, 0.151], [0.087, 0.693, 0.151], [0.113, 0.705, 0.151], [0.117, 0.763, 0.151]], '#e9dcc5', 0.0025);
  form(body, data.skin, [0, 0.91, 0], [0.075, 0.09, 0.07]);
  // Rounded collar and fabric front establish a silhouette beyond a cylinder.
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.079, 0.012, 8, 24), material('#f5ecd9'));
  collar.position.set(0, 0.886, 0);
  collar.rotation.x = Math.PI / 2;
  collar.scale.y = 0.86;
  body.add(collar);
  // Subtle tension folds follow the actual garment silhouette.
  for (const side of [-1, 1]) {
    curve(body, [[side * 0.166, 0.79, 0.071], [side * 0.147, 0.75, 0.100], [side * 0.153, 0.71, 0.097]], data.color, 0.008);
    curve(body, [[side * 0.145, 0.59, 0.092], [side * 0.117, 0.61, 0.122], [side * 0.094, 0.613, 0.136]], data.color, 0.006);
  }
  if (data.style === 'braids') {
    const skirt = new THREE.Mesh(skirtGeometry, cloth(data.pants));
    skirt.position.y = 0.36;
    skirt.scale.z = 0.83;
    skirt.castShadow = true;
    body.add(skirt);
  } else {
    form(body, data.pants, [0, 0.51, 0], [0.18, 0.12, 0.13]);
  }
  const legs = [];
  const arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.09, 0.47, 0);
    body.add(leg);
    form(leg, data.style === 'braids' ? data.skin : data.pants, [0, -0.14, 0], [0.074, 0.18, 0.074]);
    form(leg, data.skin, [0, -0.29, 0], [0.055, 0.09, 0.056]);
    form(leg, '#f6f0dd', [0, -0.39, 0.035], [0.085, 0.065, 0.13]);
    form(leg, '#d3cbb7', [0, -0.425, 0.035], [0.085, 0.025, 0.128]);
    form(leg, data.color, [0, -0.36, 0.067], [0.055, 0.017, 0.045]);
    legs.push(leg);
    const arm = new THREE.Group();
    arm.position.set(side * 0.18, 0.81, 0);
    arm.rotation.z = side * 0.13;
    body.add(arm);
    const sleeve = new THREE.Mesh(sleeveGeometry, cloth(data.color));
    sleeve.position.x = side * 0.012;
    sleeve.scale.z = 1.08;
    sleeve.castShadow = true;
    arm.add(sleeve);
    const cuff = new THREE.Mesh(cuffGeometry, cloth(data.color));
    cuff.rotation.x = Math.PI / 2;
    cuff.position.set(side * 0.012, -0.139, 0);
    arm.add(cuff);
    form(arm, data.skin, [side * 0.024, -0.215, 0], [0.052, 0.105, 0.053]);
    form(arm, data.skin, [side * 0.04, -0.315, 0.005], [0.064, 0.073, 0.062]);
    form(arm, data.skin, [side * 0.008, -0.295, 0.045], [0.023, 0.042, 0.027]);
    arms.push(arm);
  }
  const head = new THREE.Group();
  head.position.y = 1.17;
  body.add(head);
  form(head, data.skin, [0, 0, 0], [0.255, 0.285, 0.235]);
  const eyes = [];
  const brows = [];
  const expression = ['smile', 'curious', 'smile', 'thoughtful', 'curious', 'thoughtful'][index % 6];
  for (const side of [-1, 1]) {
    form(head, data.skin, [side * 0.25, -0.015, 0], [0.052, 0.077, 0.043]);
    form(head, '#dc9a83', [side * 0.262, -0.015, 0.029], [0.023, 0.037, 0.016]);
    const eye = new THREE.Group();
    eye.position.set(side * 0.093, 0.018, 0.213);
    head.add(eye);
    form(eye, '#f7f1df', [0, 0, 0], [0.047, 0.055, 0.018]);
    form(eye, '#51473b', [-side * 0.002, -0.005, 0.018], [0.024, 0.035, 0.011]);
    form(eye, '#272b28', [-side * 0.002, -0.005, 0.026], [0.013, 0.025, 0.006]);
    form(eye, '#ffffff', [-0.009, 0.014, 0.032], [0.007, 0.009, 0.004]);
    eyes.push(eye);
    form(head, '#e9a08d', [side * 0.15, -0.075, 0.189], [0.042, 0.023, 0.012]);
    const brow = curve(head, [[side * 0.13, 0.105, 0.215], [side * 0.09, 0.116, 0.23], [side * 0.055, 0.108, 0.222]], data.hair, 0.010);
    if (expression === 'curious' && side === 1) { brow.position.y = 0.025; brow.rotation.z = -0.07; }
    if (expression === 'thoughtful') { brow.position.y = -0.012; brow.rotation.z = side * -0.055; }
    brows.push(brow);
  }
  form(head, data.skin, [0, -0.048, 0.238], [0.035, 0.041, 0.045]);
  let mouth;
  if (expression === 'smile') {
    const smileShape = new THREE.Shape();
    smileShape.moveTo(-0.052, 0.008);
    smileShape.quadraticCurveTo(0, -0.004, 0.052, 0.008);
    smileShape.quadraticCurveTo(0.039, -0.035, 0, -0.036);
    smileShape.quadraticCurveTo(-0.039, -0.035, -0.052, 0.008);
    mouth = new THREE.Mesh(new THREE.ShapeGeometry(smileShape, 16), material('#805147'));
    mouth.position.set(0, -0.11, 0.217);
    head.add(mouth);
    form(head, '#fff2de', [0, -0.11, 0.222], [0.037, 0.007, 0.006]);
  } else if (expression === 'curious') {
    mouth = form(head, '#95644f', [0.012, -0.12, 0.219], [0.019, 0.024, 0.006]);
  } else {
    mouth = curve(head, [[-0.037, -0.127, 0.213], [-0.005, -0.119, 0.223], [0.026, -0.122, 0.216]], '#8f6254', 0.007);
  }
  form(head, data.hair, [0, 0.016, -0.01], [0.265, 0.292, 0.247], cap);
  // Fine swept parting ridges sit on the crown, avoiding a smooth helmet silhouette.
  for (let n = 0; n < 4; n++) {
    const angle = -0.8 + n * 0.43;
    const points = [0.22, 0.55, 0.88, 1.18].map(polar => [
      Math.sin(angle + polar * 0.15) * Math.sin(polar) * 0.267,
      0.016 + Math.cos(polar) * 0.295,
      -0.01 + Math.cos(angle + polar * 0.15) * Math.sin(polar) * 0.250,
    ]);
    const strandColor = new THREE.Color(data.hair).lerp(new THREE.Color('#ba9270'), 0.10);
    curve(head, points, strandColor, 0.0035);
  }
  // Distinct sculpted hair silhouettes, all original geometry.
  if (data.style === 'bob') {
    const back = new THREE.Mesh(bobGeometry, material(data.hair));
    back.material = back.material.clone();
    back.material.side = THREE.DoubleSide;
    back.castShadow = true;
    head.add(back);
    sweptFringe(head, data.hair);
    for (const side of [-1, 1]) curve(head, [[side * 0.245, 0.12, 0.01], [side * 0.264, -0.04, -0.005], [side * 0.249, -0.23, -0.007]], '#674738', 0.003);
    for (let n = 0; n < 5; n++) form(head, '#f7d884', [0.225 + Math.cos(n * 1.257) * 0.026, 0.10 + Math.sin(n * 1.257) * 0.026, 0.155], [0.023, 0.023, 0.013]);
    form(head, '#f6f0dc', [0.225, 0.10, 0.17], [0.013, 0.013, 0.01]);
  } else if (data.style === 'bun') {
    form(head, data.hair, [0.01, 0.30, -0.07], [0.13, 0.115, 0.12]);
    form(head, '#e8bf67', [0.01, 0.245, -0.07], [0.12, 0.025, 0.11]);
    for (const side of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.008, 6, 14), material('#e7bb5d'));
      ring.position.set(side * 0.268, -0.105, 0.025);
      head.add(ring);
    }
  } else if (data.style === 'braids') {
    for (const side of [-1, 1]) {
      for (let n = 0; n < 4; n++) form(head, data.hair, [side * (0.205 + n * 0.012), -0.03 - n * 0.075, -0.04], [0.07 - n * 0.006, 0.065, 0.075]);
      form(head, '#f6df91', [side * 0.245, -0.28, -0.035], [0.065, 0.024, 0.055]);
    }
    sweptFringe(head, data.hair, true);
  } else if (data.style === 'curls') {
    for (let n = 0; n < 5; n++) form(head, data.hair, [(n - 2) * 0.085, 0.155 + Math.sin(n) * 0.02, 0.18], [0.066, 0.075, 0.06]);
    form(head, '#e8d6ad', [0, 0.25, 0], [0.31, 0.033, 0.285]);
    form(head, '#e8d6ad', [0, 0.30, -0.015], [0.215, 0.105, 0.20]);
    form(head, '#ab7b54', [0, 0.255, -0.015], [0.219, 0.022, 0.202]);
  } else {
    const fringe = sweptFringe(head, data.hair, data.style === 'side');
    fringe.scale.y = data.style === 'crop' ? 0.76 : 0.90;
    for (let n = 0; n < 3; n++) curve(head, [[-0.14 + n * 0.07, 0.23, 0.20], [-0.09 + n * 0.07, 0.19, 0.233], [-0.045 + n * 0.07, 0.145, 0.224]], '#50433a', 0.0025);
  }
  // Six additional cast silhouettes use original hair and accessory combinations.
  if(data.style==='ponytail'){
    form(head,data.hair,[-.24,.12,-.13],[.10,.17,.11]);form(head,data.hair,[-.29,-.12,-.12],[.09,.23,.10]);
    form(head,'#e8c777',[-.25,.10,-.10],[.10,.025,.11]);
    curve(body,[[-.1,.87,.12],[0,.78,.18],[.1,.87,.12]],'#e2b55f',.008);form(body,'#e7d3a1',[0,.77,.18],[.025,.038,.012]);
  }else if(data.style==='quiff'){
    const quiff=form(head,data.hair,[-.06,.24,.13],[.19,.075,.13]);quiff.rotation.z=.18;
    for(const x of [-.075,.075]){const lapel=form(body,'#e8deca',[x,.81,.13],[.075,.09,.025],propBox);lapel.rotation.z=x>0?-.4:.4;}
    form(body,'#9b6c5b',[0,.79,.165],[.025,.07,.018]);
  }else if(data.style==='afro'){
    for(let i=0;i<13;i++){const a=i*2.4;form(head,data.hair,[Math.sin(a)*.24,.15+Math.cos(a)*.14,-.02],[.105,.11,.12]);}
    curve(head,[[-.29,0,0],[-.29,.24,0],[0,.37,0],[.29,.24,0],[.29,0,0]],'#dfc59b',.025);
    for(const side of [-1,1])form(head,'#496c70',[side*.29,-.02,.015],[.065,.10,.065]);
  }else if(data.style==='long'){
    const back=new THREE.Mesh(bobGeometry,material(data.hair).clone());back.material.side=THREE.DoubleSide;back.scale.set(1,1.5,1.05);back.castShadow=true;head.add(back);for(const side of [-1,1])form(head,data.hair,[side*.235,-.12,-.05],[.045,.22,.09]);
    const clip=form(head,'#c7a35f',[-.23,.12,.15],[.045,.015,.015],propBox);clip.rotation.z=.5;
    form(body,'#eee6cd',[0,.85,.12],[.15,.035,.06]);
  }else if(data.style==='beanie'){
    form(head,'#b4b96d',[0,.25,-.015],[.28,.15,.255]);form(head,'#92975c',[0,.19,-.015],[.282,.045,.257]);
    form(head,'#e9d5ae',[-.12,.20,.225],[.045,.029,.012],propBox);
    curve(body,[[-.12,.88,.09],[0,.85,.17],[.12,.88,.09]],'#d5b28b',.035);form(body,'#d5b28b',[.07,.75,.16],[.04,.13,.025]);
  }else if(data.style==='twintop'){
    for(const side of [-1,1]){form(head,data.hair,[side*.215,.245,-.015],[.12,.125,.12]);form(head,'#9b7bb0',[side*.215,.18,-.015],[.10,.023,.10]);form(head,'#e7cd8a',[side*.27,-.09,.025],[.022,.042,.015]);}
    for(const x of [-.1,.1])curve(body,[[x,.87,.1],[x,.72,.15],[x,.57,.13]],'#6b5681',.017);
  }
  if (data.style === 'side') {
    for (const side of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.067, 0.009, 6, 18), material('#555a56'));
      rim.position.set(side * 0.093, 0.018, 0.251);
      rim.scale.y = 0.87;
      head.add(rim);
    }
    curve(head, [[-0.03, 0.025, 0.25], [0, 0.035, 0.258], [0.03, 0.025, 0.25]], '#555a56', 0.009);
  }
  if (data.style === 'crop' || data.style === 'curls') {
    curve(body, [[-0.13, 0.88, 0.095], [-0.02, 0.71, 0.166], [0.16, 0.54, 0.10]], '#635746', 0.023);
    form(body, data.style === 'crop' ? '#a78a5f' : '#475b59', [0.17, 0.53, 0.11], [0.105, 0.10, 0.06]);
    form(body, '#ded1aa', [0.17, 0.55, 0.168], [0.033, 0.018, 0.008]);
  } else {
    for (const y of [0.67, 0.75]) form(body, '#f5e9ce', [0, y, 0.151], [0.013, 0.013, 0.008]);
  }
  const book = new THREE.Group();
  book.position.set(0, 0.65, 0.30);
  book.rotation.x = -0.30;
  form(book, '#668b78', [0, 0, 0], [0.32, 0.025, 0.20], propBox);
  form(book, '#f6ead4', [0, 0.018, 0], [0.29, 0.018, 0.18], propBox);
  curve(book, [[0, 0.03, -0.08], [0, 0.03, 0], [0, 0.03, 0.08]], '#b6a98d', 0.004);
  book.visible = false;
  body.add(book);
  const snack = form(arms[1], '#d3a362', [0.04, -0.35, 0.035], [0.075, 0.045, 0.065]);
  snack.visible = false;
  const musicNotes=new THREE.Group();musicNotes.name='Singing-only musical gesture';musicNotes.position.set(.40,1.34,.05);body.add(musicNotes);
  for(let n=0;n<2;n++){const x=n*.19,y=n*.14;form(musicNotes,'#a76c35',[x,y,0],[.066,.045,.028]);form(musicNotes,'#a76c35',[x+.048,y+.11,0],[.020,.24,.035],propBox);}
  const beam=form(musicNotes,'#a76c35',[.143,.29,0],[.235,.035,.035],propBox);beam.rotation.z=.64;musicNotes.visible=false;
  const heightScale = [0.98, 1.04, 0.97, 1.06, 0.94, 1.02][index % 6];
  root.scale.setScalar(heightScale);
  root.rotation.y = [0.5, -0.25, 0.5, -0.4, 0.2, -0.35][index % 6];
  root.traverse(object => { if (object.isMesh) object.userData.actorId = data.id; });
  return { ...data, mesh: root, get position() { return root.position; }, get facing() { return root.rotation.y; }, get faceDirection() { return new THREE.Vector3(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y)); }, _body: body, _head: head, _eyes: eyes, _mouth: mouth, _mouthBaseScale: mouth.scale.clone(), _expression: expression, _legs: legs, _arms: arms, _book: book, _snack: snack, _musicNotes: musicNotes, _phase: index * 1.7 };
}

// Standalone original actor for portrait rendering; never mutates the active cast.
export function portraitActor(id,{groundY=0,appearance}={}){
 const original=CAST.find(c=>c.id===id)||CAST[0];
 return makeActor({...original,id,appearance:appearance||appearanceForCandidate(original),anchor:[0,0]},Math.max(0,CAST.indexOf(original)),groundY);
}
export function disposeActor(actor){
 if(actor?._resources){disposeCustomActor(actor);return;}
 // Legacy geometry/material ownership is tracked at construction boundaries below.
 actor?.mesh.removeFromParent();
}

export function createCharacters(scene, { groundY = 0.48 } = {}) {
  const group = new THREE.Group();
  group.name = 'original-island-cast';
  scene.add(group);
  const actors = CAST.slice(0,6).map((data, index) => makeActor({...data,appearance:appearanceForCandidate(data)}, index, groundY));
  actors.forEach(actor => group.add(actor.mesh));
  let paused = false;
  let elapsed = 0;
  let visualElapsed = 0;
  let focusedId = null;
  let simulation = null;
  const focusCamera = new THREE.Vector3();
  return {
    group,
    actors,
    configureCast(candidates) {
      actors.forEach(disposeActor);group.clear();actors.length=0;
      candidates.forEach((candidate,i)=>{const original=CAST.find(c=>c.id===candidate.id)||CAST.find(c=>c.id===candidate.avatarId)||CAST[i%CAST.length];const index=CAST.indexOf(original);const actor=makeActor({...original,...candidate,appearance:appearanceForCandidate({...original,...candidate}),anchor:[(i%3-1)*2,Math.floor(i/3)*2+1]},index,groundY);actors.push(actor);group.add(actor.mesh);});
    },
    updateAppearance(id,appearance) {
      const actor=actors.find(a=>a.id===id);if(!actor)return false;
      const old=actor.mesh,position=old.position.clone(),rotation=old.rotation.clone(),visible=old.visible;
      const replacement=makeActor({...actor,appearance:normalizeAppearance(appearance)},actors.indexOf(actor),groundY);
      replacement.mesh.position.copy(position);replacement.mesh.rotation.copy(rotation);replacement.mesh.visible=visible;
      disposeActor(actor);
      // Preserve actor identity, including readers holding the actors array or this object.
      Object.defineProperties(actor,Object.getOwnPropertyDescriptors(replacement));group.add(actor.mesh);return true;
    },
    // Simulation owns decisions and time. This adapter only presents its current state.
    setSimulation(value) { simulation = value; },
    setPaused(value) { paused = Boolean(value); },
    focusActor(id, cameraPosition) {
      const actor = actors.find(item => item.id === id);
      if (!actor) return false;
      focusedId = id;
      if (cameraPosition?.isVector3) focusCamera.copy(cameraPosition);
      else if (Array.isArray(cameraPosition)) focusCamera.set(...cameraPosition);
      else if (cameraPosition && Number.isFinite(cameraPosition.x)) focusCamera.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
      else focusCamera.copy(actor.mesh.position).add(new THREE.Vector3(3, 2, 5));
      return true;
    },
    clearFocus() { focusedId = null; },
    update(time, dt = 1 / 60) {
      const step = Math.min(Math.max(dt, 0), 0.08);
      visualElapsed += step;
      if (!paused) elapsed += step;
      for (const actor of actors) {
        const phase = actor._phase;
        const state = simulation?.getActor(actor.id);
        const activity = state?.activity || 'idle';
        const gesture = state?.gesture || ({ chatting:'talk', talking:'talk', sharing:'share', arguing:'argue', apologizing:'apologize', reading:'read', resting:'rest', eating:'eat', dancing:'dance', exercising:'exercise' })[activity] || activity;
        const quirkName = state?.quirk || state?.personality?.quirk || DEFAULT_QUIRKS[actor.id];
        const quirk = QUIRK_NAMES[quirkName] || quirkName;
        const quirkiness = Number.isFinite(state?.personality?.quirkiness) ? THREE.MathUtils.clamp(state.personality.quirkiness, 0, 1) : 0.5;
        const attending = state && !['idle', 'waiting', 'observe'].includes(activity);
        // A slow, small ellipse remains inside a 0.6-unit clearance radius.
        const cycle = elapsed * 0.25 + phase;
        const walk = (Math.sin(elapsed * 0.36 + phase) + 1) * 0.5;
        const focused = actor.id === focusedId && !attending;
        const moving = !paused && (state ? Boolean(state.moving) : !focused && walk > 0.40);
        actor._travel = (actor._travel || 0) + (moving ? step * 0.34 : 0);
        const angle = actor._travel + phase;
        actor.mesh.position.x = state && Number.isFinite(state.x) ? state.x : actor.anchor[0] + Math.sin(angle) * 0.38 - Math.sin(phase) * 0.38;
        actor.mesh.position.z = state && Number.isFinite(state.z) ? state.z : actor.anchor[1] + Math.cos(angle) * 0.22 - Math.cos(phase) * 0.22;
        // Clamp wandering around the stated anchor to preserve island clearances.
        const dx = actor.mesh.position.x - actor.anchor[0];
        const dz = actor.mesh.position.z - actor.anchor[1];
        const distance = Math.hypot(dx, dz);
        if (!state && distance > 0.55) {
          actor.mesh.position.x = actor.anchor[0] + dx * 0.55 / distance;
          actor.mesh.position.z = actor.anchor[1] + dz * 0.55 / distance;
        }
        if (focused) {
          const target = Math.atan2(focusCamera.x - actor.mesh.position.x, focusCamera.z - actor.mesh.position.z);
          const difference = Math.atan2(Math.sin(target - actor.mesh.rotation.y), Math.cos(target - actor.mesh.rotation.y));
          actor.mesh.rotation.y += difference * Math.min(step * 7, 1);
        } else if (moving || (state && Number.isFinite(state.facing))) {
          const target = state && Number.isFinite(state.facing) ? state.facing : Math.atan2(Math.cos(angle) * 0.38, -Math.sin(angle) * 0.22);
          const difference = Math.atan2(Math.sin(target - actor.mesh.rotation.y), Math.cos(target - actor.mesh.rotation.y));
          actor.mesh.rotation.y += difference * Math.min(dt * 3, 1);
        }
        const stride = moving ? Math.sin(elapsed * 5.2 + phase) * 0.21 : Math.sin(cycle) * 0.018;
        actor._legs[0].rotation.x = stride;
        actor._legs[1].rotation.x = -stride;
        actor._arms[0].rotation.x = -stride * 0.85;
        actor._arms[1].rotation.x = stride * 0.85;
        actor._arms[0].rotation.z = -0.13;
        actor._arms[1].rotation.z = 0.13;
        if (!moving) {
          if (actor._expression === 'thoughtful') {
            actor._arms[1].rotation.x = -2.05 + Math.sin(visualElapsed * 0.7 + phase) * 0.035;
            actor._arms[1].rotation.z = -0.42;
            actor._arms[0].rotation.x = -0.20;
            actor._arms[0].rotation.z = -0.28;
          } else if (actor._expression === 'curious') {
            actor._arms[0].rotation.x = 0.28;
            actor._arms[1].rotation.x = 0.28;
            actor._arms[0].rotation.z = 0.08;
            actor._arms[1].rotation.z = -0.08;
          } else {
            actor._arms[0].rotation.x = -0.44 + Math.sin(visualElapsed * 1.1 + phase) * 0.06;
            actor._arms[0].rotation.z = -0.32;
            actor._arms[1].rotation.z = 0.20;
          }
        }
        actor._body.position.y = Math.sin(visualElapsed * 2 + phase) * 0.009 + (moving ? Math.abs(stride) * 0.025 : 0);
        actor._head.rotation.z = Math.sin(visualElapsed * 0.65 + phase) * (focused ? 0.018 : 0.035) + (!moving && actor._expression === 'curious' ? 0.095 : 0);
        actor._head.rotation.x = !moving && actor._expression === 'thoughtful' ? 0.055 : 0;
        actor._head.rotation.y = moving || focused ? 0 : Math.sin(visualElapsed * 0.45 + phase) * 0.15;
        actor._body.rotation.set(0, 0, 0);
        actor._legs.forEach(leg => { leg.rotation.z = 0; });
        actor._book.visible = Boolean(state && !moving && gesture === 'read');
        actor._musicNotes.visible = activity === 'sing';
        actor._musicNotes.position.y = (actor._musicNotes.userData.baseY ?? 1.34) + Math.sin(visualElapsed * 3 + phase) * .025;
        actor._snack.visible = Boolean(state && !moving && (gesture === 'eat' || gesture === 'share'));
        if (state && !moving) {
          const pulse = Math.sin(visualElapsed * 3 + phase);
          const left = actor._arms[0], right = actor._arms[1];
          // All poses are modest shoulder rotations, not detached or inverted limbs.
          left.rotation.set(-0.10, 0, -0.13);
          right.rotation.set(-0.10, 0, 0.13);
          actor._head.rotation.y = 0;
          actor._head.rotation.x = 0;
          if (activity === 'sing') {
            actor._head.rotation.x = -.08 + pulse * .035;actor._head.rotation.z = .07 + pulse * .045;
            right.rotation.x = -.65;right.rotation.z = .35 + pulse * .08;left.rotation.x = -.25;
            actor._body.rotation.z = pulse * .025;
          } else if (gesture === 'talk') {
            right.rotation.x = -0.65 + pulse * 0.18;
            right.rotation.z = 0.32;
            left.rotation.x = -0.30;
            actor._head.rotation.x = pulse * 0.035;
          } else if (gesture === 'listen') {
            actor._head.rotation.x = Math.max(0, pulse) * 0.07;
            actor._head.rotation.z = 0.045;
          } else if (gesture === 'share') {
            right.rotation.x = -1.0 + pulse * 0.04;
            right.rotation.z = 0.08;
            left.rotation.x = -0.45;
          } else if (gesture === 'argue') {
            right.rotation.x = -0.85 + pulse * 0.12;
            left.rotation.z = -0.38;
            actor._head.rotation.z = pulse * 0.08;
            actor._body.rotation.x = 0.035;
          } else if (gesture === 'apologize') {
            left.rotation.x = right.rotation.x = -0.45;
            left.rotation.z = 0.12;
            right.rotation.z = -0.12;
            actor._head.rotation.x = 0.20 + pulse * 0.025;
            actor._body.rotation.x = 0.06;
          } else if (gesture === 'wave') {
            right.rotation.x = -2.0;
            right.rotation.z = 0.35 + pulse * 0.18;
          } else if (gesture === 'read') {
            left.rotation.x = right.rotation.x = -1.05;
            left.rotation.z = 0.10;
            right.rotation.z = -0.10;
            actor._head.rotation.x = 0.16;
          } else if (gesture === 'rest') {
            actor._head.rotation.x = 0.12;
            actor._body.position.y -= 0.025;
          } else if (gesture === 'eat') {
            right.rotation.x = -1.4 + Math.max(0, pulse) * -0.55;
            right.rotation.z = -0.12;
            actor._head.rotation.x = Math.max(0, pulse) * 0.05;
          } else if (gesture === 'dance') {
            left.rotation.z = -0.48 + pulse * 0.20;
            right.rotation.z = 0.48 + pulse * 0.20;
            left.rotation.x = right.rotation.x = -0.40;
            actor._body.rotation.z = pulse * 0.065;
            actor._body.position.y += Math.abs(pulse) * 0.035;
            actor._legs[0].rotation.x = pulse * 0.13;
            actor._legs[1].rotation.x = -pulse * 0.13;
          } else if (gesture === 'exercise') {
            left.rotation.z = -0.5 - (pulse + 1) * 0.40;
            right.rotation.z = 0.5 + (pulse + 1) * 0.40;
            actor._body.position.y += (pulse + 1) * 0.012;
          }
        }
        const blinkCycle = (visualElapsed + phase) % (3.8 + phase * 0.13);
        const blink = blinkCycle < 0.16 ? Math.max(0.08, Math.abs(blinkCycle - 0.08) / 0.08) : 1;
        actor._eyes.forEach(eye => { eye.scale.y = (eye.userData.baseScaleY||1) * blink * (actor._expression === 'thoughtful' ? 0.85 : 1); });
        actor._mouth.scale.x = actor._mouthBaseScale.x * (1 + Math.sin(visualElapsed * 0.85 + phase) * 0.035);
        actor._mouth.scale.y = actor._mouthBaseScale.y * (activity === 'sing' ? 1.5 + Math.abs(Math.sin(visualElapsed * 4)) * .25 : state?.speech ? 1.1 + Math.abs(Math.sin(visualElapsed * 9)) * 0.40 : 1);
        if (state && !moving && gesture === 'rest') actor._eyes.forEach(eye => { eye.scale.y *= 0.35; });
        // Habits decorate neutral gaps; dialogue, gifts and activity gestures retain priority.
        const neutral = state && !state.speech && ['idle', 'waiting', 'observe'].includes(activity) && ['idle', 'rest', ''].includes(gesture);
        if (neutral && !moving) {
          const amplitude = 0.25 + quirkiness * 0.75;
          const habitCycle = (visualElapsed + phase * 2.7) % 9;
          const envelope = habitCycle < 3 ? Math.sin(habitCycle / 3 * Math.PI) * amplitude : 0;
          const beat = Math.sin(visualElapsed * 2.6 + phase);
          actor._eyes.forEach(eye => { eye.scale.y = (eye.userData.baseScaleY||1) * blink; });
          if (quirk === 'wave') {
            actor._arms[1].rotation.x -= envelope * 1.6;
            actor._arms[1].rotation.z += envelope * (0.22 + beat * 0.12);
          } else if (quirk === 'weather') {
            actor._head.rotation.x -= envelope * 0.24;
            actor._head.rotation.y += envelope * 0.18;
          } else if (quirk === 'hum') {
            actor._head.rotation.z += beat * amplitude * 0.035;
            actor._body.rotation.z += beat * amplitude * 0.025;
            actor._arms[0].rotation.x -= envelope * 0.22;
          } else if (quirk === 'think') {
            actor._arms[1].rotation.x -= envelope * 1.75;
            actor._arms[1].rotation.z -= envelope * 0.18;
            actor._head.rotation.z += envelope * 0.07;
          } else if (quirk === 'sway') {
            actor._body.rotation.z += beat * amplitude * 0.035;
            actor._arms[0].rotation.x -= envelope * 0.35;
            actor._arms[1].rotation.x -= envelope * 0.35;
          } else if (quirk === 'curious-step') {
            actor._head.rotation.y += envelope * beat * 0.22;
            actor._head.rotation.z += envelope * 0.06;
          }
        }
        if (state && moving && gesture === 'walk') {
          // Render-only footfall variation: never changes world position, speed or route.
          const lift = Math.abs(Math.sin(elapsed * 5.2 + phase));
          if (quirk === 'hum' || quirk === 'curious-step') actor._body.position.y += lift * quirkiness * 0.025;
          if (quirk === 'sway') actor._head.rotation.z += Math.sin(elapsed * 2.6 + phase) * quirkiness * 0.025;
        }
      }
    },
  };
}
