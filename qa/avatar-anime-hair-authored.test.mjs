import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {ANIME_FRONT,ANIME_BACK,animeHairIcon,buildAnimeHair} from '../src/avatar-anime-hair.js';
import {HAIR_FRONT_DESIGNS,HAIR_BACK_DESIGNS,hairPartIcon} from '../src/avatar-hair-catalog.js';
import {faceSurfacePoint} from '../src/avatar-model.js';
import {normalizeAppearance} from '../src/avatar-schema.js';
import {ANIME_PRESETS} from '../src/avatar-anime.js';
import {portraitActor,disposeActor} from '../src/characters.js';

const appearance=normalizeAppearance({artStyle:'anime',faceShape:'anime_pentagon',hairFront:'anime_arcfringe',hairBack:'anime_frame',hairColor:'#cc5025',hairSecondaryColor:'#f08c4c',hairFrontLength:1,hairBackLength:1,hairVolume:1});
function frontAt(x,y,a=appearance){
 let lo=-1,hi=1;
 for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(faceSurfacePoint(a.faceShape,0,mid,0,a)[1]<y)lo=mid;else hi=mid;}
 const yy=(lo+hi)/2;lo=0;hi=1;
 for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(Math.abs(faceSurfacePoint(a.faceShape,mid,yy,0,a)[0])<Math.abs(x))lo=mid;else hi=mid;}
 return faceSurfacePoint(a.faceShape,(lo+hi)/2,yy,Math.sqrt(Math.max(.003,1-((lo+hi)/2)**2-yy*yy)),a)[2];
}
function build(overrides={},faceScale=[1,1,1]){
 const a={...appearance,...overrides},meshes=[];
 buildAnimeHair({a,front:a.hairFront,back:a.hairBack,faceScale,frontAt:(x,y)=>frontAt(x/faceScale[0],y/faceScale[1],a)*faceScale[2],
  surface:(positions,indices,color,name)=>{
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();
   const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));mesh.name=name;mesh.updateMatrixWorld(true);meshes.push(mesh);return mesh;
  },lock:()=>assert.fail('the authored pair must not reuse a generic pointed lock')});
 return meshes;
}
const isNape=mesh=>/^back-anime_frame-nape-(-1|1)$/.test(mesh.name);
const clean=meshes=>meshes.forEach(m=>{m.geometry.dispose();m.material.dispose();});
const signature=meshes=>createHash('sha256').update(JSON.stringify(meshes.map(m=>[m.name,...m.geometry.attributes.position.array]))).digest('hex');
function closedSolid(mesh){
 const p=mesh.geometry.attributes.position,ix=mesh.geometry.index.array,edges=new Map();let volume=0;
 assert.ok([...p.array].every(Number.isFinite),mesh.name+' finite positions');
 assert.ok([...mesh.geometry.attributes.normal.array].every(Number.isFinite),mesh.name+' finite normals');
 for(let i=0;i<ix.length;i+=3){
  const a=new THREE.Vector3().fromBufferAttribute(p,ix[i]),b=new THREE.Vector3().fromBufferAttribute(p,ix[i+1]),c=new THREE.Vector3().fromBufferAttribute(p,ix[i+2]);
  assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()>1e-20,mesh.name+' nondegenerate triangles');
  volume+=a.dot(b.clone().cross(c))/6;
  for(const [u,v] of [[ix[i],ix[i+1]],[ix[i+1],ix[i+2]],[ix[i+2],ix[i]]]){
   assert.ok(u>=0&&v<p.count,mesh.name+' valid indices');const key=Math.min(u,v)+':'+Math.max(u,v),edge=edges.get(key)||[0,0];edge[0]++;edge[1]+=u<v?1:-1;edges.set(key,edge);
  }
 }
 for(const edge of edges.values())assert.deepEqual(edge,[2,0],mesh.name+' closed, consistently wound edge');
 assert.ok(volume>1e-10,mesh.name+' positive enclosed volume');
}

test('new catalogue entries/icons append to the existing 4+4 without reindexing',()=>{
 assert.deepEqual(ANIME_FRONT.map(d=>d.value),['anime_center','anime_swept','anime_fan','anime_flame','anime_arcfringe']);
 assert.deepEqual(ANIME_BACK.map(d=>d.value),['anime_bob','anime_twintails','anime_braid','anime_short','anime_frame']);
 for(const entries of [ANIME_FRONT,ANIME_BACK])entries.forEach((d,i)=>{assert.equal(d.family,'anime');assert.equal(d.variant,i);});
 assert.equal(HAIR_FRONT_DESIGNS.anime_arcfringe.label,'动漫 · 弧顶错落齐刘海');
 assert.equal(HAIR_BACK_DESIGNS.anime_frame.label,'动漫 · 贴颈侧帘');
 for(const [field,id] of [['hairFront','anime_arcfringe'],['hairBack','anime_frame']]){assert.equal(hairPartIcon(field,id),animeHairIcon(id));assert.notEqual(animeHairIcon(id),animeHairIcon('anime_center'));assert.ok(!animeHairIcon(id).includes('image'));}
 assert.equal(normalizeAppearance(appearance).hairFront,'anime_arcfringe');assert.equal(normalizeAppearance(appearance).hairBack,'anime_frame');
});

test('all sixteen legacy combinations retain their exact pre-change construction',()=>{
 const calls=[];
 for(const f of ANIME_FRONT.slice(0,4))for(const b of ANIME_BACK.slice(0,4))buildAnimeHair({a:{hairColor:'#db592c',hairSecondaryColor:'#f08c4c',hairTwoTone:true,accessoryColor:'#382c33'},front:f.value,back:b.value,faceScale:[1,1,1],frontAt:(x,y)=>.19*Math.sqrt(Math.max(.003,1-(x/.255)**2-(y/.282)**2)),surface:(...v)=>calls.push(['surface',...v]),lock:(...v)=>calls.push(['lock',...v])});
 // Captured from this module before adding the new families, including colors.
 assert.equal(createHash('sha256').update(JSON.stringify(calls)).digest('hex'),'5440c48257dead2f5361b7ea91fec6f2240238c54d5d69f6ef17839155447a49');
});

test('every authored patch is a closed indexed 3D solid at all supported face proportions',()=>{
 for(const scale of [[1,1,1],[1.08,.92,1],[.89,1.12,1],[.95,1.04,1]]){
  const meshes=build({},scale);try{assert.equal(meshes.length,9);meshes.forEach(closedSolid);}finally{clean(meshes);}
 }
});

function frontHem(crown){
 const p=crown.geometry.attributes.position,outerCount=p.count/2,cols=(outerCount-1)/56;
 assert.ok(Number.isInteger(cols)&&cols>240,'feature-aware continuous shell grid');
 return Array.from({length:cols},(_,i)=>new THREE.Vector3().fromBufferAttribute(p,outerCount-cols+i))
  .filter(v=>v.z>0&&Math.abs(v.x)<.254).sort((a,b)=>a.x-b.x);
}

test('round7 preserves the accepted crown and lowest tip on one continuous six-lock shell',()=>{
 const meshes=build();try{
  const front=meshes.filter(m=>m.name.startsWith('front-'));
  assert.equal(front.length,4,'one integrated crown/fringe, one part and two thin flow marks, not overlapping slabs');
  assert.ok(!meshes.some(m=>m.name.includes('-bang-')),'no detached upper bang caps');
  const crown=meshes.find(m=>m.name.endsWith('-crown')),box=crown.geometry.boundingBox,D=.242;
  assert.ok(Math.abs(box.max.y-.458)<1e-6,'accepted round3 crown height is locked');
  assert.ok(box.min.z<-.26,'crown wraps the occiput');
  assert.ok(box.max.z-box.min.z>.50,'real front/side/back volume');
  const part=meshes.find(m=>m.name.endsWith('-part')).geometry.boundingBox;
  assert.ok(part.min.x>0&&part.max.x<.03,'slightly off-centre roots');
  // Upper pieces must fit one round envelope; closed topology alone did not
  // catch the old protruding temple wings. These are local geometric checks,
  // not a substitute for the reviewer measuring 2D pupil spacing in a render.
  for(const mesh of meshes){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(y<.20)continue;
   assert.ok((x/.294)**2+((y-.088)/.370)**2<1.0001,mesh.name+' inside front round envelope');
   assert.ok(((z+.012)/.263)**2+((y-.088)/.370)**2<1.012,mesh.name+' inside side round envelope');
  }}
  const hem=frontHem(crown);
  const tips=hem.filter((v,i)=>i>0&&i<hem.length-1&&v.y<hem[i-1].y&&v.y<hem[i+1].y);
  assert.equal(tips.length,6,'six distinct short locks on one connected lower edge');
  const expected=[[-.224,.099],[-.166,.085],[-.051,.076],[.027,.063],[.130,.088],[.215,.105]];
  tips.forEach((tip,i)=>{assert.ok(Math.abs(tip.x-expected[i][0])<.001);assert.ok(Math.abs(tip.y-expected[i][1])<.001);});
  const spans=tips.slice(1).map((p,i)=>p.x-tips[i].x);
  assert.ok(Math.max(...spans)>1.8*Math.min(...spans),'visibly unequal spacing, not copied teeth');
  assert.ok(Math.max(...tips.map(p=>p.y))-Math.min(...tips.map(p=>p.y))>.040,'varied tip lengths');
  const lowest=tips.reduce((a,b)=>a.y<b.y?a:b);
  assert.ok(Math.abs(lowest.x-.027)<1e-6&&Math.abs(lowest.y-.063)<1e-6,'accepted round3 lowest tip stays in place');
  assert.ok((lowest.y-.016)/D>=.15&&(lowest.y-.016)/D<=.25,'lowest tip clears pupil line by the target local ratio');
  for(const i of [0,1,4,5])assert.ok(tips[i].y>=.080,'local side extensions still clear the eye tops');
  const sampleY=x=>{const j=hem.findIndex(p=>p.x>=x),a=hem[j-1],b=hem[j];return a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);};
  // Every end now tapers, including the four formerly round side bowls.
  // Width/height tests below separately guard against suspended needle tips.
  tips.forEach((tip,i)=>{for(const dx of [-.004,.004]){
   const minimum=(i===2||i===3)&&dx<0?.001:.0025;
   assert.ok(sampleY(tip.x+dx)-tip.y>minimum,'six tapered returns, with a softer central sweeping flank');
  }});
  // Cover all scalp ABOVE the intentionally open valleys, and each lock's
  // immediate interior. No image map, floating roots or forehead cracks.
  const coverage=[];
  for(let y=.150;y<=.430;y+=.01)for(let x=-.245;x<=.245;x+=.015){
   if((x/.294)**2+((y-.088)/.370)**2<.92)coverage.push([x,y]);
  }
  for(const p of hem)if(Math.abs(p.x)<.235)coverage.push([p.x,p.y+.006]);
  for(const [x,y] of coverage){
   const ray=new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1)),hits=ray.intersectObjects(front,false);
   assert.ok(hits.length,'continuous scalp coverage at '+x+','+y);
   assert.ok(hits[0].point.z>=frontAt(x,y)+.01,'hair outside skin at '+x+','+y);
  }
 }finally{clean(meshes);}
});

test('round7 keeps accepted valley positions, narrow mouths and the reduced scalp opening',()=>{
 const meshes=build();try{
  const crown=meshes.find(m=>m.name.endsWith('-crown')),hem=frontHem(crown),D=.242,pupilY=.016;
  const tips=hem.filter((v,i)=>i>0&&i<hem.length-1&&v.y<hem[i-1].y&&v.y<hem[i+1].y);
  // Head-local trial targets, not measured perspective-image acceptance.
  const valleys=[[-.198,.119,.161],[-.110,.132,.184],[-.018,.138,.190],[.058,.130,.182],[.165,.120,.162]];
  // Use the SAME round3 baseline, not a new lower baseline through the four
  // locally extended tips. Integrate only exposed area above that fixed line;
  // added hair below it cannot cancel any extra scalp exposure elsewhere.
  const baselineTips=[.108,.098,.076,.063,.099,.110];
  const oldCutAreas=[.0011299322482657415,.003176378739823016,.003304650482532298,.004393231358586401,.0018296459608112547];
  const peaks=[];
  valleys.forEach(([x,y,oldY],i)=>{
   const a=tips[i],b=tips[i+1],points=hem.filter(p=>p.x>=a.x&&p.x<=b.x);
   const peak=points.reduce((a,b)=>a.y>b.y?a:b);peaks.push(peak);
   assert.ok(Math.abs(peak.x-x)<1e-6&&Math.abs(peak.y-y)<1e-6,'authored valley without a control-point overshoot');
   assert.ok((oldY-peak.y)/D>=.15&&(oldY-peak.y)/D<=.25,'valley lowered .15-.25 of working D');
   assert.ok((peak.y-pupilY)/D>=.35&&(peak.y-pupilY)/D<=.55,'major valley lies .35-.55D above local pupil line');
   const rise=peak.y-Math.max(a.y,b.y),lip=points.filter(p=>p.y>peak.y-rise*.25);
   assert.ok(lip.at(-1).x-lip[0].x<.012,'short narrow opening, not a flat-bottomed broad gap');
   assert.ok(peak.y-Math.min(a.y,b.y)<.076,'no return to the .10-.13-high long petals');
   let area=0;
   for(let j=1;j<points.length;j++){
    const p=points[j-1],q=points[j],base=x=>baselineTips[i]+(baselineTips[i+1]-baselineTips[i])*(x-a.x)/(b.x-a.x);
    const d0=p.y-base(p.x),d1=q.y-base(q.x),dx=q.x-p.x;
    if(d0>=0&&d1>=0)area+=dx*(d0+d1)/2;
    else if(d0>0)area+=dx*d0*d0/(2*(d0-d1));
    else if(d1>0)area+=dx*d1*d1/(2*(d1-d0));
   }
   assert.ok(area>0&&area<oldCutAreas[i]*.70,'each bare-scalp wedge shrinks by at least 30% from round3');
   // Each side is monotone towards its peak: no tiny extra teeth introduced by
   // the shorter, independently authored shoulders and return curves.
   for(let j=1;j<points.length;j++){
    if(points[j].x<=peak.x)assert.ok(points[j].y>=points[j-1].y-1e-6);
    if(points[j-1].x>=peak.x)assert.ok(points[j].y<=points[j-1].y+1e-6);
   }
  });
  const joins=[-.254,...peaks.map(p=>p.x),.254],widths=tips.map((_,i)=>joins[i+1]-joins[i]);
  assert.ok(Math.max(...widths)<.115,'split the former .126-wide left petal by redistributing joins');
  assert.ok(Math.max(...widths)>1.9*Math.min(...widths),'unequal widths, not a repeated scallop row');
  assert.ok(Math.max(...peaks.map(p=>p.y))-Math.min(...peaks.map(p=>p.y))>.018,'staggered valley heights');
 }finally{clean(meshes);}
});

test('round9 freezes the complete round8 crown, frame, mantle and flow geometry outside the two napes',()=>{
 const meshes=build();try{
  // Captured from frozen round8 BEFORE the nape-only revision; crown is now locked too.
  assert.equal(signature(meshes.filter(m=>!isNape(m))),'1c6b931445b5d9331dec66a3b0aef98fc057b8957e62d1e86eb2d8549104e6a8','all accepted non-nape XYZ stay byte-exact');
  const locked=meshes.filter(m=>!isNape(m)&&!m.name.includes('-curtain-'));
  assert.equal(signature(locked),'d9403017bfee305da55a21fecd2760a1317de96474a34359d27629c5cf35b185');
  const curtainYZ=meshes.filter(m=>m.name.includes('-curtain-')).map(m=>[m.name,...m.geometry.attributes.position.array.filter((_,i)=>i%3!==0)]);
  assert.equal(createHash('sha256').update(JSON.stringify(curtainYZ)).digest('hex'),'c61516b4e912902cd24a3aef10176621cc84aaee60a3c7b3b56588bbe93b1688');
 }finally{clean(meshes);}
});

// Geometry-only regressions. A passing section width is not visual acceptance.
test('round8 keeps accepted shoulders and six medium-width tapered ends',()=>{
 const meshes=build();try{
  const hem=frontHem(meshes.find(m=>m.name.endsWith('-crown')));
  const yAt=x=>{const j=hem.findIndex(p=>p.x>=x),a=hem[j-1],b=hem[j];return a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);};
  const crossing=(a,b,y,rising)=>{for(let i=0;i<30;i++){const x=(a+b)/2;if((yAt(x)<y)===rising)a=x;else b=x;}return (a+b)/2;};
  const roots=[[-.254,.139],[-.198,.119],[-.110,.132],[-.018,.138],[.058,.130],[.165,.120],[.254,.133]];
  const tips=[[-.224,.099],[-.166,.085],[-.051,.076],[.027,.063],[.130,.088],[.215,.105]];
  const round5Widths=[.036514247,.064764655,.044730598,.039916693,.066657779,.048118745];
  const widths=[];
  tips.forEach(([tip,low],i)=>{
   const [a,b]=[roots[i],roots[i+1]],height=Math.min(a[1],b[1])-low,y=low+height/2;
   const left=crossing(a[0],tip,y,false),right=crossing(tip,b[0],y,true),width=right-left;
   widths.push(width);
   assert.ok(width/height>.53&&width/height<1.50,'medium-width end, neither dangling needle nor horizontal bowl: '+i);
   assert.ok(Math.abs((left+right)/2-tip)<.014,'controlled side lean, not a distant sideways petal');
   if(i===2||i===3){
    // Closing a lateral valley widens its adjacent upper body; this is not
    // a global lock scale. Separate lower-tip and valley-slice guards below
    // forbid solving the width failure by adding bowls or another needle row.
    assert.ok(width/round5Widths[i]>.95&&width/round5Widths[i]<1.35,'bounded upper-body fill without shrinking the central ends');
   }else{
    assert.ok(width/round5Widths[i]>.32&&width/round5Widths[i]<.82,'reshape the four former round returns into shorter tapered ends');
   }
   // The central left flank is deliberately softer, not another straight V.
   // Widths above and differential-slope tests below also reject bowls/needles.
   for(const dx of [-.004,.004]){
    const minimum=(i===2||i===3)&&dx<0?.001:.0025,rise=yAt(tip+dx)-low;
    assert.ok(rise>minimum&&rise<.016,'taper confined to the short end');
   }
  });
  assert.ok(Math.max(...widths)>1.9*Math.min(...widths),'non-repeated width rhythm');
  assert.ok(Math.abs((roots[3][0]-roots[2][0])-.092)<1e-9&&Math.abs((roots[4][0]-roots[3][0])-.076)<1e-9,'round5 central root allocation retained');
  for(const [x,y] of [[-.239,.109],[-.211,.109],[-.181,.105],[-.123,.11],[-.098,.111],[-.027,.112],[-.009,.11],[.048,.105],[.077,.111],[.146,.109],[.199,.114],[.23,.117]]){
   assert.ok(Math.abs(yAt(x)-y)<1e-6,'feature grid retains each authored shoulder');
   const l=new THREE.Vector2(.001,yAt(x)-yAt(x-.001)),r=new THREE.Vector2(.001,yAt(x+.001)-yAt(x));
   assert.ok(Math.acos(Math.min(1,l.dot(r)/l.length()/r.length()))<.20,'smooth shoulder join, no angular knee at '+x);
  }
 }finally{clean(meshes);}
});

// The previous upper-quarter lip check missed broad openings further below.
// These are frozen head-local mesh slices, not claims about screen-space D.
test('round8 preserves narrowed valleys while redistributing the central lower bodies',()=>{
 const meshes=build();try{
  const hem=frontHem(meshes.find(m=>m.name.endsWith('-crown')));
  const yAt=x=>{const j=hem.findIndex(p=>p.x>=x),a=hem[j-1],b=hem[j];return a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);};
  const crossing=(a,b,y,rising)=>{for(let i=0;i<30;i++){const x=(a+b)/2;if((yAt(x)<y)===rising)a=x;else b=x;}return (a+b)/2;};
  const roots=[[-.254,.139],[-.198,.119],[-.110,.132],[-.018,.138],[.058,.130],[.165,.120],[.254,.133]];
  const tips=[[-.224,.099],[-.166,.085],[-.051,.076],[.027,.063],[.130,.088],[.215,.105]];
  const gap=(i,y)=>crossing(roots[i+1][0],tips[i+1][0],y,false)-crossing(tips[i][0],roots[i+1][0],y,true);
  const baseline=[
   [.104,[.0740076848,.0296412588,.0702455648]],
   [.108,[.0516255865,.0247520814,.0615680170]],
   [.1128,[.0272676539,.0189118242,.0391643531]],
  ];
  for(const [y,old] of baseline){
   for(const [i,j] of [[1,0],[3,2]]){
    const width=gap(i,y);
    assert.ok(width>old[j]*.42&&width<old[j]*.82,'bounded narrowing below valley peak at '+i+','+y);
    const left=crossing(tips[i][0],roots[i+1][0],y,true),right=crossing(roots[i+1][0],tips[i+1][0],y,false);
    assert.ok(left<roots[i+1][0]&&right>roots[i+1][0],'still a real open valley, not an overlapping cap');
   }
   assert.ok(gap(2,y)>old[1]*.75&&gap(2,y)<old[1]*.96,'smaller controlled centre change, not five identical slits');
  }
  for(const i of [2,3]){
   const [tip,low]=tips[i],a=roots[i],b=roots[i+1],nearY=low+.008;
   const left=crossing(a[0],tip,nearY,false),right=crossing(tip,b[0],nearY,true),width=right-left;
   assert.ok(width>.011&&width<.020,'central lower body retains moderate width, neither fine needle nor bulb');
   assert.ok(tip-(left+right)/2>.004&&tip-(left+right)/2<.008,'lower width shifts left of the fixed tip instead of translating the tip');
   const midY=low+(a[1]-low)*.5,curveX=crossing(a[0],tip,midY,false),straightX=(tip+a[0])/2;
   assert.ok(straightX-curveX>.004&&straightX-curveX<.013,'curved lower flank, not a straight triangular wedge');
   const sweep=yAt(tip-.004)-low,returnRise=yAt(tip+.004)-low;
   assert.ok(sweep>.001&&sweep<.003,'soft sweeping approach, not a flat round bowl');
   assert.ok(returnRise>.009&&returnRise<.016,'early upright return, not an extended needle');
   assert.ok(returnRise/sweep>4.5&&returnRise/sweep<9,'genuinely unequal lower flanks, not repeated straight wedges');
  }
 }finally{clean(meshes);}
});

// Round7's whole-flank midpoint could pass while the visible lower half stayed
// almost straight. Measure two adjacent intervals near the unchanged tips and
// require a material departure from the frozen round7 mesh on BOTH sides.
test('round8 bends only the central lower returns and byte-locks the accepted upper valley rim',()=>{
 const meshes=build();try{
  const hem=frontHem(meshes.find(m=>m.name.endsWith('-crown')));
  const upper=hem.filter(p=>p.y>=.1128).map(p=>p.toArray());
  assert.equal(upper.length,94,'same sampled upper valley contour');
  assert.equal(createHash('sha256').update(JSON.stringify(upper)).digest('hex'),'108a64914204176dcab67768946bc3393e4ff8c5fd9a71367b3506e0693c97bd','round7 upper rim XYZ stays byte-exact');
  const yAt=x=>{const j=hem.findIndex(p=>p.x>=x),a=hem[j-1],b=hem[j];return a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);};
  const baseline=[[-.051,.076,.00702594338,.00616320659],[.027,.063,.01043713574,.00773810865]];
  const bends=[];
  for(const [tip,low,oldSweep,oldReturn] of baseline){
   const sweep=yAt(tip-.008)-low,outerSweep=yAt(tip-.016)-yAt(tip-.008);
   const turn=yAt(tip+.004)-low,outerTurn=yAt(tip+.008)-yAt(tip+.004);
   assert.ok(sweep/outerSweep>.45&&sweep/outerSweep<.88,'lower sweep slope changes visibly instead of remaining a straight V');
   assert.ok(turn/outerTurn>1.6&&turn/outerTurn<2.4,'opposite flank turns early, not an equally slanted straight edge');
   assert.ok(oldSweep-sweep>.0025&&oldSweep-sweep<.007,'substantial but bounded curve change on the sweeping flank');
   assert.ok(turn-oldReturn>.0035&&turn-oldReturn<.008,'substantial but bounded curve change on the return flank');
   bends.push(sweep/outerSweep);
  }
  assert.ok(Math.abs(bends[0]-bends[1])>.15,'two independently curved lower bodies, not duplicated wedges');
 }finally{clean(meshes);}
});

test('two fine same-hue flow lines follow the volumetric crown without opening its surface',()=>{
 const meshes=build();try{
  const crown=meshes.find(m=>m.name.endsWith('-crown')),lines=meshes.filter(m=>m.name.includes('-flow-'));
  assert.equal(lines.length,2,'two temple/root strokes, not six outlined petals');
  for(const line of lines){
   const p=line.geometry.attributes.position;assert.equal(p.count,49*3*2);
   assert.ok(line.geometry.boundingBox.max.z-line.geometry.boundingBox.min.z>.020,'stroke follows over .020 of crown depth (versus .0021 thickness), not a camera-facing decal');
   const widths=[];
   for(let row=0;row<=48;row++){
    const a=new THREE.Vector3().fromBufferAttribute(p,row*3),b=new THREE.Vector3().fromBufferAttribute(p,row*3+2);
    const width=Math.hypot(a.x-b.x,a.y-b.y);widths.push(width);
    assert.ok(width>=.00064&&width<=.00301,'fine stroke, not a wide dark border');
    for(let col=0;col<3;col++){
     const i=row*3+col,x=p.getX(i),y=p.getY(i),z=p.getZ(i),backZ=p.getZ(i+49*3);
     const hit=new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1)).intersectObject(crown,false)[0];
     assert.ok(hit,'continuous shell still underneath each flow mark');
     assert.ok(z-hit.point.z>.0009&&z-hit.point.z<.002,'stroke skin attached closely above crown');
     assert.ok(backZ<hit.point.z,'reverse face is embedded, not a floating ribbon');
    }
   }
   assert.ok(widths[0]<widths[24]*.25&&widths.at(-1)<widths[24]*.25,'both stroke ends taper');
   const pts=Array.from({length:p.count/2},(_,i)=>new THREE.Vector3().fromBufferAttribute(p,i));
   for(const angle of [29,90]){const xs=pts.map(p=>p.x*Math.cos(angle*Math.PI/180)-p.z*Math.sin(angle*Math.PI/180));assert.ok(Math.max(...xs)-Math.min(...xs)>.015,'outer flow surface retains depth through rotation, over five times the stroke width without counting thickness');}
  }
 }finally{clean(meshes);}
});

test('round6 eases only the eye-side inner rail and freezes the accepted lower face sections',()=>{
 const meshes=build({hairFront:'none'}),cubic=(p,t)=>p[0]*(1-t)**3+3*p[1]*(1-t)**2*t+3*p[2]*(1-t)*t*t+p[3]*t**3;
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const oldInset=y=>.020*(y>=-.020?smooth((.080-y)/.100):smooth((y+.150)/.130));
 try{for(const sign of [-1,1]){
  const p=meshes.find(m=>m.name==='back-anime_frame-curtain-'+sign).geometry.attributes.position,rows=[];
  let maxMove=0,peak={inset:0,y:0};
  for(let row=0;row<=64;row++){
   const t=row/64,y=cubic([.250,.070,-.240,-.326],t),inner=cubic([.182,.275,.126,.201],t),outer=cubic([.223,.310,.270,.207],t);
   const now=sign*p.getX(row*21),old=inner-oldInset(y),inset=inner-now,delta=now-old;
   rows.push({y,x:now,old});maxMove=Math.max(maxMove,Math.abs(delta));
   if(inset>peak.inset)peak={inset,y};
   assert.ok(inset>=-2e-8&&inset<=.0202,'preserve the round5 coverage amount, not a second .020 inset');
   if(y>=.140||y<=-.030)assert.ok(Math.abs(delta)<2e-8,'outside the eye-side ease, inner rail stays frozen');
   else assert.ok(Math.abs(delta)<.0083,'small local smoothing, not another full-frame translation');
   for(const layer of [0,1])for(let col=0;col<=20;col++){
    const u=col/20,i=layer*65*21+row*21+col;
    assert.ok(Math.abs(sign*p.getX(i)-(now*(1-u)+outer*u))<4e-8,'ease blends to zero at fixed outer rail on both surfaces');
   }
  }
  assert.ok(maxMove>.006&&maxMove<.0083,'the short eye-side kink was actually redistributed');
  assert.ok(peak.inset>=.018&&peak.inset<=.022&&Math.abs(peak.y+.020)<.012,'retain the established upper-cheek coverage');
  const slope=(a,b,k)=>(b[k]-a[k])/(b.y-a.y);
  const eyeSlopes=rows.slice(1).map((r,i)=>({y:(r.y+rows[i].y)/2,now:slope(rows[i],r,'x'),old:slope(rows[i],r,'old')})).filter(r=>r.y<.14&&r.y>-.030);
  const nowMax=Math.max(...eyeSlopes.map(r=>Math.abs(r.now))),oldMax=Math.max(...eyeSlopes.map(r=>Math.abs(r.old)));
  assert.ok(nowMax<oldMax*.72,'spread the rapid inner turn rather than retaining a local pinch');
  for(const y of [.016-.20*.242,-.138,-.259]){
   const index=rows.findIndex(r=>r.y<=y),a=rows[index-1],b=rows[index];
   const interpolate=k=>a[k]+(b[k]-a[k])*(y-a.y)/(b.y-a.y);
   assert.ok(Math.abs(interpolate('x')-interpolate('old'))<2e-8,'pupil-.20D, mouth and chin widths fixed');
  }
 }}finally{clean(meshes);}
});

test('the fixed central tip and lowered valleys leave both enlarged eye openings uncovered',()=>{
 const meshes=build();try{
  // Fixed task fixture: eye centres +/-.108, y=.016; width .146, top .067.
  for(const sign of [-1,1])for(let i=0;i<=24;i++){
   const u=-1+i/12,x=sign*.108+u*.073,top=.016+.051*Math.sqrt(Math.max(0,1-u*u));
   for(const y of [.016,top+.004]){
    const hits=new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1)).intersectObjects(meshes,false);
    assert.ok(!hits.length||hits[0].point.z<frontAt(x,y),'no hair in front of the enlarged eye at '+x+','+y);
   }
  }
 }finally{clean(meshes);}
});

test('frames end below the chin, clear the eye region, and use a short inner nape wrap, not braids',()=>{
 const meshes=build({hairFront:'none'});try{
  assert.equal(meshes.length,5);assert.ok(meshes.every(m=>!m.name.match(/braid|plait|tie|long|ribbon/)));
  for(const sign of [-1,1]){
   const curtain=meshes.find(m=>m.name==='back-anime_frame-curtain-'+sign),box=curtain.geometry.boundingBox;
   assert.ok(box.min.y<-.325&&box.min.y>-.335,'side curtains extend .04 farther below the chin');assert.ok(box.max.z-box.min.z>.11,'curtain retains longitudinal depth, not a planar decal');
   const p=curtain.geometry.attributes.position;
   for(let i=0;i<p.count;i++)if(p.getY(i)<.08&&p.getY(i)>-.045)assert.ok(Math.abs(p.getX(i))>.184,'inset stays outside the outermost eye x=.181; eye-shaped rays check actual clearance');
   // Real cross-sections, not the full length's bounding box: the old sheet
   // was slender head-on but spread into a broad plate at 29/90 degrees.
   for(const y of [.04,-.03,-.138,-.20]){
    let row=0;for(let r=1;r<=64;r++)if(Math.abs(p.getY(r*21)-y)<Math.abs(p.getY(row*21)-y))row=r;
    const section=[];for(const layer of [0,1])for(let c=0;c<=20;c++)section.push(new THREE.Vector3().fromBufferAttribute(p,layer*65*21+row*21+c));
    const projectedWidth=angle=>{const values=section.map(p=>Math.cos(angle)*p.x-Math.sin(angle)*p.z);return Math.max(...values)-Math.min(...values);};
    const depth=projectedWidth(Math.PI/2),oblique=projectedWidth(29*Math.PI/180);
    assert.ok(depth>.040&&depth<.088,'compact but volumetric side section');
    // The requested .020 inner extension necessarily widens the oblique
    // silhouette; keep the old section cap after removing ONLY that inset,
    // and bound the added width by its geometric projection. Depth is frozen.
    const t=row/64,oldInner=.182*(1-t)**3+3*.275*(1-t)**2*t+3*.126*(1-t)*t*t+.201*t**3;
    const inset=oldInner-sign*p.getX(row*21),angle=29*Math.PI/180;
    const oldProjection=section.map((p,i)=>Math.cos(angle)*(p.x+sign*inset*(1-(i%21)/20))-Math.sin(angle)*p.z);
    const oldWidth=Math.max(...oldProjection)-Math.min(...oldProjection);
    assert.ok(oldWidth<.115,'unchanged base section is not a wide oblique slab');
    assert.ok(oblique<=oldWidth+.0200001*Math.cos(angle)&&oblique<projectedWidth(0)*1.6,'oblique widening is limited to the requested inner inset');
   }
   // Root and side rails must not have discontinuous projection-clamp bends.
   const stride=21,rows=64;
   for(const col of [0,10,20])for(let row=1;row<rows;row++){
    const a=new THREE.Vector3().fromBufferAttribute(p,(row-1)*stride+col),b=new THREE.Vector3().fromBufferAttribute(p,row*stride+col),c=new THREE.Vector3().fromBufferAttribute(p,(row+1)*stride+col);
    assert.ok(b.clone().sub(a).angleTo(c.clone().sub(b))<.12,'smooth curtain rail, no angular break');
   }
   for(const y of [-.10,-.138,-.168]){
    let nearest=0;for(let row=1;row<=rows;row++)if(Math.abs(p.getY(row*stride)-y)<Math.abs(p.getY(nearest)-y))nearest=row*stride;
    let lo=-1,hi=0;for(let i=0;i<24;i++){const m=(lo+hi)/2;if(faceSurfacePoint(appearance.faceShape,0,m,0,appearance)[1]<y)lo=m;else hi=m;}
    const yy=(lo+hi)/2,edge=faceSurfacePoint(appearance.faceShape,Math.sqrt(1-yy*yy),yy,0,appearance)[0];
    assert.ok(Math.abs(p.getX(nearest))<edge+.020,'curtain follows narrower lower cheek, not a large gap');
   }
   const nape=meshes.find(m=>m.name==='back-anime_frame-nape-'+sign).geometry.boundingBox;
   assert.ok(nape.max.z<-.035&&nape.min.y>-.36,'neck-side panel stays behind the face and ends at the collar, not in a hanging braid');
   assert.ok(nape.max.x-nape.min.x>.23&&nape.max.z-nape.min.z>.12,'broad rear-jaw coverage with genuine depth, not a detached point or outline strip');
  }
  const ray=new THREE.Raycaster(new THREE.Vector3(1,-.03,.145),new THREE.Vector3(-1,0,0));assert.ok(ray.intersectObjects(meshes,false).length,'visible geometry under strict side rotation');
 }finally{clean(meshes);}
});

// These are geometry/occlusion regressions, not a visual-likeness verdict.
test('round12 napes retain the round9 upper band and concentrate closed panels beside the neck',()=>{
 const meshes=build({chinLength:1.08});try{
  const napes=meshes.filter(isNape);assert.equal(napes.length,2);
  // Captured from round9 before this revision, not recaptured from the candidate.
  const upperBand=napes.map(m=>{
   const p=m.geometry.attributes.position,xyz=[];
   for(let layer=0;layer<2;layer++)for(let row=0;row<49;row++)for(let col=0;col<6;col++)for(let axis=0;axis<3;axis++)xyz.push(p.array[((layer*49+row)*17+col)*3+axis]);
   return [m.name,...xyz];
  });
  assert.equal(createHash('sha256').update(JSON.stringify(upperBand)).digest('hex'),'1de584818377c8b99f075043cf8e7d899bcce1bb20c6398c490e7bf008ec79ab','upper 31.25% of BOTH closed surfaces remains byte-identical');
  for(const mesh of napes){
   const box=mesh.geometry.boundingBox;
   assert.ok(box.min.y<-.34&&box.min.y>-.36,'bounded neck-side extension, not long rear hair');
   const p=mesh.geometry.attributes.position,rows=48,cols=16,stride=cols+1,layerCount=(rows+1)*stride;
   assert.equal(p.count,2*layerCount);
   for(let row=0;row<=rows;row++){
    const upper=new THREE.Vector3().fromBufferAttribute(p,row*stride),lower=new THREE.Vector3().fromBufferAttribute(p,row*stride+cols);
    assert.ok(upper.y-lower.y>.022&&upper.y-lower.y<.121,'every cross-section and both capped ends retain bounded width');
    if(row>=32&&row<=43)assert.ok(upper.y-lower.y>.095,'the byte-frozen inner neck cross-sections remain panels, not a narrow band');
    for(let col=0;col<=cols;col++){
     const i=row*stride+col;
     assert.equal(p.getX(i),p.getX(i+layerCount));assert.equal(p.getY(i),p.getY(i+layerCount));
     assert.ok(p.getZ(i)-p.getZ(i+layerCount)>.080&&p.getZ(i)-p.getZ(i+layerCount)<.104,'real sealed front-to-back thickness');
    }
   }
   for(const col of [0,8,16])for(let row=1;row<rows;row++){
    const a=new THREE.Vector3().fromBufferAttribute(p,(row-1)*stride+col),b=new THREE.Vector3().fromBufferAttribute(p,row*stride+col),c=new THREE.Vector3().fromBufferAttribute(p,(row+1)*stride+col);
    // Round11's shallow bend budget locked in the rejected long triangle.
    // Permit the localized C1 neckward turn, not a blanket rail relaxation.
    // Its lower return (30..32) is checked behind actual clothing below.
    const neckEntry=col===16&&row>=24&&row<=26;
    const collarBend=col===16&&row>=30&&row<=32;
    const middleTurn=col===8&&row>=24&&row<=31;
    const limit=collarBend?.37:neckEntry?.33:middleTurn?.16:col===16?.095:.080;
    assert.ok(b.clone().sub(a).angleTo(c.clone().sub(b))<limit,'bounded turn; unchanged rails keep their previous angle limits');
   }
   assert.ok(p.getZ(24*stride)>p.getZ(0)+.020,'the wrap curves in depth instead of drawing a flat jaw outline');
  }
 }finally{clean(meshes);}
});

test('round9 production napes connect behind the jaw and are occluded by real skin, curtains and neck',()=>{
 const preset=ANIME_PRESETS.find(p=>p.name==='金环赤发');assert.ok(preset);
 const actor=portraitActor('round9-rear-jaw-wrap',{appearance:preset.values});
 try{
  actor.mesh.updateMatrixWorld(true);
  const head=actor._head,skin=head.getObjectByName('face-skin'),neck=actor.mesh.getObjectByName('neck'),hair=head.getObjectByName('hair');
  const napes=hair.children.filter(isNape),surfaces=[skin,neck,...hair.children.filter(m=>m.isMesh)];
  assert.equal(napes.length,2);assert.ok(neck);
  const cast=(x,y,targets=surfaces)=>new THREE.Raycaster(head.localToWorld(new THREE.Vector3(x,y,1)),new THREE.Vector3(0,0,-1).transformDirection(head.matrixWorld)).intersectObjects(targets,false);
  // Find the existing production skin edge; do not use a substitute face or
  // move it to manufacture the measured band. Both sides are sampled densely.
  const jawY=x=>{let lo=-.29,hi=-.11;for(let i=0;i<25;i++){const y=(lo+hi)/2;if(cast(x,y,[skin]).length)hi=y;else lo=y;}return (lo+hi)/2;};
  for(const sign of [-1,1]){
   for(let i=0;i<=19;i++){
    const x=sign*(.075+i*.005),edge=jawY(x);
    for(const drop of [.005,.012,.020,.026])assert.equal(cast(x,edge-drop)[0]?.object.name,'back-anime_frame-nape-'+sign,'unbroken visible rear band at '+x+','+(edge-drop));
    assert.equal(cast(x,edge+.008)[0]?.object,skin,'inner edge is buried, not a front-face shadow');
    assert.equal(cast(x,edge-.135,napes).length,0,'neck-side extension stays bounded rather than becoming long rear hair');
   }
   for(let i=0;i<=10;i++){
    const hit=cast(sign*(.170+i*.004),-.211)[0];
    assert.ok(hit&&(isNape(hit.object)||hit.object.name==='back-anime_frame-curtain-'+sign),'no gap between rear wrap and unchanged curtain');
   }
   for(const x of [0,.025,.045])for(const y of [-.270,-.275]){
    assert.ok(cast(sign*x,y,napes).length,'centre ends overlap behind the neck instead of ending in separate points');
    assert.equal(cast(sign*x,y)[0]?.object,neck,'real neck occludes the rear layer without shortening or repainting it');
   }
  }
  for(const nape of napes){const p=nape.geometry.attributes.position;for(let row=0;row<=48;row++){
   const i=row*17,hit=cast(p.getX(i),p.getY(i))[0];
   assert.ok(hit&&!isNape(hit.object),'upper attachment rail is hidden under skin or fixed side hair');
  }}
 }finally{disposeActor(actor);}
});

// A dense FIRST-HIT area grid includes the actual shirt/collar occluders. These
// local orthographic regressions do not replace the independent normal-UI view.
test('round12 retains a connected neck-side panel without filling the middle jaw gap',()=>{
 const preset=ANIME_PRESETS.find(p=>p.name==='金环赤发');assert.ok(preset);
 const actor=portraitActor('round12-neck-side-area',{appearance:preset.values});
 try{
  actor.mesh.updateMatrixWorld(true);
  const head=actor._head,all=[];actor.mesh.traverse(o=>{if(o.isMesh)all.push(o);});
  const napes=all.filter(isNape);assert.equal(napes.length,2);
  const cast=(x,y,targets=all)=>new THREE.Raycaster(head.localToWorld(new THREE.Vector3(x,y,1)),new THREE.Vector3(0,0,-1).transformDirection(head.matrixWorld)).intersectObjects(targets,false);
  for(const sign of [-1,1]){
   const rows=20,cols=23,grid=[],cells=[];
   for(let row=0;row<rows;row++){
    grid[row]=[];
    for(let col=0;col<cols;col++){
     const hit=cast(sign*(.065+col*.005),-.230-row*.005)[0];
     const visible=hit?.object.name==='back-anime_frame-nape-'+sign;
     grid[row][col]=visible;if(visible)cells.push([row,col]);
    }
   }
   // Round11's 245-280 total and rectangle to x=.130 required the rejected
   // middle triangle. Instead constrain WHERE the area remains: beside the
   // neck, below the old band, with a filled patch rather than a thin curve.
   // Separate background rays below forbid replacing it with a new bulge.
   assert.ok(cells.filter(([row,col])=>row>=7&&col<=11).length>=80,'substantial first-hit area is concentrated beside the real neck (x<=.120, y<=-.265)');
   assert.ok(cells.filter(([row])=>row>=11).length>=40,'a continuous panel still extends below the round9 band');
   for(let row=7;row<=14;row++)for(let col=5;col<=10;col++)assert.ok(grid[row][col],'filled .025 by .035 neck-side rectangle, not a curve or separate tips');
   const seen=new Set(),queue=[cells[0]];
   while(queue.length){
    const [row,col]=queue.pop(),key=row+','+col;
    if(row<0||row>=rows||col<0||col>=cols||seen.has(key)||!grid[row][col])continue;
    seen.add(key);for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([row+dr,col+dc]);
   }
   assert.equal(seen.size,cells.length,'all visible panel cells connect to the upper jaw-band region');
   assert.ok(cells.some(([row])=>row===0)&&cells.some(([row])=>row>=16),'one component joins jaw height to the collar');
   // The lower fan continues behind the existing neck/shirt instead of
   // punching through them or being cut into new floating points.
   for(const [x,y] of [[.075,-.300],[.095,-.325],[.050,-.310]]){
    assert.ok(cast(sign*x,y,napes).length,'real closed hair continues behind the occluder');
    assert.ok(['tailored-torso','anime-crew-collar'].includes(cast(sign*x,y)[0]?.object.name),'existing clothing correctly occludes the lower rear surface');
   }
   const p=napes.find(m=>m.name==='back-anime_frame-nape-'+sign).geometry.attributes.position;
   for(const row of [30,31,32]){
    const i=row*17+16;
    assert.ok(['tailored-torso','anime-crew-collar'].includes(cast(p.getX(i),p.getY(i))[0]?.object.name),'the tighter lower-rail transition remains behind real clothing');
   }
  }
 }finally{disposeActor(actor);}
});

test('round12 freezes all nape X and the inner third while extending the narrow middle jaw band',()=>{
 const meshes=build({chinLength:1.08});try{
  const napes=meshes.filter(isNape);
  // These hashes were read from frozen round10 before the patch, not from it.
  const xOnly=napes.map(m=>[m.name,...Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.geometry.attributes.position.getX(i))]);
  assert.equal(createHash('sha256').update(JSON.stringify(xOnly)).digest('hex'),'dda9fcae708f40e78fb02f38a507efba7d50be6a541e7f44a9860698f7e54862','every X coordinate is byte-identical to round10');
  const inner=napes.map(m=>{
   const p=m.geometry.attributes.position,xyz=[];
   for(let layer=0;layer<2;layer++)for(let row=32;row<49;row++)for(let col=0;col<17;col++)for(let axis=0;axis<3;axis++)xyz.push(p.array[((layer*49+row)*17+col)*3+axis]);
   return [m.name,...xyz];
  });
  assert.equal(createHash('sha256').update(JSON.stringify(inner)).digest('hex'),'ebb65c6f4a7f96f5e4e64325b595a2b8c8ba4420009ce92d86207e31813c472f','both surfaces of the neck-side inner third retain round10 geometry');
  for(const mesh of napes){
   const p=mesh.geometry.attributes.position;
   // Do not lock in round11's rejected wide middle transition. Its upper
   // rail is frozen: compare the lower edge with that independent attachment.
   for(let row=16;row<=24;row++){
    const width=p.getY(row*17)-p.getY(row*17+16);
    assert.ok(width>.036&&width<.042,'the narrow attached jaw band continues through the middle, not an early descending triangle');
   }
   // Frozen round11 ordinates demonstrate a substantial middle retraction,
   // not a new snapshot hash or a few-pixel cosmetic adjustment.
   for(const [row,oldY,min] of [[24,-.27396392822265625,.028],[26,-.2941928207874298,.030],[28,-.313565194606781,.020]]){
    assert.ok(p.getY(row*17+16)-oldY>min,'middle lower edge meaningfully retracts while the neck panel stays frozen');
   }
   for(let col=6;col<=16;col++)for(let row=17;row<=32;row++){
    const before=(row-1)*17+col,after=row*17+col;
    assert.ok(p.getY(after)<p.getY(before),'neckward transition never reverses into a new floating lobe');
   }
  }
 }finally{clean(meshes);}
});

test('round12 preserves outer air and opens the middle gap between the rear jaw band and fixed curtains',()=>{
 const preset=ANIME_PRESETS.find(p=>p.name==='金环赤发');assert.ok(preset);
 const actor=portraitActor('round12-middle-jaw-clearance',{appearance:preset.values});
 try{
  actor.mesh.updateMatrixWorld(true);
  const head=actor._head,all=[];actor.mesh.traverse(o=>{if(o.isMesh)all.push(o);});
  const cast=(x,y)=>new THREE.Raycaster(head.localToWorld(new THREE.Vector3(x,y,1)),new THREE.Vector3(0,0,-1).transformDirection(head.matrixWorld)).intersectObjects(all,false);
  // Retain all four round11 outer-gap patches and add three middle patches
  // that its early triangular descent occupied. Actual first hits, not just
  // total area, must leave air between the band and the unchanged curtain.
  for(const sign of [-1,1])for(const [x,y] of [[.170,-.250],[.160,-.270],[.150,-.285],[.140,-.300],[.150,-.254],[.140,-.267],[.130,-.291]])for(const dx of [-.002,0,.002])for(const dy of [-.002,0,.002]){
   assert.equal(cast(sign*(x+dx),y+dy).length,0,'open background between the rear panel and front curtain');
  }
 }finally{disposeActor(actor);}
});

test('production side rays keep the ear opening connected to visible cheek instead of an isolated skin slit',()=>{
 const actor=portraitActor('round3-ear-occlusion',{appearance:{...appearance,earStyle:'natural',earSize:1}});
 try{
  actor.mesh.updateMatrixWorld(true);
  const head=actor._head,skin=head.getObjectByName('face-skin'),hair=head.getObjectByName('hair');
  const ears=head.children.filter(m=>m.isMesh&&m.scale.z===.025&&Math.abs(m.position.x)>.24);
  assert.equal(ears.length,2,'actual production ears, not substitute test ellipsoids');
  const surfaces=[skin,...ears,...hair.children.filter(m=>m.isMesh)];
  for(const sign of [-1,1]){
   const grid=[],rows=13,cols=23;
   for(let r=0;r<rows;r++){
    grid[r]=[];
    for(let c=0;c<cols;c++){
     const y=.036-r*.008,z=-.048+c*.008;
     const ray=new THREE.Raycaster(head.localToWorld(new THREE.Vector3(sign,y,z)),new THREE.Vector3(-sign,0,0).transformDirection(head.matrixWorld));
     const hit=ray.intersectObjects(surfaces,false)[0];grid[r][c]=!hit?'.':hit.object===skin?'S':ears.includes(hit.object)?'E':'H';
    }
   }
   const earCells=[];for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)if(grid[r][c]==='E')earCells.push([r,c]);
   assert.ok(earCells.length>=12,'not merely a tiny surviving skin sliver');
   const seen=new Set(),queue=[earCells[0]];let cheekConnection=false;
   while(queue.length){
    const [r,c]=queue.pop(),key=r+','+c;if(r<0||r>=rows||c<0||c>=cols||seen.has(key)||!['S','E'].includes(grid[r][c]))continue;
    seen.add(key);if(grid[r][c]==='S'&&c>=16)cheekConnection=true;
    for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([r+dr,c+dc]);
   }
   assert.ok(cheekConnection,'ear skin connects across a visible cheek opening at 90 degrees');
   assert.ok(earCells.every(([r,c])=>seen.has(r+','+c)),'no disconnected ear skin islands');
   // Mid-ear rows must retain a continuous skin corridor towards the cheek.
   for(let r=4;r<=10;r++)for(let c=5;c<=16;c++)assert.ok(['S','E'].includes(grid[r][c]),'unbroken ear-to-cheek corridor');
  }
 }finally{disposeActor(actor);}
});

test('hair color stays the requested orange-red; two-tone remains opt-in',()=>{
 for(const hairTwoTone of [false,true]){
  const meshes=build({hairTwoTone});try{
   for(const mesh of meshes){
    assert.equal(mesh.material.map,null,'no image pasted onto the face');
    if(mesh.name.endsWith('-part'))continue;
    if(mesh.name.includes('-flow-')||isNape(mesh)){
     const base=new THREE.Color('#cc5025'),actual=mesh.material.color,factor=isNape(mesh)?.66:.62;
     for(const channel of ['r','g','b'])assert.ok(Math.abs(actual[channel]/base[channel]-factor)<.012,'only flow lines and the rear inner layer use same-hue shading, not black/brown repaint');
    }else assert.equal(mesh.material.color.getHexString(),'cc5025');
   }
   if(hairTwoTone)assert.equal(meshes.find(m=>m.name.endsWith('-part')).material.color.getHexString(),'f08c4c');
  }finally{clean(meshes);}
 }
});

test('front/back build independently and preserve uniform coordinate scaling',()=>{
 const pair=build(),front=build({hairBack:'none'}),back=build({hairFront:'none'}),scaled=build({},[1.1,.93,1.07]);
 try{
  assert.equal(signature(pair.filter(m=>m.name.startsWith('front-'))),signature(front));assert.equal(signature(pair.filter(m=>m.name.startsWith('back-'))),signature(back));
  pair.forEach((m,j)=>{const p=m.geometry.attributes.position,q=scaled[j].geometry.attributes.position;for(let i=0;i<p.count;i++)for(let axis=0;axis<3;axis++)assert.ok(Math.abs(q.array[i*3+axis]-p.array[i*3+axis]*[1.1,.93,1.07][axis])<6e-8,'faceScale applied exactly once');});
 }finally{[pair,front,back,scaled].forEach(clean);}
});

test('production actor honours independent length controls, mirror, bounds and resource disposal',()=>{
 const actors=[],make=extra=>{const actor=portraitActor('authored-hair',{appearance:{...appearance,...extra}});actors.push(actor);return actor.mesh.getObjectByName('hair');};
 const selected=(hair,prefix)=>hair.children.filter(m=>m.isMesh&&m.name.startsWith(prefix));
 try{
  const base=make({});assert.equal(selected(base,'front-anime_arcfringe-').length,4);assert.equal(selected(base,'back-anime_frame-').length,5);
  for(const [field,own,other,values] of [['hairFrontLength','front-','back-',[.75,1.3]],['hairBackLength','back-','front-',[.65,1.5]]])for(const value of values){
   const hair=make({[field]:value});assert.notEqual(signature(selected(hair,own)),signature(selected(base,own)));assert.equal(signature(selected(hair,other)),signature(selected(base,other)));
   assert.deepEqual(hair.getObjectByName('hair-crown').geometry.attributes.position.array,base.getObjectByName('hair-crown').geometry.attributes.position.array,'catalogue supporting cap is untouched');
  }
  for(const hairVolume of [.85,1.25]){const hair=make({hairVolume});assert.notEqual(signature(selected(hair,'front-')),signature(selected(base,'front-')));for(const mesh of [...selected(hair,'front-'),...selected(hair,'back-')])closedSolid(mesh);}
  const mirrored=make({hairMirror:true});assert.equal(mirrored.scale.x,-1);assert.equal(signature(selected(mirrored,'front-')),signature(selected(base,'front-')));
 }finally{for(const actor of actors){disposeActor(actor);assert.ok(Object.values(actor._resources).every(set=>set.size===0));}}
});
