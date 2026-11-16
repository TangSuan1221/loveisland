import {facilityRect,landmarkAt} from './footprints.js';
import {makeGrid} from './model.js';
import {idx,inBounds} from './grid.js';
const tile=v=>Math.round(v/.75+32);
const world=(x,y)=>({x:(x-32)*.75,z:(y-32)*.75});
const dirs=[[0,1],[1,0],[0,-1],[-1,0]];
export function campNavigation(c,legacy,facilities){
  const g=makeGrid(c,c.day);
  const occupied=facilities?.map(facilityRect).filter(Boolean);
  const valid=(x,y)=>{
    if(!inBounds(x,y)||!g.isWalkable(x,y)||(c.islandArtGrid&&landmarkAt(x,y)))return false;
    if(occupied)return !occupied.some(r=>x>=r.x&&y>=r.y&&x<r.x+r.w&&y<r.y+r.h);
    return !legacy.obstacles.some(o=>Math.hypot((x-32)*.75-o.x,(y-32)*.75-o.z)<o.r+.18);
  };
  const pass=new Uint8Array(4096);
  for(let i=0;i<4096;i++)pass[i]=Number(valid(i%64,i>>6));
  // Sweep the NPC's square footprint against every blocked tile along the step.
  function canStep(from,x,z,padding=.22){
    const half=.375+padding,dx=x-from.x,dz=z-from.z;
    const minX=tile(Math.min(from.x,x)-padding),maxX=tile(Math.max(from.x,x)+padding);
    const minY=tile(Math.min(from.z,z)-padding),maxY=tile(Math.max(from.z,z)+padding);
    for(let y=minY;y<=maxY;y++)for(let a=minX;a<=maxX;a++){
      if(inBounds(a,y)&&pass[idx(a,y)])continue;
      const center=world(a,y);
      let enter=0,exit=1;
      for(const [offset,delta] of [[from.x-center.x,dx],[from.z-center.z,dz]]){
        if(delta===0){
          if(Math.abs(offset)>half){exit=-1;break;}
        }else{
          const lo=(-half-offset)/delta,hi=(half-offset)/delta;
          enter=Math.max(enter,Math.min(lo,hi));
          exit=Math.min(exit,Math.max(lo,hi));
        }
      }
      if(enter<=exit)return false;
    }
    return true;
  }
  function clear(x,z,padding=.22){return canStep({x,z},x,z,padding);}
  function nearest(p){
    if(clear(p.x,p.z))return {...p};
    let best=null,min=Infinity;
    for(let i=0;i<4096;i++)if(pass[i]){const q=world(i%64,i>>6),d=(q.x-p.x)**2+(q.z-p.z)**2;if(d<min){min=d;best=q;}}
    return best;
  }
  let origin=-1,field=null,parents=null;
  function path(from,to){
    const end=nearest(to);if(!end||!Number.isFinite(travelCost(from,end)))return [];
    const route=[end];for(let i=idx(tile(end.x),tile(end.z));i!==origin;i=parents[i])route.push(world(i%64,i>>6));
    route.push(world(origin%64,origin>>6));return route.reverse();
  }
  function travelCost(from,to){
    const p=nearest(from);if(!p)return Infinity;
    const start=idx(tile(p.x),tile(p.z));
    if(start!==origin){
      origin=start;parents=new Int32Array(4096).fill(-1);field=new Int32Array(4096).fill(-1);
      const buckets=Array.from({length:9},()=>[]);field[start]=0;buckets[0].push(start);let pending=1,d=0;
      while(pending){
        while(!buckets[d%9].length)d++;
        const i=buckets[d%9].pop();pending--;if(field[i]!==d)continue;
        for(const [dx,dy] of dirs){const x=i%64+dx,y=(i>>6)+dy,j=idx(x,y);if(!inBounds(x,y)||!pass[j])continue;
          const n=d+g.moveCost(x,y);if(field[j]>=0&&field[j]<=n)continue;
          parents[j]=i;field[j]=n;buckets[n%9].push(j);pending++;
        }
      }
    }
    const x=tile(to.x),y=tile(to.z);if(!inBounds(x,y))return Infinity;const n=field[idx(x,y)];return n<0?Infinity:n;
  }
  function detour(from,to,actors){
    const start=nearest(from);
    if(!start||!clear(to.x,to.z))return [];
    const first=idx(tile(start.x),tile(start.z)),last=idx(tile(to.x),tile(to.z));
    const blocked=new Set(actors.map(a=>idx(tile(a.x),tile(a.z))));
    if(blocked.has(last))return [];
    const parent=new Int32Array(pass.length).fill(-1),queue=[first];
    parent[first]=first;
    for(let head=0;head<queue.length&&parent[last]<0;head++){
      const cell=queue[head];
      for(const [dx,dy] of dirs){
        const x=cell%64+dx,y=(cell>>6)+dy,j=idx(x,y);
        if(!inBounds(x,y)||!pass[j]||parent[j]>=0||blocked.has(j))continue;
        parent[j]=cell;queue.push(j);
      }
    }
    if(parent[last]<0)return [];
    const result=[to];
    for(let j=last;j!==first;j=parent[j])result.push(world(j%64,j>>6));
    result.push(world(first%64,first>>6));return result.reverse();
  }
  function servicePoint(f){
    const building=g.structs.find(s=>'camp-'+s.id===f.id);
    if(!building)return nearest(legacy.servicePoint(f)||f);
    const door=g.doors(building.kind,building.x,building.y,building.rot).access;
    return nearest(world(door.x,door.y));
  }
  return {canStep,clear,path,detour,nearest,servicePoint,travelCost,obstacles:legacy.obstacles};
}


