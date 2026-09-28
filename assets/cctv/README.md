# 404 CCTV scene reconstruction

The current `scripts/build-cctv.sh` uses complete photographic frames in
`apps/ghostdesk/src/assets/hotel.webp`, `hotel-frame-middle.webp` and
`hotel-frame-exit.webp`. It creates A/B/C/A/B/C/A, holding each for four seconds.
The 28-second silent H.264 MP4 is explicitly a scene-by-scene reconstruction,
not continuously photographed or AI-generated motion footage. Playback does
not loop the 28-second container; the source repetition occurs inside it.

This replaces the rejected separately translated/scaled trolley layer. No
cutout movement, interpolation, synthesized shadow or claim of natural motion
remains. The old `hotel-empty.webp` and `hotel-cart.webp` here are retained only
as provenance of the superseded experiment and are not shipped by Vite.

Generation prompts are in `assets/MEDIA_PROMPTS.md`. Observation times and
sampled scene indices are shared in `apps/ghostdesk/src/cctv.ts`.
