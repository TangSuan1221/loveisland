import { build } from 'vite';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const entry = 'virtual:cinema-review';
const bundle = await build({
  plugins: [{
    name: 'standalone-cinema-review',
    resolveId(id) { if (id === entry) return '\0' + entry; },
    load(id) {
      if (id === '\0' + entry)
        return "import {openCinemaReview} from '/src/performance/cinema-review.js'; import {openStagePreview} from '/src/performance/stage/stage-preview.js'; const q=new URLSearchParams(location.search); if(q.has('perf'))openStagePreview(q);else openCinemaReview();";
    }
  }],
  build: {
    write: false, cssCodeSplit: false, assetsInlineLimit: Infinity,
    rollupOptions: {input:entry, output:{format:'iife', inlineDynamicImports:true}}
  }
});
const chunks = bundle.output.filter(item => item.type === 'chunk');
const styles = bundle.output.filter(item => item.fileName.endsWith('.css'));
if (chunks.length !== 1 || !styles.length || chunks[0].imports.length ||
    chunks[0].dynamicImports.length || bundle.output.length !== chunks.length + styles.length)
  throw new Error('放映室包含未内联的文件。');
const script = chunks[0].code.replace(/<\/script/gi,'<\\/script');
const css = styles.map(item=>item.source).join('\n');
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>演出放映室 · 荒岛心跳</title><style>${css}</style></head><body><div id="app"></div><script>${script}</script></body></html>`;
await writeFile(resolve('演出放映室.html'),html);
console.log('演出放映室.html',Buffer.byteLength(html),'bytes');
