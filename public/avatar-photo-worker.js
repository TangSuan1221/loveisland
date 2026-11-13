/* Local-only MediaPipe worker. The unmodified CJS distribution exposes exports. */
self.exports = {};
importScripts('./vendor/mediapipe/vision_bundle.js');
self.onmessage = async ({data}) => {
  const {bitmap,baseURL} = data;
  let detector,loading=true,session;
  try {
    self.postMessage({type:'progress',message:'正在载入本地面部识别模型…'});
    const {FilesetResolver,FaceLandmarker} = self.exports;
    const files = await FilesetResolver.forVisionTasks(baseURL);
    detector = await FaceLandmarker.createFromOptions(files,{
      baseOptions:{modelAssetPath:baseURL+'/face_landmarker.task',delegate:'CPU'},
      runningMode:'IMAGE',numFaces:3,minFaceDetectionConfidence:.6,
      minFacePresenceConfidence:.6,outputFaceBlendshapes:true,
      outputFacialTransformationMatrixes:false
    });
    loading=false;
    self.postMessage({type:'progress',message:'正在定位脸型与五官…'});
    const result=detector.detect(bitmap);
    if(!result.faceLandmarks.length)throw new Error('没有识别到清晰人脸，请换一张光线均匀、无遮挡的正面照片。');
    if(result.faceLandmarks.length!==1)throw new Error('检测到多张人脸，请裁剪成单人照片后重试。');
    const landmarks=result.faceLandmarks[0],blendshapes=result.faceBlendshapes[0]?.categories||[];
    self.postMessage({type:'geometry',landmarks,blendshapes});
    detector.close();detector=null;
    let parsing=null,attributeWarning=null;
    try{
      self.postMessage({type:'progress',message:'正在本机识别头发与眼镜，首次载入需要稍候…'});
      const ortBase=new URL('../onnxruntime/',baseURL+'/').href;
      const ort=await import(ortBase+'ort.wasm.min.mjs');
      ort.env.wasm.wasmPaths=ortBase;ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
      session=await ort.InferenceSession.create(new URL('../face-parsing/resnet18.onnx',baseURL+'/').href,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
      const fw=Math.abs(landmarks[454].x-landmarks[234].x)*bitmap.width;
      const fh=(landmarks[152].y-landmarks[10].y)*bitmap.height;
      const size=Math.min(Math.max(fw*2.2,fh*1.95),bitmap.width,bitmap.height),cx=(landmarks[234].x+landmarks[454].x)*bitmap.width/2;
      const cy=(landmarks[10].y+landmarks[152].y)*bitmap.height/2;
      const left=Math.max(0,Math.min(bitmap.width-size,cx-size/2)),top=Math.max(0,Math.min(bitmap.height-size,cy-size*.60));
      const canvas=new OffscreenCanvas(512,512),ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.fillStyle='#d0d0d0';ctx.fillRect(0,0,512,512);
      ctx.drawImage(bitmap,left,top,size,size,0,0,512,512);
      const imageData=ctx.getImageData(0,0,512,512),n=512*512,input=new Float32Array(3*n);
      const mean=[.485,.456,.406],std=[.229,.224,.225];
      for(let i=0;i<n;i++)for(let c=0;c<3;c++)input[c*n+i]=(imageData.data[i*4+c]/255-mean[c])/std[c];
      const outputs=await session.run({[session.inputNames[0]]:new ort.Tensor('float32',input,[1,3,512,512])});
      const output=outputs[session.outputNames[0]];
      if(output.dims.join(',')!=='1,19,512,512')throw new Error('Unexpected segmentation shape');
      const mask=new Uint8Array(n);
      for(let i=0;i<n;i++){let best=-Infinity;for(let c=0;c<19;c++){const score=output.data[c*n+i];if(score>best){best=score;mask[i]=c;}}}
      parsing={mask,width:512,height:512,imageData,landmarks:landmarks.map(p=>({x:(p.x*bitmap.width-left)/size,y:(p.y*bitmap.height-top)/size,z:p.z}))};
      await session.release();session=null;
    }catch(error){attributeWarning='本地头发与眼镜识别暂不可用，已保留这些设置；可重试或手动选择。';}
    self.postMessage({type:'result',landmarks,blendshapes,parsing,attributeWarning});
  }catch(error){self.postMessage({type:'error',message:loading?'本地识别资源加载失败，请确认游戏文件完整后刷新重试。':error.message||'本地识别失败，请重试。'});}
  finally{bitmap?.close();detector?.close();if(session)await session.release();}
};
