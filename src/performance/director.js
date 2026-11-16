import {buildFaceTrack} from './face-track.js';
import {sceneForEvent} from './catalog-scenes.js';
import {editScene} from './cinema-edit.js';
import {parseCsv, planScene, degradeToT0, shotTable, solveShot, SkitPlayer} from './runtime.js';

const files = import.meta.glob('./data/*.csv', {eager:true, query:'?raw', import:'default'});
const tables = Object.fromEntries(Object.entries({defs:'def', beats:'beat', lines:'line', choices:'choice', shots:'shot'})
  .map(([key, file]) => [key, parseCsv(files[`./data/skit-${file}.csv`])]));
const branchEffects=new Map(parseCsv(files['./data/scene-branch.csv']).map(row=>[
  row.scene_id+'/'+row.branch_id,row.effect
]));
const shots = shotTable(tables.shots);
const cinemaPresets = {wide:'WIDE',pair:'2SHOT',profile:'2SHOT',shoulderF:'OTS_F',shoulderT:'OTS_T',faceF:'CU_F',faceT:'CU_T',insert:'INSERT',location:'LOC',faceA:'CU_A'};
function projectionRate(event){
  const id=event.performanceKey??event.sceneId??event.type;
  if(/confess|feeling|breakup|couple|watch_stars|mourn|grave|grief|comfort|night_talk|tell_story|child_birth/.test(id))return .55;
  if(/fight|caught|dispute|contest|protect/.test(id))return .8;
  return .67;
}
const limits = {standard:45000, all:90000, big:15000, off:0};

export function createPerformance(root, stage) {
  const panel = document.createElement('section');
  panel.className = 'island-performance';
  panel.hidden = true;
  panel.innerHTML = '<div aria-live="polite"></div><button type="button">跳过 · 空格</button>';
  root.append(panel);
  const line = panel.firstElementChild;
  const decision=document.createElement('div');panel.append(decision);
  const select = document.createElement('select');
  select.setAttribute('aria-label','事件演出强度');
  for (const [value,label] of Object.entries({standard:'标准', all:'全开', big:'只看大事', off:'关'}))
    select.add(new Option('演出 · '+label,value));
  root.querySelector('.game-scene-tools').prepend(select);
  let postDemoMs=0,rate=1;
  let player, current, activeEvent, activeShot, restore, day, spent = 0;
  const queue = [];
  function finish() {
    postDemoMs=0;
    root.classList.remove('camp-letterbox');restore?.();
    restore = activeEvent = activeShot = null;
    decision.replaceChildren();player = current = null;
    panel.hidden = true;
  }
  function flush() { queue.length = 0; finish(); }
  select.onchange = flush;
  panel.querySelector('button').onclick = finish;
  window.addEventListener('keydown', e => {
    if (player && e.code === 'Space' && !e.repeat && !e.target.closest?.('input,select,textarea')) {
      e.preventDefault(); e.stopImmediatePropagation(); finish();
    }
  },true);
  document.addEventListener('visibilitychange', () => { if(document.hidden) flush(); });
  function start(event, state, preview=false) {
    const ids = event.participants.map(id => state.candidates.findIndex(c=>c.id===id));
    const tick=Number.isSafeInteger(event.id)?event.id:[...String(event.id)].reduce((hash,ch)=>(Math.imul(hash,31)+ch.codePointAt(0))>>>0,0);
    const catalog=sceneForEvent(event);
    const sceneId=catalog?.id??(event.type==='camp-story'?event.sceneId:event.type);
    const branchId=event.result??(catalog?tables.defs.find(d=>d.scene_id===sceneId)?.branch_id??'B1':'result');
    let plan = planScene({tables, seed:state.season, tick, sceneId, branchId,
      ids:{F:ids[0]??-1,T:ids[1]??-1,A:ids[2]??null}, names:state.candidates.map(c=>c.name)});
    if(plan.generated) {
      plan.title = event.text;
      plan.cues = plan.cues.filter(c=>['cam','wait','caption','end'].includes(c.kind));
    }
    for(const cue of plan.cues) if(cue.kind==='caption') cue.text=event.text;
    plan=editScene(plan,event);
    const brief=plan.generated && (event.sourcePart!=='result' || (select.value!=='all' && event.type==='routine'));
    if(!preview && (brief || (select.value==='big' && plan.tier==='T1') || spent+plan.total>limits[select.value]))
      plan=degradeToT0(plan);
    if(plan.hold)for(const setup of plan.cinemaShots){
      const preset=shots.get(setup.sourceShot||cinemaPresets[setup.kind]);
      if(preset)setup.rig={fov:preset.fov,dist:preset.dist};
      if(['SKY','HIGH','LOW','POV_F','REVERSE','STATIC','DOLLY_IN'].includes(setup.sourceShot) && stage.positions){
        setup.originalRig=solveShot(setup.sourceShot,{pos:stage.positions(event.participants),yaw:stage.yaw()},shots);
      }
    }
    if(plan.hold){
      const effect=event.effect??((event.result||!event.resultFeelings)?branchEffects.get(sceneId+'/'+branchId):'');
      plan.faceTrack=buildFaceTrack(plan,{...event,effect});
    }
    rate=plan.hold && plan.cinemaShots?.length ? projectionRate(event) : 1;
    current=plan;
    activeEvent=event;
    if(plan.hold) restore=stage.capture(event,!!plan.cinemaShots?.length);
    panel.hidden=false;
    panel.querySelector('button').hidden=!plan.hold;
    line.textContent='';
    player=new SkitPlayer(plan,{onEnd(){if(plan.hold && plan.cinemaShots?.length)postDemoMs=350;else finish();},onCue(cue){
      if(cue.kind==='letterbox')root.classList.toggle('camp-letterbox',cue.letterbox);
      if(cue.kind==='cam' && !plan.cinemaShots?.length) {
        const points=stage.positions(event.participants);if(event.type==='camp-story')points.loc=[event.x,event.z];
        if(points.F) stage.shot(solveShot(cue.shot,{pos:points,yaw:stage.yaw()},shots));
      }
      decision.replaceChildren();
      if(event.type==='camp-story'&&cue.kind==='choice')for(const option of cue.options){
        const button=document.createElement('button');button.type='button';button.textContent=option.text;
        button.onclick=()=>{decision.replaceChildren();line.textContent=option.text;stage.campChoice?.(event,option);};decision.append(button);
      }
      line.dataset.channel=cue.channel||'';
      if(cue.text) line.textContent=cue.text;
      else if(cue.kind==='wait') line.textContent='';
    }});
    player.step(0);
  }
  return {
    stop:flush,
    get rate(){return rate;},
    get shot(){return activeShot;},
    get cinematic(){return !!(current?.hold && current.cinemaShots?.length);},
    preview(event,state){flush();start(event,state,true);this.update(0,state);},
    get holding(){return !!current?.hold;},
    observe(event,state){
      if(document.hidden||state.phase!=='recording'||select.value==='off'||!event.text)return;
      const key=state.season+'/'+state.day;
      if(key!==day){flush();day=key;spent=0;}
      if(event.type==='staged-performance' && event.sourcePart!=='result')return;
      if(event.type==='dialogue'||event.type.endsWith('-start'))return;
      if(queue.length<2)queue.push(event);
      else if(event.type==='camp-story' || event.sourcePart==='result'){
        const replace=queue.findIndex(item=>item.sourcePart!=='result' && item.type!=='camp-story' || item.type==='routine');
        if(replace>=0)queue[replace]=event;
        else if(queue[1].type!=='camp-story')queue[1]=event;
      }
    },
    update(ms,state){
      select.hidden=state.phase!=='recording';
      if(select.hidden||document.hidden){flush();return;}
      if(!player && queue.length) start(queue.shift(),state);
      if(postDemoMs){postDemoMs=Math.max(0,postDemoMs-ms);if(!postDemoMs)finish();return;}
      ms*=rate;
      if(current?.hold)spent+=Math.min(ms,current.total-player.t);
      if(player)player.step(Math.min(ms,Math.max(0,current.total-player.t)));
      if(current?.hold && current.cinemaShots?.length){
        const sequence=current.cinemaShots;
        const index=sequence.findLastIndex(shot=>shot.at<=player.t);
        if(index<0)return;
        activeShot=sequence[index];
        const end=sequence[index+1]?.at??current.total;
        const effect=current.cinemaEffects?.findLast(fx=>fx.at<=player.t && fx.until>player.t);
        const cut=current.cues.findLast(cue=>cue.kind==='cut' && cue.cut==='black' && cue.t<=player.t && player.t<cue.t+Math.max(100,cue.dur));
        stage.frame(activeShot,activeEvent,(player.t-activeShot.at)/(end-activeShot.at),player.t,effect,!!cut,current.cues,current.total,current.faceTrack);
      }
    }
  };
}
