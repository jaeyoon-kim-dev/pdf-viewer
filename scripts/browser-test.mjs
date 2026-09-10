import assert from 'node:assert/strict';
import { webkit, chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';

const root = await mkdtemp(join(tmpdir(), 'paperthread-browser-'));
const artifacts = resolve(process.env.BROWSER_ARTIFACT_DIR || 'test-results');
await mkdir(artifacts, { recursive: true });
const listener = createServer();
await new Promise((r) => listener.listen(0, '127.0.0.1', r));
const port = listener.address().port;
await new Promise((r) => listener.close(r));
const env = {
  ...process.env,
  DATA_DIR: root,
  NODE_ENV: 'production',
  PORT: String(port),
};
execFileSync(process.execPath, ['scripts/migrate.mjs'], { env, stdio: 'pipe' });
const server = spawn(
  process.execPath,
  [
    'node_modules/vinext/dist/cli.js',
    'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(port),
  ],
  { env, stdio: ['ignore', 'pipe', 'pipe'] },
);
let logs = '';
server.stdout.on('data', (c) => (logs += c));
server.stderr.on('data', (c) => (logs += c));
const base = 'http://127.0.0.1:' + port;

async function upload() {
  const form = new FormData();
  form.set(
    'file',
    new File([await readFile('tests/fixtures/sample.pdf')], 'sample.pdf', {
      type: 'application/pdf',
    }),
  );
  form.set('pages', '3');
  form.set('title', 'Isolated selection regression');
  const response = await fetch(base + '/api/papers', {
    method: 'POST',
    body: form,
  });
  assert.equal(response.status, 201);
  return response.json();
}
async function wordPoint(page, word) {
  return page.locator('#page-1 .pdf-text-layer').evaluate((layer, text) => {
    for (const span of layer.querySelectorAll('span')) {
      const node = span.firstChild;
      const source = node?.textContent || '';
      const index = source.indexOf(text);
      if (index < 0 || node.nodeType !== Node.TEXT_NODE) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + text.length);
      const box = range.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }
    throw new Error('Missing fixture word: ' + text);
  }, word);
}
async function waitForAnnotation(paperId) {
  for (let i = 0; i < 100; i++) {
    const library = await (await fetch(base + '/api/library')).json();
    const annotation = library.annotations.find((a) => a.paperId === paperId);
    if (annotation) return annotation;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Annotation was not synchronized');
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + '/api/health')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, logs);
  for (const mode of ['webkit', 'chromium', 'ipad']) {
    const engine = mode === 'chromium' ? chromium : webkit;
    const browser = await engine.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: mode === 'ipad' ? 1024 : 1280, height: 900 },
      ...(mode === 'ipad'
        ? {
            hasTouch: true,
            isMobile: true,
            userAgent:
              'Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1',
          }
        : {}),
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    try {
      await page.addInitScript((tablet) => {
        // Match the absent stream API reported in Safari 26.0.1.
        delete ReadableStream.prototype[Symbol.asyncIterator];
        if (tablet) {
          Object.defineProperty(navigator, 'platform', {
            get: () => 'MacIntel',
          });
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
        }
      }, mode === 'ipad');
      const paper = await upload();
      await page.goto(base + '/papers/' + paper.id);
      await page.locator('#page-1 .pdf-page[data-text-ready="true"]').waitFor();
      await page.waitForTimeout(150);
      const start = await wordPoint(page, 'Drag');
      const path = [];
      for (const word of [
        'sentence',
        'phrase.',
        'Figure',
        'citation',
        'without',
        'Figure',
        'sentence',
      ])
        path.push(await wordPoint(page, word));
      await page.evaluate(() => {
        window.__selectionTrace = [];
        const sample = () => {
          const text = getSelection()?.toString() || '';
          const rects = [
            ...document.querySelectorAll('#page-1 .highlight-layer rect'),
          ].map((n) => [
            n.getAttribute('x'),
            n.getAttribute('y'),
            n.getAttribute('width'),
          ]);
          window.__selectionTrace.push({ text, rects });
          window.__selectionFrame = requestAnimationFrame(sample);
        };
        window.__selectionFrame = requestAnimationFrame(sample);
      });
      if (mode === 'ipad') {
        assert.equal(await page.locator('.native-text-selection').count(), 0);
        const pointer = async (type, p) =>
          page.locator('#page-1 .pdf-page').dispatchEvent(type, {
            pointerId: 4,
            pointerType: 'touch',
            isPrimary: true,
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
            clientX: p.x,
            clientY: p.y,
            pressure: 0.5,
          });
        await pointer('pointerdown', start);
        for (const point of path) {
          await pointer('pointermove', point);
          await page.waitForTimeout(40);
        }
        await pointer('pointerup', path.at(-1));
        assert.equal(
          await page.evaluate(() => getSelection()?.toString() || ''),
          '',
        );
      } else {
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        for (const point of path) {
          await page.mouse.move(point.x, point.y, { steps: 6 });
          await page.waitForTimeout(40);
        }
        await page.mouse.up();
        await page.waitForTimeout(40);
        assert.equal(
          await page.evaluate(() => getSelection()?.toString()),
          'Drag across this sentence',
        );
      }
      await page.locator('.selection-tooltip').waitFor();
      const trace = await page.evaluate(() => {
        cancelAnimationFrame(window.__selectionFrame);
        return window.__selectionTrace;
      });
      await writeFile(
        join(artifacts, mode + '-trace.json'),
        JSON.stringify(trace, null, 2),
      );
      const first = trace.findIndex(
        (frame) => frame.text || frame.rects.length,
      );
      assert.ok(first >= 0, mode + ': no visible selection');
      assert.ok(
        trace.slice(first).every((frame) => frame.text || frame.rects.length),
        mode + ': selection disappeared mid-gesture',
      );
      assert.ok(
        trace.every((frame) => !frame.text.includes('A fixture')),
        mode + ': jumped to unrelated heading',
      );
      await writeFile(
        join(artifacts, mode + '-trace.json'),
        JSON.stringify(trace, null, 2),
      );
      const tooltip = await page.locator('.selection-tooltip').boundingBox();
      assert.ok(
        tooltip.width <= 300 && tooltip.height < 100,
        mode + ': tooltip is not compact',
      );
      assert.equal(
        await page
          .locator('.selection-tooltip')
          .getByRole('button', { name: 'Save', exact: true })
          .count(),
        0,
      );
      await page.screenshot({ path: join(artifacts, mode + '-selection.png') });
      await page.getByRole('tab', { name: 'Underline', exact: true }).click();
      await page
        .getByRole('checkbox', { name: 'Question', exact: true })
        .click();
      await page
        .getByRole('textbox', { name: 'Question', exact: true })
        .fill('Why this sentence?');
      await page.getByRole('button', { name: 'Blue', exact: true }).click();
      await page.locator('.selection-tooltip').waitFor({ state: 'hidden' });
      const annotation = await waitForAnnotation(paper.id);
      assert.equal(annotation.quote, 'Drag across this sentence');
      assert.equal(annotation.color, '#60a5fa');
      assert.equal(annotation.kind, 'underline');
      assert.deepEqual(annotation.types, ['question']);
      assert.equal(annotation.note, 'Why this sentence?');
      await page.locator('#page-1 .question-marker').waitFor();
      if (mode !== 'ipad') {
        const oldWidth = (await page.locator('#page-1 .pdf-page').boundingBox())
          .width;
        await page
          .getByRole('button', { name: 'Zoom in', exact: true })
          .click();
        await page.waitForFunction((previous) => {
          const page = document.querySelector('#page-1 .pdf-page');
          return (
            page?.dataset.textReady === 'true' &&
            page.getBoundingClientRect().width > previous
          );
        }, oldWidth);
        const point = await wordPoint(page, 'useful');
        await page.mouse.click(point.x, point.y);
        await page.locator('.selection-tooltip').waitFor();
        assert.equal(
          await page.evaluate(() => getSelection()?.toString()),
          'useful',
        );
        await page.keyboard.press('Escape');
      }
      assert.deepEqual(errors, []);
      console.log(
        'PASS:',
        mode,
        'cross-line/reverse selection, persistent feedback, compact tooltip, color save and Q marker',
      );
    } catch (error) {
      await page
        .screenshot({ path: join(artifacts, mode + '-failure.png') })
        .catch(() => {});
      throw error;
    } finally {
      await browser.close();
    }
  }
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) =>
    server.exitCode !== null ? resolve() : server.once('exit', resolve),
  );
  await rm(root, { recursive: true, force: true });
}
