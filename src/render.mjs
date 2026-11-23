import {readFile,mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {validateContent,resolveIcons} from './content.mjs';
import {ROOT,json,sha256,imageFile,atomicWrite,checkDestination} from './files.mjs';
import {localFonts} from './fonts.mjs';

export async function verifyPackage(){
  const lock=await json(path.join(ROOT,'config/package.lock.json'));
  for(const [file,digest] of Object.entries(lock.files))if(sha256(await readFile(path.join(ROOT,file)))!==digest)throw Error(`工具包文件已改变：${file}；需维护者重新验收并发布版本`);
  return lock;
}
export async function render({input,output,logo,portrait,preview=false,diagnostic=false,executablePath}={}){
  if(!input||!output)throw Error('需要--input与--output');
  if(diagnostic&&!preview)throw Error('--diagnostic仅用于预览，不允许输出正式PNG');
  if(path.extname(output)!==(preview?'.html':'.png'))throw Error(preview?'预览输出须为.html':'正式输出须为.png');
  const lock=await verifyPackage(),master=await json(path.join(ROOT,'config/master.v1.json'));
  const absoluteInput=await realpath(path.resolve(input)),data=validateContent(await json(absoluteInput));
  const icons=resolveIcons(data.points,await json(path.join(ROOT,'config/icons.json')));
  const logoSource=logo?await imageFile(path.resolve(logo)):await installedLogo();
  const portraitPath=portrait?path.resolve(portrait):data.portrait?.file?path.resolve(path.dirname(absoluteInput),data.portrait.file):null;
  const portraitSource=portraitPath?await imageFile(portraitPath):null;
  const missing=[];if(!logoSource)missing.push('ICON Logo未导入');if(!portraitSource)missing.push('未提供人物肖像');
  if(missing.length&&!diagnostic)throw Error(missing.join('；')+'。导入Logo并提供--portrait，或使用preview --diagnostic检查版式');
  const protectedFiles=[absoluteInput,...[logoSource?.absolute,portraitSource?.absolute].filter(Boolean)];
  const dest=await checkDestination(output,protectedFiles);
  const base=dest.replace(/\.(html|png)$/,'');
  const previewFile=preview?dest:base+'.preview.html';const reportFile=base+'.report.json';
  for(const f of [previewFile,reportFile,base+'.bundle.json',base+'.bundle/content.json',base+'.bundle/report.json',base+'.bundle/manifest.json',base+'.bundle/package.lock.json',base+'.bundle/portrait.png',base+'.bundle/portrait.jpg',base+'.bundle/portrait.webp',base+'.bundle/logo.png',base+'.bundle/logo.jpg',base+'.bundle/logo.webp'])await checkDestination(f,protectedFiles);
  const allText=JSON.stringify(data)+JSON.stringify(master.brand)+'一份重要提醒';
  const fonts=await localFonts(master,allText);
  let css=fonts.css+await readFile(path.join(ROOT,'template/card.css'),'utf8');
  css+='\n:root{'+Object.entries(master.colors).map(([k,v])=>`--${k}:${v}`).join(';')+'}';
  for(const [role,r] of Object.entries(master.typography))css+=`[data-role="${role}"]{font-family:"${r.family}";font-size:${r.size}px;font-weight:${r.weight};font-style:${r.style||'normal'};line-height:${r.lineHeight}}`;
  const selector={logo:'#logo',masthead:'#masthead',title:'#title',introduction:'#introduction',portrait:'#portrait-frame',points:'#points',reminder:'#reminder-panel',signature:'#signature'};
  for(const [name,rect] of Object.entries(master.regions))css+=`${selector[name]}{left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px}`;
  const preset=master.presets[data.points.length];css+=`:root{--row-height:${preset.rowHeight}px;--row-gap:${preset.gap}px}`;
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1080,height:1350},deviceScaleFactor:2});
    const page=await context.newPage();await page.route(/^https?:\/\//,r=>r.abort());const resourceErrors=[];
    page.on('requestfailed',r=>resourceErrors.push(r.url()));page.on('pageerror',e=>resourceErrors.push(e.message));
    const iconMarkup=await Promise.all(icons.map(async i=>({...i,svg:await readFile(path.join(ROOT,'assets/icons',i.file),'utf8')})));
    const signature=await readFile(path.join(ROOT,'assets/brand/signature.svg'),'utf8');
    const shield=await readFile(path.join(ROOT,'assets/icons/shield.svg'),'utf8');
    await page.setContent(await readFile(path.join(ROOT,'template/card.html'),'utf8'));
    await page.addStyleTag({content:css});
    await page.evaluate(({data,master,icons,signature,shield,logo,portrait,diagnostic})=>{
      const el=id=>document.getElementById(id);
      function fill(node,text,phrases=[]){let cursor=0;for(const {phrase,index} of phrases.map(phrase=>({phrase,index:text.indexOf(phrase)})).sort((a,b)=>a.index-b.index)){node.append(document.createTextNode(text.slice(cursor,index)));const span=document.createElement('span');span.className='emphasis';span.textContent=phrase;node.append(span);cursor=index+phrase.length;}node.append(document.createTextNode(text.slice(cursor)));}
      el('column').textContent=master.brand.column;el('issue').textContent='NO.'+String(data.issue).padStart(3,'0');
      fill(el('title'),data.title,data.titleEmphasis);fill(el('introduction'),data.introduction,data.introductionEmphasis);
      el('reminder').textContent=data.reminder;el('community-lead').textContent=master.brand.communityLead;el('community-name').textContent=master.brand.communityName;
      el('signature-symbol').innerHTML=signature;el('reminder-icon').innerHTML=shield;
      if(logo)el('logo').src=logo;else el('logo').remove();
      if(portrait){el('portrait').src=portrait;el('portrait').style.objectPosition=`${data.portrait?.positionX??50}% ${data.portrait?.positionY??50}%`;}else el('portrait').remove();
      if(diagnostic)el('diagnostic-watermark').hidden=false;
      data.points.forEach((p,i)=>{
        const li=document.createElement('li');li.className='point';li.style.setProperty('--row-accent',master.colors[master.rowAccentOrder[i]]);
        const n=document.createElement('span');n.className='point-number';n.dataset.role='number';n.textContent=String(i+1).padStart(2,'0');n.setAttribute('aria-hidden','true');
        const icon=document.createElement('span');icon.className='point-icon';icon.innerHTML=icons[i].svg;icon.setAttribute('aria-hidden','true');
        const group=document.createElement('div');group.className='point-copy';group.dataset.region=`知识点${i+1}`;
        const h=document.createElement('h2');h.className='point-heading';h.dataset.role='pointHeading';h.dataset.region=`知识点${i+1}标题`;h.textContent=p.heading;
        const b=document.createElement('p');b.className='point-body';b.dataset.role='pointBody';b.dataset.region=`知识点${i+1}正文`;b.textContent=p.body;
        group.append(h,b);li.append(n,icon,group);el('points').append(li);
      });
    },{data,master,icons:iconMarkup,signature,shield,logo:logoSource?.url,portrait:portraitSource?.url,diagnostic});
    await page.evaluate(async()=>{
      for(const el of document.querySelectorAll('[data-role],#masthead')){const s=getComputedStyle(el);await document.fonts.load(`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`,el.textContent);for(const span of el.querySelectorAll('.emphasis')){const p=getComputedStyle(span);await document.fonts.load(`${p.fontStyle} ${p.fontWeight} ${p.fontSize} ${p.fontFamily}`,span.textContent);}}
      await document.fonts.ready;await Promise.all([...document.images].map(async i=>{await i.decode();if(!i.naturalWidth)throw Error('图片解码失败');}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    });
    if(resourceErrors.length)throw Error('资源加载失败：'+resourceErrors.join(';'));
    const integrity=await page.evaluate(()=>({title:document.getElementById('title').textContent,introduction:document.getElementById('introduction').textContent,reminder:document.getElementById('reminder').textContent,points:[...document.querySelectorAll('.point')].map(li=>({heading:li.querySelector('h2').textContent,body:li.querySelector('p').textContent}))}));
    const expected={title:data.title,introduction:data.introduction,reminder:data.reminder,points:data.points.map(({heading,body})=>({heading,body}))};
    if(JSON.stringify(integrity)!==JSON.stringify(expected))throw Error('文字完整性失败，停止导出');
    const checks=await page.evaluate(({capacity,regions})=>{
      const errors=[],metrics=[];const bounds=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
      const canvas={x:0,y:0,right:1080,bottom:1350};
      const contains=(outer,inner)=>inner.x>=outer.x-1&&inner.y>=outer.y-1&&inner.right<=outer.right+1&&inner.bottom<=outer.bottom+1;
      for(const el of document.querySelectorAll('[data-region]')){
        const box=bounds(el);let textBox=null;
        if(el.textContent){const range=document.createRange();range.selectNodeContents(el);const r=range.getBoundingClientRect();textBox={x:r.x,y:r.y,right:r.right,bottom:r.bottom};if(!contains(canvas,textBox))errors.push({region:el.dataset.region,type:'canvas',detail:'文字超出画幅'});}
        metrics.push({region:el.dataset.region,box,textBox});
        if(el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1)errors.push({region:el.dataset.region,type:'overflow',detail:'内容超过固定区域容量'});
        let maxLines;
        if(el.id==='title')maxLines=capacity.titleLines;else if(el.id==='introduction')maxLines=capacity.introductionLines;else if(el.classList.contains('point-heading'))maxLines=capacity.headingLines;else if(el.classList.contains('point-body'))maxLines=capacity.bodyLines;else if(el.id==='reminder')maxLines=capacity.reminderLines;
        if(maxLines){const tops=[];const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){for(let i=0;i<node.length;i++){if(/\s/.test(node.textContent[i]))continue;const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);const r=range.getBoundingClientRect();if(r.width&&r.height&&!tops.some(y=>Math.abs(y-r.y)<5))tops.push(r.y);}}if(tops.length>maxLines)errors.push({region:el.dataset.region,type:'line-capacity',detail:`实际${tops.length}行，超过${maxLines}行容量`});}
      }
      for(const li of document.querySelectorAll('.point'))if(!contains(bounds(li),bounds(li.querySelector('.point-copy'))))errors.push({region:li.querySelector('.point-copy').dataset.region,type:'row-capacity',detail:'知识点超过固定行高'});
      const signature=document.getElementById('signature'),sr=bounds(signature);if(signature.scrollWidth>signature.clientWidth+1)errors.push({region:'组织落款',type:'overflow',detail:'品牌组件超出固定宽度'});
      const nodes=[...document.querySelectorAll('[data-region]')];
      const textBounds=el=>{const r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect();};
      for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
        const a=nodes[i],b=nodes[j];if(a.contains(b)||b.contains(a))continue;const ra=textBounds(a),rb=textBounds(b);
        if(Math.min(ra.right,rb.right)-Math.max(ra.left,rb.left)>1&&Math.min(ra.bottom,rb.bottom)-Math.max(ra.top,rb.top)>1)errors.push({region:a.dataset.region,type:'text-collision',detail:`与${b.dataset.region}文字重叠`});
      }
      const p=regions.portrait,cx=p.x+p.width/2,cy=p.y+p.height/2;
      for(const el of nodes){if([...el.querySelectorAll('[data-region]')].length)continue;const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node,collision=false;while((node=walker.nextNode())&&!collision){for(let i=0;i<node.length;i++){if(/\s/.test(node.textContent[i]))continue;const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);const r=range.getBoundingClientRect(),nx=Math.max(r.left,Math.min(cx,r.right)),ny=Math.max(r.top,Math.min(cy,r.bottom));if(((nx-cx)/(p.width/2))**2+((ny-cy)/(p.height/2))**2<.98){collision=true;break;}}}if(collision)errors.push({region:el.dataset.region,type:'portrait-collision',detail:'文字进入人物框，请减少本区文案或由维护者调整母版'});}
      return {errors,metrics};
    },{capacity:master.capacity,regions:master.regions});
    const cdp=await context.newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');const actualFonts={};
    for(const role of Object.keys(master.typography)){
      const {nodeIds}=await cdp.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:`[data-role="${role}"]`});actualFonts[role]=[];
      for(const nodeId of nodeIds){const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});actualFonts[role].push(...fonts.map(({familyName,isCustomFont})=>({familyName,isCustomFont})));}
      if(!actualFonts[role].length||actualFonts[role].some(f=>!f.isCustomFont))checks.errors.push({region:role,type:'font-fallback',detail:'未使用完整本地字体'});
    }
    const report={schemaVersion:1,toolVersion:master.version,masterStatus:master.status,packageHash:sha256(JSON.stringify(lock)),runtime:{node:process.versions.node,browser:browser.version(),platform:process.platform,arch:process.arch},ok:checks.errors.length===0,exportAllowed:checks.errors.length===0&&missing.length===0&&!diagnostic,errors:checks.errors,warnings:missing,contentIntegrity:true,contentSha256:sha256(JSON.stringify(data)),logoSha256:logoSource?.sha256,portraitSha256:portraitSource?.sha256,reviewStatus:data.reviewStatus,visualApproval:'pending',publishReady:false,icons:icons.map(({semantics,...i})=>i),fontFiles:fonts.files,actualFonts,metrics:checks.metrics};
    await atomicWrite(previewFile,await page.content());await atomicWrite(reportFile,JSON.stringify(report,null,2)+'\n');
    if(preview)return {...report,preview:previewFile,report:reportFile};
    if(!report.exportAllowed)throw Error('排版检查失败：'+checks.errors.map(e=>`${e.region}：${e.detail}`).join('；')+`。报告：${reportFile}；未覆盖正式PNG`);
    const png=await page.locator('#card').screenshot({animations:'disabled',scale:'device'});
    if(png.readUInt32BE(16)!==2160||png.readUInt32BE(20)!==2700)throw Error('输出尺寸异常');
    const bundleDir=base+'.bundle';await mkdir(bundleDir,{recursive:true});
    const extension=s=>s.mime==='image/jpeg'?'.jpg':s.mime==='image/webp'?'.webp':'.png';
    const portraitName='portrait'+extension(portraitSource),logoName='logo'+extension(logoSource);
    await atomicWrite(path.join(bundleDir,portraitName),portraitSource.bytes);await atomicWrite(path.join(bundleDir,logoName),logoSource.bytes);
    await atomicWrite(path.join(bundleDir,'content.json'),JSON.stringify({...data,portrait:{...data.portrait,file:portraitName}},null,2)+'\n');
    await atomicWrite(path.join(bundleDir,'report.json'),JSON.stringify(report,null,2)+'\n');
    await atomicWrite(path.join(bundleDir,'package.lock.json'),JSON.stringify(lock,null,2)+'\n');
    const manifest={toolVersion:master.version,packageHash:report.packageHash,content:'content.json',portrait:portraitName,logo:logoName,report:'report.json',logoSha256:logoSource.sha256,portraitSha256:portraitSource.sha256,command:'在对应版本工具仓库中运行 npm run render -- --input <本包>/content.json --logo <本包>/'+logoName+' --output /tmp/reproduced.png'};
    await atomicWrite(path.join(bundleDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    await atomicWrite(base+'.bundle.json',JSON.stringify(manifest,null,2)+'\n');
    await atomicWrite(dest,png);return {...report,output:dest,preview:previewFile,report:reportFile,bundle:bundleDir};
  }finally{await browser.close();}
}
async function installedLogo(){
  const file=path.join(ROOT,'assets/brand/identity.local.json');let config;
  try{config=await json(file);}catch(e){if(e.code!=='ENOENT')throw e;try{config=await json(path.join(ROOT,'assets/brand/identity.v1.json'));}catch(e2){if(e2.code==='ENOENT')return null;throw e2;}}
  const source=await imageFile(path.join(ROOT,'assets/brand',config.file));if(source.sha256!==config.sha256)throw Error('已导入Logo原文件被修改，请重新导入');return source;
}
