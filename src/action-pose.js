// Shoulder pitch, head pitch/yaw, torso pitch, and vertical compression (radians/metres).
const poses = {
  idle: [0, 0, 0, 0, 0, 0],
  look: [0, -.2, -.12, .45, 0, 0],
  point: [-.2, -1.4, 0, .2, .08, 0],
  offer: [-.55, -1.12, .12, 0, .12, 0],
  take: [-.9, -1.2, .16, 0, .18, 0],
  guard: [-.92, -.92, .18, -.24, -.12, 0],
  stop: [-.35, -1.7, -.08, -.2, -.12, 0],
  bow: [-.4, -.4, .35, 0, .23, 0],
  ask: [-.65, -.95, -.08, .12, .08, 0],
  nod: [-.2, -.2, .16, 0, .06, 0],
  shy: [-.7, -1.1, .24, -.42, -.04, 0],
  joy: [-2.2, -2.35, -.14, 0, -.05, 0],
  clap: [-1.35, -1.35, -.08, 0, .07, 0],
  kneel: [-.85, -.95, .25, 0, .35, .34],
  carry: [-1.1, -1.05, .18, 0, -.1, .05],
  dig: [-.8, -1.4, .25, 0, .46, .12],
  push: [-1.35, -1.38, .14, 0, .31, .1],
  hang: [-2.3, -2.45, -.35, 0, .08, 0],
  eat: [-.4, -1.95, .12, 0, .04, 0],
  drink: [-.2, -2.22, -.19, 0, -.05, 0],
  hide: [-.4, -.85, .2, .62, .18, .06],
  sit: [-.5, -.52, .12, 0, .08, .33],
  sleep: [-.38, -.4, .31, -.22, .17, .3],
  sing: [-.4, -1.05, -.18, .14, -.03, 0],
  dance: [-.95, -.78, -.12, .18, -.03, .06],
  stretch: [-2.38, -2.48, -.12, 0, -.08, 0],
  cold: [-.94, -1.45, .22, 0, .14, .07],
  step: [-.65, .2, -.06, .08, .08, 0],
  retreat: [-.58, -.8, -.12, -.48, -.17, .04],
  read: [-1.07, -1.07, .36, 0, .08, 0],
  inspect: [-.75, -1.52, .32, .18, .19, .05],
  wipe: [-.15, -2.1, .24, -.22, .16, 0],
  stir: [-.8, -1.2, .28, .13, .24, .06],
  cradle: [-1.05, -1.34, .28, -.25, -.03, .03],
  mourn: [-.32, -.45, .48, 0, .17, .06],
  wave: [-.2, -2.15, -.06, .14, 0, 0],
};

export function applyPose(actor, from, to, progress, time) {
  const a = poses[from], b = poses[to];
  const t = progress * progress * (3 - 2 * progress);
  const mix = i => a[i] + (b[i] - a[i]) * t;
  const beat = Math.sin(time * 4 + actor._phase);
  const [left, right] = actor._arms;
  left.rotation.set(mix(0), 0, -.14);
  right.rotation.set(mix(1), 0, .14);
  actor._head.rotation.set(mix(2), mix(3), beat * .018);
  actor._body.rotation.set(mix(4), 0, 0);
  actor._body.position.y = -mix(5);
  actor._legs.forEach(leg => leg.rotation.set(0,0,0));
  actor._legs[0].rotation.x = -mix(5) * 3;
  actor._legs[1].rotation.x = -mix(5) * 3;
  if (to === 'step' || to === 'retreat' || to === 'dance') {
    actor._legs[0].rotation.x += beat * .32 * t;
    actor._legs[1].rotation.x -= beat * .32 * t;
    actor._body.rotation.z = beat * .055 * t;
  }
  if (to === 'clap' || to === 'cold' || to === 'cradle') {
    left.rotation.z += (.42 + beat * (to === 'clap' ? .23 : .04)) * t;
    right.rotation.z -= (.42 + beat * (to === 'clap' ? .23 : .04)) * t;
  }
  if (to === 'wave' || to === 'stretch') right.rotation.z += (.4 + beat * .17) * t;
  if (to === 'dig' || to === 'stir' || to === 'wipe') right.rotation.x += beat * .29 * t;
  if (to === 'nod' || to === 'sing') actor._head.rotation.x += beat * .08 * t;
}
export function playPhrase(actor, phrase, seconds, duration = 6) {
  const position = Math.min(.99999, Math.max(0, seconds / duration)) * phrase.length;
  const i = Math.floor(position);
  const pose = phrase[i];
  applyPose(actor, i ? phrase[i-1] : 'idle', pose, Math.min(1, (position-i)*2), seconds);
  return pose;
}
export const knownPose = key => Object.hasOwn(poses, key);

