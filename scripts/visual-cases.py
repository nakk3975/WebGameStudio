"""Additive v3 publication: keep v1/v2 packages and all saved investigations intact."""
import copy,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
old=json.loads((root/'apps/ghostdesk/src/expanded-cases.json').read_text())
cases=copy.deepcopy(old)
for c in cases:
 cid=c['caseId']
 text=json.dumps(c,ensure_ascii=False).replace(cid+'-v2',cid+'-v3')
 for n in range(1,6): text=text.replace(f'{cid}-p{n}-v2',f'{cid}-p{n}-v3')
 c.clear();c.update(json.loads(text))

def edit(ci,n,visual,title,question,answer,hints):
 c=cases[ci];p=c['puzzles'][n-1]
 p.update(inputMode='visual',visualId=visual,stageTitle=title,title=question,answer=answer,hints=hints)
 p.pop('choices',None)
 next(f for f in c['files'] if f.get('puzzleId')==p['id'])['title']=f'{n}단계 · {title}'

def record(ci,fid,text):
 next(f for f in cases[ci]['files'] if f['id']==fid)['text']=text

edit(0,4,'lab-network','사진과 계량기 대조','사진에서 연결되지 않은 선의 끝을 표시하고, 점검 구간의 외부 전송량 증가분을 입력하세요.','B:0',[
 '사진은 03:20 점검 때의 모습입니다. 장비함 안과 책상 위의 선 끝을 비교하세요.',
 '분리된 선은 앞쪽 책상에 있습니다. 전송량은 외부 회선의 두 측정값을 빼서 구하세요.',
 '사진만으로 과거 전송 여부를 단정하지 말고, 외부 계량기의 8192 → 8192를 대조하세요.',
 '사진 B를 표시하고 증가분 0을 입력하세요.'])
edit(1,2,'hotel-date','화면 속 시점 대조','오늘의 복도와 맞지 않는 흔적을 사진에서 표시하고, 원본 촬영일을 월·일 네 자리로 입력하세요.','C:0612',[
 '현재 시설 점검 메모와 사진을 대조하세요. 화면 위의 LIVE 글자는 촬영 날짜가 아닙니다.',
 '공사 종료 후 철거한 물건이 사진에 남아 있는지 살펴보세요.',
 '오른쪽 공사 덮개와 화면 아래의 원본 기록을 함께 확인하세요.',
 '사진 C를 표시하고 원본 날짜 0612를 입력하세요.'])
edit(1,3,'hotel-repeat','반복 장면 비교','같은 장면이 처음 다시 나타나는 두 시점을 담아 비교하세요. 서로 다른 시점이어야 합니다.','12',[
 '영상 전체 길이가 반복 간격은 아닙니다. 앞쪽과 뒤쪽에서 카트 위치가 같은 장면을 찾으세요.',
 '이전·다음 장면 버튼으로 한 장면씩 이동하고 비교판에 담을 수 있습니다.',
 '00:00의 장면과 처음 다시 같은 모습이 되는 시점을 비교하세요.',
 '00:00과 00:12를 담아 비교하세요. 00:04와 00:16도 같은 간격입니다.'])
record(1,'hotel-404-record-3','프런트 모니터 관찰 안내\n\n연속 동작을 복원하지 않고 4초 간격의 전체 장면을 재현했습니다.\n화면 아래 재생 위치는 이번에 보관한 기록의 경과 시간입니다. 원본 장면 번호와 구별해 주세요.\n\n카트의 위치, 시트 모양, 복도 오른쪽 덮개를 비교하고 같은 장면이 처음 다시 나타나는 두 시점을 담아 주세요. 전체 기록의 길이가 곧 반복 간격은 아닙니다.')
record(1,'hotel-404-f3','4초 간격으로 남은 복도 장면을 재현한 기록. 장면 전체를 살펴보고 앞뒤 구간을 비교하세요.')
edit(2,2,'auction-seal','봉인 흔적 비교','접수 시 검수 표시와 같고, 봉인이 끊기지 않은 원본 봉투를 사진에서 고르세요.','B',[
 '검수 메모의 표시와 사진 속 봉인을 함께 확인하세요.',
 '파란 선의 개수만 맞는 것으로는 부족합니다. 종이가 이어져 있는지도 확인하세요.',
 '왼쪽은 선의 수가 다르고, 오른쪽은 봉인 중앙이 갈라져 있습니다.',
 '두 줄 표시가 이어져 있고 봉인이 온전한 가운데 B입니다.'])
record(2,'auction-seven-record-2','원본 봉투 대조 / LOT-27 · 입찰 B-71\n\n접수 때 봉인 위에 남긴 검수 표시: 평행한 파란 선 두 줄.\n원본 봉투는 접수 뒤 개봉하지 않았으므로 봉인 종이가 끊기지 않아야 합니다.\n\n사진에는 원본과 대조용 봉투가 함께 놓여 있습니다. 표시의 모양과 봉인 상태를 모두 확인하세요. 접수 때의 봉인 상태를 그대로 보존한 봉투를 찾아 주세요.')
edit(3,5,'stage-route','통로와 촬영 범위','사진 속 안전 통로 끝의 문을 표시하고, 정문 영상만으로 확인할 수 있는 결론을 고르세요.','B:C',[
 '사진에서 안쪽으로 이어지는 문과 정문 카메라의 촬영 범위를 따로 확인하세요.',
 '안전 통로의 문은 사진 가운데 안쪽에 있습니다. 정문 카메라는 정문 계단과 매표소만 촬영합니다.',
 '촬영 범위 밖에 있는 길을 통해 이동했는지는 정문 영상만으로 알 수 없습니다.',
 '문은 B, 결론은 ‘정문을 통해 나가는 모습이 없었다’입니다.'])
edit(4,4,'island-device','사진 속 독립 기록','사진에서 바다의 관측 장치를 표시하고, PC와 전원·기록 보관 장소를 모두 공유하지 않는 기록 묶음을 고르세요.','B:B',[
 '사진의 관측소 건물과 바다 위 장치를 구별하고 연결 대장과 대조하세요.',
 '별도 전원만으로 충분하지 않습니다. 기록을 어디에 보관하는지도 보세요.',
 '외부 모니터는 PC 화면을 복사합니다. 부표와 종이 노트는 각자의 기록을 남깁니다.',
 '사진 B의 부표, 그리고 ‘관측 부표와 종이 노트’를 선택하세요.'])

(root/'apps/ghostdesk/src/visual-cases.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2)+'\n')
statements=['-- Additive visual edition: do not overwrite v1/v2 or user saves.']
for c in cases:
 payload=json.dumps(c,ensure_ascii=False,separators=(',',':'))
 statements.append(f"INSERT INTO ghostdesk.case_versions(version_id, case_id, package, published) VALUES ('{c['versionId']}', '{c['caseId']}', $case${payload}$case$::jsonb, true) ON CONFLICT (version_id) DO NOTHING;")
(root/'db/migrations/V005__visual_observation_cases.sql').write_text('\n'.join(statements)+'\n')
print('Prepared five v3 cases with six visual puzzles; previous packages unchanged.')
