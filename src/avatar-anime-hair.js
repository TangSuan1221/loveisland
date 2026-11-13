import * as THREE from 'three';
// Small authored families: each is structurally different, not a numbered scale variant.
export const ANIME_FRONT=[['anime_center','动漫 · 错落中分'],['anime_swept','动漫 · 短碎斜帘'],['anime_fan','动漫 · 侧向尖簇'],['anime_flame','动漫 · 高冠美人尖'],['anime_arcfringe','动漫 · 弧顶错落齐刘海']].map(([value,label],variant)=>({value,label,family:'anime',variant}));
export const ANIME_BACK=[['anime_bob','动漫 · 贴颈碎短发'],['anime_twintails','动漫 · 弧形长双尾'],['anime_braid','动漫 · 肩前长辫'],['anime_short','动漫 · 紧凑后簇'],['anime_frame','动漫 · 贴颈侧帘']].map(([value,label],variant)=>({value,label,family:'anime',variant}));
export function animeHairIcon(value){
 const paths={anime_arcfringe:'M7 31C6 16 16 4 32 4C49 4 58 17 57 32L52 37Q49 36 46 30Q45 38 41 36L37 30Q36 41 32 39Q26 37 25 30Q23 41 19 37L17 30Q14 37 12 35L10 31Z',anime_frame:'M9 31C6 11 19 4 32 4C47 4 58 15 55 32L51 58Q44 54 45 35L43 22Q32 15 21 22L20 37Q21 55 14 59ZM22 43L29 48L25 54ZM35 48L43 43L39 54Z',anime_center:'M10 30Q9 5 32 7Q55 4 54 31L47 46Q48 26 35 17L39 37L30 29L24 39L22 23L14 45Z',anime_swept:'M9 32Q8 5 33 6Q53 7 55 29L48 45L45 26L37 39L34 25L24 37L24 21L12 43Z',anime_fan:'M12 37L1 28L17 24L7 9L28 18L28 1L42 19L59 10L51 28L62 30L48 38L36 29L28 40L19 29Z',anime_flame:'M13 39L5 20L20 27L14 4L29 19L33 1L44 22L54 8L55 39L44 31L33 40L22 30Z',anime_twintails:'M18 27Q13 8 32 6Q51 8 46 27L41 21L23 21ZM18 15Q-2 26 10 61Q25 49 19 34ZM46 15Q67 26 54 61Q39 49 45 34Z',anime_braid:'M12 38L12 22Q11 6 32 6Q53 7 52 25L47 37L45 24L19 23L18 42ZM46 33Q55 36 48 44Q56 49 48 54L45 62L40 53Q34 47 41 42Q34 34 46 33Z',anime_bob:'M10 44L9 22Q11 4 32 6Q54 5 56 25L52 49L44 44L46 23L18 23L19 46Z',anime_short:'M12 35Q6 8 32 6Q56 7 53 35L44 32L44 24L20 24L20 36Z'};
 return `<path d="${paths[value]||paths.anime_center}" fill="currentColor"/>`;
}

// The reference has one uninterrupted crown/fringe, not six overlapping panels.
// Explicitly authored short locks change ONLY its lower edge (head-local units).
// Round8 changes only the four lower central cubics: the left flank sweeps
// into each accepted tip, while the right flank turns in earlier and steeper.
// Different lower-body width distributions break the repeated straight V;
// the round7 upper valley curves/shoulders, all six tips and dome stay fixed.
// No row-wide scaling, extra teeth, round bowls or needle-like extensions.
const ARC_NOTCHES=[[-.254,.139],[-.198,.119],[-.110,.132],[-.018,.138],[.058,.130],[.165,.120],[.254,.133]];
const ARC_TIPS=[[-.224,.099],[-.166,.085],[-.051,.076],[.027,.063],[.130,.088],[.215,.105]];
const ARC_DOME={x:.294,y:.370,z:.263,cy:.088,cz:-.012}; // round3 apex .458 is locked
const bezier=(p,t)=>p[0].map((_,axis)=>(1-t)**3*p[0][axis]+3*(1-t)**2*t*p[1][axis]+3*(1-t)*t*t*p[2][axis]+t**3*p[3][axis]);
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Two continuous-tangent shoulders per lock. The narrow valley mouths and
// tapered ends are actual shell boundaries, independent of the flow strokes.
// Each left/right pair has its own bias; these are not six copied cones.
const ARC_SHOULDERS=[
 [-.239,.109],[-.211,.109],[-.181,.105],[-.123,.11],[-.098,.111],[-.027,.112],
 [-.009,.11],[.048,.105],[.077,.111],[.146,.109],[.199,.114],[.23,.117],
];
const ARC_HEM=[
 [ARC_NOTCHES[0],[-.253,.119],[-.245,.113],ARC_SHOULDERS[0]],
 [ARC_SHOULDERS[0],[-.233,.105],[-.2255,.103],ARC_TIPS[0]],
 [ARC_TIPS[0],[-.2225,.104],[-.216,.108],ARC_SHOULDERS[1]],
 [ARC_SHOULDERS[1],[-.206,.11],[-.1985,.112],ARC_NOTCHES[1]],
 [ARC_NOTCHES[1],[-.1975,.11],[-.185,.109],ARC_SHOULDERS[2]],
 [ARC_SHOULDERS[2],[-.177,.101],[-.168,.091],ARC_TIPS[1]],
 [ARC_TIPS[1],[-.164,.092],[-.129,.104],ARC_SHOULDERS[3]],
 [ARC_SHOULDERS[3],[-.117,.116],[-.1105,.12],ARC_NOTCHES[2]],
 [ARC_NOTCHES[2],[-.1095,.122],[-.103,.12],ARC_SHOULDERS[4]],
 [ARC_SHOULDERS[4],[-.09,.0966],[-.064,.081],ARC_TIPS[2]],
 [ARC_TIPS[2],[-.0495,.091],[-.03,.104],ARC_SHOULDERS[5]],
 [ARC_SHOULDERS[5],[-.024,.12],[-.0185,.125],ARC_NOTCHES[3]],
 [ARC_NOTCHES[3],[-.0175,.125],[-.012,.118],ARC_SHOULDERS[6]],
 [ARC_SHOULDERS[6],[-.0045,.098],[.012,.068],ARC_TIPS[3]],
 [ARC_TIPS[3],[.0285,.083],[.045,.094],ARC_SHOULDERS[7]],
 [ARC_SHOULDERS[7],[.051,.116],[.0575,.119],ARC_NOTCHES[4]],
 [ARC_NOTCHES[4],[.0585,.119],[.071,.116],ARC_SHOULDERS[8]],
 [ARC_SHOULDERS[8],[.083,.106],[.127,.095],ARC_TIPS[4]],
 [ARC_TIPS[4],[.132,.094],[.14,.106],ARC_SHOULDERS[9]],
 [ARC_SHOULDERS[9],[.152,.112],[.1645,.109],ARC_NOTCHES[5]],
 [ARC_NOTCHES[5],[.1655,.113],[.19,.117],ARC_SHOULDERS[10]],
 [ARC_SHOULDERS[10],[.208,.111],[.213,.109],ARC_TIPS[5]],
 [ARC_TIPS[5],[.217,.109],[.225,.114],ARC_SHOULDERS[11]],
 [ARC_SHOULDERS[11],[.235,.12],[.253,.118],ARC_NOTCHES[6]],
];
function arcHem(x){
 if(x<ARC_NOTCHES[0][0])return mix(ARC_DOME.cy,ARC_NOTCHES[0][1],smooth((x+ARC_DOME.x)/.040));
 if(x>ARC_NOTCHES.at(-1)[0])return mix(ARC_NOTCHES.at(-1)[1],ARC_DOME.cy,smooth((x-.254)/.040));
 const curve=ARC_HEM.find(p=>x<=p[3][0]);let lo=0,hi=1;
 for(let i=0;i<16;i++){const t=(lo+hi)/2;if(bezier(curve,t)[0]<x)lo=t;else hi=t;}
 return bezier(curve,(lo+hi)/2)[1];
}
// Smooth analytic depth, independent of the face projection's clamped boundary.
// The flatter anterior cross-section encloses the forehead without making a
// frontAt() discontinuity into an angular wing at the temples or crown.
function arcDepth(x,y){
 const r=Math.sqrt(Math.max(.00001,1-((y-ARC_DOME.cy)/ARC_DOME.y)**2));
 const cosine=Math.sqrt(Math.max(0,1-(x/(ARC_DOME.x*r))**2));
 return ARC_DOME.cz+ARC_DOME.z*r*Math.sqrt(cosine);
}

// One indexed watertight solid per patch. Front, reverse and perimeter share
// vertices; even the rounded tips retain width instead of a degenerate last row.
function authoredSolid(surface,faceScale,sample,color,name,rows=32,cols=12){
 const positions=[],indices=[],count=(rows+1)*(cols+1);
 for(let layer=0;layer<2;layer++)for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){
  const p=sample(r/rows,c/cols)[layer];positions.push(...p.map((n,i)=>n*faceScale[i]));
 }
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const k=r*(cols+1)+c,n=k+cols+1;
  indices.push(k,n,k+1,k+1,n,n+1,k+count,k+1+count,n+count,k+1+count,n+1+count,n+count);
 }
 const rim=[];
 for(let c=0;c<=cols;c++)rim.push(c);
 for(let r=1;r<=rows;r++)rim.push(r*(cols+1)+cols);
 for(let c=cols-1;c>=0;c--)rim.push(rows*(cols+1)+c);
 for(let r=rows-1;r>0;r--)rim.push(r*(cols+1));
 for(let i=0;i<rim.length;i++){
  const a=rim[i],b=rim[(i+1)%rim.length];indices.push(a,b,b+count,a,b+count,a+count);
 }
 return outwardSurface(surface,positions,indices,color,name);
}
function outwardSurface(surface,positions,indices,color,name){
 // Mirrored authored rails and rear-facing patches must still shade outwards.
 let volume=0;
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
  volume+=positions[a]*(positions[b+1]*positions[c+2]-positions[b+2]*positions[c+1])
   +positions[a+1]*(positions[b+2]*positions[c]-positions[b]*positions[c+2])
   +positions[a+2]*(positions[b]*positions[c+1]-positions[b+1]*positions[c]);
 }
 if(volume<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 return surface(positions,indices,color,name);
}
function buildArcFringe({a,surface,faceScale}){
 // A single closed shell owns both the round crown and the complete fringe.
 // No upper lock boundaries, detached root caps or outline-producing overlaps.
 const positions=[],indices=[],rows=56;
 // Sample exact authored X positions, including both sides of every tip/valley.
 // A uniform angle grid alone rounds off the narrow valleys or shifts the tips
 // horizontally when the hem moves up the dome. Solve the rim angle from X/Y.
 const xs=[-ARC_DOME.x,ARC_DOME.x];
 for(const p of [...ARC_NOTCHES,...ARC_TIPS,...ARC_SHOULDERS])for(const dx of [-.006,-.002,0,.002,.006])xs.push(p[0]+dx);
 for(let i=1;i<240;i++){
  const x=ARC_DOME.x*Math.sin(-Math.PI/2+i/240*Math.PI);
  if(!xs.some(p=>Math.abs(p-x)<.00015))xs.push(x);
 }
 xs.sort((a,b)=>a-b);
 // Shoulder offsets can coincide with notch offsets; collapse those exact
 // columns before triangulation, preserving the authored silhouette samples.
 const columns=xs.filter((x,i)=>!i||x-xs[i-1]>1e-8).map(x=>{
  const theta=Math.acos((arcHem(x)-ARC_DOME.cy)/ARC_DOME.y);
  const sin=Math.max(-1,Math.min(1,x/(ARC_DOME.x*Math.sin(theta))));
  return {sin,cos:Math.sqrt(Math.max(0,1-sin*sin)),theta};
 });
 for(let c=1;c<240;c++){
  const azimuth=Math.PI/2+c/240*Math.PI,cos=Math.cos(azimuth);
  const hem=mix(ARC_DOME.cy,.035,cos*cos);
  columns.push({sin:Math.sin(azimuth),cos,theta:Math.acos((hem-ARC_DOME.cy)/ARC_DOME.y)});
 }
 const cols=columns.length,layerCount=1+rows*cols;
 for(let layer=0;layer<2;layer++){
  positions.push(0,(ARC_DOME.cy+ARC_DOME.y-layer*.012)*faceScale[1],ARC_DOME.cz*faceScale[2]);
  for(let r=1;r<=rows;r++)for(const column of columns){
   const t=r/rows,theta=t*column.theta,radial=Math.sin(theta);
   const x=ARC_DOME.x*radial*column.sin*(layer?.974:1);
   const y=ARC_DOME.cy+ARC_DOME.y*Math.cos(theta)+(layer?-.012*(1-t)**2+.0025*t**8:0);
   const cross=column.cos>=0?Math.sqrt(column.cos):column.cos;
   const z=ARC_DOME.cz+ARC_DOME.z*radial*cross*(layer?.935:1);
   positions.push(x*faceScale[0],y*faceScale[1],z*faceScale[2]);
  }
  const offset=layer*layerCount;
  const tri=(a,b,c)=>indices.push(...(layer?[a,c,b]:[a,b,c]).map(i=>i+offset));
  for(let c=0;c<cols;c++)tri(0,1+c,1+(c+1)%cols);
  for(let r=0;r<rows-1;r++)for(let c=0;c<cols;c++){
   const a=1+r*cols+c,b=1+r*cols+(c+1)%cols;tri(a,a+cols,b);tri(b,a+cols,b+cols);
  }
 }
 for(let c=0;c<cols;c++){
  const a=1+(rows-1)*cols+c,b=1+(rows-1)*cols+(c+1)%cols;
  indices.push(b,a,a+layerCount,b,a+layerCount,b+layerCount);
 }
 outwardSurface(surface,positions,indices,a.hairColor,'front-anime_arcfringe-crown');
 // A narrow off-centre coloured root seam over solid hair, never exposed scalp.
 // Two-tone remains opt-in; no brown tint is applied to the requested orange-red.
 const seam=a.hairTwoTone?a.hairSecondaryColor:'#'+new THREE.Color(a.hairColor).lerp(new THREE.Color('#ffffff'),.14).getHexString();
 authoredSolid(surface,faceScale,(t,u)=>{
  const p=bezier([[.010,.434],[.015,.409],[.022,.353],[.024,.313]],t);
  const x=p[0]+(u-.5)*(.0032-.0015*t),y=p[1],z=arcDepth(x,y)+.0011;
  return [[x,y,z],[x,y,z-.002]];
 },seam,'front-anime_arcfringe-part',32,2);
 // Two tapered same-hue flow marks follow the crown near the temples. These
 // are thin closed surface-following solids, not black outlines or cuts in
 // the crown; the silhouette remains entirely owned by the single shell.
 const flowColor='#'+new THREE.Color(a.hairColor).multiplyScalar(.62).getHexString();
 const flows=[['left',[[-.139,.318],[-.176,.289],[-.214,.214],[-.231,.143]]],
  ['right',[[.125,.332],[.173,.310],[.205,.235],[.229,.156]]]];
 for(const [side,path] of flows)authoredSolid(surface,faceScale,(t,u)=>{
  const p=bezier(path,t),d=[0,1].map(axis=>3*(1-t)**2*(path[1][axis]-path[0][axis])+6*(1-t)*t*(path[2][axis]-path[1][axis])+3*t*t*(path[3][axis]-path[2][axis]));
  const width=.00065+.00235*Math.sin(Math.PI*t)**.8,offset=(u-.5)*width/Math.hypot(...d);
  const x=p[0]-d[1]*offset,y=p[1]+d[0]*offset,z=arcDepth(x,y)+.0012;
  return [[x,y,z],[x,y,z-.0021]];
 },flowColor,'front-anime_arcfringe-flow-'+side,48,2);
}
function buildFrame({a,surface,faceScale}){
 // Open-front occipital mantle: roots nest inside the dome, lower volume tapers
 // towards the nape rather than leaving a square, shoulder-length rear helmet.
 authoredSolid(surface,faceScale,(t,u)=>{
  const rearAngle=.95+u*(Math.PI*2-1.90),end=-.208-.024*(.5+.5*Math.cos(rearAngle*2));
  const y=mix(.263,end,t),radius=y>0?.283*Math.sqrt(Math.max(.14,1-(y/.333)**2)):.283-.092*smooth(-y/.255);
  // Retreat behind the ears below the temple. Exposed ear/cheek skin forms one
  // opening, not a tiny skin slit surrounded by the old side-to-rear wall.
  const start=.95+.86*smooth((.095-y)/.125),angle=start+u*(Math.PI*2-2*start);
  const x=Math.sin(angle)*radius,z=-.029+Math.cos(angle)*radius*.81;
  return [[x,y,z],[x-.017*Math.sin(angle),y,z-.017*Math.cos(angle)]];
 },a.hairColor,'back-anime_frame-mantle',48,64);
 for(const sign of [-1,1]){
  // Roots are entirely within the crown's XY envelope, removing the detached
  // side wings. Continuous rails track the narrower pentagon cheek below the
  // eye region and hang .04 farther down; no projection clamp can kink them.
  const inner=[[.182,.250],[.275,.070],[.126,-.240],[.201,-.326]];
  const outer=[[.223,.250],[.310,.070],[.270,-.240],[.207,-.326]];
  // Match the old rail and its tangent at y=.140 / -.030. The cubic eases
  // the eye-side turn over the whole interval instead of adding a short
  // inward notch. Below -.030 (including pupil-.20D and mouth) it is EXACTLY
  // the round5 rail; depth, outer rail, lower curtain and tips never move.
  const oldInset=y=>.020*(y>=-.020?smooth((.080-y)/.100):smooth((y+.150)/.130));
  const joins=[.140,-.030].map(y=>{
   let lo=0,hi=1;
   for(let i=0;i<36;i++){const t=(lo+hi)/2;if(bezier(inner,t)[1]>y)lo=t;else hi=t;}
   const t=(lo+hi)/2,p=bezier(inner,t);
   const d=[0,1].map(axis=>3*(1-t)**2*(inner[1][axis]-inner[0][axis])+6*(1-t)*t*(inner[2][axis]-inner[1][axis])+3*t*t*(inner[3][axis]-inner[2][axis]));
   const v=Math.max(0,Math.min(1,y>=-.020?(.080-y)/.100:(y+.150)/.130));
   const insetSlope=.020*6*v*(1-v)*(y>=-.020?-10:1/.130);
   return {y,x:p[0]-oldInset(y),slope:d[0]/d[1]-insetSlope};
  });
  const easedInner=(x,y)=>{
   if(y>=joins[0].y||y<=joins[1].y)return x-oldInset(y);
   const [a,b]=joins,h=b.y-a.y,s=(y-a.y)/h;
   return a.x*(2*s**3-3*s*s+1)+h*a.slope*(s**3-2*s*s+s)
    +b.x*(-2*s**3+3*s*s)+h*b.slope*(s**3-s*s);
  };
  authoredSolid(surface,faceScale,(t,u)=>{
   const l=bezier(inner,t),r=bezier(outer,t);
   const x=sign*mix(easedInner(l[0],l[1]),r[0],u);
   const y=mix(l[1],r[1],u)-.003*Math.sin(Math.PI*u)*t**8;
   const near=bezier([[.146],[.241],[.221],[.123]],t)[0];
   // Compact wrapped section rather than a broad front-to-back side plate.
   const far=bezier([[.116],[.186],[.148],[.088]],t)[0];
   const z=mix(near,far,u*u)+.006*Math.sin(Math.PI*u);
   const thickness=.017+.007*Math.sin(Math.PI*t);
   return [[x,y,z],[x,y,z-thickness]];
  },a.hairColor,'back-anime_frame-curtain-'+sign,64,20);
  // Round12: carry the narrow rear-jaw band through the middle of the jaw.
  // Only the approach to the neck descends into a panel; do not refill the
  // middle background with the round11 triangular fan. The neck panel from
  // t=.66, all X, upper 31.25%, other meshes and materials remain frozen.
  const napeColor='#'+new THREE.Color(a.hairColor).multiplyScalar(.66).getHexString();
  authoredSolid(surface,faceScale,(t,u)=>{
   const upper=bezier([[.219,-.127],[.213,-.180],[.104,-.230],[-.008,-.256]],t);
   const lower=bezier([[.233,-.150],[.221,-.221],[.098,-.281],[-.008,-.280]],t);
   // Zero displacement across the upper 5 grid intervals: the round9 seam is frozen.
   // t runs from outer cheek to neck: retain the round9 band through .50,
   // then use a C1 transition to the unchanged neck panel at .66. Only lower
   // Y/Z recede; the same solid still wraps behind the skin, neck and collar.
   const fan=bezier([[0],[0],[.140],[.050]],t)[0]*smooth((t-.50)/.16)*smooth((u-.3125)/.6875);
   const x=sign*mix(upper[0],lower[0],u),y=(mix(upper[1],lower[1],u)-fan)*(a.chinLength||1)/1.08;
   const z=bezier([[-.069],[-.025],[-.045],[-.073]],t)[0]-.016*u+.007*Math.sin(Math.PI*u)-fan*.28;
   return [[x,y,z],[x,y,z-.082-.020*Math.sin(Math.PI*t)]];
  },napeColor,'back-anime_frame-nape-'+sign,48,16);
 }
}

export function buildAnimeHair({a,front,back,surface,lock,frontAt,faceScale}){
 const main=a.hairColor,highlight=a.hairTwoTone?a.hairSecondaryColor:main;
 const ribbon=(coords,width,name,color=main)=>{
  const curve=new THREE.CatmullRomCurve3(coords.map(([x,y])=>new THREE.Vector3(x*faceScale[0],y*faceScale[1],0)));
  const pos=[],idx=[],rows=32,cols=8;
  for(let r=0;r<=rows;r++){
   const t=r/rows,p=curve.getPoint(t),v=curve.getTangent(t),w=width*Math.pow(1-t,.66)*(1+.20*Math.sin(t*Math.PI));
   for(let j=0;j<=cols;j++){
    const u=j/cols*2-1,x=p.x-v.y*w*u,y=p.y+v.x*w*u;
    pos.push(x,y,frontAt(x,y)+.020+.010*(1-u*u));
    if(r<rows&&j<cols){const k=r*(cols+1)+j;idx.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}
   }
  }
  surface(pos,idx,color,`front-${name}`);
 };
 if(front==='anime_arcfringe'){
  buildArcFringe({a,surface,frontAt,faceScale});
 }else if(front==='anime_center'||front==='anime_swept'){
  const swept=front==='anime_swept';
  const paths=swept?[
   [[-.10,.25],[-.16,.17],[-.205,.035]],[[.02,.27],[-.04,.17],[-.10,.015]],[[.10,.25],[.05,.16],[.0,.052]],[[.16,.21],[.16,.14],[.12,.016]],[[.21,.16],[.235,.045],[.22,-.095]]
  ]:[
   [[-.05,.26],[-.095,.17],[-.07,.040]],[[.015,.275],[.005,.16],[.045,.015]],[[.075,.26],[.105,.15],[.125,.052]],[[.14,.23],[.20,.14],[.19,-.10]],[[.215,.145],[.245,.035],[.225,-.21]],[[-.13,.23],[-.19,.12],[-.19,-.135]],[[-.205,.16],[-.235,.04],[-.23,-.19]]
  ];
  paths.forEach((p,i)=>ribbon(p,swept?.056:.050,`${front}-ribbon-${i}`,i===1?highlight:main));
 }else if(front==='anime_fan'){
  const tips=[[-.44,.20],[-.41,.35],[-.23,.49],[.03,.44],[.22,.36],[.37,.26]];
  tips.forEach(([x,y],i)=>lock([[x*.26,.22,.035],[x*.65,.25+(y-.25)*.42,.015],[x,y,[-.03,.02,-.07,.08,-.045,.04][i]]],.091,.082,i===2?highlight:main,`front-${front}-fan-${i}`));
  // Wrap additional locks around the occiput: not a single frontal comb.
  [[-.10,.42,-.32],[.055,.29,-.43],[-.055,.14,-.40],[.10,.02,-.30]].forEach(([x,y,z],i)=>lock([[x*.3,.18,-.09],[x*.7,.18+(y-.18)*.55,z*.66],[x,y,z]],.086,.075,main,`front-${front}-fan-rear-${i}`));
  ribbon([[-.05,.23],[-.11,.14],[-.07,.055]],.065,`${front}-bang-0`);
  ribbon([[.10,.23],[.055,.13],[.015,.027]],.069,`${front}-bang-1`);
  ribbon([[.20,.18],[.22,.09],[.185,.035]],.04,`${front}-bang-2`);
 }else if(front==='anime_flame'){
  const tips=[[-.29,.38],[-.20,.53],[-.08,.58],[.06,.63],[.19,.52],[.29,.39]];
  tips.forEach(([x,y],i)=>lock([[x*.57,.19,.015],[x*.9,y*.72,-.035],[x,y,[-.025,.025,.08,-.03,.02,-.02][i]]],.076,.072,i===2?highlight:main,`front-${front}-fan-${i}`));
  [[-.04,.55,-.19],[.035,.43,-.31],[-.025,.27,-.35]].forEach(([x,y,z],i)=>lock([[x,.18,-.075],[x,.27,z*.62],[x,y,z]],.074,.066,main,`front-${front}-fan-rear-${i}`));
  ribbon([[0,.275],[0,.205],[0,.108]],.12,`${front}-widow`);
 }
 if(back==='anime_frame'){buildFrame({a,surface,frontAt,faceScale});return;}
 if(!back.startsWith('anime_'))return;
 // Open front, rounded sides. Unlike a full cylinder this never crosses the face.
 const pos=[],idx=[],rows=20,cols=40,end=back==='anime_bob'?-.245:-.065;
 for(let r=0;r<=rows;r++)for(let j=0;j<=cols;j++){
  const v=r/rows,t=1.10+j/cols*(Math.PI*2-2.2),y=.24*(1-v)+end*v;
  const rad=y>0?.272*Math.sqrt(Math.max(.12,1-(y/.295)**2)):.271-.025*v**3;
  pos.push(Math.sin(t)*rad*faceScale[0],y*faceScale[1]+.012*Math.cos(j*1.7)*v**6,(Math.cos(t)*rad*.80-.014)*faceScale[2]);
  if(r<rows&&j<cols){const k=r*(cols+1)+j;idx.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}
 }
 surface(pos,idx,main,`back-${back}-shell`);
 if(back==='anime_twintails')for(const s of [-1,1]){
  // Long S-curves, broad at the tie and visibly narrowing at the tip.
  lock([[s*.235,.165,-.055],[s*.335,.035,-.09],[s*.34,-.26,-.105],[s*.31,-.53,-.055],[s*.41,-.74,.025]],.085,.048,main,`back-${back}-long-${s}`);
  lock([[s*.25,.15,-.052],[s*.345,-.07,-.043],[s*.345,-.39,-.018],[s*.41,-.69,.032]],.023,.012,highlight,`back-${back}-accent-${s}`);
  lock([[s*.215,.177,-.03],[s*.275,.182,-.035],[s*.27,.125,-.04]],.023,.022,a.accessoryColor,`back-${back}-tie-${s}`);
 }else if(back==='anime_braid'){
  lock([[.21,.04,-.09],[.265,-.17,-.015],[.26,-.39,.085],[.255,-.58,.095]],.052,.035,main,`back-${back}-core`);
  for(let i=0;i<8;i++){
   const y=-.14-i*.053,w=.042-i*.0025;
   lock([[.26-w,y,.075],[.26+.017,y-.025,.105],[.26+w*.4,y-.065,.09]],w*.62,.018,i%2?highlight:main,`back-${back}-plait-${i}`);
  }
 }else if(back==='anime_bob')for(const s of [-1,1])for(let j=0;j<3;j++){
  const x=s*(.215+j*.012),z=.045-j*.062;
  lock([[x,.105,z],[x*1.11,-.085,z],[s*(.215+j*.016),-.24+(j%2)*.025,z+.015]],.041,.026,main,`back-${back}-taper-${s}-${j}`);
 }
}
