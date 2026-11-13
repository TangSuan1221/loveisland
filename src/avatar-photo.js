import {mapPhotoToAppearance} from './avatar-photo-mapping.js';
import {analyzePhotoAttributes} from './avatar-photo-attributes.js';

// Photos and landmarks are transient. Only editable appearance values leave this module.
export function createPhotoMatcher(){
  let generation=0,worker=null,pendingReject=null,timer=null;
  const abortError=()=>new DOMException('已取消照片识别。','AbortError');
  function dispose(){
    generation++;worker?.terminate();worker=null;clearTimeout(timer);timer=null;
    const reject=pendingReject;pendingReject=null;reject?.(abortError());
  }
  async function analyze(file,{onProgress=()=>{},appearance={}}={}){
    dispose();const token=generation;
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('请选择 PNG、JPEG 或 WebP 照片。');
    if(file.size>8*1024*1024)throw new Error('照片最大为 8 MB，请压缩后重试。');
    let bitmap,scaled;
    try{
      onProgress('正在读取照片…');
      bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      if(token!==generation)throw abortError();
      if(Math.max(bitmap.width,bitmap.height)>4096)throw new Error('照片宽高不能超过 4096 像素，请缩小后重试。');
      if(Math.min(bitmap.width,bitmap.height)<128)throw new Error('照片太小，请使用宽高至少 128 像素的清晰照片。');
      const ratio=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));
      const width=Math.round(bitmap.width*ratio),height=Math.round(bitmap.height*ratio);
      const canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(bitmap,0,0,width,height);bitmap.close();bitmap=null;
      const imageData=ctx.getImageData(0,0,width,height);scaled=canvas.transferToImageBitmap();
      const detection=await new Promise((resolve,reject)=>{
        let partial=null;
        pendingReject=reject;
        const baseURL=new URL(import.meta.env.BASE_URL+'vendor/mediapipe',location.origin).href;
        worker=new Worker(new URL(import.meta.env.BASE_URL+'avatar-photo-worker.js',location.origin));
        const finish=(error,result)=>{
          if(token!==generation)return;
          clearTimeout(timer);timer=null;pendingReject=null;worker?.terminate();worker=null;
          error?reject(error):resolve(result);
        };
        worker.onmessage=({data})=>{
          if(token!==generation)return;
          if(data.type==='progress')onProgress(data.message);
          else if(data.type==='geometry')partial=data;
          else if(data.type==='result')finish(null,data);
          else if(data.type==='error')finish(new Error(data.message));
        };
        worker.onerror=()=>finish(new Error('本地识别组件未能启动，请刷新页面重试。'));
        timer=setTimeout(()=>partial?finish(null,{...partial,attributeWarning:'头发与眼镜识别超时，已完成面部拟合；这些设置保持原样，可手动选择。'}):finish(new Error('识别超时，请换一张尺寸较小的清晰正面照片重试。')),90000);
        worker.postMessage({bitmap:scaled,baseURL},[scaled]);scaled=null;
      });
      if(token!==generation)throw abortError();
      onProgress('正在匹配可编辑的面部参数…');
      const mapped=mapPhotoToAppearance(detection.landmarks,{width,height,imageData,appearance,blendshapes:detection.blendshapes,parsing:detection.parsing});
      if(detection.parsing){
        const attributes=analyzePhotoAttributes(detection.parsing,{appearance:{...appearance,...mapped.values}});
        Object.assign(mapped.values,attributes.values);
        mapped.summary.push(...attributes.summary);mapped.warnings.push(...attributes.warnings);
        mapped.candidates=attributes.candidates;
      }else if(detection.attributeWarning)mapped.warnings.push(detection.attributeWarning);
      return mapped;
    }catch(error){
      if(token===generation)dispose();
      if(error.name==='InvalidStateError'||error.name==='EncodingError')throw new Error('照片无法解码，请重新导出为 PNG 或 JPEG 后重试。');
      throw error;
    }finally{bitmap?.close();scaled?.close();}
  }
  return {analyze,dispose};
}
