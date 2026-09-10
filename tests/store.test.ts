import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { saveRecord, pendingEdits, syncPending } from '../lib/store.ts';
import type { Annotation } from '../lib/model.ts';
const annotation = (id: string): Annotation => ({
  id,
  paperId: 'p',
  page: 1,
  revision: 0,
  kind: 'note',
  note: 'First',
  quote: '',
  types: [],
  rects: [],
  points: [],
  color: '#facc15',
  createdAt: '2026-09-10',
});
const online = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
void test('offline edits survive in IndexedDB and synchronize when connected', async () => {
  online(false);
  await saveRecord('annotations', annotation('offline'));
  await syncPending();
  assert.equal(
    (await pendingEdits()).find((x) => x.value.id === 'offline')?.value
      .revision,
    0,
  );
  const calls: string[] = [];
  globalThis.fetch = async (url, options) => {
    calls.push(
      url instanceof Request ? url.url : url instanceof URL ? url.href : url,
    );
    const value = JSON.parse(
      typeof options?.body === 'string' ? options.body : '{}',
    );
    return Response.json({ ...value, revision: value.revision + 1 });
  };
  online(true);
  await syncPending();
  assert.equal((await pendingEdits()).length, 0);
  assert.equal(calls.length, 1);
});
void test('an edit made during a pending request is retained with the acknowledged revision', async () => {
  online(false);
  await saveRecord('annotations', annotation('racing'));
  await syncPending();
  let acknowledge: (r: Response) => void = () => {};
  let started: () => void = () => {};
  const reached = new Promise<void>((r) => {
    started = r;
  });
  globalThis.fetch = async () => {
    started();
    return new Promise<Response>((r) => {
      acknowledge = r;
    });
  };
  online(true);
  const syncing = syncPending();
  await reached;
  await saveRecord('annotations', {
    ...annotation('racing'),
    note: 'Second edit while first is in flight',
  });
  acknowledge(Response.json({ ...annotation('racing'), revision: 1 }));
  await syncing;
  const remaining = (await pendingEdits()).find((x) => x.value.id === 'racing');
  assert.equal(
    (remaining!.value as Annotation).note,
    'Second edit while first is in flight',
  );
  assert.equal(remaining?.value.revision, 1);
  globalThis.fetch = async (_url, options) => {
    const value = JSON.parse(
      typeof options?.body === 'string' ? options.body : '{}',
    );
    return Response.json({ ...value, revision: 2 });
  };
  await syncPending();
  assert.equal((await pendingEdits()).length, 0);
});
void test('server conflicts retain the full local edit for manual resolution', async () => {
  online(false);
  await saveRecord('annotations', annotation('conflict'));
  await syncPending();
  globalThis.fetch = async () =>
    Response.json({ error: 'Changed on another device' }, { status: 409 });
  online(true);
  await syncPending();
  const pending = (await pendingEdits()).find((x) => x.value.id === 'conflict');
  assert.equal(pending?.error, 'Changed on another device');
  assert.equal((pending!.value as Annotation).note, 'First');
});
