import {Vector3} from 'three';

// Six-second clips sampled from absolute time so scrubbing preserves holds.
export function sampleIslandWork(actor, id, t) {
  const j = actor._rig.joints, R = actor._rig.R;
  const ramp = (a,b) => {const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*(3-2*u);};
  const beat = (a,b,c,d) => ramp(a,b)-ramp(c,d);
  const rot = (bone,x=0,y=0,z=0) => j[bone].rotation.set(x,y,z);
  function arm(side, shoulder, elbow, spread=.12, twist=0, wrist=0, grip=.15, point=false) {
    const sign=side==='Left'?1:-1;
    rot(side+'Arm',shoulder,0,sign*spread);
    rot(side+'ForeArm',-elbow,0,0);
    rot(side+'Hand',wrist,sign*twist,0);
    for(const digit of ['Thumb','Index','Middle','Ring','Pinky'])
      for(let k=1;k<=3;k++)j[side+'Hand'+digit+k].rotation.x=-(point&&digit==='Index'?.03:grip);
  }
  function spine(pitch,lean=0) {rot('Spine',pitch*.5,0,lean);rot('Spine1',pitch*.3);rot('Spine2',pitch*.2);}
  function look(yaw,pitch=0,eyes=yaw) {
    rot('Head',pitch,yaw);
    for(const eye of actor._eyes)for(const i of [1,2,5])if(eye.children[i])eye.children[i].position.x+=eyes*.022;
  }
  function steps(count,progress,amount){
    const wave=Math.sin(2*Math.PI*count*progress);
    for(const [side,sign] of [['Left',1],['Right',-1]]){
      rot(side+'UpLeg',-amount*sign*wave);rot(side+'Leg',amount*Math.max(0,sign*wave));rot(side+'Foot',amount*Math.min(0,sign*wave));
    }
  }
  const hips=j.Hips.position;
  arm('Left',0,.14);arm('Right',0,.14);
  switch(id){
    case 199:{
      const reach=beat(1.1,1.26,4.56,4.74),lift=beat(1.65,1.88,4.22,4.36);
      look(.19,.27*ramp(0,.1));spine(.12*reach);
      arm('Right',-.97*reach,.16+.95*lift,.12,.24,-.16*lift, .08+.76*beat(1.38,1.49,4.41,4.49));
      if(!actor._workCupRest){
        const s=j.RightArm.rotation.clone(),e=j.RightForeArm.rotation.clone(),h=j.RightHand.rotation.clone(),sp=j.Spine.rotation.clone(),m=j.Spine1.rotation.clone(),c=j.Spine2.rotation.clone();
        spine(.12);rot('RightArm',-.97,0,-.12);rot('RightForeArm',-.16);rot('RightHand',0,-.24);
        actor._workCupRest=actor._body.worldToLocal(j.RightHand.localToWorld(new Vector3(0,-.065*R,.02*R)));
        j.RightArm.rotation.copy(s);j.RightForeArm.rotation.copy(e);j.RightHand.rotation.copy(h);j.Spine.rotation.copy(sp);j.Spine1.rotation.copy(m);j.Spine2.rotation.copy(c);
      }
      break;
    }
    case 200:{
      const grab=beat(1.64,1.78,1.99,2.14);
      hips.x=.075*R;hips.y-=.31*R;for(const side of ['Left','Right']){rot(side+'UpLeg',-1.35);rot(side+'Leg',1.43);}
      spine(.48,.19);look(.3-.65*beat(.52,.61,2.21,2.32),.23,.75-1.45*beat(.4,.47,2.14,2.22));
      arm('Left',-.58,1.25,.14);arm('Right',-.66-.83*grab,1.37-1.15*grab,.17,.25,.16*grab,.52);
      break;
    }
    case 201:{
      const touch=ramp(.8,2.45),load=ramp(2.68,2.79),recover=ramp(3.45,4.65);
      look(.16,.24*ramp(0,.1));spine(.1+.17*load,-.18*load+.1*recover);
      j.RightShoulder.position.y-=R*(.091*load-.043*recover);
      arm('Right',-.94*touch,.23+.36*touch,.16,.8*recover,.19*recover,.14+.73*ramp(2.34,2.58));break;
    }
    case 202:{
      const point=beat(1.12,1.25,2.5,2.66),poke=beat(1.42,1.51,1.58,1.73)+beat(2,2.08,2.17,2.3),fold=ramp(2.52,2.72);
      look(.26,.23-.47*fold);arm('Right',-.98*point-.48*fold,.18+(.84-.75*poke)*point+1.5*fold,.2,-.27*fold,.12,.64,point>.5);
      arm('Left',-.55*fold,.2+1.52*fold,.17,.32*fold);j.LeftArm.rotation.y=-.65*fold;j.RightArm.rotation.y=.7*fold;break;
    }
    case 203:{
      const hold=beat(.42,.7,4.42,4.55),move=ramp(1.1,4.15);
      spine(.13+.57*hold,-.2*hold);look(.17,.23*hold-.16*ramp(4.55,4.8));
      hips.x=.073*R*hold;hips.z=.35*R*move;steps(3,move,.23);
      arm('Left',-.92*hold,.18+1.12*hold,.43,-.3,0,.19+.47*hold);
      arm('Right',-.82*hold,.19+1.32*hold,.37,.33,0,.18+.52*hold);
      break;
    }
    case 204:{
      const move=ramp(.55,1.55),fold=ramp(1.7,1.94);
      hips.x=.27*R*move;hips.z=-.31*R*move;steps(4,move,.27);
      const glance=.65-1.3*beat(2.19,2.25,2.94,3)+1.3*(ramp(4.45,4.52)-ramp(3.65,3.71));
      look(.12,.02,glance);for(const side of ['Left','Right']){arm(side,-.51*fold,.23+1.4*fold,.18);j[side+'Arm'].rotation.y=(side==='Left'?-.7:.7)*fold;}break;
    }
    case 205:{
      const reach=ramp(.29,.59),grip=ramp(.64,.75),fold=beat(2.43,2.73,4.43,4.64);
      look(.12,.22*reach-.39*ramp(4.47,4.63));spine(1.54*fold);
      for(const eye of actor._eyes)eye.rotation.x-=.16*ramp(4.42,4.61);
      arm('Right',-.99*reach+.84*fold,.23+.72*fold,.17,0,0,.13+.73*grip);break;
    }
    case 206:{
      const turn=ramp(1.52,2.49),move=ramp(2.8,4.96);
      const angle=1.43*turn;rot('Hips',-.15,angle);spine(-.08);
      hips.z=R*(.075+.12*move);hips.x=R*.33*move;steps(4,turn+move,.23);
      look(.37*beat(1.25,1.35,1.68,2.18));for(const side of ['Left','Right'])arm(side,-.98,.58,.45,.5,.19,.66);break;
    }
    case 207:{
      const impact=beat(.85,.99,2.25,2.46),slump=ramp(2.26,2.5),shake=Math.sin(19*t)*beat(2.73,2.88,4.08,4.35);
      hips.z=.057*R*impact;hips.y-=.13*R*slump;spine(.12+.18*impact+.43*slump);look(.42*ramp(4.48,4.65),-.16*slump);
      for(const side of ['Left','Right']){
        arm(side,-1.23*(1-slump),.51+.17*slump,.14,0,.67*(1-slump)+.4*shake);
        if(t<2.26){
          // Solve in the shoulder frame against a stationary actor-local point.
          const armBone=j[side+'Arm'],target=new Vector3(armBone.position.x,1.35*R,.415*R);
          armBone.parent.worldToLocal(actor._body.localToWorld(target));target.sub(armBone.position);
          const L=.257*R,M=.224*R,b=Math.acos(Math.max(-1,Math.min(1,(target.y**2+target.z**2-L*L-M*M)/(2*L*M))));
          rot(side+'Arm',-Math.atan2(target.z,-target.y)+Math.atan2(M*Math.sin(b),L+M*Math.cos(b)));rot(side+'ForeArm',-b);
          rot(side+'Hand',-1.57-j[side+'Arm'].rotation.x+b-.12-.18*impact);
        }
      }break;
    }
  }
}
