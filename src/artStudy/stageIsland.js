import {createResourceSites} from './resourceSites.js';
import * as THREE from 'three';
import {buildLiveGround} from './liveGround.js';
import {addHorizon} from './horizon.js';
import {buildFlora} from './flora.js';
import {addGrazers} from './fauna.js';
import {updateCampfire} from './campfire.js';
import {createLiveBuilding} from './liveBuildings.js';
import {makeGrid,newCamp} from '../camp/model.js';
import {placementBounds,CELL_SIZE} from './liveGrid.js';

// Recording uses the same set and exact survey coordinates as the build view.
// The production actors and furniture use a pre-existing .49 m stage datum.
export function createIslandStage(island,camera,controls){
 const stage=island.group;
 stage.clear();
 stage.position.y=.49;
 const alignHorizon=addHorizon(stage);
 let foliage,habitatVersion;
 const fauna=addGrazers(stage);
 const gathering=createResourceSites(stage);
 const ground=buildLiveGround(THREE,stage,makeGrid(newCamp(),1));
 const buildings=new THREE.Group();
 stage.add(buildings);
 const objects=new Map();
 let lastGrid='',lastFootprints='',t=0;
 let grid=makeGrid(newCamp(),1);
 island.update=()=>alignHorizon(camera,controls.target);
 return {
  sync(camp,active,facilities=[]){
   if(!active||!camp)return;
   const mapVersion=camp.mapVersion||1;
   if(habitatVersion!==mapVersion){
     foliage?.dispose();const naturalForest=makeGrid({...newCamp(),mapVersion},1);
     foliage=buildFlora(THREE,stage,{naturalForest});habitatVersion=mapVersion;
   }
   const gridSignature=JSON.stringify([mapVersion,camp.tiles,camp.placed.map(b=>[b.id,b.kind,b.x,b.y,b.rot])]);
   const footprints=JSON.stringify(facilities.map(f=>[f.type,f.x,f.z,f.rot]));
   if(gridSignature!==lastGrid||footprints!==lastFootprints){
     if(gridSignature!==lastGrid){grid=makeGrid(camp,camp.day||1);ground.sync(grid);}
     gathering.sync(grid);foliage.sync(grid,facilities);fauna.sync(grid,facilities);
     lastGrid=gridSignature;lastFootprints=footprints;
   }
   const owned=new Set();
   for(const st of camp.placed){
    const def=grid.kinds.get(st.kind);if(!def)continue;
    owned.add(st.id);
    let obj=objects.get(st.id);
    const stamp=st.kind+'|'+def.w+'|'+def.h;
    if(obj?.userData.footprintKey!==stamp){
     obj?.removeFromParent();
     obj=createLiveBuilding(THREE,st.kind,def.w*CELL_SIZE,def.h*CELL_SIZE);
     obj.userData.footprintKey=stamp;buildings.add(obj);objects.set(st.id,obj);
    }
    const pos=placementBounds(def,st.x,st.y,st.rot);
    obj.position.set(pos.x,0,pos.z);obj.rotation.y=-st.rot*Math.PI/2;
   }
   for(const [id,obj] of objects)if(!owned.has(id)){obj.removeFromParent();objects.delete(id);}
  },
  update(dt){t+=dt;ground.update(t);for(const obj of objects.values())updateCampfire(obj,t);}
 };
}
