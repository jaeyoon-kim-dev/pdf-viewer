'use client';
import { useEffect, useState } from 'react';
import {
  Highlighter,
  Underline,
  StickyNote,
  PenLine,
  Trash2,
  Link2,
  Copy,
  MoreHorizontal,
  Check,
} from 'lucide-react';
import { PopoverTitle, PopoverDescription } from '@/components/ui/popover';
import ReaderPopover from './reader-popover';
import type { ReaderAnchor } from '@/lib/popover-anchor';
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
import {
  annotationPreferences,
  ANNOTATION_PREFERENCES_KEY,
} from '@/lib/annotation-preferences';
import { copyText } from '@/lib/clipboard';
import { useLibrary } from '@/lib/store';
export default function AnnotationEditor({
  annotation,
  onClose,
  anchor,
}: {
  annotation: Annotation;
  onClose: () => void;
  anchor?: ReaderAnchor;
}) {
  const { data, save } = useLibrary();
  const saved = data.annotations.some((a) => a.id === annotation.id);
  const [draft, setDraft] = useState(() => {
    if (!saved && annotation.quote) {
      try {
        return {
          ...annotation,
          ...annotationPreferences(
            localStorage.getItem(ANNOTATION_PREFERENCES_KEY),
          ),
        };
      } catch {}
    }
    return annotation;
  });
  const [rememberPreferences] = useState(!saved && !!annotation.quote);
  useEffect(() => {
    if (!rememberPreferences) return;
    try {
      localStorage.setItem(
        ANNOTATION_PREFERENCES_KEY,
        JSON.stringify({
          color: draft.color,
          kind: draft.kind,
          types: draft.types.filter(
            (type) => type === 'question' || type === 'phrase',
          ),
        }),
      );
    } catch {}
  }, [draft.color, draft.kind, draft.types, rememberPreferences]);
  const [expanded, setExpanded] = useState(saved || !annotation.quote);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  async function copyQuote() {
    try {
      await copyText(draft.quote);
      setCopied(true);
    } catch (e) {
      setError(String(e));
    }
  }
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function submit(deleted = false, value = draft) {
    setBusy(true);
    try {
      await save('annotations', value, deleted);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  if (!expanded)
    return (
      <ReaderPopover
        anchor={anchor}
        onClose={onClose}
        side="top"
        className="selection-tooltip"
      >
        <PopoverTitle className="sr-only">Annotate selected text</PopoverTitle>
        <PopoverDescription className="sr-only">
          Choose an annotation style and optional collections, then click a
          color to save.
        </PopoverDescription>
        <div className="selection-palette-row">
          <div
            className="color-options selection-palette"
            aria-label="Annotation color"
          >
            {['#facc15', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa'].map(
              (color, i) => (
                <button
                  key={color}
                  aria-label={['Yellow', 'Green', 'Blue', 'Pink', 'Purple'][i]}
                  aria-pressed={draft.color === color}
                  className={draft.color === color ? 'chosen' : ''}
                  style={{ background: color }}
                  title={`Save ${['yellow', 'green', 'blue', 'pink', 'purple'][i]} ${draft.kind}`}
                  disabled={busy}
                  onClick={() => {
                    const value = { ...draft, color };
                    setDraft(value);
                    void submit(false, value);
                  }}
                />
              ),
            )}
          </div>
          <Tabs
            value={draft.kind}
            onValueChange={(kind) =>
              setDraft({ ...draft, kind: kind as Annotation['kind'] })
            }
          >
            <TabsList
              className="selection-style-buttons"
              aria-label="Annotation style"
            >
              <TabsTrigger
                value="highlight"
                aria-label="Highlight"
                title="Highlight"
              >
                <Highlighter size={16} />
              </TabsTrigger>
              <TabsTrigger
                value="underline"
                aria-label="Underline"
                title="Underline"
              >
                <Underline size={16} />
              </TabsTrigger>
              <TabsTrigger value="note" aria-label="Note" title="Note">
                <StickyNote size={16} />
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="selection-collections">
          {(['question', 'phrase'] as const).map((type) => (
            <label
              className="type-option"
              key={type}
              htmlFor={`selection-${type}`}
            >
              <Checkbox
                id={`selection-${type}`}
                checked={draft.types.includes(type)}
                onCheckedChange={(checked) =>
                  setDraft({
                    ...draft,
                    types: checked
                      ? [...new Set([...draft.types, type])]
                      : draft.types.filter((value) => value !== type),
                  })
                }
              />
              {type === 'question' ? 'Question' : 'Phrase'}
            </label>
          ))}
        </div>
        {(draft.kind === 'note' || draft.types.includes('question')) && (
          <textarea
            aria-label={draft.types.includes('question') ? 'Question' : 'Note'}
            rows={2}
            maxLength={30000}
            placeholder={
              draft.types.includes('question')
                ? 'What is your question?'
                : 'Write a note…'
            }
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        )}
        <div className="selection-footer">
          <button
            className="text-button"
            title="Copy selected text (⌘/Ctrl+C)"
            onClick={copyQuote}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span className="sr-only">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            className="text-button"
            title="More options"
            aria-label="More options"
            onClick={() => setExpanded(true)}
          >
            <MoreHorizontal size={16} />
          </button>
          {busy && (
            <output className="sr-only">Saving…</output>
          )}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </ReaderPopover>
    );
  return (
    <ReaderPopover
      anchor={anchor}
      onClose={onClose}
      side="top"
      className="annotation-editor-popover"
    >
      <PopoverTitle>
        {saved ? 'Edit annotation' : 'Keep this thought'}
      </PopoverTitle>
      <PopoverDescription>
        Page {draft.page} · Your note and collections stay linked to this spot.
      </PopoverDescription>
      {draft.quote && (
        <>
          <blockquote className="selected-quote">{draft.quote}</blockquote>
          <button className="text-button" onClick={copyQuote}>
            <Copy size={14} />
            {copied ? 'Copied' : 'Copy selected text'}
          </button>
        </>
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
          rows={3}
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
          {saved && (
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
    </ReaderPopover>
  );
}
