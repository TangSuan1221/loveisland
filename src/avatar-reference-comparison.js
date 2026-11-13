// Session-only, local reference comparison. Never writes appearance or uploads files.
export function mountReferenceComparison(host, preview, { status }) {
 const doc=host.ownerDocument, win=doc.defaultView;
 let url=null, request=0, disposed=false;
 const defaults={scale:1,x:0,y:0,rotation:0,opacity:.5};
 let state={...defaults};
 const box=doc.createElement('div');box.className='av-reference av-reference-calibration';
 const controls=[['scale','等比缩放',.2,5,.01],['x','水平位置',-150,150,1],['y','垂直位置',-150,150,1],['rotation','画面旋转',-180,180,1],['opacity','叠图透明度',0,1,.01]];
 box.innerHTML=`<div class="av-reference-actions"><button type="button" data-reference-load>＋ 参考图</button><button type="button" data-reference-toggle hidden aria-expanded="false">校准参考</button></div><input class="av-reference-file" type="file" accept="image/png,image/jpeg,image/webp" hidden><div class="av-reference-content" hidden><img class="av-reference-thumb" alt="本地角色参考图"><label class="av-reference-mode"><input type="checkbox" data-reference-overlay>叠到模型上</label><label class="av-reference-mode"><input type="checkbox" data-reference-gray>灰度比轮廓</label>${controls.map(([key,label,min,max,step])=>`<label class="av-reference-adjust">${label}<input type="range" data-reference-control="${key}" aria-label="参考图${label}" min="${min}" max="${max}" step="${step}" value="${defaults[key]}"><output data-reference-value="${key}"></output></label>`).join('')}<div class="av-reference-bottom"><button type="button" data-reference-reset>重置对齐</button><button type="button" data-reference-remove>移除</button></div><small>先对齐瞳孔，再比刘海与下颌。只做等比变换，不拉伸参考；调整模型视角后需重新对齐。参考仅本次使用，不上传、不写入角色。</small></div>`;
 host.append(box);
 const layer=doc.createElement('div');layer.className='av-reference-layer';layer.hidden=true;layer.setAttribute('aria-hidden','true');
 const overlay=doc.createElement('img');overlay.alt='';overlay.draggable=false;layer.append(overlay);preview.append(layer);preview.classList.add('av-reference-stage');
 const q=s=>box.querySelector(s), content=q('.av-reference-content'), thumb=q('.av-reference-thumb'), input=q('.av-reference-file');
 const overlayToggle=q('[data-reference-overlay]'), grayToggle=q('[data-reference-gray]'), toggle=q('[data-reference-toggle]');
 function render(){
  layer.hidden=!url||!overlayToggle.checked;
  preview.classList.toggle('av-reference-grayscale',!!url&&grayToggle.checked);
  thumb.style.filter=grayToggle.checked?'grayscale(1)':'';
  overlay.style.left=`${50+state.x}%`;overlay.style.top=`${50+state.y}%`;
  overlay.style.transform=`translate(-50%,-50%) rotate(${state.rotation}deg) scale(${state.scale})`;
  overlay.style.opacity=state.opacity;
  for(const [key]of controls){q(`[data-reference-control="${key}"]`).value=state[key];q(`[data-reference-value="${key}"]`).textContent=key==='rotation'?`${state[key]}°`:key==='scale'?`${state[key].toFixed(2)}×`:key==='opacity'?`${Math.round(state[key]*100)}%`:`${state[key]}%`;}
 }
 function clear(){
  request++;if(url)win.URL.revokeObjectURL(url);url=null;
  thumb.removeAttribute('src');overlay.removeAttribute('src');content.hidden=true;toggle.hidden=true;toggle.setAttribute('aria-expanded','false');
  overlayToggle.checked=false;grayToggle.checked=false;state={...defaults};render();
 }
 q('[data-reference-load]').onclick=()=>input.click();
 toggle.onclick=()=>{content.hidden=!content.hidden;toggle.setAttribute('aria-expanded',String(!content.hidden));toggle.textContent=content.hidden?'校准参考':'收起校准';};
 q('[data-reference-remove]').onclick=clear;
 q('[data-reference-reset]').onclick=()=>{state={...defaults};render();};
 overlayToggle.onchange=grayToggle.onchange=render;
 for(const [key]of controls)q(`[data-reference-control="${key}"]`).oninput=e=>{state[key]=Number(e.target.value);render();};
 input.onchange=async()=>{
  const file=input.files?.[0];input.value='';if(!file)return;
  const token=++request;let pendingURL;
  try{
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('参考图支持 PNG / JPEG / WebP，最大 8 MB。');
   pendingURL=win.URL.createObjectURL(file);const image=new win.Image();image.src=pendingURL;await image.decode();
   if(image.naturalWidth>4096||image.naturalHeight>4096)throw new Error('参考图宽高不能超过 4096 像素，请缩小后导入。');
   if(disposed||token!==request)return;
   if(url)win.URL.revokeObjectURL(url);url=pendingURL;pendingURL=null;
   thumb.src=url;overlay.src=url;state={...defaults};overlayToggle.checked=false;grayToggle.checked=false;content.hidden=false;toggle.hidden=false;toggle.textContent='收起校准';toggle.setAttribute('aria-expanded','true');render();
   status('参考图已载入。可叠图校准和灰度对照；不会上传、写入角色或改变模型。');
  }catch(error){if(!disposed&&token===request)status(error.name==='EncodingError'?'参考图无法读取，请重新导出为 PNG 或 JPEG。':error.message||'参考图无法读取。',true);}
  finally{if(pendingURL)win.URL.revokeObjectURL(pendingURL);}
 };
 render();
 return {dispose(){if(disposed)return;disposed=true;clear();box.remove();layer.remove();preview.classList.remove('av-reference-stage','av-reference-grayscale');}};
}
