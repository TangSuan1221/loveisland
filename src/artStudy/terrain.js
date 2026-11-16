const TAU = Math.PI * 2;
const EXTENT = 112;
const PAPER = 3072;

function randomSource(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function terrainPaper(THREE, rand) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PAPER;
  const ctx = canvas.getContext('2d');
  const unit = PAPER / EXTENT;
  ctx.translate(PAPER / 2, PAPER / 2);
  ctx.scale(unit, unit);

  const shore = a => 1 + .037 * Math.sin(3*a+.6) + .044*Math.cos(5*a-.3)
    + .027*Math.sin(8*a) + .009*Math.sin(19*a+.4) + .007*Math.sin(30*a);
  const pos = (a, r, noise=0) => [
    16.8 * (r * shore(a) + noise) * Math.cos(a),
    13.8 * (r * shore(a) + noise) * Math.sin(a)
  ];
  function coast(r, color, noiseAmp=0, phase=0) {
    ctx.beginPath();
    for (let i=0; i<=640; i++) {
      const a = i * TAU / 640;
      const n = noiseAmp * (Math.sin(15*a+phase) + .45*Math.cos(27*a-phase)+.23*Math.sin(81*a));
      const [x,z] = pos(a,r,n);
      if (!i) ctx.moveTo(x,z); else ctx.lineTo(x,z);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  function stroke(points, color, width) {
    ctx.beginPath();
    points.forEach(([x,z],i)=> i ? ctx.lineTo(x,z) : ctx.moveTo(x,z));
    ctx.strokeStyle=color; ctx.lineWidth=width; ctx.lineCap='round'; ctx.stroke();
  }
  function dab(x,z,w,h,color,angle=0) {
    ctx.fillStyle=color; ctx.beginPath();
    ctx.ellipse(x,z,w,h,angle,0,TAU);ctx.fill();
  }
  ctx.fillStyle='#4a9bb5';ctx.fillRect(-56,-56,112,112);
  coast(2.08,'#52a8bc',.09);
  coast(1.61,'#54b3bf',.053);
  coast(1.36,'#5dbdc2',.045);
  coast(1.21,'#71c9c7',.035);
  coast(1.12,'#8dd8ce',.015);
  for(let i=0;i<3800;i++){
    const x=(rand()-.5)*100,z=(rand()-.5)*100;
    const w=.14+rand()**3*2.1;
    const c=rand()>.55?'rgba(218,250,229,.27)':'rgba(29,112,147,.12)';
    stroke([[x-w,z+.025],[x-w*.4,z-.035],[x+w*.22,z+.015],[x+w,z-.04]],c,.018+rand()*.045);
  }
  // A growth point and a limited branch order give each submerged colony its own silhouette.
  function fan(x,z,length,angle,depth,family){
    const x1=x+Math.sin(angle)*length,z1=z-Math.cos(angle)*length*.7;
    if(family===2){
      ctx.beginPath();ctx.moveTo(x,z);
      ctx.quadraticCurveTo(x+length*.4,z-length*.15,x1,z1);
      ctx.quadraticCurveTo(x+length*.08,z-length*.25,x,z);
      ctx.fillStyle='rgba(47,133,148,.29)';ctx.fill();
    }else{
      stroke([[x,z],[x+(x1-x)*.65,z+(z1-z)*.44],[x1,z1]],
        family?'rgba(37,120,150,.35)':'rgba(61,143,143,.30)',.025+length*.11);
    }
    if(depth>0){
      fan(x1,z1,length*(.45+rand()*.31),angle-.32-rand()*.43,depth-1,family);
      fan(x1,z1,length*(.54+rand()*.27),angle+.12+rand()*.42,depth-1,family);
    }
  }
  for(let i=0;i<36;i++){
    const a=rand()*TAU,[x,z]=pos(a,1.16+rand()*.91);
    const family=i%3,spread=.4+rand()*1.55,scale=.35+rand()*.65;
    dab(x,z,.5+spread,.20+spread*.28,'rgba(53,134,151,.11)',(rand()-.5)*.45);
    for(let k=0;k<5+Math.floor(spread*3);k++){
      const dx=(rand()-.5)*spread*1.4;
      fan(x+dx,z+rand()*.25,scale*(.28+rand()*.71),dx*.85+(rand()-.5),family===2?1:2,family);
    }
  }  coast(1.021,'#e9f7dc',.003);
  coast(1.008,'#a5d7c7',.002);
  coast(1,'#e9c693',.002);
  coast(.988,'#f4d79e',.002);
  for(let i=0;i<105;i++){
    const a=rand()*TAU,len=.008+rand()*.105,r=1.027+rand()**2*.08;
    const pts=[];
    for(let j=0;j<=14;j++) pts.push(pos(a+j*len/14,r+.0017*Math.sin(j/14*Math.PI)));
    stroke(pts,'rgba(240,254,229,.85)',.023+rand()*.055);
  }
  function distance(x,z) {
    const a=Math.atan2(z/13.8,x/16.8);
    return Math.hypot(x/16.8,z/13.8)/shore(a);
  }
  const grass = (x,z)=> {
    const d=distance(x,z), angle=Math.atan2(z/13.8,x/16.8);
    const edge=.82+.09*Math.sin(3*angle+.3)+.055*Math.sin(7*angle);
    const clearing=((x-1.2-.15*z)/8.3)**2+((z-2)/(z>2?13.5:6.3))**2;
    return Math.min((edge-d)*10, clearing-1)+.12*Math.sin(2.8*x+Math.sin(z*2))+.055*Math.cos(5*z-x);
  };
  const pixel = ctx.getImageData(0,0,PAPER,PAPER);
  const rgb=pixel.data;
  const grassColors=[[186,184,107],[164,175,95],[147,163,87],[133,152,86]];
  for(let iz=Math.floor((56-16)*unit);iz<(56+16)*unit;iz++){
    const z=iz/unit-56;
    for(let ix=Math.floor((56-20)*unit);ix<(56+20)*unit;ix++){
      const x=ix/unit-56,g=grass(x,z);
      if(g<0) {
        if(distance(x,z)<.985){
          const wash=Math.sin(x*.52 + Math.cos(z*.66)*1.8) + .65*Math.sin(z*.83+x*.35)+.24*Math.sin(z*2.1-x*.84);
          const j=(iz*PAPER+ix)*4;
          if(wash>1.15){rgb[j]=241;rgb[j+1]=207;rgb[j+2]=153;}
          if(wash< -1.47){rgb[j]=249;rgb[j+1]=222;rgb[j+2]=169;}
        }
        continue;
      }
      const patch=Math.sin(x*.98+Math.sin(z*.9)*1.8)+.65*Math.cos(z*1.75+x*.2)+.2*Math.sin(x*5+z*2);
      const palette=g<.075 ? 0 : patch>1.05?3:patch>.25?2:1;
      const color=grassColors[palette],j=(iz*PAPER+ix)*4;
      for(let k=0;k<3;k++)rgb[j+k]=color[k];
    }
  }
  ctx.putImageData(pixel,0,0);
  for(let i=0;i<3600;i++){
    const x=(rand()-.5)*36,z=(rand()-.5)*30;
    if(distance(x,z)>.99)continue;
    if(grass(x,z)>.05){
      const clump=rand()>.84;
      dab(x,z,.024+rand()*.16,.016+rand()*.042,clump?'#78874f':'rgba(206,208,126,.58)');
      if(clump) for(let j=0;j<4;j++){
        const dx=(rand()-.5)*.25, h=.055+rand()*.18;
        stroke([[x+dx,z],[x+dx*1.5,z-h*.74],[x+dx*2,z-h]],'#646f47',.019);
      }
    }else{
      dab(x,z,.018+rand()**3*.30,.012+rand()*.036,rand()>.5?'rgba(182,144,98,.45)':'rgba(255,237,187,.9)',-.18);
    }
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=8;
  return {texture,pos,distance,ctx};
}

function makeRocks(THREE, scene, rand, pos, distance, ctx) {
  const verts=[],colors=[],lines=[];
  const tint=new THREE.Color();
  const swatches=['#5b5665','#716674','#80737b','#988881','#615d70','#4b4c60'];
  function tri(a,b,c,hex){
    verts.push(...a,...b,...c);tint.set(hex);
    for(let i=0;i<3;i++)colors.push(tint.r,tint.g,tint.b);
  }
  function rock(x,z,w,h,moss){
    if(x>9.5 && x<21 && z>4.25 && z<8.75)return;
    const sides=5+Math.floor(rand()*3),base=[],rim=[],cap=[];
    const phase=rand()*TAU,lean=(rand()-.5)*w*.92;
    for(let i=0;i<sides;i++){
      const a=phase+i*TAU/sides, r=w*(.82+rand()*.28),lx=r*Math.cos(a),lz=r*Math.sin(a)*.73;
      base.push([x+lx,.01,z+lz]);
      rim.push([x+lx*(.52+rand()*.36)+lean,h*(.40+rand()*.34),z+lz*.83]);
      cap.push([x+lx*(.20+rand()*.48)+lean,h*(.76+rand()*.29),z+lz*.48]);
    }
    const top=[x+lean,h*1.035,z];
    for(let i=0;i<sides;i++){
      const j=(i+1)%sides, side=swatches[(i+2)%swatches.length];
      tri(base[i],base[j],rim[j],side);tri(base[i],rim[j],rim[i],side);
      tri(rim[i],rim[j],cap[j],moss?'#889259':side);tri(rim[i],cap[j],cap[i],moss?'#939b61':side);
      tri(cap[i],cap[j],top,moss?'#a1ac69':'#a5968f');
      if(i%2===0 || h>1)lines.push(...base[i],...rim[i]);
      lines.push(...cap[i],...cap[j]);
      if(w>.45 && i%2===0){
        const v=(a,b,t)=>a.map((n,k)=>n+(b[k]-n)*t);
        const start=v(cap[i],cap[j],.35),end=v(base[i],rim[j],.39);
        const mid=v(start,end,.55);mid[0]+=.053*w;
        lines.push(...start,...mid,...mid,...end);
      }
    }
  }
  for(let i=0;i<28;i++){
    const a=i*TAU/28+rand()*.09;
    if(a>.35 && a<1.15) continue;
    const offshore=i%4===0;
    const [x,z]=pos(a,offshore?1.22+rand()*.23:.89+rand()*.08);
    const scale=.36+rand()*.80;
    if(offshore){
      ctx.save();
      ctx.translate(x,z);ctx.scale(scale,scale*.66);
      ctx.beginPath();ctx.ellipse(0,0,2.05,1.79,-.12,0,TAU);
      ctx.fillStyle='rgba(42,116,132,.32)';ctx.fill();
      for(let j=0;j<3;j++){
        ctx.beginPath();ctx.ellipse(.08,0,2.1+j*.13,1.85+j*.16,-.12,j*2.1+.1,j*2.1+1.85);
        ctx.strokeStyle=j===1?'#d8eee0':'#bce6dc';ctx.lineWidth=.075;ctx.stroke();
      }
      ctx.restore();
    }
    for(let k=0;k<3+rand()*3;k++){
      const w=scale*(.28+rand()*.78);
      rock(x+(rand()-.5)*2.2*scale,z+(rand()-.5)*1.65*scale,w,w*(.60+rand()*1.25),k%3===0&&!offshore);
    }
  }
  for(let i=0;i<120;i++){
    const x=(rand()-.5)*34,z=(rand()-.5)*28;
    if(distance(x,z)>.98 || Math.hypot(x,z)<5.6)continue;
    const w=.045+rand()**2*.24;
    rock(x,z,w,w*(.45+rand()*.62),false);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  mesh.castShadow=true;scene.add(mesh);
  const ink=new THREE.BufferGeometry(); ink.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  scene.add(new THREE.LineSegments(ink,new THREE.LineBasicMaterial({color:'#454453',transparent:true,opacity:.75})));
}

// Each terrace is drawn from uneven vertical profiles. The upper turf overhang interrupts
// the cliff edge; individual strata end before they become a continuous horizontal stripe.
export function makeEscarpment(THREE,scene,rand){
  const faces=[],colors=[],edge=[];
  const color=new THREE.Color();
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  function tri(a,b,c,hex){
    faces.push(...a,...b,...c);color.set(hex);
    for(let j=0;j<3;j++)colors.push(color.r,color.g,color.b);
  }
  function line(points){
    for(let j=1;j<points.length;j++)edge.push(...points[j-1],...points[j]);
  }
  function terrace(x,z,rx,rz,h,rot){
    const n=24, rings=[[],[],[],[],[]];
    const top=[x-.04*rx,h*1.016,z];
    for(let i=0;i<n;i++){
      const a=i*TAU/n+rot;
      const radius=.92+.1*Math.sin(3*a+.6)+.08*Math.sin(6*a)+rand()*.085;
      const dx=Math.cos(a)*rx*radius,dz=Math.sin(a)*rz*radius;
      const yr=h*(.92+rand()*.035+.055*Math.sin(3*a)-.064*Math.cos(a));
      rings[0].push([x+dx*1.15,0,z+dz*1.16]);
      rings[1].push([x+dx*(.96+rand()*.13),h*(.23+rand()*.15),z+dz*1.08]);
      rings[2].push([x+dx*.91-.025*rx,h*(.67+rand()*.15),z+dz*.92]);
      rings[3].push([x+dx*.83-.06*rx,yr-h*(.035+rand()*.07),z+dz*.88]);
      rings[4].push([x+dx*.83-.06*rx,yr,z+dz*.89]);
    }
    const stone=['#4d5261','#585965','#63616b','#756c70','#817777'];
    const moss=['#77895b','#80925e','#87975f','#93a16a','#a3ac70'];
    for(let i=0;i<n;i++){
      const j=(i+1)%n,a=(i+.5)*TAU/n+rot;
      const lit=Math.sin(a)*.8-Math.cos(a)*.6;
      const value=Math.min(4,Math.max(0,Math.round(1.9+lit*1.5+(rand()-.5)*1.5)));
      for(let k=0;k<4;k++){
        const low=rings[k],high=rings[k+1];
        const palette=k===3?moss:stone;
        tri(low[i],low[j],high[j],palette[value]);
        tri(low[i],high[j],high[i],palette[k===0&&i%3===0?Math.max(0,value-1):value]);
      }
      function wall(u,v){
        const piece=v<.40?0:v<.78?1:v<.94?2:3;
        const stops=[0,.40,.78,.94,1];
        const ratio=(v-stops[piece])/(stops[piece+1]-stops[piece]);
        const lower=rings[piece],upper=rings[piece+1];
        const p=lower[i].map((n,k)=>u>=ratio
          ? n*(1-u)+lower[j][k]*(u-ratio)+upper[j][k]*ratio
          : n*(1-ratio)+upper[j][k]*u+upper[i][k]*(ratio-u));
        p[0]+=.024*Math.cos(a);p[2]+=.024*Math.sin(a);
        return p;
      }
      const vine=.24+.17*Math.cos(a*3.3)+.17*Math.sin(a*5.7);
      const mat=lit<-.2?'#52695a':'#687a58';
      for(let strand=0;strand<8;strand++){
        const u=strand/8, v=(strand+1)/8;
        const tuft=.035+.014*rand();
        const bottom=Math.min(.97,Math.max(.30,.99-vine*(.5+.50*Math.cos((i+u)*1.3))-.055*Math.sin((u+i)*7)));
        const bottomLeft=wall(u,bottom+tuft),tip=wall((u+v)/2,bottom-rand()*.036),bottomRight=wall(v,bottom+tuft);
        const vegetation=bottom>.86?'#84915c':mat;
        let lowLeft=bottomLeft, lowRight=bottomRight;
        for(const level of [.78,.94,1]){
          if(level<=bottom+tuft) continue;
          const hiLeft=wall(u,level),hiRight=wall(v,level);
          tri(lowLeft,lowRight,hiRight,vegetation);tri(lowLeft,hiRight,hiLeft,vegetation);
          lowLeft=hiLeft;lowRight=hiRight;
        }
        tri(bottomLeft,bottomRight,tip,vegetation);
        if(strand%2===0 && bottom<.86){
          const s1=wall(u+.02,bottom+.04),s2=wall(u+.08,bottom+.09),s3=wall(u+.07,bottom-.01);
          tri(s1,s2,s3,'#839260');
        }
      }
      for(let f=0;f<15;f++){
        const u=.08+rand()*.78,v=.08+rand()*.75,len=.015+rand()**2*.12;
        const p=wall(u,v),q=wall(u+.028+rand()*.045,v+.009),r=wall(u+.044+rand()*.025,Math.max(.012,v-len));
        tri(p,q,r,stone[Math.max(0,value-(f%4===0?2:1))]);
        if(f%5===0)line([p,r]);
      }
      const crown=rings[4],c0=crown[i],c1=crown[j];
      tri(c0,c1,top,'#94a165');
      if(i%4===1)line([rings[1][i],rings[2][i],rings[3][i]]);
      if(i%3!==1)line([rings[3][i],rings[3][j]]);
      // Fractures and bits of stone vary in width with their edge's projected length.
      const stoneTop=rings[3][i],base=rings[0][i];
      const face=mix(stoneTop,rings[3][j],.48);
      const foot=mix(base,rings[0][j],.32);
      const crackStart=mix(face,foot,rand()*.32);
      const bend=mix(crackStart,foot,.24+rand()*.25);
      bend[0]+=.09*Math.cos(a);bend[2]+=.09*Math.sin(a);
      if(i%3!==0)line([crackStart,bend,mix(bend,foot,.28+rand()*.32)]);
      if(i%2===0){
        const p=mix(c0,c1,.16),q=mix(c0,c1,.72);
        const dip=mix(rings[2][i],rings[2][j],.48);
        const tip=mix(mix(p,q,.5),dip,.34+rand()*.68);
        tip[0]+=.025*Math.cos(a);tip[2]+=.025*Math.sin(a);
        tri(p,q,tip,moss[Math.max(0,value-1)]);
      }
    }
    // Broken moss patches, leaf sprays, pale pebble edges and tufts on the summit.
    for(let j=0;j<80;j++){
      const k=Math.floor(rand()*n),l=(k+1)%n;
      const at=mix(top,mix(rings[4][k],rings[4][l],rand()),Math.sqrt(rand())*.91);
      at[1]+=.024;
      const w=(.05+rand()**2*.35)*Math.min(rx,2)/2;
      const a=[at[0]-w,at[1],at[2]],b=[at[0],at[1]+.014,at[2]-.5*w],c=[at[0]+w*.7,at[1],at[2]+.35*w];
      tri(a,b,c,j%5===0?'#b5b77b':'#7b905b');
      if(j%3===0){
        for(let m=-1;m<=1;m++){
          const tip=[at[0]+m*w*.65,at[1]+.12+w*.8,at[2]+m*w*.12];
          tri(at,[at[0]+w*.25,at[1],at[2]],tip,'#657d55');
        }
      }
    }
  }
  terrace(1.8,-8.3,2.13,1.68,2.1,.1);
  terrace(-2.2,-8.9,1.85,1.65,3.6,.18);
  terrace(-.1,-10.25,3.05,2.05,6.32,-.11);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(faces,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  mesh.castShadow=true;scene.add(mesh);
  const ink=new THREE.BufferGeometry();ink.setAttribute('position',new THREE.Float32BufferAttribute(edge,3));
  scene.add(new THREE.LineSegments(ink,new THREE.LineBasicMaterial({color:'#414551',transparent:true,opacity:.77})));
}
export function buildTerrain(THREE,scene){
  const rand=randomSource(79241);
  const {texture,pos,distance,ctx}=terrainPaper(THREE,rand);
  const plane=new THREE.PlaneGeometry(EXTENT,EXTENT);
  plane.rotateX(-Math.PI/2);
  const tideTime={value:0};
  const groundPaint=new THREE.MeshBasicMaterial({map:texture});
  groundPaint.onBeforeCompile = shader => {
    shader.uniforms.tideTime=tideTime;
    shader.fragmentShader='uniform float tideTime;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', `
      vec2 waterUV = vMapUv;
      vec4 paperInk = texture2D(map, waterUV);
      float waterMask = smoothstep(0.025, 0.12, paperInk.b - paperInk.r);
      waterUV.x += waterMask * 0.00034 * sin(waterUV.y * 597.0 + tideTime * 0.53);
      waterUV.y += waterMask * 0.00015 * sin(waterUV.x * 273.0 - tideTime * 0.47);
      diffuseColor *= texture2D(map, waterUV);
    `);
  };
  const ground=new THREE.Mesh(plane,groundPaint);
  ground.position.y=-.04;scene.add(ground);
  const shade=new THREE.Mesh(plane,new THREE.ShadowMaterial({opacity:.23,color:'#36405a',depthWrite:false}));
  shade.position.y=-.033;shade.receiveShadow=true;scene.add(shade);
  makeRocks(THREE,scene,rand,pos,distance,ctx);
  makeEscarpment(THREE,scene,rand);
  return time => { tideTime.value=time; };
}

