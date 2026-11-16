import {Vector3} from 'three';
import {placePalm} from './chest-contact.js';

// 六秒双人表演描述词。两人共享同一拍点，允许逐帧拖动。
// 0–1.80 秒：两人隔着口粮僵住。出手者下巴压低，右臂慢慢张成扇形，
// 手掌在肩旁停住，另一只手缩在胸前。对面仍抬着下巴，留出完整脸廓。
// 1.80–2.48 秒：肩、掌悬在半空。把这段难堪的等待留足。
// 2.48–2.64 秒：掌影横扫过两人之间的画面；在 2.60 秒交接视觉重心。
// 对面先眯眼、猛偏头，再由肩膀接住余势，形成两幅错开的小剪影。
// 2.78–3.50 秒：出手者的手尴尬地悬着，对面慢半拍抬左手捂脸。
// 3.50–6 秒：两人各自回正；掌心最后离开脸旁，留出回到待机的时间。
function ramp(t, start, end) {
  const x = Math.max(0, Math.min(1, (t - start) / (end - start)));
  return x * x * (3 - 2 * x);
}

export function sampleSlap(actor, role, t, partner) {
  const j = actor._rig.joints;
  if (role === 0) {
    const lift = ramp(t, .35, 1.8) - ramp(t, 3.35, 5.6);
    const sweep = ramp(t, 2.47, 2.60) - ramp(t, 3.35, 5.6);
    const coil = ramp(t, .72, 2.17) - ramp(t, 2.45, 2.60);
    const cross = ramp(t, 2.66, 2.84) - ramp(t, 3.35, 5.6);
    j.Hips.rotation.y = -.27 * coil + .19 * sweep;
    j.Spine.rotation.z = -.11 * coil + .09 * sweep;
    j.RightArm.rotation.set(-.9 * lift + .62 * coil - .65 * sweep, .38 * coil + .7 * sweep, -1.28 * coil + .78 * sweep + .32 * cross);
    j.RightForeArm.rotation.x = -.68 * lift - .38 * coil + .56 * sweep;
    j.RightHand.rotation.y = .82 * lift;
    j.LeftArm.rotation.x = -.48 * lift;
    j.LeftForeArm.rotation.x = -.83 * lift;
    j.Spine.rotation.y = -.63 * coil + .53 * sweep;
    j.Head.rotation.x = .14 * lift;
    j.Head.rotation.y = .48 * coil - .30 * sweep;
    if (partner) {
      const origin = actor.mesh.getWorldPosition(new Vector3());
      const axis = partner.mesh.getWorldPosition(new Vector3()).sub(origin);
      axis.y = 0;
      const distance = axis.length();
      const scale = actor.mesh.getWorldScale(new Vector3()).y;
      const step = ramp(t, .35, 2.32) - ramp(t, 3.6, 5.75);
      const advance = Math.max(0, distance - .40 * scale) * step - .11 * scale * coil;
      axis.normalize();
      actor._body.position.copy(actor.mesh.worldToLocal(origin.addScaledVector(axis, advance)));
      const turn = Math.atan2(axis.x, axis.z) - actor.mesh.rotation.y;
      actor._body.rotation.y = Math.atan2(Math.sin(turn), Math.cos(turn)) * step;
      j.RightUpLeg.rotation.x = -.35 * Math.sin(Math.PI * step);
      j.RightLeg.rotation.x = .58 * Math.sin(Math.PI * step);
      const touch = ramp(t, 2.47, 2.60) - ramp(t, 2.66, 2.84);
      if (touch > 0) {
        const cheek = partner._mouth.getWorldPosition(new Vector3());
        const offset = new Vector3(.105, .038, -.027).multiplyScalar(scale)
          .applyQuaternion(partner.mesh.getWorldQuaternion(partner.mesh.quaternion.clone()));
        const palm = j.RightHand.localToWorld(new Vector3(0, -.043 * actor._rig.R, .003));
        placePalm(actor, 'Right', j.Spine2.worldToLocal(palm.lerp(cheek.add(offset), touch)));
      }
    }
  } else {
    const flinch = ramp(t, 2.65, 2.76) - ramp(t, 3.12, 4.45);
    const recoil = ramp(t, 2.70, 2.95) - ramp(t, 3.5, 4.8);
    const cheek = ramp(t, 2.98, 3.55) - ramp(t, 4.95, 5.95);
    j.Head.rotation.set(-.13 * flinch, -1.11 * flinch, .31 * flinch);
    j.Spine.rotation.set(-.29 * recoil, -.46 * recoil, .23 * recoil);
    j.Hips.rotation.z = .11 * recoil;
    j.RightUpLeg.rotation.x = -.24 * recoil;
    j.RightLeg.rotation.x = .45 * recoil;
    const blink = ramp(t, 2.58, 2.61) - ramp(t, 2.89, 3.16);
    j.LeftArm.rotation.set(-.96 * cheek, .16 * cheek, -.16 * cheek);
    j.LeftForeArm.rotation.x = -1.73 * cheek;
    j.RightArm.rotation.z = .48 * recoil;
    for (const eye of actor._eyes) eye.scale.y *= 1 - .94 * blink;
  }
}

export function sampleSlapMediation(actor, role, t, partner) {
  const j = actor._rig.joints;
  if (role < 2) {
    const counter = t >= 2.15;
    const attacker = counter ? 1 : 0;
    const beat = Math.min(6, (counter ? t - 2.15 : t) * 6 / 2.15);
    sampleSlap(actor, role === attacker ? 0 : 1, beat, partner);
    actor._body.rotation.y = (role === 0 ? Math.PI / 2 : -Math.PI / 2) - actor.mesh.rotation.y;
    const settle = ramp(t, 4.3, 5.35);
    j.Head.rotation.y += (role ? -.3 : .3) * settle;
    return;
  }
  const enter = ramp(t, 3.18, 4.82);
  const open = ramp(t, 3.96, 4.78);
  const stride = Math.sin(enter * Math.PI * 6);
  const yaw = actor.mesh.rotation.y;
  actor._body.position.set(-Math.sin(yaw)*1.5*enter,0,Math.cos(yaw)*1.5*enter);
  actor._body.rotation.y = -yaw;
  j.Spine.rotation.x = .18*Math.sin(Math.PI*enter);
  j.Head.rotation.y = .65*ramp(t,4.45,4.91)-1.2*ramp(t,5.12,5.67);
  for (const [side,sign] of [['Left',1],['Right',-1]]) {
    j[side+'UpLeg'].rotation.x = sign*.48*stride;
    j[side+'Leg'].rotation.x = .65*Math.max(0,-sign*stride);
    j[side+'Arm'].rotation.set(-.18-sign*.38*stride*(1-open),0,sign*(.14+1.12*open));
    j[side+'ForeArm'].rotation.x = -.26;
  }
}
