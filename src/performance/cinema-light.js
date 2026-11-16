import {BufferGeometry,Color,Float32BufferAttribute,Points,PointsMaterial} from 'three';

// Appearance of the recorded shot; all values mix into the actual map lighting.
// A neutral scene keeps its existing weather and time-of-day cues.
const looks={
  'mutual-feeling':    ['#ffc783','#f8d3a9',.38,.27, .52],
  'feelings-declined': ['#cfdef2','#ccd7e3',.20,.21,-.12],
  reconciled:          ['#ffdfb1','#f1d8ae',.24,.10, .20],
  unresolved:          ['#c3cad9','#b9c9cd',.28,.17,-.28],
  disagreed:           ['#fff4d3','#bcb8b0',.13,.09, .32],
  connected:           ['#fff1b3','#cae7dd',.22,.09, .19],
  allied:              ['#ffdc91','#f7deb3',.28,.12, .31],
  'alliance-declined': ['#cce0ee','#d0d6d4',.18,.16,-.22],
  'boundary-respected':['#ebf0db','#e3e8d7',.10,.07, .08],
  'boundary-disagreed':['#e4d2c2','#cbcdcb',.18,.08, .19],
  clarified:           ['#ffe3c4','#dcd5c6',.27,.13, .16],
  'created-together':  ['#ffe99d','#f7e8bd',.28,.13, .33],
  'queue-apology':     ['#ffe1bc','#d8ddcf',.16,.07, .12],
  'queue-yield':       ['#f2f8e1','#e2eade',.12,.08, .22],
  'queue-argue':       ['#fff2c4','#e4d3b5',.21,.13, .40],
  'queue-avoid':       ['#dbdbe9','#bfcbd5',.24,.19,-.18],
  'water-shared':      ['#e2f8ff','#bddfd8',.25,.09, .20],
  supported:           ['#ffd2ac','#e8c9b3',.32,.15,-.16],
  S_homeless:          ['#b2c4f4','#8897ac',.44,.38,-.47],
};
// Key, hemisphere sky and ground, horizon, and the strength of moon/fill.
const nights={
  S07_winter_night_share:['#c5d9ff','#a0b4ea','#687b94','#344364',.85,.68],
  S16_night_watch:['#9fbce7','#819dc8','#626d84','#202d49',.75,.58],
  S22_night_talk:['#e7c3b0','#abb6e1','#836d75','#37344f',.85,.70],
  S69_watch_stars:['#bfcbff','#a1afe5','#655e80','#1d2341',.75,.64],
  S_homeless:['#b7c7eb','#a0aecb','#716c76','#3a4154',.80,.64],
};

function moonlight(scene,night,stars) {
  const [moon,ambient,ground,horizon,keyPower,fillPower]=night;
  const background=scene.background,fog=scene.fog?.color,priorFog=fog?.clone();
  const restore=[];
  scene.background=new Color(horizon);
  fog?.set(horizon);
  const seen=new Set(),tint=new Color('#b6c4e7');
  scene.traverse(node=>{
    if(node.isDirectionalLight||node.isHemisphereLight){
      const color=node.color.clone(),power=node.intensity,earth=node.groundColor?.clone();
      node.color.set(node.isDirectionalLight?moon:ambient);
      node.intensity=node.isDirectionalLight?keyPower:fillPower;
      node.groundColor?.set(ground);
      restore.push(()=>{node.color.copy(color);node.intensity=power;if(earth)node.groundColor.copy(earth);});
    }
    // Surf lines and the characters' graphic face materials ignore scene lights.
    for(const mat of [].concat(node.material||[])){
      if(seen.has(mat)||!mat.color||!(mat.isMeshBasicMaterial||mat.isMeshBasicNodeMaterial))continue;
      seen.add(mat);
      const original=mat.color.clone();
      mat.color.multiply(tint);
      restore.push(()=>mat.color.copy(original));
    }
  });
  if(stars){
    const vertices=[];
    for(let i=0;i<370;i++){
      const y=(i+.5)/370,angle=i*2.399963,r=Math.sqrt(1-y*y);
      vertices.push(100*r*Math.cos(angle),100*y,100*r*Math.sin(angle));
    }
    const geo=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(vertices,3));
    const mat=new PointsMaterial({color:'#d5d9ef',size:.19,fog:false,depthWrite:false});
    const field=new Points(geo,mat);scene.add(field);
    restore.push(()=>{scene.remove(field);geo.dispose();mat.dispose();});
  }
  return ()=>{
    scene.background=background;
    if(fog)fog.copy(priorFog);
    for(const undo of restore)undo();
  };
}
export function nightLook(event){return [event.performanceKey,event.sceneId,event.type].find(id=>Object.hasOwn(nights,id));}
export function lightRecording(scene,event){
  const keys=[event.performanceKey,event.sceneId,event.type];
  const night=nightLook(event);
  if(night)return moonlight(scene,nights[night],night==='S69_watch_stars');
  const look=looks[keys.find(id=>Object.hasOwn(looks,id))];
  if(!look)return;
  const key=scene.children.find(o=>o.isDirectionalLight);
  const sky=scene.background?.isColor?scene.background:null;
  const fog=scene.fog?.color;
  const priorKey=key?.color.clone(), priorPower=key?.intensity;
  const priorSky=sky?.clone(), priorFog=fog?.clone();
  const [keyTint,airTint,keyMix,airMix,exposure]=look;
  if(key){key.color.lerp(new Color(keyTint),keyMix);key.intensity*=1+exposure;}
  const air=new Color(airTint);
  sky?.lerp(air,airMix);fog?.lerp(air,airMix);
  return ()=>{
    if(key){key.color.copy(priorKey);key.intensity=priorPower;}
    if(sky)sky.copy(priorSky);
    if(fog)fog.copy(priorFog);
  };
}
