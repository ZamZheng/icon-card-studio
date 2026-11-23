import {readFile,realpath,mkdir,writeFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const json=async file=>JSON.parse(await readFile(file,'utf8'));
export const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export async function imageFile(file){
  if(typeof file!=='string'||/^[a-z]+:\/\//i.test(file))throw Error('图片必须是本地文件，不能直接使用远程URL');
  const absolute=await realpath(file),bytes=await readFile(absolute);
  if(bytes.length>20*1024*1024)throw Error('图片不得超过20MiB');
  let mime;
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
  else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';
  else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')mime='image/webp';
  else throw Error('仅接受PNG、JPEG、WebP原文件；不能将SVG/HTML伪装为图片');
  return {absolute,bytes,mime,sha256:sha256(bytes),url:`data:${mime};base64,${bytes.toString('base64')}`};
}
export async function atomicWrite(file,bytes){
  await mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';
  try{await writeFile(temp,bytes);await rename(temp,file);}finally{await rm(temp,{force:true});}
}
export async function checkDestination(file,protectedFiles=[]){
  const absolute=path.resolve(file);await mkdir(path.dirname(absolute),{recursive:true});
  const parent=await realpath(path.dirname(absolute));
  const actual=await realpath(absolute).catch(e=>{if(e.code==='ENOENT')return path.join(parent,path.basename(absolute));throw e;});
  if(actual.startsWith(ROOT+path.sep)&&!actual.startsWith(path.join(ROOT,'output')+path.sep))throw Error('仓库内的输出仅允许写入output/，不得覆盖源码或素材');
  if(protectedFiles.includes(actual))throw Error('输出不得覆盖输入或原素材');return actual;
}
