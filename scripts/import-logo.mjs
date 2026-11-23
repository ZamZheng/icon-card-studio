import {parseArgs} from 'node:util';
import path from 'node:path';
import {imageFile,ROOT,atomicWrite} from '../src/files.mjs';
try{
  const {values}=parseArgs({options:{input:{type:'string'}}});if(!values.input)throw Error('需要--input Logo原文件');
  const source=await imageFile(path.resolve(values.input));
  const extension=source.mime==='image/png'?'png':source.mime==='image/jpeg'?'jpg':'webp',file=`icon-logo.${extension}`;
  await atomicWrite(path.join(ROOT,'assets/brand',file),source.bytes);
  await atomicWrite(path.join(ROOT,'assets/brand/identity.local.json'),JSON.stringify({file,sha256:source.sha256,source:'user-supplied-original',importedAt:new Date().toISOString()},null,2)+'\n');
  console.log(JSON.stringify({file,sha256:source.sha256,preservedOriginalBytes:true}));
}catch(e){console.error(e.message);process.exitCode=1;}
