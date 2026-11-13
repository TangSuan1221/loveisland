import {readFileSync,writeFileSync} from 'node:fs';
const edit=(p,old,next)=>{const text=readFileSync(p,'utf8');if(!text.includes(old))throw new Error('missing '+old.slice(0,80));writeFileSync(p,text.replace(old,next));};
edit('src/avatar-model.js',"const edge=v<.68?1-.12*v/.68:.88*(1-v)/.32;","const edge=v<.68?1-.30*v/.68:.70*(1-v)/.32;");
edit('src/avatar-anime.js',"irisPattern:'rings',irisSize:.77","irisPattern:'rings',irisSize:.64");
edit('src/avatar-anime.js','noseY:-.044','noseY:-.04');
edit('src/avatar-editor.js',"function undo(redo=false){eyeShapeUI?.destroy();eyeShapeUI=null;faceArtUI?.settle(true);const from=redo?future:history,to=redo?history:future;if(!from.length)return;", "function undo(redo=false){eyeShapeUI?.destroy();eyeShapeUI=null;faceArtUI?.settle(true);const from=redo?future:history,to=redo?history:future;if(!from.length){renderPanel();updateFooter();return;}");
edit('src/avatar-editor.js',"onChange:patch=>change(patch,{historyEntry:false}),onCommit:beforeAppearance", "onChange:patch=>{change(patch,{historyEntry:false});if(Object.hasOwn(patch,'eyeStyle'))syncEyeSelection();},onCommit:beforeAppearance");
edit('src/avatar-editor.js'," function paintHTML(){", ` function syncEyeSelection(){const value=draft.appearance.eyeStyle,field=q('[data-catalog="eyeStyle"]');if(!field)return;field.querySelectorAll('[data-field="eyeStyle"]').forEach(button=>{const selected=button.dataset.value===value;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});field.querySelector('.av-catalog-selected').textContent='当前：'+(APPEARANCE_OPTIONS.eyeStyle.find(o=>o.value===value)?.label||'');}
 function paintHTML(){`);
// Existing range checks must exercise a legal ordered pair for dependent coordinates.
edit('qa/avatar-model.test.mjs', "for(const [key,[min,max]]of Object.entries(APPEARANCE_RANGES)){assert.equal(normalizeAppearance({[key]:-Infinity})[key],DEFAULT_APPEARANCE[key]);assert.equal(normalizeAppearance({[key]:-1e6})[key],min);assert.equal(normalizeAppearance({[key]:1e6})[key],max);}", `for(const [key,[min,max]]of Object.entries(APPEARANCE_RANGES)){
 const pair=key.startsWith('eyeUpper')&&key.endsWith('X')?['eyeUpperInnerX','eyeUpperOuterX']:key.startsWith('eyeLower')&&key.endsWith('X')?['eyeLowerInnerX','eyeLowerOuterX']:[];
 assert.equal(normalizeAppearance({[key]:-Infinity})[key],DEFAULT_APPEARANCE[key]);
 for(const [raw,expected]of [[-1e6,min],[1e6,max]]){const input=Object.fromEntries(pair.map(k=>[k,raw]));input[key]=raw;assert.equal(normalizeAppearance(input)[key],expected,key);}
}`);
edit('qa/avatar-reference-review.html','左：上一版 / 中：本轮 / 右：本轮去发检查。','左：旧参数（使用当前绘制器） / 中：本轮 / 右：本轮去发检查。');
edit('qa/avatar-reference-review.html',"[['上一版',old]","[['旧参数',old]");
edit('qa/avatar-reference-review.mjs',"const browser=", "const round=process.argv[2]||'round2';if(!/^[a-z0-9-]+$/.test(round))throw new Error('invalid review name');\nconst browser=");
edit('qa/avatar-reference-review.mjs',"path:'qa/anime-independent-round1.png'", "path:`qa/anime-independent-${round}.png`");
edit('qa/avatar-reference-review.mjs',"writeFileSync('qa/anime-independent-round1.json'", "writeFileSync(`qa/anime-independent-${round}.json`");
