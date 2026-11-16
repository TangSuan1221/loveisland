import {Quaternion,Vector3} from 'three';

// All targets and elbow guides are specified in the animated chest frame.
// Solve against the measured limb lengths and palm offset of this avatar.
const down=new Vector3(0,-1,0);
function orient(bone,direction){
  const parent=bone.parent.getWorldQuaternion(new Quaternion());
  bone.quaternion.setFromUnitVectors(down,direction.clone().normalize().applyQuaternion(parent.invert()));
}
export function placePalm(a,side,point,direction){
  const j=a._rig.joints,R=a._rig.R,chest=j.Spine2;
  const upper=j[side+'Arm'],lower=j[side+'ForeArm'],hand=j[side+'Hand'];
  const frame=chest.getWorldQuaternion(new Quaternion());
  const wrist=chest.localToWorld(point);
  const clavicle=j[side+'Shoulder'],sign=side==='Left'?1:-1;
  const aim=clavicle.parent.worldToLocal(wrist.clone()).sub(clavicle.position);
  clavicle.rotation.y=-sign*.24*Math.min(1,Math.max(0,aim.z/(.4*R)));
  clavicle.rotation.z=sign*.28*Math.min(1,Math.max(0,aim.y/(.35*R)));
  const shoulder=upper.getWorldPosition(new Vector3()),elbow=lower.getWorldPosition(new Vector3());
  const L=elbow.distanceTo(shoulder),M=hand.localToWorld(new Vector3(0,-.043*R,.003)).distanceTo(elbow);
  const line=wrist.clone().sub(shoulder),distance=Math.min(L+M-.00001,Math.max(Math.abs(L-M)+.00001,line.length()));
  line.normalize();
  const pole=new Vector3(side==='Left'?1:-1,-1.9,.65).applyQuaternion(frame);
  pole.addScaledVector(line,-pole.dot(line)).normalize();
  const along=(L*L-M*M+distance*distance)/(2*distance);
  const elbowOffset=line.clone().multiplyScalar(along).addScaledVector(pole,Math.sqrt(Math.max(0,L*L-along*along)));
  orient(upper,elbowOffset);
  orient(lower,line.multiplyScalar(distance).sub(elbowOffset));

}
export function chestContact(a,num,t){
  const R=a._rig.R;
  if(num===32||num===33){
    let release=num===33?Math.min(1,Math.max(0,(t-.75)/3.4)):0;
    release*=release*(3-2*release);
    for(const [side,s] of [['Left',1],['Right',-1]]){
      const x=s*(-.105+.29*release),y=(s===1?.005:-.125)-.19*release;
      placePalm(a,side,new Vector3(x,y*R,(s===1?.177:.191)+.03*release),new Vector3(-s*(1-release),.65-1.6*release,.12));
    }
  }else if(num===34||num===35){
    placePalm(a,'Left',new Vector3(.024,-.055*R,.164),new Vector3(-.72,.86,.05));
    const reach=(1-Math.cos(2*Math.PI*t/6))/2;
    const j=a._rig.joints;j.RightArm.rotation.x=-.12-.91*reach;j.RightForeArm.rotation.x=-.24-.29*reach;
  }
}
