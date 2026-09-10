'use client';
import { useState } from 'react';
import {
  Highlighter,
  Underline,
  StickyNote,
  PenLine,
  Trash2,
  Link2,
  Copy,
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
  const [draft, setDraft] = useState(annotation);
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
          Choose a color, annotation style and optional collections, then save.
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
                  onClick={() => setDraft({ ...draft, color })}
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
              <TabsTrigger value="highlight">
                <Highlighter size={15} />
                Highlight
              </TabsTrigger>
              <TabsTrigger value="underline">
                <Underline size={15} />
                Underline
              </TabsTrigger>
              <TabsTrigger value="note">
                <StickyNote size={15} />
                Note
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
            <Copy size={14} />
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="text-button" onClick={() => setExpanded(true)}>
            More options
          </button>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => submit()}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
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
