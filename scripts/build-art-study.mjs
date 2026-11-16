import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  root, resolve: {preserveSymlinks: true}, configFile: false, publicDir: false,
  build: {
    target: 'es2022', write: false,
    rollupOptions: { input: path.join(root, 'src/artStudy/studio.js'), output: { inlineDynamicImports: true } }
  }
});
const code = result.output.find(asset => asset.type === 'chunk').code;
const css = result.output.find(asset => asset.fileName.endsWith('.css')).source;
const html = `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>荒岛心跳 · 场景预研</title><style>${css}</style><div id="app"></div><script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script></html>`;
const directory = path.join(root,'art','study');
await mkdir(directory,{recursive:true});
await writeFile(path.join(directory,'island.html'),html);

