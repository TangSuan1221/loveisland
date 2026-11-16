import {W,H,T,inBounds} from '../camp/grid.js';
import {worldToCell,cellToWorld,CELL_SIZE} from '../camp/footprints.js';

// Short mineral-white wavelets approach the real shoreline. All positions and
// fade phases reuse their typed buffers; only terrain edits re-survey the coast.
export function createShoreRipples(THREE,root) {
  const parts=[];
  const phases=3,segments=8;
  for(let phase=0;phase<phases;phase++){
    const mesh=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({
      color:'#d5f1df',transparent:true,depthWrite:false,opacity:0
    }));
    mesh.name='Approaching shore wavelets '+phase;
    root.add(mesh);parts.push({mesh,bands:[],output:null});
  }
  let previous=-1;
  function sync(grid){
    const water=(x,y)=>{
      if(!inBounds(x,y))return true;
      return grid.base[y*W+x]===T.DEEP||grid.base[y*W+x]===T.SHALLOW;
    };
    const wetWorld=(x,z)=>{const c=worldToCell(x,z);return water(c.x,c.y);};
    let seed=95877;
    const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const candidates=[];
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
      if(!water(x,y))continue;
      if([[1,0],[0,1],[-1,0],[0,-1]].every(([a,b])=>water(x+a,y+b)))continue;
      let dx=0,dz=0;
      for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++)if(!water(x+i,y+j)){
        const d=i*i+j*j;dx-=i/d;dz-=j/d;
      }
      const norm=Math.hypot(dx,dz);if(norm<.1)continue;
      const p=cellToWorld(x,y);
      candidates.push({...p,dx:dx/norm,dz:dz/norm,order:random()});
    }
    candidates.sort((a,b)=>a.order-b.order);
    const chosen=[];
    parts.forEach(part=>part.bands=[]);
    for(const p of candidates){
      if(chosen.some(q=>(p.x-q.x)**2+(p.z-q.z)**2<3.9))continue;
      const width=CELL_SIZE*(.65+random()*.92);
      const progress=CELL_SIZE*(.24+random()*.28);
      const tx=-p.dz,tz=p.dx;
      const left=random()*.08-.04;
      const fits=[-.50,-.25,0,.25,.50].every(t=>[-.12,progress+.10].every(out=>
        wetWorld(p.x+t*width*tx+out*p.dx,p.z+t*width*tz+out*p.dz)));
      if(!fits)continue;
      chosen.push(p);
      parts[chosen.length%phases].bands.push({...p,width,progress,tx,tz,left});
    }
    for(const part of parts){
      const count=part.bands.length*segments*2;
      part.mesh.geometry.dispose();part.mesh.geometry=new THREE.BufferGeometry();
      part.output=new THREE.Float32BufferAttribute(new Float32Array(count*3),3);
      part.output.setUsage(THREE.DynamicDrawUsage);
      part.mesh.geometry.setAttribute('position',part.output);
      // All frames remain inside the survey bounds, including the raised foam.
      part.mesh.geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),W*CELL_SIZE*.75);
    }
    previous=-1;update(0);
  }
  function update(time){
    const frame=Math.floor(time*18);if(previous===frame)return;previous=frame;
    for(let i=0;i<phases;i++){
      const part=parts[i];if(!part.output)continue;
      const phase=(time*.113+i/phases+.13)%1;
      const swell=Math.sin(phase*Math.PI);
      part.mesh.material.opacity=.04+.51*swell*swell;
      const out=1-phase, spread=.53+.43*swell;
      let k=0;
      for(const band of part.bands){
        for(let j=0;j<segments;j++)for(let end=0;end<2;end++){
          const f=(j+end)/segments-.5;
          const curve=.11*(1-4*f*f)+Math.sin((f+.5)*6.28+band.left*24)*.016;
          const offshore=out*band.progress+curve-.08;
          const lateral=(f+band.left)*band.width*spread;
          part.output.setXYZ(k++,band.x+band.dx*offshore+band.tx*lateral,-.014,band.z+band.dz*offshore+band.tz*lateral);
        }
      }
      part.output.needsUpdate=true;
    }
  }
  return {sync,update};
}
