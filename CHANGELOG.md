# Change log

## Reader refinements — 2026-09-10

- Compact Zotero-inspired reader toolbar and neutral paper workspace.
- Source-anchored, non-modal annotation editors and reference previews; no blur or backdrop.
- Fit width, Fit page, Actual size, custom zoom, and Cmd/Ctrl zoom shortcuts.
- Private Tailscale HTTP serving with secure random-ID fallback; HTTPS awaits tailnet enablement.

## 0.1.0 — 2026-09-10

Initial local application:

- Uploaded PDFs with stable paths, paper-level tagging and filtering.
- Four viewing layouts and light, dark, and sepia themes.
- Highlights, underlines, page memos, handwriting, notes, and extensible collection types.
- Citation/figure previews and citation-level read-later toggles with source backlinks.
- PWA manifest, service worker, offline downloads, persistent edit outbox, revision conflict handling, and JSON export.
- Node/SQLite/filesystem deployment, Docker volume, schema migrations, and backups.
- Requirements, architecture, deployment guide, and explicit validation gaps.


## Annotation discoverability — 2026-09-10

- Added a wrapping annotation bar with labelled Memo, Question, Handwriting, and notebook access.
- Added a notice on pages without selectable text.

## Selection tooltips, sticky memos and undo — 2026-09-10

- Compact actions beside the selection endpoint, with retained draft selection and protection against dismissal by the opening click.
- One-click highlights/underlines; expandable notes, phrases and questions.
- Place sticky memos anywhere on a page and reopen them from their pins.
- Visible notebook deletion and session Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z undo/redo, including offline edits and synced deletions.

## Scholar-style citation cards — 2026-09-10

- Rebuilt preview presentation around the Scholar reference-card screenshot: slim reference header, linked title, publication line, expandable abstract, compact actions and access links.
- Added original/BibTeX citation copying and inline bibliography context.
- Retained Read later and added explicit Scholar search links without simulating unavailable Scholar metadata.
- Added optional publication venue and a bounded client metadata cache.

## Preview stability and reference filtering — 2026-09-10

- Prevent Read later and library sync from restarting preview loading or collapsing expanded content.
- Reserve loading space for article details and figures.
- Exclude page-number folios and page/section navigation from citation previews; remove generic-link citation fallback and tighten destination matching.

## Selection palette and document navigation — 2026-09-10

- Selection tooltip now has a color palette, right-hand style selector, Question/Phrase toggles and Save.
- Added Continuous/Page switching and a hideable left Contents/Pages sidebar with lazy thumbnails.
- Fit page fills the available reading height using each page’s aspect ratio; wide pages scroll horizontally.

## Copy and annotated thumbnails — 2026-09-10

- Added Cmd/Ctrl+C and Copy buttons for custom PDF selections, including a private-HTTP clipboard fallback.
- Pages thumbnails now display saved highlights, underlines, ink and sticky-memo markers with live annotation counts.

## Annotation buttons and select sizing — 2026-09-10

- Replaced the selection tooltip style dropdown with Highlight, Underline and Note buttons.
- Corrected shared select padding and line-height to fit compact toolbar heights without cropping text.

## Modifier-scroll zoom — 2026-09-10

- Added Cmd/Ctrl+scroll to zoom the PDF around the pointer, with normalized wheel deltas and 25–400% bounds.

## Compact reader panels — 2026-09-10

- Replaced annotation cards with dense separated rows and compact edit/delete actions.
- Reduced sidebar header/search/tab spacing, empty-state margins and popup padding.
- Removed repeated quote/footer borders and retained larger touch action targets.

## Preview layout, reading continuity and Safari compatibility — 2026-09-10

- Matched the supplied preview structure with grouped header navigation, blue title, truncated metadata, fading abstract, Save toggle and rounded access links.
- Store last reading position in SQLite while keeping paper URLs free of query/hash state; preserve in-app source jumps via session storage.
- Remember tooltip choices in local storage and restore the annotation sidebar quote bar.
- Use matching PDF.js legacy library/worker builds for Safari compatibility.

## Crisp highlights and Safari diagnostics — 2026-09-10

- Separate highlight fills from other annotations and blend them with the PDF to preserve glyph contrast, including page thumbnails and dark mode.
- Prevent native canvas dragging and tolerate pointer capture failures. Surface text extraction errors on already-rendered pages to diagnose unavailable selection/citations.

## Safari 26.0.1 text extraction — 2026-09-10

- Replaced PDF.js stream async iteration with explicit reader.read() consumption for text extraction. The legacy build alone did not cover this missing Safari API.
- Regression test disables ReadableStream async iteration, reproduces the upstream TypeError, then verifies text selection hit testing and citation hotspots from a real PDF through the replacement.

## Immediate and frame-paced text selection — 2026-09-10

- Mouse-down on text immediately paints a single word; clicks and short drags can create single-word annotations. Stationary clicks on saved annotations still open them.
- Live selection updates only its own overlay, skips unchanged word ranges, and combines pointer updates into one paint per display frame. Release uses the final pointer position and cancels pending paints.

## Question markers and word selection accuracy — 2026-09-10

- Retain whole-word selection. Drag endpoints choose the line under the pointer before the nearest word, fixing skipped short line endings and incorrect selection of words on adjacent lines.
- Question-tagged text annotations show a clickable Q badge at the highlight; question memos and page thumbnails also show Q.
- Citation hotspots now distinguish clicks from drags: click opens a preview, drag selects text, and keyboard activation remains available.
