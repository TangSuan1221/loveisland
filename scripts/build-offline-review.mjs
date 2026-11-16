import {build} from 'vite';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const bases=process.argv.includes('--base-poses');
const study=bases||process.argv.includes('--style-study');
const entry='virtual:offline-review';
const result=await build({plugins:[{
  name:'offline-review',
  resolveId(id){if(id===entry)return '\0'+entry;},
  load(id){if(id==='\0'+entry)return (bases?"import {baseReview as study} from '/src/base-motion.js';":study?"import {study} from '/src/style-study.js';":"")+"import '/src/game.css';import {openRehearsal} from '/src/action-rehearsal.js';const button=document.querySelector('button');button.onclick=()=>openRehearsal(undefined,undefined,"+(study?"study":"undefined")+");button.click();";}
}],build:{write:false,cssCodeSplit:false,assetsInlineLimit:Infinity,rollupOptions:{input:entry,output:{format:'iife',inlineDynamicImports:true}}}});
const script=result.output.find(o=>o.type==='chunk');
const css=result.output.filter(o=>o.fileName.endsWith('.css')).map(o=>o.source).join('\n');
if(script.imports.length||script.dynamicImports.length||!css)throw Error('Incomplete offline bundle');
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>动作验收台 · 荒岛心跳</title><style>'+css+'</style><body><button>打开动作验收台</button><script>'+script.code.replace(/<\/script/gi,'<\\/script')+'</script></body></html>';
await writeFile(resolve(bases?'基础姿势验收台.html':study?'四项动作试演-3D.html':'动作验收台.html'),html);
console.log('Offline HTML bytes:',Buffer.byteLength(html));
