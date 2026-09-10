# Architecture

## Local hosting

React 19 and Vinext serve the application on Node. SQLite stores paper metadata and records; immutable PDF files live beside the database. `db/index.ts` contains the small storage boundary. There are no Cloudflare runtime bindings in the local application. `.openai/hosting.json` retains the unused preview registration from setup; nothing is published and the app does not call Sites at runtime.

```
Browser / installed PWA
  ├─ PDF.js: render, extract text, resolve PDF links
  ├─ pointer selection + normalized annotation overlays
  ├─ IndexedDB: cached library + pending annotation/type/reading changes
  └─ service worker: app resources + explicitly downloaded PDFs
       │ same-origin HTTP
Node / Vinext
  ├─ /api/papers: upload, file retrieval, title/tags
  ├─ /api/library: complete personal library snapshot
  ├─ /api/records/:kind/:id: revision-checked changes
  ├─ /api/citation: bounded Crossref lookup
  └─ SQLite + data/pdfs/<uuid>.pdf
```

## Identity and source anchors

A paper UUID is independent of its title and filename. Renaming or tagging preserves its URL. Uploading the same PDF again creates a separate paper; automatic duplicate detection is not implemented.

Annotations have stable IDs, a paper ID, one-based page number, quote, note, primitive kind (`highlight`, `underline`, `note`, `ink`), color, collection-type IDs, creation time, and revision. Selection rectangles and pen points use normalized page coordinates from 0 to 1, so zoom and layout changes preserve placement. Ink pressure is recorded, but rendering currently uses a constant stroke width.

A collection type is a reusable entity classification with an ID, name, and color. Phrases and Questions are built in. Users can create types such as Ideas or Limitations; each annotation may have multiple types. There are no arbitrary custom-field schemas or independent knowledge-graph relationships yet. A question's `resolved` flag is separate from its note.

Whole-paper tags are independent of annotation types. Paper metadata edits currently require a connection. Annotation, collection-type creation, and read-later changes may be queued offline.

`/papers/<uuid>?page=4&annotation=<uuid>` is the canonical annotation source link. Read-later entries retain the source paper, citing page, original bibliography text, and retrieved article information. The reading list groups DOI matches (otherwise normalized titles) while retaining each source entry. The source anchor currently identifies the citing page rather than the exact citation word rectangle.

## Synchronization and durability

The server is authoritative. A local edit is first saved to the IndexedDB outbox, then sent to the API. A pending edit stores its base server revision. Multiple local edits to the same record are coalesced. If a request is in flight, its acknowledgement advances the next local edit's base revision without dropping that edit.

Server writes use prepared SQL and compare revisions. Conflicts return 409; the local copy remains available in Sync status. The owner chooses Keep my edit or Use server version. Deletes retain server tombstones so a stale update cannot silently resurrect a record. Identical retries after lost acknowledgements return the already-saved revision.

Use one active editing tab per browser for best results; cross-tab live subscriptions are not implemented. Different devices may edit, with conflicts exposed. Synchronization runs on reconnection, periodically while mounted, and on request. Background synchronization while the app is closed is not guaranteed by browsers.

## PDF and reference processing

PDF.js is dynamically imported in the browser. Its worker, character maps, standard fonts, and WASM assets are served locally. Canvases render near the viewport and release their pixel buffers when unmounted or distant. Page text is cached while a paper is open; full-document reference indexing runs incrementally.

The custom selection system uses PDF text positions and measured word widths rather than native DOM Selection. On a touch drag, the initial direction distinguishes scrolling from text selection. Dragging across text begins selection; a vertical swipe scrolls. Margin swipes navigate in single/two-page views; horizontal view supports horizontal scrolling. Two pointers zoom; a pen draws only with the pen toggle enabled. Native callouts are suppressed only on the paper surface; note textareas retain standard text editing.

Existing PDF link destinations are preferred. Heuristics detect numbered/author-year references and figure/table captions. Previews preserve the main reader position. Figure crops are estimated from a caption or destination and include an option to inspect the entire linked page.

The server sends only the clicked reference string to Crossref. It does not upload full papers for extraction. DOI matches are distinguished from title candidates; low-confidence matches retain the original reference. Abstracts and PDF links appear only when provided by the metadata source. Crossref lookup requires an internet connection even when the reader itself is local.

## Exports and future PKM

JSON exports include `schemaVersion: 1`, timestamp, paper metadata, annotation records, collection types, and reading entries. The export contains normalized coordinates and stable IDs. Original PDF bytes are separate and covered by full backups. JSON import and embedded standard PDF annotation export are not implemented.

Future PKM work can use existing IDs and source URLs rather than treating annotations as disposable viewer state. Potential extensions are independent entities with custom fields, relations between thoughts, an authenticated integration API, and import/export adapters.

## Migrations and tooling

Drizzle generates numbered SQLite migration files. `scripts/migrate.mjs` applies each migration transactionally, records checksums, and rejects edits to applied migrations. Runtime queries never create application tables.

Lint covers authored application code. Vendored UI primitives are excluded. React Compiler checks are disabled because the compiler is not enabled. Full HTML navigation is intentional for reliable offline document caching; in-memory page previews use canvas data URLs rather than optimized web images.

A feature-detected WebMCP surface exposes page navigation and page-note creation using the same actions as the UI. Unsupported browsers simply omit it. This interface has not been validated in a real WebMCP browser context.

## Reader popovers and sizing

`reader-popover.tsx` composes Base UI non-modal popovers with virtual anchors derived from the source element or normalized PDF selection rectangle. Anchors follow scrolling and resizing; collision handling keeps controls inside the viewport. There is no backdrop, scroll lock, or forced initial textarea focus. Escape, outside interaction, and the close button dismiss the popover. Unsaved annotation edits require Save annotation before dismissal.

`reader-view.ts` calculates width fitting with spread spacing and height fitting with measured vertical padding and a page-label allowance. Actual size maps PDF points to CSS pixels at 96/72. Custom zoom is clamped to 25–400%; fit modes can exceed those custom limits. The first page supplies the displayed document zoom baseline; height fitting uses each rendered page’s actual aspect ratio. Keyboard zoom is intercepted only with Command/Control; ordinary typing remains available.

The annotation toolbar wraps independently of viewing controls. Memo and Question create page-linked annotations through the same editor; Question presets the existing question collection. Pages with zero extracted words show an explanation instead of silently offering unavailable text selection.

The selection toolbar anchors to the endpoint word, including reverse drags. Reader state retains an unsaved annotation overlay after pointer-up. Non-modal popovers ignore outside/focus dismissal until a subsequent pointer-down, preventing the opening gesture's trailing click from dismissing them. The selection tooltip provides a palette, style buttons, Question/Phrase toggles and explicit Save; More options expands the full editor.

Sticky memos use existing note records with an empty quote and a normalized position rectangle; no schema migration is needed. Pin buttons open their editor. Placement is a one-shot action and does not change normal text annotation. Existing page-level notes remain supported.

Annotation writes are serialized and record a bounded in-memory before/after history. Undo and redo reuse the persistent outbox, preserving record IDs and acknowledged deletion revisions. The current paper scopes history replay. Conflicting or externally changed local records block replay; server-side optimistic concurrency remains active. History itself is not persisted across reloads.

Google Scholar investigation (2026-09-10): https://github.com/salcc/Scholar-PDF-Reader-with-Annotations bundles a Chromium extension with extension-specific permissions. No license for the bundled reader was verified (the tree contains a bcmap license, not a general reader license). No code was copied. Paperthread citation metadata still uses Crossref and local reference extraction; it does not reproduce Scholar's backend.

Citation card design reference: https://github.com/salcc/Scholar-PDF-Reader-with-Annotations/blob/main/screenshot.png (inspected 2026-09-10). The independently implemented layout follows its citation-number header, linked title, metadata line, expandable abstract, action row and rounded access links. No upstream source/assets were imported. Crossref container-title supplies the optional venue field; older saved records remain compatible and no migration is required. A bounded tab-local metadata cache prevents repeat lookups for resolved references. Citation export escapes BibTeX values and labels output as generated metadata; unresolved references remain available as original text. Scholar discovery links use a normal DOI/title search rather than undocumented APIs or invented counts.

Preview loading is keyed to the selected reference/document, not the saved Reading object. A ref supplies saved metadata without retriggering loading on synchronization. Resolved cached/saved metadata is reused, and minimum content areas reduce async layout shifts; unusually long content can still resize the card.

Native reference matching now uses destination type (XYZ/FitH/FitBH/FitR), source text/line context, explicit citation/figure anchor names, and a maximum normalized destination distance of 0.04. Page/section/equation navigation and standalone margin folios are excluded. Generic destination excerpts are no longer promoted to citations. External DOI/arXiv matching is restricted to actual host prefixes. This is a conservative local filter and can miss ambiguous links. The inspected Scholar extension bundle delegates analysis to analyzer_worker_bin.js and uses structured InTextCitation data; its full filtering engine was not imported or reproduced.

DocumentNavigation reads PDF.js getOutline and resolves outline destinations to page indexes. Nested entries are expandable; PDFs without an embedded outline show an explicit empty state. Thumbnail canvases render only near the sidebar viewport and release their backing buffers offscreen. The left panel is independently hideable; annotation navigation stays on the right. Continuous/Page remembers the last continuous direction and paged layout during the current reader session. Height fitting measures track padding, reserves a 30px page label, and applies the available height independently to each PDF page’s aspect ratio; Fit width remains separate.

The reader exposes its custom selection quote to keyboard and copy events, excluding native input/contenteditable or actual DOM text selections. Clipboard writes use navigator.clipboard when available and a user-initiated copy-event fallback on private HTTP; the fallback never focuses a hidden textarea. If both fail, an error is shown. Thumbnail overlays consume the same annotation state and normalized coordinates as the reader, with each page’s actual aspect ratio. Annotation changes repaint SVG overlays without rerendering PDF canvases; page-level memos without coordinates contribute to counts.
