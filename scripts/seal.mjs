import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT,sha256,atomicWrite} from '../src/files.mjs';
const files={};
async function walk(folder){for(const entry of await readdir(path.join(ROOT,folder),{withFileTypes:true})){const f=path.join(folder,entry.name);if(entry.isDirectory())await walk(f);else if(!f.endsWith('package.lock.json')&&!/identity\.local|icon-logo\.(?:png|jpg|webp)$/.test(f))files[f]=sha256(await readFile(path.join(ROOT,f)));}}
for(const folder of ['src','template','config','assets'])await walk(folder);
files['package-lock.json']=sha256(await readFile(path.join(ROOT,'package-lock.json')));
await atomicWrite(path.join(ROOT,'config/package.lock.json'),JSON.stringify({schemaVersion:1,files:Object.fromEntries(Object.entries(files).sort())},null,2)+'\n');
console.log(`已登记${Object.keys(files).length}个工具包文件；生产调用不执行此命令。`);
