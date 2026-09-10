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
- User requested horizontal paper scrolling. Pending clarification: start-on-text selects, start-on-margin horizontal swipe changes page.
- Keep documentation and meaningful Git commits.
- Future PKM integration through stable identities and portable exports; no task manager in this scope.

## Implementation assumptions

- Searchable PDFs first. Scans remain readable and support pen/page notes; OCR is not included.
- Existing PDF destinations and heuristic reference extraction are used; extracted citation text may be sent to Crossref for bibliographic metadata. No full-document external processing.
- One owner; Sites deployment is private. Independent hosting must be behind a private authentication proxy.
- Server database and object storage are authoritative. Offline cached documents and pending annotation changes are device-local until synchronized.

## Acceptance goals

1. Upload a real PDF, refresh its unique URL, and retrieve original bytes.
2. Save and edit annotations, notes, collection types; follow collection links back to the page and mark.
3. Preview references and figures without changing the main page. Save/remove read-later from the preview.
4. Draw with a pointer/pen when enabled; retain strokes across zoom and reload.
5. Install the PWA and reopen downloaded papers offline; queue annotation changes until online.
6. Explicitly document real-iPad testing and extraction coverage limits.
