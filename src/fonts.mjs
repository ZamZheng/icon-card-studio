import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT,sha256} from './files.mjs';
export async function localFonts(master,text){
  const codes=[...new Set([...text].map(c=>c.codePointAt(0)))];
  const roles=[...Object.values(master.typography),{family:'Noto Sans SC',weight:700}];
  const sets=new Map(roles.map(r=>[`${r.family}/${r.weight}/${r.style||'normal'}`,r]));
  let css='';const files={};
  for(const r of sets.values()){
    const pkg=r.family==='Noto Sans SC'?'noto-sans-sc':r.family==='Roboto Condensed'?'roboto-condensed':null;
    if(!pkg)throw Error(`未登记字体${r.family}`);
    const folder=path.join(ROOT,'node_modules/@fontsource',pkg),meta=JSON.parse(await readFile(path.join(folder,'metadata.json'),'utf8'));
    if(!meta.weights.includes(r.weight)||!meta.styles.includes(r.style||'normal'))throw Error(`不存在真实字体字重/字形${r.family} ${r.weight} ${r.style||'normal'}`);
    const file=path.join(folder,`${r.weight}${r.style==='italic'?'-italic':''}.css`),source=await readFile(file,'utf8');
    for(const block of source.match(/@font-face\s*\{[^}]*\}/g)||[]){
      const range=block.match(/unicode-range:\s*([^;]+);/)?.[1];
      if(range&&!range.split(',').some(raw=>{
        const [a,b]=raw.trim().replace(/^U\+/i,'').split('-');
        const low=parseInt(a.replace(/\?/g,'0'),16),high=parseInt((b||a).replace(/\?/g,'F'),16);
        return codes.some(n=>n>=low&&n<=high);
      }))continue;
      let rewritten=block;
      for(const match of block.matchAll(/url\(([^)]+)\)/g)){
        const f=path.resolve(folder,match[1].replace(/["']/g,''));const bytes=await readFile(f);
        files[path.relative(ROOT,f)]=sha256(bytes);rewritten=rewritten.replace(match[0],`url("data:font/woff2;base64,${bytes.toString('base64')}")`);
      }
      css+=rewritten.replace(/font-display:\s*[^;]+;/,'font-display: block;')+'\n';
    }
  }
  return {css,files};
}
