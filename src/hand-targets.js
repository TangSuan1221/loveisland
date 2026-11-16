import {Vector3} from 'three';
import {placePalm} from './chest-contact.js';

// Body contacts follow the animated anatomical landmark. Work surfaces stay
// in actor space, so bending the spine doesn't pull a table or the floor up.
export function applyHandTargets(a,n,t){
  const j=a._rig.joints,R=a._rig.R,chest=j.Spine2;
  const u=(lo,hi)=>{const k=Math.min(1,Math.max(0,(t-lo)/(hi-lo)));return k*k*(3-2*k);};
  const cycle=Math.sin(t*4), phase=u(.45,1.55)-u(3.95,5.15);
  function target(side,frame,x,y,z,dir=[0,-.7,.65],weight=1){
    if(weight<=0)return;
    const p=chest.worldToLocal(frame.localToWorld(new Vector3(x,y,z)));
    if(weight<1){
      const actual=chest.worldToLocal(j[side+'Hand'].localToWorld(new Vector3(0,-.055*R,.015*R)));
      p.lerp(actual,1-weight);
    }
    placePalm(a,side,p,new Vector3(...dir));
  }
  function body(side,x,y,z,dir,weight){target(side,chest,x,y*R,z,dir,weight);}
  function work(side,x,y,z,dir,weight){target(side,a._body,x,y*R,z,dir,weight);}
  function face(side,feature,x,y,z,weight=1){
    const s=side==='Left'?1:-1;
    const p=chest.worldToLocal(feature.getWorldPosition(new Vector3())).add(new Vector3(x,y*R,z));
    target(side,chest,p.x,p.y,p.z,[-s*.45,.85,.12],weight);
  }
  function eye(side){return a._eyes.reduce((best,o)=>side==='Left'?(o.position.x>best.position.x?o:best):(o.position.x<best.position.x?o:best));}
  function knees(side,w=1){const s=side==='Left'?1:-1;target(side,j[side+'Leg'],s*.015,.082*R,.08,[0,-.8,.45],w);}
  function pair(x,y,z,dir){for(const [side,s] of [['Left',1],['Right',-1]])body(side,s*x,y,z,dir);}
  function table(side,x,z,dy=0){work(side,x,1.02+dy,z,[0,-.7,.5]);}
  function pocket(side,w=1){const s=side==='Left'?1:-1;target(side,j.Hips,.162*s,.009*R,.085,[-s*.25,-1,0],w);}
  const L='Left',r='Right';
  switch(n){
    case 12:for(const [s,k] of [[L,1],[r,-1]])target(s,j.Hips,k*.18,-.04*R,-.1,[0,-1,-.15],1-u(1.7,2.4));break;
    case 13:knees(L,1-u(3,4.8));knees(r,1-u(3,4.8));break;
    case 17:face(L,a._mouth,.015,0,.085,phase);break;
    case 19:face(L,a._mouth,.065,-.045,.095,phase);face(r,a._mouth,.085-.16*u(4.1,4.8),-.008,.08,u(3.8,4.1)-u(4.9,5.45));break;
    case 20:for(const [s,k] of [[L,1],[r,-1]])face(s,eye(s),k*.119,.045,.054,1-u(2,2.65));break;
    case 21:case 22:body(L,.13,-.16,.28,[0,.2,.85]);body(r,-.11+.14*(n===22?phase:.5+.5*cycle),-.12,.3,[.7,-.35,.4]);break;
    case 24:for(const [s,k] of [[L,1],[r,-1]])body(s,k*.04,.51,.14,[-k*.75,.4,.2],phase);break;
    case 25:case 95:case 114:case 193:case 194:face(n===25?r:L,eye(n===25?r:L),.008,.079,.095);break;
    case 26:pocket(L);pocket(r);break;
    case 28:case 81:for(const [s,k] of [[L,1],[r,-1]])body(s,k*(n===28?.033:.04+.095*(.5+.5*cycle)),-.135+(n===28?k*.025*cycle:0),.27,[-k,.28,.1]);break;
    case 29:for(const [s,k] of [[L,1],[r,-1]])target(s,j.Hips,.06*k,.17*R,.154,[-k,.25,0]);break;
    case 30:target(L,j.Neck,.045,-.005,.125,[-.4,.8,0]);face(r,a._mouth,-.09,-.05,.12,phase);break;
    case 31:for(const [s,k] of [[L,1],[r,-1]])face(s,eye(s),k*(.03+.01*cycle),-.013,.09,u(3.65,4)-u(4.96,5.35));break;
    case 41:face(L,a._mouth,.014,0,.082);face(r,a._mouth,-.038,0,.095,1-u(2.1,3.05));break;
    case 57:case 58:case 76:case 94:case 103:case 127:body(L,.04,-.068,.169,[-.7,.65,0],.9);break;
    case 72:case 105:case 107:case 121:pair(.081,-.15,n===159?.168:.222,[0,.65,.25]);break;
    case 99:target(r,j.Hips,-.045,.18*R,.152,[.8,.35,.1]);break;
    case 109:body(L,.018,-.29,.153,[-.65,-.55,.15]);body(r,-.029,-.32,.177,[.6,-.55,.1]);break;
    case 110:face(L,a._mouth,.095,0,.057);break;
    case 120:case 156:table(L,.07,.32);pocket(L,u(2.25,3.35));break;
    case 125:face(L,eye(L),.006+.069*u(1,2),-.029,.08,phase);break;
    case 151:j.Head.rotation.x+=.14*phase;for(const [s,k] of [[L,1],[r,-1]])face(s,a._mouth,k*.054,-.077-.12*(1-phase),.103);break;
    case 157:pair(.055+.034*phase,-.17,.161,[0,.5,.3]);break;
    case 164:pair(.155,-.11+.128*phase,.225-.047*phase,[0,.9,.2]);break;
    case 176:pocket(r,1-u(1.1,1.8));break;
    case 187:body(L,.13,-.10,.235,[-.65,.7,.24]);body(r,-.115,-.22,.256,[.83,.45,.22]);break;
    case 62:case 116:case 123:case 124:case 168:knees(r);break;
    case 117:case 184:knees(L);break;
    case 159:for(const [s,k] of [[L,1],[r,-1]])body(s,k*(.19-.135*phase),-.02-.08*phase,.18,[-k,.6,0]);break;
    case 2:j.Head.rotation.y=.75*Math.sin(2*t)*(1-u(2.4,2.76))+.41*u(2.4,2.76);break;
    case 47:case 86:j.Head.rotation.y=.64*u(.4,1.3)-.25*u(3.7,4.8);break;
    case 52:case 85:j.Head.rotation.x=.32*phase;body(L,.12,-.20,.2+.09*phase,[0,.3,.9]);if(n===85)j.Hips.position.z-=R*.28*u(2.1,4.8);break;
    case 64:for(const [s,k] of [[L,1],[r,-1]])body(s,k*.16,-.26+.22*phase,.18+.18*phase,[0,.94,.12]);break;
    case 148:j.Head.rotation.y=.35-.7*u(2.2,3.35);knees(L);break;
    case 154:j.Hips.position.x+=.06*phase;j.Head.rotation.y=.24*phase;break;
    case 181:j.Head.rotation.x+=.33*(1-phase);j.Head.rotation.y=.34*phase;break;
    case 189:j.Hips.rotation.y+=2.3*u(2.7,3.6);j.Hips.position.x-=.44*u(3.55,5.4);break;
    case 16:table(L,.11,.32,.06*phase);body(r,-.13,-.18,.22);break;
    case 18:body(L,.035,-.21+.04*phase,.245+.07*phase,[0,.65,.25]);body(r,-.12,-.15,.31);break;
    case 27:pair(.11,-.17,.33,[0,.8,.4]);break;
    case 71:case 73:case 126:body(L,.075,-.18,.25+.15*phase,[0,.15,1]);break;
    case 74:case 139:pair(.072,-.18,.28+.058*phase,[0,.22,1]);break;
    case 96:face(L,a._mouth,.035,-.025,.087,phase);break;
    case 97:case 138:table(L,.075,.24+.19*phase);break;
    case 100:table(L,.07,.32);break;
    case 102:body(L,.12,-.16,.25);body(r,-.08,-.14,.24+.15*phase);break;
    case 104:body(L,.27,-.11,.18);body(r,-.23,-.10,.25);break;
    case 106:case 142:case 174:pair(.10,-.13+.095*phase,.30);break;
    case 108:case 169:case 170:case 180:{
      const down=Math.sin(Math.PI*u(.3,4.8)),kneel=n===108||n===169||n===170;
      {
        const fold=kneel?1.39:1.33;
        for(const side of [L,r]){
          const thigh=j[side+'UpLeg'],shin=j[side+'Leg'],foot=j[side+'Foot'];
          thigh.rotation.x+=( -fold-thigh.rotation.x)*down;
          shin.rotation.x+=(2*fold-shin.rotation.x)*down;
          foot.rotation.x+=(-fold-foot.rotation.x)*down;
        }
        j.Hips.position.y+=(R*(.085+.79*Math.cos(fold))-j.Hips.position.y)*down;
        j.Spine.rotation.x+=(.68-j.Spine.rotation.x)*down;
        j.Spine1.rotation.x+=.21*down;
      }      for(const [s,k] of [[L,1],[r,-1]])work(s,k*.105,(1-down)*.89+down*.105,.24+.14*down,[0,-.8,.35],down);
      break;
    }
    case 118:case 119:pair(.065,-.15,.245+.14*(n===118?phase:1-u(1.1,3.2)));break;
    case 122:case 144:case 145:case 146:case 150:{
      const lift=n===144?u(.7,2.95):n===146?1-u(1,3.8):1;
      target(r,j.Hips,-.245,-.20*R-.10*R*(1-lift),.10,[0,-.92,.12]);break;
    }
    case 140:body(r,-.07,.015,.25+.16*phase,[0,.4,.85]);break;
    case 147:face(L,a._mouth,.015,.029,.114,phase);break;
    case 149:work(L,.12,.58,.36+.12*phase);break;
    case 158:pair(.25,.12,.30);break;
    case 173:body(L,.115,-.12,.26+.12*phase);body(r,-.105,-.17,.25+.11*phase);break;
    case 177:body(L,.115,.31,.28);body(r,-.13,.29,.28);break;
    case 42:case 68:case 77:case 84:case 88:case 98:case 101:case 115:case 136:case 179:case 183:case 192:case 195:case 197:{
      const elevation=n===183?.35:[68,98,136,195].includes(n)?-.22:.015;
      const across=n===88?.18-.35*u(.9,3.4):.105;
      const z=n===183?.19:.34;
      body(L,across,elevation,z,[across,elevation*2,z],.35+.65*phase);
      for(let k=1;k<=3;k++)j['LeftHandIndex'+k].rotation.x=-.025;
      break;
    }
    case 200:{
      const grab=u(1.59,1.79)-u(1.98,2.16);
      work(r,-.09-.12*grab,.98-.02*grab,.22+.25*grab,[0,-1,0],u(1.05,1.48)-u(2.65,3.05));
      break;
    }
    case 202:case 204:{
      const fold=n===202?u(2.52,2.72):u(1.7,1.94);
      for(const [s,k] of [[L,1],[r,-1]])body(s,-k*.104,k===1?-.05:-.17,k===1?.18:.195,[-k,.31,.05],fold);
      break;
    }
    case 203:{
      const hold=u(.42,.7)-u(4.42,4.56);
      for(const [s,k] of [[L,1],[r,-1]])body(s,k*.167,k===1?-.18:-.12,.245,[-k,.5,.2],hold);
      break;
    }
    case 205:work(r,-.17,1.03,.44,[0,-.92,.3],u(.29,.59)-u(2.42,2.74));break;
    case 206:pair(.242,-.225,.332,[0,-.35,.93]);break;
    case 134:table(L,.07,.32,.09*(.5+.5*cycle));table(r,-.07,.31);break;
    case 135:table(L,.065*Math.cos(t*3),.34+.065*Math.sin(t*3));table(r,-.145,.29);break;
    case 160:for(const [s,k] of [[L,1],[r,-1]])table(s,.071*k,.28+.045*k*cycle,-.18);break;
    case 161:pair(.105,-.19,.285);j.LeftHand.rotateY(.6*cycle);j.RightHand.rotateY(-.6*cycle);break;
    case 152:table(L,.14,.33,.21);table(r,-.10,.33,.02);break;
    case 153:table(L,.045,.35,.14);table(r,-.075,.35,.13);break;
    case 178:table(L,.16,.38,.13);table(r,-.16,.38,.13);break;
    case 143:case 162:case 163:case 165:case 166:{
      const high=[162,165,166].includes(n);for(const [s,k] of [[L,1],[r,-1]])body(s,k*(high?.245:.19),high?.41:-.18,high?.18:.295);break;
    }
    case 167:{const stroke=.5+.5*cycle;table(L,.035,.39,-.14-.15*stroke);table(r,-.12,.26,.12-.15*stroke);break;}
  }
}
