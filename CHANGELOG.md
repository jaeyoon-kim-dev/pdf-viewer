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
