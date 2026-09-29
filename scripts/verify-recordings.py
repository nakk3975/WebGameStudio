"""Validate shipped decoded video frames, encoding, loop timing and signal changes."""
import hashlib
import json
from pathlib import Path
import subprocess
from statistics import mean

root = Path(__file__).resolve().parents[1]
assets = root / 'apps/ghostdesk/src/assets'
expected = {'hotel-motion': 28, 'stage-cues': 14, 'auction-monitor': 11, 'island-receiver': 11}
report = {}
for name, duration in expected.items():
    file = assets / f'{name}.mp4'
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(file)]))
    assert len(probe['streams']) == 1
    stream = probe['streams'][0]
    assert (stream['codec_name'], stream['pix_fmt'], stream['width'], stream['height']) == ('h264', 'yuv420p', 960, 540)
    assert stream['r_frame_rate'] == '24/1' and float(stream['duration']) == duration
    hashes = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(file), '-map', '0:v', '-f', 'framemd5', '-']).decode()
    frames = [line.split(',')[-1].strip() for line in hashes.splitlines() if not line.startswith('#')]
    assert len(frames) == duration * 24
    item = {'duration': duration, 'fps': 24, 'size': file.stat().st_size,
            'decodedFrames': len(frames), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}
    if name == 'hotel-motion':
        # The person and cart move for the first nine seconds, then leave view.
        # A naturally empty corridor at the end may legitimately hold still.
        assert len(set(frames[:216])) == 216, 'Moving subjects must not freeze or reuse frames'
        assert frames[:288] == frames[288:576]
        assert frames[:96] == frames[576:672]
        item.update(uniqueBaseFrames=len(set(frames[:288])), repeatedAfterFrames=288,
                    distinctMotionFrames=216,
                    heldAdjacentFrames=sum(a == b for a, b in zip(frames, frames[1:])))
    elif name == 'auction-monitor':
        assert frames[47] != frames[48] and frames[215] != frames[216]
        item['observedChangesSeconds'] = [2, 9]
    elif name == 'stage-cues':
        assert len({frames[36], frames[108], frames[180], frames[252]}) == 4
        item['distinctCuePeaks'] = 4
        # Inspect the delivered pixels, not just the renderer's light settings.
        regions = [(170, 200, 260, 290), (400, 240, 560, 380), (290, 445, 500, 520)]
        colors = []
        for frame in [36, 108, 180, 252]:
            pixels = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(file),
                '-vf', f'select=eq(n\\,{frame}),format=rgb24', '-frames:v', '1', '-f', 'rawvideo', '-'])
            colors.append([[mean(pixels[(y*960+x)*3+k] for y in range(y1, y2) for x in range(x1, x2))
                            for k in range(3)] for x1, y1, x2, y2 in regions])
        amber, blue, white, red = colors
        assert amber[0][0] > amber[0][1] > amber[0][2] and amber[0][0] > amber[1][0]*1.5
        assert blue[1][2] > blue[1][0]*2 and blue[1][2] > blue[0][2]*1.5
        assert min(white[2]) > 60 and sum(white[2]) > sum(white[0])*5
        assert red[0][0] > red[0][1]*3 and red[0][0] > red[1][0]*1.5
        item['cueTargets'] = ['amber backstage', 'blue center', 'white audience', 'red safety passage']
    elif name == 'island-receiver':
        assert frames[20] != frames[30] and frames[30] != frames[34]
        item['receiverPulseChangesPresent'] = True
        pixels = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(file),
            '-vf', 'crop=12:12:500:335,format=gray', '-f', 'rawvideo', '-'])
        brightness = [mean(pixels[i:i+144]) for i in range(0, len(pixels), 144)]
        intervals = []; start = None
        for frame, value in enumerate(brightness+[0]):
            if value > 160 and start is None: start = frame
            if value <= 160 and start is not None:
                intervals.append((start, frame)); start = None
        lengths = [end-start for start, end in intervals]
        assert len(lengths) == 9
        assert all(6 <= lengths[i] <= 7 for i in [0,1,2,6,7,8])
        assert all(19 <= lengths[i] <= 21 for i in [3,4,5])
        gaps = [b[0]-a[1] for a, b in zip(intervals, intervals[1:])]
        assert gaps[2] >= 19 and gaps[5] >= 19
        assert all(6 <= gaps[i] <= 8 for i in [0,1,3,4,6,7])
        item.update(decodedSignal='SOS', pulseLengthsFrames=lengths, gapLengthsFrames=gaps)
    poster_frames = {
        'hotel-motion': [(0, '-0'), (96, '-4'), (192, '-8')],
        'stage-cues': [(36, '')],
        'auction-monitor': [(0, ''), (48, '-2'), (216, '-9')],
        'island-receiver': [(30, '')],
    }[name]
    for frame, suffix in poster_frames:
        decoded = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(file),
            '-vf', f'select=eq(n\\,{frame}),format=rgb24', '-frames:v', '1', '-f', 'rawvideo', '-'])
        poster = subprocess.check_output(['ffmpeg', '-v', 'error', '-i',
            str(assets / f'{name}{suffix}.webp'), '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'])
        assert decoded == poster, f'{name} frame {frame}: photograph differs from shipped video'
    item['matchingDecodedPostersSeconds'] = [frame / 24 for frame, _ in poster_frames]
    report[name] = item
out = root / 'docs/evidence/continuous-recordings-media.json'
out.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
