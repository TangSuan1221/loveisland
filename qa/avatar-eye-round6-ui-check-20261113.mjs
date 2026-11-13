import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Bounded REAL public-entry review, deliberately without ?qa, mocks, persistent
// profiles, localStorage injection, or importing an alternate rendering scene.
// Run: node --test qa/avatar-eye-round6-ui-check-20261113.mjs
// Every execution creates uniquely named evidence; historical files are never reused.
const project = new URL('../', import.meta.url);
const url = 'http://127.0.0.1:5188/';
const storageKey = 'ratings-tyrant-production-v1';
const sha = value => createHash('sha256').update(value).digest('hex');
const sources = [
  'src/avatar-anime.js', 'src/avatar-anime-hair.js', 'src/avatar-model.js',
  'src/avatar-schema.js', 'src/avatar-eye-curve.js',
  'src/avatar-eye-shape-editor.js', 'src/avatar-editor.js',
];
// Vite rewrites static imports and appends a source map. Compare ALL remaining
// source verbatim for provenance, not a frozen-version assertion. Production may
// change in parallel; each screenshot records the modules actually loaded then.
const moduleBody = text => text.replace(/\r\n/g, '\n').split('\n')
  .filter(line => !/^import\s/.test(line) && !/^\/\/[#@]\s*sourceMappingURL=/.test(line)).join('\n').trim();
const targets = {
  inner: [null, 'eyeInnerY', -1, .12], outer: [null, 'eyeOuterY', 1, .17],
  upperInner: ['eyeUpperInnerX', 'eyeUpperInnerY', -.53, 1.43],
  upperOuter: ['eyeUpperOuterX', 'eyeUpperOuterY', .59, 1.37],
  lowerInner: ['eyeLowerInnerX', 'eyeLowerInnerY', -.52, -.72],
  lowerOuter: ['eyeLowerOuterX', 'eyeLowerOuterY', .63, -.81],
};

test('round6 public studio: current gold-red study, six real handles, durable save, existing characters unchanged', { timeout: 180000 }, async t => {
  const run = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8);
  const prefix = `qa/avatar-eye-round6-ui-${run}`;
  const output = suffix => fileURLToPath(new URL(`${prefix}-${suffix}`, project));
  const reportPath = output('report.json');
  const report = {
    result: 'RUNNING', startedAt: new Date().toISOString(), url,
    scope: 'Actual UI entry and persistence only; NOT a visual-similarity or Hume review. Production is no longer frozen; round6-ui is the task namespace, NOT an image version.',
    isolation: 'New non-persistent browser context; no real user profile, cookies, or storage loaded.',
    checks: [], artifacts: { report: reportPath }, pageErrors: [], navigations: [], devServerChanges: [],
    loadedSourceEvidence: [], controlEdits: [],
  };
  const initialSources = new Map(sources.map(path => [path, readFileSync(new URL(path, project), 'utf8')]));
  report.sourceHashes = Object.fromEntries([...initialSources].map(([path, text]) => [path, sha(text)]));
  const { ART_PRESETS, DEFAULT_APPEARANCE, normalizeAppearance } = await import('../src/avatar-schema.js');
  const gold = ART_PRESETS.find(p => p.name === '金环赤发');
  assert.ok(gold, 'current production study exists');
  const expectedPreset = normalizeAppearance({ ...normalizeAppearance(DEFAULT_APPEARANCE), ...gold.values });
  assert.equal(expectedPreset.eyeStyle, 'anime_designed');
  assert.equal(expectedPreset.hairFront, 'anime_arcfringe');
  assert.equal(expectedPreset.hairBack, 'anime_frame');
  assert.equal(expectedPreset.faceShape, 'anime_pentagon');
  let browser, context, page;
  let documentGeneration = 0;
  const responseReads = [];
  const record = (name, details) => { report.checks.push({ name, result: 'PASS', details }); console.log('PASS', name); };
  const av = selector => page.locator(`.avatar-studio ${selector}`);
  const action = name => av(`[data-action="${name}"]`).first();
  const click = name => action(name).click();
  const selected = () => av('[data-person][aria-pressed="true"]').getAttribute('data-person');
  const clean = async () => assert.equal(await av('.av-save-state').innerText(), '已保存到角色库');
  const settle = async () => {
    await page.evaluate(() => new Promise(resolve => { let n = 0; const next = () => ++n >= 4 ? resolve() : requestAnimationFrame(next); requestAnimationFrame(next); }));
    assert.doesNotMatch(await av('.av-status').innerText(), /预览失败|保存失败/);
  };
  const open = async id => {
    await page.locator('[data-action="editAppearance"]').first().click();
    await av('.av-preview-loading').waitFor({ state: 'hidden' });
    await av('.av-preview-canvas canvas').waitFor();
    if (id) await av(`[data-person="${id}"]`).click();
    await settle();
  };
  const close = async () => { await clean(); await click('close'); await page.locator('.avatar-studio').waitFor({ state: 'detached' }); };
  const eyes = async () => { await av('[data-category="eyes"]').click(); await av('.av-eye-shape-editor svg').waitFor(); await settle(); };
  const exportDraft = async () => {
    const pending = page.waitForEvent('download'); await click('export');
    const download = await pending;
    assert.equal(await download.failure(), null);
    const stream = await download.createReadStream(); assert.ok(stream);
    const chunks = []; for await (const chunk of stream) chunks.push(chunk);
    const draft = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.equal(draft.format, 'ratings-tyrant-avatar'); assert.equal(draft.version, 1);
    return draft;
  };
  const library = () => page.evaluate(key => {
    const bundle = JSON.parse(localStorage.getItem(key));
    if (!Array.isArray(bundle?.production?.candidates)) throw new Error('Saved character library is missing');
    return bundle.production.candidates.map(p => ({ id: p.id, name: p.name, appearance: p.appearance ?? null }));
  }, storageKey);
  const keepExisting = (saved, baseline) => {
    assert.deepEqual(saved.filter(p => baseline.some(old => old.id === p.id)), baseline,
      'all existing saved names/appearances must remain unchanged');
  };
  const save = async () => {
    await click('save'); assert.match(await av('.av-status').innerText(), /^已保存。/); await clean();
  };
  const screenshot = async suffix => {
    const path = output(suffix); assert.equal(existsSync(path), false, 'never overwrite historical screenshots');
    // Scroll the real settings panel, never restyle the product for evidence.
    // The studio shell alone fitting is insufficient: all six handles must also
    // be unobscured by its scroll viewport and sticky footer in the screenshot.
    await av('.av-eye-shape-editor svg').scrollIntoViewIfNeeded();
    await settle();
    // The SVG is taller than this panel. Center the six control-point span with
    // a native wheel gesture instead of assuming scrollIntoView exposes them.
    const scroll = await av('.av-fields').evaluate(fields => {
      const rect = fields.getBoundingClientRect();
      const ys = [...fields.querySelectorAll('[data-eye-point]')].map(handle => new DOMPoint(0, 0).matrixTransform(handle.getScreenCTM()).y);
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
        delta: (Math.min(...ys) + Math.max(...ys)) / 2 - (rect.y + rect.height / 2) };
    });
    await page.mouse.move(scroll.x, scroll.y); await page.mouse.wheel(0, scroll.delta);
    await settle(); await page.mouse.move(12, 12);
    const visibleHandles = await av('[data-eye-point]').evaluateAll(handles => handles.map(handle => {
      const matrix = handle.getScreenCTM();
      const point = new DOMPoint(0, 0).matrixTransform(matrix);
      const hit = document.elementFromPoint(point.x, point.y);
      return { id: handle.dataset.eyePoint, x: point.x, y: point.y, unobscured: !!hit && handle.contains(hit) };
    }));
    assert.equal(visibleHandles.length, 6);
    assert.ok(visibleHandles.every(point => point.unobscured), `all six handles must be visible in studio evidence: ${JSON.stringify(visibleHandles)}`);
    (report.screenshotVisibility ??= []).push({ suffix, visibleHandles });
    const studio = await page.locator('.avatar-studio').boundingBox();
    const viewport = page.viewportSize();
    assert.ok(studio && studio.x >= 0 && studio.y >= 0 && studio.x + studio.width <= viewport.width + 1 && studio.y + studio.height <= viewport.height + 1, 'complete studio fits desktop evidence');
    await Promise.all(responseReads);
    const generation = documentGeneration;
    const loaded = new Map(report.loadedSourceEvidence.filter(item => item.documentGeneration === generation && item.responseSha256).map(item => [item.path, item]));
    for (const source of sources) assert.ok(loaded.has(source), `${source}: loaded in screenshot document`);
    const loadedModuleHashes = Object.fromEntries([...loaded].sort(([a], [b]) => a.localeCompare(b)).map(([source, item]) => [source, item.responseSha256]));
    const diskSourceHashes = Object.fromEntries([...loaded.keys()].sort().map(source => [source, sha(readFileSync(new URL(source, project)))]));
    const capture = { path, captureStartedAt: new Date().toISOString(), documentGeneration: generation,
      sourceFingerprint: sha(JSON.stringify(loadedModuleHashes)), fingerprintScope: 'SHA256 of sorted path -> actual response SHA256 for all loaded /src JS and CSS modules in this document',
      loadedModuleHashes, diskSourceHashes, devServerEventCountBefore: report.devServerChanges.length,
      qualification: 'Current UI and persistence evidence only; not a frozen round6 image or visual-similarity evidence.' };
    await page.screenshot({ path, fullPage: true });
    capture.capturedAt = new Date().toISOString();
    capture.documentGenerationAfter = documentGeneration;
    capture.devServerEventCountAfter = report.devServerChanges.length;
    capture.screenshotSha256 = sha(readFileSync(path));
    (report.screenshotSourceEvidence ??= []).push(capture);
    assert.equal(capture.documentGenerationAfter, generation, 'screenshot must not straddle a page reload');
    assert.equal(capture.devServerEventCountAfter, capture.devServerEventCountBefore, 'screenshot must not straddle a development update');
    return path;
  };
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.EYE_TEST_BROWSER_EXECUTABLE
      ? { executablePath: process.env.EYE_TEST_BROWSER_EXECUTABLE }
      : { channel: process.env.EYE_TEST_BROWSER_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined) }) });
    context = await browser.newContext({ viewport: { width: 1680, height: 1120 }, deviceScaleFactor: 1, acceptDownloads: true });
    const empty = await context.storageState();
    assert.deepEqual(empty, { cookies: [], origins: [] }, 'no user browser storage reused');
    report.browserVersion = browser.version();
    page = await context.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('crash', () => report.pageErrors.push('browser page crashed'));
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) report.navigations.push({ at: new Date().toISOString(), url: frame.url(), documentGeneration: ++documentGeneration }); });
    page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
      try { const value = JSON.parse(String(payload)); if (['full-reload', 'update', 'error'].includes(value.type)) report.devServerChanges.push({ at: new Date().toISOString(), ...value }); } catch { /* Unrelated non-JSON message. */ }
    }));
    page.on('response', response => {
      const path = new URL(response.url()).pathname.slice(1);
      if (!/^src\/.*\.(js|css)$/.test(path)) return;
      const generation = documentGeneration;
      responseReads.push((async () => {
        try {
          const body = await response.text();
          report.loadedSourceEvidence.push({ path, at: new Date().toISOString(), documentGeneration: generation, url: response.url(), status: response.status(),
            responseSha256: sha(body), implementationSha256: sha(moduleBody(body)),
            matchesStartImplementation: initialSources.has(path) ? moduleBody(body) === moduleBody(initialSources.get(path)) : null });
        } catch (error) { report.loadedSourceEvidence.push({ path, at: new Date().toISOString(), documentGeneration: generation, error: error.message }); }
      })());
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-action="editAppearance"]').first().waitFor();
    assert.equal(page.url(), url);
    assert.equal(await page.evaluate(() => typeof window.__avatarDiagnostics), 'undefined', 'normal public URL, not QA alternate entry');
    await open();
    assert.match(await av('.av-preset-strip').innerText(), /角色研究[\s\S]*金环赤发/);
    const originalId = await selected(), original = await exportDraft();
    report.originalSelectedId = originalId;
    record('普通游戏首页进入真实角色工作室，存在角色研究入口');

    // Synthetic, explicitly saved earlier character. This is NOT the user's old
    // save or an assertion about old-release migration; all writes are via UI.
    await click('new'); const legacyId = await selected();
    const legacySeed = { ...original, name: '旧眼形保留验证', appearance: { ...original.appearance,
      artStyle: 'anime', eyeStyle: 'anime_round', hairFront: 'anime_center', hairBack: 'anime_bob',
      faceShape: 'oval', eyeColor: '#41759b', hairColor: '#513a2c', eyeInnerY: -.06, eyeOuterY: .09 } };
    await av('.av-file-input').setInputFiles({ name: 'round6-ui-isolated-existing.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacySeed)) });
    await page.waitForFunction(() => document.querySelector('.avatar-studio .av-status')?.textContent === '角色文件已载入草稿，保存后生效。');
    const legacy = await exportDraft(); await save();
    const existing = await library();
    report.existingCharacters = existing.map(p => ({ id: p.id, name: p.name, appearanceSha256: sha(JSON.stringify(p.appearance)) }));
    report.legacyFixture = { id: legacyId, origin: 'synthetic older-style character saved through real UI in this isolated run', exported: legacy };
    await close(); await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-action="editAppearance"]').first().waitFor();
    await open(legacyId); assert.deepEqual(await exportDraft(), legacy, 'existing saved old-style custom character survives restart unchanged');
    await av(`[data-person="${originalId}"]`).click(); assert.deepEqual(await exportDraft(), original);
    record('既存默认人物及独立旧式自建人物，在重载后外观未被自动替换', { existingCount: existing.length, legacyId });

    await click('new'); const targetId = await selected();
    assert.notEqual(targetId, legacyId); report.targetId = targetId;
    await av('.av-name').fill('金环赤发 · Round6 UI');
    const beforePresetStorage = await library(); keepExisting(beforePresetStorage, existing);
    const presetButton = av('.av-presets button').filter({ hasText: '金环赤发' });
    assert.equal(await presetButton.count(), 1);
    report.entryButton = { text: await presetButton.innerText(), title: await presetButton.getAttribute('title') };
    assert.equal(report.entryButton.title, gold.note);
    await presetButton.click(); await eyes();
    assert.equal(await av('[data-eye-point]').count(), 6);
    const presetDraft = await exportDraft();
    assert.deepEqual(presetDraft.appearance, expectedPreset, 'real preset action exports the FULL production preset appearance read at run start');
    assert.deepEqual(await library(), beforePresetStorage, 'preset preview must not silently write any stored character');
    report.currentPreset = presetDraft;
    report.actualProductionSelection = Object.fromEntries(['artStyle','eyeStyle','eyeInk','eyeLowerInk','eyeLid','irisPattern','hairFront','hairBack','hairColor','faceShape','jawWidth','chinLength'].map(key => [key, presetDraft.appearance[key]]));
    await settle();
    const canvasBefore = sha(await av('.av-preview-canvas canvas').screenshot());
    report.artifacts.currentPresetStudio = await screenshot('01-current-preset-studio.png');
    record('真实金环赤发按钮加载当前自由眼形、弧顶刘海、贴颈侧帘和折角轮廓；完整导出与本次开始读取的生产预设逐字段一致', report.actualProductionSelection);

    await page.evaluate(() => window.addEventListener('pointerdown', e => { window.round6UiPointerId = e.pointerId; }, true));
    const patch = {}, board = av('.av-eye-shape-editor svg');
    for (const [id, [xKey, yKey, x, y]] of Object.entries(targets)) {
      await board.scrollIntoViewIfNeeded();
      const handle = av(`[data-eye-point="${id}"]`);
      const before = await handle.getAttribute('transform');
      const start = await handle.evaluate(el => { const p = new DOMPoint(0, 0).matrixTransform(el.getScreenCTM()); return { x: p.x, y: p.y }; });
      await page.mouse.move(start.x, start.y); await page.mouse.down();
      assert.equal(await board.evaluate(svg => svg.hasPointerCapture(window.round6UiPointerId)), true, `${id}: real native pointer capture`);
      const end = await board.evaluate((svg, { x, y }) => { const p = new DOMPoint(180 + x * 100, 210 - y * 100).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y }; }, { x, y });
      await page.mouse.move(end.x, end.y, { steps: 5 }); await page.mouse.up();
      const after = await handle.getAttribute('transform'); assert.notEqual(after, before, `${id}: actual handle moved`);
      if (xKey) patch[xKey] = x; patch[yKey] = y;
      report.controlEdits.push({ id, before, after, expectedX: x, expectedY: y });
    }
    assert.equal(Object.keys(patch).length, 10);
    const edited = await exportDraft();
    assert.deepEqual(edited, { ...presetDraft, appearance: { ...presetDraft.appearance, ...patch } }, 'all six handles and ten fields reach actual JSON; unrelated fields unchanged');
    assert.equal(await av('.av-save-state').innerText(), '有未保存修改');
    await settle(); const canvasAfter = sha(await av('.av-preview-canvas canvas').screenshot());
    assert.notEqual(canvasAfter, canvasBefore, 'real model canvas changes after live eye editing (NOT a similarity metric)');
    report.previewCanvasEvidence = { beforeSha256: canvasBefore, editedSha256: canvasAfter, interpretation: 'Different rendered canvas bytes only; not a resemblance assessment.' };
    report.savedEdit = edited; report.tenEditedFields = patch;
    record('六个原生鼠标拖拽均改变控制点，十个参数进入真实导出且其他外观字段保持');

    await save();
    const saved = await library();
    assert.deepEqual(saved.find(p => p.id === targetId), { id: targetId, name: edited.name, appearance: edited.appearance });
    keepExisting(saved, existing); assert.equal(saved.length, existing.length + 1);
    await close(); await open(targetId); await eyes();
    assert.deepEqual(await exportDraft(), edited, 'close/reopen loads exactly the saved six-handle edit'); await clean();
    assert.equal(await action('undo').isEnabled(), false);
    record('保存写入隔离存档；关闭并重开人物工作室，六柄数据完整恢复且没有残留撤销历史');

    await close(); await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-action="editAppearance"]').first().waitFor();
    await open(targetId); await eyes();
    assert.deepEqual(await exportDraft(), edited, 'full game reload persists the same edited current preset'); await clean();
    for (const edit of report.controlEdits) assert.equal(await av(`[data-eye-point="${edit.id}"]`).getAttribute('transform'), edit.after, `${edit.id}: reopened visible handle matches saved edit`);
    keepExisting(await library(), existing);
    await av(`[data-person="${legacyId}"]`).click(); assert.deepEqual(await exportDraft(), legacy, 'older saved custom character is not silently converted to the new preset');
    await av(`[data-person="${originalId}"]`).click(); assert.deepEqual(await exportDraft(), original, 'original builtin character is not silently changed');
    await av(`[data-person="${targetId}"]`).click(); await eyes(); await clean();
    assert.deepEqual(await exportDraft(), edited);
    report.artifacts.savedReopenedStudio = await screenshot('02-saved-reloaded-studio.png');
    record('整页刷新后十参数和六个可见手柄仍一致；所有既存存档人物及两个人物UI导出保持原值');

    await Promise.all(responseReads);
    for (const path of sources) {
      const responses = report.loadedSourceEvidence.filter(item => item.path === path);
      assert.ok(responses.length > 0, `${path}: production module really loaded by game`);
      assert.ok(responses.every(item => item.responseSha256 && item.status === 200), `${path}: every loaded module has recorded source bytes`);
    }
    report.endSourceHashes = Object.fromEntries(sources.map(path => [path, sha(readFileSync(new URL(path, project)))]));
    report.sourcesChangedDuringRun = sources.filter(path => report.endSourceHashes[path] !== report.sourceHashes[path]);
    assert.deepEqual(report.pageErrors, [], 'no uncaught real game errors');
    record('浏览器实际加载生产模块；截图逐张记录采集时间与实际加载源码指纹；没有未捕获页面异常', { devServerChanges: report.devServerChanges.length, sourcesChangedDuringRun: report.sourcesChangedDuringRun });
    report.result = 'PASS';
  } catch (error) {
    report.result = 'FAIL'; report.error = error.stack;
    if (page && !page.isClosed()) {
      try { const path = output('failure-studio.png'); assert.equal(existsSync(path), false); await page.screenshot({ path, fullPage: true, timeout: 5000 }); report.artifacts.failure = path; } catch (captureError) { report.failureCaptureError = captureError.message; }
    }
    throw error;
  } finally {
    await Promise.allSettled(responseReads);
    try { await context?.close(); } finally {
      await browser?.close();
      report.finishedAt = new Date().toISOString();
      writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
      t.diagnostic(JSON.stringify({ result: report.result, checks: report.checks.length, report: reportPath, artifacts: report.artifacts, error: report.error }));
    }
  }
});
