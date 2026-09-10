'use client';
import { useState } from 'react';
import { Cloud, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  useLibrary,
  pendingEdits,
  resolvePending,
  retryPending,
  exportLibrary,
} from '@/lib/store';
export default function SyncStatus() {
  const { data, status, pendingCount } = useLibrary();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Awaited<ReturnType<typeof pendingEdits>>>(
    [],
  );
  const [error, setError] = useState('');
  async function update() {
    setItems(await pendingEdits());
  }
  async function resolve(key: string, local: boolean) {
    try {
      await resolvePending(key, local);
      await update();
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <>
      <button
        className="sync-status"
        onClick={() => {
          setOpen(true);
          void update();
        }}
      >
        <Cloud size={15} />
        <span>{pendingCount ? `${pendingCount} pending` : status}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="wide-dialog">
          <DialogTitle>Sync status</DialogTitle>
          <DialogDescription>
            {status}. Offline changes are stored on this browser until the
            server accepts them.
          </DialogDescription>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="button-row">
            <button
              className="secondary-button"
              onClick={async () => {
                await retryPending();
                await update();
              }}
            >
              <RefreshCw size={16} />
              Retry sync
            </button>
            <button
              className="secondary-button"
              onClick={() => exportLibrary(data)}
            >
              Export local backup
            </button>
          </div>
          {items.map((item) => (
            <div className="sync-item" key={item.key}>
              <strong>
                {'quote' in item.value
                  ? item.value.quote.slice(0, 70) || 'Page annotation'
                  : 'name' in item.value
                    ? item.value.name
                    : item.value.article.title}
              </strong>
              <p className="muted">{item.error || 'Waiting to synchronize'}</p>
              {item.error && (
                <div className="button-row">
                  <button
                    className="secondary-button"
                    onClick={() => resolve(item.key, true)}
                  >
                    Keep my edit
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => resolve(item.key, false)}
                  >
                    Use server version
                  </button>
                </div>
              )}
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}
