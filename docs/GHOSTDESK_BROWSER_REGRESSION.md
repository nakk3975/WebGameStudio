# GhostDesk v6 browser regression

Baseline: main `9a4a71909fc786e26e600e0d6c74ccf5de4b5212` (2026-10-01).

## Reproduce

Node 24, npm and Chromium are required. From the repository root:

```sh
npm ci
npm run test:e2e:install
npm run test:e2e
```

`playwright.config.ts` builds the production bundle, starts a fresh Vite preview on
127.0.0.1:4187 with `--strictPort`, and shuts it down after the suite. It never
reuses a dev server. API and auth URLs are deliberately empty: this is local guest
mode using the bundled official versions. Each case has a fresh browser context;
only its real UI-created save persists across its reload. Retries are disabled.
The `browser` CI job runs the same command and uploads results for 14 days.

Optional installed Chromium override:

```sh
GHOSTDESK_CHROMIUM_PATH=/absolute/path/to/chromium npm run test:e2e
```

Inspect `playwright-report/index.html` or run `npx playwright show-report`.
`test-results/results.json` records per-case status/duration. Every successful case
attaches its ending screenshot and actual downloaded completed save. Failures
retain screenshot, trace and video. Traces can be opened with
`npx playwright show-trace path/to/trace.zip`.

## What the suite asserts

All five v6 cases (03:17, 404호, 경매, 앙코르, 월요일) start from the home screen
and complete all ten folders, the final 해결 승인, the correct ending text, and
return to the home screen showing 조사 완료.

- The initial memo opens by click and includes the first password rule.
- Every walkthrough rule source and supporting file opens through the visible
  desktop or parent folder. Static official walkthrough answers are filled into
  the actual password field; no answer is derived from `puzzle.answer`.
- Every stage rejects a wrong answer and a truncated answer without unlocking.
  For a one-character answer, truncation is empty and submit must be disabled.
- Future folder shortcuts are disabled. Correct input unlocks the current folder
  and automatically opens only the next folder; previous unlocks stay recorded.
- Initial scene photos decode; reachable attached photos open in separate windows
  and their zoom control changes state. Videos play/pause; attached video frame
  controls can seek forward and enable backward stepping. Video windows are
  placed behind the memo; the first play click must focus and play the video. The four cases that supply videos must have a
  video checked (03:17 supplies photos and documents, no video); the suite is not a check of every pixel or every media frame.
- With memo and photo windows arranged side by side, the first click on the rear
  memo window's maximize control both focuses and maximizes it. A first click
  on the rear photo's zoom button must focus it and zoom on the same click.
- At 5/10, a real page reload returns home. 이어서 조사 restores the PAUSED overlay
  and all five unlocked folders. 조사 계속하기 closes the overlay and permits the
  remaining five stages to be solved. This tests local persistence, not account sync.
- The downloaded final save uses `ghostdesk-save-1`, contains the unchanged
  official case package, all ten solved puzzle IDs, ENDED mode and the correct
  ending ID. No page errors are allowed.

The only page evaluation reads image decode properties. There are no engine
imports/calls, storage writes from tests, React handler calls, API mocks,
forced clicks, direct media-time writes, or injected future files/state. Materials
are closed with their real close buttons to respect the 12-window limit.

## Compatibility and boundaries

Product code, the 24 published packages, save schema, password strings and engine
versions are unchanged. Existing Vitest compatibility/storage tests remain the
compatibility check for older published editions; the browser suite targets v6.
The evidence audit's 158-file/50-puzzle automated checks remain a separate claim.

Still **unverified**:

- New users' perceived difficulty, reasoning quality and unassisted completion.
- Signed-in account save upload/download, cross-device round trips and conflicts.
- Five-case completion on the deployed production service/API.
- Mobile, other browsers, exhaustive visual fidelity and every media frame.

Passing this local browser suite must not mark any of these as completed.

## Recorded local run — 2026-10-01

All five cases passed with retries disabled; see
[evidence/v6-browser-regression-20261001.json](evidence/v6-browser-regression-20261001.json).
Playwright 1.63.0, Node 24.19.0, Chromium 153.0.8010.0, 1600×1000, two workers.
The environment's browser CDN download returned invalid ZIPs, so this run used
the installed Chromium executable override; normal CI uses Playwright's browser
installation command. No project dependency was added for the fallback binary.
Typecheck (including Playwright config), 19 Vitest files / 299 tests, and production
build also passed. CI execution after publication is still pending.
