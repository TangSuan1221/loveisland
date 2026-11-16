import test from 'node:test';
import assert from 'node:assert/strict';
import {newCamp,editCamp,makeGrid} from '../src/camp/model.js';
import {sharePng,readPng} from '../src/camp/png.js';
import {pack,unpack} from '../src/camp/archive.js';
import {createProduction} from '../src/production-engine.js';

test('操作覆盖全部 17 种结果，失败时保留逐字节相同的蓝图',()=>{
 const codes=new Set(),c=newCamp();
 function run(op,p={},day=50,opts={}){
   const before=pack(c),r=editCamp(c,day,{op,...p},opts);codes.add(r.code);
   if(!r.ok)assert.equal(pack(c),before);return r;
 }
 run('buy',{kind:'tent'});run('buy',{kind:'hut'},1);run('place',{kind:'tent',x:20,y:20});
 run('store',{id:999});run('expand',{},50,{winter:true});c.wood=500;
 for(const kind of ['tent','bridge','fence','fence','fire_pit','fire_pit','fire_pit','fire_pit'])run('buy',{kind});
 for(const [x,y] of [[-1,4],[32,32],[27,13],[0,0],[49,26],[20,20]])run('place',{kind:'tent',x,y});
 run('place',{kind:'bridge',x:24,y:20});run('place',{kind:'fence',x:20,y:20});run('place',{kind:'fence',x:20,y:22});run('place',{kind:'fence',x:22,y:20});
 run('upgrade',{id:1,kind:'hut'});
 run('crew',{value:0});run('pave',{cells:[{x:25,y:20}],value:1});
 const expected='OK OUT_OF_BOUNDS TERRAIN BLOCKED RESERVED SITE_BUFFER NO_ACCESS WATER_SPAN SEALS_OFF MAX_COUNT LOCKED NO_MATERIALS NO_BUDGET NOT_IN_INVENTORY NEED_MOVE WINTER_LOCK NOT_FOUND'.split(' ');
 assert.deepEqual([...codes].sort(),expected.sort());
});
test('1000 次合法随机放置保持所有已建入口可达',()=>{
 const c=newCamp();c.wood=200;const run=(op,p)=>editCamp(c,20,{op,...p});
 run('buy',{kind:'tent'});assert.ok(run('place',{kind:'tent',x:26,y:22}).ok);run('buy',{kind:'fence'});
 let rng=20261115,success=0;
 for(let i=0;i<3500&&success<1000;i++){
   rng=(Math.imul(1664525,rng)+1013904223)>>>0;
   const p={x:8+(rng%36),y:9+((rng>>>12)%42)};
   if(!run('place',{kind:'fence',...p}).ok)continue;
   const g=makeGrid(c,20);assert.ok(g.reachable(26,24));assert.ok(run('store',{id:c.nextId-1}).ok);success++;
 }
 assert.equal(success,1000);
});
test('PNG 蓝图回读并拒绝损坏；无空间模式拒绝编辑',async()=>{
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jCsUAAAAASUVORK5CYII=','base64');
 const code=pack(newCamp()),blob=await sharePng(bytes,code),image=new Uint8Array(await blob.arrayBuffer());
 assert.equal(readPng(image),code);assert.equal(pack(unpack(code)),code);
 const at=image.indexOf(67,33);image[at+12]^=1;assert.throws(()=>readPng(image));
 const g=createProduction({seed:17,spatial:false});const before=g.serialize();
 assert.equal(g.dispatch('campEdit',{op:'buy',kind:'fence'}).code,'LOCKED');assert.deepEqual(g.serialize(),before);
});
