"""Render exact fictional document tables and an output-meter recording.

Usage: python scripts/build-chapter-media.py --font /path/to/Korean-font.ttf
These are authored diagrams, not simulated photographs of new locations.
"""
import argparse
import importlib.util
import math
from pathlib import Path
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('chapters', root / 'scripts/ten-stage-cases.py')
chapters = importlib.util.module_from_spec(spec)
spec.loader.exec_module(chapters)
parser = argparse.ArgumentParser()
parser.add_argument('--font', required=True)
args = parser.parse_args()
assets = root / 'apps/ghostdesk/src/assets'
font = lambda size: ImageFont.truetype(args.font, size)


def canvas(label, title, footer):
    image = Image.new('RGB', (1200, 720), '#e9e5dc')
    d = ImageDraw.Draw(image)
    d.rectangle((0, 0, 1200, 12), fill='#255f69')
    d.text((64, 54), label, font=font(22), fill='#255f69')
    d.text((64, 102), title, font=font(42), fill='#152e36')
    d.line((64, 184, 1136, 184), fill='#78888a', width=2)
    d.text((64, 634), footer, font=font(21), fill='#495d64')
    d.text((64, 672), 'GHOSTDESK / 가상 사건 자료', font=font(18), fill='#667477')
    return image, d


ids = ['lab', 'hotel', 'auction', 'stage', 'island']
for number, (cid, chapter) in enumerate(zip(ids, chapters.chapters), 1):
    image, d = canvas(f'기록 {number:03d} / 후속 조사', chapter['imageTitle'],
                      '문서에 적힌 값만 표시했습니다. 다른 원본과 함께 대조하세요.')
    rows = chapter['imageRows']
    width = 1072 / len(rows[0])
    for row, cells in enumerate(rows):
        y = 218 + row * 85
        d.rectangle((64, y, 1136, y + 76), fill='#254853' if row == 0 else '#f8f6f0')
        for col, value in enumerate(cells):
            # Fit all exact values, including Korean, without truncation.
            size = 28
            while d.textbbox((0, 0), value, font=font(size))[2] > width - 28:
                size -= 1
            d.text((80 + col * width, y + 22), value, font=font(size),
                   fill='#ffffff' if row == 0 else '#183d48')
    image.save(assets / f'{cid}-chapter.webp', lossless=True)


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *map(str, args)], check=True)


with tempfile.TemporaryDirectory(prefix='ghostdesk-meter-') as tmp:
    # 21:56:50..21:57:00, original time spacing, no reverse or automatic loop.
    for frame in range(110):
        t = frame / 10
        second = 50 + int(t)
        stamp = f'21:{56 + second // 60:02d}:{second % 60:02d}'
        image, d = canvas('음향 제어기 / 출력계 기록 재현', stamp,
                          '신호 유무를 옮긴 기록입니다. 사람의 모습이나 위치를 보여 주지 않습니다.')
        for row, (title, signal, on) in enumerate([
            ('B1  객석 스피커', 'REHEARSAL-06', t >= 2),
            ('B2  스태프 헤드셋', 'NOTICE-02', 1 <= t < 4),
        ]):
            y = 238 + row * 175
            d.text((64, y), title, font=font(29), fill='#193b45')
            d.text((730, y), signal if on else '신호 없음', font=font(28), fill='#255f69')
            for bar in range(30):
                active = on and bar < 18 + int(5 * math.sin(t * 6))
                x = 64 + bar * 35
                d.rectangle((x, y + 59, x + 25, y + 102), fill='#348378' if active else '#d0d3cc')
        image.save(Path(tmp) / f'{frame:04d}.png')
    video = assets / 'stage-output-meter.mp4'
    ffmpeg('-framerate', 10, '-i', Path(tmp) / '%04d.png', '-frames:v', 110,
           '-an', '-c:v', 'libx264', '-threads', 2, '-pix_fmt', 'yuv420p',
           '-crf', 20, '-g', 10, '-bf', 0, '-movflags', '+faststart', video)
    ffmpeg('-i', video, '-vf', 'select=eq(n\\,0),format=rgb24', '-frames:v', 1,
           '-c:v', 'libwebp', '-lossless', 1, assets / 'stage-output-meter.webp')
print('Built five document images and one 11-second output recording with a decoded poster.')
