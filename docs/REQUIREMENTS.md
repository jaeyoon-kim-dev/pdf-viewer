# Paperthread requirements

## Confirmed

- Personal web PDF library. Upload once and read from the site.
- Installable PWA, desktop and iPad support.
- Stable, unique `/papers/<uuid>` path per PDF, with page and annotation deep links.
- Citation popovers with cited-article information, and figure previews without navigating away.
- Highlight, underline, memo, and handwriting annotations; all support notes.
- Extensible entity/collection types, initially Phrases and Questions. User can create Ideas, Limitations, or other types. An annotation can belong to multiple types.
- Read-later toggle inside citation preview, collected centrally with source backlinks.
- No separate text annotation mode. Dragging text selects it for annotation; separate pen toggle enables handwriting.
- Multiple confirmed viewing options: continuous vertical, continuous horizontal, single page, two pages. Light, dark, and sepia themes.
- Paper-level tags separate from annotation collection types.
- Confirmed hosting: own Linux server / Docker; serve locally, do not publish to Sites.
- Keep documentation and meaningful Git commits.
- Future PKM integration through stable identities and portable exports; no task manager in this scope.

## Implementation assumptions

- Searchable PDFs first. Scans remain readable and support pen/page notes; OCR is not included.
- Existing PDF destinations and heuristic reference extraction are used; extracted citation text may be sent to Crossref for bibliographic metadata. No full-document external processing.
- One shared personal library. Docker binds to loopback by default; private network/HTTPS reverse proxy provides access control for the iPad.
- Server SQLite database and filesystem are authoritative. Offline cached documents and pending annotation changes are device-local until synchronized.

## Acceptance goals

1. Upload a real PDF, refresh its unique URL, and retrieve original bytes.
2. Save and edit annotations, notes, collection types; follow collection links back to the page and mark.
3. Preview references and figures without changing the main page. Save/remove read-later from the preview.
4. Draw with a pointer/pen when enabled; retain strokes across zoom and reload.
5. Install the PWA and reopen downloaded papers offline; queue annotation changes until online.
6. Explicitly document real-iPad testing and extraction coverage limits.

## Reader interaction refinements

Use a compact Zotero-inspired toolbar and annotation sidebar. Editors and citation/figure previews open beside their source without a backdrop or blur. Support Fit width, Fit page, Actual size, and custom zoom (25–400%), with Cmd/Ctrl +/− and Cmd/Ctrl+0. Fit modes update when the reading viewport changes.

Annotation tools must remain visible on narrow screens: a wrapping annotation bar provides labelled Memo, Question, Handwriting, and notebook access, while text selection stays mode-free.

Selecting text must retain the selection until a compact, source-anchored toolbar action saves it or the user dismisses it. Do not let the pointer gesture that opens a tooltip immediately dismiss it. Sticky memos can be placed at arbitrary page coordinates and expanded by clicking their pins. Annotation deletion and session Undo/Redo are required.

Reference preview presentation should closely follow the Scholar card structure, rather than a generic modal form. Include an expandable abstract, publication metadata, Cite, PDF access when available, and original bibliography context inside the preview. Preserve the paper reading position and the custom Read later toggle.

Page numbers must not become citation hotspots. Internal links need citation/figure semantics and a credible matching destination. Keep expanded preview content stable across library sync and Read later changes; indicate asynchronous metadata loading explicitly.

Selection tooltip layout: color palette on the left, Highlight/Underline/Note selector on the right, Question/Phrase toggles below, explicit Save. Provide a top-level Continuous/Page toggle and a hideable left sidebar with Contents and Pages. Fit page must maximize page height inside the reader instead of shrinking to available width.

Custom PDF selections must support Cmd/Ctrl+C and a visible Copy action without native text selection or the iPad selection callout. Pages-sidebar previews must include saved annotations and reflect edit/delete/undo updates.
