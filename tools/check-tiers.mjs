import assert from 'node:assert/strict';
import { DATA } from '../packages/sim-core/src/data.generated.ts';
import { compile } from '../packages/sim-core/src/modifier.ts';
const tiers=new Set(DATA.aiPriority.map(t=>t.id));
assert.equal(tiers.size,33);
assert.equal(DATA.aiPriority.length,33);
for(const [i,t] of DATA.aiPriority.entries()){
  assert.match(t.id,/^M\d{2}$/);
  assert.ok(+t.run>=+t.act && +t.act>(i?+DATA.aiPriority[i-1].act:0),t.id);
}
const needs=new Set(DATA.needLadder.map(r=>r.need));
assert.equal(needs.size,5);
for(const row of DATA.needLadder){
  assert.ok(+row.warn>+row.mid && +row.mid>+row.crit,row.need);
  for(const key of ['l1_tier','l2_tier','l3_tier','zero_tier'])assert.ok(tiers.has(row[key]),row[key]);
}
for(const b of DATA.behaviors){
  assert.ok(needs.has(b.need) && tiers.has(b.tier) && b.affordance && +b.cooldown_min>=0,b.id);
  assert.match(b.level,/^L[1-4]$/,b.id);
  assert.ok(+b.duration_s>0 && +b.base>=0.1 && +b.base<=3,b.id);
  assert.ok(Number.isFinite(Number(b.delta)),b.id);
  for(const effect of b.side_effect.split(';').filter(Boolean)){
    assert.match(effect,/^[A-Za-z]+:[+-]\d+$/,b.id);
  }
}
for(const [expr,expected] of [['1+2*3',7],['(1+2)*3',9],['-2+5',3],['8/4/2',1],['clamp01(-1)',0],['clamp01(2)',1],['grit+1',1.5],['0.5*grit',0.25]]){
  assert.equal(compile(expr)({grit:0.5}),expected,expr);
}
for(const expr of ['a.b','f(0)','x=1','1;2'])assert.throws(()=>compile(expr),undefined,expr);
assert.equal(DATA.modifiers.length,19);
assert.equal(DATA.gates.length,4);
assert.equal(DATA.behaviors.length,14);
const bands={S:[9.6,9.9],A:[8.7,9.4],B:[7.8,8.7],C:[4.6,7.5],D:[1.1,4.5],E:[1,2.1],F:[0.1,0.9]};
for(const t of DATA.aiPriority){
  const [min,max]=bands[t.band];assert.ok(+t.act>=min && +t.act<=max,t.id);
}
for(const row of DATA.modifiers){
  if(row.expr.startsWith('GATE '))assert.match(row.expr,/^GATE \d+$/);
  else compile(row.expr);
}
console.log('33 tiers / 5 ladders / '+DATA.behaviors.length+' behaviors OK');
