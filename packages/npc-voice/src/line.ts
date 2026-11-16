import {resolveVocab} from './pronounce.ts';
const registry = {
  sys: 'ruby color size font pageBreak',
  speaker: 'nickname lastName firstName firstPerson callPlayer catchphrase shortPhrase',
  social: 'speaker friendA friendB friendC friendD lover spouse bestFriend child parent exLover sibling',
  world: 'item food room tool currency island player age',
  form: 'gender plural initialCap'
};
export function parseLine(raw) {
  const row = typeof raw === 'string' ? {text:raw} : raw;
  const parts = row.text.split(/({{[^{}]*}})/);
  const tags = [];
  for (let i=0; i<parts.length; i++) {
    if (!parts[i].startsWith('{{')) {
      if (/[{}]/.test(parts[i])) throw Error('Malformed template');
      continue;
    }
    const match = /^{{(\w+):(\w+)(.*?)}}$/.exec(parts[i]);
    if (!match || !registry[match[1]]?.split(' ').includes(match[2])) throw Error('UnknownTag: '+parts[i]);
    const args = {};
    const rest = match[3].replace(/\s+(\w+)=(?:"([^"]*)"|([^\s"]+))/g, (_,key,q,v)=>{
      args[key]=q??v; return '';
    });
    if (rest.trim()) throw Error('Malformed arguments: '+rest);
    parts[i] = {group:match[1], name:match[2], args};
    tags.push(parts[i]);
  }
  return {...row, parts, tags, attrs:JSON.parse(row.attrs_json || '{}')};
}
export function render(line, ctx, mode='display') {
  const track = mode==='speak'?'voice':'name';
  return line.parts.map(part=>{
    if(typeof part==='string') return part;
    const {group,name,args}=part;
    if(group==='sys') return name==='ruby'?(mode==='speak'?args.rt:args.text):name==='pageBreak'?'\n':'';
    if(group==='world') return resolveVocab(args.id,ctx.vocab)[track];
    const actor = args.id ? ctx.actors?.[args.id] : ctx.speaker;
    if(group==='form'){
      if(name==='plural') return Number(args.number??ctx.number)===1?args.s:args.p;
      if(name==='gender') return args[actor?.gender]??args.n;
      return (args.text||'').replace(/^./u,c=>c.toUpperCase());
    }
    const value = group==='social'?ctx.social?.[name]:name==='shortPhrase'?actor?.shortPhrase?.[args.situation]:actor?.[name];
    if(value==null) throw Error('Missing slot: '+group+':'+name);
    return typeof value==='string'?value:value[track];
  }).join('');
}
