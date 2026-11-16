import {nightLook} from './cinema-light.js';
import {CanvasTexture,SRGBColorSpace,Mesh,MeshBasicMaterial,BufferGeometry,Float32BufferAttribute,DoubleSide} from 'three';
import {Group,Vector3,CircleGeometry,PlaneGeometry,Color} from 'three';

import firstScenes from './emotion-s-first.js';
import laterScenes from './emotion-s-later.js';
import storyScenes from './emotion-stories.js';

const scenes={...firstScenes,...laterScenes,...storyScenes};
export function sceneKey(event){
  if(Object.hasOwn(scenes,event.performanceKey))return event.performanceKey;
  if(event.type==='camp-story' && /^S_/.test(event.sceneId) && /^B[1-3]$/.test(event.result)){
    return 'CAMP_'+event.sceneId.slice(2)+'_'+(Number(event.result.slice(1))-1);
  }
  return Object.hasOwn(scenes,event.type)?event.type:event.sceneId;
}
export function sceneTheme(event){ return scenes[sceneKey(event)]?.[0]; }
const palettes={
  blush:['#f893b4','#ffced0','#fff1da'],
  music:['#403765','#9a6c9a','#f7c391'],
  floral:['#9988bb','#f4c7d3','#fff3dd'],
  stars:['#14233f','#555374','#aba1bc'],
  subdued:['#687c96','#acbdc8','#e0e5e4'],
  tension:['#492c46','#ac625e','#f4b98c'],
  warm:['#f2b173','#ffe2ad','#fff1da'],
  discovery:['#397e86','#8ac8bb','#e3eac1'],
  comic:['#f4b33c','#ffe29b','#fff2ce']
};
const clip=x=>Math.max(0,Math.min(1,x));
// Eyelid opening, brow height (model units), and mouth opening at the accent.
const expressions={
  music:[-.28,.009,.50],
  floral:[-.80,.004,-.18],
  stars:[.18,.008,.12],
  subdued:[-.44,-.006,-.18],
  tension:[-.25,-.012,.30],
  warm:[-.31,.006,-.12],
  discovery:[.45,.017,.55],
  comic:[.65,.021,.78]
};
export function emotionBeat(event,ms,total){
  const key=sceneKey(event);
  if(!Object.hasOwn(scenes,key)||!Number.isFinite(ms)||!Number.isFinite(total)||total<=0)return null;
  const [theme,start,end,role]=scenes[key],p=ms/total;
  if(p<start||p>=end)return null;
  const cutaway=['blush','floral','stars','music'].includes(theme)||key==='feelings-declined'||key==='S73_breakup';
  return {theme,role,cutaway,keepSky:!cutaway && !!nightLook(event),t:(p-start)/(end-start),seconds:(p-start)*total/1000};
}

function paint(ctx,theme,time){
  if(theme==='flowers')theme='floral';
  if(theme==='quiet')theme='subdued';
  const w=ctx.canvas.width,h=ctx.canvas.height,colors=palettes[theme];
  const sky=ctx.createLinearGradient(0,0,0,h);
  colors.forEach((c,i)=>sky.addColorStop(i/2,c));
  ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  if(theme==='comic'||theme==='tension'){
    const comic=theme==='comic',cx=w*(comic?.56:.42),cy=h*.52;
    const count=comic?22:40;
    for(let i=0;i<count;i++){
      const angle=i/count*Math.PI*2;
      const reach=(comic?.48:.56)+.14*Math.sin(i*7.4+time*2);
      ctx.beginPath();
      ctx.moveTo(cx+w*Math.cos(angle),cy+h*Math.sin(angle));
      ctx.lineTo(cx+w*reach*Math.cos(angle+.014),cy+h*reach*Math.sin(angle+.014));
      ctx.lineTo(cx+w*Math.cos(angle+.046),cy+h*Math.sin(angle+.046));
      ctx.fillStyle=comic?'rgba(255,251,214,.68)':'rgba(59,32,47,.30)';
      ctx.fill();
    }
    return;
  }
  if(theme==='discovery'){
    ctx.lineWidth=2;
    for(let i=0;i<8;i++){
      const phase=(i/8+time*.045)%1;
      ctx.strokeStyle='rgba(230,255,223,'+(.4*(1-phase))+')';
      ctx.beginPath();ctx.arc(w*.72,h*.44,phase*w*.9,0,Math.PI*2);ctx.stroke();
    }
    return;
  }
  if(theme==='subdued'){
    for(let i=0;i<16;i++){
      const x=(i*.091+time*.005)%1*w,y=(i*.4142)%1*h;
      const haze=ctx.createRadialGradient(x,y,0,x,y,w*.21);
      haze.addColorStop(0,'rgba(226,233,234,.13)');haze.addColorStop(1,'rgba(226,233,234,0)');
      ctx.fillStyle=haze;ctx.fillRect(x-w*.21,y-w*.21,w*.42,w*.42);
    }
    return;
  }
  for(let i=0;i<52;i++){
    const a=i*2.39996,x=((i*.618034+.018*Math.sin(a+time*.4))%1+1)%1*w;
    const y=((i*.414214-time*(theme==='stars'?.001:.028))%1+1)%1*h*(theme==='stars'?.58:1);
    const r=(theme==='stars'?1.4+i%3:i%7===0?14:2+(i%5))*h/420;
    const glow=ctx.createRadialGradient(x,y,0,x,y,r);
    glow.addColorStop(0,'rgba(255,255,239,'+(.37+.23*Math.sin(time+i))+')');glow.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  if(theme==='stars'){
    for(const [height,color,amplitude] of [[.61,'#595a79',.052],[.66,'#50556a',.025],[.70,'#454e59',.012]]){
      ctx.beginPath();ctx.moveTo(0,h);
      for(let i=0;i<=80;i++){
        const x=i/80;
        ctx.lineTo(x*w,h*(height+amplitude*(Math.sin(x*8+height*18)+.36*Math.cos(x*18))));
      }
      ctx.lineTo(w,h);ctx.fillStyle=color;ctx.fill();
    }
    for(let i=0;i<95;i++){
      const x=w*(i*.618034%1),depth=i*.414214%1,y=h*(.73+.27*depth);
      ctx.strokeStyle='rgba(209,202,175,'+(.08+.14*depth)+')';
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+2+6*depth,y-1-3*depth);ctx.stroke();
    }
  }
  if(theme==='warm'){
    const sun=ctx.createRadialGradient(w*.2,h*.27,0,w*.2,h*.27,w*.66);
    sun.addColorStop(0,'rgba(255,252,215,.87)');sun.addColorStop(1,'rgba(255,247,216,0)');
    ctx.fillStyle=sun;ctx.fillRect(0,0,w,h);
  }
  if(theme==='music'){
    for(let i=0;i<2;i++){
      const x=w*(i?.78:.22),spot=ctx.createRadialGradient(x,h*.10,0,x,h*.10,h*.8);
      spot.addColorStop(0,'rgba(255,231,165,.62)');spot.addColorStop(1,'rgba(255,218,186,0)');
      ctx.fillStyle=spot;ctx.fillRect(0,0,w,h);
    }
    for(let i=0;i<12;i++){
      const x=(i+.55)*w/12,y=h*(.31+.13*Math.sin(i*.72+time*1.5));
      ctx.save();ctx.translate(x,y);ctx.rotate(-.14);ctx.fillStyle='rgba(255,246,213,.63)';
      ctx.beginPath();ctx.ellipse(0,0,6,4,-.45,0,Math.PI*2);ctx.fill();ctx.fillRect(4,-19,2,19);
      ctx.beginPath();ctx.moveTo(4,-19);ctx.quadraticCurveTo(19,-16,12,-8);ctx.quadraticCurveTo(13,-13,4,-14);ctx.fill();ctx.restore();
    }
  }
  if(theme==='floral'){
    for(const side of [-1,1]){
      ctx.save();ctx.translate(side<0?0:w,0);ctx.scale(side<0?1:-1,1);
      ctx.fillStyle='#ab79a5';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w*.35,0);ctx.quadraticCurveTo(w*.25,h*.18,w*.09,h*.28);ctx.lineTo(w*.035,h);ctx.lineTo(0,h);ctx.fill();
      for(let i=0;i<17;i++){const x=w*(.33-i*.019),y=h*(.015+.23*(i/16)**1.7);
        for(let j=0;j<5;j++){const a=j*1.257+i;ctx.beginPath();ctx.ellipse(x+5*Math.cos(a),y+5*Math.sin(a),7,4,a,0,7);ctx.fillStyle=i%2?'#fff1dd':'#ec9dab';ctx.fill();}
        ctx.fillStyle='#e1b271';ctx.beginPath();ctx.arc(x,y,2,0,7);ctx.fill();
      }ctx.restore();
    }
  }
}
function skinMark(actor,shape,color){
  const pts=shape.map(([x,y])=>[x,y,actor._faceDepth(x,y)+.0055]);
  const geo=new BufferGeometry();
  geo.setAttribute('position',new Float32BufferAttribute(pts.flat(),3));
  geo.setIndex(Array.from({length:pts.length-2},(_,i)=>[0,i+1,i+2]).flat());
  const mat=new MeshBasicMaterial({color,side:DoubleSide,transparent:true,depthWrite:false});
  const mesh=new Mesh(geo,mat);actor._head.add(mesh);mesh.visible=false;
  return mesh;
}
function faceMarks(actor){
  if(!actor?._faceDepth)return [];
  const marks=[];
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const x=side*(.10+i*.020),y=-.057+i*.002;
    const shape=Array.from({length:16},(_,n)=>{const a=n*Math.PI/8;return [x+.006*Math.cos(a)+.006*Math.sin(a),y+.020*Math.sin(a)];});
    marks.push(skinMark(actor,shape,'#ec7991'));
  }
  return marks;
}
export function createEmotionStage(scene,actors){
  let frame=null,cast=[],marks=[],texture,ctx,last='',participants=new Set();
  let meadow;
  const contactPoint=new Vector3(),rootPoint=new Vector3();
  function makeMeadow(){
    const group=new Group(),floor=new CircleGeometry(1,96);
    const positions=floor.getAttribute('position'),colors=[],color=new Color();
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),angle=Math.atan2(y,x);
      const edge=6+.26*Math.sin(5*angle)+.15*Math.sin(11*angle);
      positions.setXYZ(i,x*edge,0,-y*edge);
      color.set(i===0?'#53665d':'#47555b').multiplyScalar(1+.045*Math.sin(7*angle));
      colors.push(color.r,color.g,color.b);
    }
    floor.setAttribute('color',new Float32BufferAttribute(colors,3));
    const surface=new Mesh(floor,new MeshBasicMaterial({vertexColors:true,side:DoubleSide}));
    group.add(surface);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const c=canvas.getContext('2d'),fade=c.createRadialGradient(32,32,1,32,32,32);
    fade.addColorStop(0,'rgba(12,21,26,.73)');fade.addColorStop(.49,'rgba(12,21,26,.47)');fade.addColorStop(1,'rgba(12,21,26,0)');
    c.fillStyle=fade;c.fillRect(0,0,64,64);
    const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;
    const material=new MeshBasicMaterial({map,transparent:true,depthWrite:false}),quad=new PlaneGeometry();
    const anchors=[];
    for(const actor of cast.filter(Boolean)){
      const points=[actor._rig?.joints.Hips||actor.mesh,...(actor._rig?.limbs||[]).map(limb=>limb.foot)];
      for(const [index,joint] of points.entries()){
        const shade=new Mesh(quad,material);shade.rotation.x=-Math.PI/2;group.add(shade);
        const size=actor.mesh.scale.y;
        shade.scale.set((index?.32:.96)*size,(index?.42:.74)*size,1);
        anchors.push({joint,shade,actor,foot:index>0});
      }
    }
    group.name='cinema-stargazing-meadow';scene.add(group);group.visible=false;
    return {group,update(){
      let y=Infinity,x=0,z=0;
      for(const {joint,shade,actor,foot} of anchors){
        joint.getWorldPosition(contactPoint);
        actor.mesh.getWorldPosition(rootPoint);
        if(foot)y=Math.min(y,contactPoint.y-.065*actor._rig.R*actor.mesh.scale.y);
        else{x+=rootPoint.x;z+=rootPoint.z;}
        shade.position.set(contactPoint.x,.004,contactPoint.z);
      }
      const count=cast.filter(Boolean).length||1;
      if(!Number.isFinite(y))y=rootPoint.y;
      surface.position.set(x/count,y-.009,z/count);
      for(const {shade} of anchors)shade.position.y=y-.005;
    },dispose(){
      group.removeFromParent();floor.dispose();surface.material.dispose();quad.dispose();material.dispose();map.dispose();
    }};
  }
  function clear(){
    frame=null;last='';
    meadow?.dispose();meadow=null;
    for(const group of marks)for(const m of group){m.removeFromParent();m.geometry.dispose();m.material.dispose();}
    marks=[];cast=[];participants.clear();
  }
  return {
    begin(event){
      clear();
      const spec=scenes[sceneKey(event)];
      if(!Array.isArray(spec))return;
      cast=event.participants.map(id=>actors.find(a=>a.id===id));
      marks=cast.map(actor=>['blush','floral'].includes(spec[0])?faceMarks(actor):[]);
      participants=new Set(cast.filter(Boolean).map(a=>a.mesh));
    },
    frame(event,ms,total){
      frame=emotionBeat(event,ms,total);
      for(let role=0;role<cast.length;role++){
        const actor=cast[role];
        if(!actor)continue;
        const p=frame?.t||0,theme=frame?.theme;
        const primary=cast.length===1||frame?.role==='both'||(frame?.role==='a' && role===0)||(frame?.role==='b' && role===1);
        const strength=clip(p*10-(primary?0:.6))*clip((1-p)*9)*(primary?1:.32);
        for(const m of marks[role]){m.visible=strength>.01;m.material.opacity=.85*strength;}
        if(!frame)continue;
        const reaction=theme==='blush'?(p<.45?[.4,.014,.58]:[-.7,.004,-.12]):expressions[theme];
        const [lid,lift,mouth]=reaction;
        for(const eye of actor._eyes||[])eye.scale.y*=1+lid*strength;
        for(const brow of actor._head?.children||[])if(brow.name==='brow')brow.position.y+=lift*strength;
        if(actor._mouth)actor._mouth.scale.y*=1+mouth*strength;
      }
      return frame;
    },
    draw(render){
      if(!frame || frame.keepSky){render();return;}
      if(!texture){const canvas=document.createElement('canvas');canvas.width=768;canvas.height=432;ctx=canvas.getContext('2d');texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;}
      const tick=Math.floor(frame.seconds*16),key=frame.theme+tick;
      if(key!==last){paint(ctx,frame.theme,tick/16);texture.needsUpdate=true;last=key;}
      if(!frame.cutaway){
        const old=scene.background;
        try{scene.background=texture;render();}finally{scene.background=old;}
        return;
      }
      const hidden=[],keep=new Set();
      if(frame.theme==='stars'){
        meadow??=makeMeadow();
        meadow.update();meadow.group.visible=true;
        participants.add(meadow.group);
      }
      for(const actor of participants)for(let n=actor;n;n=n.parent)keep.add(n);
      scene.traverse(n=>{if(n.isLight)for(let p=n;p;p=p.parent)keep.add(p);});
      function isolate(n){for(const child of n.children){
        if(!child.visible||participants.has(child))continue;
        if(keep.has(child))isolate(child);else{hidden.push(child);child.visible=false;}
      }}
      const old=scene.background,fog=scene.fog;
      try{isolate(scene);scene.background=texture;scene.fog=null;render();}
      finally{scene.background=old;scene.fog=fog;for(const n of hidden)n.visible=true;if(meadow)meadow.group.visible=false;}
    },
    clear
  };
}
