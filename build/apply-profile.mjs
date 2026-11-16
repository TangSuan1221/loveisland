import fs from 'node:fs';
const file='src/avatar-model.js';let s=fs.readFileSync(file,'utf8');
function edit(a,b){if(!s.includes(a))throw Error(a);s=s.replace(a,b)}
edit(' const scale=FACE_SCALES[shape]', ' const latitude=y,longitudeDepth=z;\n const scale=FACE_SCALES[shape]');
edit(' // A compact, front-only',` if(a && a.artStyle!=='anime'){
  // Elliptical cross-sections move forward at the chin and back at the occiput.
  // Skin, eyes, brows, paint and the hairline all sample this surface.
  const radius=Math.sqrt(Math.max(0,1-latitude*latitude));
  const angular=radius>1e-5?THREE.MathUtils.clamp(longitudeDepth/radius,-1,1):0;
  const jaw=Math.exp(-(((latitude+.73)/.24)**2));
  const occiput=Math.exp(-(((latitude-.15)/.55)**2));
  const center=-.024+.105*Math.max(0,-latitude)**1.65;
  const extent=angular>=0?.232+.014*jaw:.286+.031*occiput-.055*jaw;
  const orbital=.011*Math.exp(-(((latitude-.12)/.16)**2)-(((Math.abs(x)-.39)/.22)**2));
  point[2]=(center+radius*angular*extent-Math.max(0,angular)*orbital)*scale[2];
 }
 // A compact, front-only`);
edit(' const R=a.bodyRatio,shoulder=.24*a.shoulderWidth*a.build,hip=.86*R;',` const R=a.bodyRatio;
 const standard=a.artStyle!=='anime';
 const heads=({lin:4.8,qiao:4.8,tang:4.8,yao:4.8,song:4.8,ning:4.8,lu:5.1})[data.avatarId||data.id]??5;
 const chin=1.50*R,hh=(chin-.005*R)/(heads-1),hw=.72*hh;
 if(standard){
  const top=faceSurfacePoint(a.faceShape,0,1,0,a)[1],bottom=faceSurfacePoint(a.faceShape,0,-1,0,a)[1];
  const halfWidth=faceSurfacePoint(a.faceShape,1,0,0,a)[0];
  head.scale.set(hw/(2*halfWidth)*a.faceWidth,hh/(top-bottom)*a.faceHeight,hw/.51*1.10).multiplyScalar(a.headScale);
  head.position.y=chin-bottom*head.scale.y;
 }
 const shoulder=standard?hw*.53*a.shoulderWidth*a.build:.24*a.shoulderWidth*a.build,hip=.86*R;
 const torsoWidth=standard?shoulder/.24:1;`);
edit('[[hip,.17*a.build,.105],[1.02*R,.16*a.build,.105],[1.30*R,shoulder*.92,.115]', '[[hip,.17*a.build*torsoWidth,.105],[1.02*R,.16*a.build*torsoWidth,.095],[1.30*R,shoulder*.92,standard?shoulder*.69:.115]');
s=s.replaceAll('.17*a.build,.105','.17*a.build*torsoWidth,.105').replaceAll('.16*a.build,.10','.16*a.build*torsoWidth,.10');
edit("side*.095*a.build,hip","side*(standard?.071:.095)*a.build,hip");
edit("side*(shoulder-.02),1.37*R","side*(shoulder-(standard?.035:.02)),1.37*R");
edit('const geo=own(new THREE.BufferGeometry());geo.setAttribute', 'const geo=own(new THREE.BufferGeometry());geo.setAttribute'); 
edit('const g=own(new THREE.BufferGeometry());g.setAttribute',`if(standard&&['sleeve','forearm','leg-contour'].includes(name)){
   const factor=name==='leg-contour'?.83:.73;
   for(let i=0;i<pos.length;i+=3){pos[i]*=factor;pos[i+2]*=factor;}
  }
  const g=own(new THREE.BufferGeometry());g.setAttribute`);
edit(" const face=group(head,'face');",` if(standard)for(const side of [-1,1]){
  const ear=mesh(head,a.skinColor,[side*.246,-.019,-.043],[.047,.060,.034]);ear.name='outer-ear';
  const fold=mesh(head,new THREE.Color(a.skinColor).multiplyScalar(.82),[side*.284,-.016,-.039],[.012,.032,.019]);fold.name='ear-fold';
 }
 const face=group(head,'face');`);
edit('.035*bridge]', '.058*bridge]');
fs.writeFileSync(file,s);
