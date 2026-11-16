import {CELL_SIZE,worldToCell,cellToWorld,facilityRect} from '../camp/footprints.js';
import {W,T,inBounds} from '../camp/grid.js';

// Hand-coloured botanical meshes. Positions are world metres, with Y up.
// A single mesh and one pen-stroke batch keep dense undergrowth inexpensive.
export function buildFlora(THREE, scene, {naturalForest=false}={}) {
  const vertices = [], colours = [], strokes = [], inks = [];
  const colourTable = new Map();
  const paintedRegions=[],assets=[];
  function finishAsset(x,z,radius,forestOnly=false) {
    const last=assets.at(-1);
    const cells=[], corners=[worldToCell(x-radius,z-radius),worldToCell(x+radius,z+radius)];
    for(let row=corners[0].y;row<=corners[1].y;row++)for(let col=corners[0].x;col<=corners[1].x;col++){
      if(!inBounds(col,row))continue;
      const center=cellToWorld(col,row);
      const dx=Math.max(0,Math.abs(center.x-x)-CELL_SIZE/2),dz=Math.max(0,Math.abs(center.z-z)-CELL_SIZE/2);
      if(dx*dx+dz*dz<=radius*radius)cells.push(row*W+col);
    }
    const anchor=worldToCell(x,z);
    assets.push({cells,anchor:anchor.y*W+anchor.x,forestOnly,faces:[last?.faces[1]||0,vertices.length/3],ink:[last?.ink[1]||0,strokes.length/3]});
  }
  const tau = Math.PI * 2;
  let seed = 0x9413b2;
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function rgb(hex) {
    if (!colourTable.has(hex)) colourTable.set(hex, new THREE.Color(hex).toArray());
    return colourTable.get(hex);
  }
  function triangle(a,b,c,fill) {
    vertices.push(...a,...b,...c);
    const tint = rgb(fill);
    colours.push(...tint,...tint,...tint);
  }
  function quad(a,b,c,d,fill) {
    triangle(a,b,c,fill);
    triangle(a,c,d,fill);
  }
  function line(points, ink = '#3f3548') {
    const tint = rgb(ink);
    for (let i=1;i<points.length;i++) {
      strokes.push(...points[i-1], ...points[i]);
      inks.push(...tint,...tint);
    }
  }
  function tube(spine, radii, shades, sides=12, ridged=0) {
    const rings=[];
    for (let k=0;k<spine.length;k++) {
      const p=spine[k];
      const tangent=new THREE.Vector3().fromArray(spine[Math.min(k+1,spine.length-1)])
        .sub(new THREE.Vector3().fromArray(spine[Math.max(0,k-1)])).normalize();
      const u=new THREE.Vector3(0,0,1).cross(tangent).normalize();
      const v=tangent.clone().cross(u);
      const ring=[];
      for(let i=0;i<sides;i++) {
        const theta=i*tau/sides;
        const radius=radii[k]*(1+ridged*Math.cos(theta*5+.33*k));
        ring.push(new THREE.Vector3().fromArray(p).addScaledVector(u,radius*Math.cos(theta))
          .addScaledVector(v,radius*Math.sin(theta)).toArray());
      }
      rings.push(ring);
      if(k) for(let i=0;i<sides;i++) {
        const j=(i+1)%sides;
        const l=Math.cos((i+.5)*tau/sides-.8);
        quad(rings[k-1][i],rings[k-1][j],ring[j],ring[i],
          shades[l>.63?0:l>-.12?1:l>-.65?2:3]);
      }
    }
    for(const i of [Math.round(sides*.12),Math.round(sides*.64)]) {
      line(rings.map(r=>r[i]),shades[3]);
    }
    return rings;
  }

  function mushroom(x,z,height,radius,shift,phase) {
    const stemStart=vertices.length/3;
    const stem=['#5d506d','#493e60','#393651','#302f48'];
    const topX=x+shift;
    const topZ=z-.2;
    const stalk=tube([[x,-.04,z],[x+.04*shift,height*.07,z],[x+.29*shift,height*.36,z+.15],
      [x+.72*shift,height*.66,z+.13],[topX,height*.87,topZ],[topX,height*.97,topZ]],
      [height*.17,height*.126,height*.091,height*.075,height*.1,height*.16],stem,20,.18);
    for (let i=0;i<20;i+=3) line(stalk.slice(1,5).map(r=>r[i]),'#564966');
    for(let k=0;k<5;k++) {
      const a=k*tau/5+phase, dx=Math.cos(a), dz=Math.sin(a);
      const base=height*(.23+.055*Math.sin(a*2));
      const root=[[x+dx*base,.015,z+dz*base],[x+dx*base*.63,height*.065,z+dz*base*.63],
        [x+dx*base*.39+shift*.18,height*.29,z+dz*base*.39],
        [x+dx*base*.26+shift*.53,height*.55,z+dz*base*.26+.13]];
      tube(root,[height*.018,height*.087,height*.052,.024],stem,8);
    }
    paintedRegions.push([stemStart,vertices.length/3,1]);
    const capStart=vertices.length/3;
    const outer=[], holes=[];
    for(let i=0;i<68;i++) {
      const a=i*tau/68;
      const r=1+.043*Math.cos(3*a+phase)+.027*Math.sin(5*a+phase);
      outer.push(new THREE.Vector2(r*Math.cos(a),r*Math.sin(a)*.91));
    }
    const pores=[[.55,.13,.145],[-.48,.39,.115],[.05,.56,.16],[-.68,-.19,.072],
      [.48,-.43,.075],[-.05,-.43,.093],[.49,.40,.044],[-.23,.64,.053]];
    for(const [cx,cz,sz] of pores) {
      const ring=[];
      for(let i=0;i<16;i++) {
        const a=tau*i/16;
        const r=sz*(1+.105*Math.sin(3*a+cx*4));
        ring.push(new THREE.Vector2(cx+r*Math.cos(a),cz+r*.73*Math.sin(a)));
      }
      for(const p of ring)p.rotateAround(new THREE.Vector2(),phase*.43);
      holes.push(ring);
    }
    function cap(p,bottom=false) {
      const radial=Math.hypot(p.x,p.y/.91);
      const dome=bottom? -.095*(1-radial)-.065 : .225*Math.max(0,1-radial*radial);
      return [topX+radius*p.x,height+radius*(dome+.10*p.x+.15*p.y+.018*Math.sin(4*p.x+phase)),topZ+radius*p.y];
    }
    const all=outer.concat(...holes);
    function facet(a,b,c,depth,under) {
      if(depth) {
        const ab=a.clone().lerp(b,.5),bc=b.clone().lerp(c,.5),ca=c.clone().lerp(a,.5);
        facet(a,ab,ca,depth-1,under);facet(ab,b,bc,depth-1,under);
        facet(ca,bc,c,depth-1,under);facet(ab,bc,ca,depth-1,under);
        return;
      }
      vertices.push(...cap(a,under),...cap(b,under),...cap(c,under));
      for(const p of [a,b,c]) {
        const t=p.x*.46-p.y*.75+.14*Math.sin(5*p.x+phase)+.075*Math.cos(9*p.y+phase);
        const tint=under?'#55415e':t<-.47?'#955077':t<-.28?'#ab517b':t<-.16?'#bf5985':t<.36?'#ce648c':t<.49?'#db7495':'#e47c99';
        colours.push(...rgb(tint));
      }
    }
    for (const [ia,ib,ic] of THREE.ShapeUtils.triangulateShape(outer,holes)) {
      facet(all[ia],all[ib],all[ic],2,false);
      facet(all[ia],all[ib],all[ic],1,true);
    }
    for(const ring of [outer,...holes]) {
      for(let i=0;i<ring.length;i++) {
        const a=ring[i],b=ring[(i+1)%ring.length];
        quad(cap(a),cap(b),cap(b,true),cap(a,true),ring===outer?'#955277':'#653f59');
      }
      line([...ring,ring[0]].map(p=>cap(p)), '#4c334f');
    }
    paintedRegions.push([capStart,vertices.length/3,2]);
    // Short groups of surface pen marks follow the cap's outer curvature.
    for(let i=0;i<36;i++) {
      const a=random()*tau, r=.78+random()*.12;
      const P=(angle,rad)=>cap(new THREE.Vector2(rad*Math.cos(angle),rad*.91*Math.sin(angle)));
      const p=P(a,r),q=P(a+.012+random()*.013,r+.008);
      p[1]+=.012;q[1]+=.012;line([p,q],'#85536d');
    }
    for(let i=0;i<21;i++) {
      const a=i*tau/21+.03*Math.sin(i);
      const pts=[.17,.38,.64,.89].map(r=>cap(new THREE.Vector2(r*Math.cos(a+.05*r),r*.91*Math.sin(a+.05*r)),true));
      line(pts,'#40394e');
      if(i%4===1) {
        const end=pts[3], len=height*(.07+random()*.10);
        tube([end,[end[0]+.025,end[1]-.4*len,end[2]],[end[0]-.03,end[1]-len,end[2]-.03]],
          [.035,.025,.003],['#808768','#61765e','#4b6355','#354b49'],6);
      }
    }
    finishAsset(x,z,height*.135);
  }

  function tusk(x,z,h,w,lean,arch) {
    const spine=[], radius=[];
    for(let k=0;k<=16;k++) {
      const t=k/16;
      spine.push([x+lean*t*t-arch*h*Math.sin(t*Math.PI),h*(1.16*t-.16*t*t)-.02,z-(.08+arch*.55)*h*t*t]);
      radius.push(.007+w*Math.pow(1-t,.86)*(1+.14*Math.exp(-Math.pow((t-.17)/.045,2))));
    }
    const rings=tube(spine,radius,['#f1e2bb','#dcd2b9','#c3b7a6','#8d8490'],18);
    for(const k of [2,3,4]) line(rings[k].slice(2+(k%2)*2,11+(k%3)*2),k===3?'#80757d':'#b0a59a');
    for(const i of [4,7,11]) line(rings.slice(5+i%3,11+i%5).map(r=>r[i]),'#c1b6a8');
    finishAsset(x+lean*.32,z-.06*h,Math.max(w*1.12,lean*.71));
  }

  function leafBlade(base, angle, length, lift, width, shades, toothed=false) {
    const cs=Math.cos(angle),sn=Math.sin(angle),left=[],right=[],mid=[];
    const steps=toothed?22:8;
    const toothPhase=random()*tau;
    for(let i=0;i<=steps;i++) {
      const t=i/steps, bend=.12*length*Math.sin(t*Math.PI);
      const y=base[1]+lift*Math.sin(Math.PI*t*.88)+(toothed?-.27:.16)*length*t*t;
      const x=base[0]+cs*t*length-sn*bend,z=base[2]+sn*t*length+cs*bend;
      const split=toothed&&i%2===0?.59+.13*Math.sin(i*2.3+toothPhase):1;
      const span=width*Math.sin(t*Math.PI)**.72*split;
      mid.push([x,y+span*.19,z]);
      left.push([x-sn*span,y-span*.17,z+cs*span]);const rightSpan=span*(toothed?1+.17*Math.sin(i*1.72+toothPhase):1);
      right.push([x+sn*rightSpan,y-rightSpan*.36,z-cs*rightSpan]);
      if(i) {
        quad(mid[i-1],mid[i],left[i],left[i-1],shades[0]);
        quad(right[i-1],right[i],mid[i],mid[i-1],shades[1]);
      }
    }
    line(left,shades[2]);line(right,shades[2]);line(mid,shades[2]);
    if(toothed) for(let i=5;i<steps-2;i+=4) {
      line([mid[i-2],left[i]],shades[1]);line([mid[i-1],right[i+1]],shades[1]);
    }
  }

  function palm(x,z,h,lean) {
    const spine=[],radii=[];
    for(let i=0;i<=11;i++) {
      const t=i/11;
      spine.push([x+lean*t*t,h*t,z+.18*Math.sin(Math.PI*t)]);
      radii.push(h*(.036-.014*t)*(1+.18*Math.cos(i*2)));
    }
    const rings=tube(spine,radii,['#b99973','#9c7c66','#79675b','#685258'],10);
    for(let i=1;i<rings.length-1;i++) line(rings[i].slice(2,8),'#796859');
    for(let i=0;i<12;i++) {
      const a=tau*i/12+random()*.21;
      const light=i%3===0;
      leafBlade(spine[11],a,h*(.35+random()*.29),h*(.09+random()*.18),h*.066,
        light?['#89a55c','#628e5b','#486850']:['#639668','#417c67','#365e54'],true);
    }
    finishAsset(x,z,h*.46);
  }

  function shrub(x,z,s,cool,{y=0,canopy=false,register=true}={}) {
    const first=vertices.length/3;
    const palette=cool?['#76a088','#5a836f','#476962','#374f53']:['#a1ae66','#7d9455','#576f50','#3e5752'];
    const lobes=canopy?5:11;
    for(let l=0;l<lobes;l++) {
      const a=l*2.39996, r=s*.5*Math.sqrt(l/(lobes-1));
      const cx=x+Math.cos(a)*r,cz=z+Math.sin(a)*r;
      const rh=s*(.25+random()*.20), h=s*(.38+random()*.40);
      const base=y+s*(.12+.32*(1-r/(s*.50)));
      const phase=random()*tau, rings=[], sectors=canopy?12:21,rows=canopy?5:7;
      function crown(ang,theta) {
        const bumps=.075*Math.cos(7*ang+phase+theta)+.044*Math.sin(11*ang-2*theta);
        const rad=rh*Math.cos(theta)*(1+bumps);
        return [cx+rad*Math.cos(ang),base+h*(Math.sin(theta)+.075*Math.cos(5*ang+phase)*Math.cos(theta)),cz+rad*Math.sin(ang)];
      }
      for(let k=0;k<=rows;k++) {
        const theta=-.92+k*(Math.PI/2+.92)/rows, ring=[];
        for(let j=0;j<sectors;j++)ring.push(crown(tau*j/sectors,theta));
        if(k) for(let j=0;j<sectors;j++) {
          const n=(j+1)%sectors, ang=tau*j/sectors;
          const value=.79*Math.sin(theta)+.39*Math.cos(ang+2.1)*Math.cos(theta)
            +.11*Math.cos(ang*6+phase)*Math.cos(theta);
          quad(rings[k-1][j],rings[k-1][n],ring[n],ring[j],palette[value>.77?0:value>.48?1:value>.11?2:3]);
        }
        rings.push(ring);
      }
      if(canopy){
        const low=[cx,base-h,cz];
        for(let i=0;i<sectors;i++)triangle(low,rings[0][i],rings[0][(i+1)%sectors],palette[3]);
      }
      // Small clusters sit on the lobe rather than floating as facing cards.
      for(let j=0;j<8;j++) {
        const angle=random()*tau, theta=.10+random(), cluster=[];
        for(let k=0;k<5;k++) {
          const p=crown(angle+k*.073,theta+.053*Math.sin(k*1.7));
          p[1]+=.012;cluster.push(p);
        }
        line(cluster,palette[j%4===0?0:2]);
        if(j%2===0){
          const light=palette[cool?0:1];
          const p=crown(angle+.11,theta+.07),q=crown(angle+.28,theta+.085),tip=crown(angle+.19,theta+.16);
          p[1]+=.017;q[1]+=.017;tip[1]+=.017;triangle(p,q,tip,light);
        }
      }
    }
    paintedRegions.push([first,vertices.length/3,cool?4:3]);
    if(register)finishAsset(x,z,s*.74);
  }
  function coral(x,z,s) {
    for(let i=0;i<8;i++) {
      const a=i*tau/8+random()*.5;
      const len=s*(.25+random()*.64),height=s*(.54+random()*.64);
      const cx=x+Math.cos(a)*len,cz=z+Math.sin(a)*len;
      const spike=tube([[x,0,z],[x+(cx-x)*.30,height*.26,z+(cz-z)*.30],
        [cx,height*.72,cz],[cx+.13*s*Math.cos(a),height,cz+.13*s*Math.sin(a)]],
        [.09*s,.12*s,.087*s,.004],['#ed96a0','#cd768e','#a05575','#79556d'],8);
      line(spike.slice(0,3).map(r=>r[3]),'#a66378');
    }
    finishAsset(x,z,s*.65);
  }

  mushroom(-8,-7.8,5.8,3.03,-.52,.7);
  mushroom(-10.7,-5.6,3.14,1.52,-.44,3.1);
  mushroom(-5.9,-9.8,4.36,2.22,.31,2.1);
  mushroom(-9.5,-9.95,6.05,1.93,.38,4.2);
  for(const [x,z,h,w,lean,arch] of [[1.14,-9.5,4.62,.68,1.06,.17],[2.80,-9.57,4.25,.62,1.60,.23],
    [4.62,-9.31,3.39,.57,1.42,.20],[6.15,-9.15,3.22,.52,1.62,.27],[7.84,-9.41,2.44,.46,1.61,.18],
    [9.04,-9.24,1.87,.37,1.15,.12]]) tusk(x,z,h,w,lean,arch);
  for(const [x,z,h,lean] of [[-11.8,-.8,3.2,.5],[-5,-12.3,3.4,-.3],
    [4.1,-11,3.4,.48],[10,-5.3,3.1,-.36],[11.1,1.9,3.8,.48],[-11.3,3.5,2.82,-.3]]) palm(x,z,h,lean);
  for(const [x,z,r] of [[-7,-5.1,1.29],[-11,-7.5,1.2],[7.3,-8.2,1.64],
    [10.1,-4.1,1.12],[-11.8,2,.94],[-4.6,-8.7,.9],[10.7,4,.78]]) coral(x,z,r);
  for(const [x,z,s] of [[-7,-7,2.1],[-11,-5.7,1.6],[-9.3,-4.9,1.5],[-6.1,-8,1.35],
    [-2.1,-7.1,.86],[.2,-7.15,.63],[3.85,-8.2,.92],[5.45,-10.0,1.36],[7.15,-9.4,.95],
    [9,-8.8,1.7],[10.3,-7.5,.66],[10.1,-5.8,1.37],[11.8,-3.5,.77],[11.3,1.3,1.3],[-11.5,1,1.4],
    [-12.3,-.3,1.3],[-11.6,4.1,.9],[-9.5,6,.65],[-5,8,.42],[6,8,.49],[-8.4,2.6,.51],[-7.9,2.95,.31],[-8.1,3.47,.27],[8.6,4.75,.58],[9.0,4.56,.31]]) {
    shrub(x,z,s,random()>.56);
  }
  for(const [x,z,s] of [[-6,-6,.95],[-11,-3,1.25],[9.5,-6,1.05],[-11.7,4.3,.82],[10.8,3.7,.76],[-3,-10,.9]]) {
    for(let i=0;i<10;i++) leafBlade([x,0,z],i*.65+random()*.24,s*(.45+random()*.58),
      s*(.55+random()*.53),s*.12,['#75b0a1','#538f89','#406f6c']);
    finishAsset(x,z,s*.68);
  }
  if(naturalForest){
    // Place trees on the unedited, versioned forest map; current tile state
    // controls visibility when forest is cleared or restored.
    const bark=['#a79b77','#877959','#665f4e','#514f48'];
    for(let row=4;row<60;row+=4)for(let col=4;col<60;col+=4){
      const rx=col+Math.floor(random()*3),ry=row+Math.floor(random()*3);
      if(naturalForest.base[ry*W+rx]!==T.FOREST)continue;
      const {x,z}=cellToWorld(rx,ry),height=1.45+random()*1.42;
      const dx=(random()-.5)*.47,dz=(random()-.5)*.39;
      const canopyY=height*.76;
      tube([[x,0,z],[x+dx*.38,height*.13,z+dz*.65],[x+dx*.56,height*.43,z+dz],
        [x+dx,height*.7,z+dz*.72],[x+dx*.65,height*.92,z+dz*.4]],
        [height*.107,height*.084,height*.063,height*.042,.018],bark,9,.13);
      const phase=random()*tau;
      for(let k=0;k<3;k++){
        const a=phase+k*tau/3,reach=height*(.16+random()*.12);
        const bx=x+dx+Math.cos(a)*reach,bz=z+dz+Math.sin(a)*reach;
        const by=canopyY+height*(random()*.19-.06);
        tube([[x+dx*.56,height*.43,z+dz],[x+dx+(bx-x-dx)*.51,by*.86,z+dz+(bz-z-dz)*.45],[bx,by+.19,bz]],
          [height*.058,height*.036,.012],bark,7);
        shrub(bx,bz,height*(.32+random()*.09),random()>.73,{y:by,canopy:true,register:false});
      }
      shrub(x+dx*.65,z+dz*.4,height*.40,false,{y:height*.91,canopy:true,register:false});
      finishAsset(x,z,height*.47,true);
    }
  }
  const root=new THREE.Group();
  root.name='Alien coast • botanical atlas';
  const surface=new THREE.BufferGeometry();
  surface.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  surface.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
  const regions=new Float32Array(vertices.length/3);
  for(const [start,end,kind] of paintedRegions)regions.fill(kind,start,end);
  surface.setAttribute('botanicalLayer',new THREE.BufferAttribute(regions,1));
  const paint=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,
    polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  paint.onBeforeCompile=shader=>{
    const varying='varying vec3 vBotanicalPosition; varying float vBotanicalLayer;';
    shader.vertexShader='attribute float botanicalLayer; '+varying+'\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n vBotanicalPosition=position; vBotanicalLayer=botanicalLayer;');
    shader.fragmentShader=varying+`
      float plantHash(vec3 p) {
        p=fract(p*.1031); p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);
      }
      float plantNoise(vec3 p) {
        vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(plantHash(i),plantHash(i+vec3(1,0,0)),f.x),
                       mix(plantHash(i+vec3(0,1,0)),plantHash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(plantHash(i+vec3(0,0,1)),plantHash(i+vec3(1,0,1)),f.x),
                       mix(plantHash(i+vec3(0,1,1)),plantHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec3 p=vBotanicalPosition;
      if(vBotanicalLayer>2.5){
        // Small overlapping patches form leaf masses across the underlying lobes.
        float leafy=plantNoise(p*8.5)+.34*plantNoise(p*22.0);
        float tuft=smoothstep(.72,.77,leafy);
        float tips=smoothstep(.84,.89,leafy);
        vec3 sunLeaf=vBotanicalLayer>3.5?vec3(.175,.343,.242):vec3(.343,.390,.132);
        float crownLight=smoothstep(.065,.23,dot(diffuseColor.rgb,vec3(.21,.72,.07)));
        diffuseColor.rgb=mix(diffuseColor.rgb,sunLeaf,tuft*(.095+.20*crownLight)+tips*(.13+.22*crownLight));
        diffuseColor.rgb*=mix(.77,1.0,smoothstep(.32,.44,leafy));
      }else if(vBotanicalLayer>1.5){
        float bloom=plantNoise(p*vec3(2.4,4.,3.4))+.24*plantNoise(p*7.8);
        diffuseColor.rgb*=1.0-.095*smoothstep(.69,.72,bloom)+.09*smoothstep(.85,.90,bloom);
      }else if(vBotanicalLayer>.5){
        float bark=plantNoise(p*vec3(12.,1.1,12.))+.19*plantNoise(p*vec3(22.,3.2,22.));
        diffuseColor.rgb*=.84+.16*smoothstep(.31,.43,bark)+.12*smoothstep(.77,.80,bark);
      }
    `);
  };
  const plantMesh=new THREE.Mesh(surface,paint);
  plantMesh.castShadow=true;
  root.add(plantMesh);
  const drawing=new THREE.BufferGeometry();
  drawing.setAttribute('position',new THREE.Float32BufferAttribute(strokes,3));
  drawing.setAttribute('color',new THREE.Float32BufferAttribute(inks,3));
  root.add(new THREE.LineSegments(drawing,new THREE.LineBasicMaterial({vertexColors:true})));
  scene.add(root);
  let lastHidden='';
  function visibility(geometry,key,hidden) {
    let index=geometry.index;
    if(!index){
      index=new THREE.BufferAttribute(new Uint32Array(geometry.attributes.position.count),1);
      index.setUsage(THREE.DynamicDrawUsage);geometry.setIndex(index);
    }
    let count=0;
    assets.forEach((asset,i)=>{
      if(hidden[i])return;
      for(let k=asset[key][0];k<asset[key][1];k++)index.array[count++]=k;
    });
    index.clearUpdateRanges();if(count)index.addUpdateRange(0,count);
    index.needsUpdate=true;geometry.setDrawRange(0,count);
  }
  return {sync(grid,facilities=[]){
    const busy=new Set(grid.sites.map(site=>site.y*W+site.x));
    for(const facility of facilities){
      const box=facilityRect(facility);if(!box)continue;
      for(let y=box.y;y<box.y+box.h;y++)for(let x=box.x;x<box.x+box.w;x++)if(inBounds(x,y))busy.add(y*W+x);
    }
    const hidden=assets.map(asset=>grid.base[asset.anchor]<T.SAND||(asset.forestOnly&&grid.base[asset.anchor]!==T.FOREST)||asset.cells.some(i=>grid.occ[i]||grid.road[i]||busy.has(i)));
    const mask=hidden.map((v,i)=>v?i:'').join(',');
    if(mask===lastHidden||(!lastHidden&&!hidden.some(Boolean)))return;
    lastHidden=mask;
    visibility(surface,'faces',hidden);visibility(drawing,'ink',hidden);
  },dispose(){
    root.removeFromParent();surface.dispose();drawing.dispose();paint.dispose();root.children[1].material.dispose();
  }};
}
