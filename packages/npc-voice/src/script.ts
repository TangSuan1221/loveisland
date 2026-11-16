export function* runScene(scene, api, saved={sceneId:scene.id,index:0,vars:{}}) {
  let {sceneId,index}=saved;
  const vars={...saved.vars};
  while(index!==-1){
    const graph=sceneId===scene.id?scene:api.scene(sceneId);
    const node=graph.nodes[index];
    if(!node) throw Error('Invalid scene node '+index);
    let next=Number(node.next);
    if(node.type==='branch') next=Number(node.cases.split(',')[vars[node.branch_id]??api.variable(node.branch_id)]);
    if(node.type==='event') Object.assign(vars,api.event(node.event_id,node.args)||{});
    if(node.type==='jump'){sceneId=node.jump;next=0;}
    index=next;
    yield {type:node.type,lineId:node.line,save:{sceneId,index,vars:{...vars}}};
  }
}
