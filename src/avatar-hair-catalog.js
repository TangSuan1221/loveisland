import {ANIME_FRONT,ANIME_BACK,animeHairIcon,buildAnimeHair} from './avatar-anime-hair.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {addCartoonOutline} from './avatar-material.js';

// Original geometric cuts, not Nintendo assets. Each cut family has six distinct
// silhouettes. Front and back are independently assembled on the existing head.
const FRONT_FAMILIES=[['blunt','齐刘海'],['arch','弧形刘海'],['point','尖心刘海'],['curtain','中分帘发'],['sweep','斜扫刘海'],['part','侧分刘海'],['jagged','锯齿碎发'],['spikes','竖立尖发'],['quiff','高额翘发'],['wisps','稀疏细发'],['curl','弯卷刘海'],['coils','密卷刘海'],['slick','后梳额发'],['widow','美人尖'],['asymmetric','不对称刘海'],['mohawk','额顶脊发'],['closepart','贴头侧分'],['receding','退际后梳'],['fan','侧扇尖发'],['hime','姬切直帘'],['fingerwave','波纹侧分']];
const BACK_FAMILIES=[['cropped','贴颈短发'],['bob','圆弧短发'],['lob','齐肩中发'],['straight','垂直长发'],['waves','起伏波浪'],['curls','蓬松卷发'],['shag','层次碎发'],['mullet','狼尾'],['ponytail','单马尾'],['twintails','双马尾'],['braid','单编辫'],['twinbraids','双编辫'],['bun','高发髻'],['doublebun','双发髻'],['afro','圆蓬发'],['dreadlocks','束状长发'],['beehive','高冠盘发'],['chignon','低盘发'],['sweptback','后掠短发'],['taper','渐短鬓发'],['fanspikes','放射尖簇'],['ringlets','短弹卷发'],['tower','高筒密卷'],['sideburst','侧蓬乱发'],['sidebraid','肩前编辫'],['flame','上升焰状发']];
const FRONT_CUTS=['眉上短款','标准中款','垂落长款','窄幅轻量','宽幅丰量','偏斜层次'];
const BACK_CUTS=['紧凑短款','自然中款','延伸长款','纤细垂落','丰量外扩','偏斜层次'];
function catalogue(families,cuts){return Object.fromEntries(families.flatMap(([family,label])=>cuts.map((cut,variant)=>{const value=`${family}_${variant+1}`;return[value,{value,label:`${label} · ${cut}`,family,variant}];})));}
export const HAIR_FRONT_DESIGNS=catalogue(FRONT_FAMILIES,FRONT_CUTS);
export const HAIR_BACK_DESIGNS=catalogue(BACK_FAMILIES,BACK_CUTS);
for(const d of ANIME_FRONT)HAIR_FRONT_DESIGNS[d.value]=d;
for(const d of ANIME_BACK)HAIR_BACK_DESIGNS[d.value]=d;
export const HAIR_FRONT_OPTIONS=[{value:'auto',label:'沿用整套前发'},{value:'none',label:'无额外刘海'},...Object.values(HAIR_FRONT_DESIGNS)];
export const HAIR_BACK_OPTIONS=[{value:'auto',label:'沿用整套后发'},{value:'none',label:'无后发'},...Object.values(HAIR_BACK_DESIGNS)];
const LEGACY_FRONT={bald:'none',crop:'jagged_1',side:'sweep_2',bob:'arch_2',bun:'sweep_1',braids:'blunt_2',curls:'curl_2',ponytail:'sweep_2',quiff:'quiff_2',afro:'coils_5',long:'curtain_2',twintop:'arch_2',twintails:'point_2',spiky:'spikes_2',hime:'blunt_3',mohawk:'mohawk_2',pixie:'asymmetric_1',waves:'curtain_3'};
const LEGACY_BACK={bald:'none',crop:'cropped_1',side:'cropped_2',bob:'bob_2',bun:'bun_2',braids:'twinbraids_2',curls:'curls_1',ponytail:'ponytail_2',quiff:'sweptback_2',afro:'afro_2',long:'straight_2',twintop:'doublebun_2',twintails:'twintails_2',spiky:'shag_1',hime:'straight_3',mohawk:'cropped_1',pixie:'cropped_4',waves:'waves_2'};
export function resolveHairParts(a){return{front:a.hairFront&&a.hairFront!=='auto'?a.hairFront:LEGACY_FRONT[a.hairStyle]||'arch_2',back:a.hairBack&&a.hairBack!=='auto'?a.hairBack:LEGACY_BACK[a.hairStyle]||'bob_2'};}
const CUT=[{length:.72,width:.90,lift:.025,shift:0},{length:1,width:1,lift:0,shift:0},{length:1.3,width:1.03,lift:-.025,shift:0},{length:1.12,width:.73,lift:.012,shift:0},{length:1.05,width:1.25,lift:.035,shift:0},{length:1.15,width:1.08,lift:.01,shift:.045}];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function hairCrownLift(front,x,y,z){const d=HAIR_FRONT_DESIGNS[front];if(!d)return 0;const c=CUT[d.variant];if(d.family==='closepart')return .032*c.width*Math.exp(-(((x+.095)/.12)**2))*clamp((y-.16)/.12,0,1)*clamp((z+.12)/.22,0,1);if(d.family!=='quiff')return 0;return .13*c.length*Math.exp(-(((x+.035-c.shift)/(.18*c.width))**2))*clamp((z+.045)/.18,0,1)*clamp((y-.215)/.065,0,1);}

// The same bottom profile drives the actual mesh and the small UI silhouette.
function frontHem(family,u,v){const c=CUT[v],x=u*2-1;let y=.14;
 switch(family){case'closepart':y=.205+.018*Math.sin(u*5)-.025*Math.exp(-((u-.25)**2)*80);break;case'receding':y=.235+.018*Math.abs(x)-.028*Math.exp(-x*x*12);break;case'fan':y=.16+.035*Math.cos(u*13);break;case'hime':y=.115;break;case'fingerwave':y=.16+.045*u+.016*Math.sin(u*14);break;case'blunt':y=.13;break;case'arch':y=.12+.055*x*x;break;case'point':y=.16-.075*(1-Math.abs(x));break;case'curtain':y=.095+.13*Math.exp(-x*x*18);break;case'sweep':y=.10+.10*u-.025*Math.sin(u*Math.PI);break;case'part':y=.105+.10*Math.exp(-((u-.28)**2)*50);break;case'jagged':y=.125+.032*Math.cos(u*Math.PI*(10+v*2));break;case'widow':y=.19-.07*Math.exp(-x*x*14);break;case'asymmetric':y=.065+.13*u+.02*Math.sin(u*13);break;case'slick':y=.205+.018*Math.cos(x*Math.PI);break;default:y=.145+.022*Math.sin(u*9);}
 return y+c.lift+(1-c.length)*.05+c.shift*x;
}

/** SVG inside a 64x64 viewBox. No user-controlled markup is inserted. */
export function hairPartIcon(field,value){const d=(field==='hairFront'?HAIR_FRONT_DESIGNS:HAIR_BACK_DESIGNS)[value];if(!d)return value==='none'?'<circle cx="32" cy="32" r="19" fill="none" stroke="currentColor"/><path d="M18 46L46 18" stroke="currentColor"/>':'<path d="M12 43V26Q12 6 32 6T52 26V43L44 37V27Q32 16 20 27V37Z" fill="currentColor"/>';
 if(d.family==='anime')return animeHairIcon(value);
 const c=CUT[d.variant];if(field==='hairFront'){let path='M10 25Q11 7 32 7Q53 7 54 25';for(let i=20;i>=0;i--){const u=i/20;path+=`L${(12+u*40).toFixed(1)} ${(37-frontHem(d.family,u,d.variant)*90).toFixed(1)}`;}path+='Z';let accents='';if(d.family==='fan')accents='<path d="M12 28L2 21L19 19L15 2L30 17L39 1L41 20L62 10L51 29Z" fill="currentColor"/>';if(d.family==='hime')accents='<path d="M11 22H18V48H10ZM46 22H53V48H46Z" fill="currentColor"/>';if(d.family==='quiff')accents='<path d="M11 24Q17 3 34 2Q45 4 50 19L45 25Z" fill="currentColor"/>';if(d.family==='curl')for(let j=0;j<7;j++)accents+=`<circle cx="${13+j*6}" cy="${13-Math.sin(j/6*Math.PI)*4}" r="${4+j%3}" fill="currentColor"/>`;if(['spikes','mohawk','coils','wisps'].includes(d.family)){for(let i=0;i<3+d.variant%3;i++){const x=16+i*7;accents+=`<path d="M${x} 23Q${x-6} ${2+d.variant} ${x+5} ${5+d.variant}L${x+8} 22Z" fill="currentColor"/>`;}}return`<path d="${path}" fill="currentColor"/>${accents}`;}
 let base=`<path d="M15 27Q14 7 32 7T49 27L${49+c.width*2} ${Math.min(58,31+c.length*19)}Q32 ${Math.min(61,37+c.length*19)} ${15-c.width*2} ${Math.min(58,31+c.length*19)}Z" fill="currentColor"/>`;
 if(['ponytail','braid','twintails','twinbraids','sidebraid'].includes(d.family)){base='<path d="M17 29Q14 8 32 8T47 29Z" fill="currentColor"/>';for(const s of d.family.startsWith('twin')?[-1,1]:[1])base+=`<path d="M${32+s*13} 20Q${32+s*30} 35 ${32+s*17} ${Math.min(61,39+c.length*16)}Q${32+s*12} 41 ${32+s*13} 20Z" fill="currentColor"/>`;}
 if(['bun','doublebun','chignon','beehive'].includes(d.family)){base='<path d="M15 35V26Q14 8 32 8T49 26V35Z" fill="currentColor"/>';for(const s of d.family==='doublebun'?[-1,1]:[0])base+=`<ellipse cx="${32+s*18}" cy="${d.family==='chignon'?40:12}" rx="${7+c.width*3}" ry="${7+c.length*5}" fill="currentColor"/>`;}
 if(d.family==='tower')base='<path d="M20 48L18 12Q17 2 32 2T46 12L44 48Z" fill="currentColor"/>';if(['fanspikes','sideburst','flame'].includes(d.family))base+='<path d="M17 31L3 18L19 22L17 7L28 20L40 5L42 22L61 15L49 34Z" fill="currentColor"/>';if(d.family==='ringlets')for(let j=0;j<8;j++)base+=`<circle cx="${14+j%4*12}" cy="${30+Math.floor(j/4)*13}" r="7" fill="currentColor"/>`;
 return base;
}

export function buildCustomHair({a,hair,own,mesh,mat,resources,faceScale,frontAt}){
 const {front,back}=resolveHairParts(a),fd=HAIR_FRONT_DESIGNS[front]?.family==='anime'?null:HAIR_FRONT_DESIGNS[front],bd=HAIR_BACK_DESIGNS[back]?.family==='anime'?null:HAIR_BACK_DESIGNS[back];
 const layerStart=hair.children.length;
 const main=a.hairColor,second=a.hairTwoTone?a.hairSecondaryColor:main;
 const surface=(positions,indices,color,name)=>{const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();const m=mesh(hair,color,[0,0,0],[1,1,1],g);m.name=name;m.material=mat(color).clone();m.material.side=THREE.DoubleSide;resources.material.add(m.material);return m;};
 const lock=(points,width,depth,color=main,name='hair-cut-lock')=>{const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const pos=[],idx=[],rows=20,cols=10;let priorTangent=null,widthAxis=new THREE.Vector3(1,0,0);for(let r=0;r<=rows;r++){const t=r/rows,p=curve.getPoint(t),tan=curve.getTangent(t);if(priorTangent)widthAxis.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(priorTangent,tan));widthAxis.addScaledVector(tan,-widthAxis.dot(tan)).normalize();if(widthAxis.lengthSq()<.1)widthAxis.set(0,0,1).addScaledVector(tan,-tan.z).normalize();const binormal=widthAxis.clone(),normal=new THREE.Vector3().crossVectors(tan,binormal).normalize();priorTangent=tan.clone();const angular=name.includes('-fan-')||name.includes('-radial-');const taper=angular?Math.pow(1-t,name.includes('radial-flame')?.55:.90)*(1+.15*Math.sin(t*Math.PI)):Math.pow(Math.sin(Math.PI*(.06+t*.94)),.45)*(1-t*.30);for(let j=0;j<=cols;j++){const angle=j/cols*Math.PI*2,q=p.clone().addScaledVector(binormal,Math.cos(angle)*width*taper).addScaledVector(normal,Math.sin(angle)*depth*taper);pos.push(q.x,q.y,q.z);} }for(let r=0;r<rows;r++)for(let j=0;j<cols;j++){const k=r*(cols+1)+j;idx.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}const startIndex=pos.length/3;pos.push(...points[0]);for(let j=0;j<cols;j++)idx.push(startIndex,j+1,j);const endIndex=pos.length/3;pos.push(...points.at(-1));for(let j=0;j<cols;j++)idx.push(endIndex,rows*(cols+1)+j,rows*(cols+1)+j+1);const m=surface(pos,idx,color,name);addCartoonOutline(m,resources,a.artStyle,.001);return m;};
 const frontPatch=d=>{const p=[],ix=[],rows=10,cols=48,c=CUT[d.variant];for(let r=0;r<=rows;r++){const v=r/rows;for(let j=0;j<=cols;j++){const u=j/cols;let x=(u-.5)*.45*clamp(c.width,.8,1.1)*faceScale[0];const top=.20+(d.family==='receding'?.105:.075)*Math.sqrt(Math.max(0,1-(x/(.26*faceScale[0]))**2)),bottom=Math.min(top-.004,frontHem(d.family,u,d.variant)*faceScale[1]),y=top*(1-v)+bottom*v;const boundary=.255*faceScale[0]*Math.sqrt(Math.max(.01,1-(y/(.30*faceScale[1]))**2));x=clamp(x,-boundary,boundary);p.push(x,y,frontAt(x,y)+.014+.009*Math.sin(v*Math.PI));if(r<rows&&j<cols){const k=r*(cols+1)+j;ix.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}}}return surface(p,ix,main,`front-${d.value}`);};
 buildAnimeHair({a,front,back,surface,lock,frontAt,faceScale});
 if(fd){const c=CUT[fd.variant],v=fd.variant,f=fd.family;frontPatch(fd);
  if(f==='closepart'||f==='fingerwave'){
   const seam='#'+new THREE.Color(main).multiplyScalar(.74).getHexString();
   for(let j=0;j<5;j++){const pts=Array.from({length:16},(_,k)=>{const t=k/15,x=(-.12+t*.29+j*.005)*faceScale[0],y=(Math.max(frontHem(f,(x/faceScale[0]/.45)+.5,v)+.009,.252-j*.006-t*(f==='receding'?.008:.025))+(f==='fingerwave'?.009*Math.sin(t*12+j*.6):0))*faceScale[1];return[x,y,frontAt(x,y)+.026];});lock(pts,f==='fingerwave'?.008:.0016,f==='fingerwave'?.006:.0012,j===0?second:seam,`front-${fd.value}-sweep-${j}`);}
  }
  if(f==='hime'){
   // Flat cheek-length sidelocks have blunt ends, unlike tapered tube bangs.
   for(const sign of [-1,1]){const positions=[],indices=[],rows=16,cols=5;for(let r=0;r<=rows;r++)for(let j=0;j<=cols;j++){const t=r/rows,u=j/cols,x=sign*(.182+u*(.023+.021*Math.min(1,t*4))+.014*t)*faceScale[0],y=(.195-t*(.24+.10*c.length))*faceScale[1],z=Math.max(.055,frontAt(x,y))+.025;positions.push(x,y,z);if(r<rows&&j<cols){const k=r*(cols+1)+j;indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}}surface(positions,indices,sign<0?main:second,`front-${fd.value}-blunt-panel-${sign}`);}
  }
  if(f==='fan'){
   // Unequal sideways fans: silhouette is not a repeated vertical comb.
   const tips=[[-.43,.26],[-.34,.44],[-.15,.47],[.08,.39],[.27,.31],[.36,.19]];
   tips.forEach(([tx,ty],j)=>{const sign=tx<0?-1:1;lock([[sign*.075,.24,.06],[tx*.50,.24+(ty-.24)*.55,.09],[tx*c.width, .20+(ty-.20)*c.length,.035-j*.009]],.10+(j%2)*.018,.065,j%3===0?second:main,`front-${fd.value}-fan-${j}`);});
  }
  if(f==='part'){
   // One continuous swept sheet. Fine seam marks follow the scalp instead of
   // independent thick cylinders dangling across the forehead.
   const seamColor='#'+new THREE.Color(main).multiplyScalar(.76).getHexString();
   for(let j=0;j<3;j++){const pts=Array.from({length:12},(_,k)=>{const t=k/11,x=-.085+t*(.20+j*.025),y=.245-t*(.075+j*.012)+.018*Math.sin(t*Math.PI);return[x,y,frontAt(x,y)+.025];});lock(pts,.0017,.0013,j===0&&a.hairTwoTone?second:seamColor,`front-${fd.value}-seam-${j}`);}
  }
  if(f==='curl'){
   const count=7+v%2,seamColor='#'+new THREE.Color(main).multiplyScalar(.78).getHexString();
   for(let j=0;j<count;j++){const t=j/(count-1),x=(t-.5)*.36*Math.min(1.1,c.width),radius=(.037+.012*(.5+.5*Math.sin(j*2.4+v*.3)))*c.width,y=.195+.045*Math.sin(t*Math.PI)+(j%2?-.012:.01)+c.lift*.4,z=frontAt(x,y)+.025;
    const m=mesh(hair,j===1&&a.hairTwoTone?second:main,[x,y,z],[radius,radius*(.80+.27*c.length),.035],own(new THREE.SphereGeometry(1,24,16)));m.name=`front-${fd.value}-round-curl-${j}`;
    const direction=j%2?1:-1,pts=Array.from({length:10},(_,k)=>{const q=k/9*Math.PI*1.25+.4;return[x+Math.sin(q)*radius*.55*direction,y+Math.cos(q)*radius*.55,z+.034];});lock(pts,.0017,.0012,seamColor,`front-${fd.value}-curl-mark-${j}`);
   }
  }
  if(['spikes','mohawk','wisps','coils','curtain','asymmetric'].includes(f)){
   const count=f==='quiff'?3:f==='mohawk'?5:f==='coils'?11+v:f==='wisps'?3+v:f==='curtain'?4:5+v%3;
   for(let j=0;j<count;j++){const t=count===1?.5:j/(count-1),x=(t-.5)*.34*Math.min(1.12,c.width),z=.10,y=.21+c.lift;let points,width=.035,depth=.026;
    if(f==='spikes')points=[[x*.8,y-.045,.13],[x,y+.07*c.length,.10],[x*1.25+c.shift,y+.20*c.length,.04]];
    else if(f==='mohawk'){points=[[0,.23,.17-j*.065],[c.shift,.32,.16-j*.065],[c.shift*.5,.35+.07*c.length,.14-j*.065]];width=.025*c.width;depth=.045;}
    else if(f==='quiff'){points=[[-.13+j*.07,.19,.16],[-.13+j*.06,.30+c.length*.03,.12],[.06+j*.04,.30+c.length*.05,-.015]];width=.065*c.width;depth=.045;}
    else if(f==='wisps'){points=[[x,.23,.13],[x+.025,.16,.18],[x+.04+c.shift,.08-c.length*.04,.19]];width=.011*c.width;depth=.009;}
    else if(f==='curl'||f==='coils'){const radius=f==='coils'?.023:.045;points=Array.from({length:9},(_,k)=>{const q=k/8*Math.PI*2;return[x+Math.sin(q)*radius,.23-k*.008*c.length+Math.cos(q)*radius,.14+Math.sin(q*.5)*.035];});width=(f==='coils'?.022:.027)*c.width;depth=.022;}
    else if(f==='slick'){points=[[x,.19,.16],[x*.8,.29+c.length*.025,.06],[x*.6,.25,-.13]];width=.025*c.width;depth=.022;}
    else if(f==='curtain'){const s=j<2?-1:1;points=[[s*.015,.26,.10],[s*(.10+j%2*.04),.18,.18],[s*(.17+j%2*.025),.10-c.length*.08,.14]];width=.035*c.width;}
    else {points=[[x*.7,.27,.09],[x+.025,.19,.17],[x+.055+c.shift,.12-c.length*.035,.17]];width=.035*c.width;}
    for(const p of points){if(p[1]<.255&&p[2]>0){p[0]=clamp(p[0],-.22*faceScale[0],.22*faceScale[0]);p[2]=Math.max(p[2],frontAt(p[0],p[1])+.009);}}
    lock(points,width,depth,j%3===0?second:main,`front-${fd.value}-strand-${j}`);
   }
  }
  if(a.hairTwoTone){const x=.09,tip=Math.min(.25,frontHem(fd.family,.78,fd.variant)*faceScale[1]+.025),middle=(.26+tip)/2;lock([[x,.26,frontAt(x,.26)+.019],[x+.015,middle,frontAt(x+.015,middle)+.019],[x+.025,tip,frontAt(x+.025,tip)+.019]],.010,.005,second,'hair-front-highlight');}
 }
 const shell=(length,width,wave=0,hem=0)=>{const p=[],ix=[],rows=26,cols=44;for(let r=0;r<=rows;r++){const v=r/rows,y=.29-v*(.45+length);let rad=y>=.03?.27*Math.sqrt(Math.max(0,1-((y-.028)/.29)**2))+.008:.278-.028*((.03-y)/(.19+length))**2;rad*=1+(width-1)*Math.min(1,v*2);if(y>-.26)rad=Math.max(rad,.275*Math.sqrt(Math.max(0,1-(y/.31)**2))+.012);for(let j=0;j<=cols;j++){const u=j/cols,t=.93+u*(Math.PI*2-1.86),ripple=wave*Math.sin(v*Math.PI*5+u*11)*Math.sin(v*Math.PI/2),rr=rad+ripple;p.push(Math.sin(t)*rr*faceScale[0],(y+hem*Math.cos(t*7)*v**4)*faceScale[1],(Math.cos(t)*rr*.75-.012)*faceScale[2]);if(r<rows&&j<cols){const k=r*(cols+1)+j;ix.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}}}return surface(p,ix,second,`back-${bd.value}-shell`);};
 if(bd){const c=CUT[bd.variant],f=bd.family,v=bd.variant;
  if(f==='taper'){
   shell(-.13,.97+.025*c.width,0,.003);
   for(const sign of [-1,1])lock([[sign*.235,.13,-.025],[sign*.245,.005,-.04],[sign*.225,-.075*c.length,-.065]],.018*c.width,.017,second,`back-${bd.value}-temple-${sign}`);
  }else if(f==='fanspikes'||f==='sideburst'){
   shell(-.12,1,0,.008);const count=f==='sideburst'?18:8;
   for(let j=0;j<count;j++){const t=1+j/(count-1)*(Math.PI*2-2),sx=Math.sin(t),cz=Math.cos(t),side=Math.abs(sx),y=f==='sideburst'?.10+.055*Math.sin(j*2.1):.225+.045*Math.sin(j*1.7),reach=(f==='sideburst'?.13:.16)*c.width*(.8+.3*Math.sin(j*2.7));lock([[sx*.14,y-.12,cz*.11],[sx*(.22+reach*.3),y+.015,cz*.19],[sx*(.27+reach),f==='sideburst'?y+(j%2?.045:-.09):.36+.20*c.length*(1-side*.65),cz*(.23+reach*.7)]],(f==='sideburst'?.043:.105)*c.width,.060,j%3?second:main,`back-${bd.value}-${f==='sideburst'?'tuft':'radial'}-${j}`);}
   if(f==='sideburst')for(const sign of [-1,1])for(let j=0;j<7;j++){const t=j/6,x=sign*(.235+.055*Math.sin(t*Math.PI))*c.width,y=.18-t*.25,z=-.04+.10*Math.sin(j*1.9);const m=mesh(hair,j%3?second:main,[x,y,z],[.065*c.width,.045+.015*Math.sin(j*2),.065],own(new THREE.SphereGeometry(1,16,12)));m.name=`back-${bd.value}-ringlet-fluff-${sign}-${j}`;}
  }else if(f==='flame'){
   shell(-.10,1);const body=mesh(hair,main,[0,.245,-.08],[.245*c.width,.24*c.length,.18],own(new THREE.SphereGeometry(1,32,24)));body.name=`back-${bd.value}-flame-body`;
   for(let j=0;j<7;j++){const u=j/6,x=(u-.5)*.37*c.width,height=.48+(.18-.14*Math.abs(u-.5)*2)*c.length,z=-.035+(j%2?-.065:.035);lock([[x*.9,.055,z-.08],[x*.95,.37,z-.025],[x*.73+c.shift*.4,height,z-.035]],.095*c.width,.070,j%3===0?second:main,`back-${bd.value}-radial-flame-${j}`);}
  }else if(f==='sidebraid'){
   shell(-.08,1);const end=-.40-.24*c.length,curve=new THREE.CatmullRomCurve3([[.11,.16,-.18],[.245,-.02,-.10],[.255,-.19,.12],[.22,end,.23]].map(p=>new THREE.Vector3(...p)));
   const core=Array.from({length:24},(_,k)=>curve.getPoint(k/23).toArray());lock(core,.034*c.width,.032,second,`back-${bd.value}-braid-core`);
   for(let strand=0;strand<3;strand++){const points=Array.from({length:49},(_,k)=>{const t=k/48,q=curve.getPoint(t),angle=t*Math.PI*14+strand*Math.PI*2/3;q.x+=Math.sin(angle)*.028*c.width;q.z+=Math.cos(angle)*.028;return q.toArray();});lock(points,.021*c.width,.021,strand===0?main:second,`back-${bd.value}-woven-${strand}`);}
   const tip=curve.getPoint(.93);mesh(hair,a.accessoryColor,tip.toArray(),[.043,.012,.037]);
  }else if(f==='ringlets'||f==='tower'){
   const tower=f==='tower',height=tower?.28+.28*c.length:.23,baseY=tower?.11:.06;
   if(!tower)shell(.005,1.04,0,.01);
   else {const m=mesh(hair,second,[0,baseY+height*.36,-.07],[.205*c.width,height*.78,.17],own(new THREE.SphereGeometry(1,28,24)));m.name=`back-${bd.value}-column`;}
   const levels=tower?9:4,count=tower?13:11;
   for(let r=0;r<levels;r++)for(let j=0;j<count;j++){const t=(tower?(r%2)*.23:.85+(r%2)*.10)+j/(tower?count:count-1)*(tower?Math.PI*2:Math.PI*2-1.7),radius=(tower?.215:.254)*c.width*(tower?Math.sqrt(Math.max(.18,1-((r/(levels-1)-.36)/.82)**2)):1),x=Math.sin(t)*radius,y=tower?baseY+r/(levels-1)*height:-.11+r*.083*c.length+.012*Math.sin(j*2.2+r),z=Math.cos(t)*(tower?radius*.80:.205)-.04,rr=(tower?.037:.045)*c.width*(.92+.12*Math.sin(j*2.3+r));const m=mesh(hair,j%4?second:main,[x,y,z],[rr,rr*(tower?1:1.25),rr],own(new THREE.SphereGeometry(1,16,12)));m.name=`back-${bd.value}-ringlet-${r}-${j}`;}
  }else if(['cropped','bob','lob','straight','waves','curls','shag','mullet','sweptback'].includes(f)){
   const lengths={cropped:-.055,bob:.08,lob:.23,straight:.46,waves:.43,curls:.30,shag:.19,mullet:.31,sweptback:-.025};const length=Math.max(-.10,(lengths[f]+.16)*c.length-.16),wave=['waves','curls','shag'].includes(f)?.014*c.width:0;
   shell(length,c.width,wave,f==='shag'?.032:f==='mullet'?.018:.006);
   if(['waves','curls','shag','mullet','sweptback'].includes(f)){const n=f==='curls'?10:6;for(let j=0;j<n;j++){const t=.9+j/(n-1)*(Math.PI*2-1.8),x=Math.sin(t)*.25*c.width,z=Math.cos(t)*.20-.015;const end=-.12-length+(f==='mullet'&&Math.cos(t)>.1?.17:0);let pts;if(f==='sweptback')pts=[[x*.8,.17,z*.7],[x*1.10,.16,z-.03],[x*1.05,.03-c.length*.07,z-.08]];else pts=[[x,.12,z],[x+Math.sin(j*2)*wave,.5*(end+.12),z+wave],[x+c.shift,end,z-.01]];lock(pts,.035*c.width,.032,j%3===0?main:second,`back-${bd.value}-layer-${j}`);}}
  }else if(['ponytail','twintails','braid','twinbraids','dreadlocks'].includes(f)){
   shell(-.06,1);const double=f.startsWith('twin'),n=f==='dreadlocks'?10:double?2:1;
   for(let j=0;j<n;j++){const s=double?(j===0?-1:1):1,t=f==='dreadlocks'?1+j/(n-1)*4.28:0,x=f==='dreadlocks'?Math.sin(t)*.25:double?s*.23:.08+c.shift,z=f==='dreadlocks'?Math.cos(t)*.19:-.17,start=f==='dreadlocks'?.12:.13+(v%3-1)*.075,end=-.25-.25*c.length;
    if(f.includes('braid')){lock([[x,start,z],[x+s*.018,(start+end)/2,z],[x+s*.035,end,z]],.030*c.width,.029,second,`back-${bd.value}-braid-core-${j}`);for(let strand=0;strand<3;strand++){const pts=Array.from({length:19},(_,k)=>{const q=k/18;return[x+Math.sin(q*Math.PI*8+strand*2.094)*.028*c.width+s*q*.035,start+(end-start)*q,z+Math.cos(q*Math.PI*8+strand*2.094)*.028];});lock(pts,.021*c.width,.021,strand===0?main:second,`back-${bd.value}-braid-${j}-${strand}`);}}
    else {lock([[x,start,z],[x+s*.06*c.width,start-.12,z-.025],[x+s*.055+c.shift,end,z+.03]],(f==='dreadlocks'?.027:.07)*c.width,.055,second,`back-${bd.value}-tail-${j}`);}
    mesh(hair,a.accessoryColor,[x,start-.025,z],[.045*c.width,.014,.045]);
   }
  }else if(['bun','doublebun','chignon','beehive'].includes(f)){
   shell(-.05,1);for(const s of f==='doublebun'?[-1,1]:[0]){const x=s*.18+c.shift,y=f==='chignon'?-.04:f==='beehive'?.34:f==='doublebun'?.27:.31,z=f==='chignon'?-.25:-.15;mesh(hair,second,[x,y+(f==='beehive'?.05:0),z-(f==='beehive'?.04:0)],[ (f==='beehive'?.15:.095)*c.width,(f==='beehive'?.22:.10)*c.length,f==='beehive'?.13:.09],own(new THREE.SphereGeometry(1,24,16)));const loops=f==='beehive'?5:3;for(let j=0;j<loops;j++){const pts=Array.from({length:18},(_,k)=>{const t=k/17*Math.PI*2,rad=(.055+j*.017)*c.width;return[x+Math.cos(t)*rad,y+Math.sin(t)*rad*c.length+(f==='beehive'?j*.025:0),z-j*.02];});lock(pts,.034,.028,j%2?main:second,`back-${bd.value}-coil-${s}-${j}`);}}
  }else if(f==='afro'){
   shell(.015,1.15*c.width,.008,.008);mesh(hair,second,[0,.07,-.14],[.28*c.width,.27*c.length,.16],own(new THREE.SphereGeometry(1,28,20)));
   for(let j=0;j<17;j++){const t=j/16*Math.PI*2,x=Math.sin(t)*.25*c.width,y=.08+Math.cos(t)*.23*c.length;lock([[x*.9,y*.85,-.07],[x*1.1,y+.025,-.13],[x,y-.055,-.20]],.075*c.width,.085,j%3?second:main,`back-${bd.value}-curl-${j}`);}
  }
 }
 // Dense ringlets are batched per color so a tall cut does not add 117 draw calls.
 if(bd&&['tower','ringlets','sideburst'].includes(bd.family)){
  const groups=new Map();for(const child of hair.children.slice(layerStart)){if(!child.name.includes('-ringlet-'))continue;const key=child.material.color.getHexString();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(child);}
  for(const [color,children] of groups){const geometries=children.map(child=>{child.updateMatrix();return child.geometry.clone().applyMatrix4(child.matrix);}),merged=own(mergeGeometries(geometries,false));geometries.forEach(g=>g.dispose());const m=mesh(hair,'#'+color,[0,0,0],[1,1,1],merged);m.name=`back-${bd.value}-merged-ringlets-${color}`;children.forEach(child=>{hair.remove(child);resources.geometry.delete(child.geometry);child.geometry.dispose();});}
 }
 const frontLength=clamp(Number(a.hairFrontLength)||1,.75,1.3),backLength=clamp(Number(a.hairBackLength)||1,.65,1.5),volume=clamp(Number(a.hairVolume)||1,.85,1.25);
 if(frontLength!==1||backLength!==1||volume!==1){
  for(const child of hair.children.slice(layerStart)){if(!child.isMesh)continue;const isFront=child.name.startsWith('front-')||child.name==='hair-front-highlight',length=isFront?frontLength:backLength,position=child.geometry.getAttribute('position');
   for(let i=0;i<position.count;i++){const q=new THREE.Vector3().fromBufferAttribute(position,i).multiply(child.scale).add(child.position);const anchor=isFront?.19:-.06;if(q.y<anchor)q.y=anchor+(q.y-anchor)*length;
    // Only displace the volume outside the skull; never shrink the skull itself.
    const radius=Math.hypot(q.x,q.z),skull=.27*faceScale[0],excess=Math.max(0,radius-skull);if(radius>0){const ratio=(radius+excess*(volume-1))/radius;q.x*=ratio;q.z*=ratio;}if(q.y>.30)q.y=.30+(q.y-.30)*volume;
    q.sub(child.position).divide(child.scale);position.setXYZ(i,q.x,q.y,q.z);
   }position.needsUpdate=true;child.geometry.computeVertexNormals();child.geometry.computeBoundingSphere();
  }
 }
 if(a.hairMirror)hair.scale.x=-1;
 hair.userData.parts={front,back};
}
