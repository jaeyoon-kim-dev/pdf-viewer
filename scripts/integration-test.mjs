import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
const root = await mkdtemp(join(tmpdir(), 'paperthread-test-'));
const listener = createServer();
await new Promise((r) => listener.listen(0, '127.0.0.1', r));
const port = listener.address().port;
await new Promise((r) => listener.close(r));
const env = {
  ...process.env,
  DATA_DIR: root,
  NODE_ENV: 'production',
  VINEXT_TRUSTED_HOSTS: 'papers.example.test',
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
server.stdout.on('data', (c) => {
  logs += c;
});
server.stderr.on('data', (c) => {
  logs += c;
});
const base = `http://127.0.0.1:${port}`;
const request = (path, method = 'GET', value) =>
  fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method !== 'GET' && value !== undefined
      ? { body: JSON.stringify(value) }
      : {}),
  });
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
  assert.equal(ready, true, logs);
  const pdf = await readFile('tests/fixtures/sample.pdf');
  const form = new FormData();
  form.set('file', new File([pdf], 'sample.pdf', { type: 'application/pdf' }));
  form.set('pages', '3');
  form.set('title', 'Integration fixture');
  const upload = await fetch(base + '/api/papers', {
    method: 'POST',
    body: form,
  });
  assert.equal(upload.status, 201, await upload.clone().text());
  const paper = await upload.json();
  const positionPath = `/api/papers/${paper.id}/position`;
  assert.equal(await (await fetch(base + positionPath)).json(), null);
  const position = { page: 2, x: 0.2, y: 0.4, updatedAt: 200 };
  assert.equal((await request(positionPath, 'PUT', position)).status, 200);
  assert.deepEqual(await (await fetch(base + positionPath)).json(), position);
  assert.equal(
    (
      await request(positionPath, 'PUT', {
        ...position,
        page: 1,
        updatedAt: 100,
      })
    ).status,
    200,
  );
  assert.deepEqual(await (await fetch(base + positionPath)).json(), position);
  assert.equal(
    (await request(positionPath, 'PUT', { ...position, page: 4 })).status,
    400,
  );
  assert.equal(
    (await request(positionPath, 'PUT', { ...position, y: 2 })).status,
    400,
  );
  const file = await fetch(base + `/api/papers/${paper.id}/file`);
  assert.equal(file.status, 200);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), pdf);
  assert.equal((await fetch(base + `/papers/${paper.id}?page=2`)).status, 200);
  assert.equal(
    (
      await request(`/api/papers/${paper.id}`, 'PATCH', {
        title: 'Renamed paper',
        tags: ['Research', 'Research', 'reading'],
      })
    ).status,
    200,
  );
  const forwarded = await fetch(base + `/api/papers/${paper.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-Proto': 'https',
      'X-Forwarded-Host': 'papers.example.test',
      Origin: 'https://papers.example.test',
    },
    body: JSON.stringify({
      title: 'Renamed paper',
      tags: ['research', 'reading'],
    }),
  });
  assert.equal(forwarded.status, 200, 'HTTPS proxy origin must be accepted');
  const type = { id: 'ideas', revision: 0, name: 'Ideas', color: '#0d9488' };
  assert.equal(
    (await request('/api/records/types/ideas', 'PUT', type)).status,
    200,
  );
  const annotation = {
    id: 'sample-note',
    revision: 0,
    paperId: paper.id,
    page: 2,
    kind: 'highlight',
    quote: 'A useful phrase',
    note: 'What does this imply?',
    types: ['ideas', 'question'],
    rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.02 }],
    points: [],
    color: '#facc15',
    createdAt: new Date().toISOString(),
  };
  const created = await request(
    '/api/records/annotations/sample-note',
    'PUT',
    annotation,
  );
  assert.equal(created.status, 200);
  assert.equal((await created.json()).revision, 1);
  const retry = await request(
    '/api/records/annotations/sample-note',
    'PUT',
    annotation,
  );
  assert.equal(
    retry.status,
    200,
    'Lost acknowledgements must be idempotently retried',
  );
  assert.equal((await retry.json()).revision, 1);
  const edited = {
    ...annotation,
    revision: 1,
    note: 'Updated from this device',
  };
  assert.equal(
    (await request('/api/records/annotations/sample-note', 'PUT', edited))
      .status,
    200,
  );
  assert.equal(
    (
      await request('/api/records/annotations/sample-note', 'PUT', {
        ...annotation,
        note: 'Conflicting other device',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request('/api/records/annotations/bad', 'PUT', {
        ...annotation,
        id: 'bad',
        page: 4,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request('/api/records/annotations/bad', 'PUT', {
        ...annotation,
        id: 'bad',
        types: ['unknown'],
      })
    ).status,
    400,
  );
  assert.equal(
    (await request('/api/records/types/bad', 'PUT', null)).status,
    400,
  );
  assert.equal(
    (await request(`/api/papers/${paper.id}`, 'PATCH', null)).status,
    400,
  );
  const foreign = await fetch(base + '/api/records/types/ideas', {
    method: 'PUT',
    headers: {
      Origin: 'https://foreign.example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(type),
  });
  assert.equal(foreign.status, 403);
  const reading = {
    id: 'read-next',
    revision: 0,
    paperId: paper.id,
    page: 1,
    reference: 'Original citation',
    article: {
      title: 'A cited work',
      authors: 'A. Example',
      year: '2024',
      raw: 'Original citation',
      match: 'unresolved',
    },
    note: '',
    createdAt: new Date().toISOString(),
  };
  assert.equal(
    (await request('/api/records/readings/read-next', 'PUT', reading)).status,
    200,
  );
  const library = await (await request('/api/library')).json();
  assert.deepEqual(library.papers[0].tags, ['research', 'reading']);
  assert.equal(library.annotations[0].note, edited.note);
  assert.equal(library.readings[0].paperId, paper.id);
  assert.ok(library.types.some((t) => t.id === 'ideas'));
  const deletion = { ...edited, revision: 2 };
  assert.equal(
    (await request('/api/records/annotations/sample-note', 'DELETE', deletion))
      .status,
    200,
  );
  assert.equal(
    (await request('/api/records/annotations/sample-note', 'DELETE', deletion))
      .status,
    200,
  );
  assert.equal(
    (await (await request('/api/library')).json()).annotations.length,
    0,
  );
  for (const path of [
    '/',
    '/manifest.webmanifest',
    '/sw.js',
    '/icon-192.png',
    '/pdfjs/pdf.worker.legacy.min.mjs',
  ])
    assert.equal((await fetch(base + path)).status, 200, path);
  execFileSync(process.execPath, ['scripts/backup.mjs', join(root, 'backup')], {
    env,
    stdio: 'pipe',
  });
  assert.deepEqual(
    await readFile(join(root, 'backup', 'pdfs', `${paper.id}.pdf`)),
    pdf,
  );
  execFileSync(process.execPath, ['scripts/migrate.mjs'], {
    env,
    stdio: 'pipe',
  });
  if (process.env.CROSSREF_LIVE === '1') {
    const citation = await (
      await fetch(base + '/api/citation?q=10.1038%2Fnphys1170')
    ).json();
    assert.equal(citation.match, 'doi', 'Crossref DOI lookup');
    assert.equal(citation.doi.toLowerCase(), '10.1038/nphys1170');
    console.log('PASS: live Crossref DOI metadata lookup.');
  }
  console.log(
    'PASS: upload and byte integrity, deep links, paper tags, custom types, annotations, read later, conflict detection, retry idempotency, deletion, validation, cross-origin protection, PWA assets, backup, and repeatable migrations.',
  );
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  server.kill('SIGTERM');
  await new Promise((r) => server.once('exit', r));
  await rm(root, { recursive: true, force: true });
}
