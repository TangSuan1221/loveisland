import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { animeEyeContour } from '../src/avatar-anime.js';
import { normalizeAppearance } from '../src/avatar-schema.js';

// Runs the isolated module in a real browser; no application server or build writes.
// Windows uses installed Chrome. Override with EYE_TEST_BROWSER_CHANNEL or
// EYE_TEST_BROWSER_EXECUTABLE when needed; other platforms use Playwright Chromium.
const defaults = {
  eyeInnerY: 0, eyeOuterY: .05,
  eyeUpperInnerX: -.65, eyeUpperInnerY: 1.25,
  eyeUpperOuterX: .45, eyeUpperOuterY: 1.2,
  eyeLowerInnerX: -.65, eyeLowerInnerY: -.48,
  eyeLowerOuterX: .5, eyeLowerOuterY: -.6,
};
const base = { ...defaults, eyeLid: 0, eyeStyle: 'anime_designed', hairColor: '#123456', faceArt: [{ id: 'keep', color: '#fff' }] };
const pointFields = {
  inner: [null, 'eyeInnerY'], outer: [null, 'eyeOuterY'],
  upperInner: ['eyeUpperInnerX', 'eyeUpperInnerY'], upperOuter: ['eyeUpperOuterX', 'eyeUpperOuterY'],
  lowerInner: ['eyeLowerInnerX', 'eyeLowerInnerY'], lowerOuter: ['eyeLowerOuterX', 'eyeLowerOuterY'],
};
const source = await readFile(new URL('../src/avatar-eye-shape-editor.js', import.meta.url), 'utf8');
const curveSource = await readFile(new URL('../src/avatar-eye-curve.js', import.meta.url), 'utf8');
const curveModuleUrl = `data:text/javascript;base64,${Buffer.from(curveSource).toString('base64')}`;
// Real shared module in the browser fixture; no geometry mock or app server.
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source.replace('./avatar-eye-curve.js', curveModuleUrl)).toString('base64')}`;
let browser;
before(async () => {
  const executablePath = process.env.EYE_TEST_BROWSER_EXECUTABLE;
  const channel = process.env.EYE_TEST_BROWSER_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined);
  // This fixture tests only SVG/DOM and native input, not WebGPU rendering.
  // Do not compete for GPU resources with concurrent real-game/visual suites.
  browser = await chromium.launch({ headless: true, args: ['--disable-gpu'], ...(executablePath ? { executablePath } : { channel }) });
});
after(async () => { await browser?.close(); });

async function fixture(t, initial = base, options = {}) {
  // One storage/input/download context per test, even when test files run concurrently.
  const context = await browser.newContext({ viewport: { width: 900, height: 1100 }, ...options });
  const errors = [];
  // Register before newPage: setup failures must close their context too.
  // Close resources in one place; context.close() also owns all CDP sessions.
  t.after(async () => {
    try { await context.close(); }
    finally { assert.deepEqual(errors, [], 'no uncaught browser errors'); }
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('crash', () => errors.push('browser page crashed'));
  await page.setContent('<div id="host" style="width:360px;max-width:100%"><span id="sibling">Keep this</span></div><button id="outside">Outside</button>');
  await page.evaluate(async ({ moduleUrl, initial }) => {
    const { mountEyeShapeEditor } = await import(moduleUrl);
    window.current = structuredClone(initial);
    window.patches = [];
    window.commits = [];
    window.bubbledEscapes = 0;
    document.addEventListener('keydown', event => { if (event.key === 'Escape') window.bubbledEscapes++; });
    window.addEventListener('pointerdown', event => { window.lastPointer = event.pointerId; }, true);
    window.editor = mountEyeShapeEditor(document.querySelector('#host'), {
      getAppearance: () => window.current,
      onChange: patch => {
        window.patches.push(structuredClone(patch));
        window.current = { ...window.current, ...patch };
        window.editor?.refresh(); // Exercise synchronous parent refresh on every preview.
        if (window.destroyOnPreview) { window.destroyOnPreview = false; window.editor.destroy(); }
      },
      onCommit: before => window.commits.push(before),
    });
  }, { moduleUrl, initial });
  return page;
}
const state = page => page.evaluate(() => ({ current, patches, commits }));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .00002, `${actual} ≈ ${expected}`);
async function screenPoint(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const p = new DOMPoint(180 + 100 * x, 210 - 100 * y).matrixTransform(document.querySelector('svg').getScreenCTM());
    return { x: p.x, y: p.y };
  }, { x, y });
}
async function startDrag(page, id, offset = { x: 0, y: 0 }) {
  const [xKey, yKey] = pointFields[id];
  const a = (await state(page)).current;
  const origin = { x: xKey ? a[xKey] ?? defaults[xKey] : id === 'inner' ? -1 : 1, y: a[yKey] ?? defaults[yKey] };
  const p = await screenPoint(page, origin.x + offset.x, origin.y + offset.y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  return origin;
}
async function moveTo(page, x, y, steps = 1) {
  const p = await screenPoint(page, x, y);
  await page.mouse.move(p.x, p.y, { steps });
}

// Exact paths test the agreed inner-to-outer cubic contract, including the lower lid.
test('renders white eye, two cubics, six labeled controls, and preserves host siblings', async t => {
  const page = await fixture(t);
  assert.equal(await page.locator('.av-eye-shape-editor').count(), 1);
  assert.equal(await page.locator('[data-eye-point]').count(), 6);
  assert.equal(await page.locator('[data-eye-select]').count(), 6);
  assert.equal(await page.locator('[data-eye-curve="upper"]').getAttribute('d'), 'M 80,210 C 115,85 225,90 280,205');
  assert.equal(await page.locator('[data-eye-curve="lower"]').getAttribute('d'), 'M 80,210 C 115,258 230,270 280,205');
  assert.equal(await page.locator('[data-eye-sclera]').getAttribute('d'), 'M 80,210 C 115,85 225,90 280,205 C 230,270 115,258 80,210 Z');
  assert.equal(await page.locator('[data-eye-sclera]').getAttribute('fill'), '#fff');
  assert.match(await page.locator('[data-eye-point="upperInner"]').getAttribute('aria-label'), /上睑内控制点.*1\.250/);
  assert.equal(await page.locator('#sibling').textContent(), 'Keep this');
  assert.equal(await page.locator('[data-eye-enable-panel]').isVisible(), false);
  assert.deepEqual((await state(page)).patches, []);
  assert.deepEqual((await state(page)).commits, []);
});

test('one-click activation patches only style and commits its full prior appearance once', async t => {
  const initial = { ...base, eyeStyle: 'round' };
  const page = await fixture(t, initial);
  assert.equal(await page.locator('[data-eye-panel]').isVisible(), false);
  await page.locator('[data-eye-enable]').click();
  let s = await state(page);
  assert.deepEqual(s.patches, [{ eyeStyle: 'anime_designed' }]);
  assert.deepEqual(s.commits, [initial]);
  assert.equal(await page.locator('[data-eye-panel]').isVisible(), true);
  await page.locator('[data-eye-enable]').dispatchEvent('click');
  s = await state(page);
  assert.equal(s.commits.length, 1, 'an already-enabled style is a no-op');
});

for (const [id, [xKey, yKey]] of Object.entries(pointFields)) {
  test(`${id}: pointer drag changes only its axes, previews repeatedly, and commits once`, async t => {
    const page = await fixture(t);
    const origin = await startDrag(page, id);
    assert.equal(await page.evaluate(() => document.querySelector('svg').hasPointerCapture(lastPointer)), true);
    await moveTo(page, origin.x + .12, origin.y + .12, 4);
    let s = await state(page);
    near(s.current[yKey], base[yKey] + .12);
    if (xKey) near(s.current[xKey], base[xKey] + .12);
    assert.equal(s.commits.length, 0);
    assert.ok(s.patches.length >= 2);
    for (const patch of s.patches) assert.ok(Object.keys(patch).every(key => [xKey, yKey].includes(key)));
    await page.mouse.up();
    s = await state(page);
    assert.deepEqual(s.commits, [base]);
    assert.equal(await page.evaluate(() => document.querySelector('svg').hasPointerCapture(lastPointer)), false);
    assert.equal(s.current.hairColor, base.hairColor);
  });
}

test('hit-area grab has no jump and refresh preserves focus, pointer capture, and DOM identity', async t => {
  const page = await fixture(t);
  const offset = { x: .14, y: -.06 };
  const origin = await startDrag(page, 'upperInner', offset);
  assert.deepEqual((await state(page)).patches, []);
  await page.evaluate(() => {
    window.handleBefore = document.querySelector('[data-eye-point="upperInner"]');
    window.current = { ...current, eyeLowerOuterY: -.9, hairColor: '#aabbcc' };
    for (let i = 0; i < 5; i++) editor.refresh();
  });
  assert.equal(await page.evaluate(() => handleBefore === document.querySelector('[data-eye-point="upperInner"]') && document.activeElement === handleBefore), true);
  assert.equal(await page.evaluate(() => document.querySelector('svg').hasPointerCapture(lastPointer)), true);
  await moveTo(page, origin.x + offset.x + .2, origin.y + offset.y + .1);
  await page.mouse.up();
  const s = await state(page);
  near(s.current.eyeUpperInnerX, origin.x + .2);
  near(s.current.eyeUpperInnerY, origin.y + .1);
  assert.equal(s.current.eyeLowerOuterY, -.9);
  assert.equal(s.current.hairColor, '#aabbcc');
  assert.equal(s.commits.length, 1);
});

test('blank clicks, point clicks with high-precision values, and out-and-back drags add no history', async t => {
  const initial = { ...base, eyeUpperInnerX: -.654321987, eyeUpperInnerY: 1.234567891 };
  const page = await fixture(t, initial);
  await moveTo(page, 0, -1.2);
  await page.mouse.down(); await page.mouse.up();
  let origin = await startDrag(page, 'upperInner');
  await page.mouse.up();
  assert.deepEqual((await state(page)).patches, []);
  origin = await startDrag(page, 'upperInner');
  await moveTo(page, origin.x + .1, origin.y + .1);
  await moveTo(page, origin.x, origin.y);
  await page.mouse.up();
  const s = await state(page);
  assert.deepEqual(s.current, initial);
  assert.deepEqual(s.commits, []);
});

for (const id of ['upperInner', 'upperOuter', 'lowerInner', 'lowerOuter']) {
  test(`${id}: drag obeys range and cannot cross the other control's X`, async t => {
    const page = await fixture(t);
    const [xKey, yKey] = pointFields[id], inner = id.endsWith('Inner'), upper = id.startsWith('upper');
    const peerKey = `eye${upper ? 'Upper' : 'Lower'}${inner ? 'Outer' : 'Inner'}X`;
    await startDrag(page, id);
    await moveTo(page, inner ? 2.4 : -2.4, upper ? 2 : -2.2);
    await page.mouse.up();
    const s = await state(page);
    assert.equal(s.current[xKey], base[peerKey]);
    assert.equal(s.current[yKey], upper ? 1.8 : -1.4);
    assert.equal(s.current[peerKey], base[peerKey], 'do not move the peer');
    assert.equal(s.commits.length, 1);
    for (const patch of s.patches) assert.ok(Object.keys(patch).every(key => [xKey, yKey].includes(key)));
  });
}

test('corner X stays fixed and corner Y clamps to both limits', async t => {
  const page = await fixture(t);
  await startDrag(page, 'inner'); await moveTo(page, -1.5, 1); await page.mouse.up();
  assert.equal((await state(page)).current.eyeInnerY, .4);
  await startDrag(page, 'outer'); await moveTo(page, 1.5, -1); await page.mouse.up();
  const s = await state(page);
  assert.equal(s.current.eyeOuterY, -.3);
  assert.ok(s.patches.every(patch => Object.keys(patch).every(key => ['eyeInnerY', 'eyeOuterY'].includes(key))));
});

for (const cancellation of ['escape', 'pointercancel', 'lostcapture', 'windowblur', 'controlblur', 'destroy']) {
  test(`${cancellation}: restores only gesture-written fields and never commits`, async t => {
    const page = await fixture(t);
    const origin = await startDrag(page, 'upperInner');
    await moveTo(page, origin.x + .18, origin.y + .16);
    await page.evaluate(() => {
      current = { ...current, hairColor: '#updated', eyeLowerOuterY: -.93 };
      editor.refresh();
    });
    if (cancellation === 'escape') await page.keyboard.press('Escape');
    else await page.evaluate(cancellation => {
      const svg = document.querySelector('svg');
      if (cancellation === 'pointercancel') svg.dispatchEvent(new PointerEvent('pointercancel', { pointerId: lastPointer, bubbles: true }));
      if (cancellation === 'lostcapture') svg.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: lastPointer, bubbles: true }));
      if (cancellation === 'windowblur') window.dispatchEvent(new Event('blur'));
      if (cancellation === 'controlblur') document.querySelector('#outside').focus();
      if (cancellation === 'destroy') { editor.destroy(); editor.destroy(); editor.refresh(); }
    }, cancellation);
    await page.mouse.up();
    const s = await state(page);
    assert.equal(s.current.eyeUpperInnerX, base.eyeUpperInnerX);
    assert.equal(s.current.eyeUpperInnerY, base.eyeUpperInnerY);
    assert.equal(s.current.eyeLowerOuterY, -.93);
    assert.equal(s.current.hairColor, '#updated');
    assert.deepEqual(s.patches.at(-1), { eyeUpperInnerX: base.eyeUpperInnerX, eyeUpperInnerY: base.eyeUpperInnerY });
    assert.deepEqual(s.commits, []);
    if (cancellation === 'escape') assert.equal(await page.evaluate(() => bubbledEscapes), 0, 'Escape does not close the parent dialog');
    if (cancellation === 'destroy') {
      assert.equal(await page.locator('.av-eye-shape-editor').count(), 0);
      assert.equal(await page.locator('#sibling').count(), 1);
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => bubbledEscapes), 1, 'global listeners were removed');
    }
  });
}

test('non-owner pointers cannot move, finish, or cancel the active drag', async t => {
  const page = await fixture(t);
  const origin = await startDrag(page, 'upperInner');
  await page.evaluate(() => {
    const svg = document.querySelector('svg');
    for (const type of ['pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      svg.dispatchEvent(new PointerEvent(type, { pointerId: 999, clientX: 1, clientY: 1, bubbles: true }));
    }
    document.querySelector('[data-eye-point="lowerOuter"]').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 999, button: 0, isPrimary: false, bubbles: true }));
  });
  assert.deepEqual((await state(page)).patches, []);
  await moveTo(page, origin.x + .1, origin.y + .1); await page.mouse.up();
  assert.equal((await state(page)).commits.length, 1);
});

test('keyboard repeat groups undo; Shift is finer; selected controls have readable feedback', async t => {
  const page = await fixture(t);
  await page.locator('[data-eye-point="upperInner"]').focus();
  await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowUp');
  let s = await state(page);
  near(s.current.eyeUpperInnerY, 1.31);
  assert.deepEqual(s.commits, []);
  assert.ok(s.patches.every(patch => Object.keys(patch).join() === 'eyeUpperInnerY'));
  await page.keyboard.up('ArrowUp');
  assert.equal((await state(page)).commits.length, 1);
  await page.keyboard.press('Shift+ArrowRight');
  s = await state(page);
  near(s.current.eyeUpperInnerX, -.648);
  assert.equal(s.commits.length, 2);
  assert.match(await page.locator('.eye-readout').textContent(), /上睑内控制点.*-0\.648.*1\.310/);
  await page.locator('[data-eye-select="inner"]').click();
  const count = s.commits.length;
  await page.keyboard.press('ArrowLeft');
  assert.equal((await state(page)).commits.length, count, 'corner horizontal arrows are a no-op');
  await page.keyboard.press('ArrowDown');
  near((await state(page)).current.eyeInnerY, -.02);
});

test('keyboard chord waits for all arrow keyups and clamp-boundary edits do not commit', async t => {
  const page = await fixture(t, { ...base, eyeUpperInnerY: 1.8 });
  await page.locator('[data-eye-select="upperInner"]').focus();
  await page.keyboard.press('ArrowUp');
  assert.deepEqual((await state(page)).commits, []);
  await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowDown');
  await page.keyboard.up('ArrowRight');
  assert.deepEqual((await state(page)).commits, []);
  await page.keyboard.up('ArrowDown');
  assert.equal((await state(page)).commits.length, 1);
});

test('Escape cancels keyboard previews and suppresses held-key repeats until release', async t => {
  const page = await fixture(t);
  await page.locator('[data-eye-select="lowerInner"]').focus();
  await page.keyboard.down('ArrowUp');
  await page.keyboard.press('Escape');
  await page.keyboard.down('ArrowUp');
  await page.keyboard.up('ArrowUp');
  let s = await state(page);
  assert.equal(s.current.eyeLowerInnerY, base.eyeLowerInnerY);
  assert.deepEqual(s.commits, []);
  await page.keyboard.press('ArrowUp');
  s = await state(page);
  near(s.current.eyeLowerInnerY, base.eyeLowerInnerY + .02);
  assert.equal(s.commits.length, 1);
});

test('keyboard focus loss cancels rather than committing, including with no keyup', async t => {
  const page = await fixture(t);
  await page.locator('[data-eye-select="lowerOuter"]').focus();
  await page.keyboard.down('ArrowDown');
  await page.locator('#outside').focus();
  await page.keyboard.up('ArrowDown');
  assert.equal((await state(page)).current.eyeLowerOuterY, base.eyeLowerOuterY);
  assert.deepEqual((await state(page)).commits, []);
});

test('reset touches only changed shape fields and is one undo step; repeated reset is a no-op', async t => {
  const initial = { ...base, eyeUpperInnerY: 1.65, eyeLowerOuterX: .85 };
  const page = await fixture(t, initial);
  await page.locator('[data-eye-reset]').click();
  let s = await state(page);
  assert.deepEqual(s.patches, [{ eyeUpperInnerY: 1.25, eyeLowerOuterX: .5 }]);
  assert.deepEqual(s.commits, [initial]);
  assert.deepEqual(s.current, base);
  await page.locator('[data-eye-reset]').click();
  s = await state(page);
  assert.equal(s.commits.length, 1);
  assert.equal(s.patches.length, 1);
});

test('commit snapshot is detached even when the parent mutates nested appearance data', async t => {
  const page = await fixture(t);
  const origin = await startDrag(page, 'upperInner');
  await page.evaluate(() => { current.faceArt[0].color = '#000'; });
  await moveTo(page, origin.x, origin.y + .1); await page.mouse.up();
  const s = await state(page);
  assert.equal(s.commits[0].faceArt[0].color, '#fff');
  assert.equal(s.current.faceArt[0].color, '#000');
});

test('sparse appearance gets visual defaults; cancel restores originally absent fields without materializing all defaults', async t => {
  const initial = { eyeStyle: 'anime_designed', hairColor: '#keep' };
  const page = await fixture(t, initial);
  const origin = await startDrag(page, 'upperInner');
  await moveTo(page, origin.x, origin.y + .1);
  await page.keyboard.press('Escape'); await page.mouse.up();
  const s = await state(page);
  assert.deepEqual(s.patches.at(-1), { eyeUpperInnerY: undefined });
  assert.equal(s.current.hairColor, '#keep');
  assert.equal(s.current.eyeUpperOuterX, undefined);
  assert.deepEqual(s.commits, []);
});

test('mobile responsive/transformed/letterboxed SVG maps drag coordinates correctly', async t => {
  const page = await fixture(t, base, { viewport: { width: 375, height: 1000 }, isMobile: true, hasTouch: true });
  await page.evaluate(() => {
    const host = document.querySelector('#host'); host.style.width = '320px'; host.style.transformOrigin = '0 0'; host.style.transform = 'scale(.9)';
    document.querySelector('svg').style.height = '410px';
  });
  assert.equal(await page.locator('svg').evaluate(el => getComputedStyle(el).touchAction), 'none');
  const origin = await startDrag(page, 'lowerOuter');
  await moveTo(page, origin.x + .12, origin.y - .1); await page.mouse.up();
  const s = await state(page);
  near(s.current.eyeLowerOuterX, .62); near(s.current.eyeLowerOuterY, -.7);
  assert.equal(s.commits.length, 1);
});

test('parent destroying during pointer preview rolls back safely without a late commit', async t => {
  const page = await fixture(t);
  const origin = await startDrag(page, 'upperInner');
  await page.evaluate(() => { window.destroyOnPreview = true; });
  await moveTo(page, origin.x, origin.y + .1); await page.mouse.up();
  const s = await state(page);
  assert.deepEqual(s.current, base);
  assert.deepEqual(s.commits, []);
  assert.equal(await page.locator('.av-eye-shape-editor').count(), 0);
});

test('activation still commits if parent synchronously remounts/destroys on style change', async t => {
  const initial = { ...base, eyeStyle: 'round' };
  const page = await fixture(t, initial);
  await page.evaluate(() => { window.destroyOnPreview = true; });
  await page.locator('[data-eye-enable]').click();
  const s = await state(page);
  assert.deepEqual(s.patches, [{ eyeStyle: 'anime_designed' }]);
  assert.deepEqual(s.commits, [initial]);
});

test('real touch drag captures the pointer, prevents page panning, commits once, and touchcancel restores', async t => {
  const page = await fixture(t, base, { viewport: { width: 375, height: 900 }, isMobile: true, hasTouch: true });
  await page.evaluate(() => {
    const meta = document.createElement('meta'); meta.name = 'viewport'; meta.content = 'width=device-width,initial-scale=1'; document.head.append(meta);
    document.querySelector('#host').style.width = '340px';
    document.body.style.minHeight = '1600px';
  });
  const session = await page.context().newCDPSession(page);
  // Closing the fixture page also closes its CDP session.
  const start = await screenPoint(page, -.65, 1.25);
  const end = await screenPoint(page, -.45, 1.35);
  const send = (type, p) => session.send('Input.dispatchTouchEvent', {
    type, touchPoints: p ? [{ x: p.x, y: p.y, id: 0, radiusX: 2, radiusY: 2, force: 1 }] : [],
  });
  await send('touchStart', start);
  assert.equal(await page.evaluate(() => document.querySelector('svg').hasPointerCapture(lastPointer)), true);
  await send('touchMove', end);
  assert.equal((await state(page)).commits.length, 0);
  await send('touchEnd');
  let s = await state(page);
  near(s.current.eyeUpperInnerX, -.45); near(s.current.eyeUpperInnerY, 1.35);
  assert.equal(s.commits.length, 1);
  assert.equal(await page.evaluate(() => scrollY), 0, 'drag does not pan the page');
  const beforeCancel = s.current;
  await send('touchStart', end);
  await send('touchMove', start);
  await send('touchCancel');
  s = await state(page);
  assert.deepEqual(s.current, beforeCancel);
  assert.equal(s.commits.length, 1);
});

test('idle refresh picks up external state/style without emitting callbacks or replacing controls', async t => {
  const page = await fixture(t);
  await page.evaluate(() => {
    window.savedHandle = document.querySelector('[data-eye-point="lowerInner"]');
    current = { ...current, eyeLowerInnerY: -.8 };
    editor.refresh();
  });
  assert.match(await page.locator('[data-eye-curve="lower"]').getAttribute('d'), /C 115,290/);
  await page.evaluate(() => { current.eyeStyle = 'round'; editor.refresh(); });
  assert.equal(await page.locator('[data-eye-panel]').isVisible(), false);
  await page.evaluate(() => { current.eyeStyle = 'anime_designed'; editor.refresh(); });
  assert.equal(await page.locator('[data-eye-panel]').isVisible(), true);
  assert.equal(await page.evaluate(() => savedHandle === document.querySelector('[data-eye-point="lowerInner"]')), true);
  assert.deepEqual((await state(page)).patches, []);
  assert.deepEqual((await state(page)).commits, []);
});

// Compare the SVG's actual cubic geometry with the real production contour;
// not just a duplicated expected path string. Width/height remain normalized.
async function matchesProduction(page, appearance) {
  const contour = animeEyeContour(normalizeAppearance(appearance));
  const paths = {};
  const cubic = (p, t) => p[0] * (1-t)**3 + 3*p[1]*t*(1-t)**2 + 3*p[2]*t*t*(1-t) + p[3]*t**3;
  for (const upper of [true, false]) {
    const side = upper ? 'upper' : 'lower';
    const path = await page.locator(`[data-eye-curve="${side}"]`).getAttribute('d');
    paths[side] = path;
    const numbers = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.equal(numbers.length, 8, 'one actual cubic with two endpoints and two controls');
    const xs = [0,2,4,6].map(i => (numbers[i] - 180) / 100);
    const ys = [1,3,5,7].map(i => (210 - numbers[i]) / 100);
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, x = cubic(xs, t), y = cubic(ys, t);
      const expected = (upper ? contour.top : contour.bottom)(x * contour.w) / contour.h;
      assert.ok(Math.abs(y - expected) < .000002, `${side} at t=${t}: SVG ${y}, production ${expected}`);
    }
  }
  const lower = paths.lower.match(/-?\d+(?:\.\d+)?/g).map(Number);
  assert.equal(await page.locator('[data-eye-sclera]').getAttribute('d'),
    `${paths.upper} C ${lower[4]},${lower[5]} ${lower[2]},${lower[3]} ${lower[0]},${lower[1]} Z`,
    'white fill follows the compressed upper curve and reversed raw lower curve');
}

for (const eyeLid of [0, .25, .5, 1]) {
  test(`eyeLid=${eyeLid}: solid lids match production, guides/handles keep raw parameters`, async t => {
    const initial = { ...base, eyeLid, eyeInnerY: -.3, eyeOuterY: .4 };
    const page = await fixture(t, initial);
    await matchesProduction(page, initial);
    assert.equal(await page.locator('[data-eye-guide="upper"]').getAttribute('points'), '80,240 115,85 225,90 280,170');
    assert.equal(await page.locator('[data-eye-guide="lower"]').getAttribute('points'), '80,240 115,258 230,270 280,170');
    for (const [id, xy] of Object.entries({ inner: '80,240', outer: '280,170', upperInner: '115,85', upperOuter: '225,90', lowerInner: '115,258', lowerOuter: '230,270' })) {
      assert.equal(await page.locator(`[data-eye-point="${id}"]`).getAttribute('transform'), `translate(${xy})`);
    }
    const explanation = await page.locator('[data-eye-lid-note]').innerText();
    assert.ok(explanation.includes((1 - eyeLid * .28).toFixed(3)));
    assert.match(explanation, /原始参数.*眼角和下睑保持不变/);
    assert.deepEqual(await state(page), { current: initial, patches: [], commits: [] });
  });
}

test('missing/invalid eyeLid uses schema fallback; idle refresh clamps display without writing fields', async t => {
  const page = await fixture(t);
  for (const eyeLid of [undefined, null, NaN, Infinity, '0.7', -2, 3]) {
    await page.evaluate(eyeLid => { current.eyeLid = eyeLid; editor.refresh(); }, eyeLid);
    await matchesProduction(page, { ...base, eyeLid });
  }
  assert.deepEqual((await state(page)).patches, []);
  assert.deepEqual((await state(page)).commits, []);
});

test('eyeLid refresh during drag preserves raw capture; cancel never rolls back external eyeLid', async t => {
  const initial = { ...base, eyeLid: .25 };
  const page = await fixture(t, initial);
  await startDrag(page, 'upperInner'); await moveTo(page, -.4, 1.4);
  const guide = await page.locator('[data-eye-guide="upper"]').getAttribute('points');
  await page.evaluate(() => {
    window.savedEyeHandle = document.querySelector('[data-eye-point="upperInner"]');
    current.eyeLid = .8;
    editor.refresh();
  });
  assert.equal(await page.evaluate(() => document.querySelector('svg').hasPointerCapture(lastPointer)), true);
  assert.equal(await page.evaluate(() => savedEyeHandle === document.activeElement), true);
  assert.equal(await page.locator('[data-eye-guide="upper"]').getAttribute('points'), guide);
  await matchesProduction(page, (await state(page)).current);
  await page.keyboard.press('Escape'); await page.mouse.up();
  let s = await state(page);
  assert.deepEqual(s.current, { ...initial, eyeLid: .8 });
  assert.deepEqual(s.patches.at(-1), { eyeUpperInnerX: -.65, eyeUpperInnerY: 1.25 });
  assert.deepEqual(s.commits, []);
  await matchesProduction(page, s.current);
  await startDrag(page, 'upperInner'); await moveTo(page, -.5, 1.5); await page.mouse.up();
  s = await state(page);
  assert.deepEqual(s.commits, [{ ...initial, eyeLid: .8 }]);
  assert.deepEqual(s.current, { ...initial, eyeLid: .8, eyeUpperInnerX: -.5, eyeUpperInnerY: 1.5 });
  await page.locator('[data-eye-reset]').click();
  s = await state(page);
  assert.deepEqual(s.current, { ...initial, eyeLid: .8 }, 'reset changes shape only, not eyelid pressure');
  assert.ok(s.patches.every(patch => !Object.hasOwn(patch, 'eyeLid')));
  await matchesProduction(page, s.current);
});

// Extreme shapes MUST use actual shared polyline geometry, not a raw C preview.
const extremeShape = { ...base, eyeLid:1, eyeInnerY:.4, eyeOuterY:.4,
  eyeUpperInnerX:-.95, eyeUpperOuterX:-.6, eyeUpperInnerY:.2, eyeUpperOuterY:.3,
  eyeLowerInnerX:.65, eyeLowerOuterX:.95, eyeLowerInnerY:-.08, eyeLowerOuterY:-.05 };
function svgPoints(path) {
  const numbers=path.match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi).map(Number);
  assert.equal(numbers.length%2,0);
  return Array.from({length:numbers.length/2},(_,i)=>[(numbers[i*2]-180)/100,(210-numbers[i*2+1])/100]);
}
async function matchesSampledProduction(page, appearance) {
  const contour=animeEyeContour(normalizeAppearance(appearance));
  assert.equal(await page.locator('svg').getAttribute('data-eye-boundary'),'sampled');
  const paths={};
  for(const side of ['upper','lower']) {
    const path=await page.locator(`[data-eye-curve="${side}"]`).getAttribute('d');paths[side]=path;
    assert.doesNotMatch(path,/C/i,'visible curve must not secretly retain raw cubic');
    const actual=svgPoints(path), expected=side==='upper'?contour.upper:contour.lower.slice().reverse();
    assert.equal(actual.length,259);assert.equal(actual.length,expected.length);
    for(let i=0;i<actual.length;i++) {
      assert.ok(Math.abs(actual[i][0]-expected[i][0]/contour.w)<2e-14);
      assert.ok(Math.abs(actual[i][1]-expected[i][1]/contour.h)<2e-14,'SVG node = real sclera node');
      // Test the interior of every SVG segment, not just its endpoints.
      if(i) {
        const x=(actual[i-1][0]+actual[i][0])/2, y=(actual[i-1][1]+actual[i][1])/2;
        assert.ok(Math.abs(y-(side==='upper'?contour.top:contour.bottom)(x*contour.w)/contour.h)<2e-14);
      }
    }
  }
  const fill=svgPoints(await page.locator('[data-eye-sclera]').getAttribute('d'));
  assert.deepEqual(fill,[...svgPoints(paths.upper),...svgPoints(paths.lower).reverse()], 'white fill follows BOTH visible shared boundaries');
  assert.match(await page.locator('[data-eye-lid-note]').innerText(),/极限组合.*模型、虹膜裁剪.*存档控制点不变/);
}

test('extreme SVG and white fill match all 518 production nodes; six handles and JSON remain raw',async t=>{
  const page=await fixture(t,extremeShape);
  for(const canthus of [.4,-.3]) {
    await page.evaluate(canthus=>{current.eyeInnerY=canthus;current.eyeOuterY=canthus;editor.refresh();},canthus);
    const a=(await state(page)).current;
    await matchesSampledProduction(page,a);
    assert.equal(await page.locator('[data-eye-point]').count(),6);
    for(const [id,[xKey,yKey]] of Object.entries(pointFields)) {
      const x=xKey?a[xKey]:id==='inner'?-1:1,y=a[yKey];
      const position=`translate(${Math.round((180+x*100)*1e5)/1e5},${Math.round((210-y*100)*1e5)/1e5})`;
      assert.equal(await page.locator(`[data-eye-point="${id}"]`).getAttribute('transform'),position);
      const label=await page.locator(`[data-eye-point="${id}"]`).getAttribute('aria-label');
      assert.ok(label.includes(`x ${x.toFixed(3)}，y ${y.toFixed(3)}`));
    }
    const saved=await page.evaluate(()=>JSON.parse(JSON.stringify(current)));
    assert.deepEqual(saved,a,'derived constraints never leak into save fields');
  }
  assert.deepEqual((await state(page)).patches,[]);
  assert.deepEqual((await state(page)).commits,[]);
});

test('extreme raw drag and Shift keyboard edit still preview/commit once without storing the constrained boundary',async t=>{
  const page=await fixture(t,extremeShape);
  await startDrag(page,'upperOuter');await moveTo(page,-.4,.8);
  assert.equal((await state(page)).commits.length,0);
  await matchesSampledProduction(page,(await state(page)).current);
  await page.mouse.up();
  let s=await state(page);
  assert.deepEqual(s.commits,[extremeShape]);
  assert.deepEqual(s.current,{...extremeShape,eyeUpperOuterX:-.4,eyeUpperOuterY:.8});
  const before=s.current;
  await page.locator('[data-eye-select="lowerOuter"]').focus();
  await page.keyboard.press('Shift+ArrowLeft');
  s=await state(page);
  assert.equal(s.commits.length,2);assert.deepEqual(s.commits[1],before);
  near(s.current.eyeLowerOuterX,.948);
  assert.ok(s.patches.every(p=>Object.keys(p).every(k=>Object.hasOwn(defaults,k))));
  await matchesSampledProduction(page,s.current);
  await page.locator('[data-eye-reset]').click();
  s=await state(page);
  assert.equal(s.commits.length,3);
  assert.deepEqual(s.current,{...base,eyeLid:1});
  await matchesProduction(page,s.current);
});

test('cubic to constrained boundary transition during drag preserves capture; cancel restores only raw gesture fields',async t=>{
  const page=await fixture(t,base);
  assert.equal(await page.locator('svg').getAttribute('data-eye-boundary'),'cubic');
  await startDrag(page,'upperInner');await moveTo(page,-.65,.2);
  await matchesSampledProduction(page,(await state(page)).current);
  await page.evaluate(()=>{
    window.transitionHandle=document.activeElement;
    current.eyeLid=.8;current.hairColor='#aabbcc';
    for(let i=0;i<4;i++)editor.refresh();
  });
  assert.equal(await page.evaluate(()=>document.activeElement===transitionHandle&&document.querySelector('svg').hasPointerCapture(lastPointer)),true);
  await matchesSampledProduction(page,(await state(page)).current);
  await page.keyboard.press('Escape');await page.mouse.up();
  const s=await state(page);
  assert.deepEqual(s.current,{...base,eyeLid:.8,hairColor:'#aabbcc'});
  assert.deepEqual(s.patches.at(-1),{eyeUpperInnerY:base.eyeUpperInnerY});
  assert.deepEqual(s.commits,[]);
  assert.equal(await page.locator('svg').getAttribute('data-eye-boundary'),'cubic');
  await matchesProduction(page,s.current);
});
