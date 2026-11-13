import fs from 'node:fs';
let p='src/avatar-anime.js',s=fs.readFileSync(p,'utf8');s=s.replace("h*cubic(a.eyeInnerY,a[upper?'eyeUpperInnerY':'eyeLowerInnerY'],a[upper?'eyeUpperOuterY':'eyeLowerOuterY'],a.eyeOuterY,t)*(upper?1-a.eyeLid*.28:1)","h*cubic(a.eyeInnerY,a[upper?'eyeUpperInnerY':'eyeLowerInnerY']*(upper?1-a.eyeLid*.28:1),a[upper?'eyeUpperOuterY':'eyeLowerOuterY']*(upper?1-a.eyeLid*.28:1),a.eyeOuterY,t)");s=s.replace("for(const [outer,inner]of [[.75,.69],[.48,.42]]){","for(const [outer,inner,lift]of [[.75,.69,.0061],[.48,.42,.0065]]){");s=s.replace("ink,.0061);","ink,lift);").replace("eyeColor,.0064);","eyeColor,lift+.0002);");fs.writeFileSync(p,s);
p='src/avatar-schema.js';s=fs.readFileSync(p,'utf8');s=s.replace("'eyeInkColor'","'eyeInkColor','noseInkColor'");fs.writeFileSync(p,s);
p='src/avatar-editor.js';s=fs.readFileSync(p,'utf8');
s="import {mountEyeShapeEditor} from './avatar-eye-shape-editor.js';\n"+s;
s=s.replace("'irisSize','pupilSize'","'irisSize','irisAspect','irisRingInk','pupilSize'").replace("'eyeInk','eyeInkColor'","'eyeInk','eyeLowerInk','animeLashLength','eyeInkColor'").replace("nose:['noseStyle',","nose:['noseStyle','noseInkColor',").replace("mouth:['mouthStyle',","mouth:['mouthStyle','mouthCurve','mouthInk',");
s=s.replace("const PRESETS = ART_PRESETS;","Object.assign(LABELS,{irisAspect:'虹膜宽高比',irisRingInk:'环瞳线条粗细',eyeLowerInk:'下眼线粗细',animeLashLength:'动漫睫毛长度',noseInkColor:'动漫鼻线颜色',mouthCurve:'动漫嘴角弧度',mouthInk:'动漫嘴线粗细'});\nconst PRESETS = ART_PRESETS;");
s=s.replace('let faceArtUI=null;','let eyeShapeUI=null;let faceArtUI=null;');
s=s.replaceAll('faceArtUI?.dispose();faceArtUI=null;','eyeShapeUI?.destroy();eyeShapeUI=null;faceArtUI?.dispose();faceArtUI=null;');
s=s.replace("(FIELDS[category]||[]).map(fieldHTML).join('');", "(category==='eyes'?'<div class=\"av-eye-shape-host\"></div>':'')+(FIELDS[category]||[]).map(fieldHTML).join('');");
s=s.replace("if(category==='paint'){bindPaint();drawPaint();} }", "if(category==='paint'){bindPaint();drawPaint();}if(category==='eyes'){eyeShapeUI=mountEyeShapeEditor(q('.av-eye-shape-host'),{getAppearance:()=>draft.appearance,onChange:patch=>change(patch,{historyEntry:false}),onCommit:beforeAppearance=>remember({...snapshot(),appearance:clone(beforeAppearance)})});} }");
s=s.replace('function undo(redo=false){faceArtUI?.settle(true);','function undo(redo=false){eyeShapeUI?.destroy();eyeShapeUI=null;faceArtUI?.settle(true);');
// Category reset includes the control points, not just the visible sliders.
s=s.replace("eyes:['eyeStyle',","eyes:['eyeInnerY','eyeOuterY','eyeUpperInnerX','eyeUpperInnerY','eyeUpperOuterX','eyeUpperOuterY','eyeLowerInnerX','eyeLowerInnerY','eyeLowerOuterX','eyeLowerOuterY','eyeStyle',");
// Control points are edited in the graph, not ten duplicate unlabeled sliders.
s=s.replace("(FIELDS[category]||[]).map(fieldHTML)","(FIELDS[category]||[]).filter(k=>!/^eye(InnerY|OuterY|Upper|Lower(Inner|Outer))/.test(k)).map(fieldHTML)");
fs.writeFileSync(p,s);
