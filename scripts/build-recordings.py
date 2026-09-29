"""Encode full 3D renders as silent H.264 videos and matching WebP posters.

python scripts/build-recordings.py [hotel|stage|auction|receiver|all]
Rendering is separate; incomplete frame directories fail rather than creating a slideshow.
"""
import argparse
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('scene', choices=['hotel', 'stage', 'auction', 'receiver', 'all'], default='all', nargs='?')
parser.add_argument('--frames', type=Path, default=Path('/tmp/ghostdesk-renders'))
args = parser.parse_args()
assets = root / 'apps/ghostdesk/src/assets'
names = {'hotel': ('hotel-motion', 288), 'stage': ('stage-cues', 336),
         'auction': ('auction-monitor', 264), 'receiver': ('island-receiver', 264)}


def run(*argv):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *map(str, argv)], check=True)


for scene in names if args.scene == 'all' else [args.scene]:
    name, count = names[scene]
    folder = args.frames / scene
    missing = [f for f in range(count) if not (folder / f'{f:04d}.png').is_file()]
    if missing:
        raise SystemExit(f'{scene}: {len(missing)} frames missing; finish rendering first')
    with tempfile.TemporaryDirectory() as temp:
        encoded = Path(temp) / 'cycle.mp4' if scene == 'hotel' else assets / f'{name}.mp4'
        run('-framerate', '24', '-i', folder / '%04d.png', '-frames:v', count,
            '-an', '-c:v', 'libx264', '-threads', '2', '-profile:v', 'main', '-level', '3.1',
            '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'medium', '-g', '24', '-bf', '0',
            '-sc_threshold', '0', '-movflags', '+faststart', encoded)
        if scene == 'hotel':
            # The *source record* repeats. The 28s container itself does not loop.
            # Copy the same 288 decoded frames for exact 12-second comparisons.
            run('-stream_loop', '2', '-i', encoded, '-t', '28', '-an', '-c', 'copy',
                '-movflags', '+faststart', assets / f'{name}.mp4')
    posters = {'hotel': [(0, '-0'), (96, '-4'), (192, '-8')],
               'stage': [(36, '')], 'auction': [(0, ''), (48, '-2'), (216, '-9')],
               'receiver': [(30, '')]}[scene]
    for frame, suffix in posters:
        if scene == 'hotel':
            # The photograph, date puzzle and fallback capture must match the
            # shipped video, including its H.264 encode. Preserve decoded RGB.
            run('-i', assets / f'{name}.mp4', '-vf', f'select=eq(n\\,{frame}),format=rgb24',
                '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '1',
                '-threads', '2', assets / f'{name}{suffix}.webp')
        else:
            run('-i', folder / f'{frame:04d}.png', '-frames:v', '1', '-c:v', 'libwebp',
                '-quality', '88', '-threads', '2', assets / f'{name}{suffix}.webp')
    print(f'Encoded {name}', flush=True)
