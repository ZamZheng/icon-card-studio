import {html} from './ui.mjs';
const MAX=10*1024*1024;
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function sniff(bytes){
  if(bytes.length<12)return null;
  if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)return {mime:'image/png',ext:'png'};
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return {mime:'image/jpeg',ext:'jpg'};
  if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return {mime:'image/webp',ext:'webp'};
  return null;
}
export default {async fetch(request,env){
  const url=new URL(request.url);
  const slot=url.pathname.startsWith('/api/portrait')?'portrait':'brand',field=slot==='brand'?'logo':'portrait',endpoint='/api/'+slot;
  try{
    if(url.pathname==='/'&&request.method==='GET')return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' blob: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'"}});
    if(url.pathname==='/api/health')return json({ok:true,storageReady:!!env.BUCKET});
    if(url.pathname.startsWith('/api/')&&!env.BUCKET)return json({error:'素材存储尚未就绪，请稍后重试。'},503);
    if(url.pathname===endpoint&&request.method==='GET'){
      const current=await env.BUCKET.get(slot+'/current.json');return json({[field]:current?await current.json():null});
    }
    if(url.pathname===endpoint&&request.method==='POST'){
      if(!request.headers.get('oai-authenticated-user-id'))return json({error:'请先使用你的ChatGPT账号登录。'},401);
      if(request.headers.get('origin')!==url.origin)return json({error:'请从本页面上传。'},403);
      const declared=Number(request.headers.get('content-length'));if(declared>MAX+1024*64)return json({error:'文件不能超过10MB。'},413);
      const body=await request.formData(),file=body.get('file');
      if(!file||typeof file.arrayBuffer!=='function')return json({error:'请选择一个图片文件。'},400);
      if(file.size>MAX||file.size<12)return json({error:'文件须为有效图片，且不超过10MB。'},400);
      const bytes=new Uint8Array(await file.arrayBuffer()),type=sniff(bytes);
      if(!type)return json({error:'请选择PNG、JPEG或WebP原文件；不支持SVG、PDF及其他格式。'},415);
      const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
      const key=`${slot}/files/${sha}.${type.ext}`;
      await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type.mime}});
      const metadata={sha256:sha,key,mime:type.mime,name:String(file.name||`${field}.${type.ext}`).replace(/[\\/\u0000-\u001f]/g,'_').slice(0,180),size:bytes.length,uploadedAt:new Date().toISOString(),downloadPath:`/api/${slot}/file/${sha}.${type.ext}`,preservedOriginalBytes:true};
      await env.BUCKET.put(slot+'/current.json',JSON.stringify(metadata),{httpMetadata:{contentType:'application/json'}});
      return json({[field]:metadata},201);
    }
    const match=url.pathname.match(/^\/api\/(brand|portrait)\/file\/([a-f0-9]{64})\.(png|jpg|webp)$/);
    if(match&&request.method==='GET'){
      const object=await env.BUCKET.get(`${match[1]}/files/${match[2]}.${match[3]}`);if(!object)return json({error:'找不到该素材。'},404);
      return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'application/octet-stream','Content-Disposition':`inline; filename="${match[1]}.${match[3]}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
    }
    return json({error:'页面不存在。'},404);
  }catch(error){console.error('asset-request-failed',error.message);return json({error:'保存未完成，请重试。原有素材仍可使用。'},500);}
}};
