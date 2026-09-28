# GhostDesk deployment

## Deployment status — 2026-09-28

- Public website: https://ghostdesk-p24l.onrender.com (live; bundled case is playable).
- API service: https://ghostdesk-api.onrender.com (created).
- Neon project and production schema/sample are applied.
- **DB connection remains blocked:** automatic approval review rejected sending the newly generated read-only database password to Render. `DB_PASSWORD` has not been configured. Explicit approval for this transfer is needed before database-backed API verification can complete. No password is in this repository.
- API liveness can start with a missing password; DB readiness remains unavailable until credentials are configured. This is not a successful DB connection.

## Components

- Public repository: https://github.com/nakk3975/WebGameStudio
- React static frontend: Render Static Site; Node 24.19.0.
- Public read API: Render Free Docker Web Service, Singapore, Java 21.
- Database: Neon Free, `WebGameStudio-GhostDesk`, PostgreSQL 18, Singapore.
- Production branch: `production`; database `ghostdesk`; schema `ghostdesk`.
- Initial migration verification branch: `verify-initial-catalog`.

## Configuration

Only the API receives `DB_PASSWORD`, `DB_USERNAME=ghostdesk_app`, and a `JDBC_DATABASE_URL` using the pooled Neon host. JDBC uses TLS `verify-full` and `/etc/ssl/certs/ca-certificates.crt`. The password is a separate environment variable, never embedded in a URL or committed.

The app role is an ordinary SQL login: no database/role creation, no RLS bypass, no Neon superuser membership. It receives only CONNECT, schema USAGE, and SELECT on the case table. Transactions default to read-only with a 10 second statement timeout. MyBatis binds version IDs as parameters. API query paths always filter `published = true`.

`ALLOWED_ORIGINS` is the exact frontend origin. `VITE_API_BASE_URL` is the public API origin only. CORS allows GET/HEAD/OPTIONS without credentials; no API mutation routes exist in this release.

## Database changes

`db/migrations/V001__public_catalog.sql` creates the schema, constraints, index, migration ledger and pinned sample. Run its statements in a single transaction on a new verification branch, check the result, then apply the same SQL to the new production database. This migration runs once and intentionally fails if run again. The application does not execute DDL on startup. Future changes require a new numbered migration; never edit an already published case version in place.

## Deploy and verify

`render.yaml` records the two-service configuration. Services are created directly; do not apply a second Blueprint to duplicate them. Automatic deployment is disabled; after verifying a commit, trigger each changed service manually.

1. `npm ci && npm run typecheck && npm test && npm run build`
2. Java 21: `mvn -s apps/api/maven-settings.xml -f apps/api/pom.xml verify`
3. Deploy API and static site from the public repository's `main` branch.
4. Check `/health/live`, `/health/ready`, `/api/v1/ghostdesk/catalog` and the sample package endpoint.
5. Check allowed frontend CORS, unknown version 404, then play the deployed page.

Render liveness uses `/health/live` and does not touch the database. Do not schedule DB pings. Hikari keeps zero idle connections and at most three connections. Free-plan cold starts can delay API responses; the UI uses the bundled case immediately and abandons a remote read after 12 seconds. Active games keep their original case snapshot.

## Scope

This deployment serves a public sample catalog. Personal progress, notes, and editor drafts stay in IndexedDB on the user's device. GitHub OAuth, cloud saves, draft ownership, creator publishing and invitations are not implemented. JSON export remains the available backup. There is no production monitoring or recovery drill yet.
