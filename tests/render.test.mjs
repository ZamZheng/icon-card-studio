import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {chromium} from 'playwright';
import {render} from '../src/render.mjs';
import {ROOT} from '../src/files.mjs';
import {validateContent,resolveIcons} from '../src/content.mjs';
let dir,base,logo,portrait;
before(async()=>{
  dir=await mkdtemp(path.join(os.tmpdir(),'icon-card-test-'));base=JSON.parse(await readFile(path.join(ROOT,'examples/content.json'),'utf8'));
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
  try{const page=await browser.newPage({viewport:{width:600,height:800}});await page.setContent('<body style="margin:0;background:#7dbcf3"><div style="width:250px;height:300px;background:#f5e2ce;border-radius:50%;margin:170px auto 0"></div>');portrait=path.join(dir,'portrait.png');await page.screenshot({path:portrait});await page.setViewportSize({width:300,height:180});await page.setContent('<body style="margin:0;background:white;color:#005fba;font:bold 50px sans-serif;padding:20px">TEST<br>ASSET</body>');logo=path.join(dir,'logo.png');await page.screenshot({path:logo});}finally{await browser.close();}
});
after(async()=>{await rm(dir,{recursive:true,force:true});});
async function input(data,name='input'){const f=path.join(dir,name+'.json');await writeFile(f,JSON.stringify(data));return f;}
test('四条：真实字体、完整文案、高清PNG和跨目录复现',async()=>{
  const original=await input(base);const output=path.join(dir,'four.png');
  const r=await render({input:original,output,logo,portrait});assert.equal(r.ok,true);assert.equal(r.exportAllowed,true);assert.equal(r.publishReady,false);assert.equal(r.contentIntegrity,true);assert.equal(r.errors.length,0);
  const png=await readFile(output);assert.equal(png.readUInt32BE(16),2160);assert.equal(png.readUInt32BE(20),2700);assert.ok(Object.values(r.actualFonts).flat().every(f=>f.isCustomFont));
  const second=path.join(dir,'recreated.png');await render({input:path.join(r.bundle,'content.json'),logo:path.join(r.bundle,'logo.png'),output:second});assert.deepEqual(await readFile(second),png);
});
test('三条：没有空白第四项，固定母版可直接生产',async()=>{const r=await render({input:await input({...base,points:base.points.slice(0,3)},'three'),output:path.join(dir,'three.png'),logo,portrait});assert.equal(r.ok,true);assert.equal(r.icons.length,3);});
test('长正文失败，保留报告并且不覆盖旧PNG',async()=>{const output=path.join(dir,'protected.png');await writeFile(output,'previous-success');const data=structuredClone(base);data.points[0].body='这是一段很长的文字。'.repeat(70);await assert.rejects(render({input:await input(data,'long'),output,logo,portrait}),/排版检查失败/);assert.equal(await readFile(output,'utf8'),'previous-success');const report=JSON.parse(await readFile(path.join(dir,'protected.report.json'),'utf8'));assert.equal(report.exportAllowed,false);assert.ok(report.errors.some(e=>e.region.includes('知识点1')));});
test('长标题不静默缩字或截断',async()=>{await assert.rejects(render({input:await input({...base,title:'标题过长'.repeat(25),titleEmphasis:[]},'title-long'),output:path.join(dir,'title-long.png'),logo,portrait}),/主标题/);});
test('缺少品牌/肖像不能正式出图；诊断预览明确标识',async()=>{const i=await input(base,'missing');await assert.rejects(render({input:i,output:path.join(dir,'missing.png')}),/Logo未导入/);const r=await render({input:i,output:path.join(dir,'diagnostic.html'),preview:true,diagnostic:true});assert.equal(r.exportAllowed,false);assert.match(await readFile(r.preview,'utf8'),/工程预览 · 品牌资产未齐/);});
test('未知图标拒绝；未知语义明确回退',()=>{assert.throws(()=>resolveIcons([{iconId:'invented'}],{'general-info':{file:'g.svg'}}),/未知iconId/);const r=resolveIcons([{iconSemantic:'未登记概念'}],{'general-info':{file:'g.svg'}});assert.equal(r[0].id,'general-info');assert.match(r[0].reason,/未登记语义/);});
test('审核状态、强调短语和字段严格校验',()=>{assert.throws(()=>validateContent({...base,reviewStatus:'auto-approved'}),/reviewStatus/);assert.throws(()=>validateContent({...base,titleEmphasis:['不存在的短语']}),/原文/);assert.throws(()=>validateContent({...base,design:'replace'}),/未知文案字段/);});
test('HTML按原文显示，不执行脚本',async()=>{const data={...base,title:'<script>坏代码</script>',titleEmphasis:[]};const r=await render({input:await input(data,'literal'),output:path.join(dir,'literal.html'),logo,portrait,preview:true});assert.equal(r.contentIntegrity,true);const html=await readFile(r.preview,'utf8');assert.match(html,/&lt;script&gt;/);assert.ok(!html.includes('<script>坏代码</script>'));});
test('输出不能覆盖原稿',async()=>{const i=await input(base,'overwrite');await assert.rejects(render({input:i,output:portrait,logo,portrait}),/不得覆盖输入/);});
