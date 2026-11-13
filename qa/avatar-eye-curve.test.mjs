import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createEyeCurve, readEyeShape, EYE_CURVE_FIELDS } from '../src/avatar-eye-curve.js';
import { animeEyeContour, drawAnimeEye, ANIME_PRESETS, ANIME_RANGES, EYE_CURVE_DEFAULTS } from '../src/avatar-anime.js';
import { normalizeAppearance } from '../src/avatar-schema.js';

// Independent, frozen pre-fix algorithm: never implement this via the new module.
const cubic = (p0,p1,p2,p3,t) => p0*(1-t)**3+3*p1*t*(1-t)**2+3*p2*t*t*(1-t)+p3*t**3;
function legacyContour(a) {
  const angular=a.eyeStyle==='anime_angular', calm=a.eyeStyle==='anime_calm', designed=a.eyeStyle==='anime_designed';
  const w=angular?.066:.060, h=angular?.030:calm?.037:.047;
  const curve=(upper,t)=>[
    w*cubic(-1,a[upper?'eyeUpperInnerX':'eyeLowerInnerX'],a[upper?'eyeUpperOuterX':'eyeLowerOuterX'],1,t),
    h*cubic(a.eyeInnerY,a[upper?'eyeUpperInnerY':'eyeLowerInnerY']*(upper?1-a.eyeLid*.28:1),a[upper?'eyeUpperOuterY':'eyeLowerOuterY']*(upper?1-a.eyeLid*.28:1),a.eyeOuterY,t)
  ];
  const yAt=(x,upper)=>{
    let lo=0,hi=1;
    for(let i=0;i<22;i++) {const t=(lo+hi)/2;if(curve(upper,t)[0]<x)lo=t;else hi=t;}
    return curve(upper,(lo+hi)/2)[1];
  };
  const top=x=>designed?yAt(x,true):angular?h*(.54+.30*x/w):h*(.12+.90*Math.sqrt(Math.max(0,1-(x/w)**2)))*(1-a.eyeLid*.28);
  const bottom=x=>designed?yAt(x,false):-h*(angular?.66:.80)*Math.sqrt(Math.max(0,1-(x/w)**2));
  const upper=Array.from({length:49},(_,i)=>{const x=-w+2*w*i/48;return[x,top(x)];});
  const lower=Array.from({length:49},(_,i)=>{const x=w-2*w*i/48;return[x,bottom(x)];});
  return {w,h,top,bottom,upper,lower};
}
const A = { eyeStyle:'anime_designed', eyeLid:1, eyeInnerY:.4, eyeOuterY:.4,
  eyeUpperInnerX:-.95, eyeUpperOuterX:-.95, eyeUpperInnerY:.2, eyeUpperOuterY:.2,
  eyeLowerInnerX:.95, eyeLowerOuterX:.95, eyeLowerInnerY:-.05, eyeLowerOuterY:-.05 };
const B = { ...A, eyeInnerY:-.3, eyeOuterY:-.3,
  eyeUpperInnerX:.95, eyeUpperOuterX:.95, eyeLowerInnerX:-.95, eyeLowerOuterX:-.95 };
const mirror = a => ({...a, eyeInnerY:a.eyeOuterY, eyeOuterY:a.eyeInnerY,
  eyeUpperInnerX:-a.eyeUpperOuterX, eyeUpperOuterX:-a.eyeUpperInnerX,
  eyeUpperInnerY:a.eyeUpperOuterY, eyeUpperOuterY:a.eyeUpperInnerY,
  eyeLowerInnerX:-a.eyeLowerOuterX, eyeLowerOuterX:-a.eyeLowerInnerX,
  eyeLowerInnerY:a.eyeLowerOuterY, eyeLowerOuterY:a.eyeLowerInnerY });
const extremes = [A, B, mirror(A), mirror(B)];
// Ordered continuous cubics can still leak through the old 49-point white mesh.
const highCurvature = { eyeStyle:'anime_designed',
  eyeInnerY:.19751988325733688, eyeOuterY:-.1510735002811998,
  eyeUpperInnerX:-.7154807626036926, eyeUpperInnerY:1.2448740750551224,
  eyeUpperOuterX:-.0076216684887185915, eyeUpperOuterY:1.0270789362490178,
  eyeLowerInnerX:-.9467801470076664, eyeLowerInnerY:-1.3561666039284317,
  eyeLowerOuterX:.4085815251572058, eyeLowerOuterY:-1.3471857175929471,
  eyeLid:.6841275887563825, irisSize:1.35, irisAspect:1.2, irisX:.012 };
const EPS = 2e-14;
const near = (a,b,label='geometry') => assert.ok(Math.abs(a-b) <= EPS, `${label}: ${a} != ${b}`);
function onPolyline(points, x) {
  if(x<=points[0][0])return points[0][1];
  if(x>=points.at(-1)[0])return points.at(-1)[1];
  let lo=0,hi=points.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid][0]<=x)lo=mid;else hi=mid;}
  const [xa,ya]=points[lo], [xb,yb]=points[hi];
  return ya+(yb-ya)*(x-xa)/(xb-xa);
}
function seeded(seed) {
  return () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296;};
}
const SEED=0xE1E2026, CASES=2048;
function randomCases(count, seed=SEED) {
  const r=seeded(seed), cases=[];
  for(let i=0;i<count;i++) {
    const a={eyeStyle:'anime_designed',eyeLid:[0,.25,.5,1,r()][i%5]};
    for(const [key,[,lo,hi]] of Object.entries(EYE_CURVE_FIELDS)) {
      const pick=r(); a[key]=pick<.2?lo:pick<.4?hi:lo+(hi-lo)*r();
    }
    cases.push(normalizeAppearance(a));
  }
  return cases;
}
function assertShape(a, index) {
  const shape=createEyeCurve(a), contour=animeEyeContour(a);
  const xs=Array.from({length:129},(_,i)=>-1+i/64);
  for(const e of [1e-12,1e-9,1e-6,.0001,.008333333333333333])xs.push(-1+e,1-e);
  if(shape.sampled) {
    assert.equal(shape.upper.length,259);
    assert.deepEqual(shape.upper[0],[-1,a.eyeInnerY]);
    assert.deepEqual(shape.lower[0],shape.upper[0]);
    assert.deepEqual(shape.upper.at(-1),[1,a.eyeOuterY]);
    assert.deepEqual(shape.lower.at(-1),shape.upper.at(-1));
    assert.deepEqual(contour.upper,shape.upper.map(([x,y])=>[x*contour.w,y*contour.h]));
    assert.deepEqual(contour.lower,shape.lower.slice().reverse().map(([x,y])=>[x*contour.w,y*contour.h]));
    for(let j=1;j<shape.upper.length;j++) {
      const left=shape.upper[j-1][0], right=shape.upper[j][0];
      assert.ok(right>left);
      assert.equal(right,shape.lower[j][0]);
      for(const f of [0,.17,.5,.83,1])xs.push(left+(right-left)*f);
    }
    // Common-X linear segments are ordered everywhere, not only at probes.
    for(let j=0;j<shape.upper.length;j++)assert.ok(shape.upper[j][1]>=shape.lower[j][1]);
    for(const [points,upper] of [[shape.upper,true],[shape.lower,false]]) {
      for(let j=2;j<points.length;j++) {
        const [p,q,s]=points.slice(j-2,j+1);
        const turn=(q[0]-p[0])*(s[1]-q[1])-(q[1]-p[1])*(s[0]-q[0]);
        assert.ok(upper?turn<=EPS:turn>=-EPS,'convex white polygon keeps clipped iris edges inside');
      }
    }
  }
  for(const x of xs) {
    const top=shape.top(x), bottom=shape.bottom(x);
    assert.ok(Number.isFinite(top)&&Number.isFinite(bottom),`finite: case ${index}`);
    assert.ok(top>=bottom,`crossing: case ${index}, x=${x}, gap=${top-bottom}`);
    if(shape.sampled) {
      near(top,onPolyline(shape.upper,x)); near(bottom,onPolyline(shape.lower,x));
      near(contour.top(x*contour.w),onPolyline(contour.upper,x*contour.w));
      near(contour.bottom(x*contour.w),onPolyline(contour.lower.slice().reverse(),x*contour.w));
    }
  }
  // Exact drawAnimeEye clip domain; lo/hi must not invert or depend on min/max swapping.
  for(let i=0;i<=128;i++) {
    const x=-contour.w+.0005+(2*contour.w-.001)*i/128;
    assert.ok(contour.top(x)-contour.bottom(x)>=.0002,`iris inset inversion: case ${index}, x=${x}`);
  }
  return shape;
}

for(const [i,input] of extremes.entries()) {
  test(`deterministic extreme ${i+1}: reproduces old intersection and removes it on both sides`,()=>{
    const a=normalizeAppearance(input), old=legacyContour(a);
    let oldMin=Infinity;
    for(let j=0;j<=8192;j++){const x=-old.w+2*old.w*j/8192;oldMin=Math.min(oldMin,old.top(x)-old.bottom(x));}
    assert.ok(oldMin<-.006,'regression fixture MUST fail with the old boundary');
    const shape=assertShape(a,i);
    assert.equal(shape.sampled,true);assert.equal(shape.adjusted,true);
    // Denser independent grid also covers points between shared sample knots.
    for(let j=0;j<=16384;j++){const x=-1+2*j/16384;assert.ok(shape.top(x)>=shape.bottom(x));}
  });
}

test(`seed 0x${SEED.toString(16)}: ${CASES} reproducible cases, clip margins, convexity and shared world boundary`,t=>{
  const cases=randomCases(CASES);assert.deepEqual(cases.slice(0,8),randomCases(8));
  let sampled=0,certified=0;
  for(const [i,a] of cases.entries()) {const before=JSON.stringify(a);const shape=assertShape(a,i);shape.sampled?sampled++:certified++;assert.equal(JSON.stringify(a),before);}
  assert.ok(sampled>0&&certified>0,'exercise both shared-geometry branches');
  t.diagnostic(`seed=0x${SEED.toString(16)}, cases=${CASES}, sampled=${sampled}, certified=${certified}`);
});

const ovalPoints=(cx,cy,rx,ry,n=48)=>Array.from({length:n},(_,i)=>{
  const t=i/n*Math.PI*2;return[cx+rx*Math.cos(t),cy+ry*Math.sin(t)];
});
test('noncrossing high-curvature cubic: shared boundary fixes old sclera/iris mesh mismatch',()=>{
  const a=normalizeAppearance(highCurvature),old=legacyContour(a),lower=old.lower.slice().reverse();
  let worstLeak=0;
  for(let i=1;i<8192;i++) {
    const x=-old.w+2*old.w*i/8192;
    assert.ok(old.top(x)>old.bottom(x),'fixture has no original curve intersection');
    if(Math.abs(x)>old.w-.0005)continue;
    worstLeak=Math.max(worstLeak,old.top(x)-onPolyline(old.upper,x),onPolyline(lower,x)-old.bottom(x));
  }
  assert.ok(worstLeak>.003,'old tessellation error exceeds the .0001 iris inset');
  const shape=assertShape(a,'noncrossing mesh regression');
  assert.equal(shape.sampled,true,'uncertified mesh must use shared sampled boundaries');
});

test('real drawAnimeEye: both geometry modes keep iris, rings, pupil and highlights inside the sclera',t=>{
  let probes=0,patches=0,sampled=0,certified=0;
  const inputs=[...extremes.map(normalizeAppearance),normalizeAppearance(highCurvature),...randomCases(48)];
  for(const input of inputs)for(const side of [-1,1])for(const irisPattern of ['solid','rings','star'])for(const direction of [-1,1]) {
    const a=normalizeAppearance({...input,irisPattern,irisSize:direction===1?1.35:.5,irisAspect:direction===1?1.2:.55,
      pupilSize:.85,irisRingInk:2.5,irisX:direction*.012,irisY:-direction*.012,eyeHighlight:'double'});
    const c=animeEyeContour(a), lower=c.lower.slice().reverse();
    createEyeCurve(a).sampled?sampled++:certified++;
    drawAnimeEye({a,e:null,side,eyeColor:a.eyeColor,ovalPoints,facialLine:()=>{},facialPatch:(e,points,color,offset,lift)=>{
      if(lift===.003) {
        assert.deepEqual(points,[...c.upper,...c.lower].map(([x,y])=>[x*side,y]));return;
      }
      if(lift<=.003||lift>=.009)return; // lids/lashes are intentionally OUTSIDE the white.
      patches++;
      for(let i=0;i<points.length;i++) {
        const p=points[i],q=points[(i+1)%points.length];
        for(const f of [0,.25,.5,.75]) {
          const x=(p[0]+(q[0]-p[0])*f)*side,y=p[1]+(q[1]-p[1])*f;
          assert.ok(x>=-c.w&&x<=c.w);
          assert.ok(y>=onPolyline(lower,x)-EPS&&y<=onPolyline(c.upper,x)+EPS,
            `actual clipped patch edge outside white: ${JSON.stringify({input,side,irisPattern,direction,lift,x,y})}`);
          probes++;
        }
      }
    }});
  }
  assert.ok(probes>100000&&patches>1000,'real filled features, not just fabricated boundary points');
  assert.ok(sampled>0&&certified>0,'exercise BOTH certified cubics and shared sampled boundaries');
  t.diagnostic(`${patches} real clipped patches; ${probes} vertex/edge probes, both eyes and all 3 iris patterns; sampled=${sampled}, certified=${certified}`);
});

for(const [name,a,hash] of [
  ['default',normalizeAppearance({eyeStyle:'anime_designed'}),'0c46f4fb0a0b394a152423aac504a2701bd0441a08befb9f121ec4810d3c5954'],
  ['金环赤发',normalizeAppearance(ANIME_PRESETS.find(p=>p.name==='金环赤发').values),'c3f5211f781ec23dd67eb70c375c5da274d85f2f30894ec2cc9b8ec7a7436833'],
]) {
  test(`${name}: all 98 contour vertices and 8194 evaluations BIT-FOR-BIT unchanged; contour-only fingerprint`,t=>{
    assert.equal(createEyeCurve(a).sampled,false);
    const before=legacyContour(a),after=animeEyeContour(a);
    assert.equal(after.w,before.w);assert.equal(after.h,before.h);
    assert.deepEqual(after.upper,before.upper);assert.deepEqual(after.lower,before.lower);
    for(let i=0;i<=4096;i++) {
      const x=-before.w+2*before.w*i/4096;
      assert.equal(after.top(x),before.top(x));assert.equal(after.bottom(x),before.bottom(x));
    }
    // Fingerprint only our contour boundary. The main agent owns intentional
    // drawAnimeEye eyeliner/lash changes; do not freeze their separate renderer.
    const evaluations=Array.from({length:4097},(_,i)=>{
      const x=-after.w+2*after.w*i/4096;return[x,after.top(x),after.bottom(x)];
    });
    const actual=createHash('sha256').update(JSON.stringify({w:after.w,h:after.h,upper:after.upper,lower:after.lower,evaluations})).digest('hex');
    assert.equal(actual,hash);t.diagnostic(`${name}: SHA256 ${actual}`);
  });
}

test('other anime styles retain their old contour at every sampled/dense point',()=>{
  for(const eyeStyle of ['anime_round','anime_calm','anime_angular'])for(const eyeLid of [0,.25,1]) {
    const a=normalizeAppearance({eyeStyle,eyeLid}),before=legacyContour(a),after=animeEyeContour(a);
    assert.deepEqual(after.upper,before.upper);assert.deepEqual(after.lower,before.lower);
    for(let i=0;i<=512;i++) {
      const x=-before.w+2*before.w*i/512;
      assert.equal(after.top(x),before.top(x));assert.equal(after.bottom(x),before.bottom(x));
    }
  }
});

test('raw ten-field storage contract/defaults/ranges remain unchanged; geometry is read-only',()=>{
  assert.deepEqual(readEyeShape(),EYE_CURVE_DEFAULTS);
  assert.equal(Object.keys(EYE_CURVE_FIELDS).length,10);
  for(const [key,[fallback,lo,hi]] of Object.entries(EYE_CURVE_FIELDS)) {
    assert.equal(fallback,EYE_CURVE_DEFAULTS[key]);assert.deepEqual([lo,hi],ANIME_RANGES[key].slice(0,2));
  }
  for(const eyeLid of [undefined,null,NaN,Infinity,'0.7',-1,2]) {
    const input=Object.freeze({...A,eyeLid}),before=structuredClone(input);
    const shape=createEyeCurve(input);
    assert.equal(shape.upperScale,1-(Number.isFinite(eyeLid)?Math.max(0,Math.min(1,eyeLid)):.25)*.28);
    assert.deepEqual(input,before);
  }
});
