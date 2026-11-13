from pathlib import Path
def edit(file,replacements):
 p=Path('src')/file;s=p.read_text(encoding='utf8')
 for old,new in replacements:
  assert old in s,(file,old[:100]);s=s.replace(old,new,1)
 p.write_text(s,encoding='utf8')
edit('avatar-schema.js',[
 ("import {FEATURE_OPTIONS}","import {ANIME_OPTIONS,ANIME_RANGES,ANIME_DEFAULTS,ANIME_PRESETS} from './avatar-anime.js';\nimport {normalizeFaceArt} from './avatar-face-art.js';\nimport {FEATURE_OPTIONS}"),
 ("['drama','都市叙事']","['anime','动漫平涂'],['drama','都市叙事']"),
 ("APPEARANCE_OPTIONS.faceShape.push", "for(const [key,entries]of Object.entries(ANIME_OPTIONS))APPEARANCE_OPTIONS[key]=[...entries.map(([value,label])=>({value,label})),...(APPEARANCE_OPTIONS[key]||[])];\nAPPEARANCE_OPTIONS.faceShape.push"),
 ("export const APPEARANCE_RANGES = {","export const APPEARANCE_RANGES = {...ANIME_RANGES,"),
 ("Object.freeze({...BASE_APPEARANCE,...EXTRA_DEFAULTS})","Object.freeze({...BASE_APPEARANCE,...EXTRA_DEFAULTS,...ANIME_DEFAULTS,faceArt:[]})"),
 (" return out;"," out.faceArt=normalizeFaceArt(input.faceArt);\n return out;"),
 ("export const ART_PRESETS = [","export const ART_PRESETS = [...ANIME_PRESETS,")])
edit('avatar-hair-catalog.js',[
 ("import ","import {ANIME_FRONT,ANIME_BACK,animeHairIcon,buildAnimeHair} from './avatar-anime-hair.js';\nimport "),
 ("export const HAIR_FRONT_OPTIONS=","for(const d of ANIME_FRONT)HAIR_FRONT_DESIGNS[d.value]=d;\nfor(const d of ANIME_BACK)HAIR_BACK_DESIGNS[d.value]=d;\nexport const HAIR_FRONT_OPTIONS="),
 (" const {front,back}=resolveHairParts(a),fd=HAIR_FRONT_DESIGNS[front],bd=HAIR_BACK_DESIGNS[back];"," const {front,back}=resolveHairParts(a),fd=HAIR_FRONT_DESIGNS[front]?.family==='anime'?null:HAIR_FRONT_DESIGNS[front],bd=HAIR_BACK_DESIGNS[back]?.family==='anime'?null:HAIR_BACK_DESIGNS[back];"),
 (" if(fd){const c=", " buildAnimeHair({a,front,back,surface,lock,frontAt,faceScale});\n if(fd){const c=")])
p=Path('src/avatar-hair-catalog.js');s=p.read_text(encoding='utf8');start=s.index('export function hairPartIcon');idx=s.index('\n',start);s=s[:idx]+"\n if(d.family==='anime')return animeHairIcon(value);"+s[idx:];p.write_text(s,encoding='utf8')
edit('avatar-material.js',[
 ("if(style==='satire') {","if(style==='anime'){\n    material.colorNode=mix(base.mul(vec3(.88,.84,.86)),base,step(.10,light));\n  }else if(style==='satire') {"),
 ("width*=style==='satire'","width*=style==='anime'?1.1:style==='satire'")])
edit('avatar-model.js',[
 ("import {FEATURE_PROFILES", "import {drawAnimeEye,drawAnimeNose,drawAnimeMouth} from './avatar-anime.js';\nimport {drawAppearancePaint} from './avatar-face-art.js';\nimport {FEATURE_PROFILES"),
 ("if(style==='drama')x*=", "if(style==='anime')x*=1-.045*lower;else if(style==='drama')x*="),
 ("if(y<0)y*=a.chinLength;", "if(y<0)y*=a.chinLength*(style==='anime'?.9:1);"),
 ("z*=1+.035*bump", "if(style!=='anime')z*=1+.035*bump"),
 ("const headRatio=a.artStyle==='satire'?.88:.78", "const headRatio=a.artStyle==='anime'?.88:a.artStyle==='satire'?.88:.78"),
 ("if(drawCatalogEye({", "if(drawAnimeEye({a,e,side,eyeColor,facialPatch,facialLine,ovalPoints})){}\n  else if(drawCatalogEye({"),
 ("  drawEyeDetails({", "  if(!a.eyeStyle.startsWith('anime_'))drawEyeDetails({"),
 ("  const np=FEATURE_PROFILES[a.noseStyle]", "  if(!drawAnimeNose({a,n,facialPatch,facialLine,ovalPoints})){\n  const np=FEATURE_PROFILES[a.noseStyle]"),
 (" const mx=a.mouthX", " }\n const mx=a.mouthX"),
 ("if(!drawCatalogMouth({", "if(!drawAnimeMouth({a,mouth,facialLine})&&!drawCatalogMouth({"),
 ("if(a.strokes.length&&typeof document", "if((a.strokes.length||a.faceArt.length)&&typeof document")])
p=Path('src/avatar-model.js');s=p.read_text(encoding='utf8');start=s.index(" const canvas=document.createElement('canvas');canvas.width=canvas.height=512;");end=s.index(' const geo=own(createFacePaintGeometry(a))',start);s=s[:start]+" const canvas=document.createElement('canvas');canvas.width=canvas.height=512;drawAppearancePaint(canvas.getContext('2d'),a,512);\n"+s[end:];p.write_text(s,encoding='utf8')
edit('avatar-editor.js',[
 ("import * as THREE", "import {mountFaceArtEditor} from './avatar-face-art-editor.js';\nimport * as THREE"),
 ("eyes:['eyeStyle',", "eyes:['eyeStyle','irisPattern','irisSize','pupilSize','irisX','irisY','eyeInk','eyeInkColor',"),
 ("const PRESETS = ART_PRESETS;", "const PRESETS = ART_PRESETS;\nObject.assign(LABELS,{irisPattern:'瞳孔图案（动漫眼）',irisSize:'虹膜大小（动漫眼）',pupilSize:'瞳孔大小（动漫眼）',irisX:'视线左右（动漫眼）',irisY:'视线上下（动漫眼）',eyeInk:'眼线粗细（动漫眼）',eyeInkColor:'眼线颜色（动漫眼）'});"),
 ("{{drama:","{{drama:") if False else ("${{drama:","${{anime:'短脸比例 · 图形眼线 · 柔和分色',drama:"),
 (" function renderPanel(){if(!dialog||!draft)return;", " let faceArtUI=null;const faceArtState={tool:'select',selected:null,color:'#49303f',mirror:false};\n function renderPanel(){if(!dialog||!draft)return;faceArtUI?.dispose();faceArtUI=null;")])
p=Path('src/avatar-editor.js');s=p.read_text(encoding='utf8');start=s.index(' function paintHTML()');end=s.index('\n',s.index(' function bindPaint()',start));s=s[:start]+''' function paintHTML(){return '<div class="av-face-art"></div>';}
 function drawPaint(){faceArtUI?.draw();}
 function bindPaint(){faceArtUI=mountFaceArtEditor(q('.av-face-art'),{get:()=>draft.appearance,snapshot,change,remember,status,state:faceArtState});}
'''+s[end:];s=s.replace("change({strokes:[]})","change({strokes:[],faceArt:[]})");p.write_text(s,encoding='utf8')
print('Integrated anime modules and paint editor hooks')
