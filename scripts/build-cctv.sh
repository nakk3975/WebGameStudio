#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# A fictional 12-second fixed-camera reconstruction, not real surveillance.
# The trolley approaches along the hallway floor, then leaves at bottom right.
# The browser's repeating playback returns to F-8821 after this clip ends.
ffmpeg -hide_banner -loglevel error -y \
  -loop 1 -framerate 12 -i assets/cctv/hotel-empty.webp \
  -loop 1 -framerate 12 -i assets/cctv/hotel-cart.webp \
  -filter_complex "[0:v]format=yuv420p[hall];[1:v]format=rgba,lut=a='if(lt(val,192),0,val)',format=yuva420p,scale=w=-2:h='160+18*t':eval=frame[cart];[hall][cart]overlay=x='625+10*t':y='125+60*t':eval=frame,eq=saturation=0.6:brightness=-0.035,noise=alls=1:allf=t,format=yuv420p[out]" \
  -map '[out]' -t 12 -an -r 12 -c:v libx264 -profile:v main \
  -crf 25 -preset medium -movflags +faststart \
  apps/ghostdesk/src/assets/hotel-cctv.mp4

ffprobe -v error -show_entries stream=codec_name,pix_fmt,width,height,duration \
  -of json apps/ghostdesk/src/assets/hotel-cctv.mp4
