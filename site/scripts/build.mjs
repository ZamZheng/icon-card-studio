import {readFile,writeFile,mkdir} from 'node:fs/promises';
const html=await readFile(new URL('../ui.html',import.meta.url),'utf8');
await writeFile(new URL('../worker/ui.mjs',import.meta.url),'export const html='+JSON.stringify(html)+';\n');
const worker=await readFile(new URL('../worker/index.mjs',import.meta.url),'utf8');
await mkdir(new URL('../dist/server',import.meta.url),{recursive:true});
await mkdir(new URL('../dist/.openai',import.meta.url),{recursive:true});
await writeFile(new URL('../dist/server/index.js',import.meta.url),worker.replace("import {html} from './ui.mjs';",'const html='+JSON.stringify(html)+';'));
await writeFile(new URL('../dist/.openai/hosting.json',import.meta.url),await readFile(new URL('../.openai/hosting.json',import.meta.url)));
console.log('已构建Worker与持久素材上传页面。');
