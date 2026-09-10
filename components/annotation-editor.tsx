'use client';
import { useState } from 'react';
import {
  Highlighter,
  Underline,
  StickyNote,
  PenLine,
  Trash2,
  Link2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import TypePicker from './type-picker';
import { type Annotation, sourceHref } from '@/lib/model';
import { useLibrary } from '@/lib/store';
export default function AnnotationEditor({
  annotation,
  onClose,
}: {
  annotation: Annotation;
  onClose: () => void;
}) {
  const { save } = useLibrary();
  const [draft, setDraft] = useState(annotation);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function submit(deleted = false) {
    setBusy(true);
    try {
      await save('annotations', draft, deleted);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="wide-dialog">
        <DialogTitle>
          {annotation.revision ? 'Edit annotation' : 'Keep this thought'}
        </DialogTitle>
        <DialogDescription>
          Page {draft.page} · Your note and collections stay linked to this
          spot.
        </DialogDescription>
        {draft.quote && (
          <blockquote className="selected-quote">{draft.quote}</blockquote>
        )}
        <Tabs
          value={draft.kind}
          onValueChange={(kind) =>
            setDraft({ ...draft, kind: kind as Annotation['kind'] })
          }
        >
          <TabsList className="annotation-kinds">
            {draft.kind !== 'ink' ? (
              <>
                <TabsTrigger value="highlight">
                  <Highlighter />
                  Highlight
                </TabsTrigger>
                <TabsTrigger value="underline">
                  <Underline />
                  Underline
                </TabsTrigger>
                <TabsTrigger value="note">
                  <StickyNote />
                  Memo
                </TabsTrigger>
              </>
            ) : (
              <TabsTrigger value="ink">
                <PenLine />
                Handwriting
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
        <div className="color-options" aria-label="Annotation color">
          {['#facc15', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa'].map(
            (color) => (
              <button
                key={color}
                aria-label={`Color ${color}`}
                aria-pressed={draft.color === color}
                className={draft.color === color ? 'chosen' : ''}
                style={{ background: color }}
                onClick={() => setDraft({ ...draft, color })}
              />
            ),
          )}
        </div>
        <label className="stack">
          Note
          <textarea
            rows={4}
            maxLength={30000}
            value={draft.note}
            placeholder="What do you want to remember, ask, or explore?"
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </label>
        <TypePicker
          value={draft.types}
          onChange={(types) => setDraft({ ...draft, types })}
        />
        {draft.types.includes('question') && (
          <label className="type-option" htmlFor="question-resolved">
            <Checkbox
              id="question-resolved"
              checked={!!draft.resolved}
              onCheckedChange={(resolved) => setDraft({ ...draft, resolved })}
            />
            Question resolved
          </label>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="editor-footer">
          <div className="button-row">
            {annotation.revision > 0 && (
              <button
                className="icon-button danger"
                aria-label="Delete annotation"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={18} />
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Copy source link"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    new URL(sourceHref(draft), location.origin).href,
                  );
                } catch {
                  setError('Copy the paper URL from the address bar.');
                }
              }}
            >
              <Link2 size={18} />
            </button>
          </div>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => submit()}
          >
            {busy ? 'Saving…' : 'Save annotation'}
          </button>
        </div>
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogTitle>Delete annotation?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the annotation and its collection entries.
            </AlertDialogDescription>
            <div className="button-row">
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                className="danger-button"
                disabled={busy}
                onClick={() => submit(true)}
              >
                Delete annotation
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
