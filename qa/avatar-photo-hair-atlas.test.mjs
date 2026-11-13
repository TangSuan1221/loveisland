import test from 'node:test';import assert from 'node:assert/strict';
import {HAIR_ATLAS} from '../src/avatar-photo-hair-atlas.js';
import {HAIR_FRONT_DESIGNS,HAIR_BACK_DESIGNS} from '../src/avatar-hair-catalog.js';
test('rendered silhouette atlas covers every non-anime front/back component exactly once',()=>{
 assert.equal(HAIR_ATLAS.grid.width,32);assert.equal(HAIR_ATLAS.grid.height,56);
 for(const [field,catalog]of [['hairFront',{...HAIR_FRONT_DESIGNS,none:{}}],['hairBack',HAIR_BACK_DESIGNS]]){const entries=HAIR_ATLAS.entries.filter(e=>e.field===field);assert.deepEqual(entries.map(e=>e.value).sort(),Object.keys(catalog).filter(k=>catalog[k].family!=='anime').sort());for(const e of entries){assert.equal(e.rows.length,HAIR_ATLAS.grid.height);assert(e.rows.some(r=>r!==0),`${field}:${e.value} has visible hair`);assert(e.rows.every(r=>Number.isInteger(r)&&r>=0&&r<=0xffffffff));}}
 assert.equal(new Set(HAIR_ATLAS.entries.map(e=>e.field+':'+e.value)).size,HAIR_ATLAS.entries.length);
});
test('atlas contains visible shape variation rather than repeated category labels',()=>{
 for(const field of ['hairFront','hairBack']){const entries=HAIR_ATLAS.entries.filter(e=>e.field===field),unique=new Set(entries.map(e=>JSON.stringify(e.rows)));assert(unique.size>entries.length*.65,`${field}: insufficient rasterized variation`);}
});
