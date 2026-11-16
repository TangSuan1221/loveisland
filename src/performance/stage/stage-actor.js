import {
  Box3, BufferGeometry, Color, DataTexture, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, FloatType,
  Group, Matrix3, Matrix4, Mesh, MultiplyBlending, NearestFilter, OrthographicCamera, PlaneGeometry, Quaternion,
  RGBAFormat, Scene, ShaderMaterial, Shape, Vector2, Vector3, Vector4
} from 'three';
import {portraitActor,disposeActor} from '../../characters.js';
import {applyPose} from '../../action-pose.js';
import {articulate} from '../../humanoid-rig.js';
import {ART_PRESETS,appearanceForCandidate} from '../../avatar-schema.js';
import {sampleActionFace} from '../../action-face.js';
import {placePalm} from '../../chest-contact.js';
import {stagePlateAnchor} from './stage-layers.js';
import {applyStageCostume,createStageCostumeOverlay} from './stage-costume.js';

const vertex = `
uniform highp sampler2D palette;
attribute vec4 joints, weights;
attribute float surface;
attribute vec3 vertexPigment;
varying vec3 nView, base, actorPoint;
varying vec2 texUv;
varying float alpha, sideFlag, surfaceType;
varying vec2 screen;
mat4 pose(float index){
  int i=int(index+.5);
  return mat4(texelFetch(palette,ivec2(0,i),0),texelFetch(palette,ivec2(1,i),0),
              texelFetch(palette,ivec2(2,i),0),texelFetch(palette,ivec2(3,i),0));
}
void main(){
  mat4 transform=pose(joints.x)*weights.x;
  if(weights.y>0.)transform+=pose(joints.y)*weights.y;
  if(weights.z>0.)transform+=pose(joints.z)*weights.z;
  if(weights.w>0.)transform+=pose(joints.w)*weights.w;
  vec4 pigment=texelFetch(palette,ivec2(4,int(surface+.5)),0);
  vec4 flags=texelFetch(palette,ivec2(5,int(surface+.5)),0);
  base=pigment.rgb*vertexPigment; alpha=pigment.a; sideFlag=flags.x; surfaceType=flags.z;
  mat3 localToView=mat3(modelViewMatrix*transform);
  nView=normalize(transpose(inverse(localToView))*normal);
  actorPoint=(transform*vec4(position,1.)).xyz;
  vec4 point=modelViewMatrix*vec4(actorPoint,1.);
  if(flags.y>0.)point.xyz+=nView*flags.y;
  texUv=uv;
  gl_Position=projectionMatrix*point;
  screen=vec2(.5)+vec2(.5,-.5)*gl_Position.xy/gl_Position.w;
  if(alpha<=0.)gl_Position=vec4(2.,2.,2.,1.);
}`;

const fragment = `
uniform vec3 keyColor, fillColor, rimColor, bounceColor, ambientColor;
uniform vec3 keyDir, fillDir, rimDir, bounceDir;
uniform float softness;
uniform float vision,aspect,sphereRadius;
uniform vec2 sphereCenter;
uniform vec3 headCenter,leftHand,rightHand;
varying vec2 screen;
varying vec3 nView, base, actorPoint;
varying vec2 texUv;
varying float alpha,sideFlag,surfaceType;
#ifdef PAINT_MAP
uniform sampler2D paintMap;
#endif
float contactShade(vec3 delta){
  return exp(-dot(delta.xy*vec2(11.,10.),delta.xy*vec2(11.,10.)))
         *smoothstep(.012,.055,delta.z)*(1.-smoothstep(.05,.28,delta.z));
}
void main(){
  if(alpha<=0. || (sideFlag<.5 && !gl_FrontFacing) || (sideFlag>1.5 && gl_FrontFacing))discard;
  vec4 pigment=vec4(base,alpha);
  #ifdef PAINT_MAP
  pigment*=texture2D(paintMap,texUv);
  #endif
  if(pigment.a<.23)discard;
  vec3 n=normalize(nView);
  if(sideFlag>0.5 && sideFlag<1.5 && !gl_FrontFacing)n=-n;
  float k=dot(n,keyDir);
  float diffuse=.10+.41*smoothstep(-.2-softness*.14,.22,k)+.13*smoothstep(.42,.72,k);
  vec3 light=vec3(.24)+ambientColor*.25+keyColor*diffuse
    +fillColor*(.10+.30*max(0.,dot(n,fillDir)))+bounceColor*.30*max(0.,dot(n,bounceDir));
  float neutral=dot(light,vec3(.30,.52,.18));
  float preserve=(surfaceType==1. || surfaceType==5.)?.62:surfaceType==2.?.86:.28;
  light=mix(light,vec3(neutral),preserve);
  if(surfaceType==2.)light=mix(light,vec3(.70),.56);
  float rim=pow(1.-abs(n.z),2.8)*smoothstep(-.42,.40,dot(n,rimDir));
  vec3 result=pigment.rgb*light*.72+rimColor*rim*.16;
  // Soft local occlusion follows the face and both palms as they move over
  // the collar, cheek or a held prop. Only surfaces behind a palm receive it.
  float under=headCenter.y-actorPoint.y;
  float collar=exp(-dot((actorPoint.xz-headCenter.xz)*4.2,(actorPoint.xz-headCenter.xz)*4.2))
    *smoothstep(.13,.25,under)*(1.-smoothstep(.24,.50,under));
  result*=1.-.24*collar-.13*max(contactShade(leftHand-actorPoint),contactShade(rightHand-actorPoint));
  if(surfaceType==4.){
    vec2 weave=actorPoint.xy*vec2(108.,124.);
    vec2 filtered=clamp(1.-fwidth(weave)*1.7,0.,1.);
    result*=1.+.020*dot(filtered,cos(weave*6.283));
  }
  if(surfaceType==5.){
    float fold=abs(texUv.y-(.12+.41*(texUv.x-.50)*(texUv.x-.50)));
    result*=1.-.18*(1.-smoothstep(.012,.076,fold))*smoothstep(.14,.38,texUv.x)*(1.-smoothstep(.78,1.08,texUv.x));
  }
  float sheen=pow(max(0.,dot(n,normalize(keyDir+vec3(0.,0.,1.)))),surfaceType==3.?9.:19.);
  result+=mix(vec3(neutral),keyColor,.37)*sheen*(surfaceType==3.?.065:.012);
  float outAlpha=0.;
  if(vision>0.){
    vec2 st=(screen-sphereCenter)*vec2(aspect,1.)/sphereRadius;
    float r=length(st);
    if(r>.96)discard;
    float glint=exp(-pow((st.x+st.y*.38+.51)/.09,2.)-pow((st.y+.31)/.60,2.));
    result=mix(result,vec3(dot(result,vec3(.3,.55,.15))),.23)+rimColor*(.018+.04*pow(r,4.)+.22*glint);
    outAlpha=.77*(1.-smoothstep(.70,.96,r));
  }
  gl_FragColor=vec4(result,outAlpha);
}`;

function lighting(def, texture, map) {
  const uniforms={palette:{value:texture},paintMap:{value:map},vision:{value:0},aspect:{value:1},
    sphereRadius:{value:.122},sphereCenter:{value:new Vector2()},
    headCenter:{value:new Vector3()},leftHand:{value:new Vector3()},rightHand:{value:new Vector3()}};
  for(const row of def.lights){
    uniforms[row.role+'Color']={value:new Color(row.color).multiplyScalar(row.intensity)};
    if(row.role!=='ambient')uniforms[row.role+'Dir']={value:new Vector3(row.dx,row.dy,row.dz).normalize()};
    if(row.role==='key')uniforms.softness={value:row.softness};
  }
  return new ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,
    defines:map ? {PAINT_MAP:1} : {},side:DoubleSide});
}

// A single continuous padded contour. The V at the thumb web remains legible
// when the palm is nearly edge-on. The fingers share one rounded distal edge.
function openMitten(){
  const s=new Shape();
  s.moveTo(-.40,.90);
  s.bezierCurveTo(-.63,.83,-.77,.62,-.83,.28);
  s.bezierCurveTo(-.89,-.10,-.81,-.71,-.67,-.97);
  s.bezierCurveTo(-.58,-1.17,-.41,-1.22,-.25,-1.17);
  s.bezierCurveTo(-.07,-1.27,.13,-1.24,.23,-1.14);
  s.bezierCurveTo(.43,-1.16,.60,-1.03,.61,-.83);
  s.bezierCurveTo(.63,-.63,.53,-.34,.47,-.12);
  s.quadraticCurveTo(.46,.025,.60,-.055);
  s.bezierCurveTo(.85,-.23,1.18,-.49,1.40,-.45);
  s.bezierCurveTo(1.67,-.38,1.65,-.13,1.48,.10);
  s.bezierCurveTo(1.24,.41,.85,.61,.57,.76);
  s.quadraticCurveTo(.35,.92,.18,.93);
  s.closePath();
  const g=new ExtrudeGeometry(s,{depth:.85,bevelEnabled:true,bevelThickness:.19,bevelSize:.065,bevelSegments:4,curveSegments:8});
  g.translate(0,0,-.425).rotateY(-Math.PI/2);
  return g;
}

// A palette contains rigid transforms and bone transforms. A second pass over the
// island's hundreds of separate clothing, hair and ink meshes would be too costly.
// Keep their exact triangles and the live skeleton; draw once per source texture.
function batchActor(actor,def,overlay,preview){
  const root=actor.mesh,group=new Group(), entries=[], bones=new Map(),parts=new Map(),listeners=[];
  const skinTone=actor.appearance?.skinColor ? new Color(actor.appearance.skinColor) : null;
  const palm=def.id==='cabin' && actor._rig?.limbs.find(limb=>limb.hand===actor._rig.joints.RightHand)?.palm;
  const openHand=palm ? openMitten() : null;
  let dirty=false;
  const changed=()=>{dirty=true;};
  const addEntry=entry=>{entries.push(entry);return entries.length-1;};
  function paletteBone(skeleton,index){
    const bone=skeleton.bones[index];
    if(!bones.has(bone))bones.set(bone,addEntry({bone,inverse:skeleton.boneInverses[index]}));
    return bones.get(bone);
  }
  const p=new Vector3(), n=new Vector3(), normalBind=new Matrix3(),ids=new Vector4(),weight=new Vector4();
  function append(node,geo,handVariant){
    const materials=Array.isArray(node.material) ? node.material : [node.material];
    for(const [m,mat] of materials.entries()){
      if(!mat)continue;
      const map=mat.map || null;
      if(!parts.has(map))parts.set(map,{p:[],n:[],uv:[],joints:[],weights:[],surface:[],pigment:[],index:[]});
      const part=parts.get(map), offset=part.surface.length;
      let color=mat.color, category=0;
      // Cloned node materials keep their base color in the original uniform.
      // Reading the fallback WebGL .color alone turns authored hair locks white.
      mat.colorNode?.traverse(child=>{if(child.isUniformNode && child.value?.isColor)color=child.value;});
      for(let parent=node;parent && parent!==root;parent=parent.parent){
        if(actor._eyes?.includes(parent) || /^(iris|eye|pupil)/i.test(parent.name)){category=2;break;}
        if(/hair/i.test(parent.name)){category=3;break;}
        if(/outfit|costume|skirt|sleeve/i.test(parent.name)){category=4;break;}
        if(parent===actor._head){category=1;break;}
      }
      if(!category && skinTone && color && color.equals(skinTone))category=1;
      if(handVariant==='open')category=5;
      if(node.userData.isOutline)category=0;
      const slot=addEntry({node,mat,color,category,handVariant});
      const {position,normal,uv,skinIndex,skinWeight,color:rgb}=geo.attributes;
      const skin=node.isSkinnedMesh && skinIndex && skinWeight;
      if(skin)normalBind.getNormalMatrix(node.bindMatrix);
      for(let i=0;i<position.count;i++){
        p.fromBufferAttribute(position,i);
        if(normal)n.fromBufferAttribute(normal,i);else n.set(0,0,1);
        if(skin){
          p.applyMatrix4(node.bindMatrix);n.applyNormalMatrix(normalBind);
          ids.fromBufferAttribute(skinIndex,i);weight.fromBufferAttribute(skinWeight,i);
          for(let k=0;k<4;k++)part.joints.push(weight.getComponent(k)>0 ? paletteBone(node.skeleton,ids.getComponent(k)) : 0);
          part.weights.push(weight.x,weight.y,weight.z,weight.w);
        }else{
          part.joints.push(slot,0,0,0);part.weights.push(1,0,0,0);
        }
        part.p.push(p.x,p.y,p.z);part.n.push(n.x,n.y,n.z);part.surface.push(slot);
        if(rgb && mat.vertexColors)part.pigment.push(rgb.getX(i),rgb.getY(i),rgb.getZ(i));else part.pigment.push(1,1,1);
        if(handVariant==='open')part.uv.push(p.z,p.y);
        else part.uv.push(uv?.getX(i) || 0,uv?.getY(i) || 0);
      }
      const count=geo.index?.count ?? position.count;
      const ranges=materials.length===1 ? [{start:0,count}] : geo.groups.filter(g=>g.materialIndex===m);
      for(const range of ranges){
        for(let i=range.start;i<Math.min(count,range.start+range.count);i++)part.index.push(offset+(geo.index?.getX(i) ?? i));
      }
    }
  }
  for(const tree of overlay ? [root,overlay.root] : [root])tree.traverse(node=>{
    node.addEventListener('childadded',changed);
    node.addEventListener('childremoved',changed);
    listeners.push(node);
    if(!node.isMesh || !node.geometry?.attributes.position || (node.isSkinnedMesh && node.userData.isOutline))return;
    const alternate=openHand && (node===palm || (node.parent===palm && node.userData.isOutline));
    append(node,node.geometry,alternate?'closed':null);
    if(alternate)append(node,openHand,'open');
  });
  openHand?.dispose();
  const stride=24, data=new Float32Array(entries.length*stride);
  const texture=new DataTexture(data,6,entries.length,RGBAFormat,FloatType);
  texture.magFilter=texture.minFilter=NearestFilter;
  for(const [map,part] of parts){
    const geometry=new BufferGeometry();
    for(const [name,values,size] of [['position',part.p,3],['normal',part.n,3],['uv',part.uv,2],
      ['joints',part.joints,4],['weights',part.weights,4],['surface',part.surface,1],['vertexPigment',part.pigment,3]]){
      geometry.setAttribute(name,new Float32BufferAttribute(values,size));
    }
    geometry.setIndex(part.index);
    const mesh=new Mesh(geometry,lighting(def,texture,map));
    mesh.frustumCulled=false;
    mesh.renderOrder=map ? 2 : 1;
    group.add(mesh);
  }
  const inverseRoot=new Matrix4(), relative=new Matrix4();
  const landmarks=[['headCenter',actor._head],['leftHand',actor._rig?.joints.LeftHand],['rightHand',actor._rig?.joints.RightHand]];
  const localCenters=landmarks.map(()=>new Vector3());
  function update(){
    root.updateWorldMatrix(true,true);
    overlay?.update();
    inverseRoot.copy(root.matrixWorld).invert();
    const up=palm ? new Vector3().setFromMatrixColumn(palm.matrixWorld,0).normalize().y : 0;
    const palmOpen=preview || (up>.16 && palm.matrixWorld.elements[13]>actor._rig.joints.Hips.matrixWorld.elements[13]);
    for(const [i,[key,landmark]] of landmarks.entries()){
      const center=localCenters[i];
      if(landmark)center.setFromMatrixPosition(landmark.matrixWorld).applyMatrix4(inverseRoot);
      else center.set(0,-10,0);
      for(const mesh of group.children)mesh.material.uniforms[key].value=center;
    }
    for(const [i,entry] of entries.entries()){
      const {node,bone,inverse,mat,color,category}=entry,offset=i*stride;
      relative.multiplyMatrices(inverseRoot,(bone || node).matrixWorld);
      if(bone)relative.multiply(inverse);
      relative.toArray(data,offset);
      if(!node)continue;
      data[offset+16]=color?.r ?? 1;
      data[offset+17]=color?.g ?? 1;
      data[offset+18]=color?.b ?? 1;
      let visible=mat.visible!==false;
      if(entry.handVariant)visible=visible && (entry.handVariant==='open')===palmOpen;
      for(let parent=node;visible && parent && parent!==root;parent=parent.parent)visible=parent.visible;
      data[offset+19]=visible ? mat.opacity ?? 1 : 0;
      data[offset+20]=mat.side===DoubleSide ? 1 : mat.side===1 ? 2 : 0;
      data[offset+21]=node.userData.isOutline ? .0026*group.scale.x : 0;
      data[offset+22]=category;
    }
    texture.needsUpdate=true;
  }
  return {group,update,get dirty(){return dirty;},dispose(){
    for(const node of listeners){
      node.removeEventListener('childadded',changed);node.removeEventListener('childremoved',changed);
    }
    for(const mesh of group.children){mesh.geometry.dispose();mesh.material.dispose();}
    group.removeFromParent();texture.dispose();overlay?.dispose();
  }};
}

function contactShadow(def){
  const geometry=new PlaneGeometry(1,1);
  const material=new ShaderMaterial({
    uniforms:{shadowTint:{value:new Color(def.stops[0].color).multiplyScalar(.14)}},
    blending:MultiplyBlending,premultipliedAlpha:true,depthTest:false,depthWrite:false,
    vertexShader:'varying vec2 q; void main(){q=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform vec3 shadowTint; varying vec2 q; void main(){float d=dot(q,q);float a=.68*exp(-2.4*d)*(1.-smoothstep(.65,1.,d));gl_FragColor=vec4(mix(vec3(1.),shadowTint,a),1.);}'
  });
  const mesh=new Mesh(geometry,material);
  mesh.renderOrder=-1;
  return mesh;
}

function mark(def,role,count,kind,framing){
  if(framing==='full'){
    const x=count===1 ? (def.id==='cabin' ? .48 : .53) : [.43,.64,.24][role];
    return {visible:true,x,h:def.id==='hanami' ? .54:.5,feet:.89,yaw:count>1 ? (role ? -.77:.67) : (def.id==='cabin' ? -.18:.19)};
  }
  const oracle=def.id==='orb';
  const face=kind==='faceT'?1:kind==='faceA'?2:kind==='faceF'?0:-1;
  if(face>=0)return {visible:role===Math.min(face,count-1),x:.50,h:1.72,feet:1.83,yaw:role ? -.22 : .22};
  if(kind==='shoulderF'||kind==='shoulderT'){
    const near=kind==='shoulderF'?0:1;
    return role===near ? {visible:true,x:.06,h:1.9,feet:1.98,yaw:2.68,z:1} :
      {visible:role<2,x:.62,h:1.15,feet:1.38,yaw:-.34};
  }
  if(kind==='insert')return {visible:role<2,x:role ? .73:.28,h:1.54,feet:1.45,yaw:role ? -.7:.7};
  if(oracle)return role===0 ? {visible:true,x:.368,h:1.26,feet:1.43,yaw:.59} :
    {visible:role===1,x:.862,h:1.46,feet:1.72,yaw:-2.19,z:1};
  if(count===1)return {visible:true,x:def.actorX,h:def.actorH*(def.id==='cabin'?3.16:1.71),feet:def.id==='cabin'?1.49:.94,yaw:def.id==='cabin' ? -.18:.19};
  const xs=count===2 ? [.36,.64] : [.27,.53,.76];
  return {visible:true,x:xs[role],h:kind==='wide' ? .47:.65,feet:.92,yaw:role===0 ? .57:-.54};
}

const featured={
  hanami:[['lin','林间信使']],cabin:[['zhou','午后漫画家']],orb:[['qiao','月光剧场'],['zhou','旧城歌手']]
};
function stageMouth(actor,name){
  const expression=actor._head.getObjectByName('performance-face');
  for(const form of expression.children)if(form.name.startsWith('mouth-'))form.visible=form.name==='mouth-'+name;
  actor._mouth.visible=false;
}
function performPreview(actor,id,role,t){
  const pose=id==='hanami'?'shy':id==='cabin'?'ask':role?'look':'offer';
  const phase=t%6;
  const eased=v=>{const k=Math.min(1,Math.max(0,v));return k*k*(3-2*k);};
  const gesture=eased((phase+.05)/1.15)*(1-eased((phase-3.40)/1.70));
  applyPose(actor,'idle',pose,.54+.29*gesture,t);articulate(actor,pose,t);
  const j=actor._rig.joints;
  if(id==='hanami'){
    j.Head.rotation.z=-.055-.075*gesture+.015*Math.sin(t*1.1);
    j.Head.rotation.x+=.10;j.LeftFoot.rotation.y=-.19;j.RightFoot.rotation.y=.22;
    const chest=j.Spine2;
    const target=chest.worldToLocal(actor._mouth.getWorldPosition(new Vector3()));
    target.x+=.127;target.y-=.046;target.z+=.018;
    target.lerp(new Vector3(.08,.015,.18),1-gesture);
    placePalm(actor,'Left',target,new Vector3(-.45,.9,.15));
    placePalm(actor,'Right',new Vector3(-.042,.046,.155),new Vector3(.65,.7,.15));
    sampleActionFace(actor,57,t,{mood:'tender',blush:true,closed:gesture>.64});
  }else if(id==='cabin'){
    j.Head.rotation.x+=.12;j.Head.rotation.z=.11;j.Spine2.rotation.z=-.10;j.Spine.rotation.x+=.095;
    const temple=j.Spine2.worldToLocal(actor._eyes[0].getWorldPosition(new Vector3()));
    temple.x=Math.abs(temple.x)+.116;temple.y+=.01;temple.z-=.005;
    temple.lerp(new Vector3(.20,-.17,.245),1-gesture);
    placePalm(actor,'Left',temple,new Vector3(-.32,.88,.15));
    placePalm(actor,'Right',new Vector3(-.30-.12*gesture,-.14+.055*gesture,.24),new Vector3(0,.45,.86));
    // Supinate the forearm. The existing mitten and its fixed wrist socket
    // turn together; the palm's broad Y/Z plane now opens to the listener.
    const fore=j.RightForeArm;
    const palmNormal=new Vector3(0,.83,.48).applyQuaternion(j.Spine2.getWorldQuaternion(new Quaternion()))
      .applyQuaternion(fore.getWorldQuaternion(new Quaternion()).invert());
    fore.rotateY(Math.max(-1.5,Math.min(1.5,Math.atan2(-palmNormal.z,palmNormal.x))));
    sampleActionFace(actor,95,t,{mood:'wary',speech:true});
    for(const brow of actor._head.children.filter(child=>child.name==='brow')){
      brow.rotation.z-=Math.sign(brow.position.x)*.15;
      brow.position.y+=brow.position.x>0 ? .014 : .008;
    }
    const lip=actor._head.getObjectByName('mouth-ah');
    lip.scale.y=1;lip.position.y=0;
    if(t%4.2>1.35 && t%4.2<2.75){
      stageMouth(actor,'ah');
      const opening=.57+.08*Math.sin(t*4.1);
      lip.scale.y=opening;
      lip.position.y=actor._mouth.position.y*(1-opening);
    }
  }else{
    j.Head.rotation.y+=role ? .24:.15;
    j.Head.rotation.x+=role ? .16:.08;
    j.Head.rotation.z=role ? -.07:.11;
    j.Spine2.rotation.x+=role ? .17:.06;
    if(!role)placePalm(actor,'Left',new Vector3(.40+.12*gesture,-.05+.11*gesture,.16),new Vector3(.9,.35,.2));
    sampleActionFace(actor,role?30:57,t,{mood:role?'wary':'delight',speech:false});
    stageMouth(actor,role?'oh':'smile');
    if(role)for(const brow of actor._head.children.filter(child=>child.name==='brow')){
      brow.rotation.z-=Math.sign(brow.position.x)*.18;
      brow.position.y+=.016;
    }
  }
}

export function createStageActors(def){
  const scene=new Scene(),camera=new OrthographicCamera(-1,1,1,-1,.01,20);
  camera.position.z=6;
  let shotCamera=camera;
  const views=new Map(), defaults=[];
  let vision,visionSource;
  function clearVision(){
    if(vision){vision.removeFromParent();for(const m of vision.children)m.material.dispose();}
    vision=null;visionSource=null;
  }
  function clearView(actor,view){
    if(view.batch===visionSource)clearVision();
    view.batch.dispose();view.shadow.removeFromParent();view.shadow.geometry.dispose();view.shadow.material.dispose();
    views.delete(actor);
  }
  function showVision(actor,view,t,frame,aspect){
    if(visionSource!==view.batch){
      clearVision();visionSource=view.batch;vision=new Group();
      for(const mesh of view.batch.group.children){
        const material=lighting(def,mesh.material.uniforms.palette.value,mesh.material.uniforms.paintMap.value);
        material.uniforms.vision.value=1;
        for(const key of ['headCenter','leftHand','rightHand'])material.uniforms[key]=mesh.material.uniforms[key];
        material.transparent=true;material.forceSinglePass=true;
        const apparition=new Mesh(mesh.geometry,material);
        apparition.frustumCulled=false;apparition.renderOrder=1;vision.add(apparition);
      }
      scene.add(vision);
    }
    const zoom=frame.zoom || 1;
    const center=stagePlateAnchor(def,[.802,.48],aspect,zoom,frame);
    const radius=stagePlateAnchor(def,[.802,.553],aspect,zoom,frame)[1]-center[1];
    const eye=actor._eyes?.[0] || actor._head;
    if(!eye){vision.visible=false;return;}
    vision.visible=true;
    const face=actor.mesh.worldToLocal(eye.getWorldPosition(new Vector3()));
    const depth=shotCamera.isPerspectiveCamera ? Math.min(shotCamera.far*.7,140) : 10;
    const halfHeight=shotCamera.isPerspectiveCamera ? depth*Math.tan(shotCamera.fov*Math.PI/360)/shotCamera.zoom : 1;
    const scale=halfHeight*radius/.126;
    vision.scale.setScalar(scale);
    vision.position.set((center[0]*2-1)*aspect*halfHeight,(1-2*center[1])*halfHeight-face.y*scale,-depth);
    vision.rotation.set(0,-.23+.035*Math.sin(t*.65),0);
    shotCamera.updateWorldMatrix(true,false);
    vision.applyMatrix4(shotCamera.matrixWorld);
    for(const mesh of vision.children){
      mesh.material.uniforms.aspect.value=aspect;mesh.material.uniforms.sphereCenter.value.fromArray(center);
      mesh.material.uniforms.sphereRadius.value=radius;
    }
  }
  return {scene,get camera(){return shotCamera;},update(t,frame={}){
    const live=Array.isArray(frame.actors);
    shotCamera=live && frame.camera?.isCamera ? frame.camera : camera;
    if(!live && !defaults.length){
      for(const [id,preset] of featured[def.id]){
        const appearance={...ART_PRESETS.find(p=>p.name===preset).values};
        if(def.id==='cabin')appearance.skinColor=appearanceForCandidate({id}).skinColor;
        const actor=portraitActor(id,{appearance});
        applyStageCostume(actor,def.id,defaults.length);
        defaults.push(actor);
      }
    }
    const actors=(live?frame.actors:defaults).filter(a=>a?.mesh?.isObject3D).slice(0,3);
    for(const [actor,view] of views)if(actors.indexOf(actor)!==view.slot || view.batch.dirty)clearView(actor,view);
    const aspect=frame.aspect || 16/9;
    if(camera.right!==aspect){camera.right=aspect;camera.left=-aspect;camera.updateProjectionMatrix();}
    for(const [i,actor] of actors.entries()){
      const pos=mark(def,i,actors.length,frame.shot?.kind,frame.framing);
      if(!live){
        performPreview(actor,def.id,i,t);
      }
      let view=views.get(actor);
      if(!view){
        const overlay=live ? createStageCostumeOverlay(actor,def.id,i) : null;
        const batch=batchActor(actor,def,overlay,!live),shadow=contactShadow(def);
        scene.add(batch.group,shadow);view={batch,shadow,slot:i};views.set(actor,view);
      }
      const {group}=view.batch;
      if(def.id==='orb' && i===Math.min(1,actors.length-1))showVision(actor,view,t,frame,aspect);
      if(shotCamera!==camera){
        // The director has already sampled the shot, blocking, props and faces.
        // Preserve that camera and every root transform, including partner contact.
        actor.mesh.updateWorldMatrix(true,true);
        actor.mesh.matrixWorld.decompose(group.position,group.quaternion,group.scale);
        group.visible=true;
        view.shadow.visible=true;
        view.shadow.position.copy(group.position);
        view.shadow.position.y+=.005;
        view.shadow.rotation.x=-Math.PI/2;
        view.shadow.scale.set(group.scale.x*.83,group.scale.x*.43,1);
        view.batch.update();
        continue;
      }
      group.visible=pos.visible;view.shadow.visible=pos.visible && pos.feet<=1;
      if(!pos.visible)continue;
      const scale=pos.h*2/1.90*(frame.zoom || 1);
      group.scale.copy(actor.mesh.scale).multiplyScalar(scale);
      const x=(pos.x*2-1)*aspect;
      let y=1-2*pos.feet;
      if(!live && def.id==='cabin' && frame.framing!=='full'){
        if(view.crown===undefined){
          actor.mesh.updateWorldMatrix(true,true);
          const top=new Box3().setFromObject(actor._head,true).max.y;
          view.crown=(top-actor.mesh.position.y)/actor.mesh.scale.y;
        }
        // Frame the top of the actual hat, including its leaf and bow.
        y=.884-view.crown*group.scale.y;
      }
      group.position.set(x,y,pos.z || 0);
      group.rotation.y=pos.yaw;
      view.shadow.position.set(x,y+.004,-.1);
      view.shadow.rotation.x=0;
      view.shadow.scale.set(scale*.83,scale*.125,1);
      view.batch.update();
    }
  },dispose(){
    clearVision();
    for(const [actor,view] of views)clearView(actor,view);
    for(const actor of defaults)disposeActor(actor);
    defaults.length=0;scene.clear();
  }};
}
