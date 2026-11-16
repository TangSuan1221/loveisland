// Runs inside a browser page so PNG decode, sRGB interpretation and image sizing are consistent.
export async function measureFrame({image, noActors, highlights, fxHighlights, foreground, name, framing}) {
  async function decode(base64) {
    const img=new Image();
    img.src='data:image/png;base64,'+base64;
    await img.decode();
    const c=document.createElement('canvas');
    c.width=img.width;c.height=img.height;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(img,0,0);
    return {rgba:ctx.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height};
  }
  const {rgba,w,h}=await decode(image), count=w*h;
  const lut=Array.from({length:256},(_,i)=>i/255<=.04045?i/255/12.92:((i/255+.055)/1.055)**2.4);
  const luma=new Float32Array(count), all=new Uint32Array(4096), top=new Uint32Array(4096), bottom=new Uint32Array(4096);
  const quant=(hist,q)=>{
    const target=hist.reduce((n,x)=>n+x,0)*q;
    let sum=0;
    for(let i=0;i<hist.length;i++){sum+=hist[i];if(sum>=target)return i/(hist.length-1);}
    return 1;
  };
  const median=xs=>xs.length?xs.sort((a,b)=>a-b)[Math.floor(xs.length/2)]:null;
  let black=0,white=0;
  for(let i=0;i<count;i++){
    const j=i*4;
    const y=.2126*lut[rgba[j]]+.7152*lut[rgba[j+1]]+.0722*lut[rgba[j+2]];
    const bin=Math.round(y*4095);
    luma[i]=y;all[bin]++;
    if(i<count/4)top[bin]++;
    if(i>=3*count/4)bottom[bin]++;
    if(y<.012)black++;
    if(y>.985)white++;
  }
  const flat=[];
  let largestFlatStep=0;
  let worstFlatStep=null;
  for(let y=0;y+48<h;y+=48)for(let x=0;x+48<w;x+=48){
    let s=0,sq=0;
    for(let j=0;j<48;j++)for(let k=0;k<48;k++){
      const v=luma[(y+j)*w+x+k];s+=v;sq+=v*v;
    }
    const sigma=Math.sqrt(Math.max(0,sq/2304-(s/2304)**2));
    if(sigma<.012){
      flat.push(sigma);
      // Average 8-pixel strips in flat patches to suppress the intentionally stochastic grain.
      const col=new Float64Array(6),row=new Float64Array(6);
      for(let j=0;j<48;j++)for(let k=0;k<48;k++){
        const v=luma[(y+j)*w+x+k]/384;
        col[k>>3]+=v;row[j>>3]+=v;
      }
      for(const [axis,strips] of [['x',col],['y',row]])for(let a=1;a<6;a++){
        const jump=Math.abs(strips[a]-strips[a-1]);
        if(jump<=largestFlatStep)continue;
        largestFlatStep=jump;
        worstFlatStep={x,y,axis,stripBoundary:a*8,patchStd:sigma};
      }
    }
  }
  const points=[];
  const step=Math.max(1,Math.floor(Math.sqrt(count/40000)));
  for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
    const idx=4*(y*w+x);points.push([rgba[idx],rgba[idx+1],rgba[idx+2]]);
  }
  let state=7;
  const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  const centers=Array.from({length:8},()=>points[Math.floor(random()*points.length)].slice());
  let sizes=[];
  for(let round=0;round<14;round++){
    const sums=centers.map(()=>[0,0,0]);
    sizes=Array(8).fill(0);
    for(const p of points){
      let nearest=0,best=Infinity;
      for(let j=0;j<8;j++){
        const c=centers[j],d=(p[0]-c[0])**2+(p[1]-c[1])**2+(p[2]-c[2])**2;
        if(d<best){best=d;nearest=j;}
      }
      sizes[nearest]++;
      for(let a=0;a<3;a++)sums[nearest][a]+=p[a];
    }
    for(let j=0;j<8;j++)if(sizes[j])centers[j]=sums[j].map(v=>v/sizes[j]);
  }
  const hues=new Set(),familyShares=new Map();
  for(let i=0;i<8;i++){
    const [r,g,b]=centers[i],max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
    const hue=d?60*(max===r?(g-b)/d:max===g?(b-r)/d+2:(r-g)/d+4):0;
    const family=(!max || d/max<.12)?'neutral':Math.floor(((hue+390)%360)/60);
    const share=sizes[i]/points.length;
    if(share>.08)hues.add(family);
    familyShares.set(family,(familyShares.get(family)||0)+share);
  }
  const result={p50:quant(all,.5),black:black/count,white:white/count,largestCluster:Math.max(...sizes)/points.length,
    majorHueFamilies:hues.size,dominantHueFamilyShare:Math.max(...familyShares.values()),
    verticalLumaDifference:Math.abs(quant(top,.5)-quant(bottom,.5)),flatPatchGrain:median(flat),
    largestFlatStep,worstFlatStep,flatPatchCount:flat.length};
  // Use the same normalized character and backdrop boxes as evidence/tools/forensics.py.
  const edgeBoxes={
    hanami:[[.44,.42,.62,.94],[.02,.02,.26,.30]],
    cabin:[[.34,.38,.58,.95],[.60,.02,.86,.24]],
    orb:[[.30,.18,.60,.78],[.02,.05,.18,.35]]
  };
  function boxEnergy([left,top,right,bottom]){
    const x0=Math.floor(left*w),x1=Math.floor(right*w);
    const y0=Math.floor(top*h),y1=Math.floor(bottom*h);
    const width=x1-x0,height=y1-y0;
    if(width<2||height<2)return 0;
    let dx=0,dy=0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const i=y*w+x;
      if(x+1<x1)dx+=Math.abs(luma[i+1]-luma[i]);
      if(y+1<y1)dy+=Math.abs(luma[i+w]-luma[i]);
    }
    return Number(((dx/((width-1)*height)+dy/(width*(height-1)))/2).toFixed(5));
  }
  const [charEnergy,bgEnergy]=edgeBoxes[name].map(boxEnergy);
  result.actorEdgeRatio=charEnergy/Math.max(bgEnergy,.000001);
  if(noActors){
    const {rgba:bg}=await decode(noActors);
    const mask=new Uint8Array(count);
    let minY=h,maxY=-1;
    for(let i=0;i<count;i++){
      const j=i*4;
      // Ignore subvisual tone-map noise when locating silhouettes.
      if(Math.max(...[0,1,2].map(k=>Math.abs(rgba[j+k]-bg[j+k])))>15){
        mask[i]=1;const y=Math.floor(i/w);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      }
    }
    const rim=new Uint32Array(4096),interior=new Uint32Array(4096);
    let bgEdge=0,actorEdge=0,bgN=0,actorN=0;
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
      const i=y*w+x;
      const energy=(Math.abs(luma[i]-luma[i+1])+Math.abs(luma[i]-luma[i+w]))/2;
      if(mask[i]){
        actorEdge+=energy;actorN++;
        const boundary=!(mask[i+1]&&mask[i-1]&&mask[i+w]&&mask[i-w]);
        (boundary?rim:interior)[Math.round(luma[i]*4095)]++;
      }else{bgEdge+=energy;bgN++;}
    }
    if(actorN){
      result.silhouetteEdgeRatio=(actorEdge/actorN)/(bgEdge/bgN);
      result.rimRatio=quant(rim,.9)/quant(interior,.5);
      result.actorTop=minY/h;result.actorBottom=maxY/h;
    }
  }
  if(highlights && fxHighlights){
    const hot=(await decode(highlights)).rgba,fx=(await decode(fxHighlights)).rgba;
    const source=new Uint8Array(count);
    // Screen positions of painted practical light centres, annotated on the 16:9 plates:
    // hanami lanterns, cabin hearth and oil lamp, orb's candle and crystal.
    const practical={
      hanami:[[.0775,.1639],[.1301,.3714],[.2395,.2755],[.3924,.1826]],
      cabin:[[.0200,.5867],[.2513,.1878]],
      orb:framing==='full'
        ? [[.802,.48],[.7398,.5222],[.8709,.4574],[.8871,.5372]].map(([x,y])=>[.5+(x-.5)*1.08,.5+(y-.5)*1.08])
        : [[.640,.442],[.5208,.5235],[.7728,.3989],[.8039,.5523]]
    }[name];
    for(const [x,y] of practical)source[Math.round(y*(h-1))*w+Math.round(x*(w-1))]=1;
    for(let i=0;i<count;i++)if(fx[i*4]===255)source[i]=1;
    const distance=new Uint16Array(count);
    for(let y=0;y<h;y++){
      let last=-w;
      for(let x=0;x<w;x++){
        const i=y*w+x;
        if(source[i])last=x;
        distance[i]=x-last;
      }
      last=2*w;
      for(let x=w-1;x>=0;x--){
        const i=y*w+x;
        if(source[i])last=x;
        distance[i]=Math.min(distance[i],last-x);
      }
    }
    let emit=0,near=0;
    const radius=40;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(hot[4*(y*w+x)]===255){
      emit++;
      for(let dy=-Math.min(radius,y);dy<=Math.min(radius,h-1-y);dy++){
        const dx=distance[(y+dy)*w+x];
        if(dx*dx+dy*dy<=radius*radius){near++;break;}
      }
    }
    result.highlightCount=emit;
    result.anchoredFraction=emit?near/emit:null;
  }
  if(foreground){
    const mat=(await decode(foreground)).rgba;
    let covered=0,grayscale=0;
    for(let i=0;i<count;i++){
      const j=4*i;
      if(Math.abs(mat[j]-mat[j+1])<=1 && Math.abs(mat[j]-mat[j+2])<=1)grayscale++;
      if(mat[j]>=128)covered++;
    }
    if(grayscale/count>.999)result.foregroundFraction=covered/count;
  }
  const spans={hanami:[.42,.62,0,.005,.15],cabin:[.15,.25,0,.02,.08],orb:[.06,.12,.08,.18,.08]};
  const [lo,hi,darkLo,darkHi,gradient]=spans[name];
  result.gates={
    median:result.p50>=lo&&result.p50<=hi,black:result.black>=darkLo&&result.black<darkHi,white:result.white<.01,
    dominantCluster:result.largestCluster>=.55,hueFamilies:result.majorHueFamilies<=3,
    edge:result.actorEdgeRatio==null?null:result.actorEdgeRatio>=2.5,gradient:result.verticalLumaDifference>=gradient,
    grain:result.flatPatchGrain!=null&&result.flatPatchGrain>=.006&&result.flatPatchGrain<=.02,
    highlightAnchor:result.anchoredFraction==null?null:result.anchoredFraction>=.80,banding:flat.length?largestFlatStep<2/255:null,
    rim:result.rimRatio==null?null:result.rimRatio>=1.25,
    composition:result.foregroundFraction==null||result.actorTop==null?null:
      result.actorTop>=.34&&result.actorTop<=.46&&result.actorBottom>=.84&&result.actorBottom<=.94&&
      result.foregroundFraction>=.08&&result.foregroundFraction<=.25};
  return result;
}
