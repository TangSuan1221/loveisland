import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,statSync} from 'node:fs';
const strokes=Array.from({length:15},(_,s)=>({color:'#774455',width:.01,tool:'pen',points:Array.from({length:s===14?1999:2000},(_,i)=>[(i+.12345678912345)/2000,(s+.12345678912345)/15])}));
const fixture={format:'ratings-tyrant-avatar',version:1,name:'容量边界检查',appearance:{strokes}};
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();page.setDefaultTimeout(20000);
try{
 await page.goto('http://127.0.0.1:5188/?qa',{waitUntil:'domcontentloaded'});await page.locator('[data-action="editAppearance"]').first().click();await page.locator('.av-preview-loading').waitFor({state:'hidden'});
 await page.locator('.av-file-input').setInputFiles({name:'large.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.locator('.av-status').filter({hasText:'已载入草稿'}).waitFor();
 await page.locator('[data-category="paint"]').click();await page.locator('[data-mirror]').check();await page.locator('.av-paint-canvas').click({position:{x:30,y:30}});assert.match(await page.locator('.av-status').innerText(),/不足|上限|用完|容量/);
 await page.locator('.avatar-studio [data-action="save"]').click();const count=()=>page.evaluate(()=>window.__avatarDiagnostics().production.candidates[0].appearance.strokes.reduce((n,s)=>n+s.points.length,0));assert.equal(await count(),29999);
 const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();await(await download).saveAs('qa/avatar-large-export-test.json');assert(statSync('qa/avatar-large-export-test.json').size<2*1024*1024);
 const data=JSON.parse(readFileSync('qa/avatar-large-export-test.json','utf8'));assert.equal(data.appearance.strokes.reduce((n,s)=>n+s.points.length,0),29999);
 await page.locator('.av-file-input').setInputFiles('qa/avatar-large-export-test.json');await page.locator('.av-status').filter({hasText:'已载入草稿'}).waitFor();
 writeFileSync('qa/avatar-large-export-results.json',JSON.stringify({result:'PASS',points:29999,exportBytes:statSync('qa/avatar-large-export-test.json').size,checks:['mirrored stroke rejected before truncation at capacity','maximal compact JSON export fits import limit and round trips']},null,2));console.log('PASS: 29999-point mirrored capacity and actual JSON download/import');
}finally{await browser.close();}
