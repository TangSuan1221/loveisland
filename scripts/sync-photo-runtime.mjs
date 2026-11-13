import {copyFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url),dest=new URL('public/vendor/mediapipe/',root);
await mkdir(dest,{recursive:true});
for(const file of ['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm']){
 await copyFile(new URL('node_modules/@mediapipe/tasks-vision/wasm/'+file,root),new URL(file,dest));
}
await copyFile(new URL('node_modules/@mediapipe/tasks-vision/vision_bundle.cjs',root),new URL('vision_bundle.js',dest));
console.log('Local photo runtime synced. The pinned face_landmarker.task model is shipped in public/vendor/mediapipe.');
const ortDest=new URL('public/vendor/onnxruntime/',root);
await mkdir(ortDest,{recursive:true});
for(const file of ['ort.wasm.min.mjs','ort-wasm-simd-threaded.mjs','ort-wasm-simd-threaded.wasm'])await copyFile(new URL('node_modules/onnxruntime-web/dist/'+file,root),new URL(file,ortDest));
