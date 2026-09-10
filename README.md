# Paperthread

A self-hosted PDF reading library for desktop and iPad. Upload a paper once, give it tags, and keep annotations and collected thoughts linked to its exact pages.

## Run with Docker

```sh
docker compose up -d --build
```

Open **http://localhost:3080** on the server. The default port mapping is loopback-only. The named `paperthread-data` volume contains both SQLite and the original PDFs and survives container replacement.

For iPad access, put the app behind HTTPS on your local network or private VPN. Follow [Deployment](docs/DEPLOYMENT.md) for Caddy, access control, backups, and restoration. No Cloudflare account or cloud storage is needed.

## Features

- Upload searchable PDFs up to 40 MB; permanent `/papers/<uuid>` URLs and database-backed last reading positions. In-app collection links jump to their source.
- Paper titles and tags, library search, tag filtering.
- Continuous vertical, continuous horizontal, single-page, and two-page layouts; zoom, text search, light/dark/sepia themes.
- Click a word or drag text to highlight, underline, or create a memo. Desktop dragging uses the PDF.js text layer; completed selections snap to whole words. iPad uses measured text bounds with custom selection feedback. Pen toggle enables handwriting. Every annotation supports a note and any number of collection types.
- Built-in Phrases and Questions, plus user-created types such as Ideas and Limitations. Questions can be marked resolved.
- In-place previews for recognized citations and figures/tables. Citation information is looked up through Crossref, with possible matches explicitly labeled.
- Save/unsave toggle for Read later inside reference previews. The reading list groups matched works and retains source backlinks.
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

Text selection opens a compact toolbar next to the drag endpoint. Choose a color and Highlight/Underline/Note button, optionally select Question/Phrase below, then Save. More options opens the full editor. The blue selection remains visible while the draft is open. To place a sticky memo, click Memo, then click/tap a page position; save the note and click its pin to reopen. Escape cancels placement. Delete is available in the notebook and editor. Cmd/Ctrl+Z undoes saved annotation changes, and Cmd/Ctrl+Shift+Z redoes them; text fields retain native undo. History holds the last 100 actions in the current tab session and is cleared by a full reload/navigation.

Citation cards follow the Scholar reference-card structure: reference label, linked title, authors/publication/year, expandable abstract, compact Read later and Cite actions, PDF/article links, and an in-card original bibliography entry. Cite offers original text and generated BibTeX. Search Scholar opens a real search in a new tab; no Scholar citation counts or version lists are simulated.

Previews reserve loading space and do not reset expanded content when Read later or sync updates occur. Citation detection excludes standalone margin page numbers and page/section navigation; generic internal PDF links are no longer converted into citation previews.

The top toolbar includes a Continuous/Page toggle and a button for the hideable left Contents/Pages sidebar. Contents uses the PDF’s embedded outline; Pages shows clickable thumbnails. Fit page fills the reading height (including with mixed-size pages); wide pages can scroll horizontally. Fit width remains width-constrained.

Drag-select PDF text and press Cmd/Ctrl+C to copy it, or use Copy in the selection tooltip. Input fields retain normal copying. The Pages sidebar overlays saved highlights, underlines, ink and positioned sticky memos, with a per-page annotation count; changes and undo/redo update the thumbnails live.

Hold Cmd (Mac) or Ctrl and scroll over the PDF to zoom around the pointer. Scroll up zooms in; scroll down zooms out. Ordinary scrolling stays unchanged. Wheel zoom switches to custom zoom within 25–400%.

Reader panels and popovers use compact spacing: annotations are separated rows, controls remain visible, and touch devices keep larger action targets.

Annotation tooltips remember color, style and Question/Phrase choices in browser local storage. Quoted source text retains a left quote bar separate from your notes. Citation cards use grouped navigation, a fading abstract and rounded access buttons.

Safari 18+ is the compatibility target using PDF.js’s legacy build and explicit text stream reads (including Safari 26.0.1); real Safari/iPad verification remains outstanding. Offline PWA features on the private server need HTTPS.

Highlights blend with page text to preserve contrast, including thumbnail previews; dark pages use screen blending.

Question-tagged annotations show a Q marker on the PDF and page thumbnails; click the page marker to open the question. Selection remains word-based.


The compact annotation tooltip saves when you click a color. Choose Highlight/Underline/Note and Question/Phrase first; notes remain optional. More options opens the full editor for existing annotations and custom collection types.

Browser regression tests run against a temporary library using Playwright. See [Validation](docs/VALIDATION.md) for the Docker command and device limitations.
