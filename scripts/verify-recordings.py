"""Validate shipped decoded video frames, encoding, loop timing and signal changes."""
import hashlib
import json
from pathlib import Path
import subprocess

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
        assert len(set(frames[:288])) == 288, 'The base motion must have 288 distinct decoded frames'
        assert frames[:288] == frames[288:576]
        assert frames[:96] == frames[576:672]
        assert all(a != b for a, b in zip(frames, frames[1:]))
        item.update(uniqueBaseFrames=288, repeatedAfterFrames=288, heldAdjacentFrames=0)
    elif name == 'auction-monitor':
        assert frames[47] != frames[48] and frames[215] != frames[216]
        item['observedChangesSeconds'] = [2, 9]
    elif name == 'stage-cues':
        assert len({frames[36], frames[108], frames[180], frames[252]}) == 4
        item['distinctCuePeaks'] = 4
    elif name == 'island-receiver':
        assert frames[20] != frames[30] and frames[30] != frames[34]
        item['receiverPulseChangesPresent'] = True
    report[name] = item
out = root / 'docs/evidence/continuous-recordings-media.json'
out.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
