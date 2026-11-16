type Env = Record<string,number>;
type Term = (env:Env)=>number;
const cache = new Map<string,Term>();
export function compile(expr:string):Term {
  const saved = cache.get(expr);
  if(saved) return saved;
  const tokens = expr.match(/[A-Za-z_]\w*|\d+(?:\.\d+)?|[^\s]/g) ?? [];
  let i=0;
  function atom():Term {
    const t=tokens[i++];
    if(t==='-'){const x=atom(); return e=>-x(e)}
    if(t==='(' || t==='clamp01'){
      if(t==='clamp01' && tokens[i++]!=='(') throw Error(expr);
      const x=sum();
      if(tokens[i++]!==')') throw Error(expr);
      return t==='('?x:e=>Math.max(0,Math.min(1,x(e)));
    }
    if(/^\d/.test(t??''))return ()=>Number(t);
    if(!t || !/^[A-Za-z_]\w*$/.test(t))throw Error(expr);
    return e=>{if(!Object.hasOwn(e,t))throw Error('Unknown variable '+t);return e[t]};
  }
  function product():Term {
    let x=atom();
    while(['*','/'].includes(tokens[i])){const a=x,op=tokens[i++],b=atom(); x=e=>op==='*'?a(e)*b(e):a(e)/b(e)}
    return x;
  }
  function sum():Term {
    let x=product();
    while(['+','-'].includes(tokens[i])){const a=x,op=tokens[i++],b=product(); x=e=>op==='+'?a(e)+b(e):a(e)-b(e)}
    return x;
  }
  const result=sum();
  if(i!==tokens.length)throw Error(expr);
  cache.set(expr,result);return result;
}
