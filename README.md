# Paperthread

A personal PDF library with stable paper URLs, linked annotations, citation previews, and extensible collections for phrases, questions, ideas, and future reading.

Implementation is in progress. Requirements and assumptions are tracked in [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md). Setup, architecture, validation, and limitations are maintained alongside the implementation.

## Development

Requires Node 22.13 or newer.

```sh
npm ci
npm run dev
```

The scaffold uses React, Vinext, PDF.js, Cloudflare D1 for records, and R2 for PDF bytes. Local bindings use project-local Wrangler storage. Production access must remain private for this single-owner app.
