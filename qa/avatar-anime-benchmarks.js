import {RECOGNITION_BENCHMARKS as OLD} from './avatar-recognition-benchmarks.js';
import {ANIME_PRESETS} from '../src/avatar-anime.js';
const byName=Object.fromEntries(ANIME_PRESETS.map(x=>[x.name,x.values]));
export const RECOGNITION_BENCHMARKS=OLD.filter(x=>x.group==='动漫').map(b=>({...b,values:{...(b.id==='miku'?byName['青葱双尾']:b.id==='rei'?byName['绯瞳短发']:byName['破风武者']),...(b.id==='vegeta'?{hairFront:'anime_flame',faceShape:'heart',faceWidth:.91,chinLength:1.02,eyeSize:.90,browRotation:12,topColor:'#315a9a',bottomColor:'#e5e4d6'}:{})}}));
RECOGNITION_BENCHMARKS.push({id:'makima',name:'玛奇玛 · 环瞳研究',group:'动漫',mustHave:['金色同心环虹膜','橙红色错落刘海','拱形眼线与贴脸长鬓发'],values:byName['金环赤发']});
