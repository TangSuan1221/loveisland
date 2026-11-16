const keyword=new TextEncoder().encode('CI-BP2\0');
function crc(bytes){let v=-1;for(const b of bytes){v^=b;for(let i=0;i<8;i++)v=(v>>>1)^((v&1)?0xedb88320:0);}return (v^-1)>>>0;}
function chunks(bytes){
  if(bytes.length<20||new DataView(bytes.buffer,bytes.byteOffset).getUint32(0)!==0x89504e47)throw Error('不是 PNG 图片。');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.length),rows=[];
  for(let i=8;i+12<=bytes.length;){const n=view.getUint32(i),end=i+12+n;if(end>bytes.length)throw Error('PNG 文件不完整。');
    rows.push({start:i,type:view.getUint32(i+4),data:bytes.subarray(i+8,end-4),crc:view.getUint32(end-4)});i=end;}
  return rows;
}
export function sharePng(image,code){
  const end=chunks(image).find(c=>c.type===0x49454e44);if(!end)throw Error('PNG 文件不完整。');
  const data=new TextEncoder().encode(code),chunk=new Uint8Array(12+keyword.length+data.length),v=new DataView(chunk.buffer);
  v.setUint32(0,keyword.length+data.length);v.setUint32(4,0x74455874);chunk.set(keyword,8);chunk.set(data,8+keyword.length);
  v.setUint32(chunk.length-4,crc(chunk.subarray(4,-4)));
  return new Blob([image.subarray(0,end.start),chunk,image.subarray(end.start)],{type:'image/png'});
}
export function readPng(bytes){
  for(const c of chunks(bytes))if(c.type===0x74455874&&keyword.every((v,i)=>c.data[i]===v)){
    if(c.crc!==crc(bytes.subarray(c.start+4,c.start+8+c.data.length)))throw Error('图片中的蓝图已损坏。');
    return new TextDecoder().decode(c.data.subarray(keyword.length));
  }
  throw Error('图片里没有营地蓝图。');
}
