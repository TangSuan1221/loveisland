import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('../src/camp/',import.meta.url),tables={};
const numeric=new Set('walkable buildable move_cost can_skin unlock_day road wood_per_tile hours_per_tile winter w h rotatable wood door_x door_y blocks allow_camp warmth_radius warmth_bonus beds max_count hp beauty stage radius need_day need_built hours'.split(' '));
for(const [name,count] of Object.entries({terrain:8,skins:12,roads:4,structures:24,interiors:8,engineering:7,expansion:3})){
  const lines=readFileSync(new URL('data/'+name+'.csv',root),'utf8').trim().split(/\r?\n/).filter(l=>!l.startsWith('//'));
  const header=lines.shift().split(',');
  assert.equal(lines.length,count,name);
  tables[name]=lines.map(line=>{
    const cells=line.split(',');
    assert.ok(cells.length>=header.length,name+' missing column');
    return Object.fromEntries(header.map((key,i)=>{
      let val=cells[i].trim();
      if(numeric.has(key)){assert.ok(val!==''&&Number.isFinite(Number(val)),name+'.'+key);val=Number(val);}
      if(key==='tags')val=val.split('|').filter(Boolean);
      return [key,val];
    }));
  });
  const key=header[0];assert.equal(new Set(tables[name].map(r=>r[key])).size,count,name+' duplicate key');
}
const defs=new Map(tables.structures.map(d=>[d.id,d]));
const affordances=new Set(['','ObjBonfire','Bed','Kitchen','ObjDrinkingFountain','Lamp','Bench','Fountain','FoodShop']);
for(const d of defs.values()){
  assert.ok(affordances.has(d.affordance)&&['land','grass','shore','water','span'].includes(d.terrain),d.id);
  assert.ok(d.door_x>=0&&d.door_y>=0&&d.door_x<d.w&&d.door_y<d.h&&d.wood>=0&&d.max_count>=1,d.id);
  const seen=new Set();let v=d;
  while(v.upgrade_to){assert.ok(!seen.has(v.id),d.id);seen.add(v.id);v=defs.get(v.upgrade_to);assert.ok(v,d.id);}
}
for(const t of tables.terrain)assert.equal(Boolean(t.walkable),t.move_cost>0);
const [head,...rows]=readFileSync(new URL('data/scene-branch.csv',root),'utf8').trim().split(/\r?\n/);
tables.scenes=rows.map(line=>Object.fromEntries(head.split(',').map((k,i)=>[k,line.split(',')[i]])));
const tags=new Set(tables.structures.flatMap(s=>s.tags));
for(const scene of tables.scenes){
  if(scene.scene_cond.startsWith('at:'))assert.ok(tags.has(scene.scene_cond.slice(3)),scene.scene_id);
  if(scene.scene_cond.startsWith('struct:'))assert.ok(defs.has(scene.scene_cond.slice(7)),scene.scene_id);
}
assert.equal(tables.scenes.length,18);
const hash=createHash('sha256').update(JSON.stringify(tables)).digest('hex');
writeFileSync(new URL('tables.json',root),JSON.stringify({...tables,hash},null,2)+'\n');
console.log('Camp data verified · '+hash.slice(0,12));
