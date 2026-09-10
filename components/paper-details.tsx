'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Paper } from '@/lib/model';
import { refreshLibrary } from '@/lib/store';
export default function PaperDetails({
  paper,
  onClose,
}: {
  paper: Paper;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(paper.title);
  const [tags, setTags] = useState(paper.tags.join(', '));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent>
        <DialogTitle>Paper details</DialogTitle>
        <DialogDescription>
          Tags organize whole papers. Collection types organize the thoughts
          inside them.
        </DialogDescription>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const r = await fetch(`/api/papers/${paper.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title,
                  tags: tags
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                }),
              });
              if (!r.ok)
                throw new Error(((await r.json()) as { error?: string }).error);
              await refreshLibrary();
              onClose();
            } catch (e) {
              setError(
                navigator.onLine
                  ? String(e)
                  : 'Reconnect to edit paper details. Your draft is still here.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Title
            <input
              required
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Tags
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="machine learning, to discuss, thesis"
            />
          </label>
          <p className="muted">Separate tags with commas.</p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button disabled={busy} className="primary-button" type="submit">
            {busy ? 'Saving…' : 'Save details'}
          </button>
        </form>
        <a
          className="secondary-button"
          href={`/api/papers/${paper.id}/file`}
          download={paper.filename}
        >
          Download original PDF
        </a>
      </DialogContent>
    </Dialog>
  );
}
