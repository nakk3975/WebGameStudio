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
parser.add_argument('--posters-only', action='store_true', help='Extract matching stills from the already shipped MP4')
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
    if missing and not args.posters_only:
        raise SystemExit(f'{scene}: {len(missing)} frames missing; finish rendering first')
    if not args.posters_only:
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
        # Every fallback photograph must match the decoded shipped recording.
        run('-i', assets / f'{name}.mp4', '-vf', f'select=eq(n\\,{frame}),format=rgb24',
            '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '1',
            '-threads', '2', assets / f'{name}{suffix}.webp')
    if scene == 'stage' and not args.posters_only:
        for still in ['stage', 'stage-console']:
            run('-i', args.frames / 'stage-stills' / f'{still}.png', '-frames:v', '1',
                '-c:v', 'libwebp', '-quality', '92', '-threads', '2', assets / f'{still}.webp')
    print(f'Encoded {name}', flush=True)
