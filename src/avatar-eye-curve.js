// Pure shared geometry: raw controls are storage/UI intent; visible boundaries
// are either certified original cubics or the SAME constrained polyline used by
// the editor, sclera tessellation and iris clipping. Never mutates appearance.
export const EYE_CURVE_FIELDS = {
  eyeInnerY: [0, -.3, .4], eyeOuterY: [.05, -.3, .4],
  eyeUpperInnerX: [-.65, -.95, .95], eyeUpperInnerY: [1.25, .2, 1.8],
  eyeUpperOuterX: [.45, -.95, .95], eyeUpperOuterY: [1.2, .2, 1.8],
  eyeLowerInnerX: [-.65, -.95, .95], eyeLowerInnerY: [-.48, -1.4, -.05],
  eyeLowerOuterX: [.5, -.95, .95], eyeLowerOuterY: [-.6, -1.4, -.05],
};
// Must track animeEyeContour's designed dimensions and drawAnimeEye's existing
// clip insets. The vertical safety margin also prevents that clip's lo/hi swap.
const WIDTH = .060, HEIGHT = .047, CLIP_X_INSET = .0005, CLIP_Y_INSET = .0001;
const TIP_SPAN = CLIP_X_INSET / WIDTH;
const MIN_GAP = (2 * CLIP_Y_INSET + 1e-10) / HEIGHT;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cubic = (p0, p1, p2, p3, t) => p0*(1-t)**3 + 3*p1*t*(1-t)**2 + 3*p2*t*t*(1-t) + p3*t**3;
// Cosine spacing resolves both canthi; include the exact clip-domain boundaries
// so linear interpolation preserves the entire piecewise-linear minimum gap.
const SAMPLE_X = [...new Set([
  ...Array.from({ length: 257 }, (_, i) => -Math.cos(Math.PI * i / 256)),
  -1 + TIP_SPAN, 1 - TIP_SPAN,
])].sort((a, b) => a - b);

export function readEyeShape(a = {}) {
  const shape = {};
  for (const [key, [fallback, lo, hi]] of Object.entries(EYE_CURVE_FIELDS)) {
    shape[key] = clamp(Number.isFinite(a[key]) ? a[key] : fallback, lo, hi);
  }
  shape.eyeUpperInnerX = Math.min(shape.eyeUpperInnerX, shape.eyeUpperOuterX);
  shape.eyeLowerInnerX = Math.min(shape.eyeLowerInnerX, shape.eyeLowerOuterX);
  return shape;
}

function yAt(points, x, xScale = 1) {
  // Keep the legacy 22-step evaluation, including world-scaled X comparisons,
  // to preserve default/preset rendering bit-for-bit in the certified branch.
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]] = points;
  let lo = 0, hi = 1;
  for (let i = 0; i < 22; i++) {
    const t = (lo + hi) / 2;
    if (xScale * cubic(x0,x1,x2,x3,t) < x) lo = t;
    else hi = t;
  }
  return cubic(y0,y1,y2,y3,(lo + hi) / 2);
}

function interpolate(points, x) {
  if (x <= -1) return points[0][1];
  if (x >= 1) return points.at(-1)[1];
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= x) lo = mid;
    else hi = mid;
  }
  const [xa, ya] = points[lo], [xb, yb] = points[hi];
  return ya + (yb - ya) * ((x - xa) / (xb - xa));
}

// For a cubic with increasing X, these Bernstein coefficients certify the
// sign of x' y'' - y' x''. Concave upper / convex lower bounds also keep
// straight iris-polygon edges inside the eye, not merely their clipped vertices.
function bendsOutward(points, upper) {
  const d = points.slice(1).map((p, i) => [p[0] - points[i][0], p[1] - points[i][1]]);
  const cross = (a, b) => a[0]*b[1] - a[1]*b[0];
  return [cross(d[0],d[1]), cross(d[0],d[2]), cross(d[1],d[2])]
    .every(k => upper ? k <= 0 : k >= 0);
}

// The legacy renderer clips against a continuous cubic but fills only 49
// vertices. Even a non-crossing cubic can then leak at high curvature. Retain
// that renderer only if its interpolation error is below the existing iris
// inset throughout the reachable iris X domain. This also preserves normal
// default/preset rendering without making a preset-name exception.
function legacyMeshFitsIris(points, reach) {
  const d = points.slice(1).map((p, i) => [p[0]-points[i][0], p[1]-points[i][1]]);
  const cross = (a, b) => a[0]*b[1]-a[1]*b[0];
  const [k0,k1,k2] = [cross(d[0],d[1]),cross(d[0],d[2]),cross(d[1],d[2])];
  const dx = [3*(d[0][0]-2*d[1][0]+d[2][0]),6*(d[1][0]-d[0][0]),3*d[0][0]];
  const curvature = [18*(k0-k1+k2),18*(k1-2*k0),18*k0];
  const range = ([a,b,c], lo, hi) => {
    const values = [a*lo*lo+b*lo+c,a*hi*hi+b*hi+c];
    const critical = a ? -b/(2*a) : -1;
    if (critical > lo && critical < hi) values.push(a*critical*critical+b*critical+c);
    return [Math.min(...values),Math.max(...values)];
  };
  const xs = points.map(p => p[0]);
  const tBounds = x => {
    let lo=0,hi=1;
    for(let i=0;i<28;i++) {
      const t=(lo+hi)/2;
      if(cubic(...xs,t)<x)lo=t;else hi=t;
    }
    return [Math.max(0,lo-2**-22),Math.min(1,hi+2**-22)];
  };
  const step=2/48;
  for(let i=0;i<48;i++) {
    const left=-1+i*step,right=-1+(i+1)*step;
    if(right < -reach || left > reach)continue;
    const lo=tBounds(left)[0],hi=tBounds(right)[1];
    const minDX=range(dx,lo,hi)[0], k=range(curvature,lo,hi);
    if(minDX<=0)return false;
    const maxD2Y=Math.max(Math.abs(k[0]),Math.abs(k[1]))/minDX**3;
    // Linear interpolation error <= max|d2y/dx2| * dx^2 / 8.
    // 3e-6 also bounds BOTH legacy 22-step inverse-evaluation errors for the
    // allowed Y range, plus floating-point roundoff.
    if((maxD2Y*step*step/8+3e-6)*HEIGHT > CLIP_Y_INSET)return false;
  }
  return true;
}

function outwardEnvelope(points, upper) {
  const hull = [];
  for (const p of points) {
    while (hull.length >= 2) {
      const a = hull.at(-2), b = hull.at(-1);
      const turn = (b[0]-a[0])*(p[1]-b[1]) - (b[1]-a[1])*(p[0]-b[0]);
      if (upper ? turn < 0 : turn > 0) break;
      hull.pop();
    }
    hull.push(p);
  }
  // Resample the envelope onto the SAME X grid. Moving only outward preserves
  // both canthi and the minimum opening while making the white polygon convex.
  return points.map(([x, y]) => [x, upper ? Math.max(y, interpolate(hull, x)) : Math.min(y, interpolate(hull, x))]);
}

export function createEyeCurve(a = {}) {
  const s = readEyeShape(a);
  const upperScale = 1 - clamp(Number.isFinite(a.eyeLid) ? a.eyeLid : .25, 0, 1) * .28;
  const upperControls = [[-1, s.eyeInnerY], [s.eyeUpperInnerX, s.eyeUpperInnerY * upperScale], [s.eyeUpperOuterX, s.eyeUpperOuterY * upperScale], [1, s.eyeOuterY]];
  const lowerControls = [[-1, s.eyeInnerY], [s.eyeLowerInnerX, s.eyeLowerInnerY], [s.eyeLowerOuterX, s.eyeLowerOuterY], [1, s.eyeOuterY]];
  const above = Math.min(upperControls[1][1], upperControls[2][1]) - Math.max(s.eyeInnerY, s.eyeOuterY);
  const below = Math.min(s.eyeInnerY, s.eyeOuterY) - Math.max(s.eyeLowerInnerY, s.eyeLowerOuterY);
  // Analytic certificate, NOT a sparse crossing probe. Bernstein positivity puts
  // each lid on its side of the canthal chord. |dx/dt| <= D gives t in [e,1-e]
  // on the iris domain, so B1+B2 >= 3e(1-e). Thus the insets cannot invert either.
  const basisFloor = points => {
    const d = 3 * Math.max(...points.slice(1).map((p, i) => p[0] - points[i][0]));
    const e = TIP_SPAN / d;
    return 3 * e * (1 - e);
  };
  const number = (value,fallback,lo,hi) => clamp(Number.isFinite(value)?value:fallback,lo,hi);
  const irisSize=number(a.irisSize,1,.5,1.35),irisAspect=number(a.irisAspect,.78,.55,1.2);
  const irisX=number(a.irisX,0,-.012,.012);
  const irisReach=Math.min(WIDTH-CLIP_X_INSET,Math.min(WIDTH*.83,HEIGHT*irisSize*irisAspect)+Math.abs(irisX))/WIDTH;
  const certified = above >= 0 && below >= 0 &&
    bendsOutward(upperControls, true) && bendsOutward(lowerControls, false) &&
    above * basisFloor(upperControls) + below * basisFloor(lowerControls) >= MIN_GAP + 1e-5 &&
    legacyMeshFitsIris(upperControls,irisReach) && legacyMeshFitsIris(lowerControls,irisReach);
  if (certified) return {
    sampled: false, adjusted: false, upperScale, upperControls, lowerControls,
    top: (x, xScale = 1) => yAt(upperControls, x, xScale),
    bottom: (x, xScale = 1) => yAt(lowerControls, x, xScale),
  };

  let upper = [], lower = [];
  let adjusted = false;
  for (const x of SAMPLE_X) {
    const endpoint = x === -1 ? s.eyeInnerY : x === 1 ? s.eyeOuterY : null;
    let top = endpoint ?? yAt(upperControls, x), bottom = endpoint ?? yAt(lowerControls, x);
    const gap = MIN_GAP * Math.min(1, (1 - Math.abs(x)) / TIP_SPAN);
    if (top - bottom < gap) {
      const middle = (top + bottom) / 2;
      top = middle + gap / 2; bottom = middle - gap / 2;
      adjusted = true;
    }
    upper.push([x, top]); lower.push([x, bottom]);
  }
  const upperEnvelope = outwardEnvelope(upper, true), lowerEnvelope = outwardEnvelope(lower, false);
  adjusted ||= upperEnvelope.some((p, i) => p[1] !== upper[i][1]) || lowerEnvelope.some((p, i) => p[1] !== lower[i][1]);
  upper = upperEnvelope; lower = lowerEnvelope;
  // Matching X knots and linear interpolation guarantee upper >= lower for
  // EVERY x, even if the original cubics cross between two sampled positions.
  // No later production-only clamp or raw-C preview can disagree with this.
  return {
    sampled: true, adjusted, upperScale, upperControls, lowerControls, upper, lower,
    top: (x, xScale = 1) => interpolate(upper, x / xScale),
    bottom: (x, xScale = 1) => interpolate(lower, x / xScale),
  };
}
