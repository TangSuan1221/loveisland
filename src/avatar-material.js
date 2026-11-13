import * as THREE from 'three';
import {MeshBasicNodeMaterial} from 'three/webgpu';
import {uniform,normalWorldGeometry,normalLocal,positionLocal,vec3,mix,step,attribute} from 'three/tsl';

// Deliberately graphic lighting: a stable painted palette and two/three value
// groups, rather than a shiny toy's continuous PBR gradient.
export function createCartoonMaterial(value,{style='drama',basic=false,surface='default'}={}) {
  const material=new MeshBasicNodeMaterial({color:value});
  material.toneMapped=false;
  const base=uniform(material.color);
  if(basic){material.colorNode=base;return material;}
  const light=normalWorldGeometry.dot(vec3(-.55,.72,1).normalize());
  if(style==='anime'){
    // Keep the illustrated facial plane clear; retain directional shading only
    // near its perimeter. Original sphere depth follows the authored jaw without
    // moving the skin, facial features, or shared body/hair materials.
    const lit=surface==='face'
      ?step(.10,light).max(step(.32,attribute('faceSourceDepth','float')))
      :step(.10,light);
    material.colorNode=mix(base.mul(vec3(.88,.84,.86)),base,lit);
    if(surface==='face'){material.userData.cartoonSurface='face';material.userData.faceFrontLitDepth=.32;}
  }else if(style==='satire') {
    material.colorNode=mix(base.mul(vec3(.77,.74,.70)),base,step(.18,light));
  }else if(style==='organic'){
    const dark=base.mul(vec3(.54,.62,.51));
    material.colorNode=mix(dark,base,step(.28,light));
  }else{
    const dark=base.mul(vec3(.53,.58,.69));
    material.colorNode=mix(dark,base,step(.30,light));
  }
  material.userData.cartoonStyle=style;
  return material;
}

// Inverted hulls only for deliberately chosen large silhouettes. Compensating
// for local scaling keeps a thin, consistent line on tapered anatomy/clothes.
export function addCartoonOutline(mesh,resources,style='drama',width=.0022) {
  width*=style==='anime'?1.1:style==='satire'?1.9:style==='organic'?1.45:1.65;
  const material=new MeshBasicNodeMaterial({color:style==='organic'?'#303c35':style==='satire'?'#242325':'#2a2930',side:THREE.BackSide});
  material.toneMapped=false;
  material.positionNode=positionLocal.add(normalLocal.mul(vec3(
    width/Math.max(.001,Math.abs(mesh.scale.x)),
    width/Math.max(.001,Math.abs(mesh.scale.y)),
    width/Math.max(.001,Math.abs(mesh.scale.z))
  )));
  const outline=new THREE.Mesh(mesh.geometry,material);
  outline.name='ink-contour';outline.castShadow=false;outline.receiveShadow=false;
  outline.userData.isOutline=true;outline.raycast=()=>{};
  resources.material.add(material);mesh.add(outline);
  return outline;
}
