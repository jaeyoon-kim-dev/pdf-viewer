# Validation and known limitations

## Automated checks

- TypeScript compilation and lint of authored application code.
- Unit tests: citation/figure recognition, numeric ranges, author-year matching, no self-previews, selection anchors, margin hit testing, input validation, safe links, IndexedDB offline persistence, in-flight edit preservation, and conflict retention.
- HTTP integration test against the production server in an isolated temporary database: PDF upload and byte equality; unique paper route; title/tags; custom entity types; annotated-page validation; record updates/deletes; read later; conflict detection; identical request retries; malformed payloads; cross-origin mutation rejection; PWA assets; backup and migration repeatability.
- Production build and local Docker startup/health check.

Run the checks documented in README. Integration fixtures never populate the real library. The generated three-page sample at `tests/fixtures/sample.pdf` is available for manual testing.

## Recorded run — 2026-09-10

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 14 tests passed, including a real three-page PDF fixture and IndexedDB outbox scenarios.
- `npm run build`: passed with React 19.2.8, Vinext 1.0.0-beta.9, Vite 8.0.16, and PDF.js 6.3.289.
- `CROSSREF_LIVE=1 npm run test:integration`: passed, including a live DOI lookup through Crossref and forwarded HTTPS-origin handling.
- `docker compose up -d --build --wait`: passed; container healthy and bound to `127.0.0.1:3080`.
- `GET /api/health`: returned `{"status":"ok"}` from the running container.
- `npm audit --omit=dev`: no reported production dependency vulnerabilities.
- Full development audit: four moderate findings remain in Drizzle Kit's old esbuild loader chain. The automated suggested fix would downgrade Drizzle Kit to an incompatible older version, so it was not applied. This loader is used for schema tooling, not the app's request handlers; the current Docker image also retains build dependencies. Production packages with known high advisories were updated.

No cloud deployment was performed. No reverse proxy or network configuration was changed.

## Validation still required

No browser interaction testing or physical-iPad testing has been performed. In particular, validate Apple Pencil palm interaction, custom text selection, multi-touch zoom, scrolling, and Safari standalone/offline behavior on the target iPadOS version. A successful build or API test does not prove those interactions work on a device.

WebMCP registration is feature-detected; no supported browser context was available for its contract check.

Manual acceptance sequence:

1. Upload a real two-column academic paper and open its stable URL in a second device.
2. Drag a phrase, save each annotation kind, add notes and multiple types, refresh, and follow a collection link back to the mark.
3. Add Ideas or Limitations; add paper-level tags separately and filter the library.
4. Tap linked/unlinked citations and figures; verify the popup content and unchanged main reading position.
5. Toggle Read later and inspect its source links from the library.
6. Try all four layouts and themes, zoom, and page/text navigation.
7. On iPad, verify vertical swipes over text scroll, horizontal text drags select, pen strokes persist, and the system callout does not interrupt annotation.
8. Install the production PWA over HTTPS, download a paper, reopen it offline, make edits, reconnect, and inspect sync status.
9. Edit one annotation on two devices while one is offline; verify the conflict is retained and explicitly resolved.

## Coverage limits

- Searchable, horizontally laid-out PDFs are the primary target. Scans can render and take page notes/ink, but OCR is not included. Password-protected PDFs do not have an unlock flow.
- Heuristic citation parsing is not Google Scholar's indexing system. Unsupported bibliography styles, superscript references, unusual text order, complex ligatures/rotations, or broken PDF links can fail. Only metadata actually returned by Crossref is displayed; many papers have no available abstract or PDF link there.
- Figure and table preview areas are estimates from captions/destinations, with an entire-linked-page fallback. Automatic figure segmentation is not implemented.
- Dark mode uses a display filter on PDF content, including figures, and can alter image colors. Switch to light mode to inspect original colors.
- Pen strokes are individually saved, with notes/types editable from the notebook. There is no eraser, multi-stroke grouping, lasso, native-quality palm rejection, or pressure-sensitive stroke rendering yet.
- Collections currently classify annotations. There are no custom property schemas, free-standing entities, type rename/delete UI, or relationship graph.
- JSON export and original PDF download are available. Embedding annotations into a standard PDF, Zotero round-tripping, and JSON import are not implemented.
- Paper metadata updates and uploads require connectivity. Offline annotation/type/read-later changes are supported; background sync while the PWA is closed is not guaranteed.
- Offline availability depends on browser storage and a successful explicit download. Opening a never-cached route without a connection is not supported. Use one active editing tab per browser; cross-tab live updates are not implemented.
- The library snapshot API returns the entire personal library. Large-library pagination and server-side search are future work.
- The app has one owner/library. Authentication belongs at the local reverse proxy or private-network boundary; public multi-user deployment is outside scope.
