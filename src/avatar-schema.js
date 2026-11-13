import {ANIME_OPTIONS,ANIME_RANGES,ANIME_DEFAULTS,ANIME_PRESETS} from './avatar-anime.js';
import {normalizeFaceArt} from './avatar-face-art.js';
import {FEATURE_OPTIONS} from './avatar-feature-catalog.js';
import {HAIR_FRONT_OPTIONS,HAIR_BACK_OPTIONS} from './avatar-hair-catalog.js';
import {FACE_ADDITIONS,DETAIL_OPTIONS} from './avatar-detail-catalog.js';
const opts = entries => entries.map(([value,label])=>({value,label}));
export const APPEARANCE_OPTIONS = {
 artStyle:opts([['anime','动漫平涂'],['drama','都市叙事'],['organic','异星手绘'],['satire','夸张喜剧']]),
 facialHair:opts([['none','无胡须'],['stubble','短胡茬'],['beard','络腮胡'],['moustache','短髭']]),
 faceShape:opts([['oval','鹅蛋脸'],['round','圆脸'],['square','方脸'],['heart','心形脸'],['long','长脸'],['diamond','菱形脸']]),
 hairStyle:opts([['crop','清爽短发'],['side','侧分短发'],['bob','波波头'],['bun','高丸子'],['braids','双编辫'],['curls','卷发'],['ponytail','高马尾'],['quiff','蓬松背头'],['afro','蓬松卷球'],['long','披肩长发'],['twintop','双丸子'],['twintails','长双马尾'],['spiky','热血尖刺'],['hime','姬式长发'],['mohawk','莫西干'],['bald','光头'],['pixie','精灵短发'],['waves','长波浪']]),
 eyeStyle:opts([['none','无眼睛'],['round','圆眼'],['almond','杏眼'],['anime','漫画大眼'],['narrow','细长眼'],['sleepy','半垂眼'],['dot','豆豆眼'],['sharp','上挑眼'],['closed','弯弯笑眼']]),
 browStyle:opts([['soft','柔弧眉'],['straight','平眉'],['arched','挑眉'],['thick','浓眉'],['thin','细眉'],['none','无眉']]),
 noseStyle:opts([['round','圆鼻'],['small','小鼻'],['point','尖鼻'],['wide','宽鼻'],['none','无鼻']]),
 mouthStyle:opts([['none','无嘴巴'],['smile','微笑'],['neutral','平嘴'],['pout','嘟嘴'],['open','张嘴'],['cat','猫咪嘴'],['grin','露齿笑'],['frown','垂嘴']]),
 outfit:opts([['tee','短袖套装'],['dress','连衣裙'],['hoodie','连帽衫'],['uniform','学院制服'],['jacket','短夹克'],['robe','长袍']]),
 glasses:opts([['none','无眼镜'],['round','圆框'],['square','方框'],['sunglasses','墨镜'],['monocle','单片镜']]),
 accessory:opts([['none','无配饰'],['bow','蝴蝶结'],['flower','花朵'],['catEars','猫耳'],['headband','发带'],['earrings','耳环'],['horns','小角']])
};
for(const [key,entries]of Object.entries(FEATURE_OPTIONS))APPEARANCE_OPTIONS[key]=[...(APPEARANCE_OPTIONS[key]||[]),...entries];
for(const [key,entries]of Object.entries(ANIME_OPTIONS))APPEARANCE_OPTIONS[key]=[...entries.map(([value,label])=>({value,label})),...(APPEARANCE_OPTIONS[key]||[])];
APPEARANCE_OPTIONS.faceShape.push(...FACE_ADDITIONS.map(({value,label})=>({value,label})));
Object.assign(APPEARANCE_OPTIONS,DETAIL_OPTIONS,{glassesLens:opts([['auto','沿用镜框默认'],['clear','透明镜片'],['tint','浅色镜片'],['opaque','深色镜片']]),hairFront:HAIR_FRONT_OPTIONS,hairBack:HAIR_BACK_OPTIONS});
export const APPEARANCE_RANGES = {...ANIME_RANGES,
 muzzleDepth:[0,.10,.002],muzzleWidth:[.7,1.3,.01],
 hairFrontLength:[.75,1.3,.01],hairBackLength:[.65,1.5,.01],hairVolume:[.85,1.25,.01],
 earSize:[.65,1.5,.01],browWidth:[.6,1.5,.01],browHeight:[.5,1.8,.01],glassesSize:[.7,1.3,.01],glassesY:[-.05,.05,.001],glassesThickness:[.35,1.8,.01],moleX:[-.19,.19,.001],moleY:[-.2,.16,.001],moleSize:[.4,2,.01],
 jawWidth:[.7,1.3,.01],chinLength:[.8,1.25,.01],noseBridge:[.5,1.6,.01],eyeLid:[0,1,.01],shoulderWidth:[.8,1.3,.01],bodyRatio:[.8,1.3,.01],
 faceWidth:[.8,1.2,.01],faceHeight:[.8,1.2,.01],eyeWidth:[.6,1.5,.01],eyeHeight:[.6,1.5,.01],browSpacing:[-.035,.045,.001],noseX:[-.04,.04,.001],mouthX:[-.05,.05,.001],mouthWidth:[.6,1.5,.01],mouthHeight:[.6,1.5,.01],mouthRotation:[-30,30,1],
 eyeSize:[.55,1.65,.01],eyeSpacing:[-.035,.045,.001],eyeY:[-.045,.05,.001],eyeRotation:[-30,30,1],
 browSize:[.45,1.8,.01],browY:[-.045,.07,.001],browRotation:[-35,35,1],noseSize:[.35,1.8,.01],noseY:[-.04,.04,.001],mouthSize:[.45,1.8,.01],mouthY:[-.10,.08,.001],headScale:[.8,1.25,.01],height:[.75,1.3,.01],build:[.7,1.4,.01],blush:[0,1,.01]
};
const BASE_APPEARANCE = Object.freeze({version:1,artStyle:'drama',jawWidth:1,chinLength:1,noseBridge:1,eyeLid:.25,shoulderWidth:1,bodyRatio:1,facialHair:'none',facialHairColor:'#3e3536',faceWidth:1,faceHeight:1,eyeWidth:1,eyeHeight:1,browSpacing:0,noseX:0,mouthX:0,mouthWidth:1,mouthHeight:1,mouthRotation:0,faceShape:'oval',skinColor:'#f2c6a6',hairStyle:'bob',hairColor:'#51382e',eyeStyle:'almond',eyeColor:'#615a48',rightEyeColor:'#5f93b9',heterochromia:false,eyeSize:1,eyeSpacing:0,eyeY:0,eyeRotation:0,browStyle:'soft',browColor:'#51382e',browSize:1,browY:0,browRotation:0,noseStyle:'small',noseSize:1,noseY:0,mouthStyle:'neutral',mouthColor:'#76534d',mouthSize:1,mouthY:0,headScale:1,height:1,build:1,outfit:'tee',topColor:'#e88966',bottomColor:'#6e8797',shoeColor:'#faf1dc',glasses:'none',glassesColor:'#443b49',accessory:'none',accessoryColor:'#f3c961',blush:.06,strokes:[]});
const EXTRA_DEFAULTS={muzzleDepth:0,muzzleWidth:1,muzzleTint:false,muzzleColor:'#c3a075',hairFrontLength:1,hairBackLength:1,hairVolume:1,browWidth:1,browHeight:1,glassesSize:1,glassesY:0,glassesThickness:1,glassesLens:'auto',moleStyle:'none',moleX:.075,moleY:-.145,moleSize:1,hairFront:'auto',hairBack:'auto',hairSecondaryColor:'#a87e61',hairTwoTone:false,hairMirror:false,earStyle:'natural',earSize:1,freckles:'none',wrinkles:'none',makeup:'none',detailColor:'#916756',makeupColor:'#9b6a78',eyeLashes:'none',lowerLashes:'none',upperEyeFold:'none',lowerEyeFold:'none',eyeHighlight:'none',upperWrinkles:'none',lowerWrinkles:'none',mustacheStyle:'none',beardStyle:'none',stubbleStyle:'none'};
export const DEFAULT_APPEARANCE=Object.freeze({...BASE_APPEARANCE,...EXTRA_DEFAULTS,...ANIME_DEFAULTS,faceArt:[]});
const colors=[...Object.keys(DEFAULT_APPEARANCE),...Object.keys(EXTRA_DEFAULTS)].filter(k=>k.endsWith('Color'));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function normalizeAppearance(input={}) {
 if(!input||typeof input!=='object'||Array.isArray(input))input={};
 const out={...DEFAULT_APPEARANCE,...EXTRA_DEFAULTS,strokes:[]};let remainingPoints=30000;
 for(const [key,options] of Object.entries(APPEARANCE_OPTIONS))if(options.some(o=>o.value===input[key]))out[key]=input[key];
 for(const key of colors)if(typeof input[key]==='string'&&/^#[\da-f]{6}$/i.test(input[key]))out[key]=input[key].toLowerCase();
 for(const [key,[min,max]]of Object.entries(APPEARANCE_RANGES))if(typeof input[key]==='number'&&Number.isFinite(input[key]))out[key]=clamp(input[key],min,max);
 out.heterochromia=input.heterochromia===true;out.muzzleTint=input.muzzleTint===true;
 out.hairTwoTone=input.hairTwoTone===true;out.hairMirror=input.hairMirror===true;
 if(Array.isArray(input.strokes))out.strokes=input.strokes.slice(0,300).filter(s=>s&&Array.isArray(s.points)).map(s=>({color:typeof s.color==='string'&&/^#[\da-f]{6}$/i.test(s.color)?s.color:'#222222',width:clamp(Number.isFinite(s.width)?s.width:.015,.002,.2),tool:s.tool==='eraser'?'eraser':'pen',points:s.points.slice(0,2000).filter(p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])).map(p=>[clamp(p[0],0,1),clamp(p[1],0,1)])})).filter(s=>s.points.length).map(s=>{s.points=s.points.slice(0,remainingPoints);remainingPoints-=s.points.length;return s;}).filter(s=>s.points.length);
 // Ordered handles keep edited eyelids monotonic, including imported files.
 for(const [inner,outer]of [['eyeUpperInnerX','eyeUpperOuterX'],['eyeLowerInnerX','eyeLowerOuterX']])if(out[inner]>out[outer])[out[inner],out[outer]]=[out[outer],out[inner]];
 out.faceArt=normalizeFaceArt(input.faceArt);
 return out;
}
const LEGACY_DEFAULTS={
lin:['#f4c6a0','#583d31','bob','#e88966','#f1dfb6'],zhou:['#dca984','#302e2b','crop','#648e77','#d5c3a1'],qiao:['#f3c7aa','#6b4838','bun','#c49cd4','#ece3d2'],lu:['#efc39f','#3c3534','side','#77a8bf','#56687a'],tang:['#edb68f','#92583a','braids','#e4bb60','#8ea99a'],chen:['#bd8c6d','#322b29','curls','#df8177','#738989'],yao:['#edbfa0','#392d3c','ponytail','#aa547b','#dfcbb8'],xu:['#d6a07e','#a79c8c','quiff','#344d73','#c6b49c'],song:['#bb8568','#342d28','afro','#e19845','#496c70'],he:['#f0c9ad','#2f3439','long','#437d86','#ece1c9'],ning:['#e1b28c','#714a36','pixie','#925f49','#484e64'],bai:['#c99379','#bba785','twintop','#d6d3e4','#6b5681']};
const CAST_DESIGNS={
 lin:{faceShape:'heart',jawWidth:.94,eyeLid:.2,mouthStyle:'smile',mouthSize:.86,topColor:'#a66f5c',bottomColor:'#596569'},
 zhou:{artStyle:'organic',faceShape:'square',jawWidth:1.08,eyeStyle:'narrow',bodyRatio:1.08,topColor:'#6f7d6d',bottomColor:'#706959'},
 qiao:{faceShape:'oval',eyeStyle:'almond',eyeLid:.16,mouthStyle:'smile',topColor:'#89768b',bottomColor:'#4c535e'},
 lu:{faceShape:'long',jawWidth:.9,eyeStyle:'narrow',eyeLid:.34,bodyRatio:1.12,topColor:'#607687',bottomColor:'#394652'},
 tang:{artStyle:'organic',faceShape:'round',eyeStyle:'almond',mouthStyle:'smile',topColor:'#b09766',bottomColor:'#627d70'},
 chen:{artStyle:'organic',faceShape:'diamond',facialHair:'stubble',eyeLid:.35,topColor:'#9b6c5d',bottomColor:'#526462'},
 yao:{faceShape:'long',eyeStyle:'sharp',eyeLid:.26,topColor:'#866474',bottomColor:'#4b5157'},
 xu:{faceShape:'square',jawWidth:1.1,browStyle:'straight',bodyRatio:1.1,topColor:'#47566c',bottomColor:'#747166'},
 song:{artStyle:'satire',faceShape:'round',eyeStyle:'round',eyeLid:.1,mouthStyle:'smile',topColor:'#b28d4b',bottomColor:'#4c6c72'},
 he:{artStyle:'organic',faceShape:'diamond',jawWidth:1.12,shoulderWidth:1.16,eyeStyle:'sharp',topColor:'#55777a',bottomColor:'#6d756c'},
 ning:{faceShape:'heart',eyeLid:.2,eyeStyle:'almond',mouthStyle:'smile',topColor:'#8e6f5d',bottomColor:'#495466'},
 bai:{artStyle:'satire',faceShape:'square',jawWidth:1.12,eyeStyle:'sleepy',eyeLid:.4,topColor:'#8b8791',bottomColor:'#635b70'}
};
export function appearanceForCandidate(candidate={}){
 if(candidate.appearance)return normalizeAppearance(candidate.appearance);
 const d=(LEGACY_DEFAULTS[candidate.id]||LEGACY_DEFAULTS[candidate.avatarId]);if(d)candidate={skin:d[0],hair:d[1],style:d[2],color:d[3],pants:d[4],...candidate};
 return normalizeAppearance({eyeStyle:'almond',mouthStyle:'neutral',eyeLid:.25,blush:.06,facialHairColor:candidate.hair,skinColor:candidate.skin,hairColor:candidate.hair,browColor:candidate.hair,hairStyle:APPEARANCE_OPTIONS.hairStyle.some(o=>o.value===candidate.style)?candidate.style:d?.[2],topColor:candidate.color,bottomColor:candidate.pants,glasses:candidate.style==='side'?'round':'none',outfit:candidate.style==='braids'?'dress':'tee',...(CAST_DESIGNS[candidate.id]||CAST_DESIGNS[candidate.avatarId]||{})});
}

// Original cast studies: the same presets drive the editor and visual regression gallery.
export const ART_PRESETS = [...ANIME_PRESETS,
 {name:'夜班学者',note:'都市叙事 · 长脸、平眉与圆框',color:'#68737d',values:{artStyle:'drama',faceShape:'long',faceWidth:.95,jawWidth:.9,chinLength:1.08,hairStyle:'long',hairColor:'#302b31',eyeStyle:'almond',eyeSize:.88,eyeLid:.38,eyeColor:'#665e54',browStyle:'straight',browColor:'#29272c',noseStyle:'point',noseBridge:1.12,mouthStyle:'neutral',mouthWidth:.92,skinColor:'#b99483',glasses:'round',glassesColor:'#34303a',outfit:'jacket',topColor:'#626878',bottomColor:'#303b48',shoeColor:'#39363b',bodyRatio:1.15,headScale:.94,shoulderWidth:.93,blush:0}},
 {name:'旷野调查员',note:'异星手绘 · 颧骨、短发与沙土色',color:'#8c9378',values:{artStyle:'organic',faceShape:'diamond',jawWidth:1.06,chinLength:1.06,hairStyle:'pixie',hairColor:'#53483c',eyeStyle:'narrow',eyeLid:.3,eyeColor:'#586857',browStyle:'soft',browColor:'#53483c',noseStyle:'point',noseBridge:1.12,mouthStyle:'neutral',skinColor:'#cfab88',outfit:'jacket',topColor:'#a3a087',bottomColor:'#5c665b',shoeColor:'#5a5146',bodyRatio:1.1,headScale:.96,height:1.06,blush:.03}},
 {name:'边境队长',note:'都市叙事 · 方颌、浓眉与络腮胡',color:'#97775f',values:{artStyle:'drama',faceShape:'square',jawWidth:1.22,chinLength:1.04,faceWidth:1.06,hairStyle:'crop',hairColor:'#76503e',eyeStyle:'sharp',eyeSize:.85,eyeLid:.45,eyeColor:'#516470',browStyle:'thick',browColor:'#5b3d32',noseStyle:'wide',noseBridge:1.28,mouthStyle:'frown',mouthWidth:1.1,skinColor:'#c5a18b',facialHair:'beard',facialHairColor:'#76503e',outfit:'uniform',topColor:'#526474',bottomColor:'#34414c',accessoryColor:'#c5aa71',bodyRatio:1.12,shoulderWidth:1.25,build:1.12,headScale:.98,height:1.1,blush:0}},
 {name:'雨城信使',note:'都市叙事 · 侧分发束与冷暖配色',color:'#748a91',values:{artStyle:'drama',faceShape:'heart',jawWidth:.88,chinLength:1.08,hairStyle:'side',hairColor:'#302d34',eyeStyle:'almond',eyeSize:.94,eyeRotation:-5,eyeLid:.18,eyeColor:'#60666b',browStyle:'straight',browColor:'#302d34',noseStyle:'point',mouthStyle:'smile',mouthSize:.83,skinColor:'#d7b49c',outfit:'hoodie',topColor:'#758b99',bottomColor:'#3d4654',shoeColor:'#d3c4ab',bodyRatio:1.08,shoulderWidth:.9,build:.94,headScale:.94,blush:.04}},
 {name:'荒原旅人',note:'异星手绘 · 深肤、短胡茬与赭红',color:'#ab7c60',values:{artStyle:'organic',faceShape:'long',jawWidth:.96,chinLength:1.1,hairStyle:'quiff',hairColor:'#352d29',eyeStyle:'sleepy',eyeLid:.42,eyeColor:'#544c3e',browStyle:'thick',browColor:'#352d29',noseStyle:'wide',noseBridge:1.35,mouthStyle:'neutral',skinColor:'#a7765d',facialHair:'stubble',facialHairColor:'#352d29',outfit:'robe',topColor:'#b37858',bottomColor:'#635f53',accessoryColor:'#b6a181',shoeColor:'#453d36',bodyRatio:1.2,headScale:.94,height:1.12,blush:0}},
 {name:'周末喜剧人',note:'夸张喜剧 · 圆眼、弧鼻与明黄色',color:'#c9ae5e',values:{artStyle:'satire',faceShape:'round',jawWidth:1.14,chinLength:.9,hairStyle:'curls',hairColor:'#55423b',eyeStyle:'round',eyeSize:1.06,eyeLid:0,eyeColor:'#302e30',browStyle:'soft',browColor:'#55423b',noseStyle:'round',noseBridge:1.25,noseSize:1.2,mouthStyle:'grin',mouthWidth:1.15,skinColor:'#e1bc58',outfit:'tee',topColor:'#e9e3cb',bottomColor:'#5d819c',shoeColor:'#4b4743',bodyRatio:.9,shoulderWidth:1.12,build:1.15,headScale:1.04,blush:0}}
];
ART_PRESETS.push(
 {name:'银发建筑师',note:'细框眼镜 · 银灰侧分 · 额部纹理',color:'#8a9291',values:{hairFront:'part_2',hairBack:'cropped_2',hairColor:'#93918a',faceShape:'rectangle',eyeStyle:'eye_hooded_natural',browStyle:'brow_flat_medium',browColor:'#595653',noseStyle:'nose_roman',mouthStyle:'mouth_smile_small',glasses:'glasses_wire',glassesColor:'#363a3b',upperWrinkles:'double',lowerWrinkles:'nasolabial',detailColor:'#a17b69',outfit:'jacket',topColor:'#454c50',skinColor:'#d7ac8c',blush:0}},
 {name:'林间信使',note:'精灵耳 · 双编辫 · 雀斑',color:'#75917c',values:{artStyle:'organic',faceShape:'tapered',earStyle:'pointed',hairFront:'curtain_2',hairBack:'twinbraids_3',hairColor:'#76543d',hairTwoTone:true,hairSecondaryColor:'#c2945a',eyeStyle:'eye_soft_natural',eyeColor:'#728c61',eyeHighlight:'dot',freckles:'cheeks',detailColor:'#8f5e40',mouthStyle:'mouth_smile_small',outfit:'robe',topColor:'#758872',bottomColor:'#5c6f60',skinColor:'#e1bd95'}},
 {name:'霓虹鼓手',note:'尖发挑染 · 粗眼线 · 不对称分缝',color:'#9a7898',values:{faceShape:'diamond',hairFront:'spikes_6',hairBack:'mullet_2',hairColor:'#3a3547',hairTwoTone:true,hairSecondaryColor:'#b96c94',eyeStyle:'eye_fierce_bold',eyeColor:'#9d839e',browStyle:'brow_rise_bold',noseStyle:'nose_wedge',mouthStyle:'mouth_smirk_normal',makeup:'wing',makeupColor:'#94718b',outfit:'jacket',topColor:'#56506d',skinColor:'#d5b4a4',accessory:'earrings'}},
 {name:'午后漫画家',note:'圆框 · 小瞳圆眼 · 蓬松卷发',color:'#c2a269',values:{artStyle:'satire',faceShape:'button',hairFront:'curl_2',hairBack:'curls_2',hairColor:'#72543f',eyeStyle:'eye_round_smallIris',eyeColor:'#493c34',glasses:'glasses_round_wide',mouthStyle:'mouth_grit_normal',skinColor:'#eac370',outfit:'tee',topColor:'#c3cbb0',bodyRatio:.95}},
 {name:'雪原领航员',note:'方颌 · 独立胡须层 · 风霜面纹',color:'#7f8d9b',values:{faceShape:'trapezoid',jawWidth:1.12,hairFront:'quiff_2',hairBack:'sweptback_2',hairColor:'#b9b0a1',browStyle:'brow_flat_bold',browColor:'#817365',eyeStyle:'eye_fierce_natural',noseStyle:'nose_broad',mouthStyle:'mouth_thin_normal',facialHair:'beard_boxed',facialHairColor:'#a69986',upperWrinkles:'crows',lowerWrinkles:'mature',skinColor:'#c5a18c',outfit:'uniform',topColor:'#65778b'}},
 {name:'月光剧场',note:'心形高光 · 长直发 · 弓形唇',color:'#9591b4',values:{faceShape:'heart',hairFront:'point_2',hairBack:'straight_3',hairColor:'#45405c',hairTwoTone:true,hairSecondaryColor:'#a19ac2',eyeStyle:'eye_doll_lash',eyeColor:'#8a79b0',eyeHighlight:'heart',lowerLashes:'three',browStyle:'brow_arch_fine',mouthStyle:'mouth_bow_small',makeup:'upper',makeupColor:'#bca0b5',skinColor:'#ead0bd',outfit:'dress',topColor:'#8c7b9e',accessory:'bow',accessoryColor:'#c7aed4'}}
);

ART_PRESETS.push(
 {name:'晨光研究员',note:'贴头侧分 · 渐短鬓发 · 细矩框',color:'#899690',values:{hairFront:'closepart_2',hairBack:'taper_2',hairColor:'#99968d',faceShape:'pear',faceWidth:.92,eyeStyle:'eye_hooded_natural',browStyle:'brow_flat_medium',browColor:'#645d54',glasses:'glasses_rectangle',glassesThickness:.55,glassesSize:1.08,upperWrinkles:'double',lowerWrinkles:'nasolabial',mouthStyle:'mouth_smile_small',outfit:'jacket',topColor:'#414c53',skinColor:'#d5aa8d'}},
 {name:'疾风旅客',note:'不均匀扇形尖发 · 放射后簇',color:'#bd8864',values:{hairFront:'fan_2',hairBack:'fanspikes_2',hairColor:'#302b32',faceShape:'tapered',jawWidth:.88,eyeStyle:'eye_fierce_natural',browStyle:'brow_rise_bold',browColor:'#302b32',mouthStyle:'mouth_smirk_normal',outfit:'uniform',topColor:'#bc784d',skinColor:'#e3b391'}},
 {name:'旧城歌手',note:'波纹侧分 · 短弹卷 · 唇弓',color:'#b88d8b',values:{hairFront:'fingerwave_3',hairBack:'ringlets_2',hairColor:'#cfb176',faceShape:'heart',eyeStyle:'eye_soft_natural',eyeLashes:'fan',browStyle:'brow_arch_fine',browColor:'#89724e',mouthStyle:'mouth_bow_small',mouthColor:'#a8555d',moleStyle:'round',outfit:'dress',topColor:'#637d80',skinColor:'#e9c8b4'}},
 {name:'夜色琴师',note:'齐切姬发 · 长直后发 · 可调发长',color:'#7f859e',values:{hairFront:'hime_2',hairBack:'straight_2',hairFrontLength:1.08,hairBackLength:1.15,hairColor:'#353546',faceShape:'long',faceWidth:.93,eyeStyle:'eye_soft_natural',eyeColor:'#777aa0',browStyle:'brow_flat_fine',browColor:'#353546',mouthStyle:'mouth_thin_normal',outfit:'robe',topColor:'#737a93',skinColor:'#dfc5b6'}}
);
