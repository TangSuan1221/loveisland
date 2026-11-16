import {Mesh,SphereGeometry,MeshBasicMaterial} from 'three';
const pool=new WeakMap();
export function clearAccents(a){for(const m of pool.get(a)?.values()||[])m.visible=false;}
function accent(a,key,parent,color,x,y,z,rx,ry,rz){
 let slots=pool.get(a);if(!slots){slots=new Map();pool.set(a,slots);}
 let m=slots.get(key);if(!m){const g=new SphereGeometry(1,10,8),mat=new MeshBasicMaterial({color});a._resources.geometry.add(g);a._resources.material.add(mat);m=new Mesh(g,mat);m.name=key;parent.add(m);slots.set(key,m);}
 m.visible=true;m.position.set(x,y,z);m.scale.set(rx,ry,rz);return m;
}
export function accents(a,n,t){
 const j=a._rig.joints,head=a._head,beat=Math.sin(t*9),clamp=v=>Math.max(0,Math.min(1,v));
 if(n===7){for(let i=0;i<6;i++){const p=(t*.95+i/6)%1,r=.047*Math.sin(p*Math.PI);accent(a,'brake-dust'+i,j.Hips,0xb9a887,(i%2?1:-1)*(.08+.1*p),-.77+.16*p,-.06-.4*p,r*1.3,r*.7,r);}}
 if(n===14||n===15)accent(a,'saliva',head,0xb7d5d0,.038,-.15,.18,.007,.027+.015*(1+beat),.008);
 if(n===17){for(const s of [-1,1])accent(a,'cheek'+s,head,head.getObjectByName('face-skin').material.color,s*.152,-.056,.127,.063+.009*beat,.055,.048);
 const swallow=Math.pow(Math.max(0,Math.sin(t*3)),6);accent(a,'swallow',j.Neck,head.getObjectByName('face-skin').material.color,0,.045,.073,.047,.038+swallow*.024,.031+swallow*.023);}
 if(n===24){for(const s of [-1,1])accent(a,'tear'+s,head,0xbadce0,s*.122,-.008-.025*clamp(t/3),.175,.009,.015,.008);}
 if(n===29)accent(a,'tongue',head,0xbe7775,.013,-.131,.184,.027,.036,.012);
 if(n===30){for(let i=0;i<3;i++){const p=(t*.9+i/3)%1,r=.018*Math.sin(p*Math.PI);accent(a,'dry-breath'+i,head,0xbcc5bb,.013*Math.sin(11*p),-.098+.16*p,.215+.15*p,r,r*1.35,r);}}
 if(n===31){for(const eye of a._eyes)for(let i=0;i<2;i++){const s=i===0?-1:1;const vein=accent(a,'eye-vein'+eye.uuid+i,eye,0xb06e68,s*.031,-.001,.009,.01,.0014,.001);vein.rotation.z=s*.38;}}
}
