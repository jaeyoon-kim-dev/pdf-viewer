'use client';
import { createId } from './id.ts';
import { useEffect, useState } from 'react';
import {
  EMPTY_LIBRARY,
  type LibraryData,
  type RecordKind,
  type SavedRecord,
} from './model.ts';
type Pending = {
  key: string;
  kind: RecordKind;
  value: SavedRecord;
  deleted: boolean;
  nonce: string;
  error?: string;
};
let connection: Promise<IDBDatabase> | undefined;
function db() {
  return (connection ||= new Promise((resolve, reject) => {
    const r = indexedDB.open('paperthread-v1', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('data');
      r.result.createObjectStore('pending', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(
        new Error(
          'Local storage is unavailable. Allow browser storage to save offline edits.',
        ),
      );
  }));
}
async function transaction<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, mode);
    const r = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(r.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
const allPending = () =>
  transaction<Pending[]>('pending', 'readonly', (s) => s.getAll());
async function amendPending(
  key: string,
  amend: (value: Pending | undefined) => Pending | undefined,
) {
  const database = await db();
  return new Promise<Pending | undefined>((resolve, reject) => {
    const tx = database.transaction('pending', 'readwrite');
    const store = tx.objectStore('pending');
    let next: Pending | undefined;
    const request = store.get(key);
    request.onsuccess = () => {
      next = amend(request.result);
      if (next) store.put(next);
      else store.delete(key);
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
let snapshot: LibraryData = EMPTY_LIBRARY;
let status = 'Loading library…';
let loaded = false;
let pendingCount = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
function overlay(data: LibraryData, items: Pending[]): LibraryData {
  const next = { ...data };
  for (const op of items) {
    const entries = (next[op.kind] as SavedRecord[]).filter(
      (x) => x.id !== op.value.id,
    );
    if (!op.deleted) entries.push(op.value);
    (next[op.kind] as SavedRecord[]) = entries;
  }
  return next;
}
async function cacheSnapshot() {
  await transaction('data', 'readwrite', (s) => s.put(snapshot, 'library'));
}
let refreshing: Promise<void> | undefined;
export function refreshLibrary() {
  return (refreshing ||= (async () => {
    try {
      const response = await fetch('/api/library', { cache: 'no-store' });
      if (!response.ok)
        throw new Error(
          response.status === 401 || response.status === 403
            ? 'Sign in again to synchronize.'
            : 'Library server is unavailable.',
        );
      const data = (await response.json()) as LibraryData;
      if (!Array.isArray(data.papers))
        throw new Error('Unexpected library response.');
      const pending = await allPending();
      snapshot = overlay(data, pending);
      pendingCount = pending.length;
      status = pending.length
        ? `${pending.length} edit${pending.length === 1 ? '' : 's'} waiting to sync`
        : 'All changes synced';
      await cacheSnapshot();
    } catch (e) {
      const cached = await transaction<LibraryData | undefined>(
        'data',
        'readonly',
        (s) => s.get('library'),
      );
      if (cached) snapshot = overlay(cached, await allPending());
      status = navigator.onLine
        ? e instanceof Error
          ? e.message
          : 'Could not load library.'
        : 'Offline · edits stay on this device until synced';
    } finally {
      loaded = true;
      refreshing = undefined;
      emit();
    }
  })());
}
let syncing: Promise<void> | undefined;
export async function saveRecord(
  kind: RecordKind,
  value: SavedRecord,
  deleted = false,
) {
  const key = `${kind}/${value.id}`;
  const previous = await transaction<Pending | undefined>(
    'pending',
    'readonly',
    (s) => s.get(key),
  );
  const op: Pending = {
    key,
    kind,
    value: { ...value, revision: previous?.value.revision ?? value.revision },
    deleted,
    nonce: createId(),
  };
  await transaction('pending', 'readwrite', (s) => s.put(op));
  snapshot = overlay(snapshot, [op]);
  pendingCount = (await allPending()).length;
  await cacheSnapshot();
  status = 'Saved on this device · syncing…';
  emit();
  void syncPending();
}
export function syncPending() {
  return (syncing ||= (async () => {
    try {
      // Types must arrive before records that reference them.
      const pending = (await allPending()).sort(
        (a, b) => Number(b.kind === 'types') - Number(a.kind === 'types'),
      );
      for (const op of pending) {
        if (!navigator.onLine) {
          status = 'Offline · edits saved on this device';
          break;
        }
        if (op.error) {
          status = 'Sync needs attention · local edits retained';
          continue;
        }
        let response: Response;
        try {
          response = await fetch(`/api/records/${op.key}`, {
            method: op.deleted ? 'DELETE' : 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(op.value),
          });
        } catch {
          status = 'Offline or server unavailable · edits saved on this device';
          break;
        }
        if (!response.ok) {
          let error = 'Could not sync. Your local edit is retained.';
          try {
            error =
              ((await response.json()) as { error?: string }).error || error;
          } catch {
            /* non-JSON authentication response */
          }
          await amendPending(op.key, (latest) =>
            latest ? { ...latest, error } : undefined,
          );
          status = 'Sync needs attention · local edits retained';
          continue;
        }
        const saved = (await response.json()) as SavedRecord;
        const latest = await amendPending(op.key, (current) => {
          if (!current || current.nonce === op.nonce) return undefined;
          return {
            ...current,
            value: { ...current.value, revision: saved.revision },
          };
        });
        if (!latest) {
          snapshot = overlay(snapshot, [{ ...op, value: saved }]);
        } else snapshot = overlay(snapshot, [latest]);
      }
      const rest = await allPending();
      pendingCount = rest.length;
      if (!rest.length) status = 'All changes synced';
      await cacheSnapshot();
    } catch (e) {
      status =
        e instanceof Error ? e.message : 'Sync failed. Local edits retained.';
    } finally {
      syncing = undefined;
      emit();
    }
  })());
}
export async function pendingEdits() {
  return allPending();
}
export async function resolvePending(key: string, keepLocal: boolean) {
  const op = await transaction<Pending | undefined>(
    'pending',
    'readonly',
    (s) => s.get(key),
  );
  if (!op) return;
  const response = await fetch('/api/library', { cache: 'no-store' });
  if (!response.ok) throw new Error('Reconnect to resolve this edit.');
  const remote = (await response.json()) as LibraryData;
  if (keepLocal) {
    const record = (remote[op.kind] as SavedRecord[]).find(
      (x) => x.id === op.value.id,
    );
    // Tombstones need their revision too; the record lookup endpoint includes them.
    const check = await fetch(`/api/records/${key}`);
    if (!check.ok) throw new Error('Cannot read current revision.');
    const revision = ((await check.json()) as { revision: number }).revision;
    await transaction('pending', 'readwrite', (s) =>
      s.put({
        ...op,
        value: { ...op.value, revision: record?.revision ?? revision },
        error: undefined,
        nonce: createId(),
      }),
    );
  } else await transaction('pending', 'readwrite', (s) => s.delete(key));
  await refreshLibrary();
  await syncPending();
}
export function useLibrary() {
  const [, render] = useState(0);
  useEffect(() => {
    const notify = () => render((x) => x + 1);
    listeners.add(notify);
    void refreshLibrary()
      .then(syncPending)
      .catch((e) => {
        status = String(e);
        loaded = true;
        emit();
      });
    const online = () => {
      void syncPending().then(refreshLibrary);
    };
    const tick = setInterval(() => {
      void syncPending();
    }, 15000);
    const offline = () => {
      status = 'Offline · edits stay on this device until synced';
      emit();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      listeners.delete(notify);
      clearInterval(tick);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);
  return {
    data: snapshot,
    status,
    loaded,
    pendingCount,
    refresh: refreshLibrary,
    save: saveRecord,
  };
}
export function exportLibrary(data: LibraryData) {
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          { schemaVersion: 1, exportedAt: new Date().toISOString(), ...data },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    ),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'paperthread-library.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function retryPending() {
  for (const item of await allPending())
    await amendPending(item.key, (latest) =>
      latest ? { ...latest, error: undefined } : undefined,
    );
  await syncPending();
}
