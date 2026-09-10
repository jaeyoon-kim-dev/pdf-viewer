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
