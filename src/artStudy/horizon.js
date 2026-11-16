import * as THREE from 'three';

// Distant shapes share the sky's value range so the playable silhouettes stay dominant.
export function addHorizon(scene) {
 const canvas=document.createElement('canvas');
 canvas.width=2048; canvas.height=768;
 const ctx=canvas.getContext('2d');
 const sky=ctx.createLinearGradient(0,0,0,768);
 sky.addColorStop(0,'#4f89bf'); sky.addColorStop(.67,'#89c5df'); sky.addColorStop(1,'#afd8da');
 ctx.fillStyle=sky; ctx.fillRect(0,0,2048,768);
 function shape(points,color){
  ctx.fillStyle=color;ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
  ctx.closePath();ctx.fill();
 }
 ctx.fillStyle='rgba(200,230,237,.34)';ctx.beginPath();ctx.ellipse(1210,580,79,118,0,0,Math.PI*2);ctx.fill();
 ctx.save();ctx.translate(1210,580);ctx.rotate(-.35);ctx.strokeStyle='#badde279';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,232,24,0,0,Math.PI*2);ctx.stroke();ctx.restore();
 let seed=4678;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<19;i++){
  const x=random()*2048,y=410+random()*315,w=50+random()*190;
  const p=[[x,y]];
  for(let j=1;j<12;j++)p.push([x+w*j/12,y-Math.sin(j*Math.PI/12)*(3+random()*13)]);
  p.push([x+w,y],[x+w*.58,y+4],[x+w*.23,y+2]);shape(p,'rgba(233,246,239,.68)');
 }
 for(let i=0;i<8;i++){
  const x=random()*2048,y=689+random()*61,w=9+random()*32;
  shape([[x-w,y],[x-w*.78,y-4],[x-w*.68,y-18],[x-w*.52,y-19],[x-w*.5,y-5],[x,y-7],[x+w*.12,y-29],[x+w*.22,y-30],[x+w*.26,y-8],[x+w,y-3],[x+w*.82,y+10],[x+w*.43,y+12],[x+w*.18,y+31],[x+w*.05,y+17],[x-w*.4,y+44],[x-w*.55,y+12]],'#78a9c490');
 }
 // An eroded floating stack with offset terraces interrupts the low horizon.
 shape([[658,675],[667,670],[670,624],[674,622],[675,662],[680,659],[686,595],[690,596],[691,648],[698,643],[701,613],[706,612],[707,652],[718,649],[722,671],[731,674],[726,685],[723,685],[716,718],[713,694],[708,705],[704,743],[700,713],[695,719],[691,752],[688,716],[684,723],[680,696],[673,709],[672,691],[662,687]],'#71a4c3');
 shape([[687,595],[690,596],[691,648],[697,645],[690,666],[685,668]],'#8fbad0');
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(86,22),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
 scene.add(backdrop);
 const plane=new THREE.Plane(),ray=new THREE.Raycaster();
 const forward=new THREE.Vector3(),normal=new THREE.Vector3(),right=new THREE.Vector3();
 const origin=new THREE.Vector3(),center=new THREE.Vector3(),crossing=new THREE.Vector3();
 const corners=[new THREE.Vector2(-1,1),new THREE.Vector2(1,1),new THREE.Vector2(-1,-1),new THREE.Vector2(1,-1)];
 return (camera,target)=>{
  // The director's camera can turn independently of OrbitControls.target.
  scene.getWorldPosition(origin);camera.getWorldDirection(forward);
  normal.set(-forward.x,0,-forward.z);
  if(normal.lengthSq()<.000001)normal.set(camera.position.x-target.x,0,camera.position.z-target.z);
  normal.normalize();right.set(normal.z,0,-normal.x);
  const inland=(target.x-origin.x)*normal.x+(target.z-origin.z)*normal.z;
  const distance=Math.max(33,inland+34);
  center.set(target.x-distance*normal.x,origin.y-.08,target.z-distance*normal.z);
  plane.setFromNormalAndCoplanarPoint(normal,center);
  let scale=1;
  for(const uv of corners){
   ray.setFromCamera(uv,camera);
   if(!ray.ray.intersectPlane(plane,crossing)||crossing.y<center.y)continue;
   crossing.sub(center);
   scale=Math.max(scale,Math.abs(crossing.dot(right))/43*1.025,crossing.y/22*1.025);
  }
  backdrop.position.set(center.x-origin.x,-.08+11*scale,center.z-origin.z);
  backdrop.rotation.y=Math.atan2(normal.x,normal.z);
  backdrop.scale.setScalar(scale);
 };
}
