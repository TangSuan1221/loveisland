import {FEATURE_PROFILES} from './avatar-feature-catalog.js';
// Original silhouette and surface-detail vocabulary. No external game assets.
export const FACE_ADDITIONS = [
 ['pear','梨形脸','oval',[1.02,1,1],-.14,.18],['triangle','倒三角脸','heart',[1.08,1.03,1],.03,-.17],
 ['rectangle','矩形脸','square',[.94,1.14,1],0,.06],['trapezoid','梯形脸','square',[1.06,1,1],-.12,.22],
 ['oblong','窄长椭圆','long',[.9,1.08,1],0,-.06],['cheekbone','高颧骨脸','diamond',[1.08,1.02,1],.04,-.03],
 ['softsquare','柔方脸','square',[1.04,1.02,1],.08,-.08],['button','短圆脸','round',[1.06,.87,1],0,.05],
 ['tapered','尖下颌脸','oval',[.98,1.08,1],.10,-.24],['broad','宽阔脸','oval',[1.2,.95,1],.02,.15]
].map(([value,label,base,scale,upper,lower])=>({value,label,base,scale,upper,lower}));
export const FACE_PROFILES=Object.fromEntries(FACE_ADDITIONS.map(x=>[x.value,x]));
const options=xs=>xs.map(([value,label])=>({value,label}));
export const DETAIL_OPTIONS={
 moleStyle:options([['none','无痣'],['round','圆痣'],['oval','椭圆痣']]),
 eyeLashes:options([['none','无上睫毛'],['outer','眼尾单睫'],['double','眼尾双睫'],['fan','扇形三睫'],['doll','人偶五睫'],['spike','尖簇睫毛']]),
 lowerLashes:options([['none','无下睫毛'],['three','三束下睫']]),
 upperEyeFold:options([['none','无上眼褶'],['single','单线眼褶'],['double','双线眼褶']]),
 lowerEyeFold:options([['none','无下眼褶'],['short','短下眼褶'],['long','长下眼褶']]),
 eyeHighlight:options([['none','无高光'],['dot','单点光'],['double','双点光'],['oval','椭圆光'],['bar','条状光'],['star','星形光'],['diamond','菱形光'],['heart','心形光'],['crescent','弯月光'],['sparkle','碎星光']]),
 upperWrinkles:options([['none','无上部纹理'],['single','单额纹'],['double','双额纹'],['triple','三额纹'],['arched','弧形额纹'],['furrow','川字纹'],['worry','忧虑眉纹'],['crows','鱼尾纹'],['aged','额部岁月纹']]),
 lowerWrinkles:options([['none','无下部纹理'],['underLight','浅眼袋'],['underDeep','双层眼袋'],['nasolabial','短法令纹'],['nasolabialLong','长法令纹'],['marionette','嘴角纹'],['chin','下巴纹'],['cheek','颊部细纹'],['hollow','凹颊线'],['dimples','双酒窝'],['leftDimple','单侧酒窝'],['lip','唇周细纹'],['tired','疲倦面容'],['mature','成熟面容'],['aged','深层岁月纹']]),
 earStyle:options([['natural','自然耳'],['small','小耳'],['large','大耳'],['round','圆耳'],['attached','贴耳'],['flared','招风耳'],['pointed','精灵尖耳'],['longpoint','长尖耳'],['droop','垂耳'],['none','隐藏耳朵']]),
 freckles:options([['none','无雀斑'],['light','鼻梁浅雀斑'],['cheeks','双颊雀斑'],['dense','密集雀斑'],['beautyLeft','左颊美人痣'],['beautyRight','右唇美人痣'],['nose','鼻尖痣'],['constellation','星点雀斑']]),
 wrinkles:options([['none','无皱纹'],['forehead','额纹'],['eyeCorners','眼尾细纹'],['underEye','眼袋'],['smileLines','法令纹'],['mature','成熟面部纹理'],['elder','深层岁月纹理'],['browCrease','眉间纹']]),
 makeup:options([['none','无妆容'],['upper','上眼影'],['smoky','烟熏眼影'],['wing','飞翼眼影'],['blush','斜扫腮红'],['mask','面罩彩绘'],['warpaint','战纹'],['tear','泪痕']])
};
export function drawFaceDetails({a,head,mesh,line,polygon,facialPatch,facialLine,ovalPoints,faceScale,ink,outline}){
 const earProfiles={natural:[.035,.064,0],small:[.023,.043,0],large:[.046,.086,0],round:[.047,.048,0],attached:[.024,.065,-.012],flared:[.052,.067,.014],droop:[.031,.09,-.024]};
 if(a.earStyle!=='none')for(const s of [-1,1]){
  const x=s*.248*faceScale[0];
  if(['pointed','longpoint'].includes(a.earStyle)){
   const reach=(a.earStyle==='longpoint'?.17:.095)*a.earSize;
   outline(polygon(head,[[x-s*.015,.025],[x+s*reach,.08],[x+s*.04,-.065],[x-s*.012,-.05]],a.skinColor,-.022,.025));
   line(head,[[x,.01,.016],[x+s*reach*.72,.052,.016],[x+s*.025,-.035,.016]],ink,.0018);
  }else{const [w,h,offset]=earProfiles[a.earStyle]||earProfiles.natural;
   outline(mesh(head,a.skinColor,[x,-.018+offset,-.015],[w*a.earSize,h*a.earSize,.025]));
   line(head,[[x+s*w*.2,.018+offset,.007],[x+s*w*.57,-.006+offset,.012],[x+s*w*.12,-h*.6+offset,.009]],ink,.0021);
  }
 }
 const detail=a.detailColor;
 if(a.moleStyle!=='none')facialPatch(head,ovalPoints(a.moleX,a.moleY,.0035*a.moleSize,.0035*a.moleSize*(a.moleStyle==='oval'?1.6:1),16),detail,[0,0],.005);
 if(a.freckles!=='none'){
  const spots=a.freckles==='beautyLeft'?[[-.13,-.085,.004]]:a.freckles==='beautyRight'?[[.07,-.143,.004]]:a.freckles==='nose'?[[.023,-.065,.0035]]:
   Array.from({length:a.freckles==='dense'?44:a.freckles==='constellation'?14:a.freckles==='cheeks'?24:12},(_,i)=>{
    const side=i%2?-1:1,k=Math.floor(i/2),x=side*(a.freckles==='light'?.025+(k%6)*.012:.065+(k%8)*.011);
    return[x,-.055-Math.floor(k/8)*.017+Math.sin(k*2.4)*.011,.0018+(i%3)*.0006];});
  for(const [x,y,r]of spots)facialPatch(head,ovalPoints(x,y,r,r,8),detail,[0,0],.004);
 }
 const w=a.wrinkles,paths=[];
 if(['forehead','mature','elder'].includes(w))for(let i=0;i<(w==='elder'?3:2);i++)paths.push([[-.09,.136+i*.021],[-.025,.13+i*.021],[.045,.133+i*.021],[.09,.143+i*.021]]);
 if(['browCrease','elder'].includes(w))paths.push([[-.012,.075],[-.018,.116]],[[.014,.077],[.022,.12]]);
 for(const s of [-1,1]){
  if(['eyeCorners','mature','elder'].includes(w))for(let i=0;i<3;i++)paths.push([[s*.15,.026],[s*(.174+i*.003),.037-i*.015]]);
  if(['underEye','elder'].includes(w))paths.push([[s*.055,-.008],[s*.092,-.023],[s*.13,-.012]]);
  if(['smileLines','mature','elder'].includes(w))paths.push([[s*.047,-.075],[s*.064,-.105],[s*.067,-.145]]);
 }
 for(const p of paths)facialLine(head,p,detail,w==='elder'?.0016:.0011,[0,0],.003);
 const upper=a.upperWrinkles,lower=a.lowerWrinkles,extra=[];
 if(['single','double','triple','arched','aged'].includes(upper))for(let i=0;i<({single:1,double:2,triple:3,arched:2,aged:3}[upper]);i++)extra.push([[-.085,.13+i*.022],[-.035,.128+i*.022+(upper==='arched'?.016:0)],[.03,.13+i*.022],[.085,.139+i*.022]]);
 if(['furrow','worry','aged'].includes(upper))for(const s of [-1,1])extra.push([[s*.012,.075],[s*(upper==='worry'?.04:.017),.115],[s*.022,.132]]);
 for(const s of [-1,1]){
  if(['crows','aged'].includes(upper))for(let i=0;i<3;i++)extra.push([[s*.147,.027],[s*.18,.043-i*.017]]);
  if(['underLight','underDeep','tired','aged'].includes(lower)){extra.push([[s*.051,-.009],[s*.084,-.022],[s*.126,-.013]]);if(lower!=='underLight')extra.push([[s*.063,-.028],[s*.10,-.035],[s*.138,-.023]]);}
  if(['nasolabial','nasolabialLong','mature','aged','tired'].includes(lower))extra.push([[s*.047,-.075],[s*.066,-.104],[s*.068,['nasolabial','tired'].includes(lower)?-.125:-.155]]);
  if(['marionette','aged'].includes(lower))extra.push([[s*.064,-.14],[s*.073,-.178],[s*.066,-.199]]);
  if(['cheek','hollow','mature','aged'].includes(lower))extra.push([[s*.17,-.079],[s*.143,-.112],[s*.118,lower==='cheek'?-.12:-.163]]);
  if(lower==='dimples'||lower==='leftDimple'&&s===-1)extra.push([[s*.08,-.126],[s*.085,-.138],[s*.077,-.147]]);
  if(lower==='lip')for(let i=0;i<3;i++)extra.push([[s*(.013+i*.013),-.108],[s*(.015+i*.015),-.118]]);
 }
 if(['chin','mature','aged'].includes(lower))extra.push([[-.042,-.194],[0,-.20],[.04,-.193]]);
 for(const p of extra)facialLine(head,p,detail,lower==='aged'?.0016:.0011,[0,0],.003);
 const m=a.makeup,c=a.makeupColor;
 for(const s of [-1,1]){
  const ex=s*(.089+a.eyeSpacing),ey=.035+a.eyeY;
  const ep=FEATURE_PROFILES[a.eyeStyle],angle=s*(a.eyeRotation*Math.PI/180+(ep?.tilt||0));
  const eyePatch=points=>{const scaleX=a.eyeSize*a.eyeWidth*(ep?.w||.054)/.054,scaleY=a.eyeSize*a.eyeHeight*(ep?.h||({anime:.032,round:.028,narrow:.017,sleepy:.019}[a.eyeStyle]||.025))/.025;const ps=points.map(([px,py])=>{const x=(px-ex)*scaleX,y=(py-ey)*scaleY;return[ex+x*Math.cos(angle)-y*Math.sin(angle),ey+x*Math.sin(angle)+y*Math.cos(angle)];});facialPatch(head,ps,c,[0,0],.002);};
  if(['upper','smoky','wing'].includes(m)){
   eyePatch([[ex-.057,ey+.009],[ex-.035,ey+.048],[ex+.015,ey+.05],[ex+.058,ey+.01],[ex+.02,ey+.028],[ex-.025,ey+.03]]);
   if(m==='wing')eyePatch([[ex+s*.04,ey+.015],[ex+s*.083,ey+.045],[ex+s*.054,ey-.003]]);
   if(m==='smoky')eyePatch([[ex-.055,ey-.009],[ex,ey-.037],[ex+.055,ey-.008],[ex+.028,ey-.024],[ex-.025,ey-.025]]);
  }
  if(m==='blush')facialPatch(head,[[s*.085,-.065],[s*.17,-.037],[s*.177,-.065],[s*.11,-.093]],c,[0,0],.003);
  if(m==='warpaint')for(let i=0;i<3;i++)facialLine(head,[[s*(.10+i*.024),-.055],[s*(.086+i*.024),-.11]],c,.004,[0,0],.004);
  if(m==='mask')facialPatch(head,[[s*.018,.068],[s*.17,.072],[s*.19,-.015],[s*.025,-.018]],c,[0,0],.001);
 }
 if(m==='tear')facialPatch(head,[[.133,-.012],[.143,-.044],[.14,-.058],[.126,-.058],[.124,-.044]],c,[0,0],.004);
}

export function drawEyeDetails({a,e,facialPatch:patch,facialLine:line,ovalPoints,ink,profile=null}){
 if(a.eyeStyle==='none')return;
 const legacyH={round:.028,anime:.032,narrow:.017,sleepy:.019,dot:.013,closed:.01};
 const sx=(profile?.w||.054)/.054,sy=(profile?.h||legacyH[a.eyeStyle]||.025)/.025;
 const transform=ps=>ps.map(([x,y])=>[x*sx,y*sy]);
 const facialPatch=(parent,ps,...args)=>patch(parent,transform(ps),...args);
 const facialLine=(parent,ps,...args)=>line(parent,transform(ps),...args);
 const s=e.position.x<0?-1:1;
 const lashCount={outer:1,double:2,fan:3,doll:5,spike:3}[a.eyeLashes]||0;
 for(let i=0;i<lashCount;i++){const x=s*(a.eyeLashes==='doll'?-.035+i*.018:.043-i*.01),y=.017+Math.sin(i*.6)*.009;facialLine(e,[[x,y],[x+s*(.012-i*.001),y+.014+(a.eyeLashes==='spike'?.008:0)]],ink,a.eyeLashes==='spike'?.0022:.0015,[0,0],.009);}
 if(a.lowerLashes==='three')for(let i=0;i<3;i++)facialLine(e,[[s*(.025+i*.008),-.016],[s*(.03+i*.009),-.027]],ink,.0013,[0,0],.008);
 if(a.upperEyeFold!=='none')for(let i=0;i<(a.upperEyeFold==='double'?2:1);i++)facialLine(e,[[-.043,.032+i*.009],[-.012,.041+i*.009],[.024,.038+i*.009],[.044,.025+i*.009]],a.detailColor,.0011,[0,0],.008);
 if(a.lowerEyeFold!=='none')facialLine(e,[[a.lowerEyeFold==='long'?-.043:-.022,-.027],[0,-.033],[.032,-.026]],a.detailColor,.0011,[0,0],.008);
 if(['closed','dot'].includes(a.eyeStyle)||['closed','cross','dot','hollow'].includes(profile?.mark)||a.eyeHighlight==='none')return;
 const cx=-.005,cy=.008,h=a.eyeHighlight;let points;
 if(h==='dot'||h==='double'||h==='sparkle')points=ovalPoints(cx,cy,.0045,.0045,16);
 if(h==='oval')points=ovalPoints(cx,cy,.0035,.007,16);
 if(h==='bar')points=[[cx-.002,cy-.006],[cx+.002,cy-.006],[cx+.002,cy+.007],[cx-.002,cy+.007]];
 if(h==='diamond')points=[[cx,cy+.008],[cx+.006,cy],[cx,cy-.008],[cx-.006,cy]];
 if(h==='star')points=Array.from({length:10},(_,i)=>{const t=i*Math.PI/5,r=i%2?.003:.008;return[cx+Math.sin(t)*r,cy+Math.cos(t)*r];});
 if(h==='heart')points=Array.from({length:32},(_,i)=>{const t=i/32*Math.PI*2;return[cx+.006*Math.sin(t)**3,cy+.0005*(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))];});
 if(h==='crescent')points=[[cx,cy+.008],[cx-.006,cy+.003],[cx-.006,cy-.003],[cx,cy-.008],[cx-.002,cy-.002],[cx-.002,cy+.003]];
 if(points)facialPatch(e,points,'#fff8df',[0,0],.011);
 if(['double','sparkle'].includes(h))facialPatch(e,ovalPoints(.008,-.008,.0025,.0025,12),'#fff8df',[0,0],.011);
 if(h==='sparkle')facialPatch(e,ovalPoints(.008,.012,.0018,.0018,10),'#fff8df',[0,0],.011);
}

export function detailPartIcon(field,value){
 if(!DETAIL_OPTIONS[field]||value==='none')return null;
 const index=DETAIL_OPTIONS[field].findIndex(o=>o.value===value),face='<ellipse cx="32" cy="31" rx="20" ry="25" fill="#edd5be" stroke="#4f625c"/>';
 if(field==='earStyle'){const pointed=['pointed','longpoint'].includes(value),r=value==='large'?13:value==='small'?7:10;return pointed?`<path d="M19 20L${value==='longpoint'?59:49} 7L39 47Q25 59 19 20Z" fill="#edd5be"/><path d="M27 27L43 17L32 39"/>`:`<ellipse cx="32" cy="32" rx="${value==='flared'?16:r}" ry="${value==='round'?12:r*1.6}" fill="#edd5be"/><path d="M29 21Q44 21 34 37L29 44"/>`;}
 if(['freckles','moleStyle'].includes(field)){let marks='';if(field==='moleStyle'||value.startsWith('beauty')||value==='nose')marks=`<ellipse cx="${value==='beautyLeft'?21:40}" cy="41" rx="2" ry="${value==='oval'?3:2}" fill="#795440"/>`;else for(let i=0;i<(value==='dense'?28:14);i++)marks+=`<circle cx="${18+(i*13%29)}" cy="${31+(i*7%13)}" r=".9" fill="#795440"/>`;return face+marks;}
 if(field==='upperWrinkles'||field==='lowerWrinkles'){let marks='';const top=field==='upperWrinkles';for(let i=0;i<1+index%3;i++)marks+=top?`<path d="M20 ${17+i*5}Q32 ${21+i*5} 44 ${17+i*5}"/>`:`<path d="M${20-i*3} 33Q${24-i*3} 43 ${22-i*3} 47M${44+i*3} 33Q${40+i*3} 43 ${42+i*3} 47"/>`;return face+marks;}
 if(field==='makeup'){const c='#9b6a78';return face+(value==='blush'?`<ellipse cx="20" cy="37" rx="7" ry="3" fill="${c}"/><ellipse cx="44" cy="37" rx="7" ry="3" fill="${c}"/>`:value==='warpaint'?`<path d="M16 34L22 43M22 34L28 43M36 34L42 43M42 34L48 43" stroke="${c}" stroke-width="3"/>`:`<path d="M14 29Q23 13 30 28L23 24ZM34 28Q42 13 51 29L42 24Z" fill="${c}"/>${value==='smoky'?'<path d="M15 32Q23 42 30 32M34 32Q43 42 50 32" stroke="#9b6a78" stroke-width="4"/>':''}${value==='wing'?'<path d="M14 29L9 19L21 26M51 29L56 19L44 26" fill="#9b6a78"/>':''}`);}
 const eye='<path d="M8 33Q30 10 56 33Q32 47 8 33Z" fill="#fffdf5"/><ellipse cx="32" cy="31" rx="10" ry="12" fill="#58776b"/>';
 if(field==='eyeHighlight'){const glyph={dot:'•',double:'⠒',oval:'●',bar:'▯',star:'★',diamond:'◆',heart:'♥',crescent:'☾',sparkle:'✦'}[value]||'•';return eye+`<text x="32" y="36" font-size="19" fill="#fffdf3" stroke="none" text-anchor="middle">${glyph}</text>`;}
 if(field==='eyeLashes'||field==='lowerLashes'){let marks='';for(let i=0;i<(field==='lowerLashes'?3:index);i++){const x=field==='lowerLashes'?33+i*6:18+i*7;marks+=`<path d="M${x} ${field==='lowerLashes'?40:22}L${x+3} ${field==='lowerLashes'?49:13}" stroke-width="2"/>`;}return eye+marks;}
 return eye+`<path d="${field==='upperEyeFold'?'M12 20Q32 2 54 20':'M18 46Q35 57 51 44'}"/>${value==='double'?'<path d="M17 13Q34 1 49 12"/>':''}`;
}
