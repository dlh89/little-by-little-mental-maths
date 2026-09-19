# Little by little

A private, phone-friendly mental-maths trainer. Plain JavaScript in the browser, Node.js on the server, SQLite for durable progress. No framework, build step, external services, or npm dependencies.

## Run locally

Use **Node.js 24 LTS** for deployment. The app also runs on Node 22.13+; `node:sqlite` can print an experimental warning on these versions. It uses Node's built-in SQLite API: https://nodejs.org/api/sqlite.html

```sh
npm run password
npm start
```

Open http://127.0.0.1:8765 and sign in. No default account password is shipped. Set the username and password with `npm run password`; this also revokes existing sessions. Usernames are case-insensitive. Existing password-only databases migrate to username `admin`, preserving the password and all progress; run the same command to change it. This remains a single-user app, without registration. For custom settings, copy `.env.example` to `.env`. `APP_ORIGIN` must exactly match the URL in your browser, without a trailing slash. The data directory defaults to `./data`.

```sh
npm test
```

## Practice

- Thirty-two question types: ÷3, ÷5, ×25, ÷1.5, ÷1.2, ÷4, ×5, ÷8, ×1.5, ×1.2, ÷25, ×15, ×125; plus finding 5%, 15%, 12.5%, 20%, 25%, 10% and 50%. Additional skills: ÷6, ×9, ×11, ÷0.5, ÷0.25, finding 75%, and increasing/decreasing by 10%, 20% and 25%. Percentage changes ask for the final total, not just the percentage amount.
- Percentage wording has its own review history and difficulty progression, even where the calculation matches a division skill. Tips explain these connections. Existing progress is preserved when new skills are added.
- Reveal and self-rate, or turn on typed answers (incorrect typed answers can only be rated “Missed it”).
- Daily reviews finish when nothing is due, or after ten questions plus any outstanding retries. Choose free practice to continue or focus on a skill.
- Friendly numbers, larger numbers, decimals. Three comfortable reviews on distinct UTC days unlock the next band, available the next day. Older bands remain in review. A miss or slow answer resets the comfortable-day count, but does not remove unlocked levels.
- Comfortable: 1, 3, 7, 14, 30, then 60 days. Slow: tomorrow. Missed: a new example from the same skill and level after two intervening answers (or five minutes, whichever comes first). If nothing else is due, or the ten-question round is ending, retry immediately. Unresolved retries persist in server history, including across reloads. A successful same-day retry moves the review to tomorrow without advancing mastery. Same-day drilling cannot advance the interval sequence. This is a transparent heuristic, **not FSRS or a validated optimal scheduler**.
- Choose all skills, division only, multiplication only, percentages only, one skill, or any custom mix. Selection applies to daily reviews, free practice and retries. Excluded skills keep their saved progress and unresolved retries. Your selection stays on this device; new skills automatically join category presets, while custom mixes remain exactly as chosen.
- Review dates and learning progress sync through the server. Session position and input preference are device-local.

## Data safety

Every rating is first queued locally, then sent to the server. The server commits the review and schedule in one SQLite transaction. Retries use the question ID, so a lost response cannot duplicate the review. The next question waits for the save to succeed. If connectivity fails, retry or reopen the same browser later; an unsent answer remains queued. This is recovery for a dropped connection, **not a fully offline question bank**.

SQLite is the authoritative copy; clearing the browser does not remove saved progress. An unsent answer is still vulnerable if local browser data is cleared before it syncs. If browser storage is blocked, the page warns you and unsent data is kept only in memory.

The progress screen downloads JSON history for portability/inspection. It is not an automatic backup and there is no JSON import UI. Use SQLite snapshots for complete recovery, as described below. The database contains the password hash and session tokens (hashed), so treat backups as private.

## Deploy to the droplet

Deployment templates are supplied, **not installed**. Check the droplet's current reverse proxy and Docker availability first. Do not overwrite existing WordPress or other site configurations.

The Docker option isolates the Node version from existing sites. Choose a dedicated subdomain and set its DNS. Clone your Git repo into a directory such as `/opt/mental-maths`. Create `.env` there:

```dotenv
APP_ORIGIN=https://maths.yourdomain.com
```

Prepare a new data directory for the container's unprivileged user, then build:

```sh
mkdir -p data
sudo chown 1000:1000 data
docker compose up -d --build
docker compose exec -it app npm run password
```

Only localhost port 8765 is exposed. Configure your existing reverse proxy to forward the new HTTPS subdomain to `http://127.0.0.1:8765`. `deploy/nginx.conf.example` is a separate vhost example; replace the domain and certificate paths. If your existing proxy is Apache, adapt the proxy configuration instead. Obtain the certificate using your existing certificate workflow, validate the proxy config, then reload it.

For direct Node hosting instead of Docker, use a dedicated service user, Node 24, `NODE_ENV=production`, `APP_ORIGIN=https://...`, and an absolute `DATA_DIR` outside the checkout. Run `node server.js` under your existing process manager or systemd and proxy it in the same way. The included backup shell script targets the Docker installation; use `npm run backup` in a direct Node installation.

Security: scrypt password hashing with random salt; persistent HTTP-only, SameSite=Strict cookies; Secure host-only cookies in production; 30-day sessions; request origin and custom-header checks; a single-account login throttle; restricted static routes; bound SQL parameters; CSP; and no public registration. Password recovery is an SSH-side reset, not an email flow. Run one application instance against the local SQLite database.

## Backups and restore

Create a consistent live snapshot (do not merely copy the live WAL database):

```sh
npm run backup
# Or, with Docker:
docker compose exec -T app node scripts/admin.js backup
```

Backups default to `data/backups/`. Copies on the same droplet do **not** protect against loss of the droplet.

For daily off-site backups, `deploy/backup.sh` snapshots the database and sends it to an encrypted restic repository on another host or object storage. Install/configure restic separately, initialize that repository, and keep its recovery password somewhere outside the droplet. Create `/etc/mental-maths-backup.env` (root-readable only) with:

```dotenv
APP_DIR=/opt/mental-maths
RESTIC_REPOSITORY=sftp:backup-host:/path/to/repository
RESTIC_PASSWORD_FILE=/etc/mental-maths-restic-password
```

Use your actual repository and credentials; the example is not a configured destination. For S3 storage, add the required restic/AWS environment variables. After verifying a manual run, install the provided service/timer in `/etc/systemd/system`, adjust `ExecStart` if the checkout is elsewhere, reload systemd, and enable `mental-maths-backup.timer`. Check failed services/logs or connect it to your existing alerting. No retention deletion is enabled initially; monitor storage and add a retention policy after testing recovery.

**Restore:** stop the application, retrieve a snapshot, and keep a copy of the existing data directory. Restore the snapshot as `maths.sqlite3` into a **new empty directory** (do not combine it with old `-wal`/`-shm` files). Set directory ownership to the service user, point the app at that directory or replace the stopped app's data directory, and reset the password to invalidate sessions present in the snapshot. Restart and verify the progress screen. The automated test suite checks that a snapshot can be reopened with history intact and passes SQLite integrity checking.

## Repository layout

- `server.js`: HTTP routes, authentication/session plumbing.
- `auth.js`: password hashing and reset.
- `db.js`: schema, atomic/idempotent review writes.
- `engine.js`: question generation and scheduling.
- `static/`: vanilla HTML/CSS/JS interface.
- `scripts/admin.js`: password setup/reset and consistent backups.
- `tests/`: arithmetic, scheduling, API/authentication and backup recovery tests.
- `deploy/`, `Dockerfile`, `compose.yaml`: optional droplet deployment.

The `.gitignore` excludes secrets, databases, backups and dependencies. Commit the source, never `.env` or `data/`.
