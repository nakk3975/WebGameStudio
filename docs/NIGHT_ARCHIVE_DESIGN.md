# GhostDesk: night archive presentation

The main screen and investigation desktop now share a restrained horror / mystery atmosphere: charcoal, muted olive, aged brass, warm paper, and a small rust accent. The archive has folder tabs and a quiet, unoccupied office backdrop. The selected case title uses a local serif fallback, without external font requests.

The presentation lives in `apps/ghostdesk/src/atmosphere.css`, loaded after the existing layout stylesheet. `App.tsx` adds a semantic selected-case section and a view attribute. Existing responsive layouts, touch targets, keyboard focus outlines and reduced-motion preferences remain available. There are no new animations, flashes, automatic audio, or autoplay media.

## Scope and compatibility

- No changes to case packages, passwords, filenames, engine state, save formats, persistence, or progression.
- The generated archive room is a decorative CSS background, not an evidence file or a claim about any of the five stories.
- Evidence photo/video assets and puzzle signal colours are unchanged. No new visual filter is applied to evidence.
- Documents retain a light reading surface; system logs and chat remain visually distinct.
- The new 1536 × 1024 WebP is approximately 62 KB and is fingerprinted by Vite.

## Asset provenance

Asset: `apps/ghostdesk/src/assets/archive-night.webp`.
Generated with the built-in image generation tool, then encoded as WebP for the app.

Prompt:

> Use case: stylized-concept. Asset type: decorative background for GhostDesk, a Korean browser detective mystery game. This is atmosphere only, not evidence or a new story location. Create one cinematic photorealistic wide landscape image, 1536x1024, of an unoccupied archive office late at night. A battered desk on the right side with an ordinary old CRT monitor, keyboard, closed manila folders, and a small brass desk lamp, distant filing cabinets fading into shadow. Restrained psychological mystery, quiet unease, tasteful and believable, not extreme horror. The small warm lamp grazes folder edges; a very faint desaturated green glow comes from the mostly blank CRT screen. Dark charcoal, muted olive gray and aged amber palette. Fine natural film grain, physical dust and patina, subtle light haze, elegant composition. The left half and upper edge should be dark negative space fading almost to black, usable behind interface copy. No readable text anywhere, no symbols, no digits, no people, no silhouettes, no ghosts, no eyes, no blood, no gore, no supernatural objects, no police tape, no jump scares, no elaborate distorted computer hardware, no game UI, no logos, no watermark. Do not add evidence-like details or narrative clues.

## Verification

`npm run typecheck`, `npm test` (256 tests across 16 files), and `npm run build` passed during implementation. Browser checks are recorded separately after deployment; unit tests do not establish appearance or production behavior.
