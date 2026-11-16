import {baseReview} from '../src/base-motion.js';
import {portraitActor} from '../src/characters.js';
import {Vector3,Matrix4} from 'three';
for(const name of ['lin','zhou','qiao']){
 const a=portraitActor(name),skin=a._head.getObjectByName('face-skin'),v=new Vector3(),extent=new Vector3(),center=new Vector3();
 skin.geometry.computeBoundingBox();skin.geometry.boundingBox.getCenter(center);skin.geometry.boundingBox.getSize(extent).multiplyScalar(.5);
 const toFace=new Matrix4(),inv=new Matrix4();
 let min=Infinity,where;
 for(let f=0;f<=180;f++){baseReview.sample(a,'BP040',f/30);a.mesh.updateMatrixWorld(true);inv.copy(skin.matrixWorld).invert();
 for(let l of a._rig.limbs)for(let root of [l.hand,l.oldArm])root.traverse(m=>{
  if(!m.isMesh||m.userData.isOutline)return;toFace.multiplyMatrices(inv,m.matrixWorld);
  for(let i=0;i<m.geometry.attributes.position.count;i++){m.getVertexPosition(i,v).applyMatrix4(toFace).sub(center).divide(extent);
   if(v.length()<min){min=v.length();where=[f,m.name];}
  }
 });}
 console.log(name,min,where);if(min<1)process.exitCode=1;
}
