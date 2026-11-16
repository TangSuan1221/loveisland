import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

// Check the packaged screening room, including the offline artwork and the handoff
// back to the interactive island. A GPU shader error can leave a canvas visible.
const address = new URL(process.argv[2] || pathToFileURL(resolve('演出放映室.html')));
address.searchParams.set('cinema-review','mutual-feeling');
address.searchParams.set('at','1250');
const browser = await chromium.launch({
  channel:'chrome',args:['--disable-breakpad','--disable-crashpad-for-testing','--enable-unsafe-webgpu','--enable-unsafe-swiftshader'],
});
try {
  const output = process.env.STAGE_CINEMA_FRAMES;
  if (output) await mkdir(output,{recursive:true});
  const page = await browser.newPage({viewport:output?{width:1440,height:810}:{width:820,height:480}});
  const errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error') errors.push(message.text());});
  await page.goto(address.href);
  const screen = page.locator('#perf-stage');
  const select = page.getByRole('combobox',{name:'演出背景'});
  const waitForStage = name => page.waitForFunction(
    name=>document.querySelector('.cinema-review')?.dataset.performanceStage===name,name,{timeout:90000},
  );
  await select.selectOption('auto');
  await waitForStage('hanami');
  await page.getByRole('button',{name:'定妆预览'}).click();
  await page.getByRole('combobox',{name:'演出机位'}).selectOption('full');
  await page.waitForURL(url=>url.searchParams.get('framing')==='full');
  for (const id of ['hanami','cabin','orb']) {
    const selector = page.getByRole('combobox',{name:'定妆场景'});
    if (await selector.inputValue() !== id) await selector.selectOption(id);
    await page.waitForURL(url=>url.searchParams.get('perf')===id);
    await page.locator('canvas[data-stage-ready=true]').waitFor();
    assert.equal(await page.getByRole('combobox',{name:'演出机位'}).inputValue(),'full');
  }
  await page.getByRole('button',{name:'返回放映室'}).click();
  await select.selectOption('auto');
  await waitForStage('hanami');
  assert.equal(await page.locator('[data-cinema-event]').inputValue(),'mutual-feeling');
  if (output) {
    for (const [event,stage,at] of [
      ['mutual-feeling','hanami',3750],['connected','cabin',3100],['feelings-declined','orb',3700],
    ]) {
      address.searchParams.set('cinema-review',event);
      address.searchParams.set('at',String(at));
      await page.goto(address.href);
      await select.selectOption('auto');
      await waitForStage(stage);
      await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
      console.log(event,await page.locator('main').getAttribute('data-shot'),await page.locator('.island-performance [aria-live]').innerText());
      assert.ok(await page.locator('.island-performance [aria-live]').innerText());
      await page.screenshot({path:resolve(output,'cinema-'+stage+'.png')});
    }
  }
  for (const name of ['cabin','orb']) {
    await select.selectOption(name);
    await waitForStage(name);
    assert.equal(await screen.isVisible(),true);
  }
  await page.locator('.island-performance>button').click();
  await page.locator('main[data-playback=ended]').waitFor();
  assert.equal(await screen.evaluate(canvas=>getComputedStyle(canvas).display),'none');
  assert.equal(await page.locator('#scene canvas').isVisible(),true);
  await select.selectOption('auto');
  await page.locator('[data-cinema-event]').selectOption('CAMP_new_home_0');
  await page.locator('main[data-shot=location]').waitFor();
  assert.equal(await screen.evaluate(canvas=>getComputedStyle(canvas).display),'none');
  assert.deepEqual(errors,[]);
  console.log('三幕实景回放、暂停换景、跳过恢复和 GPU 程序均通过。');
} finally {
  await browser.close();
}
