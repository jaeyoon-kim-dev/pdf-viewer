# Paperthread

A self-hosted PDF reading library for desktop and iPad. Upload a paper once, give it tags, and keep annotations and collected thoughts linked to its exact pages.

## Run with Docker

```sh
docker compose up -d --build
```

Open **http://localhost:3080** on the server. The default port mapping is loopback-only. The named `paperthread-data` volume contains both SQLite and the original PDFs and survives container replacement.

For iPad access, put the app behind HTTPS on your local network or private VPN. Follow [Deployment](docs/DEPLOYMENT.md) for Caddy, access control, backups, and restoration. No Cloudflare account or cloud storage is needed.

## Features

- Upload searchable PDFs up to 40 MB; permanent `/papers/<uuid>` URLs, page links, and annotation links.
- Paper titles and tags, library search, tag filtering.
- Continuous vertical, continuous horizontal, single-page, and two-page layouts; zoom, text search, light/dark/sepia themes.
- Drag text to highlight, underline, or create a memo. Pen toggle enables handwriting. Every annotation supports a note and any number of collection types.
- Built-in Phrases and Questions, plus user-created types such as Ideas and Limitations. Questions can be marked resolved.
- In-place previews for recognized citations and figures/tables. Citation information is looked up through Crossref, with possible matches explicitly labeled.
- Read-later switch inside reference previews. The reading list groups matched works and retains source backlinks.
- Installable PWA; explicit offline paper download; local annotation outbox and conflict resolution on reconnection.
- JSON export of library records, including stable IDs, source anchors, tags, types, and ink coordinates.

This is an initial implementation, not full Google Scholar or Zotero feature parity. See [Limitations and validation](docs/VALIDATION.md), especially real-iPad testing and PDF extraction coverage.

## Development

Requires Node **22.13+** (tested on 22.22.2) and npm.

```sh
npm ci
npm run dev
```

Development applies pending SQLite migrations and copies the installed PDF.js worker, fonts, character maps, and WASM files. Data lives in `./data` unless `DATA_DIR` is set. The service worker registers only in production to avoid caching development modules.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:integration
# Optional: also test live Crossref metadata
CROSSREF_LIVE=1 npm run test:integration
npm start
```

`npm start` serves the production build on port 3000. Set `PORT` to change it. For direct Node use on an untrusted network, add access control at the reverse proxy. The app is designed for a single private owner and does not have public registration or multi-user authorization.

## Documentation

- [Requirements and decisions](docs/REQUIREMENTS.md)
- [Architecture and PKM integration](docs/ARCHITECTURE.md)
- [Deployment, HTTPS, and backups](docs/DEPLOYMENT.md)
- [Validation and known limitations](docs/VALIDATION.md)
- [Change log](CHANGELOG.md)

Reader controls: Fit width, Fit page, Actual size, and custom zoom from 25–400%. Use Cmd/Ctrl + or − to zoom the PDF, and Cmd/Ctrl+0 for actual size. The compact toolbar and annotation sidebar follow a Zotero-inspired reading layout; reference previews and annotation editors are anchored, non-modal popovers without background blur.

The always-visible annotation bar provides Memo, Question, Handwriting, and an Annotations count. Drag text to open highlight/underline controls; scanned pages without selectable text show a notice.

Text selection opens a compact toolbar next to the drag endpoint. Highlight and Underline save immediately; Note, Phrase and Question expand the editor. The blue selection remains visible while the draft is open. To place a sticky memo, click Memo, then click/tap a page position; save the note and click its pin to reopen. Escape cancels placement. Delete is available in the notebook and editor. Cmd/Ctrl+Z undoes saved annotation changes, and Cmd/Ctrl+Shift+Z redoes them; text fields retain native undo. History holds the last 100 actions in the current tab session and is cleared by a full reload/navigation.

Citation cards follow the Scholar reference-card structure: reference label, linked title, authors/publication/year, expandable abstract, compact Read later and Cite actions, PDF/article links, and an in-card original bibliography entry. Cite offers original text and generated BibTeX. Search Scholar opens a real search in a new tab; no Scholar citation counts or version lists are simulated.
