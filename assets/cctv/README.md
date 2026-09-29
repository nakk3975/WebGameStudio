# CCTV and instrument recordings

## Current continuous edition (2026-09-29)

The player now uses **full 3D scene renders**, not the previous A/B/C photographic
slideshow. `scripts/render-recordings.py` builds all geometry, materials, fixed
cameras and lights in Blender 4.3 (Cycles CPU). Each moving-cart frame is a fresh
render of the corridor and trolley together. There are no image planes, moving
cutouts, optical-flow interpolation or independently painted shadows. These are
stylized CG reconstructions, **not filmed footage or generative-video output**.
The game labels them as reconstructions; original photographs remain separate.
No person or their identity/movements is reconstructed.

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
The path has no sideways drift: x=-0.23 m; y decreases from 9.3 m with 0.6 m/s
initial speed, easing to a stop over the final 1.5 seconds. Four wheel contact
points remain at z=0, inside the corridor borders and inside the camera view for
all 288 source frames. Lighting, contact shadows, occlusion and perspective come
from the same scene. The camera never rotates or zooms.

`motion-geometry.json` records the complete 1,152-contact validation.
The final image is near the camera; **the cut back to the distant cart at 12 and
24 seconds is intentional evidence of the monitor's repeated source record**.
It is not a physically continuous return trip, and is not blended away. Inside
each 12-second cycle all 288 decoded frames differ, without four-second holds.
The 28-second container plays once; the repetition is inside the record.

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
presentation-only note corrects the old v3 four-second wording.

All pre-existing photos and media bytes are preserved. `hotel-cctv.mp4`,
`hotel.webp`, `hotel-frame-middle.webp`, `hotel-frame-exit.webp` and the old
`scripts/build-cctv.sh` document the superseded 4-second A/B/C reconstruction.
The original photo still supports the date/curtain puzzle. `hotel-empty.webp`
and `hotel-cart.webp` here remain provenance of the earlier rejected cutout
experiment; neither is used by the new renderer or shipped player.
