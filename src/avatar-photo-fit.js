import {faceSurfacePoint} from './avatar-model.js';
import {APPEARANCE_RANGES,APPEARANCE_OPTIONS,normalizeAppearance} from './avatar-schema.js';

const SHAPES=APPEARANCE_OPTIONS.faceShape.map(o=>o.value);
const KEYS=['faceWidth','faceHeight','jawWidth','chinLength'];
const PAIRS=[[127,356],[234,454],[93,323],[132,361],[58,288],[172,397],[136,365],[150,379],[149,378],[176,400],[148,377]];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

// Evaluate the real render-model's silhouette at a given local height. The
// renderer applies faceWidth/faceHeight after faceSurfacePoint deformation.
export function modelFaceHalfWidth(appearance,y,side=1){
 const a=normalizeAppearance(appearance);let lo=-1,hi=1;
 const bottom=faceSurfacePoint(a.faceShape,0,-1,0,a)[1]*a.faceHeight;
 const top=faceSurfacePoint(a.faceShape,0,1,0,a)[1]*a.faceHeight;
 if(y<bottom||y>top)return 0;
 for(let i=0;i<20;i++){
  const mid=(lo+hi)/2,ym=faceSurfacePoint(a.faceShape,0,mid,0,a)[1]*a.faceHeight;
  if(ym<y)lo=mid;else hi=mid;
 }
 const yy=(lo+hi)/2;
 return Math.abs(faceSurfacePoint(a.faceShape,side*Math.sqrt(Math.max(0,1-yy*yy)),yy,0,a)[0]*a.faceWidth);
}

export function contourError(a,target){
 if(!target.samples.length)return Infinity;
 const errors=target.samples.map(({x,y,weight=1})=>{
  const predicted=(modelFaceHalfWidth(a,y,1)+modelFaceHalfWidth(a,y,-1))/2;
  return {error:((predicted-x)/.255)**2*weight,weight};
 });
 const chin=faceSurfacePoint(a.faceShape,0,-1,0,a)[1]*a.faceHeight;
 return errors.reduce((s,e)=>s+e.error,0)/errors.reduce((s,e)=>s+e.weight,0)+((chin-target.chin)/.282)**2*.35;
}

// One pixel scale for both axes. The previous independent x/y normalization
// made every photo's head roughly one third wider than the observed portrait.
// Preserve aspect ratio while keeping head area near the authored model area.
export function photoCoordinateFrame({faceWidth,headHeight}){
 const unitsPerPixel=Math.sqrt((.51*.564)/(faceWidth*headHeight));
 return {unitsPerPixel,width:faceWidth*unitsPerPixel,height:headHeight*unitsPerPixel};
}

/** Bounded deterministic coordinate search, all catalog shape candidates.
 * The modest prior retains a readable cartoon silhouette when observations
 * cannot distinguish correlated width/height/jaw parameters. */
export function fitFaceContour(target,initial={}){
 const baseline=normalizeAppearance(initial),beforeError=contourError(baseline,target);
 if(target.samples.length<5||!Number.isFinite(beforeError))return {values:Object.fromEntries(['faceShape',...KEYS].map(k=>[k,baseline[k]])),diagnostics:{method:'insufficient-contour',beforeError:0,afterError:0,candidates:0,iterations:0}};
 const prior=a=>KEYS.reduce((sum,key)=>sum+((a[key]-1)/(APPEARANCE_RANGES[key][1]-APPEARANCE_RANGES[key][0]))**2,0)*.001;
 const score=a=>contourError(a,target)+prior(a);
 let best={...baseline},bestScore=score(best),iterations=0;
 for(const faceShape of SHAPES){
  let a={...baseline,faceShape},cost=score(a);
  for(const step of [.08,.04,.02,.01,.005]){
   for(let sweep=0;sweep<5;sweep++){
    let improved=false;
    for(const key of KEYS)for(const direction of [-1,1]){
     const [min,max]=APPEARANCE_RANGES[key],candidate={...a,[key]:clamp(a[key]+step*direction,min,max)};
     const next=score(candidate);iterations++;
     if(next<cost-1e-10){a=candidate;cost=next;improved=true;}
    }
    if(!improved)break;
   }
  }
  if(cost<bestScore){best=a;bestScore=cost;}
 }
 // Never trade worse measured likeness for the regularizer.
 if(contourError(best,target)>beforeError)best=baseline;
 return {values:Object.fromEntries(['faceShape',...KEYS].map(k=>[k,best[k]])),diagnostics:{method:'bounded-contour-search',beforeError,afterError:contourError(best,target),candidates:SHAPES.length,iterations}};
}

// p are roll-corrected pixel points, positive y down. Crop normalization is
// fixed across all candidates; it is never renormalized to flatter a candidate.
export function photoContourTarget(p,{faceWidth,faceHeight,crownY,headHeight,centerX}){
 const frame=photoCoordinateFrame({faceWidth,headHeight});
 const toY=y=>(.5-(y-crownY)/headHeight)*frame.height;
 const samples=[];
 for(const [i,[left,right]]of PAIRS.entries()){
  const l=p[left],r=p[right];if(!l||!r)continue;
  const span=Math.abs(r.x-l.x);
  if(span<faceWidth*.12||Math.abs(l.y-r.y)>faceHeight*.18)continue;
  const y=toY((l.y+r.y)/2),x=span/2*frame.unitsPerPixel;
  // Dense chin samples must not overwhelm cheek/jaw observations. Facial
  // width and angle are spread across regions, not counted by landmark density.
  const weight=i<3?1.4:i<6?1.2:.65;
  if(Number.isFinite(x)&&Number.isFinite(y))samples.push({x,y,weight});
 }
 return {samples,chin:toY(p[152].y)};
}
