import {normalizeFaceArt,drawAppearancePaint,hitFaceArt} from './avatar-face-art.js';
const names={select:'选择 / 移动',pen:'自由线',curve:'弧线',lash:'眼线',ellipse:'色块',ring:'圆环',star:'星形',heart:'心形',triangle:'三角'};
const uid=()=>`art-${crypto.randomUUID()}`;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function mountFaceArtEditor(host,{get,snapshot,change,remember,status,state}){
 const abort=new AbortController(),on=(el,event,fn)=>el.addEventListener(event,fn,{signal:abort.signal});
 let gesture=null,inputBefore=null;
 host.innerHTML=`<p class="av-help">彩绘是可再次编辑的图层：选择后拖动，或调整下方位置、大小、角度。左侧 3D 显示实际贴合效果。</p>
 <div class="av-paint-tools">${Object.entries(names).map(([k,v])=>`<button type="button" data-art-tool="${k}">${v}</button>`).join('')}</div>
 <div class="av-paint-settings"><label>新图层颜色 <input type="color" data-art-color value="${state.color}"></label><label><input type="checkbox" data-art-mirror ${state.mirror?'checked':''}>新图层左右镜像</label></div>
 <div class="av-paint-board"><canvas width="512" height="512" class="av-paint-canvas" aria-label="彩绘展开画布，可选择和移动图层" tabindex="0"></canvas><span>展开坐标画布 · 非正面照片</span></div>
 <p class="av-help">选择工具可拖动图层；蓝色方框为范围。圆外自动裁切，虚线不保存。自由线最多 256 点，图层最多 64 个。</p>
 <label class="art-layer-label">图层（上方在最前）<select size="4" data-art-layers aria-label="彩绘图层"></select></label>
 <div class="av-paint-tools"><button type="button" data-art-action="duplicate">复制</button><button type="button" data-art-action="up">上移一层</button><button type="button" data-art-action="down">下移一层</button><button type="button" data-art-action="delete">删除所选</button><button type="button" data-art-action="clear">清空彩绘</button></div>
 <fieldset class="art-properties"><legend>所选图层</legend><div class="art-flags"><label>颜色<input type="color" data-art-prop="color"></label><label><input type="checkbox" data-art-prop="visible">显示</label><label><input type="checkbox" data-art-prop="mirror">镜像</label></div>
 ${[['x','左右',0,1,.005],['y','上下',0,1,.005],['width','宽度',.005,1,.005],['height','高度',.005,1,.005],['rotation','旋转',-180,180,1],['opacity','透明度',0,1,.01],['lineWidth','线宽',.001,.1,.001],['bend','弧度（弧线/眼线）',-1,1,.01]].map(([k,l,min,max,step])=>`<label class="art-range">${l}<input type="range" data-art-prop="${k}" min="${min}" max="${max}" step="${step}"><output data-art-value="${k}"></output></label>`).join('')}</fieldset><p class="av-help art-legacy"></p>`;
 const q=s=>host.querySelector(s),canvas=q('canvas'),ctx=canvas.getContext('2d'),buffer=document.createElement('canvas');buffer.width=buffer.height=512;
 const selected=()=>get().faceArt.find(l=>l.id===state.selected);
 const patch=(v,historyEntry=true)=>{change({faceArt:get().faceArt.map(l=>l.id===state.selected?{...l,...v}:l)},{historyEntry});draw();};
 const point=e=>{const r=canvas.getBoundingClientRect();return[clamp((e.clientX-r.left)/r.width,0,1),clamp((e.clientY-r.top)/r.height,0,1)];};
 function draw(){
  const a=get(),layer=selected();ctx.clearRect(0,0,512,512);ctx.fillStyle=a.skinColor;ctx.beginPath();ctx.ellipse(256,256,250,250,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#52645c55';ctx.setLineDash([6,8]);ctx.beginPath();ctx.moveTo(256,6);ctx.lineTo(256,506);ctx.moveTo(6,256);ctx.lineTo(506,256);ctx.stroke();ctx.setLineDash([]);
  drawAppearancePaint(buffer.getContext('2d'),a);ctx.drawImage(buffer,0,0);
  if(layer)for(const mirrored of layer.mirror?[false,true]:[false]){ctx.save();if(mirrored){ctx.translate(512,0);ctx.scale(-1,1);}ctx.translate(layer.x*512,layer.y*512);ctx.rotate(layer.rotation*Math.PI/180);ctx.strokeStyle='#216ecd';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.strokeRect(-layer.width*256,-layer.height*256,layer.width*512,layer.height*512);ctx.restore();}
  for(const b of host.querySelectorAll('[data-art-tool]')){const active=b.dataset.artTool===state.tool;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));}
  const select=q('[data-art-layers]');select.replaceChildren(...a.faceArt.slice().reverse().map((l,i)=>{const o=new Option(`${l.visible?'●':'○'} ${names[l.kind]} ${a.faceArt.length-i}${l.mirror?' · 镜像':''}`,l.id);o.selected=l.id===state.selected;return o;}));if(!layer)select.selectedIndex=-1;
  q('fieldset').disabled=!layer;
  for(const input of host.querySelectorAll('[data-art-prop]')){const v=layer?.[input.dataset.artProp];if(v===undefined)continue;if(input.type==='checkbox')input.checked=v;else input.value=v;const output=q(`[data-art-value="${input.dataset.artProp}"]`);if(output)output.value=String(v);}
  q('.art-legacy').textContent=`${a.faceArt.length}/64 个可编辑图层；${a.strokes.length} 笔旧版彩绘（保持原样，可整体清空）。每次操作可用顶部撤销 / 重做。`;
 }
 function finish(cancel=false){
  if(!gesture)return;const g=gesture;gesture=null;
  if(cancel)change({faceArt:g.before.appearance.faceArt},{historyEntry:false});else remember(g.before);
  if(canvas.hasPointerCapture(g.pointer))canvas.releasePointerCapture(g.pointer);draw();
 }
 on(canvas,'pointerdown',e=>{
  if(e.button!==0||gesture)return;e.preventDefault();canvas.focus({preventScroll:true});const p=point(e),before=snapshot();
  if(state.tool==='select'){
   const hit=hitFaceArt(get().faceArt,...p);state.selected=hit?.id||null;if(hit){gesture={pointer:e.pointerId,before,p,layer:{...selected()},mirrored:hit.mirrored};canvas.setPointerCapture(e.pointerId);}draw();return;
  }
  if(get().faceArt.length>=64){status('最多 64 个图层，请先删除不需要的图层。',true);return;}
  if(state.tool==='pen'&&get().faceArt.reduce((n,l)=>n+l.points.length,0)>=8192){status('已达自由线总点数限制，请删除部分图层。',true);return;}
  const layer=normalizeFaceArt([{id:uid(),kind:state.tool,x:p[0],y:p[1],width:.16,height:.1,color:state.color,mirror:state.mirror,points:state.tool==='pen'?[[0,0]]:[]}])[0];state.selected=layer.id;change({faceArt:[...get().faceArt,layer]},{historyEntry:false});gesture={pointer:e.pointerId,before,p,points:[p],layer,remaining:Math.min(256,8192-before.appearance.faceArt.reduce((n,l)=>n+l.points.length,0))};canvas.setPointerCapture(e.pointerId);draw();
 });
 on(canvas,'pointermove',e=>{
  if(!gesture||e.pointerId!==gesture.pointer)return;const p=point(e),g=gesture;
  if(state.tool==='select'){patch({x:clamp(g.layer.x+(p[0]-g.p[0])*(g.mirrored?-1:1),0,1),y:clamp(g.layer.y+p[1]-g.p[1],0,1)},false);return;}
  if(state.tool!=='pen'||g.points.length>=g.remaining)return;
  if(Math.hypot(p[0]-g.points.at(-1)[0],p[1]-g.points.at(-1)[1])<.002)return;
  g.points.push(p);const xs=g.points.map(p=>p[0]),ys=g.points.map(p=>p[1]),x=(Math.min(...xs)+Math.max(...xs))/2,y=(Math.min(...ys)+Math.max(...ys))/2,width=Math.max(.005,Math.max(...xs)-Math.min(...xs)),height=Math.max(.005,Math.max(...ys)-Math.min(...ys));patch({x,y,width,height,points:g.points.map(([px,py])=>[(px-x)/width,(py-y)/height])},false);
 });
 on(canvas,'pointerup',e=>{if(e.pointerId===gesture?.pointer)finish();});on(canvas,'pointercancel',()=>finish(true));on(canvas,'lostpointercapture',()=>finish(true));
 on(canvas,'keydown',e=>{if(e.key==='Escape'&&gesture){finish(true);e.preventDefault();e.stopPropagation();}if(e.key==='Delete'&&selected()){action('delete');e.preventDefault();}});
 for(const b of host.querySelectorAll('[data-art-tool]'))on(b,'click',()=>{finish(true);state.tool=b.dataset.artTool;draw();});
 on(q('[data-art-color]'),'input',e=>state.color=e.target.value);on(q('[data-art-mirror]'),'change',e=>state.mirror=e.target.checked);
 on(q('[data-art-layers]'),'change',e=>{state.selected=e.target.value;state.tool='select';draw();});
 for(const input of host.querySelectorAll('[data-art-prop]')){
  on(input,'input',()=>{if(!selected())return;inputBefore??=snapshot();const value=input.type==='checkbox'?input.checked:input.type==='color'?input.value:Number(input.value);patch({[input.dataset.artProp]:value},false);});
  const commit=()=>{if(inputBefore){remember(inputBefore);inputBefore=null;}};on(input,'change',commit);on(input,'blur',commit);
 }
 function action(name){
  finish(true);const layers=get().faceArt.slice(),index=layers.findIndex(l=>l.id===state.selected);
  if(name==='clear'){state.selected=null;change({faceArt:[],strokes:[]});draw();return;}
  if(index<0)return;
  if(name==='delete'){layers.splice(index,1);state.selected=layers.at(-1)?.id||null;}
  if(name==='duplicate'){if(layers.length>=64){status('最多 64 个图层。',true);return;}const copy={...structuredClone(layers[index]),id:uid(),x:clamp(layers[index].x+.035,0,1)};layers.push(copy);state.selected=copy.id;}
  const target=index+(name==='up'?1:-1);if(['up','down'].includes(name)&&target>=0&&target<layers.length)[layers[index],layers[target]]=[layers[target],layers[index]];
  change({faceArt:layers});draw();
 }
 for(const b of host.querySelectorAll('[data-art-action]'))on(b,'click',()=>action(b.dataset.artAction));
 function settle(cancel=false){finish(cancel);if(inputBefore){remember(inputBefore);inputBefore=null;}}
 draw();return {draw,settle,dispose(){settle();abort.abort();}};
}
