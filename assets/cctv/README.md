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

## Corridor path correction — 2026-09-29

The middle and final frames were replaced after the final trolley appeared to
travel through the right-hand construction partition. The trolley now approaches
along the grey corridor floor, staying within the black floor borders. The final
frame keeps the trolley and its visible wheel contacts in view near the lower
middle of the picture. `hotel-frame-exit.webp` retains its asset filename but no
longer depicts a right-edge exit. The camera stays fixed and A/B/C timing is
unchanged; captions and accessible scene descriptions match the new position.
