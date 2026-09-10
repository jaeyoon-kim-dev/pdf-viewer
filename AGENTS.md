# Paperthread project instructions

- The user chose local Linux/Docker hosting. Do not publish this app or move data to cloud services unless explicitly requested. The unused Sites registration is not a deployment target.
- Preserve stable paper and annotation IDs. Paper tags and annotation collection types are separate concepts. Users can create new collection types; do not hard-code all collections around only questions and phrases.
- Text annotation should remain available without switching annotation modes. The pen toggle controls handwriting; view/layout settings are independent.
- Keep README, requirements, architecture, deployment, validation, and change log consistent with behavior. State PDF extraction and real-device validation limits accurately.
- Commit meaningful completed changes. Keep personal PDFs, SQLite files, backups, environment secrets, and generated PDF.js assets out of Git.
- SQLite migrations are generated in `drizzle/` and applied by `scripts/migrate.mjs`. Never edit an already-applied migration; append one.
- Run relevant checks: typecheck, lint, unit tests, build, and HTTP integration tests for storage/API changes. Integration tests use temporary data; never seed the user's real library with fixtures.
- Local startup and backup instructions are in `docs/DEPLOYMENT.md`. iPad PWA installation requires HTTPS to the server, supplied by the user's private proxy/VPN.
