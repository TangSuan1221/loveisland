import {
  BufferGeometry, Camera, Color, Float32BufferAttribute, GLSL3, Group,
  HalfFloatType, LinearFilter, LinearMipmapLinearFilter, Mesh,
  NoBlending, RawShaderMaterial, UnsignedByteType, Vector2, WebGLRenderTarget,
} from 'three';
import {dissolveShader} from './stage-transition.js';

const vertexShader = /* glsl */ `
in vec3 position;
out vec2 uv;
void main(){
  uv=position.xy*.5+.5;
  gl_Position=vec4(position,1.);
}`;
const fragmentHeader = /* glsl */ `
precision highp float;
precision highp int;
in vec2 uv;
out vec4 fragColour;
const vec3 lumaWeights=vec3(.2126,.7152,.0722);
`;

const brightShader = /* glsl */ `
uniform sampler2D beauty;
uniform vec2 texel;
uniform float threshold;
vec3 bright(vec2 p) {
  vec4 source=texture(beauty,p);
  vec3 c=source.rgb;
  float peak=dot(c,lumaWeights);
  // A soft knee retains the tapered edges of flame and star marks.
  float knee=threshold*.15;
  float soft=clamp(peak-threshold+knee,0.,2.*knee);
  float gain=max(soft*soft/(4.*knee+.0001),peak-threshold);
  return c*gain/max(peak,.0001)*clamp(source.a,0.,1.);
}
void main(){
  vec2 t=texel*.66;
  fragColour=vec4(.25*(bright(uv+t)+bright(uv-t)+bright(uv+vec2(t.x,-t.y))+bright(uv+vec2(-t.x,t.y))),1.);
}`;

// Hardware mip reduction keeps five scales without submitting a draw per
// scale. Each four-tap bilinear tent reconstructs the corresponding octave.
const glowShader = /* glsl */ `
uniform sampler2D pyramid;
uniform vec2 texel;
uniform int levels;
uniform float radius;
void main(){
  vec3 sum=vec3(0.);
  float total=0.;
  for(int i=0;i<5;i++){
    if(i>=levels) break;
    float level=float(i);
    vec2 d=texel*exp2(level)*(.5+radius);
    vec3 c=textureLod(pyramid,uv-d,level).rgb + textureLod(pyramid,uv+d,level).rgb
         +textureLod(pyramid,uv+vec2(d.x,-d.y),level).rgb +textureLod(pyramid,uv+vec2(-d.x,d.y),level).rgb;
    float weight=mix(1.,.65,level*.25);
    sum+=c*.25*weight;
    total+=weight;
  }
  fragColour=vec4(sum/total,1.);
}`;

const compositeShader = /* glsl */ `
uniform sampler2D beauty;
uniform sampler2D glow;
uniform vec2 texel;
uniform vec3 shadowTint;
uniform vec3 highTint;
uniform float exposure,contrast,saturation,vignette,vigSoft,bloomStrength,grain,chroma;
uniform float frameNumber,seed,tintMix,ditherStrength;
uniform bool tonemapping;
uniform bool fullBody;
uniform bool showHighlights;
uniform bool showForeground;
uniform float bloomThreshold;
` + dissolveShader + /* glsl */ `
vec3 aces(vec3 x) {
  return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);
}
vec3 toDisplay(vec3 linear){
  return mix(linear*12.92,1.055*pow(max(linear,vec3(0.)),vec3(1./2.4))-.055,step(.0031308,linear));
}
float noise(vec3 p){
  p=fract(p*vec3(.1031,.1030,.0973));
  p+=dot(p,p.yxz+33.33);
  return fract((p.x+p.y)*p.z);
}
float frameGrain(vec2 pixel,float phase) {
  if(!fullBody)return noise(vec3(pixel,phase))-.5;
  // A coarser, softly interpolated grain keeps the fine linework on distant faces legible.
  vec2 cell=pixel/4.;
  vec2 q=floor(cell),f=smoothstep(vec2(0.),vec2(1.),fract(cell));
  return 1.37*(mix(mix(noise(vec3(q,phase)),noise(vec3(q+vec2(1,0),phase)),f.x),
                   mix(noise(vec3(q+vec2(0,1),phase)),noise(vec3(q+vec2(1,1),phase)),f.x),f.y)-.5);
}
void main(){
  vec2 centre=uv-.5;
  vec4 sceneSample=texture(beauty,uv);
  vec3 c=sceneSample.rgb;
  if(showForeground){fragColour=vec4(c,1.);return;}
  if(showHighlights){
    float peak=dot(c,lumaWeights);
    float emissive=step(bloomThreshold,peak)*step(.01,sceneSample.a);
    fragColour=vec4(vec3(emissive),1.);
    return;
  }
  if(chroma>0.){
    vec2 shift=centre*dot(centre,centre)*texel*chroma*5.;
    c.r=texture(beauty,uv+shift).r;
    c.b=texture(beauty,uv-shift).b;
  }
  if(bloomStrength>0.) c+=texture(glow,uv).rgb*bloomStrength;
  c*=exposure;
  c=toDisplay(tonemapping ? aces(c) : max(vec3(0.),c));
  c=(c-.5)*contrast+.5;
  float luma=dot(c,lumaWeights);
  c=mix(vec3(luma),c,saturation);
  vec3 tint=mix(shadowTint,highTint,smoothstep(.04,.9,luma));
  c*=mix(vec3(1.),tint*1.9,tintMix);
  float r=length(centre*vec2(1.,.81))*1.42;
  c*=1.-vignette*smoothstep(vigSoft*.55,vigSoft*1.45,r);
  // A display-space grain of constant amplitude vanishes in low-key sets.
  // Compensate the sRGB toe using the recipe's dark-room falloff.
  float shadowGrain=1.+10.*vignette*(1.-smoothstep(.10,.65,luma));
  c+=frameGrain(gl_FragCoord.xy,seed+frameNumber)*grain*(1.2-.7*luma)*shadowGrain;
  c+=(noise(vec3(gl_FragCoord.yx,seed))-.5)*ditherStrength/255.;
  fragColour=vec4(dissolveFrame(c,uv),1.);
}`;

function target(type, depthBuffer=false, mipmap=false) {
  return new WebGLRenderTarget(1, 1, {
    type, depthBuffer, stencilBuffer:false, generateMipmaps:mipmap,
    minFilter:mipmap ? LinearMipmapLinearFilter : LinearFilter, magFilter:LinearFilter,
  });
}

function pass(shader, values) {
  const uniforms=Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value}]));
  return new RawShaderMaterial({
    glslVersion:GLSL3, vertexShader, fragmentShader:fragmentHeader+shader,
    uniforms, depthTest:false, depthWrite:false, blending:NoBlending, toneMapped:false,
  });
}

export class StagePost {
  constructor(renderer, seed) {
    this.renderer=renderer;
    this.hdr=renderer.extensions.has('EXT_color_buffer_float');
    const type=this.hdr ? HalfFloatType : UnsignedByteType;
    this.beauty=target(type,true);
    this.pyramid=target(type,false,true);
    this.glow=target(type);
    this.texel=new Vector2(1,1);
    this.halfTexel=new Vector2(1,1);
    this.bright=pass(brightShader,{ beauty:this.beauty.texture, texel:this.texel, threshold:1 });
    this.blur=pass(glowShader,{ pyramid:this.pyramid.texture, texel:this.halfTexel, levels:5, radius:1 });
    this.composite=pass(compositeShader,{
      beauty:this.beauty.texture, glow:this.glow.texture, previousFrame:null, texel:this.texel,
      exposure:1, contrast:1, saturation:1, vignette:0, vigSoft:1, bloomStrength:0,
      grain:0, chroma:0, shadowTint:new Color(), highTint:new Color(), fogColour:new Color(),
      frameNumber:0, seed, dissolve:1, tonemapping:true, fullBody:false, tintMix:.18, ditherStrength:1,
      showHighlights:false,showForeground:false,bloomThreshold:1,
    });
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
    this.triangle=new Mesh(geometry,this.composite);
    this.triangle.frustumCulled=false;
    this.scene=new Group();
    this.scene.add(this.triangle);
    this.camera=new Camera();
    this.width=this.height=1;
    this.frozen=null;
  }
  resize(w,h) {
    this.width=w; this.height=h;
    const halfW=Math.max(1,Math.ceil(w/2)),halfH=Math.max(1,Math.ceil(h/2));
    this.beauty.setSize(w,h);
    this.pyramid.setSize(halfW,halfH);
    this.glow.setSize(halfW,halfH);
    this.texel.set(1/w,1/h);
    this.halfTexel.set(1/halfW,1/halfH);
  }
  draw(material,destination) {
    this.renderer.setRenderTarget(destination);
    this.triangle.material=material;
    this.renderer.render(this.scene,this.camera);
  }
  setRecipe(def) {
    const g=def.grade,u=this.composite.uniforms;
    for(const name of ['exposure','vigSoft']) u[name].value=g[name];
    if(!this.hdr) u.exposure.value*=1.04;
    u.shadowTint.value.set(g.shadowTint).convertLinearToSRGB();
    u.highTint.value.set(g.highTint).convertLinearToSRGB();
    u.fogColour.value.set(def.hazeColor).convertLinearToSRGB();
    this.bright.uniforms.threshold.value=this.hdr ? g.bloomThresh : Math.min(.94,g.bloomThresh);
    u.bloomThreshold.value=this.bright.uniforms.threshold.value;
    this.blur.uniforms.radius.value=g.bloomRadius;
    this.grade=g;
  }
  freeze() {
    const snapshot=target(UnsignedByteType);
    snapshot.setSize(this.width,this.height);
    this.draw(this.composite,snapshot);
    this.releaseFreeze();
    this.frozen=snapshot;
    this.composite.uniforms.previousFrame.value=snapshot.texture;
  }
  releaseFreeze() {
    this.composite.uniforms.previousFrame.value=null;
    this.frozen?.dispose(); this.frozen=null;
  }
  finish(t,frame,dissolve) {
    const u=this.composite.uniforms;
    const levels=frame.quality>=2 ? 3 : 5;
    if(frame.bloom!==false){
      this.blur.uniforms.levels.value=levels;
      this.draw(this.bright,this.pyramid);
      this.draw(this.blur,this.glow);
    }
    u.bloomStrength.value=frame.bloom===false ? 0 : this.grade.bloomStrength;
    u.grain.value=frame.grain===false ? 0 : this.grade.grain;
    u.chroma.value=frame.chroma===false || frame.quality>=1 ? 0 : this.grade.chroma;
    u.tonemapping.value=frame.tonemapping!==false;
    u.fullBody.value=frame.framing==='full';
    u.showHighlights.value=frame.debugView==='highlights';
    u.showForeground.value=frame.debugView==='foreground';
    u.contrast.value=frame.grade===false ? 1 : this.grade.contrast;
    u.saturation.value=frame.grade===false ? 1 : this.grade.saturation;
    u.tintMix.value=frame.grade===false ? 0 : .18;
    u.vignette.value=frame.vignette===false ? 0 : this.grade.vignette;
    u.ditherStrength.value=frame.dither===false ? 0 : 1;
    u.frameNumber.value=Math.floor(t*30);
    u.dissolve.value=this.frozen ? dissolve : 1;
    this.draw(this.composite,null);
    if(dissolve>=1 && this.frozen) this.releaseFreeze();
    return frame.bloom===false ? 0 : levels;
  }
  dispose() {
    this.releaseFreeze();
    for(const resource of [this.beauty,this.pyramid,this.glow,this.bright,this.blur,this.composite,this.triangle.geometry]) resource.dispose();
  }
}
