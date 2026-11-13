import {APPEARANCE_RANGES, APPEARANCE_OPTIONS, normalizeAppearance} from './avatar-schema.js';
import {fitFaceContour,photoContourTarget,photoCoordinateFrame} from './avatar-photo-fit.js';

// MediaPipe Face Landmarker topology. These are geometry measurements, never
// identity, age, sex or ethnicity classifiers. Only observed face fields are set.
const REQUIRED=[10,152,234,454,172,397,127,356,33,133,159,145,362,263,386,374,70,63,105,107,336,334,293,300,1,2,168,98,327,61,291,0,17,13,14,50,280,101,330];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const median=a=>{const s=[...a].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
function fail(code,message){const error=new Error(message);error.code=code;throw error;}

// Hair is not the skull. Only low-volume, uncut central silhouettes can bound
// the crown; subtract a small hair-volume allowance and retain a prior otherwise.
export function estimatePhotoCrown(parsing){
 const fallback={ratio:.22,source:'anatomical-prior'};
 const {mask,width:w,height:h,landmarks:l}=parsing||{};
 if(!Number.isInteger(w)||!Number.isInteger(h)||mask?.length!==w*h||!Array.isArray(l)||[10,152,234,454,33,133,362,263].some(i=>!Number.isFinite(l[i]?.x)||!Number.isFinite(l[i]?.y)))return fallback;
 const eye=i=>({x:l[i].x*w,y:l[i].y*h}),el=midpoint(eye(33),eye(133)),er=midpoint(eye(362),eye(263)),angle=Math.atan2(er.y-el.y,er.x-el.x),c=Math.cos(angle),s=Math.sin(angle);
 const rotate=(x,y)=>({x:x*c+y*s,y:-x*s+y*c}),p=i=>rotate(l[i].x*w,l[i].y*h),top=p(10),chin=p(152),left=p(234),right=p(454),fw=right.x-left.x,fh=chin.y-top.y,cx=(left.x+right.x)/2;
 if(fw<20||fh<30)return fallback;
 const central=[],allX=[];let clipped=false;
 for(let i=0;i<mask.length;i++)if(mask[i]===17){const x=i%w,y=Math.floor(i/w),q=rotate(x,y);if(q.y>top.y-fh*.8&&q.y<top.y+fh*.5&&Math.abs(q.x-cx)<fw){allX.push(q.x);if(Math.abs(q.x-cx)<fw*.45){central.push(q.y);if(x<2||x>w-3||y<2||y>h-3)clipped=true;}}}
 if(central.length<40||allX.length<60||clipped)return fallback;
 central.sort((a,b)=>a-b);allX.sort((a,b)=>a-b);
 const at=(a,q)=>a[Math.floor((a.length-1)*q)],rise=(top.y-at(central,.02))/fh,width=(at(allX,.98)-at(allX,.02))/fw;
 if(rise<.12||rise>.55||width>1.45)return fallback;
 return {ratio:clamp(rise-.06,.10,.40),source:'bounded-hair-silhouette'};
}

export function detectVisibleTeeth(imageData,landmarks){
 const {width:w,height:h,data}=imageData||{};
 if(!Number.isInteger(w)||!Number.isInteger(h)||data?.length!==w*h*4||[13,14,61,291].some(i=>!Number.isFinite(landmarks?.[i]?.x)||!Number.isFinite(landmarks?.[i]?.y)))return false;
 const p=i=>({x:landmarks[i].x*w,y:landmarks[i].y*h}),upper=p(13),lower=p(14),left=p(61),right=p(291),mouthWidth=distance(left,right),gap=distance(upper,lower);
 if(mouthWidth<12||gap<2.5||gap/mouthWidth<.04)return false;
 const ux=(right.x-left.x)/mouthWidth,uy=(right.y-left.y)/mouthWidth,cx=(upper.x+lower.x)/2,cy=(upper.y+lower.y)/2,pixels=[];
 const radius=Math.ceil(mouthWidth*.3+gap);
 for(let y=Math.max(0,Math.floor(cy-radius));y<=Math.min(h-1,cy+radius);y++)for(let x=Math.max(0,Math.floor(cx-radius));x<=Math.min(w-1,cx+radius);x++){
  const dx=x-cx,dy=y-cy,along=dx*ux+dy*uy,across=-dx*uy+dy*ux;
  if(Math.abs(along)>mouthWidth*.28||Math.abs(across)>gap*.4)continue;
  const i=(y*w+x)*4;if(data[i+3]<240)continue;const rgb=[data[i],data[i+1],data[i+2]];
  pixels.push({luma:rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722,chroma:Math.max(...rgb)-Math.min(...rgb),low:Math.min(...rgb)});
 }
 if(pixels.length<12)return false;
 const brightness=pixels.map(p=>p.luma).sort((a,b)=>a-b),quartile=q=>brightness[Math.floor((brightness.length-1)*q)],threshold=Math.max(110,quartile(.25)+25);
 // Teeth need a bright low-chroma patch *inside* an observed opening with a
 // darker mouth around it. Uniform bright skin and closed glossy lips fail.
 if(quartile(.90)-quartile(.10)<30)return false;
 const count=pixels.filter(p=>p.luma>threshold&&p.chroma<75&&p.low>70).length;
 return count>=Math.max(6,pixels.length*.12)&&count<pixels.length*.85;
}

function parsedBrowColor(parsing){
 const {mask,width,height,imageData}=parsing||{},data=imageData?.data;
 if(mask?.length!==width*height||data?.length!==width*height*4)return null;
 const pixels=[],skin=[],counts=[0,0],luma=p=>p[0]*.2126+p[1]*.7152+p[2]*.0722;
 for(let i=0;i<mask.length;i++){if(mask[i]===2||mask[i]===3){counts[mask[i]-2]++;if(data[i*4+3]>240)pixels.push([data[i*4],data[i*4+1],data[i*4+2]]);}else if(mask[i]===1&&i%13===0)skin.push([data[i*4],data[i*4+1],data[i*4+2]]);}
 if(counts.some(n=>n<8)||pixels.length<24)return null;
 if(skin.length<20)return null;
 const skinLuma=median(skin.map(luma)),dark=pixels.filter(p=>luma(p)<skinLuma-25);
 if(dark.length<Math.max(12,pixels.length*.15))return null;
 const rgb=[0,1,2].map(c=>median(dark.map(p=>p[c])));
 return '#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
}

function sampleColor(imageData,centers,radius){
 if(!imageData||!Number.isInteger(imageData.width)||!Number.isInteger(imageData.height)||!imageData.data||imageData.data.length!==imageData.width*imageData.height*4)return null;
 const {width,height,data}=imageData,channels=[[],[],[]];
 for(const p of centers){const cx=p.x*width,cy=p.y*height,r=Math.max(1.5,radius*width);
  for(let y=Math.max(0,Math.floor(cy-r));y<=Math.min(height-1,Math.ceil(cy+r));y++)for(let x=Math.max(0,Math.floor(cx-r));x<=Math.min(width-1,Math.ceil(cx+r));x++){
   if((x-cx)**2+(y-cy)**2>r*r)continue;const i=(y*width+x)*4;if(data[i+3]<240)continue;
   for(let c=0;c<3;c++)channels[c].push(data[i+c]);
  }
 }
 if(channels[0].length<6)return null;
 const rgb=channels.map(median);
 return {hex:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''),spread:mean(channels.map((a,i)=>median(a.map(v=>Math.abs(v-rgb[i])))))};
}

/** Convert one detected face into a bounded, editable appearance patch.
 * width/height describe the image passed to the detector. imageData may be a
 * resized copy at the same aspect ratio; sampling uses normalized coordinates.
 * No original image or landmarks are retained in the returned object.
 */
export function mapPhotoToAppearance(landmarks,{width,height,imageData,appearance={},blendshapes=[],parsing}={}){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<64||height<64)fail('IMAGE_SIZE','照片尺寸太小，请选择至少 64 × 64 像素的清晰照片。');
 if(!Array.isArray(landmarks)||landmarks.length<468||REQUIRED.some(i=>!landmarks[i]||!Number.isFinite(landmarks[i].x)||!Number.isFinite(landmarks[i].y)))fail('LANDMARKS','未能取得完整面部特征，请换一张清晰的正面照片。');
 if(REQUIRED.some(i=>landmarks[i].x<0||landmarks[i].x>1||landmarks[i].y<0||landmarks[i].y>1))fail('CROPPED','面部没有完整进入照片，请选择额头到下巴均完整的照片。');
 const pixels=landmarks.map(p=>({x:p.x*width,y:p.y*height}));
 const le=midpoint(pixels[33],pixels[133]),re=midpoint(pixels[362],pixels[263]);
 const eyeDistance=distance(le,re),center=midpoint(le,re),angle=Math.atan2(re.y-le.y,re.x-le.x);
 if(eyeDistance<24)fail('FACE_SMALL','照片中的人脸太小，请裁剪到面部附近或换一张更清晰的近照。');
 if(Math.abs(angle)>Math.PI/3)fail('POSE','请使用接近竖直的正面照片，避免倒置或大幅倾斜。');
 const c=Math.cos(angle),s=Math.sin(angle);
 const p=pixels.map(v=>({x:(v.x-center.x)*c+(v.y-center.y)*s,y:-(v.x-center.x)*s+(v.y-center.y)*c}));
 let fw=distance(p[234],p[454]);const fh=p[152].y-p[10].y;
 if(fw<64||fh<80||fw/width<.08)fail('FACE_SMALL','照片中的人脸太小，请裁剪到面部附近或换一张更清晰的近照。');
 if(fh/fw<.85||fh/fw>2.05||p[10].y>=0||p[152].y<=0)fail('POSE','面部角度不适合匹配，请使用平视镜头、额头与下巴完整的正面照。');
 const leftSpan=Math.abs(p[1].x-p[234].x),rightSpan=Math.abs(p[454].x-p[1].x);
 const eyeWidths=[distance(p[33],p[133]),distance(p[362],p[263])];
 const asymmetry=Math.abs(leftSpan-rightSpan)/fw;
 if(asymmetry>.34||Math.min(...eyeWidths)/Math.max(...eyeWidths)<.58)fail('SIDE_FACE','这张照片偏侧面或五官有遮挡，请换一张双眼都清楚可见的正面照。');
 const warnings=[];
 if(fw<140)warnings.push('面部像素较少，细小五官和颜色可能不准确。');
 if(asymmetry>.12)warnings.push('面部略有转向，鼻嘴已向面部中轴保守对齐；单张照片不能精确恢复三维姿态，请检查眼距和鼻嘴。');
 // Landmarker depth is approximate; use only a small, coherent yaw correction.
 // Keep the 2D roll/asymmetry path for detectors without depth or unstable depth.
 const yawSamples=[[234,454],[127,356],[33,263]].map(([l,r])=>Number.isFinite(landmarks[l].z)&&Number.isFinite(landmarks[r].z)?Math.atan2((landmarks[r].z-landmarks[l].z)*width,p[r].x-p[l].x):NaN).filter(Number.isFinite);
 let yaw=0;
 if(yawSamples.length===3&&Math.max(...yawSamples)-Math.min(...yawSamples)<.13){const measured=median(yawSamples);if(Math.abs(measured)<.44)yaw=measured;}
 const yawStretch=1/Math.cos(yaw),poseCenter=(p[234].x+p[454].x)/2;
 if(yawStretch>1.001){for(const v of p)v.x=poseCenter+(v.x-poseCenter)*yawStretch;fw=distance(p[234],p[454]);eyeWidths[0]=distance(p[33],p[133]);eyeWidths[1]=distance(p[362],p[263]);}
 const jaw=distance(p[172],p[397])/fw,temple=distance(p[127],p[356])/fw,aspect=fh/fw;
 let faceShape=aspect>1.48?'long':aspect<1.19?'round':jaw>.80?'square':jaw<.67&&temple>.88?'heart':temple<.83?'diamond':'oval';
 const crown=estimatePhotoCrown(parsing),crownY=p[10].y-fh*crown.ratio,headHeight=fh*(1+crown.ratio);
 const fit=fitFaceContour(photoContourTarget(p,{faceWidth:fw,faceHeight:fh,crownY,headHeight,centerX:(p[234].x+p[454].x)/2}),{
  ...appearance,faceShape,faceWidth:clamp(Math.sqrt(1.34/aspect),.9,1.12),faceHeight:clamp(Math.sqrt(aspect/1.34),.9,1.12),jawWidth:1+(jaw-.73)*1.5,chinLength:1
 });
 faceShape=fit.values.faceShape;
 Object.assign(fit.diagnostics,{coordinateFrame:'isotropic-photo',crownSource:crown.source,crownExtensionRatio:Number(crown.ratio.toFixed(4)),yawDegrees:Number((yaw*180/Math.PI).toFixed(2))});
 // The contour target stays in one fixed coordinate system across shapes.
 // Features are children of the scaled head: invert the final fitted scale,
 // rather than applying the selected shape's nominal width/height a second time.
 const frame=photoCoordinateFrame({faceWidth:fw,headHeight});
 const modelW=frame.width/fit.values.faceWidth;
 const modelH=frame.height/fit.values.faceHeight;
 const faceCenterX=(p[234].x+p[454].x)/2;
 // In a turned photograph, the projected midline is offset from the cheek
 // midpoint. Do not bake that camera pose into a permanently off-centre face.
 // Interpolate bridge-to-chin instead of using the protruding nose tip; damp
 // the remaining residual because a single image cannot separate depth from
 // genuine asymmetry. Near-frontal photos keep their observed asymmetry.
 const poseWeight=clamp((asymmetry-.12)/.12,0,1);
 const axisAt=y=>{
  const t=clamp((y-p[168].y)/Math.max(1,p[152].y-p[168].y),0,1);
  return p[168].x*(1-t)+p[152].x*t;
 };
 const centeredX=v=>{
  const raw=v.x-faceCenterX,axis=axisAt(v.y)-faceCenterX;
  return (raw-axis*poseWeight)*(1-.6*poseWeight)/fw*modelW;
 };
 // Landmark 10 is the upper forehead, not the top of the cranium.
 const yLocal=v=>(.5-(v.y-crownY)/headHeight)*modelH;
 const eyeHeight=mean([distance(p[159],p[145]),distance(p[386],p[374])]);
 const eyeWidth=mean(eyeWidths),eyeRatio=eyeHeight/eyeWidth;
 if(eyeRatio<.095)fail('EYES_CLOSED','眼睛闭合或被遮挡，无法可靠匹配眼型。请选择双眼睁开的照片。');
 const eyeStyle=eyeRatio<.19?'narrow':eyeRatio>.38?'round':'almond';
 const baseEyeWidth=eyeStyle==='round'?.088:eyeStyle==='narrow'?.110:.108;
 const baseEyeHeight=eyeStyle==='round'?.05:eyeStyle==='narrow'?.027:.040;
 const eyes=[midpoint(p[33],p[133]),midpoint(p[362],p[263])];
 const browLeft=[70,63,105,107].map(i=>p[i]),browRight=[336,334,293,300].map(i=>p[i]);
 const brows=[midpoint(p[70],p[107]),midpoint(p[336],p[300])];
 const browWidth=mean([distance(p[70],p[107]),distance(p[336],p[300])]);
 const arcOf=points=>{const a=points[0],b=points.at(-1),length=distance(a,b);return Math.max(...points.slice(1,-1).map(v=>Math.abs((v.x-a.x)*(b.y-a.y)-(v.y-a.y)*(b.x-a.x))))/(length*length);};
 const browArch=mean([arcOf(browLeft),arcOf(browRight)]);
 const noseWidth=distance(p[98],p[327])/fw,noseSize=clamp(1+(distance(p[98],p[327])/fw-.21)*2.8,.35,1.8);
 const noseCenter=midpoint(p[98],p[327]),mouthCenter=midpoint(p[61],p[291]),mouthWidth=distance(p[61],p[291])/fw;
 const mouthOpen=distance(p[13],p[14])/distance(p[61],p[291]);
 const mouthScale=clamp(Math.sqrt(mouthWidth*modelW/.10),.8,1.6);
 const categories=Array.isArray(blendshapes)?blendshapes:[];
 const blend=name=>categories.find(v=>v.categoryName===name)?.score||0;
 const smileScore=(blend('mouthSmileLeft')+blend('mouthSmileRight'))/2;
 const frownScore=(blend('mouthFrownLeft')+blend('mouthFrownRight'))/2;
 const lipCenter=(p[0].y+p[17].y)/2,cornerRise=(lipCenter-mouthCenter.y)/distance(p[61],p[291]);
 const smiling=smileScore>.35||(!categories.some(v=>v.categoryName==='mouthSmileLeft')&&cornerRise>.045);
 const teethVisible=smiling&&detectVisibleTeeth(imageData,landmarks);
 const mouthStyle=smiling?(mouthOpen>.13||teethVisible?'grin':'smile'):frownScore>.45?'frown':'neutral';
 if(mouthOpen>.13)warnings.push(smiling?'检测到张嘴微笑，已选择露齿笑组件；可以继续调整表情。':'照片中嘴巴张开，已匹配唇宽并保留自然闭嘴形态；可手动调整表情。');
 // Base positions and feature widths match avatar-model.js; neutral feature
 // sizes deliberately damp photographic extremes for the cartoon silhouette.
 const values={
  ...fit.values,
  eyeStyle,eyeSize:1,eyeWidth:eyeWidth/fw*modelW/baseEyeWidth,eyeHeight:eyeHeight/headHeight*modelH/baseEyeHeight,eyeLid:.18,
  eyeSpacing:distance(eyes[0],eyes[1])/fw*modelW/2-.089,eyeY:mean(eyes.map(yLocal))-.035,
  eyeRotation:mean([Math.atan2(p[133].y-p[33].y,Math.abs(p[133].x-p[33].x)),Math.atan2(p[362].y-p[263].y,Math.abs(p[362].x-p[263].x))])*180/Math.PI,
  // Width evidence should not enlarge the arch and thickness as a side effect.
  browStyle:browArch>.21?'arched':browArch<.10?'straight':'soft',browSize:1,browWidth:browWidth/fw*modelW/.10,browHeight:1,
  browSpacing:distance(brows[0],brows[1])/fw*modelW/2-.092,browY:mean(brows.map(yLocal))-.089,
  browRotation:mean([Math.atan2(p[107].y-p[70].y,Math.abs(p[107].x-p[70].x)),Math.atan2(p[336].y-p[300].y,Math.abs(p[336].x-p[300].x))])*180/Math.PI,
  noseStyle:noseWidth>.25?'wide':noseWidth<.17?'small':'round',noseSize,
  noseX:centeredX(noseCenter),noseY:yLocal(noseCenter)+.045*noseSize+.025,
  mouthStyle,mouthSize:mouthScale,mouthWidth:mouthWidth*modelW/(.10*mouthScale),mouthHeight:teethVisible&&mouthOpen<.13?.6:clamp(distance(p[0],p[17])/headHeight/.075/mouthScale,.7,1.3),
  mouthX:centeredX(mouthCenter),mouthY:yLocal(mouthCenter)+.132,mouthRotation:-Math.atan2(p[291].y-p[61].y,p[291].x-p[61].x)*180/Math.PI,
 };
 const skin=sampleColor(imageData,[50,280,101,330].map(i=>landmarks[i]),fw/width*.018);
 const lips=sampleColor(imageData,[midpoint(landmarks[0],landmarks[13]),midpoint(landmarks[14],landmarks[17])],fw/width*.006);
 if(skin){values.skinColor=skin.hex;if(skin.spread>25)warnings.push('面部明暗或妆容差异较大，肤色取两颊中间值，可继续微调。');}
 if(lips)values.mouthColor=lips.hex;
 const browColor=parsedBrowColor(parsing);if(browColor)values.browColor=browColor;
 else if(parsing)warnings.push('眉毛像素与肤色或镜框难以分离，眉色保留原样，可手动确认。');
 if(!skin)warnings.push('未取得可靠颜色采样，已保留当前颜色。');
 const normalized=normalizeAppearance(values);
 const clippedFields=Object.keys(values).filter(key=>APPEARANCE_RANGES[key]&&Math.abs(values[key]-normalized[key])>.00001);
 fit.diagnostics.clippedFields=clippedFields;
 if(clippedFields.length)warnings.push('部分照片比例超过当前组件的调节范围，已保留在可编辑边界内；请检查眼睛、眉毛和嘴部。');
 for(const key of Object.keys(values)){values[key]=normalized[key];if(APPEARANCE_RANGES[key])values[key]=Number(values[key].toFixed(5));}
 const names=Object.fromEntries(APPEARANCE_OPTIONS.faceShape.map(o=>[o.value,o.label]));
 if(teethVisible)warnings.push('嘴部开口内检测到浅色牙齿区域，已匹配露齿微笑；可以继续调整开合程度。');
 return {values,fit:fit.diagnostics,summary:[`轮廓接近${names[faceShape]}${fit.diagnostics.candidates?`（已比较 ${fit.diagnostics.candidates} 种轮廓并拟合）`:''}`,`已匹配眼型、眼距、眉毛与鼻嘴位置`,skin?(lips?'已从面部采样肤色和唇色':'已从面部采样肤色，唇色保留原值'):'已保留原有颜色'],warnings};
}


