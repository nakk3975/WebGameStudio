# CCTV and instrument recordings

## Current continuous edition (2026-09-29)

The player now uses **full 3D scene renders**, not the previous A/B/C photographic
slideshow. `scripts/render-recordings.py` builds all geometry, materials, fixed
cameras and lights in Blender 4.3 (Cycles CPU). Each moving-cart frame is a fresh
render of the corridor and trolley together. There are no image planes, moving
cutouts, optical-flow interpolation or independently painted shadows. These are
stylized CG reconstructions, **not filmed footage or generative-video output**.
The hotel scene includes a fictional white-clothed person pushing the trolley.
This is authored game content, not a reconstruction of a real person. The in-world
viewer calls it the front desk recording; the matching still is a decoded frame
from that same video, not a separate generated photograph.

| Asset | Duration | Observation | Existing answer |
| --- | ---: | --- | --- |
| `hotel-motion.mp4` | 28 s | Continuous cart movement repeats after 12 s | `12` |
| `auction-monitor.mp4` | 11 s | Connection lamp off at 2 s; OPEN changes to CLOSED at 9 s | `7` |
| `stage-cues.mp4` | 14 s | Amber, blue, white, red fades; cancelled green never appears | `2413` |
| `island-receiver.mp4` | 11 s | Three short, three long, three short pulses | `SOS` |

All four are silent H.264 Main / yuv420p, 960×540, 24 fps, fast-start MP4s.
They use native inline playback with no autoplay. A half-speed control supports
observation; captions and optional text descriptions provide equivalent access.
The stage record explicitly compresses waiting intervals; its length must never
be used as actual performance duration or evidence of a person's location.
Auction bid name/value stay MOTH/310 after CLOSED, preserving the stale-display
story. The receiver is visibly connected to its separate battery.

### Cart geometry and repeated source record

The cart is a rigid 3D chassis with constant unit scale and zero pitch/roll/yaw.
Its wheel radius is 0.105 m. Wheels roll by distance/radius about the fixed axle.
The path has no sideways drift: x=-0.35 m; y decreases from 9.3 m at 1.2 m/s.
The person walks behind the trolley, with both hands attached to the rear push
bar. Planted feet compensate for forward travel. Both person and trolley leave
the bottom of the camera view before the next cycle; neither reverses direction.
Four wheel contact points remain at z=0 inside the walkable floor for all 288
source frames, including the extension below the camera. Lighting, occlusion,
contact shadows and perspective come from the same scene. The camera is fixed.

The cold night lighting has one unlit fixture and a dim blue window, without
animated flicker. Every number plaque is attached to its actual door leaf:
401/403/405/407 on the left and 402/404/406/408 on the right. Door 404 is ajar by
12 degrees at a real opening into a dark room. The yellow construction covering
occupies a wall repair bay between 404 and 406 and overlaps no doorway. The
separate B204 laundry is not depicted as a fourth-floor room.

`motion-geometry.json` records all 1,152 wheel contacts, monotonic travel, exit
before repeat, open-door angle, plaque attachment and cover/door separation.
**The cut back to the initial scene at 12 and 24 seconds remains intentional
evidence of the monitor's repeated source record.** It is not a return trip or
reverse playback. The 28-second container plays once; repetition is in the record.

The 0/4/8-second WebP references are lossless captures of decoded H.264 frames.
The separate corridor photo and date puzzle use the same 0-second image. The
verification script checks exact decoded RGB equality at each of these moments,
as well as exact 12-second repetition across all 672 video frames.

`recording-timing.ts` compares captured native-video times at 24 fps, allowing
one frame of capture timing tolerance. Arbitrary positions inside the old
four-second bins no longer match. A 24-second separation still returns `24`,
which the unchanged answer `12` rejects as not the first repeat. The comparison
board captures the actual decoded video via canvas, not the three fallback
posters. Quarter-second buttons are navigation aids, not playback samples.

The auction comparison requires both observed transitions (2–2.3 and 9–9.3 s),
not any arbitrary pair seven seconds apart. Before-change frames are rejected.

### Rebuilding

Rendering is an offline asset step, not a production dependency. Use an isolated
Python 3.11 environment with `bpy==4.3.0` and `numpy<2`, plus FFmpeg/libx264/libwebp:

```sh
python scripts/render-recordings.py hotel
python scripts/render-recordings.py stage
python scripts/render-recordings.py auction
python scripts/render-recordings.py receiver
python scripts/render-recordings.py hotel --geometry-report assets/cctv/motion-geometry.json
python scripts/build-recordings.py
python scripts/verify-recordings.py
```

Default frames are written to `/tmp/ghostdesk-renders`; use `--out` and matching
encoder `--frames` to override. `--preview` renders three review frames only.
`--start-frame N` resumes a known completed render boundary; do not reuse frames
from changed scene geometry. The encoder refuses incomplete frame directories.
Static instrument states may reuse an identical whole-scene render while the
scene is genuinely unchanged; light transitions are rendered explicitly.

### Compatibility and scope

Four additive v4 packages update existing observation stages. Answers, five-stage
structure, endings, save schema and engine version are unchanged. The lab stays
on v3. v1/v2/v3 packages and user saves are not rewritten. New investigations use
v4; existing investigations keep their edition. Archived 404 video viewers also
use the new continuous recording with the same 12-second comparison answer; a
presentation-only note corrects the old v3 four-second wording. The handover
mentions the ajar door as seen on the monitor. Hotel photographs open in separate
windows, and follow the accessibility of their original source documents. Text
files contain text and links, without embedding photographs.

The superseded photographic assets remain preserved for provenance. `hotel-cctv.mp4`,
`hotel.webp`, `hotel-frame-middle.webp`, `hotel-frame-exit.webp` and the old
`scripts/build-cctv.sh` document the superseded 4-second A/B/C reconstruction.
`hotel.webp` no longer appears in the hotel date puzzle or evidence viewer.
`hotel-empty.webp` and `hotel-cart.webp` here also remain provenance of the
earlier cutout experiment; neither is used by the new renderer or shipped player.
