import {APPEARANCE_OPTIONS,normalizeAppearance} from './avatar-schema.js';
import {FEATURE_PROFILES} from './avatar-feature-catalog.js';
import {measureHairSilhouette,matchHairCatalog} from './avatar-photo-hair-matching.js';

// BiSeNet/CelebAMask-HQ labels: 0 background, 6 eyeglasses, 17 hair, 18 hat.
// Input pixels, mask and normalized landmarks all describe the SAME aligned crop.
// A semantic mask is evidence of a region, not calibrated certainty of a hairstyle.
const quantile=(a,q)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(q*(b.length-1)))];};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const label=(field,value)=>APPEARANCE_OPTIONS[field]?.find(o=>o.value===value)?.label||value;
const hex=rgb=>'#'+rgb.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');
const luma=rgb=>rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;

function colorOf(indices,rgba){
 if(!rgba||indices.length<12)return null;
 let samples=indices.filter(i=>rgba[i*4+3]>240).map(i=>[rgba[i*4],rgba[i*4+1],rgba[i*4+2]]);
 if(samples.length<12)return null;
 // Hair uses the median of eroded hair-only pixels.
 return hex([0,1,2].map(c=>quantile(samples.map(rgb=>rgb[c]),.5)));
}

function frameColor(glasses,mask,w,h,rgba,eyeCenters,eyeWidths,faceHeight,pixel){
 if(!rgba||glasses.length<12)return null;
 const radius=Math.max(2,Math.round(w/128)),band=new Set();
 // The parser labels lenses as well as frames. Sample around their boundary,
 // including a small outer band: thin frames may lie just outside label 6.
 for(const i of glasses){
  const x=i%w,y=Math.floor(i/w);let boundary=false;
  for(const [dx,dy]of [[-radius,0],[radius,0],[0,-radius],[0,radius]]){
   if(x+dx<0||x+dx>=w||y+dy<0||y+dy>=h||mask[i+dy*w+dx]!==6){boundary=true;break;}
  }
  if(!boundary)continue;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;
   const j=i+dy*w+dx,q=pixel(j);
   // Exclude the iris and lash line; black pupils are not black frames.
   if(eyeCenters.some((e,k)=>((q.x-e.x)/(eyeWidths[k]*.62))**2+((q.y-e.y)/Math.max(faceHeight*.022,eyeWidths[k]*.25))**2<1))continue;
   band.add(j);
  }
 }
 const brightness=i=>rgba[i*4]*.2126+rgba[i*4+1]*.7152+rgba[i*4+2]*.0722;
 const darkLines=[...band].filter(i=>{
  const x=i%w,y=Math.floor(i/w),v=brightness(i);if(rgba[i*4+3]<240)return false;
  // A frame is a narrow dark line with lighter pixels on both sides. A broad
  // cheek or nose shadow is dark on at least one side and should not win.
  for(const r of [Math.max(2,radius),Math.max(3,radius+2)])for(const [dx,dy]of [[r,0],[0,r],[r,r],[r,-r]]){
   if(x-dx<0||x-dx>=w||x+dx<0||x+dx>=w||y-dy<0||y-dy>=h||y+dy<0||y+dy>=h)continue;
   if(Math.min(brightness(i+dy*w+dx),brightness(i-dy*w-dx))-v>13)return true;
  }
  return false;
 });
 let samples=darkLines.map(i=>[rgba[i*4],rgba[i*4+1],rgba[i*4+2]]);
 if(samples.length<12)return null;
 // Where actual dark neutral line pixels exist, prefer that evidence over
 // reddish skin creases seen through a transparent lens. Coloured frames are
 // retained when no substantial neutral-line population is present.
 const neutral=samples.filter(rgb=>luma(rgb)<120&&Math.max(...rgb)-Math.min(...rgb)<=24);
 if(neutral.length>=Math.max(12,samples.length*.08))samples=neutral;
 samples.sort((a,b)=>luma(a)-luma(b));
 // Thin frames occupy only a small proportion of the boundary pixels. The
 // lower tail preserves them rather than averaging in skin seen through lenses.
 const dark=samples.slice(0,Math.max(8,Math.floor(samples.length*.22)));
 return hex([0,1,2].map(c=>quantile(dark.map(rgb=>rgb[c]),.5)));
}

function components(mask,w,h,category,accept){
 const visited=new Uint8Array(mask.length),result=[];
 for(let start=0;start<mask.length;start++){
  if(visited[start]||mask[start]!==category||!accept(start%w,Math.floor(start/w)))continue;
  const pixels=[start];visited[start]=1;
  for(let k=0;k<pixels.length;k++){
   const i=pixels[k],x=i%w,y=Math.floor(i/w);
   for(const j of [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1]){
    if(j<0||visited[j]||mask[j]!==category||!accept(j%w,Math.floor(j/w)))continue;
    visited[j]=1;pixels.push(j);
   }
  }
  result.push(pixels);
 }
 return result.sort((a,b)=>b.length-a.length);
}

export function analyzePhotoAttributes({mask,width,height,imageData,landmarks}={},{appearance={}}={}){
 const values={},summary=[],warnings=[],candidates=[],diagnostics={};
 const fitted=normalizeAppearance(appearance),faceAspectScale=fitted.faceWidth/fitted.faceHeight;
 const result=()=>({values,summary,warnings,candidates,diagnostics});
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<32||height<32||!mask||mask.length!==width*height){warnings.push('分割数据不完整，发型与眼镜保持原样。');return result();}
 const ids=[10,152,234,454,33,133,362,263];
 if(!Array.isArray(landmarks)||ids.some(i=>!Number.isFinite(landmarks[i]?.x)||!Number.isFinite(landmarks[i]?.y))){warnings.push('缺少面部定位，发型与眼镜保持原样。');return result();}
 const raw=i=>({x:landmarks[i].x*width,y:landmarks[i].y*height});
 const eyeLeft={x:(raw(33).x+raw(133).x)/2,y:(raw(33).y+raw(133).y)/2},eyeRight={x:(raw(362).x+raw(263).x)/2,y:(raw(362).y+raw(263).y)/2};
 const angle=Math.atan2(eyeRight.y-eyeLeft.y,eyeRight.x-eyeLeft.x),cos=Math.cos(angle),sin=Math.sin(angle);
 const rotate=(x,y)=>({x:x*cos+y*sin,y:-x*sin+y*cos}),p=i=>rotate(raw(i).x,raw(i).y);
 const pixel=i=>rotate(i%width,Math.floor(i/width));
 const top=p(10),chin=p(152),left=p(234),right=p(454),fw=Math.abs(right.x-left.x),fh=chin.y-top.y;
 if(fw<24||fh<32){warnings.push('面部太小，发型与眼镜需要手动确认。');return result();}
 const rgba=imageData?.width===width&&imageData?.height===height&&imageData?.data?.length===mask.length*4?imageData.data:null;
 const headROI=(x,y)=>{const q=rotate(x,y);return q.x>left.x-fw*.55&&q.x<right.x+fw*.55&&q.y>top.y-fh*.95&&q.y<chin.y+fh*.85;};
 const hairComponents=components(mask,width,height,17,headROI),largest=hairComponents[0]?.length||0;
 const hair=hairComponents.filter(c=>c.length>=Math.max(12,largest*.035)).flat();
 diagnostics.hairPixels=hair.length;
 if(hair.length>Math.max(60,fw*fh*.018)){
  const xs=hair.map(i=>pixel(i).x),ys=hair.map(i=>pixel(i).y);
  const minX=quantile(xs,.01),maxX=quantile(xs,.99),minY=quantile(ys,.01),maxY=quantile(ys,.99);
  const clipped=hair.some(i=>i%width<2||i%width>width-3||Math.floor(i/width)<2||Math.floor(i/width)>height-3);
  const descriptor=[clamp((top.y-minY)/fh,0,1.5),clamp((maxY-top.y)/fh,0,2.5),(maxX-minX)/fw];
  diagnostics.hairDescriptor=descriptor;
  const silhouette=measureHairSilhouette({hair,pixel,left,right,eyes:[[33,133],[362,263]].map(([a,b])=>({x:(p(a).x+p(b).x)/2,y:(p(a).y+p(b).y)/2}))});
  const matched=matchHairCatalog(silhouette,{clipped});Object.assign(values,matched.values);candidates.push(...matched.candidates);diagnostics.hairMatch=matched.diagnostics;
  const radius=Math.max(1,Math.round(width/256)),interior=hair.filter(i=>{
   const x=i%width,y=Math.floor(i/width);if(x<radius||y<radius||x>=width-radius||y>=height-radius)return false;
   return [-radius,0,radius].every(dy=>[-radius,0,radius].every(dx=>mask[i+dy*width+dx]===17));
  });
  const hairColor=colorOf(interior,rgba);if(hairColor)values.hairColor=hairColor;
  summary.push(`已对照 ${matched.diagnostics.frontCount} 种前发与 ${matched.diagnostics.backCount} 种后发的真实模型剪影，匹配发际线与可见轮廓。`);if(hairColor)summary.push('已从头发内部采样发色。');
  if(clipped)warnings.push('头发接近照片边缘，长度与发型可能不完整，请确认候选。');
  else if(!values.hairFront||!values.hairBack)warnings.push('部分发层的轮廓匹配不够明确，已保留该层；请确认候选。');
  warnings.push('后脑结构在正面照片中不可见，后发建议只依据可见侧边与长度。');
 }else{
  warnings.push('没有足够清晰的头发区域，保留原发型和发色；不会据此判断光头。');
 }

 const eyeCenters=[[33,133],[362,263]].map(([a,b])=>({x:(p(a).x+p(b).x)/2,y:(p(a).y+p(b).y)/2}));
 const eyeY=(eyeCenters[0].y+eyeCenters[1].y)/2;
 const eyeROI=(x,y)=>{const q=rotate(x,y);return q.x>left.x-fw*.08&&q.x<right.x+fw*.08&&q.y>eyeY-fh*.15&&q.y<eyeY+fh*.17;};
 const glassComponents=components(mask,width,height,6,eyeROI),gLargest=glassComponents[0]?.length||0;
 const glasses=glassComponents.filter(c=>c.length>=Math.max(6,gLargest*.025)).flat();
 diagnostics.glassesPixels=glasses.length;
 const lensPixels=eyeCenters.map(e=>glasses.filter(i=>Math.abs(pixel(i).x-e.x)<fw*.23&&Math.abs(pixel(i).y-e.y)<fh*.15));
 const minimum=Math.max(8,fw*fh*.0012),both=lensPixels.every(a=>a.length>=minimum);
 if(both&&glasses.length>fw*fh*.004){
  const ratios=lensPixels.map(indices=>{const xs=indices.map(i=>pixel(i).x),ys=indices.map(i=>pixel(i).y);return(quantile(xs,.95)-quantile(xs,.05))/Math.max(1,quantile(ys,.95)-quantile(ys,.05));});
  const ratio=(ratios[0]+ratios[1])/2;
  const bounds=lensPixels.map(indices=>{const xs=indices.map(i=>pixel(i).x),ys=indices.map(i=>pixel(i).y);return {x0:quantile(xs,.05),x1:quantile(xs,.95),y0:quantile(ys,.05),y1:quantile(ys,.95)};});
  const cornerFills=bounds.map(b=>{let inside=0,total=0;for(let y=Math.floor(b.y0);y<=b.y1;y++)for(let x=Math.floor(b.x0);x<=b.x1;x++){const u=Math.abs((x-(b.x0+b.x1)/2)/(b.x1-b.x0)*2),v=Math.abs((y-(b.y0+b.y1)/2)/(b.y1-b.y0)*2);if(u<.65||v<.65)continue;const px=Math.round(x*cos-y*sin),py=Math.round(x*sin+y*cos);if(px<0||px>=width||py<0||py>=height)continue;total++;if(mask[py*width+px]===6)inside++;}return inside/Math.max(1,total);});
  const cornerFill=(cornerFills[0]+cornerFills[1])/2;
  const strokeSamples=[];
  if(rgba)for(const b of bounds)for(const u of [.25,.5,.75]){const x=b.x0+(b.x1-b.x0)*u,brightness=y=>{const px=Math.round(x*cos-y*sin),py=Math.round(x*sin+y*cos);if(px<0||px>=width||py<0||py>=height)return 255;const i=(py*width+px)*4;return rgba[i]*.2126+rgba[i+1]*.7152+rgba[i+2]*.0722;};let best=null;for(let y=Math.floor(b.y0-(b.y1-b.y0)*.13);y<b.y0+(b.y1-b.y0)*.20;y++){const dark=brightness(y),contrast=Math.min(brightness(y-4),brightness(y+4))-dark;if(contrast>18&&(!best||contrast>best.contrast))best={y,dark,contrast};}if(best){let count=1;for(const sign of [-1,1])for(let d=1;d<=5;d++){if(brightness(best.y+sign*d)>best.dark+18)break;count++;}if(count<=7)strokeSamples.push(count);}}
  const strokeWidth=strokeSamples.length>=2?quantile(strokeSamples,.5)/fw*.51:null;
  const eyeWidths=[[33,133],[362,263]].map(([a,b])=>Math.hypot(p(a).x-p(b).x,p(a).y-p(b).y));
  const glassesColor=frameColor(glasses,mask,width,height,rgba,eyeCenters,eyeWidths,fh,pixel);if(glassesColor)values.glassesColor=glassesColor;
  const measuredWidth=lensPixels.map(indices=>{const xs=indices.map(i=>pixel(i).x);return quantile(xs,.95)-quantile(xs,.05);}).reduce((a,b)=>a+b,0)/2/fw*.51;
  const frames=APPEARANCE_OPTIONS.glasses.filter(o=>o.value!=='none').map(o=>{const p=FEATURE_PROFILES[o.value]||({round:{shape:'round',w:.064,h:.055,t:.007},square:{shape:'rect',w:.065,h:.045,t:.007},sunglasses:{shape:'round',w:.064,h:.055,t:.007,dark:true},monocle:{shape:'round',w:.064,h:.055,t:.007}})[o.value];if(!p)return null;const size=clamp(measuredWidth/(p.w*2),.7,1.3);return {...o,profile:p,size,distance:Math.abs(Math.log(ratio/(p.w/p.h*faceAspectScale)))*.65+Math.abs(measuredWidth-p.w*2*size)*2+(p.dark?.45:0)+(['rect','round','brow'].includes(p.shape)?0:.12)+(cornerFill>.55&&p.shape==='round'?.24:cornerFill<.35&&p.shape==='rect'?.15:0)+(o.value==='monocle'?.7:0)+p.t*2};}).filter(Boolean).sort((a,b)=>a.distance-b.distance);
  const best=frames[0];values.glasses=best.value;values.glassesSize=Number(best.size.toFixed(3));values.glassesThickness=strokeWidth?Number(clamp(strokeWidth/(best.profile.t*2*best.size),.35,1.5).toFixed(3)):.65;values.glassesLens='clear';
  // The mask can contain more upper-frame pixels than lower-frame pixels.
  // Use the two lens-bound centres, never the area-weighted pixel median.
  const lensCenterY=bounds.reduce((sum,b)=>sum+(b.y0+b.y1)/2,0)/bounds.length;
  values.glassesY=Number(clamp((eyeY-lensCenterY)/fw*.51*faceAspectScale,-.05,.05).toFixed(4));
  const options=[];for(const o of frames){if(options.some(v=>v.profile.shape===o.profile.shape))continue;options.push(o);if(options.length===3)break;}
  candidates.push({field:'glasses',label:'已检测到眼镜，可确认镜框',options:[...options.map(o=>({value:o.value,label:o.label,distance:Number(o.distance.toFixed(4)),patch:{glassesSize:Number(o.size.toFixed(3)),glassesThickness:strokeWidth?Number(clamp(strokeWidth/(o.profile.t*2*o.size),.35,1.5).toFixed(3)):.65,glassesLens:'clear',glassesY:values.glassesY}})),{value:'none',label:label('glasses','none')}],reason:'根据双眼区域宽高比对照真实镜框参数；透明镜片和遮挡仍可能影响框形判断。'});
  diagnostics.glassesMatch={candidates:frames.length,ratio,faceAspectScale,renderedRatio:best.profile.w/best.profile.h*faceAspectScale,lensCenterY,eyeY,cornerFill,strokeWidth,measuredWidth,top:frames.slice(0,5).map(o=>({value:o.value,distance:o.distance}))};
  summary.push(`检测到双眼周围的眼镜区域，匹配${label('glasses',best.value)}。`);
 }else if(glasses.length>0){
  warnings.push('眼镜区域不完整，镜框保持原样，请手动确认。');
  candidates.push({field:'glasses',label:'眼镜需要确认',options:['none','square','round','sunglasses'].map(value=>({value,label:label('glasses',value),score:.25})),reason:'只检测到零散或单侧区域，不能可靠判断。'});
 }else{
  // Absence of a label is not evidence to remove user-selected glasses.
  warnings.push('未检测到可靠眼镜区域，当前眼镜保持原样。');
 }
 return result();
}
