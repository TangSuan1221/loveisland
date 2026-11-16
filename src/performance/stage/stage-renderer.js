import {NoToneMapping, WebGLRenderer} from 'three';
import {createStageLayers} from './stage-layers.js';
import {createStageActors} from './stage-actor.js';
import {createStageFx} from './stage-fx.js';
import {StagePost} from './stage-post.js';
import {transitionProgress} from './stage-transition.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Render cadence is wall time. Story time can pause, seek and run at any speed.
export class StageQuality {
  level=0;
  slowFrames=0;
  previousTime=null;
  sample(now) {
    const elapsed=now-this.previousTime;
    const slow=this.previousTime!==null && elapsed>1000/28;
    this.previousTime=now;
    this.slowFrames=slow ? this.slowFrames+1 : 0;
    if(this.slowFrames>=30){
      this.level=Math.min(5,this.level+1);
      this.slowFrames=0;
    }
    return this.level;
  }
}

function buildScene(def,seed) {
  const parts=[];
  try{
    parts.push(createStageLayers(def,seed));
    parts.push(createStageFx(def,seed));
    parts.push(createStageActors(def,seed));
    return parts;
  }catch(error){
    for(const part of parts) part.dispose();
    throw error;
  }
}

export class StageRenderer {
  constructor(canvas,def,{seed=1}={}) {
    this.canvas=canvas;
    this.seed=seed;
    this.renderer=new WebGLRenderer({
      canvas, antialias:false, alpha:false, stencil:false,
      powerPreference:'high-performance', preserveDrawingBuffer:false,
    });
    this.renderer.autoClear=false;
    this.renderer.info.autoReset=false;
    this.renderer.toneMapping=NoToneMapping;
    this.renderer.setClearColor(0,0);
    this.quality=new StageQuality();
    this.post=new StagePost(this.renderer,seed);
    this.stats={};
    this.parts=[];
    this.rendered=false;
    this.ready=Promise.resolve();
    this.disposed=false;
    try{
      this.setStage(def,0,0);
      this.resize(canvas.clientWidth||canvas.width,canvas.clientHeight||canvas.height);
    }catch(error){
      this.dispose();
      throw error;
    }
  }
  setStage(def,timeSeconds=0,duration=.85) {
    if(!def || !def.grade) throw new TypeError('StageRenderer needs a stage recipe');
    if(this.def===def) return this.ready;
    const next=buildScene(def,this.seed);
    if(duration>0 && this.rendered) this.post.freeze();
    else this.post.releaseFreeze();
    this.transitionStart=timeSeconds;
    this.duration=duration>0 ? clamp(duration,.6,1.2) : 0;
    const old=this.parts;
    this.parts=next;
    this.def=def;
    this.post.setRecipe(def);
    this.ready=Promise.all(next.map(part=>part.ready)).then(()=>undefined);
    for(const part of old) part.dispose();
    return this.ready;
  }
  resize(cssWidth,cssHeight,pixelRatio=1) {
    const ratio=clamp(pixelRatio,.25,1.5);
    const width=Math.max(1,Math.round(cssWidth*ratio));
    const height=Math.max(1,Math.round(cssHeight*ratio));
    if(width===this.width && height===this.height) return;
    this.width=width; this.height=height;
    this.renderer.setSize(width,height,false);
    this.post.resize(width,height);
  }
  render(timeSeconds,frame={}) {
    if(this.disposed || this.renderer.getContext().isContextLost()) return this.stats;
    const t=Number.isFinite(timeSeconds) ? timeSeconds : 0;
    let quality=frame.quality;
    if(!Number.isFinite(quality)){
      quality=frame.adaptive===false ? 0 : this.quality.sample(performance.now());
    }
    const phase=this.seed*.61803398875;
    const cx=quality>=5 ? 0 : frame.cameraOffset?.x ?? frame.camX ?? .009*Math.sin(t*.23+phase);
    const cy=quality>=5 ? 0 : frame.cameraOffset?.y ?? frame.camY ?? .004*Math.sin(t*.19+phase);
    const zoom=frame.zoom ?? 1+.009*(1-Math.cos(t*.18));
    const sample={
      ...frame, quality, width:this.width, height:this.height, aspect:this.width/this.height,
      actors:frame.actors ?? frame.performers, camX:cx, camY:cy, cameraOffset:{x:cx,y:cy},
      zoom:quality>=5 ? 1 : clamp(zoom,.97,1.03),
    };
    const gl=this.renderer;
    gl.info.reset();
    gl.setRenderTarget(this.post.beauty);
    gl.clear(true,true,false);
    const visible=[frame.showLayers!==false,frame.showFx!==false,frame.showActors!==false];
    const calls=[];
    for(let i=0;i<this.parts.length;i++){
      const part=this.parts[i],before=gl.info.render.calls;
      if(visible[i]){
        part.update(t,sample);
        gl.render(part.scene,part.camera);
      }
      calls.push(gl.info.render.calls-before);
    }
    const bloomLevels=this.post.finish(t,sample,transitionProgress(this.transitionStart,this.duration,t));
    this.rendered=true;
    Object.assign(this.stats,{
      stage:this.def.id, quality, width:this.width, height:this.height, hdr:this.post.hdr,
      drawCalls:gl.info.render.calls, layerCalls:calls[0], fxCalls:calls[1], actorCalls:calls[2],
      bloomLevels, triangles:gl.info.render.triangles,
    });
    return this.stats;
  }
  dispose() {
    if(this.disposed) return;
    this.disposed=true;
    for(const part of this.parts) part.dispose();
    this.post.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
