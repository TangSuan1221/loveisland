import {render} from './line.ts';
const budgets={bubble:[18,2],subtitle:[22,2],accent:[8,1],card:[12,1]};
export function captionPages(line,ctx){
  const [width,height]=budgets[line.style]??budgets.subtitle;
  const pages=[];let page=[],column=0,row=0,style={};
  function finish(){if(page.length)pages.push(page);page=[];column=0;row=0;}
  for(const part of line.parts){
    if(part.group==='sys'){
      if(part.name==='pageBreak'){finish();continue;}
      if(['color','font','size'].includes(part.name)){
        const a=part.args;
        style={...style,[part.name]:a.id??a.face??a.percent};continue;
      }
    }
    const text=typeof part==='string'?part:render({...line,parts:[part]},ctx);
    for(const ch of text){
      if(ch==='\n'||column===width){
        column=0;row++;
        if(row===height)finish();else page.push({text:'\n'});
        if(ch==='\n')continue;
      }
      page.push({text:ch,style,ruby:part.name==='ruby'?part.args.rt:null});column++;
    }
  }
  finish();return pages;
}
export function paintCaption(container,parts){
  container.replaceChildren();
  for(let i=0;i<parts.length;){
    const first=parts[i++];let text=first.text;
    while(i<parts.length&&parts[i].style===first.style&&parts[i].ruby===first.ruby)text+=parts[i++].text;
    const node=document.createElement(first.ruby?'ruby':'span'),style=first.style??{};
    node.textContent=text;
    if(first.ruby){const rt=document.createElement('rt');rt.textContent=first.ruby;node.append(rt);}
    if(style.color)node.style.color=style.color;
    if(style.font)node.style.fontFamily=style.font;
    if(style.size)node.style.fontSize=Math.max(60,Math.min(160,Number(style.size)))+'%';
    container.append(node);
  }
}
