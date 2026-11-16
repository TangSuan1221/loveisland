import {clone} from 'three/addons/utils/SkeletonUtils.js';

// Each scene places its own copy. All skin and ink meshes sharing a palette
// on the source must follow the same bones in the destination scene.
export function cloneActorView(source,{watchAttachments=false}={}){
  const copy=clone(source);
  const palettes=new Map();
  const watched=[];
  let attachmentsChanged=false;
  function invalidate(){attachmentsChanged=true;}
  function share(original,node){
    if(watchAttachments){
      watched.push(original);
      original.addEventListener('childadded',invalidate);
      original.addEventListener('childremoved',invalidate);
    }
    if(original.isSkinnedMesh){
      const palette=palettes.get(original.skeleton);
      if(palette){
        node.skeleton.dispose();
        node.skeleton=palette;
      }else palettes.set(original.skeleton,node.skeleton);
    }
    original.children.forEach((child,i)=>share(child,node.children[i]));
  }
  share(source,copy);
  return {copy,get attachmentsChanged(){return attachmentsChanged;},dispose(){
    for(const node of watched){
      node.removeEventListener('childadded',invalidate);
      node.removeEventListener('childremoved',invalidate);
    }
    watched.length=0;
    copy.removeFromParent();
    for(const palette of palettes.values())palette.dispose();
    palettes.clear();
  }};
}
