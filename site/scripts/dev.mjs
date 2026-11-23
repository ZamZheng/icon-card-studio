import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
await import('./build.mjs');
const {default:worker}=await import('../worker/index.mjs');
const objects=new Map();
const BUCKET={async get(key){const entry=objects.get(key);if(!entry)return null;return {body:entry.bytes,httpMetadata:entry.options?.httpMetadata,json:async()=>JSON.parse(new TextDecoder().decode(entry.bytes))};},async put(key,bytes,options){objects.set(key,{bytes:typeof bytes==='string'?new TextEncoder().encode(bytes):bytes,options});}};
const portIndex=process.argv.indexOf('--port');const port=Number(portIndex>=0?process.argv[portIndex+1]:process.env.PORT||3000);
const server=http.createServer(async(req,res)=>{try{const origin=`http://${req.headers.host}`;const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-development-user');const request=new Request(new URL(req.url,origin),{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'})});const response=await worker.fetch(request,{BUCKET});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(e){res.writeHead(500);res.end('Local preview error');}});server.listen(port,'0.0.0.0');
