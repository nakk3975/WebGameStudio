#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Seven complete photographic scenes, held for four seconds each.
# No independently moving cutout, scaling animation, interpolation or fake shadows.
# Source cycle A/B/C repeats inside the 28-second recording; the file length
# therefore does not reveal the puzzle's shortest repeat interval.
ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -framerate 12 -i apps/ghostdesk/src/assets/hotel.webp \
  -loop 1 -framerate 12 -i apps/ghostdesk/src/assets/hotel-frame-middle.webp \
  -loop 1 -framerate 12 -i apps/ghostdesk/src/assets/hotel-frame-exit.webp \
  -filter_complex "[0:v]scale=1280:720,setsar=1,trim=duration=4,setpts=PTS-STARTPTS,split=3[a0][a1][a2];[1:v]scale=1280:720,setsar=1,trim=duration=4,setpts=PTS-STARTPTS,split=2[b0][b1];[2:v]scale=1280:720,setsar=1,trim=duration=4,setpts=PTS-STARTPTS,split=2[c0][c1];[a0][b0][c0][a1][b1][c1][a2]concat=n=7:v=1:a=0,format=yuv420p[out]" \
  -map '[out]' -t 28 -an -r 12 -c:v libx264 -profile:v main \
  -crf 23 -preset medium -movflags +faststart \
  apps/ghostdesk/src/assets/hotel-cctv.mp4
ffprobe -v error -show_entries stream=codec_name,pix_fmt,width,height,duration \
  -of json apps/ghostdesk/src/assets/hotel-cctv.mp4
