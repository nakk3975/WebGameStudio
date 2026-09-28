# GhostDesk deployment

## Deployment status — 2026-09-28

- Public website: https://ghostdesk-p24l.onrender.com (live).
- API service: https://ghostdesk-api.onrender.com (live, connected to Neon).
- Neon production schema and published sample are applied.
- After explicit user approval, the `ghostdesk_app` password was set in the Render API environment. No database password is in the repository or browser build.
- API deploy `dep-dat2lgp42hec73f8kds0` became live at 2026-09-28 17:53:41 KST, running commit `d2db1e64650ce175a711a1685211a32ede67b722`.
- Frontend deploy runs commit `4cbd7a7dfe5b0bbfbb01226e5d48ae330baaea8a`; later commits change API configuration and documentation only.

### Live verification

| Check | Result |
| --- | --- |
| `/health/live` | 200, process healthy |
| `/health/ready` | 200, `ready`, 1 published case |
| `/api/v1/ghostdesk/catalog` | 200, sample title and version returned from Neon |
| `/api/v1/ghostdesk/versions/demo-0317-v1/package` | 200, package passes the actual frontend validator and equals the pinned sample |
| Unknown version | 404 |
| CORS from the deployed website | Exact `Access-Control-Allow-Origin` returned |
| CORS from an unconfigured origin | 403 |
| Browser reload and resume | Saved clue preserved; pause/resume and game screen work |

The read role has SELECT permission, no INSERT/UPDATE/DELETE permission, and no CREATEDB/CREATEROLE/BYPASSRLS privileges. The API's MyBatis queries filter published content. HTTP observations are recorded in `docs/evidence/deployment-2026-09-28.json`; their timings are single observations through the verification environment, not a performance benchmark. Free-plan sleep/wake testing remains separate.

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

## 다섯 사건 업데이트 / 2026-09-28

- V002를 검증 브랜치와 운영 브랜치에 순서대로 적용. 공개 사건은 5개, migration version은 2. 기존 001 패키지 및 API 권한은 변경하지 않음.
- 프런트 코드: `fc3e2dd0654c054abd871090958d87fbd577ed2f`. Render 배포: `dep-dat3lgp42hec73fc9ju0` (LIVE).
- GitHub Actions: https://github.com/nakk3975/WebGameStudio/actions/runs/36407043046 성공.
- API 재배포 없이 새 사건 4개 조회 가능. 네 패키지는 번들 원본과 일치하며 웹은 서버가 늦어도 내장된 다섯 사건을 바로 제공.
- 실제 운영에서 기존 001 진행 보존 및 002의 별도 저장·재로딩 확인. 세부 검사와 실기기 Safari 미검증 범위는 VERIFICATION.md 참고.
