import { MathUtils, Vector3 } from 'three';

const point = () => new Vector3();
const up = new Vector3(0, 1, 0);
const clamp = MathUtils.clamp;
const tan = degrees => Math.tan(MathUtils.degToRad(degrees / 2));

function head(actor) {
  if (actor._head) return actor._head.getWorldPosition(point());
  return actor.mesh.getWorldPosition(point()).addScaledVector(up, 1.55);
}

function facing(actor) {
  const forward = actor.mesh.getWorldDirection(point()).setY(0);
  return forward.lengthSq() ? forward.normalize() : forward.set(0, 0, 1);
}

// Compose through the nodal point so the authored target projects to the requested
// screen coordinate, even as the dolly moves or the viewport changes shape.
function compose(camera,controls,position,aim,lens,screenX,screenY) {
  const vertical = tan(lens) / camera.zoom;
  const ray = new Vector3((screenX*2-1)*vertical*camera.aspect,(1-screenY*2)*vertical,-1).normalize();
  const direction = aim.clone().sub(position);
  const distance = direction.length();
  direction.normalize();
  const pitch = Math.asin(clamp(direction.y/Math.hypot(ray.y,ray.z),-1,1))-Math.atan2(ray.y,-ray.z);
  const z = ray.y*Math.sin(pitch)+ray.z*Math.cos(pitch);
  const yaw = Math.atan2(-direction.x,-direction.z)-Math.atan2(-ray.x,-z);
  camera.position.copy(position);
  camera.rotation.set(pitch,yaw,0,'YXZ');
  controls.target.copy(camera.getWorldDirection(point())).multiplyScalar(distance).add(position);
}

export function actionAnchor(first,second,shot) {
  const owner=shot.prop?.role==='T' ? second : first;
  for(const actor of [owner,owner===first ? second : first]) {
    const cup=actor.mesh.getObjectByName(shot.catalogProp?'cinema-catalog:'+shot.catalogProp:shot.prop ? 'cinema-prop:'+shot.prop.kind : 'cinema-water-cup');
    if(cup?.visible) return cup.localToWorld(new Vector3(0,.05,0));
  }
  const hand=owner._rig?.joints?.RightHand || owner._arms?.[0];
  return hand ? hand.getWorldPosition(point()) : head(owner).addScaledVector(up,-.55);
}

// Each setup is solved in the performers' local action axis. Both reverse angles
// stay on the same side, so a listener looking left keeps looking left after a cut.
export function createCinemaCamera({ camera, controls, actors, blocked }) {
  let sideSign, lastSetup, clearance = 0;
  function capture() {
    const position = camera.position.clone(), aim = controls.target.clone();
    const orientation = camera.quaternion.clone(), fov = camera.fov, enabled = controls.enabled;
    controls.enabled = false;
    sideSign = lastSetup = undefined;
    clearance = 0;
    return () => {
      camera.position.copy(position);
      camera.quaternion.copy(orientation);
      camera.fov = fov;
      controls.target.copy(aim);
      controls.enabled = enabled;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    };
  }

  function frame(shot, participants, progress) {
    const subjects = (participants || []).map(id => actors.find(a => a.id === id && a.mesh.visible)).filter(Boolean);
    if (!subjects.length) return false;
    const first = subjects[0], second = subjects[1] || first;
    const f = head(first), t = head(second), mid = f.clone().lerp(t, .5);
    const axis = t.clone().sub(f).setY(0), span = axis.length();
    if (span < .12) axis.copy(facing(first)); else axis.divideScalar(span);
    const side = axis.clone().cross(up);
    if (sideSign == null) sideSign = side.dot(camera.position.clone().sub(mid)) >= 0 ? 1 : -1;
    side.multiplyScalar(sideSign);
    const p = clamp(progress || 0, 0, 1);
    const ease = p * p * (3 - 2 * p);
    const kind = first === second && shot.kind.startsWith('shoulder') ? 'faceF' : shot.kind;
    const composition = shot.composition;
    const lens = composition?.fov || shot.rig?.fov || ({wide:45, pair:38, profile:45, insert:34, faceF:34, faceT:34, shoulderF:38, shoulderT:38}[kind] || 40);
    const position = point(), aim = mid.clone();
    const halfHorizontal = tan(lens) * camera.aspect;
    const size = clamp(f.y - first.mesh.getWorldPosition(point()).y, .8, 2.25);
    const rigScale = shot.rig?.dist > 0 && shot.rig?.baseDist > 0 ? shot.rig.dist / shot.rig.baseDist : 1;

    if(composition) {
      const c=composition;
      if(c.aimRole==='F') aim.copy(f);
      if(c.aimRole==='T') aim.copy(t);
      if(c.aimRole==='hand') aim.copy(actionAnchor(first,second,shot));
      position.copy(aim)
        .addScaledVector(axis,MathUtils.lerp(c.along,c.endAlong??c.along,ease))
        .addScaledVector(side,MathUtils.lerp(c.side,c.endSide??c.side,ease));
      if(c.aimRole==='hand')position.y=shot.prop?.role==='T' ? t.y : f.y;
      position.y+=MathUtils.lerp(c.height,c.endHeight??c.height,ease);
      aim.y+=c.aimY??0;
      // Preserve the lateral silhouette of both performers in a portrait two-shot.
      if(c.aimRole==='mid' && camera.aspect<1) {
        const view=position.clone().sub(aim);
        const right=up.clone().cross(view).normalize();
        const width=Math.abs(f.clone().sub(t).dot(right))*.5+.28;
        const margin=Math.max(.14,Math.min(c.screenX??.5,1-(c.screenX??.5))-.04);
        const minimum=width/(2*margin*halfHorizontal);
        if(view.length()<minimum)position.copy(aim).add(view.setLength(minimum));
      }
    } else if (kind === 'faceF' || kind === 'faceT') {
      const subject = kind === 'faceF' ? first : second;
      aim.copy(subject === first ? f : t).y -= .04;
      const front = facing(subject);
      // Add a modest 3/4 angle while keeping the lens in front of the actual face.
      const view = front.multiplyScalar(.89).addScaledVector(side,.36).normalize();
      const distance = Math.max(.43 / tan(lens), .34 / halfHorizontal) * rigScale;
      position.copy(aim).addScaledVector(view, distance);
      position.y += .065;
    } else if (kind === 'shoulderF' || kind === 'shoulderT') {
      const fromFirst = kind === 'shoulderF';
      const near = fromFirst ? f : t, far = fromFirst ? t : f;
      const depth = clamp(span * .56, .85, 1.8) * rigScale;
      const portraitOffset = .25 * clamp((1.05 - camera.aspect) / .6, 0, 1);
      const lateral = clamp(depth * halfHorizontal * .95 + .16 + portraitOffset, .36, 1.55);
      position.copy(near).addScaledVector(axis, fromFirst ? -depth : depth).addScaledVector(side,lateral);
      position.y += .16;
      aim.copy(far).addScaledVector(side,-lateral * .24);
      aim.y -= .10;
    } else if (kind === 'insert') {
      // Frame the action on the first actor's reaching side (a hand, not empty space between actors).
      const hand = first._rig?.joints?.RightHand ?? first._arms?.[0];
      const cup = hand?.getObjectByName('cinema-water-cup');
      if (cup?.visible) {
        cup.getWorldPosition(aim);
        aim.y += .05;
      } else if (hand?.getWorldPosition) {
        aim.copy(hand.getWorldPosition(point()));
        if (hand === first._arms?.[0]) hand.localToWorld(aim.set(0,-.26,.04));
      } else aim.copy(f).addScaledVector(up,-size * .35).addScaledVector(axis,.18);
      const view = cup?.visible
        ? aim.clone().sub(first.mesh.getWorldPosition(point())).setY(0).normalize().addScaledVector(facing(first),.5).normalize()
        : side;
      position.copy(aim).addScaledVector(view,Math.max(.75,.27 / halfHorizontal)).addScaledVector(axis,.14);
      position.y += .29;
    } else {
      const wide = kind === 'wide', profile = kind === 'profile';
      let radius = span * .5;
      if (wide && subjects.length > 2) {
        const group = subjects.map(head);
        aim.set(0,0,0);
        for (const member of group) aim.add(member);
        aim.divideScalar(group.length);
        radius = Math.max(...group.map(member => member.distanceTo(aim)));
      }
      const width = radius + (wide ? 1.65 : .55);
      const distance = Math.max(width / (halfHorizontal * .82), (wide ? size : size*.70) / tan(lens)) * rigScale;
      aim.y -= size * (wide ? .40 : .24);
      position.copy(aim).addScaledVector(side,distance).addScaledVector(axis,profile ? -.15 : -.19 * distance);
      position.y += wide ? distance * .30 : distance * .08;
      if (profile) aim.addScaledVector(axis, width * .19);
    }
    const offset = position.clone().sub(aim);
    if(!composition) switch (shot.motion) {
      case 'push': offset.multiplyScalar(1.12 - .22 * ease); break;
      case 'pull': offset.multiplyScalar(.95 + .27 * ease); break;
      case 'arc': offset.applyAxisAngle(up,(ease-.5) * .32); break;
      case 'track': {
        const right = offset.clone().cross(up).normalize();
        const slide = offset.length() * .18 * (ease-.5);
        aim.addScaledVector(right,slide*.55);
        offset.addScaledVector(right,slide*.45);
        break;
      }
    }
    position.copy(aim).add(offset);
    // Check the first frame of each cut. Hold its clearance offset to avoid a
    // camera bobbing whenever the line of sight grazes a leaf or roof edge.
    if (lastSetup !== shot) {
      clearance = 0;
      if (blocked) {
        const candidate = point();
        for (const lift of [0, .45, .95, 1.65, 2.4]) {
          clearance = lift;
          candidate.copy(position).y += lift;
          if (!blocked(candidate, aim, subjects)) break;
        }
      }
      lastSetup = shot;
    }
    position.y += clearance;

    if(composition) {
      compose(camera,controls,position,aim,lens,clamp(composition.screenX??.5,.05,.95),clamp(composition.screenY??.5,.05,.95));
    } else {
      camera.position.copy(position);
      controls.target.copy(aim);
      camera.lookAt(aim);
    }
    if (camera.fov !== lens) { camera.fov = lens; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    return true;
  }
  return {capture, frame};
}
