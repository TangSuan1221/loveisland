import {catalog,makeGrid,newCamp} from './model.js';
import {sharePng,readPng} from './png.js';
import {pack} from './archive.js';
import {isCampWinter,campSeason} from './day.js';
import {interiors,stages} from './works.js';
import './editor.css';
const modes={select:'选择',place:'放置',move:'移动',skin:'换皮',pave:'铺路',unpave:'拆路',fill:'填海',clear:'清林 / 清岩'};
const colors=['#386c84','#6da7aa','#e2cb96','#92ad75','#536f50','#898f88','#ac9874','#595e5d'];
function line(a,b){
  const n=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y));
  return Array.from({length:n+1},(_,i)=>({x:Math.round(a.x+(b.x-a.x)*i/(n||1)),y:Math.round(a.y+(b.y-a.y)*i/(n||1))}));
}
export function openCamp(state,act,actorState){
  if(document.querySelector('.camp-editor'))return;
  const dialog=document.createElement('dialog');dialog.className='camp-editor';
  dialog.innerHTML='<header><h2>营地建造</h2><button data-close>返回现场</button></header><strong data-summary></strong><main><div class="camp-view"><canvas width="768" height="768" aria-label="营地建造地图"></canvas></div><section><label>建筑目录 <select data-kind></select></label><p data-info></p><button data-buy>购买入库</button> <button data-sell>卖回</button><hr><label>工具 <select data-tool></select></label> <select aria-label="铺装材质" data-road><option value="1">土路</option><option value="2">石板</option><option value="3">木栈道</option></select><select aria-label="地表外观" data-skin><option value="1">替换外观</option><option value="0">默认外观</option></select><p data-help></p><div data-detail></div><hr><label>工班人数 <select data-crew></select></label> <button data-expand>扩岛</button><p data-stage></p><button data-undo>撤销</button> <button data-redo>重做</button><details><summary>营地蓝图</summary><textarea aria-label="营地蓝图码" rows="3"></textarea><button data-last>读取上次营地</button><button data-export>导出蓝图</button><button data-import>恢复蓝图</button><button data-png>保存蓝图图片</button><label>读取蓝图图片 <input data-file type="file" accept="image/png"></label></details><output aria-live="polite"></output></section></main>';
  document.body.append(dialog);
  const q=s=>dialog.querySelector(s),canvas=q('canvas'),ctx=canvas.getContext('2d'),kind=q('[data-kind]'),tool=q('[data-tool]'),detail=q('[data-detail]');
  const base=document.createElement('canvas');base.width=base.height=768;
  let selected=null,multi=[],angle=0,start=null,hover=null,busy=false,error=false,space=false,pan=null,zoom=1,batch=new Map(),s,c,g;
  const def=()=>g.kinds.get(kind.value), chosen=()=>g.structs.find(v=>v.id===selected);
  for(const d of catalog)kind.add(new Option(d.name,d.id));
  for(const [id,name] of Object.entries(modes))tool.add(new Option(name,id));
  for(let i=0;i<=3;i++)q('[data-crew]').add(new Option(i,i));
  function terrain(){
    const b=base.getContext('2d');
    for(let i=0;i<4096;i++){
      const x=i%64*12,y=Math.floor(i/64)*12;
      b.fillStyle=g.terrainKey(i%64,i>>6)==='grass'&&campSeason(s.businessDay)>=2?(['#ae9c66','#dce4db'][campSeason(s.businessDay)-2]):colors[g.base[i]];b.fillRect(x,y,12,12);
      if(g.skin[i]){b.fillStyle='#6d573744';b.fillRect(x,y,12,12);}
      if(g.road[i]){b.fillStyle=['','#ac865e','#a1a5a4','#916845'][g.road[i]];b.fillRect(x+1,y+1,10,10);}
    }
    b.strokeStyle='#274e3d22';b.beginPath();for(let i=0;i<=768;i+=12){b.moveTo(i,0);b.lineTo(i,768);b.moveTo(0,i);b.lineTo(768,i);}b.stroke();
    b.fillStyle='white';for(const site of g.sites)b.fillRect(site.x*12+4,site.y*12+4,4,4);
    b.strokeStyle='white';b.strokeRect(384,384,12,12);
  }
  function draw(){
    ctx.drawImage(base,0,0);
    for(const f of s.facilities||[]){const x=(f.x/.75+32.5)*12,y=(f.z/.75+32.5)*12;ctx.beginPath();ctx.arc(x,y,(s.catalog.facilities.find(d=>d.id===f.type)?.radius||1)*16,0,Math.PI*2);ctx.fillStyle='#546b8077';ctx.fill();ctx.fillStyle='#fff';ctx.fillText(f.name||'设施',x-8,y);}
    for(const st of g.structs){
      const {w,h}=g.kindSize(st.kind,st.rot),x=st.x*12,y=st.y*12;
      ctx.fillStyle=st.damaged?'#545053':st.id===selected?'#ad5032':'#715039';ctx.fillRect(x,y,w*12,h*12);
      ctx.fillStyle='#fff';ctx.font='10px sans-serif';ctx.fillText(st.kind.name[0],x+1,y+10);
    }
    for(const id of s.cast){const a=actorState?.(id);if(!a||!Number.isFinite(a.x)||!Number.isFinite(a.z))continue;
      ctx.beginPath();ctx.arc((a.x/.75+32.5)*12,(a.z/.75+32.5)*12,3,0,2*Math.PI);ctx.fillStyle='#e3f5ff';ctx.fill();ctx.strokeStyle='#24435a';ctx.lineWidth=1;ctx.stroke();
    }
    if(hover){
      ctx.strokeStyle=error?'#ff4035':'#fff191';ctx.lineWidth=2;
      const target=tool.value==='move'?chosen()?.kind:def();
      const placing=target&&['move','place'].includes(tool.value);const size=placing?g.kindSize(target,angle):{w:1,h:1};
      if(placing&&tool.value==='place'){const check=g.canPlace(target,hover.x,hover.y,angle);ctx.strokeStyle=check.ok&&c.inventory[target.id]?'#f8f5b6':'#ff6152';}
      ctx.strokeRect(hover.x*12,hover.y*12,size.w*12,size.h*12);
    }
    ctx.fillStyle='#fff3a770';for(const p of batch.values())ctx.fillRect(p.x*12,p.y*12,12,12);
  }
  function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=fn;detail.append(b);}
  function options(label,rows,fn){
    const el=document.createElement('select');el.setAttribute('aria-label',label);
    for(const [value,name] of rows)el.add(new Option(name,value));
    detail.append(el);button(label,()=>fn(el.value));
  }
  function refresh(){
    s=state();c=s.camp||newCamp();g=makeGrid(c,s.businessDay);terrain();
    const d=def(),v=chosen(),count=c.inventory[d.id]||0;
    q('[data-summary]').textContent='第 '+s.businessDay+' 天 · '+(['春季','夏季','秋季','冬季'][campSeason(s.businessDay)]+' · ')+'木料 '+c.wood+' · 石料 '+(c.stone||0)+' · 剩余工时 '+Math.max(0,(c.crew??1)*9-(c.day===s.businessDay?c.used:0)).toFixed(1)+' 小时';
    q('[data-info]').textContent=d.w+'×'+d.h+' 格 · '+d.wood+' 木料 · 第 '+d.unlock_day+' 天解锁 · 仓库 '+count+' · 拥有 '+(count+c.placed.filter(b=>b.kind===d.id).length)+'/'+d.max_count;
    q('[data-buy]').disabled=d.wood>c.wood||d.unlock_day>s.businessDay||count+c.placed.filter(b=>b.kind===d.id).length>=d.max_count;
    q('[data-crew]').disabled=isCampWinter(s.businessDay);q('[data-sell]').disabled=!count;q('[data-crew]').value=c.crew??1;
    q('[data-road]').hidden=tool.value!=='pave';q('[data-skin]').hidden=tool.value!=='skin';
    q('[data-help]').textContent=({select:'点击建筑查看住户和可用操作。',place:'点击空地放置，R 转向。栅栏可拖动连续放置。',move:'点击新位置，R 调整朝向。'})[tool.value]||'按住并拖动选择地块，松开结算。';
    const next=stages[(c.stage||0)+1];q('[data-expand]').disabled=!next||isCampWinter(s.businessDay)||s.businessDay<next[1]||c.placed.length<next[2]||c.wood<next[3]||((c.crew??1)*9-(c.day===s.businessDay?c.used:0)<9);q('[data-stage]').textContent=next?'下次扩岛需要第 '+next[1]+' 天、'+next[2]+' 座建筑、'+next[3]+' 木料及 9 工时。':'岛屿已扩至最大。';
    detail.replaceChildren();
    if(v){
      const title=document.createElement('p');title.textContent=v.kind.name+' #'+v.id+' · '+(v.damaged?'损毁':'完好')+(v.kind.beds?' · 床位 '+(v.homeOf||[]).length+'/'+v.kind.beds+' · '+(interiors[v.interior||'bare']?.[0]||''):'');detail.append(title);
      button('移动',()=>{tool.value='move';angle=v.rot;refresh();});
      if(v.kind.rotatable)button('旋转',()=>run({op:'rotate',id:v.id}));
      button('收回',()=>run({op:'store',id:v.id}));button('永久拆除',()=>run({op:'dismantle',id:v.id}));
      if(v.damaged)button('修缮',()=>run({op:'repair',id:v.id}));
      if(v.kind.beds){
        const up=catalog.filter(d=>d.cat==='shelter'&&d.beds>v.kind.beds);
        if(up.length)options('升级',up.map(d=>[d.id,d.name+' · '+(d.wood-v.kind.wood)+' 木']),kind=>run({op:'upgrade',id:v.id,kind}));
        options('装修',Object.entries(interiors).map(([k,row])=>[k,row[0]+' · '+row[1]+' 木']),value=>run({op:'interior',id:v.id,value}));
        options('分床',s.cast.map(id=>[id,s.candidates.find(a=>a.id===id)?.name||id]),npc=>run({op:'assign',id:v.id,npc}));
      }
    }
    draw();
  }
  async function run(p){
    if(busy)return;busy=true;
    try{const r=await act('campEdit',p);error=!r?.ok;q('output').textContent=r?.message||'操作未完成。';
      if(r?.ok){try{localStorage.setItem('island-camp-save-v3',pack(state().camp));}catch{q('output').textContent+=' 浏览器存储不足，可手动导出蓝图。';}}
      if(r?.ok&&p.op==='buy')tool.value='place';
      if(r?.ok&&['move','store','dismantle'].includes(p.op))tool.value='select';
      refresh();
    }finally{busy=false;}
  }
  function tile(e){const box=canvas.getBoundingClientRect();return{x:Math.floor((e.clientX-box.left)*64/box.width),y:Math.floor((e.clientY-box.top)*64/box.height)};}
  function collect(p,straight){
    if(!start)return;
    if(['clear','fill','select'].includes(tool.value)){batch.clear();for(let x=Math.min(p.x,start.x);x<=Math.max(p.x,start.x);x++)for(let y=Math.min(p.y,start.y);y<=Math.max(p.y,start.y);y++)batch.set(x+','+y,{x,y});}
    else{if(straight)batch.clear();for(const pt of line(straight?start:hover||start,p))batch.set(pt.x+','+pt.y,pt);}
  }
  canvas.onpointerdown=e=>{if(space){pan=[e.clientX,e.clientY,q('.camp-view').scrollLeft,q('.camp-view').scrollTop];}else{start=hover=tile(e);batch.clear();collect(start,false);}canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(pan){q('.camp-view').scrollTo(pan[2]+pan[0]-e.clientX,pan[3]+pan[1]-e.clientY);return;}const p=tile(e);collect(p,e.shiftKey);hover=p;error=false;draw();};
  canvas.onpointerup=e=>{
    if(pan){pan=null;return;}if(!start)return;
    const p=tile(e);collect(p,e.shiftKey);const cells=[...batch.values()];start=null;batch.clear();
    const id=g.occ[p.y*64+p.x],mode=tool.value;
    if(mode==='select'||(mode==='place'&&id)){
      multi=[...new Set(cells.map(pt=>g.occ[pt.y*64+pt.x]).filter(Boolean))];selected=id||multi[0]||null;
      tool.value='select';refresh();
      if(multi.length>1)q('output').textContent='选中 '+multi.length+' 座：'+multi.map(n=>g.structs.find(st=>st.id===n)?.kind.name).join('、');
      else if(!selected){const person=s.cast.map(id=>actorState?.(id)).find(a=>a&&Math.round(a.x/.75+32)===p.x&&Math.round(a.z/.75+32)===p.y);const site=g.sites.find(v=>v.x===p.x&&v.y===p.y);q('output').textContent=person?person.name+' · '+(person.label||'在营地'):site?'资源点 '+site.id+' · 通勤效率 '+Math.round(g.commuteFactor(p.x,p.y)*100)+'%':'地块 '+p.x+'，'+p.y;}
      return;
    }
    if(mode==='place'&&kind.value==='fence'&&cells.length>1)run({op:'fences',kind:'fence',cells,rot:angle});
    else if(mode==='place'||mode==='move')run({op:mode,id:mode==='move'?selected:undefined,kind:kind.value,...p,rot:angle});
    else run({op:mode,cells,value:Number(q(mode==='skin'?'[data-skin]':'[data-road]').value)});
  };
  canvas.onpointercancel=()=>{pan=start=null;batch.clear();draw();};
  canvas.onwheel=e=>{if(e.altKey){e.preventDefault();zoom=Math.max(1,Math.min(4,zoom-Math.sign(e.deltaY)*.25));canvas.style.width=zoom*100+'%';}};
  kind.onchange=()=>{angle=0;selected=null;tool.value='place';refresh();};tool.onchange=refresh;
  q('[data-buy]').onclick=()=>run({op:'buy',kind:kind.value});q('[data-sell]').onclick=()=>run({op:'sell',kind:kind.value});
  q('[data-crew]').onchange=e=>run({op:'crew',value:Number(e.target.value)});q('[data-expand]').onclick=()=>run({op:'expand'});
  q('[data-undo]').onclick=()=>run({op:'undo'});q('[data-redo]').onclick=()=>run({op:'redo'});
  q('[data-last]').onclick=()=>{try{const code=localStorage.getItem('island-camp-save-v3');if(code)run({op:'loadBlueprint',code});else q('output').textContent='没有已保存的营地。';}catch{q('output').textContent='无法读取已保存的营地。';}};
  q('[data-export]').onclick=()=>{q('textarea').value=pack(c);q('textarea').select();};q('[data-import]').onclick=()=>run({op:'loadBlueprint',code:q('textarea').value});
  q('[data-png]').onclick=async()=>{
    const blob=await new Promise(resolve=>canvas.toBlob(resolve)),image=sharePng(new Uint8Array(await blob.arrayBuffer()),pack(c));
    const a=document.createElement('a');a.href=URL.createObjectURL(image);a.download='营地蓝图.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
  q('[data-file]').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>8e6)throw Error('图片过大。');q('textarea').value=readPng(new Uint8Array(await file.arrayBuffer()));q('output').textContent='已读取图片，可恢复蓝图。';}catch(error){q('output').textContent=error.message;}};
  q('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>{dialog.remove();window.dispatchEvent(new Event('camp-editor-close'));};
  dialog.onkeydown=e=>{e.stopPropagation();if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT')return;
    if(e.key==='Escape'&&start){e.preventDefault();start=null;batch.clear();draw();}
    if(e.code==='Space'){e.preventDefault();space=true;}
    if(e.ctrlKey&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();run({op:e.shiftKey||e.key.toLowerCase()==='y'?'redo':'undo'});}
    if(e.key.toLowerCase()==='r'){if(tool.value==='select'&&chosen())run({op:'rotate',id:selected});else if((tool.value==='move'?chosen()?.kind:def())?.rotatable){angle=(angle+1)%4;draw();}}
    if(e.key==='Delete'&&chosen())run({op:e.shiftKey?'dismantle':'store',id:selected});
    if(/^[1-8]$/.test(e.key)){tool.value=Object.keys(modes)[Number(e.key)-1];refresh();}
  };dialog.onkeyup=e=>{if(e.code==='Space')space=false;};
  refresh();dialog.showModal();window.dispatchEvent(new Event('camp-editor-open'));
}
