import {catalog,catalogFor,editCamp,makeGrid,newCamp} from '../camp/model.js';
import {CELL_SIZE,worldToCell,cellToWorld} from '../camp/footprints.js';
import {idx,inBounds,sizeOf} from '../camp/grid.js';
import {isCampWinter} from '../camp/day.js';

export {CELL_SIZE,worldToCell,cellToWorld};
const kinds=new Map(catalog.map(d=>[d.id,d]));
export function placementBounds(kind,x,y,rot=0){
  const def=typeof kind==='string'?kinds.get(kind):kind;
  if(!def)return null;
  const {w,h}=sizeOf(def.w,def.h,rot);
  return {...cellToWorld(x+(w-1)/2,y+(h-1)/2),width:w*CELL_SIZE,depth:h*CELL_SIZE,w,h};
}
export function createLiveGrid({getState,dispatch}){
  let cachedGrid,lastKey;
  function snapshot(){
    const state=getState(),camp=state.camp||newCamp(),day=state.businessDay||camp.day||1;
    const key=JSON.stringify([day,camp.mapVersion,camp.version,camp.placed,camp.tiles]);
    if(key!==lastKey){cachedGrid=makeGrid(camp,day);lastKey=key;}
    return {state,camp,day,grid:cachedGrid,catalog:catalogFor(camp),facilities:state.facilities||[]};
  }
  const payload=({kind,x,y,rot=0,id})=>id===undefined||id===null?{op:'place',kind,x,y,rot}:{op:'move',id,x,y,rot};
  function preview(input){
    const {state,camp,day,facilities}=snapshot();
    if(state.selectedMap!=='island'||(!state.buildWindow&&state.phase!=='recording')||state.speed>=16)
      return {ok:false,code:'LOCKED',message:'当前无法编辑营地。'};
    return editCamp(structuredClone(camp),day,payload(input),{
      facilities,cast:state.cast?.filter(id=>!['left','medical'].includes(state.status?.[id])),winter:isCampWinter(day)
    });
  }
  const command=p=>dispatch('campEdit',p);
  function at(x,y){
    if(!Number.isInteger(x)||!Number.isInteger(y)||!inBounds(x,y))return null;
    const {camp,grid}=snapshot(),id=grid.occ[idx(x,y)];
    return camp.placed.find(s=>s.id===id)||null;
  }
  return {snapshot,at,preview,place:p=>command(payload(p)),command};
}
