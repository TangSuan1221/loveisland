import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

export default defineConfig({
  resolve: {preserveSymlinks:true, alias:{"@cruel-isle/sim-core":fileURLToPath(new URL("./packages/sim-core/src/index.ts",import.meta.url))}},
  server: {host:'127.0.0.1',port:5188,strictPort:true},
  build: {target:'es2022', rollupOptions:{input:{main:'index.html',survival:'survival.html'}}}
});
