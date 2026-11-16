export const campfireEffectName='Campfire / combustion';
const cycle=value=>value-Math.floor(value);
const bindings=new WeakMap();

function flameGeometry(T){
  const rings=[[0,.56,'#fff18a'],[.16,1,'#ffd052'],[.44,.67,'#ff972e'],[.68,.33,'#f36125'],[.85,.16,'#ed5122'],[1,0,'#ffab3c']];
  const xyz=[],colors=[],indices=[],sides=9;
  for(const [y,r,tone] of rings){
    for(let i=0;i<sides;i++){
      const a=i*2*Math.PI/sides;
      const bend=.33*Math.sin(y*5.2)*y+.24*y*y;
      const width=r*(1+.09*Math.sin(3*a+y));
      xyz.push(bend+Math.cos(a)*width,y,Math.sin(a)*width);
      const c=new T.Color(tone);
      c.multiplyScalar(.92+.08*Math.cos(a));
      colors.push(c.r,c.g,c.b);
    }
  }
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<sides;i++){
    const a=j*sides+i,b=j*sides+(i+1)%sides;
    indices.push(a,a+sides,b,b,a+sides,b+sides);
  }
  const mesh=new T.BufferGeometry();
  mesh.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
  mesh.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  mesh.setIndex(indices);mesh.computeVertexNormals();
  return mesh;
}

export function makeCampfire(T){
  const effect=new T.Group();effect.name=campfireEffectName;
  const shape=flameGeometry(T);
  const paint=new T.MeshBasicMaterial({vertexColors:true,toneMapped:false,side:T.DoubleSide});
  for(let i=0;i<3;i++){
    const tongue=new T.Mesh(shape,paint);
    tongue.name='Flame '+i;
    effect.add(tongue);
  }
  const fleck=new T.OctahedronGeometry(1,0);
  const sparks=new T.InstancedMesh(fleck,new T.MeshBasicMaterial({color:'#ffba4b',toneMapped:false}),6);
  sparks.name='Embers';sparks.frustumCulled=false;
  sparks.instanceMatrix.setUsage(T.DynamicDrawUsage);effect.add(sparks);
  const smoke=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),
    new T.MeshBasicMaterial({color:'#82788b',transparent:true,opacity:.25,depthWrite:false,toneMapped:false}),3);
  smoke.name='Smoke';smoke.frustumCulled=false;
  smoke.instanceMatrix.setUsage(T.DynamicDrawUsage);effect.add(smoke);
  updateCampfire(effect,0);
  return effect;
}

export function updateCampfire(root,seconds){
  let binding=bindings.get(root);
  if(binding===undefined){
    const effect=root.name===campfireEffectName?root:root.getObjectByName(campfireEffectName);
    binding=effect?{
      effect,tongues:effect.children.slice(0,3),sparks:effect.getObjectByName('Embers'),
      smoke:effect.getObjectByName('Smoke'),transform:effect.clone(false)
    }:null;
    bindings.set(root,binding);
  }
  if(!binding)return;
  const {tongues,sparks,smoke,transform}=binding;
  const t=seconds+root.position.x*.23+root.position.z*.17;
  for(let i=0;i<tongues.length;i++){
    const a=i*2.399;
    const h=(i===0?1.08:.70+.13*i)*(1+.13*Math.sin(t*4.6+a)+.055*Math.sin(t*8.1-a));
    const radius=(i===0?.26:.19)*(1+.10*Math.cos(t*4.6+a));
    const tongue=tongues[i];
    tongue.position.set(i===0?0:.21*Math.cos(a),.045,i===0?0:.20*Math.sin(a));
    tongue.scale.set(radius,h,radius*.90);
    tongue.rotation.set(.075*Math.cos(t*3.2+a),a+.3*Math.sin(t*1.7+a),.14*Math.sin(t*3.1+a));
  }
  for(let i=0;i<sparks.count;i++){
    const life=cycle(t*(.52+i*.031)+i*.618),a=i*2.4;
    const size=.038*Math.sin(Math.PI*life);
    transform.position.set(.19*Math.cos(a)+.32*life*life+.07*Math.sin(a+life*7),.30+1.5*life,.17*Math.sin(a)+.08*Math.cos(life*6+a));
    transform.scale.set(size,size*1.6,size);transform.rotation.set(a,life*3,life);
    transform.updateMatrix();sparks.setMatrixAt(i,transform.matrix);
  }
  sparks.instanceMatrix.needsUpdate=true;
  for(let i=0;i<smoke.count;i++){
    const life=cycle(t*.27+i/3),a=i*2.4;
    const size=(.12+.21*life)*Math.pow(Math.sin(Math.PI*life),.7);
    transform.position.set(.09*Math.sin(a+life*6)+.49*life*life,1.0+1.13*life,.09*Math.cos(a+life*5));
    transform.scale.set(size,size*.71,size*.87);transform.rotation.set(.3,life*1.6+a,.21);
    transform.updateMatrix();smoke.setMatrixAt(i,transform.matrix);
  }
  smoke.instanceMatrix.needsUpdate=true;
}
