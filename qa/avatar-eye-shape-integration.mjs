import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { animeEyeContour } from '../src/avatar-anime.js';

// Real game + real WebGPU + real import/download/save paths. No mocked application
// modules, persistent browser profile, shared JSON files, or skipped assertions.
// Run alone: node --test qa/avatar-eye-shape-integration.mjs
// Concurrent isolation check: node --test --test-concurrency=2 qa/avatar-eye-shape-editor.test.mjs qa/avatar-eye-shape-integration.mjs
// Vite must already serve AVATAR_QA_URL (default below). Browser overrides match
// the isolated module suite: EYE_TEST_BROWSER_CHANNEL / EYE_TEST_BROWSER_EXECUTABLE.
const url = process.env.AVATAR_QA_URL || 'http://127.0.0.1:5188/?qa';
const defaults = {
  eyeInnerY: 0, eyeOuterY: .05,
  eyeUpperInnerX: -.65, eyeUpperInnerY: 1.25,
  eyeUpperOuterX: .45, eyeUpperOuterY: 1.2,
  eyeLowerInnerX: -.65, eyeLowerInnerY: -.48,
  eyeLowerOuterX: .5, eyeLowerOuterY: -.6,
};
const axes = {
  inner: [null, 'eyeInnerY'], outer: [null, 'eyeOuterY'],
  upperInner: ['eyeUpperInnerX', 'eyeUpperInnerY'], upperOuter: ['eyeUpperOuterX', 'eyeUpperOuterY'],
  lowerInner: ['eyeLowerInnerX', 'eyeLowerInnerY'], lowerOuter: ['eyeLowerOuterX', 'eyeLowerOuterY'],
};
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .00002, `${actual} ≈ ${expected}`);
const av = (page, selector) => page.locator(`.avatar-studio ${selector}`);
const action = (page, name) => av(page, `[data-action="${name}"]`).first();
const click = (page, name) => action(page, name).click();
const diag = page => page.evaluate(() => window.__avatarDiagnostics());
const board = page => av(page, '.av-eye-shape-editor svg');
const handle = (page, point) => av(page, `[data-eye-point="${point}"]`);
let browser;
before(async () => {
  const executablePath = process.env.EYE_TEST_BROWSER_EXECUTABLE;
  const channel = process.env.EYE_TEST_BROWSER_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : { channel }) });
});
after(async () => { await browser?.close(); });

async function clean(page, expected = true) {
  assert.equal(await av(page, '.av-save-state').innerText(), expected ? '已保存到角色库' : '有未保存修改');
}
async function history(page, undo, redo) {
  assert.equal(await action(page, 'undo').isEnabled(), undo, 'undo availability');
  assert.equal(await action(page, 'redo').isEnabled(), redo, 'redo availability');
}
async function exportDraft(page) {
  const downloaded = page.waitForEvent('download');
  await click(page, 'export');
  const download = await downloaded;
  assert.equal(await download.failure(), null, 'JSON download succeeds');
  const stream = await download.createReadStream();
  assert.ok(stream, 'download has a readable JSON body');
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.equal(result.format, 'ratings-tyrant-avatar');
  assert.equal(result.version, 1);
  return result;
}
async function importDraft(page, value) {
  await av(page, '.av-file-input').setInputFiles({
    name: 'eye-shape-roundtrip.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(value)),
  });
  await page.waitForFunction(() => document.querySelector('.avatar-studio .av-status')?.textContent === '角色文件已载入草稿，保存后生效。');
}
async function open(page, id) {
  await page.locator('[data-action="editAppearance"]').first().click();
  await av(page, '.av-preview-loading').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => window.__avatarDiagnostics?.().preview?.backend === 'webgpu');
  if (id) await av(page, `[data-person="${id}"]`).click();
}
async function eyes(page) {
  await av(page, '[data-category="eyes"]').click();
  await av(page, '.av-eye-shape-editor').waitFor();
}
async function closeClean(page) {
  await clean(page);
  await click(page, 'close');
  await page.locator('.avatar-studio').waitFor({ state: 'detached' });
}
async function save(page, id) {
  const draft = await exportDraft(page);
  await click(page, 'save');
  assert.match(await av(page, '.av-status').innerText(), /^已保存。/);
  await clean(page);
  const saved = (await diag(page)).production.candidates.find(c => c.id === id);
  assert.ok(saved, 'saved character exists in production state');
  assert.equal(saved.name, draft.name);
  assert.deepEqual(saved.appearance, draft.appearance, 'save persists exactly the exported draft');
  return draft;
}
async function fixture(t, { enabled = true, mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    acceptDownloads: true, ...(mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  let page;
  const lifecycle = [];
  const recordLifecycle = event => { lifecycle.push(event); if (lifecycle.length > 40) lifecycle.shift(); };
  const errors = [];
  // Register cleanup before creating a page, so even failed initialization is isolated.
  t.after(async () => {
    try {
      const observation = page ? await page.evaluate(() => ({
        url: location.href,
        saveState: document.querySelector('.avatar-studio .av-save-state')?.textContent,
        confirmation: !!document.querySelector('.avatar-studio .av-confirm:not([hidden])'),
        undoDisabled: document.querySelector('.avatar-studio [data-action="undo"]')?.disabled,
        redoDisabled: document.querySelector('.avatar-studio [data-action="redo"]')?.disabled,
        readout: document.querySelector('.av-eye-shape-editor .eye-readout')?.textContent,
        cancelEvents: window.eyeQaCancelEvents,
        cancellationStages: window.eyeQaCancellationStages,
        timeOrigin: performance.timeOrigin,
      })) : { initialization: 'newPage failed' };
      t.diagnostic(JSON.stringify({ ...observation, lifecycle, pageErrors: errors }));
    } finally {
      // Owns downloads and CDP sessions too: no detach-after-page-close race.
      try { await context.close(); }
      finally { assert.deepEqual(errors, [], 'no uncaught game/preview errors'); }
    }
  });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', e => errors.push(e.message));
  page.on('crash', () => errors.push('game browser page crashed'));
  page.on('framenavigated', frame => {
    if(frame === page.mainFrame())recordLifecycle({event:'main-navigation',at:Date.now(),url:frame.url()});
  });
  page.on('websocket', socket => socket.on('framereceived', ({payload}) => {
    try {
      const message=JSON.parse(String(payload));
      if(['full-reload','update','error'].includes(message.type))recordLifecycle({
        event:'dev-server-'+message.type,at:Date.now(),path:message.path,
        updates:message.updates?.map(update=>({type:update.type,path:update.path})),
      });
    } catch { /* Unrelated non-JSON websocket messages are not lifecycle evidence. */ }
  }));
  // Read-only pointer telemetry, never replacing module callbacks or game state.
  await page.addInitScript(() => window.addEventListener('pointerdown', e => { window.eyeQaPointerId = e.pointerId; }, true));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-action="editAppearance"]').first().waitFor();
  assert.equal((await diag(page)).backend, 'webgpu', 'test is on the actual WebGPU game');
  await open(page);
  await click(page, 'new');
  const id = await av(page, '[data-person][aria-pressed="true"]').getAttribute('data-person');
  assert.ok(id, 'new isolated test character selected');
  const seed = {
    format: 'ratings-tyrant-avatar', version: 1, name: '眼形集成验证',
    appearance: { ...defaults, artStyle: 'anime', eyeStyle: enabled ? 'anime_designed' : 'round', hairColor: '#123456' },
  };
  await importDraft(page, seed);
  const baseline = await save(page, id);
  await closeClean(page);
  await open(page, id);
  await eyes(page);
  await history(page, false, false);
  await clean(page);
  return { page, id, baseline };
}
async function point(page, x, y) {
  return board(page).evaluate((svg, { x, y }) => {
    const p = new DOMPoint(180 + x * 100, 210 - y * 100).matrixTransform(svg.getScreenCTM());
    return { x: p.x, y: p.y };
  }, { x, y });
}
async function beginDrag(page, id) {
  await board(page).scrollIntoViewIfNeeded();
  const p = await handle(page, id).evaluate(el => {
    const p = new DOMPoint(0, 0).matrixTransform(el.getScreenCTM());
    return { x: p.x, y: p.y };
  });
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  assert.equal(await board(page).evaluate(svg => svg.hasPointerCapture(window.eyeQaPointerId)), true, 'real pointer captured');
}
async function moveDrag(page, x, y) {
  const p = await point(page, x, y);
  await page.mouse.move(p.x, p.y, { steps: 5 });
}
async function drag(page, id, x, y) {
  await beginDrag(page, id);
  await moveDrag(page, x, y);
  await page.mouse.up();
}
async function assertOnly(page, baseline, patch, name = baseline.name) {
  const value = await exportDraft(page);
  assert.deepEqual(value, { ...baseline, name, appearance: { ...baseline.appearance, ...patch } });
  return value;
}

const options = { timeout: 150000 };
test('game integration: enable → drag → keyboard → single-step undo/redo, retaining unrelated fields', options, async t => {
  const { page, baseline } = await fixture(t, { enabled: false });
  assert.equal(await av(page, '[data-eye-panel]').isVisible(), false);
  await av(page, '[data-eye-enable]').click();
  assert.equal(await av(page, '[data-eye-point]').count(), 6);
  await assertOnly(page, baseline, { eyeStyle: 'anime_designed' });
  await history(page, true, false);
  await click(page, 'undo');
  await assertOnly(page, baseline, {});
  await history(page, false, true); await clean(page);
  await click(page, 'redo');
  const enabled = await assertOnly(page, baseline, { eyeStyle: 'anime_designed' });
  const oldPath = await av(page, '[data-eye-curve="upper"]').getAttribute('d');
  await beginDrag(page, 'upperInner');
  await moveDrag(page, -.43, 1.4);
  assert.notEqual(await av(page, '[data-eye-curve="upper"]').getAttribute('d'), oldPath, 'live path preview changed before pointerup');
  await clean(page, false);
  await page.mouse.up();
  const dragged = await assertOnly(page, enabled, { eyeUpperInnerX: -.43, eyeUpperInnerY: 1.4 });
  await click(page, 'undo'); await assertOnly(page, enabled, {});
  await click(page, 'redo'); assert.deepEqual(await exportDraft(page), dragged);

  await handle(page, 'lowerOuter').focus();
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowUp');
  await page.keyboard.up('ArrowUp');
  const keyed = await assertOnly(page, dragged, { eyeLowerOuterY: -.54 });
  await click(page, 'undo'); assert.deepEqual(await exportDraft(page), dragged, 'repeat is a single history entry');
  await click(page, 'redo'); assert.deepEqual(await exportDraft(page), keyed);
  await handle(page, 'lowerOuter').focus();
  await page.keyboard.press('Shift+ArrowLeft');
  const fine = await assertOnly(page, keyed, { eyeLowerOuterX: .498 });
  await click(page, 'undo'); assert.deepEqual(await exportDraft(page), keyed);
  await click(page, 'redo'); assert.deepEqual(await exportDraft(page), fine);
  await av(page, '[data-category="hair"]').click(); await eyes(page);
  assert.deepEqual(await exportDraft(page), fine, 'category switches retain committed draft edits without extra history');
  // Walk every entry back: fine adjustment, held key, drag, activation, then none.
  for (const expected of [keyed, dragged, enabled, baseline]) {
    await click(page, 'undo'); assert.deepEqual(await exportDraft(page), expected);
  }
  await history(page, false, true); await clean(page);
});

test('game integration: all ten curve parameters survive export/import, save, close, and localStorage reload', options, async t => {
  const { page, id, baseline } = await fixture(t);
  const targets = { inner: [-1, .16], outer: [1, .23], upperInner: [-.72, 1.48], upperOuter: [.62, 1.1], lowerInner: [-.5, -.72], lowerOuter: [.7, -.9] };
  const patch = {};
  for (const [control, [x, y]] of Object.entries(targets)) {
    await drag(page, control, x, y);
    const [xKey, yKey] = axes[control];
    if (xKey) patch[xKey] = x;
    patch[yKey] = y;
  }
  const edited = await assertOnly(page, baseline, patch);
  assert.equal(Object.keys(patch).length, 10);
  await av(page, '[data-eye-reset]').click();
  await assertOnly(page, baseline, {});
  await importDraft(page, edited);
  assert.deepEqual(await exportDraft(page), edited, 'real file input restores the full exported appearance');
  await click(page, 'undo'); await assertOnly(page, baseline, {});
  await click(page, 'redo'); assert.deepEqual(await exportDraft(page), edited);
  await save(page, id);
  const savedProduction = (await diag(page)).production.candidates.find(c => c.id === id);
  await closeClean(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-action="editAppearance"]').first().waitFor();
  const reloaded = (await diag(page)).production.candidates.find(c => c.id === id);
  assert.equal(reloaded.name, savedProduction.name);
  assert.deepEqual(reloaded.appearance, savedProduction.appearance, 'actual storage reload preserves all fields');
  await open(page, id); await eyes(page);
  assert.deepEqual(await exportDraft(page), edited);
  await history(page, false, false); await closeClean(page);
});

for (const mode of ['Escape', 'pointercancel', 'blur', 'category-pointer', 'category-keyboard']) {
  test(`game integration: ${mode} cancels active preview without dirty state or history`, options, async t => {
    const { page, baseline } = await fixture(t);
    // Read-only evidence for native release events after category teardown.
    // Keep this bounded and retain it in TAP diagnostics, including on failure.
    if (mode === 'category-pointer') {
      await page.evaluate(() => {
        window.eyeQaCancelEvents = [];
        window.eyeQaCancellationStages = [];
        for (const type of ['pointerdown','pointerup','pointercancel','lostpointercapture','click','cancel','close']) {
          document.addEventListener(type, e => {
            const target = e.target, button = target.closest?.('button');
            const entry = { type, trusted:e.isTrusted, target:target.tagName,
              class:target.getAttribute?.('class'), action:button?.dataset.action,
              category:button?.dataset.category, point:target.closest?.('[data-eye-point]')?.dataset.eyePoint,
              x:e.clientX, y:e.clientY, studio:!!document.querySelector('.avatar-studio') };
            window.eyeQaCancelEvents.push(entry);
            if(window.eyeQaCancelEvents.length>40)window.eyeQaCancelEvents.shift();
            setTimeout(() => { entry.studioAfter=!!document.querySelector('.avatar-studio'); },0);
          }, true);
        }
      });
    }
    if (mode === 'category-keyboard') {
      await handle(page, 'upperInner').focus();
      await page.keyboard.down('ArrowRight');
    } else {
      await beginDrag(page, 'upperInner');
      await moveDrag(page, -.43, 1.4);
    }
    await clean(page, false); await history(page, false, false);
    if (mode === 'Escape') await page.keyboard.press('Escape');
    if (mode === 'pointercancel') await board(page).evaluate(svg => svg.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.eyeQaPointerId, bubbles: true })));
    if (mode === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    // Invoke the real category action during capture/held key, without moving
    // focus first: this specifically exercises parent teardown ordering.
    if (mode.startsWith('category-')) {
      const beforeNavigation=await page.evaluate(() => {
        window.eyeQaStudio=document.querySelector('.avatar-studio');
        window.eyeQaBoard=document.querySelector('.av-eye-shape-editor svg');
        return performance.timeOrigin;
      });
      await av(page, '[data-category="hair"]').evaluate(button => button.click());
      const switched=await page.evaluate(() => {
        const studio=document.querySelector('.avatar-studio');
        const state={stage:'after-category-action',sameStudio:!!studio&&studio===window.eyeQaStudio,
          timeOrigin:performance.timeOrigin,oldBoardConnected:window.eyeQaBoard?.isConnected,
          captured:window.eyeQaBoard?.hasPointerCapture(window.eyeQaPointerId),
          selected:studio?.querySelector('[data-category][aria-selected="true"]')?.dataset.category};
        window.eyeQaCancellationStages?.push(state);return state;
      });
      assert.equal(switched.timeOrigin,beforeNavigation,'category action must not navigate/reload the game');
      assert.equal(switched.sameStudio,true,'category teardown must keep the same studio open');
      assert.equal(switched.selected,'hair','the real hair category action was applied');
      assert.equal(switched.oldBoardConnected,false,'old eye DOM was destroyed, not reused');
      if(mode==='category-pointer')assert.equal(switched.captured,false,'teardown releases native capture');
      assert.deepEqual((await diag(page)).preview.appearance,baseline.appearance,'unfinished gesture rolls back before release');
      await clean(page); await history(page,false,false);
    }
    if (mode === 'category-keyboard') await page.keyboard.up('ArrowRight');
    else await page.mouse.up();
    if(mode.startsWith('category-')) {
      const released=await page.evaluate(() => {
        const studio=document.querySelector('.avatar-studio');
        const state={stage:'after-input-release',sameStudio:!!studio&&studio===window.eyeQaStudio,
          timeOrigin:performance.timeOrigin,selected:studio?.querySelector('[data-category][aria-selected="true"]')?.dataset.category};
        window.eyeQaCancellationStages?.push(state);return state;
      });
      assert.equal(released.sameStudio,true,'releasing canceled input must not close/recreate the studio');
      assert.equal(released.selected,'hair','input release must not activate another category');
    }
    assert.equal(await av(page, '.av-confirm').first().isVisible(), false, 'cancel must not open discard dialog');
    await clean(page); await history(page, false, false);
    if (mode.startsWith('category-')) await eyes(page);
    await assertOnly(page, baseline, {});
    await closeClean(page);
  });
}

test('game integration: host close during capture cancels before checking dirty state', options, async t => {
  const { page, id, baseline } = await fixture(t);
  await beginDrag(page, 'upperInner'); await moveDrag(page, -.43, 1.4);
  await clean(page, false); await history(page, false, false);
  // Programmatic host navigation is intentional: unlike a mouse click it does
  // not blur the handle before close() makes its dirty-state decision.
  await action(page, 'close').evaluate(button => button.click());
  await page.mouse.up();
  assert.equal(await page.locator('.avatar-studio').count(), 0, 'host close must roll back the unfinished gesture and close, not leave a stale discard prompt');
  const saved = (await diag(page)).production.candidates.find(c => c.id === id);
  assert.deepEqual(saved.appearance, baseline.appearance);
  await open(page, id); await eyes(page);
  await assertOnly(page, baseline, {}); await history(page, false, false); await closeClean(page);
});

test('game integration: close during capture preserves an earlier committed unsaved edit and its confirmation', options, async t => {
  const { page, id, baseline } = await fixture(t);
  await drag(page, 'lowerInner', -.52, -.7);
  const edited = await assertOnly(page, baseline, { eyeLowerInnerX: -.52, eyeLowerInnerY: -.7 });
  await clean(page, false); await history(page, true, false);
  const upperBefore = await handle(page, 'upperInner').getAttribute('transform');
  const lowerBefore = await handle(page, 'lowerInner').getAttribute('transform');

  await beginDrag(page, 'upperInner'); await moveDrag(page, -.43, 1.4);
  assert.notEqual(await handle(page, 'upperInner').getAttribute('transform'), upperBefore, 'second gesture has a live preview');
  // Do not focus/click through Playwright first: blur would cancel the gesture
  // before requestAction() and conceal a regression in host dirty-check ordering.
  await action(page, 'close').evaluate(button => button.click());
  assert.equal(await page.locator('.avatar-studio').count(), 1, 'earlier committed edit keeps the studio open');
  assert.equal(await av(page, '.av-confirm').first().isVisible(), true, 'earlier unsaved edit still requires save/discard confirmation');
  assert.equal(await handle(page, 'upperInner').getAttribute('transform'), upperBefore, 'only the unfinished gesture rolls back before confirmation');
  assert.equal(await handle(page, 'lowerInner').getAttribute('transform'), lowerBefore, 'earlier committed control-point edit remains');
  assert.equal(await board(page).evaluate(svg => svg.hasPointerCapture(window.eyeQaPointerId)), false, 'host cancellation releases capture');
  await page.mouse.up();
  await clean(page, false); await history(page, true, false);
  assert.deepEqual((await diag(page)).production.candidates.find(c => c.id === id).appearance, baseline.appearance, 'confirmation has not saved either edit');

  await click(page, 'stay');
  assert.equal(await av(page, '.av-confirm').first().isVisible(), false);
  assert.deepEqual(await exportDraft(page), edited, 'Stay retains exactly the earlier edit without canceled-drag fields');
  await click(page, 'undo'); await assertOnly(page, baseline, {});
  await clean(page); await history(page, false, true);
  await click(page, 'redo'); assert.deepEqual(await exportDraft(page), edited);
  await clean(page, false); await history(page, true, false);
  await click(page, 'close');
  assert.equal(await av(page, '.av-confirm').first().isVisible(), true);
  await click(page, 'save-continue');
  await page.locator('.avatar-studio').waitFor({ state: 'detached' });
  const saved = (await diag(page)).production.candidates.find(c => c.id === id);
  assert.equal(saved.name, edited.name);
  assert.deepEqual(saved.appearance, edited.appearance, 'save-and-close persists only the committed edit');
  await open(page, id); await eyes(page);
  assert.deepEqual(await exportDraft(page), edited);
  await history(page, false, false); await closeClean(page);
});

test('game integration: blank clicks, selection, out-and-back, and category switching are clean no-ops', options, async t => {
  const { page, baseline } = await fixture(t);
  await board(page).scrollIntoViewIfNeeded();
  const blank = await point(page, 0, 1.95);
  await page.mouse.click(blank.x, blank.y);
  // A <g> bounding box includes its label; click the actual visible circle, not
  // the label-to-circle gap (which is intentionally not an interactive target).
  await handle(page, 'upperInner').locator('.eye-dot').click();
  await beginDrag(page, 'upperInner');
  await moveDrag(page, -.45, 1.4); await moveDrag(page, -.65, 1.25); await page.mouse.up();
  await av(page, '[data-category="hair"]').click(); await eyes(page);
  await assertOnly(page, baseline, {});
  await clean(page); await history(page, false, false); await closeClean(page);
});

test('game integration: committed unsaved edits prompt, stay retains them, discard restores saved character', options, async t => {
  const { page, id, baseline } = await fixture(t);
  await drag(page, 'lowerInner', -.52, -.7);
  const edited = await assertOnly(page, baseline, { eyeLowerInnerX: -.52, eyeLowerInnerY: -.7 });
  await click(page, 'close');
  assert.equal(await av(page, '.av-confirm').first().isVisible(), true, 'genuine unsaved edit requires confirmation');
  await click(page, 'stay'); assert.deepEqual(await exportDraft(page), edited);
  await click(page, 'close'); await click(page, 'discard');
  await page.locator('.avatar-studio').waitFor({ state: 'detached' });
  assert.deepEqual((await diag(page)).production.candidates.find(c => c.id === id).appearance, baseline.appearance);
  await open(page, id); await eyes(page);
  await assertOnly(page, baseline, {}); await clean(page); await history(page, false, false); await closeClean(page);
});

test('game integration: eye commit uses the current name, not a stale name from drag start', options, async t => {
  const { page, baseline } = await fixture(t);
  await beginDrag(page, 'upperInner'); await moveDrag(page, -.43, 1.4);
  // Simulate a concurrent draft edit through the actual name-input listener,
  // without focus transfer (which would deliberately cancel the eye gesture).
  await av(page, '.av-name').evaluate(input => { input.value = '当前名字不能回退'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.mouse.up();
  const edited = await assertOnly(page, baseline, { eyeUpperInnerX: -.43, eyeUpperInnerY: 1.4 }, '当前名字不能回退');
  await click(page, 'undo'); await assertOnly(page, baseline, {}, '当前名字不能回退');
  await history(page, false, true);
  await click(page, 'redo'); assert.deepEqual(await exportDraft(page), edited);
});

test('game integration: real mobile touch is one undo step and touchCancel leaves no dirty state', options, async t => {
  const { page, id, baseline } = await fixture(t, { mobile: true });
  await board(page).scrollIntoViewIfNeeded();
  assert.equal(await board(page).evaluate(svg => getComputedStyle(svg).touchAction), 'none');
  const session = await page.context().newCDPSession(page); // fixture context owns cleanup
  const scroll = () => page.evaluate(() => ({ page: scrollY, fields: document.querySelector('.avatar-studio .av-fields').scrollTop }));
  const beforeScroll = await scroll();
  const start = await point(page, -.65, 1.25), end = await point(page, -.45, 1.35);
  const send = (type, p) => session.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y, id: 0, radiusX: 2, radiusY: 2, force: 1 }] : [] });
  await send('touchStart', start); await send('touchMove', end);
  assert.equal(await board(page).evaluate(svg => svg.hasPointerCapture(window.eyeQaPointerId)), true);
  await history(page, false, false); await clean(page, false);
  await send('touchEnd');
  assert.deepEqual(await scroll(), beforeScroll, 'touch changes the curve rather than scrolling');
  const moved = await exportDraft(page);
  near(moved.appearance.eyeUpperInnerX, -.45); near(moved.appearance.eyeUpperInnerY, 1.35);
  assert.deepEqual(moved.appearance, { ...baseline.appearance, eyeUpperInnerX: moved.appearance.eyeUpperInnerX, eyeUpperInnerY: moved.appearance.eyeUpperInnerY });
  await click(page, 'undo'); await assertOnly(page, baseline, {}); await history(page, false, true); await clean(page);
  await click(page, 'redo'); assert.deepEqual(await exportDraft(page), moved);
  await click(page, 'undo');
  await board(page).scrollIntoViewIfNeeded();
  await send('touchStart', await point(page, -.65, 1.25));
  await send('touchMove', await point(page, -.4, 1.4));
  await send('touchCancel');
  await assertOnly(page, baseline, {}); await history(page, false, true); await clean(page);
  await save(page, id); await closeClean(page);
});


test('game integration: eyelid slider refreshes production-matching solids and raw handles remain independently editable', options, async t => {
  const { page, baseline } = await fixture(t);
  const assertContour = async appearance => {
    const contour = animeEyeContour(appearance);
    const cubic = (p, t) => p[0]*(1-t)**3 + 3*p[1]*t*(1-t)**2 + 3*p[2]*t*t*(1-t) + p[3]*t**3;
    const upper = await av(page, '[data-eye-curve="upper"]').getAttribute('d');
    const values = upper.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.equal(values.length, 8);
    const xs = [0,2,4,6].map(i => (values[i] - 180)/100);
    const ys = [1,3,5,7].map(i => (210 - values[i])/100);
    for (let i=0; i<=16; i++) {
      const x = cubic(xs, i/16), y = cubic(ys, i/16);
      const expected = contour.top(x * contour.w) / contour.h;
      assert.ok(Math.abs(y - expected) < .000002, `SVG upper ${y} matches production ${expected}`);
    }
    assert.ok((await av(page, '[data-eye-sclera]').getAttribute('d')).startsWith(`${upper} C `));
  };
  await assertContour(baseline.appearance);
  const rawGuide = await av(page, '[data-eye-guide="upper"]').getAttribute('points');
  const rawHandle = await handle(page, 'upperInner').getAttribute('transform');
  const lower = await av(page, '[data-eye-curve="lower"]').getAttribute('d');
  await page.evaluate(() => { window.eyeSliderHandle = document.querySelector('[data-eye-point="upperInner"]'); });
  const lid = av(page, '[data-range="eyeLid"]');
  await lid.focus(); await page.keyboard.press('End');
  assert.equal(await lid.inputValue(), '1');
  const compressed = { ...baseline.appearance, eyeLid: 1 };
  // Assert immediately after native input, before export or category change can refresh it.
  await assertContour(compressed);
  assert.equal(await page.evaluate(() => eyeSliderHandle === document.querySelector('[data-eye-point="upperInner"]')), true);
  assert.equal(await av(page, '[data-eye-guide="upper"]').getAttribute('points'), rawGuide);
  assert.equal(await handle(page, 'upperInner').getAttribute('transform'), rawHandle);
  assert.equal(await av(page, '[data-eye-curve="lower"]').getAttribute('d'), lower);
  await assertOnly(page, baseline, { eyeLid: 1 });
  await history(page, true, false);
  await click(page, 'undo'); await assertContour(baseline.appearance); await history(page, false, true); await clean(page);
  await click(page, 'redo'); await assertContour(compressed);
  // Curve scalar sliders are intentionally hidden by the host; edit its real SVG handle.
  // The eyeLid slider above must leave raw controls untouched, but raw edits still work.
  await drag(page, 'upperInner', -.65, 1.8);
  const changed = { ...compressed, eyeUpperInnerY: 1.8 };
  await assertContour(changed);
  assert.equal(await handle(page, 'upperInner').getAttribute('transform'), 'translate(115,30)');
  await assertOnly(page, baseline, { eyeLid: 1, eyeUpperInnerY: 1.8 });
  await click(page, 'undo'); await assertContour(compressed);
  await click(page, 'undo'); await assertContour(baseline.appearance);
  await assertOnly(page, baseline, {}); await history(page, false, true); await closeClean(page);
});
