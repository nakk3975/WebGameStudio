# Fictional CCTV reconstruction

`hotel-empty.webp` and `hotel-cart.webp` are generated edits of the existing GhostDesk hallway illustration. They were created using the built-in image generation tool on 2026-09-28. They are production sources for the clip, not photos downloaded from a real surveillance system.

Run `bash scripts/build-cctv.sh` with FFmpeg/libx264 to recreate `apps/ghostdesk/src/assets/hotel-cctv.mp4`. The script animates the trolley over a fixed background, increasing its size as it approaches and leaving the lower right of the picture. It produces a silent, 12-second, 1280×720 H.264/yuv420p MP4 with fast-start metadata. The game labels it as a reenactment, starts only on a player action, and loops the clip. Exact date/frame labels are accessible HTML, not generated lettering.

This is composited animation from generated still assets, not AI-generated motion footage or actual surveillance. The existing archived still remains the poster. The fictional record's source date and repeated segment remain unchanged; no new suspect or outcome is introduced.
