"""Publish four additive motion editions; preserve every archived package/save."""
import copy
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
previous = json.loads((root / 'apps/ghostdesk/src/visual-cases.json').read_text())
cases = copy.deepcopy(previous[1:])
for c in cases:
    cid = c['caseId']
    c['versionId'] = cid + '-v4'
    payload = json.dumps(c, ensure_ascii=False)
    for n in range(1, 6):
        payload = payload.replace(f'{cid}-p{n}-v3', f'{cid}-p{n}-v4')
    c.clear()
    c.update(json.loads(payload))


def record(ci, fid, text, title=None):
    f = next(f for f in cases[ci]['files'] if f['id'] == fid)
    f['text'] = text
    if title:
        f['title'] = title


def puzzle(ci, n, visual, title, question, hints):
    p = cases[ci]['puzzles'][n-1]
    p.update(inputMode='visual', visualId=visual, stageTitle=title, title=question, hints=hints)
    p.pop('choices', None)
    next(f for f in cases[ci]['files'] if f.get('puzzleId') == p['id'])['title'] = f'{n}단계 · {title}'


puzzle(0, 3, 'hotel-repeat', '반복 장면 비교',
       '같은 움직임이 처음 다시 나타나는 두 시점을 담아 비교하세요. 서로 다른 시점이어야 합니다.', [
           '기록 전체 길이가 반복 간격은 아닙니다. 카트의 위치와 움직임을 앞뒤로 비교하세요.',
           '영상을 멈추고 조금 이전·다음으로 위치를 맞춘 뒤 현재 장면을 담을 수 있습니다.',
           '처음의 카트 위치로 돌아가는 지점을 찾아보세요. 움직임도 다시 같은 순서로 이어집니다.',
           '00:00과 00:12를 담아 비교하세요. 00:04와 00:16도 같은 간격입니다.'])
record(0, 'hotel-404-record-3', '프런트 모니터 관찰 안내\n\n현장 기록을 바탕으로 복도 공간과 카트의 위치 변화를 재현했습니다. 사람의 신원이나 동작을 복원한 영상은 아닙니다. 원본 사진은 복도 기록에서 따로 확인할 수 있습니다.\n화면 아래 재생 위치는 이번에 보관한 기록의 경과 시간입니다. 원본 장면 번호와 구별해 주세요.\n\n카트의 위치와 움직임을 살펴보고 같은 구간이 처음 다시 나타나는 두 시점을 담아 주세요. 전체 기록의 길이가 곧 반복 간격은 아닙니다.')
record(0, 'hotel-404-f3', '복도 공간과 카트의 이동을 재현한 기록. 앞뒤 구간을 직접 비교하세요. 원본 사진은 별도로 보관했습니다.')

puzzle(1, 4, 'auction-timing', '표시 변화 대조',
       '접속 불빛이 꺼지는 순간과 마감 표시가 나타나는 순간을 차례로 담아, 두 변화 사이의 시간을 대조하세요.', [
           '왼쪽 작은 접속 불빛과 아래쪽 진행·마감 표시를 각각 관찰하세요.',
           '조금 이전·다음으로 되짚어 보며 각 표시가 처음 바뀌는 순간을 담으세요.',
           '접속 불빛은 21:59:53, 마감 표시는 22:00:00에 바뀝니다.',
           '영상의 00:02와 00:09를 차례로 담으세요. 차이는 7초입니다.'])
record(1, 'auction-seven-record-4', '전광판 감시 기록 / 서버 시각\n\n왼쪽 MOTH 옆 작은 불빛은 접속 상태를 나타냅니다.\nOPEN: 경매 진행 중\nCLOSED: 마감 처리됨\n\n접속 불빛이 꺼지는 순간과 마감 표시로 바뀌는 순간을 영상에서 확인하세요. 이름과 금액이 화면에 남아 있어도 입찰이 유효하다는 뜻은 아닙니다. 접속 상태 기록과 입찰 원장은 별도로 남습니다.', '전광판_감시기록.cam')

puzzle(2, 1, 'stage-cues', '조명 순서 관찰',
       '영상에서 실제로 켜진 네 가지 빛을 순서대로 선택하세요. 예정표와 달라진 부분이 있는지 살펴보세요.', [
           '예정표보다 실제로 켜진 빛을 먼저 확인하세요.',
           '취소된 초록빛은 나타나지 않습니다. 천천히 재생하며 네 색의 순서를 기록하세요.',
           '주황빛 → 파란빛 → 흰빛 → 붉은빛 순서입니다.',
           '카드 번호로는 2 → 4 → 1 → 3입니다.'])
record(2, 'encore-last-f1', '공연 제어기 / 조명 기록\n\n실제로 실행된 조명 순서를 영상으로 재현했습니다. 기다리는 구간은 줄였으며 실제 공연 시각이나 사람의 위치를 증명하는 화면은 아닙니다.\n\n빛이 켜졌다 사라지는 순서와 카드별 큐시트를 비교하세요. 예정표에 적힌 순서가 실제 실행 순서와 같다고 가정하지 마세요.', '조명_실행기록.cam')
record(2, 'encore-last-f2', '조명 카드 대조표\n\n카드 1 / 흰빛 · WHITE / 객석 방향 빛\n카드 2 / 주황빛 · AMBER / 무대 뒤 통로\n카드 3 / 붉은빛 · RED / 암전 직전 안전 표시\n카드 4 / 파란빛 · BLUE / 중앙 스포트라이트\n카드 5 / 초록빛 · GREEN / 사용 취소\n\n당초 예정: 파란빛 → 흰빛 → 주황빛 → 붉은빛\n무대감독 메모: 공연 중 순서 변경 있음. 실제 실행 기록 우선.')

puzzle(3, 1, 'island-signal', '수신 불빛 해독',
       '수신기의 짧고 긴 불빛을 관찰하고 통신 카드로 세 글자의 신호를 해독하세요.', [
           '짧게 켜지면 점, 길게 켜지면 선입니다. 긴 쉼을 기준으로 글자를 나누세요.',
           '세 묶음이 있습니다. 느리게 보기로 각 묶음의 길이와 횟수를 세어 보세요.',
           '짧게 세 번, 길게 세 번, 짧게 세 번입니다. 통신 카드에서 두 종류의 글자를 찾으세요.',
           '정답: SOS'])
record(3, 'monday-loop-f1', '야간 수신기 / 수신 불빛 기록\n\n짧은 불빛은 점, 긴 불빛은 선입니다.\n불빛 한 번이 곧 글자 하나는 아닙니다. 긴 쉼을 기준으로 묶어서 통신 카드와 대조하세요.\n\n수신기의 불빛 길이와 간격을 재현했습니다. 수신기 전원은 별도 배터리라 관측용 PC의 정전 영향을 받지 않습니다.', '야간_수신기.cam')

(root / 'apps/ghostdesk/src/motion-cases.json').write_text(json.dumps(cases, ensure_ascii=False, indent=2) + '\n')
sql = ['-- Add four v4 editions. No changes to archived packages or user saves.']
for c in cases:
    payload = json.dumps(c, ensure_ascii=False, separators=(',', ':'))
    sql.append(f"INSERT INTO ghostdesk.case_versions(version_id, case_id, package, published) VALUES ('{c['versionId']}', '{c['caseId']}', $case${payload}$case$::jsonb, true) ON CONFLICT (version_id) DO NOTHING;")
(root / 'db/migrations/V006__continuous_recording_cases.sql').write_text('\n'.join(sql) + '\n')
print('Prepared four v4 editions; lab, answers and endings unchanged.')
