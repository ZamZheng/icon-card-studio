import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {render} from '../src/render.mjs';
import {ROOT} from '../src/files.mjs';
await mkdir(path.join(ROOT,'output'),{recursive:true});
const result=await render({input:path.join(ROOT,'examples/content.json'),output:path.join(ROOT,'output/engineering-preview.html'),preview:true,diagnostic:true});
if(!result.ok)throw Error(JSON.stringify(result.errors));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
try{const page=await browser.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:2});await page.setContent(await readFile(result.preview,'utf8'));await page.evaluate(()=>document.fonts.ready);await page.locator('#card').screenshot({path:path.join(ROOT,'output/engineering-preview.png'),scale:'device'});}finally{await browser.close();}
console.log('工程预览已生成；正式人物肖像尚未接入，不是业务成品。');
