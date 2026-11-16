import {chromium} from 'playwright';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
const server=await createServer({server:{port:0,host:'127.0.0.1'},logLevel:'error'});
await server.listen();let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--disable-crash-reporter','--disable-breakpad','--disable-crashpad-for-testing','--no-zygote','--single-process']});
  const page=await browser.newPage({viewport:{width:1360,height:900}});
  page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname==='/@vite/client'){await route.fulfill({contentType:'text/javascript',body:'export function createHotContext(){return {accept(){},prune(){},dispose(){},data:{}}} export function updateStyle(id,css){const s=document.createElement("style");s.textContent=css;document.head.append(s)} export function removeStyle(){} export function injectQuery(url){return url}'});return;}const transformed=await server.transformRequest(url.pathname+url.search);await route.fulfill({contentType:'text/javascript',body:transformed?.code||''});});
  await page.route('**/camp-qa',r=>r.fulfill({contentType:'text/html',body:'<main></main>'}));
  await page.goto(server.resolvedUrls.local[0]+'camp-qa');
  await page.evaluate(async()=>{
    const {createProduction}=await import('/src/production-engine.js');
    const {createProductionInterface}=await import('/src/production-interface.js');
    const game=createProduction({spatial:true});game.dispatch('start',{mode:'tutorial'});
    for(const c of game.getState().candidates.slice(0,game.getState().castSize))game.dispatch('toggleCast',{id:c.id});
    game.dispatch('confirmCast');
    createProductionInterface({production:game,root:document.querySelector('main')}).refresh();
  });
  await page.getByRole('button',{name:'营地建造'}).click();
  const dialog=page.locator('dialog'),output=dialog.locator('output'),map=dialog.locator('canvas'),box=await map.boundingBox();
  const tile=(x,y)=>({position:{x:box.width*(x+.5)/64,y:box.height*(y+.5)/64}});
  await dialog.locator('[data-buy]').click();
  await map.click(tile(31,31));await output.getByText('火塘已落成。',{exact:true}).waitFor();
  await map.click(tile(31,31));await dialog.getByRole('button',{name:'收回',exact:true}).click();await output.getByText('建筑已收回仓库。').waitFor();
  await dialog.locator('[data-undo]').click();await output.getByText('已撤销。').waitFor();
  await dialog.locator('[data-tool]').selectOption('clear');await map.click(tile(24,12));await output.getByText('工程完成，共 1 格。').waitFor();
  await dialog.locator('summary').click();await dialog.locator('[data-export]').click();assert.match(await dialog.locator('textarea').inputValue(),/^CI-BP2\./);
  await dialog.locator('[data-import]').click();await output.getByText('营地蓝图已恢复。').waitFor();
  await dialog.locator('[data-close]').click();assert.equal(await page.locator('dialog').count(),0);
  assert.deepEqual(errors,[]);console.log('Camp editor passed in Chrome');
}finally{await browser?.close();await server.close();}
