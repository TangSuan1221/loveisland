import {parseLine} from './line.ts';
import {resolveVocab} from './pronounce.ts';
import {fields} from './voice.ts';
export function csv(text){
  const result=[]; let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
    }else if(!quoted&&c===','){row.push(cell);cell='';}
    else if(!quoted&&c==='\n'){row.push(cell);result.push(row);row=[];cell='';}
    else if(c!=='\r') cell+=c;
  }
  if(quoted) throw Error('Unclosed CSV quote');
  if(cell||row.length){row.push(cell);result.push(row);}
  const header=result.shift();
  return result.map(values=>{
    if(values.length!==header.length) throw Error('Invalid CSV width: '+values);
    return Object.fromEntries(header.map((k,i)=>[k,values[i]]));
  });
}
function index(rows,key){
  const map=new Map();
  for(const row of rows){
    if(!row[key]||map.has(row[key])) throw Error('Duplicate or empty '+key);
    map.set(row[key],row);
  }
  return map;
}
export function loadVoice(files){
  const read=name=>csv(files[name]);
  const vocab=index(read('vocab'),'id'),voices=index(read('voices'),'npc_id');
  const lines=index([...read('lines'),...read('sceneLines')].map(parseLine),'id');
  for(const id of vocab.keys()) resolveVocab(id,vocab);
  for(const line of lines.values()) for(const tag of line.tags) if(tag.group==='world'){
    if(resolveVocab(tag.args.id,vocab)&&vocab.get(tag.args.id).kind!==tag.name) throw Error('Wrong vocabulary kind');
  }
  for(const p of voices.values()) for(const key of fields){
    if(!/^\d+$/.test(p[key])||+p[key]>100) throw Error('Invalid voice '+key);
    p[key]=Number(p[key]);
  }
  const rules=read('rules');index(rules,'id');
  for(const r of rules) if(!lines.has(r.line_id)||!(r.cooldown_min>0)||!(r.weight>0)) throw Error('Invalid bark '+r.id);
  const nodes=read('flow');
  const valid=n=>/^\d+$/.test(n)&&Number(n)<nodes.length;
  nodes.forEach((n,i)=>{
    if(Number(n.idx)!==i||!['msg','event','entry','branch','jump'].includes(n.type)||
       (n.type==='msg'&&!lines.has(n.line))||(n.type==='branch'&&(n.next!=='-1'||!n.cases.split(',').every(valid)))||
       (n.type!=='jump'&&n.next!=='-1'&&!valid(n.next))) throw Error('Invalid node '+i);
  });
  return {lines,vocab,voices,rules,scene:{id:'water',nodes}};
}
