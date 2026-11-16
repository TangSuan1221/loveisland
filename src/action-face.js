import firstScenes from './performance/emotion-s-first.js';
import laterScenes from './performance/emotion-s-later.js';
import stories from './performance/emotion-stories.js';
const reactions={...firstScenes,...laterScenes,...stories};
const tone={warm:'delight',subdued:'sad',tension:'angry',comic:'wary',discovery:'wary',blush:'tender',floral:'tender',stars:'delight'};
export function reactionAt(id,role,progress){
 const cue=reactions[id];if(!cue)return {};
 const [theme,start,end,who]=cue;
 if(progress<start||progress>end||(who!=='both'&&who!==['a','b','c'][role]))return {};
 return {mood:tone[theme],blush:theme==='blush'||theme==='floral'};
}
import {BufferGeometry,DoubleSide,Float32BufferAttribute,Group,Mesh,MeshBasicMaterial} from 'three';

const lockedFaces=new WeakMap();
let writingCinema=false;
export function lockCinemaFace(actor,seed){
 const channel={blinkTimes:[],seed:seed>>>0,time:0,speech:undefined};
 lockedFaces.set(actor,channel);
 return ()=>{if(lockedFaces.get(actor)===channel)lockedFaces.delete(actor);};
}
export function sampleCinemaChannels(actors,cues,time,render){
 const dialogue=cues.some(c=>c.kind==='say');
 for(const [i,actor] of actors.entries()){
   const channel=lockedFaces.get(actor);
   if(!channel)continue;
   channel.time=time/1000;
   channel.speech=dialogue?cues.some(c=>c.kind==='say'&&(c.role||c.speaker)===['F','T','A'][i]&&c.t<=time&&time<c.t+c.dur):undefined;
 }
 writingCinema=true;
 try{return render();}finally{writingCinema=false;}
}
function cinemaBlink(channel){
 const times=channel.blinkTimes;
 while(!times.length||times[times.length-1]<channel.time+.12){
   channel.seed=(Math.imul(channel.seed,1664525)+1013904223)>>>0;
   times.push((times[times.length-1]||0)+2+3*channel.seed/4294967296);
 }
 const at=times.find(t=>t>=channel.time-.12);
 return Math.max(0,1-Math.abs(at-channel.time)/.115);
}
const cache=new WeakMap(),moods=new Map();
function assign(mood,ids){for(const id of ids.split(' ').map(Number))moods.set(id,mood);}
assign('delight','15 23 24 36 37 46 48 49 53 56 80 81 89 92 93 96 185 186');
assign('tender','57 58 75 76 104 105 126 158 159 163 164 183 184 187 188');
assign('wary','2 8 9 18 26 40 54 59 60 64 68 77 84 90 91 98 100 101 110 111 114 118 120 121 122 124 128 129 137 142 147 154 155 156 175 176 197 198 200 204 205');
assign('sad','20 52 62 85 97 102 103 108 109 112 113 125 138 139 140 141 171 181 182 189 190 191');
assign('strained','3 4 6 7 13 19 27 28 29 30 32 34 35 51 72 99 119 132 134 137 144 145 146 150 151 161 165 167 178 180 201 203 206 207');
assign('angry','50 79 107 127 131 133 202');
assign('sleepy','10 14 31 117 123');
const talking=new Set([38,39,42,43,44,46,50,51,52,55,57,59,60,61,62,63,64,66,68,69,70,73,75,77,78,79,82,84,85,88,90,92,96,98,102,104,106,110,115,123,126,127,130,136,138,155,163,171,172,179,181,188,189,191,192,197,198,202]);
const song=new Set([23,185,186]),chew=new Set([17,96,141]);
const shapes={
 focus:[.94,0,.02],delight:[.72,.014,.07],tender:[.76,.011,.10],wary:[1.09,-.003,.10],
 sad:[.68,-.014,.15],strained:[.61,-.007,-.08],angry:[.72,-.013,-.23],sleepy:[.43,-.002,.04]
};
function prepare(a){
 let s=cache.get(a);if(s?.head===a._head)return s;
 const head=a._head,layer=new Group();layer.name='performance-face';head.add(layer);
 const depth=a._faceDepth??(()=>.18);
 const mats=new Map();
 function ribbon(name,color,sample){
   const vertices=[],indices=[],N=18;
   for(let i=0;i<=N;i++){const u=i/N*2-1;for(const edge of [-1,1]){const [x,y,z]=sample(u,edge);vertices.push(x,y,depth(x,y)+z);}
     if(i){const k=2*i;indices.push(k-2,k-1,k,k,k-1,k+1);}}
   const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.setIndex(indices);
   let m=mats.get(color);if(!m){m=new MeshBasicMaterial({color,side:DoubleSide});mats.set(color,m);a._resources?.material.add(m);}
   const o=new Mesh(g,m);o.name=name;o.visible=false;layer.add(o);a._resources?.geometry.add(g);return o;
 }
 const cheeks=[],eyes=[];
 for(const eye of a._eyes){
   const {x,y}=eye.position,side=Math.sign(x);
   eyes.push(ribbon('closed-eyelid',0x402e31,(u,e)=>[x+u*.044*eye.scale.x,y+.012*(1-u*u)+e*.0035,.011]));
   for(let k=0;k<3;k++)cheeks.push(ribbon('blush-stroke',0xe67a86,(u,e)=>[x+side*(.006+.014*k)+.005*u+e*.0026,y-.057+.012*u,.009]));
 }
 const lip=a._mouth,forms={};
 for(const [name,w,h,c] of [['smile',.050,.003,.018],['frown',.044,.003,-.014],['pressed',.038,.002,0],['ah',.045,.023,.002],['ee',.054,.009,.007],['oh',.024,.026,0]]){
   forms[name]=ribbon('mouth-'+name,0x512b32,(u,e)=>[lip.position.x+u*w*a._mouthBaseScale.x,lip.position.y+(c*u*u+e*h*Math.sqrt(Math.max(.001,1-u*u)))*a._mouthBaseScale.y,.009]);
 }
 s={head,layer,eyes,cheeks,forms,brows:head.children.filter(o=>o.name==='brow').map(o=>[o,o.rotation.z,o.position.y]),active:false};cache.set(a,s);return s;
}
export function suspendActionFace(a){
 const previous=cache.get(a);
 if(!previous?.active)return ()=>{};
 const {last}=previous;
 clearActionFace(a);
 return ()=>sampleActionFace(a,last.n,last.t,last.options);
}
export function clearActionFace(a){
 if(lockedFaces.has(a)&&!writingCinema)return;
 const s=cache.get(a);if(!s?.active)return;
 s.layer.removeFromParent();s.layer.visible=false;a._mouth.visible=true;
 for(const [b,z,y] of s.brows){b.rotation.z=z;b.position.y=y;}
 for(const e of a._eyes){e.visible=true;e.scale.y=e.userData.baseScaleY??1;}
 s.active=false;
}
export function sampleActionFace(a,n,t,{role=0,mood=moods.get(n)??'focus',speech,closed=false,blush=false}={}){
 const channel=lockedFaces.get(a);
 if((channel&&!writingCinema)||!a._eyes?.length||!a._mouth)return;
 const s=prepare(a);if(!s.layer.parent)a._head.add(s.layer);s.layer.visible=true;s.active=true;
 s.last={n,t,options:{role,mood,speech,closed,blush}};
 const [lid,corner,tilt]=shapes[mood]??shapes.focus;
 const strength=.38+.62*Math.min(1,Math.max(0,t/.7));
 const phase=(t+.37*(a._phase||0)+role*.56)%3.16;
 const blink=channel?cinemaBlink(channel):Math.max(0,1-Math.abs(phase-1.21)/.115);
 s.layer.userData.blinkScale=1-.94*blink;
 const singing=song.has(n),shy=mood==='tender'&&(blush||[57,58].includes(n));
 const shut=closed||(n===31&&t<1.75&&t>.85)||(singing&&((t+.4*role)%3.2)<1.45)||(shy&&t>2.6&&t<3.18)||blink>.78;
 a._eyes.forEach((e,i)=>{e.visible=!shut;e.scale.y=(e.userData.baseScaleY??1)*(1+(lid-1)*strength)*(1-.94*blink);s.eyes[i].visible=shut;});
 for(const o of s.cheeks)o.visible=shy&&t>.64;
 for(const [b,z,y] of s.brows){b.rotation.z=z-Math.sign(b.position.x)*tilt*strength;b.position.y=y+(mood==='wary'?.009:mood==='sad'?.004:0)*strength;}
 const syllable=(channel?.time??t)*(singing?2.9:4.15)+role*.22;
 const voiced=channel?.speech??speech??(singing||talking.has(n));
 let form=corner>.004?'smile':corner<-.006?'frown':mood==='strained'?'pressed':null;
 if(voiced&&syllable%3.8<3.04)form=['ah','ee','oh','pressed'][Math.floor(syllable*1.36)%4];
 else if(chew.has(n))form=Math.sin(t*6)>0?'oh':'pressed';
 else if([6,19,24,30,31,151,205].includes(n)&&Math.sin(t*2.4)>.18)form='oh';
 s.layer.userData.voicing=voiced&&syllable%3.8<3.04;
 a._mouth.visible=!form;for(const [name,mesh] of Object.entries(s.forms))mesh.visible=name===form;
}
const cueMoods={neutral:'focus',blank:'focus',deadpan:'sleepy',careless:'delight',blush:'tender',cry:'sad',deject:'sad',desperate:'strained',good:'delight',irritate:'angry',shock:'wary',smile:'delight',sweat:'strained',worry:'wary'};
export function cueExpression(cues,ms,role){
 const tag=['F','T','A'][role];
 const dialogue=cues.some(c=>c.kind==='say');
 let emote,speech=false;
 for(const c of cues){
   if(c.t>ms)break;
   if(c.role!==tag)continue;
   if((c.kind==='say'||c.kind==='face')&&c.emote)emote=c.emote.toLowerCase();
   if(c.kind==='say'&&ms<c.t+(c.dur??1500))speech=true;
 }
 const result=dialogue?{speech}:{};
 if(emote&&cueMoods[emote])Object.assign(result,{mood:cueMoods[emote],blush:emote==='blush'});
 return result;
}
export function sceneMood(type,role){
 if(/mutual-feeling|confess|couple/.test(type))return 'tender';
 if(/breakup|leave|grief|declined|breaks|unresolved|sad|abandon/.test(type))return role?'sad':'strained';
 if(/fight|argue|disagree|conflict|contest/.test(type))return role===2?'wary':'angry';
 if(/comfort|supported|care/.test(type))return role?'sad':'tender';
 if(/connected|reconciled|allied|created|success|celebrat|sing|play/.test(type))return 'delight';
 if(/steal|secret|discover|surprise/.test(type))return 'wary';
 return 'focus';
}
