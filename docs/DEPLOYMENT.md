# Local deployment

## Docker

```sh
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 paperthread
```

The app is available at `http://localhost:3080` on the server. The container runs as the unprivileged `node` user, has a health check, and persists `/app/data` in a Docker named volume.

Set `PAPERTHREAD_PORT` in the shell or a local `.env` to change the host port. The default mapping intentionally binds to `127.0.0.1`; other computers cannot connect directly until you configure a reverse proxy or private tunnel.

Updates:

```sh
git pull
docker compose up -d --build
```

Migrations run before the server starts. Back up before updating. Keep applied files in `drizzle/` unchanged; add a migration for schema changes.

## Access on this server

The running instance is reachable at `http://100.111.111.100:3080` from devices connected to the same Tailscale network. The local `.env` sets `PAPERTHREAD_BIND_HOST` to this server's Tailscale IP. The public network interface is not bound. This deployment can be reached by tailnet members allowed by the network ACL; the app itself has one shared library.

Tailscale Serve is currently disabled for this tailnet, so HTTPS provisioning has not completed. Once enabled in the Tailscale account, run:

```sh
tailscale serve --bg --https=8443 http://127.0.0.1:3080
```

Before that command, restore `PAPERTHREAD_BIND_HOST=127.0.0.1` in `.env`, retain `VINEXT_TRUSTED_HOSTS=mini.tail0293c.ts.net:8443`, and run `docker compose up -d --wait`. The intended HTTPS URL is `https://mini.tail0293c.ts.net:8443`. Do not treat it as live until verified. Plain HTTP supports online reading but does not enable the installed/offline PWA on an iPad.

## iPad and HTTPS

Service workers and offline PWA capabilities require a secure origin. `http://localhost` works on the same machine, but plain HTTP to the Linux server's LAN IP does not qualify on an iPad.

Use your existing HTTPS reverse proxy or private VPN HTTPS endpoint. A host-installed Caddy example for a domain resolving to this server:

```caddyfile
papers.example.com {
    basic_auth {
        reader REPLACE_WITH_CADDY_PASSWORD_HASH
    }
    reverse_proxy 127.0.0.1:3080
}
```

Set `VINEXT_TRUSTED_HOSTS=papers.example.com` in a local `.env` and restart the container (`docker compose up -d`). This allows the server to recognize forwarded HTTPS and validate same-origin writes. For another private proxy, set its exact hostname. Do not enable proxy trust while exposing the raw Node port to untrusted clients.

Generate the password hash interactively with `caddy hash-password`. Substitute your own domain and hash. Automatic public certificates require domain/DNS and challenge reachability configured for your network. For a purely local hostname, use Caddy's `tls internal` and install/trust its root certificate on the iPad; do not dismiss an untrusted-certificate warning as a substitute for trust setup.

If Caddy runs in Docker, connect it to the app's Docker network and proxy to `paperthread:3000`; loopback inside the Caddy container does not refer to the Linux host.

The application has one shared library and no built-in accounts. Put authentication at the proxy or restrict access through your private VPN. Do not expose the raw Node port publicly. The reverse proxy should preserve `Host` and the original HTTPS scheme so same-origin mutation checks see the correct origin.

On iPad, open the HTTPS site in Safari, use Share → Add to Home Screen, then open a PDF and press Download for offline use. Keep the app open until it confirms completion. Downloaded PDFs and queued changes are stored on that device; browser storage clearing removes them. Keep server backups as well.

No reverse proxy, DNS entry, certificate, or firewall rule is installed automatically by this repository.

## Without Docker

```sh
npm ci
npm run build
npm run db:migrate
npm start
```

The default data directory is `./data` and the default port is 3000. Export `DATA_DIR` and `PORT` before running migrations and starting the server to override them. This ensures migrations and the server use the same database. Use Node 22.13+ and a process supervisor for long-lived operation.

## Backup

Docker backup to a directory inside the persistent volume, then copy it to the host:

```sh
docker compose exec paperthread node scripts/backup.mjs /app/data/backup-export
docker compose cp paperthread:/app/data/backup-export ./paperthread-backup
```

Use a fresh destination each time; SQLite refuses to overwrite an existing backup database. Copy the resulting directory to independent storage and remove the temporary backup directory from the volume when no longer needed.

Without Docker:

```sh
npm run backup -- ./backups/2026-09-10
```

The script creates a consistent SQLite snapshot with `VACUUM INTO` and copies the immutable original PDFs. The folder contains `paperthread.sqlite` and `pdfs/`. It does not include unsynchronized browser-only edits; export them from Sync status before resetting a device.

## Restore

Stop the app. Restore the backup's `paperthread.sqlite` and `pdfs/` into a **new empty** data directory/volume. Ensure the container's `node` user can write it. Do not mix restored data with a previous database's `-wal` or `-shm` files. Point the app at the restored volume and start it; migrations check the recorded schema.

Before using a restored snapshot, preserve pending edits on devices. A database restore can rewind revisions; a browser with pending changes should not silently synchronize against a different history. Export those local edits and clear the old site data before using the restored library.

## Costs and external connections

There are no app hosting fees or Cloudflare dependencies when run on your server. You supply disk, compute, power, and any domain/VPN costs. PDF rendering and extraction happen on the reading device. The optional citation-information lookup calls Crossref on the internet and sends the selected reference text. The library remains readable when that lookup is unavailable.

Reading positions are included in SQLite backups. Startup applies migration 0002 for the reading_positions table automatically. Tooltip preferences remain browser-local and are not included in database backups. This build packages the PDF.js legacy worker alongside the legacy library for Safari 18+ compatibility.
