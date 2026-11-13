// Flat-set grid routing. Fixed island scenery remains outside the construction area.
export const FOOTPRINT={water:1.25,table:1.8,tent:1.9,cabin:2.2,fire:1.45,interview:1.5,camera:.55,privacy:1.4,heater:1};
const FIXED=[[-3.1,-1.9,.35],[3.1,-1.9,.35],[-5.6,-6.8,.3],[5.6,-6.8,.3]];
export function createNavigation(facilities=[]){
  const obstacles=[...FIXED.map(([x,z,r])=>({x,z,r})),...facilities.map(f=>({x:f.x,z:f.z,r:FOOTPRINT[f.type]||1}))];
  const clear=(x,z,padding=.3)=>x>=-8.5&&x<=11&&z>=-10.5&&z<=14&&!obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+padding);
  const cell=p=>({x:Math.round(p.x),z:Math.round(p.z)}),key=p=>`${p.x},${p.z}`;
  function nearest(p){let best=null,d=Infinity;for(let x=-8;x<=11;x++)for(let z=-10;z<=14;z++){if(!clear(x,z))continue;const dd=Math.hypot(p.x-x,p.z-z);if(dd<d){d=dd;best={x,z};}}return best;}
  function path(from,to){
    const start=nearest(from),goal=nearest(to);if(!start||!goal)return[];
    const open=[start],came=new Map(),scores=new Map([[key(start),0]]),seen=new Map([[key(start),start]]);
    const heuristic=p=>Math.abs(p.x-goal.x)+Math.abs(p.z-goal.z);
    while(open.length){open.sort((a,b)=>(scores.get(key(a))+heuristic(a))-(scores.get(key(b))+heuristic(b)));const p=open.shift(),pk=key(p);if(pk===key(goal)){const route=[];for(let k=pk;k;k=came.get(k))route.unshift(seen.get(k));if(clear(to.x,to.z,.2))route.push({x:to.x,z:to.z});return route;}
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const q={x:p.x+dx,z:p.z+dz};if(!clear(q.x,q.z))continue;const k=key(q),score=scores.get(pk)+1;if(score<(scores.get(k)??Infinity)){scores.set(k,score);came.set(k,pk);seen.set(k,q);if(!open.some(n=>key(n)===k))open.push(q);}}
    }return[];
  }
  function servicePoint(f){const radius=(FOOTPRINT[f.type]||1)+.65;for(const [dx,dz]of [[0,1],[1,0],[-1,0],[0,-1]]){const p={x:f.x+dx*radius,z:f.z+dz*radius};if(clear(p.x,p.z))return p;}return nearest({x:f.x,z:f.z+radius});}
  function placement(type,x,z,ignoreId){if(!Number.isFinite(x)||!Number.isFinite(z)||x< -7.5||x>9||z< -9||z>10)return{ok:false,message:'请放在标出的平坦营地区域内'};const radius=FOOTPRINT[type]||1;
    if(facilities.some(f=>f.id!==ignoreId&&Math.hypot(x-f.x,z-f.z)<radius+(FOOTPRINT[f.type]||1)+.6)||FIXED.some(([a,b,r])=>Math.hypot(x-a,z-b)<radius+r+.4))return{ok:false,message:'设施之间要留出入口和通路'};
    if(Math.abs(z+5.3)<.8&&Math.abs(x)>5)return{ok:false,message:'这里有固定围栏，请换一处'};
    const next=facilities.filter(f=>f.id!==ignoreId).concat({id:'preview',type,x,z}),nav=createNavigation(next);
    if(next.some(f=>{const p=nav.servicePoint(f);return!p||!nav.path({x:0,z:2},p).length;}))return{ok:false,message:'这个布局会阻断设施通路'};
    return{ok:true,message:'点击地面确认建设'};
  }
  return{path,clear,nearest,servicePoint,placement,obstacles};
}
