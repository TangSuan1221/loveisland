import * as THREE from 'three';
import {plateExposureShader} from './stage-plate-exposure.js';
import {makeForegroundMatte} from './stage-foreground.js';

const artwork = import.meta.glob('./art/*.webp', {eager:true,query:'?url',import:'default'});

const fullStage = {center:[.5,.5],scale:1};
export const STAGE_PLATE_FRAMING = {
  hanami: fullStage,
  cabin: fullStage,
  orb:    {center:[.729,.51], scale:1.78},
};

function framingForShot(def,frame) {
  if (frame?.framing==='full') return fullStage;
  // The close crystal-table composition belongs to the séance insert.
  // A full-body pair needs the floor of the same room under its feet.
  if (def.id==='orb' && frame?.camera?.isCamera &&
      !/^(face|shoulder|insert)/.test(frame.shot?.kind || 'wide')) {
    return fullStage;
  }
  return STAGE_PLATE_FRAMING[def.id];
}

// Normalized image-space fixture coordinates to screen-space particle coordinates.
export function stagePlateAnchor(def,point,aspect=def.aspect,zoom=1,frame) {
  const {center,scale} = framingForShot(def,frame);
  const cameraOffset = frame?.cameraOffset;
  const fitX = Math.min(1,aspect/def.aspect), fitY = Math.min(1,def.aspect/aspect);
  let [x,y] = point;
  if (cameraOffset?.x || cameraOffset?.y) {
    // Invert the backdrop's source-coordinate warp so a practical stays on
    // its wick even during dialogue camera pushes and pans.
    const [far,middle,ground,near] = depthWeights(def);
    const {smoothstep,lerp,clamp} = THREE.MathUtils;
    const dx = clamp(cameraOffset.x || 0,-.03,.03), dy = clamp(cameraOffset.y || 0,-.02,.02);
    for (let i=0;i<2;i++) {
      const floor = smoothstep(y,.58,.96);
      let depth = lerp(far,ground,floor);
      if (def.id==='orb') depth=lerp(lerp(far,ground,smoothstep(y,.46,.68)),near,smoothstep(x,.83,.97));
      else if (def.id==='cabin') depth=lerp(depth,near,(1-smoothstep(x,.08,.28))*smoothstep(y,.18,.52));
      else {
        depth=lerp(depth,middle,smoothstep(y,.28,.67)*(1-floor));
        depth=lerp(depth,near,(1-smoothstep(y,.04,.31))*smoothstep(Math.abs(x-.5),.16,.43));
      }
      x = point[0]-dx*depth;
      y = point[1]-dy*depth;
    }
  }
  return [
    (x-center[0])*scale*1.08*zoom/fitX+.5,
    (y-center[1])*scale*1.08*zoom/fitY+.5,
  ];
}

const vertexShader = /* glsl */`
  varying vec2 screen;
  void main() {
    screen = vec2(uv.x, 1. - uv.y);
    gl_Position = vec4(position.xy, 0., 1.);
  }
`;

// A continuous depth field keeps photographed edges attached to the painted plate.
// Four recipe depths share one draw. Actor and particle planes are drawn separately.
const fragmentShader = /* glsl */`
  uniform sampler2D plate;
  uniform sampler2D foreground;
  uniform bool inspectForeground;
  uniform bool fullBody;
  uniform vec4 parallax;
  uniform vec2 offset;
  uniform vec2 glowPosition;
  uniform vec3 glowColor;
  uniform float glowPower;
  uniform float time;
  uniform float seedPhase;
  uniform float zoom;
  uniform float framingScale;
  uniform vec2 framingCenter;
  uniform vec3 pinkShade;
  uniform vec3 rimLight;
  uniform float aspect;
  uniform float viewAspect;
  uniform float sceneIndex;
  varying vec2 screen;
  ${plateExposureShader}

  float depthAt(vec2 p) {
    float ground = smoothstep(.58, .96, p.y);
    float depth = mix(parallax.x, parallax.z, ground);
    if (sceneIndex < .5) {
      float bough = (1. - smoothstep(.04,.31,p.y)) *
                    smoothstep(.16,.43,abs(p.x-.50));
      depth = mix(depth, parallax.y, smoothstep(.28,.67,p.y) * (1.-ground));
      return mix(depth,parallax.w,bough);
    }
    if (sceneIndex < 1.5) {
      float stove = (1.-smoothstep(.08,.28,p.x)) * smoothstep(.18,.52,p.y);
      return mix(depth,parallax.w,stove);
    }
    float table = smoothstep(.46,.68,p.y);
    float tassel = smoothstep(.83,.97,p.x);
    return mix(mix(parallax.x,parallax.z,table),parallax.w,tassel);
  }

  void main() {
    vec2 cover = min(vec2(1.),vec2(viewAspect / aspect, aspect / viewAspect));
    vec2 p = (screen-.5) * cover / (1.08 * zoom * framingScale) + framingCenter;
    p += offset * depthAt(p);
    float nearSolid = texture2D(foreground,vec2(p.x,1.-p.y)).r;
    // Window depth zero is the near clip plane with both the perspective
    // story camera and the orthographic stage camera. Leave open pixels at far.
    gl_FragDepth = nearSolid >= .5 ? 0. : 1.;
    if(inspectForeground) { gl_FragColor=vec4(vec3(nearSolid),0.); return; }
    vec2 plateUv=vec2(p.x,1.-p.y);
    float focusLevel=sceneIndex<.5 ? 4.25 : 3.;
    vec3 color = textureLod(plate,plateUv,fullBody ? focusLevel : 0.).rgb;
    if (sceneIndex < .5) {
      vec2 behindFace = (p - vec2(.52,.31))*vec2(3.4,1.9);
      // Retain the soft blossom canopy while leaving clean pink air behind
      // the featured performer's silver hair and hands in a close shot.
      float lightPaint = dot(color,vec3(.2126,.7152,.0722));
      float wash = (.18+.28*smoothstep(.35,.87,lightPaint))*
                   exp(-dot(behindFace,behindFace)*2.);
      color = mix(color,pinkShade,wash);
    }
    color=plateToScene(color,sceneIndex,screen);
    vec2 lightDelta = (p-glowPosition)*vec2(aspect,1.);
    float falloff = exp(-dot(lightDelta,lightDelta)*13.);
    float flicker = .48*sin(time*2.9+seedPhase)+.32*sin(time*5.7)+.20*sin(time*9.1);
    if (sceneIndex > .5 && sceneIndex < 1.5) {
      // Preserve the black cast iron around the warm, pulsing firebox.
      float warmth = max(0.,color.r-color.b);
      color += glowColor * glowPower * warmth * falloff * (.13+.11*flicker);
    } else if(sceneIndex > 1.5) {
      float magenta = max(0.,min(color.r,color.b)-color.g);
      color += glowColor * glowPower * magenta * (.08+.05*sin(time*.88+seedPhase));
      color=crystalPrint(color,p,rimLight);
    }
    gl_FragColor = vec4(color,plateEmissionMask(p,sceneIndex));
  }
`;

const platePaths = {
  hanami: { planes: ['sky','far','ground','near'], index: 0 },
  cabin:  { planes: ['room','shaft','floor','embers'], index: 1 },
  orb:    { planes: ['curtain','rays','table','fg'], index: 2 },
};

function depthWeights(def) {
  return platePaths[def.id].planes.map(name=>def.layers.find(row=>row.layer===name).parallax);
}

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function makeTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function preserveFocus(ctx,x,y,radius,paint) {
  const hole=ctx.createRadialGradient(x,y,radius*.76,x,y,radius*1.3);
  hole.addColorStop(0,paint);
  hole.addColorStop(1,'transparent');
  ctx.fillStyle=hole;
  ctx.fillRect(x-radius*1.3,y-radius*1.3,radius*2.6,radius*2.6);
}

// Blur the set behind the actors once. Keep practical lights, glass and the
// foreground trim in their own focus planes, including during camera pushes.
function softenBackstage(ctx,canvas,def) {
  if(def.id==='hanami') return;
  const {width:w,height:h}=canvas;
  const cabin=def.id==='cabin';
  const layer=def.layers.find(row=>row.layer===(cabin?'shaft':'rays'));
  const copy=canvasOf(w,h);
  const soft=copy.getContext('2d');
  soft.filter=`blur(${layer.blur*w/1920*(cabin ? .47 : .76)}px)`;
  soft.drawImage(canvas,0,0);
  soft.filter='none';
  soft.globalCompositeOperation='destination-in';
  const extent=soft.createLinearGradient(0,0,0,h);
  extent.addColorStop(0,def.glowColor);
  extent.addColorStop(cabin ? .61 : .77,def.glowColor);
  extent.addColorStop(1,'transparent');
  soft.fillStyle=extent;
  soft.fillRect(0,0,w,h);
  soft.globalCompositeOperation='destination-out';
  const sharp=cabin ? [[.0556,.5803,.13],[.2697,.2109,.055]] :
      [[.802,.480,.078],[.800,.560,.061],[.7398,.5222,.026],[.8709,.4574,.027],[.8871,.5372,.022]];
  for(const [x,y,r] of sharp) preserveFocus(soft,x*w,y*h,r*h,def.glowColor);
  if(!cabin) {
    const fringe=soft.createLinearGradient(w*.91,0,w*.965,0);
    fringe.addColorStop(0,'transparent');
    fringe.addColorStop(1,def.glowColor);
    soft.fillStyle=fringe;
    soft.fillRect(0,0,w,h);
  }
  ctx.save();
  ctx.globalAlpha=cabin ? .76 : .78;
  ctx.drawImage(copy,0,0);
  ctx.restore();
  copy.width=copy.height=1;
}

function makeUnderpainting(def) {
  const canvas = canvasOf(640,360);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0,0,0,canvas.height);
  for (const stop of def.stops) gradient.addColorStop(stop.at,stop.color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const x = def.glowX*canvas.width, y = def.glowY*canvas.height;
  const glow = ctx.createRadialGradient(x,y,0,x,y,def.glowRadius*canvas.height);
  glow.addColorStop(0,def.glowColor);
  glow.addColorStop(1,def.glowColor+'00');
  ctx.globalAlpha = def.glowPower;
  ctx.fillStyle = glow;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  return makeTexture(canvas);
}

// Apply optical softness once when the plate arrives. Preserve the readable stove,
// timber seams and glass rim. The near/right fringe in the séance has its own blur.
function paintPlate(image,def,maxWidth) {
  const w = Math.min(maxWidth,image.naturalWidth);
  const h = Math.round(w/def.aspect);
  const canvas = canvasOf(w,h);
  const ctx = canvas.getContext('2d');
  const fit = Math.max(w/image.naturalWidth,h/image.naturalHeight);
  const iw = image.naturalWidth*fit, ih = image.naturalHeight*fit;
  ctx.drawImage(image,(w-iw)/2,(h-ih)/2,iw,ih);
  softenBackstage(ctx,canvas,def);
  const layer = def.layers.find(row=>row.layer===({hanami:'far',cabin:'floor',orb:'fg'}[def.id]));
  if (layer?.blur > 0 && 'filter' in ctx) {
    const soft = canvasOf(w,h);
    const blurred = soft.getContext('2d');
    const radius = layer.blur * w / 1920;
    blurred.filter = `blur(${radius}px)`;
    blurred.drawImage(canvas,0,0);
    blurred.filter = 'none';
    blurred.globalCompositeOperation = 'destination-in';
    let mask;
    if (def.id === 'orb') {
      mask = blurred.createLinearGradient(w*.85,0,w*.98,0);
      mask.addColorStop(0,'transparent');
      mask.addColorStop(1,def.glowColor);
    } else {
      mask = blurred.createLinearGradient(0,0,0,h);
      mask.addColorStop(0,'transparent');
      mask.addColorStop(.43,def.glowColor);
      mask.addColorStop(.72,def.glowColor);
      mask.addColorStop(1,'transparent');
    }
    blurred.fillStyle = mask;
    blurred.fillRect(0,0,w,h);
    ctx.drawImage(soft,0,0);
    soft.width = soft.height = 1;
  }
  return makeTexture(canvas);
}

/** Painted backgrounds use clip space so they work with either actor camera. */
export function createStageLayers(def,seed=1) {
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const layout = platePaths[def.id];
  const framing = STAGE_PLATE_FRAMING[def.id];
  const weights = depthWeights(def);
  const phase = (Number(seed) || 0) * .61803398875;
  const uniforms = {
    plate: {value:makeUnderpainting(def)},
    foreground: {value:makeForegroundMatte(def.id)}, inspectForeground: {value:false}, fullBody:{value:false},
    parallax: {value:new THREE.Vector4(...weights)},
    offset: {value:new THREE.Vector2()}, glowPosition: {value:new THREE.Vector2(def.glowX,def.glowY)},
    glowColor: {value:new THREE.Color(def.glowColor)}, glowPower: {value:def.glowPower},
    time: {value:0}, seedPhase: {value:phase}, zoom: {value:1},
    framingCenter: {value:new THREE.Vector2(...framing.center)}, framingScale: {value:framing.scale},
    pinkShade: {value:new THREE.Color(def.stops[0].color)},
      rimLight: {value:new THREE.Color(def.lights.find(light=>light.role==='rim')?.color ?? def.rimColor)},
    aspect: {value:def.aspect}, viewAspect: {value:def.aspect}, sceneIndex: {value:layout.index},
  };
  const material = new THREE.ShaderMaterial({
    vertexShader,fragmentShader,uniforms,depthTest:true,depthFunc:THREE.AlwaysDepth,depthWrite:true,toneMapped:false,
  });
  const geometry = new THREE.PlaneGeometry(2,2);
  const mesh = new THREE.Mesh(geometry,material);
  mesh.frustumCulled = false;
  const size = new THREE.Vector2();
  mesh.onBeforeRender = renderer => {
    const rt = renderer.getRenderTarget();
    if (rt) uniforms.viewAspect.value = rt.width/rt.height;
    else {
      renderer.getDrawingBufferSize(size);
      uniforms.viewAspect.value = size.x / Math.max(1,size.y);
    }
  };
  scene.add(mesh);
  let disposed = false, low = false, loaded = false;
  const image = new Image();
  function upload() {
    const next = paintPlate(image,def,low ? 1024 : 1920);
    uniforms.plate.value.dispose();
    uniforms.plate.value = next;
  }
  const ready = new Promise((resolve,reject)=>{
    image.onload = () => {
      try {
        if (!disposed) { loaded = true; upload(); }
        resolve();
      } catch (error) { reject(error); }
    };
    image.onerror = () => disposed ? resolve() : reject(new Error('无法加载演出背景 '+def.id));
    image.src = artwork[`./art/${def.id}.webp`];
  });
  function update(time,frame={}) {
    if (disposed) return;
    const quality = frame.quality ?? 0;
    uniforms.inspectForeground.value = frame.debugView==='foreground';
    uniforms.fullBody.value = frame.framing==='full';
    const framing = framingForShot(def,frame);
    uniforms.framingCenter.value.fromArray(framing.center);
    uniforms.framingScale.value = framing.scale;
    if (low !== (quality >= 4)) {
      low = quality >= 4;
      if (loaded) upload();
    }
    const offset = frame.cameraOffset;
    const x = offset?.x ?? .009 * Math.sin(time*.23 + phase);
    const y = offset?.y ?? .004 * Math.sin(time*.19 + phase);
    uniforms.offset.value.set(
      quality >= 5 ? 0 : THREE.MathUtils.clamp(x,-.03,.03),
      quality >= 5 ? 0 : THREE.MathUtils.clamp(y,-.02,.02),
    );
    uniforms.zoom.value = THREE.MathUtils.clamp(frame.zoom ?? 1,.97,1.03);
    uniforms.time.value = time;
  }
  function dispose() {
    disposed = true;
    uniforms.plate.value.dispose();
    uniforms.foreground.value.dispose();
    material.dispose();
    geometry.dispose();
    scene.clear();
  }
  return {scene,camera,ready,update,dispose};
}
