export function pickBark(ctx, rules, cooling, rng) {
  const eligible = rules.filter(r=> !(cooling[r.line_id]>ctx.minute) &&
    ctx.bond>=Number(r.min_bond||0) && (!r.mood||ctx.mood===r.mood) &&
    (!r.memory_kind||ctx.memories.includes(r.memory_kind)));
  let ticket = rng()*eligible.reduce((sum,r)=>sum+Number(r.weight),0);
  for(const rule of eligible){
    ticket -= Number(rule.weight);
    if(ticket<0) return {lineId:rule.line_id, cooling:{...cooling,[rule.line_id]:ctx.minute+Number(rule.cooldown_min)}};
  }
  return null;
}
