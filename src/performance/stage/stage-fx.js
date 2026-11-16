import {
  AdditiveBlending, Camera, Color, InstancedBufferAttribute, InstancedBufferGeometry,
  CustomBlending, Mesh, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, Scene, ShaderMaterial, Vector2, Vector3, ZeroFactor
} from 'three';
import {stagePlateAnchor} from './stage-layers.js';

const shapes = ['bokeh', 'petal', 'ring', 'dust', 'ember', 'aura', 'flame', 'spark'];

function randomSequence(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state + .5) / 4294967296;
  };
}

const vertex = `
attribute vec4 region;
attribute vec4 variation;
attribute vec4 recipe;
attribute vec3 tint;
uniform float seconds, aspect;
uniform vec2 cameraShift;
uniform vec2 candles[3], hearth, auraCenter;
varying vec2 local;
varying vec3 paint;
varying float kind, opacity, phase;
void main(){
  kind=recipe.x; opacity=recipe.w; phase=variation.z*6.2831853;
  float speed=recipe.z, t=seconds*speed, z=variation.w;
  vec2 center=mix(region.xy,region.zw,variation.xy);
  vec2 p=position.xy*2.;
  float size=recipe.y/1080.;
  if(kind<.5){
    center.y=region.y+fract(variation.y-t*.22)*(region.w-region.y);
    center.x+=sin(t*2.+phase)*.014;
    opacity*=.72+.28*sin(seconds*.43+phase);
  }else if(kind<1.5){
    center.y=mix(region.y,region.w,fract(variation.y+t*.42));
    center.x+=sin(phase+t*3.6)*.027;
    float a=phase+seconds*(.34+z*.48);
    p.x*=.4+.6*abs(cos(a*.73));
    p=mat2(cos(a),sin(a),-sin(a),cos(a))*p;
  }else if(kind<2.5){
    float a=variation.x*6.2831853+t*.7;
    float radius=.84+.16*variation.y;
    center=region.xy+vec2(cos(a),sin(a))*region.zw*radius;
    center.y-=.009*pow(variation.z,3.);
    opacity*=.22+.78*pow(.5+.5*sin(seconds*1.7+phase),2.);
  }else if(kind<4.5 || kind>6.5){
    if(kind>3.5 && kind<4.5){
      float life=fract(variation.y+t*.72);
      center=hearth+vec2((variation.x-.5)*.038+.012*sin(phase+seconds*.87)*life,-life*.16);
      opacity*=sin(life*3.14159);
    }else{
      center.y=mix(region.y,region.w,fract(variation.y-t*.72));
      center.x+=sin(phase+seconds*.48)*.006;
    }
    opacity*=.5+.5*pow(.5+.5*cos(seconds*1.8+phase),2.);
  }else if(kind<5.5){
    center=auraCenter.x<0. ? region.xy : auraCenter;
    p.x*=1.25;
  }else{
    center=candles[int(floor(variation.x*2.+.5))];
    p.y*=1.28+.08*sin(seconds*5.+phase);
    center.x+=.0012*sin(seconds*3.+phase);
  }
  if(kind<5.5 || kind>6.5)center+=cameraShift*(z-.5)*.035;
  gl_Position=vec4(vec2(center.x*2.-1.,1.-center.y*2.)+p*size/vec2(aspect,1.),0.,1.);
  paint=tint; local=uv*2.-1.;
}`;

const fragment = `
varying vec2 local;
varying vec3 paint;
varying float kind, opacity, phase;
uniform float seconds;
void main(){
  vec2 p=local;
  float r=length(p), a=0., energy=1.;
  vec3 c=paint;
  if(kind<.5){
    float body=1.-smoothstep(.66,1.,r);
    float rim=exp(-pow((r-.80)/.105,2.));
    a=body*.50+rim*.48;
  }else if(kind<1.5){
    // Folded petals have a notched tip, a tapered base and a darker turned edge.
    float h=p.y*.5+.5;
    float w=.67*pow(max(0.,sin(clamp(h,0.,1.)*3.14159)),.73)*(.68+.49*h);
    float notch=(1.-smoothstep(0.,.12,abs(p.x+.05)))*smoothstep(.73,1.,h);
    float d=max(abs(p.x-.13*sin(h*3.14))-w, p.y-.95+.46*notch);
    a=1.-smoothstep(-.025,.06,d);
    c*=.64+.36*smoothstep(-.16,.2,p.x+.12*p.y);
  }else if(kind<4.5 || kind>6.5){
    a=exp(-r*r*4.)*(1.-smoothstep(.74,1.,r));
    if(kind>6.5){a+=.55*exp(-abs(p.x)*17.-abs(p.y)*2.)+.55*exp(-abs(p.y)*17.-abs(p.x)*2.);}
    energy=1.4;
  }else if(kind<5.5){
    float h=clamp(.5+.5*p.y,0.,1.);
    float wave=.09*sin(6.*h-seconds*2.1+sign(p.x)*1.7);
    float ridge=.22+.41*pow(h,.7)+wave;
    float width=.028+.21*(1.-h);
    float tongue=exp(-pow((abs(p.x)-ridge)/width,2.));
    float tips=.72+.14*sin(seconds*1.36+sign(p.x)*2.15);
    a=(.15*exp(-r*r*3.5)+.70*tongue)*(1.-smoothstep(tips,1.,h))*smoothstep(0.,.3,h);
  }else{
    float h=clamp(p.y*.5+.5,0.,1.);
    float width=.55*pow(max(0.,sin(pow(h,.60)*3.14159)),.82);
    float sway=.25*h*h*sin(4.2*seconds+phase+3.*h);
    float edge=abs(p.x-sway)-width;
    a=(1.-smoothstep(-.06,.075,edge))*(1.-smoothstep(.92,1.,abs(p.y)));
    a+=.18*exp(-r*r*3.6);
    energy=1.3+2.0*exp(-dot(p-vec2(0.,-.27),p-vec2(0.,-.27))*8.);
    c=mix(paint,vec3(1.),.5*exp(-r*r*6.));
  }
  float mask=(kind<.5 || (kind>2.5 && kind<3.5))?0.:opacity*a;
  gl_FragColor=vec4(c*energy*opacity*a,mask);
}`;

// Particle positions evolve entirely in the vertex shader. Regions, authored counts,
// blend mode and seeds stay independent when another effect is added to a recipe.
export function createStageFx(def, seed = 1) {
  const scene = new Scene(), camera = new Camera();
  const groups = new Map();
  for (const row of def.fx) {
    const kind = shapes.indexOf(row.type);
    if (kind < 0) continue;
    const random = randomSequence(Math.imul(seed, 2654435761) ^ row.seed);
    const color = new Color(row.color);
    const entries = groups.get(row.blend) || [];
    for (let i = 0; i < row.count; i++) {
      const rx = random(), ry = random(), rz = random(), rw = random();
      entries.push({
        region: [row.x0, row.y0, row.x1, row.y1],
        variation: [row.type === 'flame' ? i / Math.max(1, row.count - 1) : rx, ry, rz, rw],
        recipe: [kind, row.sizeMin + (row.sizeMax-row.sizeMin)*random(), row.speed, row.alpha],
        tint: color.toArray(), rank: row.type === 'aura' || row.type === 'flame' ? -1 : random()
      });
    }
    groups.set(row.blend, entries);
  }
  const candlePoints=[[.7398,.5222],[.8709,.4574],[.8871,.5372]];
  const uniforms = { seconds: {value: 0}, aspect: {value: 16/9}, cameraShift: {value: new Vector2()},
    candles:{value:candlePoints.map(()=>new Vector2())},hearth:{value:new Vector2()},auraCenter:{value:new Vector2(-1,0)} };
  const actorPoint=new Vector3();
  for (const [blend, entries] of groups) {
    entries.sort((a,b) => a.rank-b.rank);
    const geometry = new InstancedBufferGeometry(), quad = new PlaneGeometry(1,1);
    geometry.index = quad.index;
    geometry.attributes.position = quad.attributes.position;
    geometry.attributes.uv = quad.attributes.uv;
    for (const [key, size] of [['region',4],['variation',4],['recipe',4],['tint',3]]) {
      geometry.setAttribute(key,new InstancedBufferAttribute(new Float32Array(entries.flatMap(e => e[key])), size));
    }
    const material = new ShaderMaterial({ vertexShader:vertex,fragmentShader:fragment,uniforms,
      transparent:true,premultipliedAlpha:true,depthTest:false,depthWrite:false,
      blending:blend === 'add' ? AdditiveBlending : CustomBlending,
      blendSrc:OneFactor,blendDst:OneMinusSrcAlphaFactor,blendSrcAlpha:ZeroFactor,blendDstAlpha:OneMinusSrcAlphaFactor });
    const mesh = new Mesh(geometry,material);
    mesh.userData.count = entries.length;
    mesh.renderOrder = blend === 'add' ? 0 : 1;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  return {scene,camera,update(seconds,frame = {}){
    uniforms.seconds.value=seconds;
    uniforms.aspect.value=frame.aspect || 16/9;
    uniforms.cameraShift.value.set(frame.camX || 0,frame.camY || 0);
    if(def.id==='orb')for(const [i,point] of candlePoints.entries()){
      uniforms.candles.value[i].fromArray(stagePlateAnchor(def,point,uniforms.aspect.value,frame.zoom,frame));
    }
    if(def.id==='cabin'){
      uniforms.hearth.value.fromArray(stagePlateAnchor(def,[.064,.565],uniforms.aspect.value,frame.zoom,frame));
      const chest=frame.actors?.[0]?._rig?.joints.Spine2;
      if(chest && frame.camera?.isCamera){
        chest.getWorldPosition(actorPoint).project(frame.camera);
        uniforms.auraCenter.value.set(.5+.5*actorPoint.x,.5-.5*actorPoint.y);
      }else uniforms.auraCenter.value.set(-1,0);
    }
    for(const mesh of scene.children){
      mesh.geometry.instanceCount=Math.ceil(mesh.userData.count*(frame.quality>=3 ? .6 : 1));
    }
  },dispose(){
    for(const mesh of scene.children){mesh.geometry.dispose();mesh.material.dispose();}
    scene.clear();
  }};
}
