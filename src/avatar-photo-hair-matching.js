import {HAIR_ATLAS} from './avatar-photo-hair-atlas.js';
import {HAIR_FRONT_DESIGNS,HAIR_BACK_DESIGNS} from './avatar-hair-catalog.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const quantile=(a,q)=>{const b=[...a].sort((x,y)=>x-y);return b.length?b[Math.floor((b.length-1)*q)]:null;};
const G=HAIR_ATLAS.grid;
const point=(x,y)=>({x:G.xMin+(x+.5)*(G.xMax-G.xMin)/G.width,y:G.yMin+(y+.5)*(G.yMax-G.yMin)/G.height});
const has=(rows,x,y)=>x>=0&&x<G.width&&y>=0&&y<G.height&&((rows[y]>>>x)&1)!==0;
function stats(rows){
 const ps=[];for(let y=0;y<G.height;y++)for(let x=0;x<G.width;x++)if(has(rows,x,y))ps.push(point(x,y));
 const top=quantile(ps.map(p=>p.y),.015)??-.5,bottom=quantile(ps.map(p=>p.y),.985)??0;
 const hairline=Array.from({length:9},(_,i)=>{const cx=-.4+i*.1,ys=ps.filter(p=>Math.abs(p.x-cx)<.07&&p.y<.035).map(p=>p.y);return quantile(ys,.96);});
 const left=hairline.slice(0,4).filter(Number.isFinite),right=hairline.slice(5).filter(Number.isFinite);
 const average=a=>a.reduce((s,x)=>s+x,0)/Math.max(1,a.length);
 return{top,bottom,hairline,foreheadExposure:-average(hairline.slice(2,7).filter(Number.isFinite)),hairlineSlope:average(right)-average(left),width:ps.length?Math.max(...ps.map(p=>p.x))-Math.min(...ps.map(p=>p.x)):0};
}

/** Head coordinates come from the eye-line and cheek span, never a fixed crown
 * extension. The same grid stores depth-tested render silhouettes in the atlas. */
export function measureHairSilhouette({hair,pixel,left,right,eyes}){
 const faceWidth=Math.abs(right.x-left.x),cx=(left.x+right.x)/2,eyeY=(eyes[0].y+eyes[1].y)/2;
 const counts=new Uint32Array(G.width*G.height),rows=Array(G.height).fill(0);
 for(const index of hair){const q=pixel(index),x=Math.floor(((q.x-cx)/faceWidth-G.xMin)/(G.xMax-G.xMin)*G.width),y=Math.floor(((q.y-eyeY)/faceWidth-G.yMin)/(G.yMax-G.yMin)*G.height);if(x>=0&&x<G.width&&y>=0&&y<G.height)counts[y*G.width+x]++;}
 const area=faceWidth**2*(G.xMax-G.xMin)/G.width*(G.yMax-G.yMin)/G.height;
 for(let y=0;y<G.height;y++)for(let x=0;x<G.width;x++)if(counts[y*G.width+x]>=Math.max(1,area*.16))rows[y]=(rows[y]|(1<<x))>>>0;
 return {rows,...stats(rows)};
}
const atlasStats=new Map(HAIR_ATLAS.entries.map(e=>[`${e.field}:${e.value}`,stats(e.rows)]));
function score(observed,entry,mirror){
 const target=atlasStats.get(`${entry.field}:${entry.value}`),front=entry.field==='hairFront';
 // A character's cranium proportions differ from a photograph. Align the top
 // and eye-line for comparing silhouettes; do not mistake a high forehead for
 // a quiff. Hairline ratio and side contours remain discriminative after warp.
 const visibleCrown=observed.foreheadExposure>.35?-(observed.foreheadExposure+.18):observed.top;
 const sy=clamp(-.50/Math.min(-.25,visibleCrown),.55,1.6);
 let intersection=0,union=0,extra=0,missing=0;
 for(let y=0;y<G.height;y++)for(let x=0;x<G.width;x++){
  const q=point(x,y),px=mirror?-q.x:q.x;
  const weight=front?(q.y<-.35?1:Math.abs(q.x)<.43&&q.y<.06?1:0):(Math.abs(q.x)>.35?(q.y>.05?2:1):q.y<-.48?1.5:q.y>.43?1.7:0);
  if(!weight)continue;
  const photoY=q.y<0?q.y/sy:q.y,ox=Math.floor((px-G.xMin)/(G.xMax-G.xMin)*G.width),oy=Math.floor((photoY-G.yMin)/(G.yMax-G.yMin)*G.height);
  const a=has(observed.rows,ox,oy),b=has(entry.rows,x,y);
  if(a||b)union+=weight;if(a&&b)intersection+=weight;if(a&&!b)missing+=weight;if(!a&&b)extra+=weight;
 }
 let lineError=0,n=0;if(front)for(let i=0;i<9;i++){const actual=observed.hairline[mirror?8-i:i],expected=target.hairline[i];if(actual!==null&&expected!==null){lineError+=Math.min(.35,Math.abs(actual*sy-expected));n++;}}
 const iou=union?intersection/union:0;
 // Extra low hair is strongly visible; a portrait cannot prove the hidden back
 // arrangement, so this is a visible-contour fit rather than an ID classifier.
 const family=(front?HAIR_FRONT_DESIGNS:HAIR_BACK_DESIGNS)[entry.value]?.family;
 // A hidden knot, braid or ponytail is not supported merely because its cap
 // resembles short hair. Require visible extension/lobes before proposing it
 // as the automatic result; all entries still participate in the comparison.
 const tied=['bun','doublebun','beehive','chignon','ponytail','twintails','braid','twinbraids','sidebraid'].includes(family);
 const missingStructure=!front&&tied&&observed.bottom<.45&&observed.width<1.4?.38:0;
 const absentAfro=!front&&family==='afro'&&observed.width<1.35?.22:0;
 const compactCrown=observed.foreheadExposure>.35&&-observed.top-observed.foreheadExposure<.30&&observed.width<1.35;
 // A thin, close-cropped cap does not support large decorative loops or spikes.
 // Fine photographic curl texture is not the same as these macro hair meshes.
 const unsupportedVolume=front&&compactCrown&&['curl','coils','quiff','spikes','mohawk','fan'].includes(family)?.18:0;
 return(1-iou)*.65+(n?lineError/n*2.8:0)+(front?0:extra/Math.max(1,union)*.32+Math.abs(target.bottom-observed.bottom)*.38)+missingStructure+absentAfro+unsupportedVolume;
}

export function matchHairCatalog(observed,{clipped=false}={}){
 const values={},candidates=[],diagnostics={method:'depth-tested-render-silhouette',atlasVersion:HAIR_ATLAS.version,frontCount:0,backCount:0,features:{top:observed.top,bottom:observed.bottom,width:observed.width,foreheadExposure:observed.foreheadExposure,hairlineSlope:observed.hairlineSlope,hairline:observed.hairline}};
 for(const field of ['hairFront','hairBack']){
  const catalog=field==='hairFront'?{...HAIR_FRONT_DESIGNS,none:{label:'无额外前发 · 贴头短发',family:'none'}}:HAIR_BACK_DESIGNS;
  const ranked=HAIR_ATLAS.entries.filter(e=>e.field===field).map(e=>{const direct=score(observed,e,false),flipped=score(observed,e,true),mirror=field==='hairBack'?(values.hairMirror||false):flipped+.008<direct;return{value:e.value,label:catalog[e.value]?.label||e.value,family:catalog[e.value]?.family,distance:mirror?flipped:direct,mirror};}).sort((a,b)=>a.distance-b.distance);
  diagnostics[field==='hairFront'?'frontCount':'backCount']=ranked.filter(o=>o.value!=='none').length;
  diagnostics[field==='hairFront'?'frontComparedCount':'backComparedCount']=ranked.length;
  // Back arrangements hidden behind the cranium cannot be recovered from a
  // frontal mask. Keep tied styles as editable candidates, not an automatic
  // assertion; use a similarly good simple contour when one is available.
  const tiedFamilies=new Set(['bun','doublebun','beehive','chignon','ponytail','twintails','braid','twinbraids','sidebraid']);
  const reliableShort=!clipped&&observed.bottom<.20&&observed.width<1.4;
  const automatic=field==='hairBack'&&reliableShort?ranked.find(o=>['cropped','sweptback','taper'].includes(o.family)):field==='hairBack'&&tiedFamilies.has(ranked[0]?.family)?ranked.find(o=>!tiedFamilies.has(o.family)&&o.distance<ranked[0].distance+.16):ranked[0];
  // Show different plausible families, not three near-identical lengths.
  const choices=automatic?[automatic]:[];for(const option of ranked){if(choices.some(o=>o.family===option.family))continue;choices.push(option);if(choices.length===4)break;}
  candidates.push({field,label:field==='hairFront'?'前发与发际线候选':'可见侧后发候选',options:choices.map(o=>({value:o.value,label:o.label,distance:Number(o.distance.toFixed(4)),patch:field==='hairFront'?{hairMirror:o.mirror,hairTwoTone:false}:{}})),reason:field==='hairFront'?'对照真实组件剪影、发际线和露额比例；分缝方向仍可手动确认。':'只匹配照片可见的侧边与长度，头后被遮挡的辫子或盘发无法由单张照片确定。'});
  diagnostics[field]=ranked.slice(0,8).map(o=>({value:o.value,distance:Number(o.distance.toFixed(4)),mirror:o.mirror}));
  if(!clipped&&automatic&&(automatic.distance<.70||field==='hairBack'&&reliableShort)){values[field]=automatic.value;if(field==='hairFront'){values.hairMirror=automatic.mirror;values.hairTwoTone=false;}}
 }
 return {values,candidates,diagnostics};
}
