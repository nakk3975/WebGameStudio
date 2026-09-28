"""Author the five-stage edition without changing any published v1 package."""
import copy
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
legacy = json.loads(re.search(r'\$case\$(.*?)\$case\$', (ROOT / 'db/migrations/V001__public_catalog.sql').read_text(), re.S)[1])
cases = [legacy, *json.loads((ROOT / 'apps/ghostdesk/src/additional-cases.json').read_text())]

def stage(name, question, answer, text='', refs=(), mode='text', choices=(), hints=()):
    return dict(name=name, question=question, answer=answer, text=text, refs=list(refs), mode=mode, choices=choices, hints=hints)

plans = [
    [
        stage('시각 맞추기', '마지막 전송 요청의 실제 시각은? 시·분 네 자리로 입력하세요.', '0310', refs=['f-handover', 'f-photo', 'f-queue'], hints=['두 시계가 같은 시각을 가리키는지 살펴보세요.', '요청 기록은 PC 시각입니다. 인수인계의 오차를 적용하세요.', '03:17에서 7분을 빼세요.']),
        stage('요청 연결하기', '대기열 기록과 같은 요청을 처리한 접수표를 고르세요.', 'C', '분리된 접수표 / 시각은 모두 PC 기준\n\n접수표 A · TX-0916 · 03:16:00 · 외부 보관소\n접수표 B · TX-0917 · 03:17:00 · 내부 복제본\n접수표 C · TX-0917 · 03:17:00 · 외부 보관소\n\n한 요청을 외부 전송과 내부 복제에 각각 사용한 기록입니다. 요청 번호와 목적지가 모두 같은 접수표를 찾아야 합니다.', refs=['f-queue'], mode='choice', choices=[('A','접수표 A'),('B','접수표 B'),('C','접수표 C')], hints=['요청 번호만으로 고르면 다른 작업이 섞일 수 있어요.', '대기열의 목적지는 외부 보관소입니다.', 'TX-0917과 외부 보관소가 함께 적힌 접수표를 찾으세요.']),
        stage('처리 순서 복원', '외부 요청 TX-0917의 기록을 이른 시각부터 배열하세요.', '2413', '처리 단편 / 모두 같은 PC 시각\n\n단편 1 · 03:17:09 · 승인 취소 접수\n단편 2 · 03:17:00 · 요청 생성\n단편 3 · 03:17:11 · 처리 내역 보관\n단편 4 · 03:17:02 · 승인 대기 등록\n\n사진은 03:20 점검 때 촬영되었습니다. 사진 속 선의 연결 상태만으로 그 이전 작업을 판단할 수는 없습니다.', mode='sequence', choices=[('1','승인 취소 접수'),('2','요청 생성'),('3','처리 내역 보관'),('4','승인 대기 등록')], hints=['단편 번호는 순서를 뜻하지 않습니다.', '같은 시계로 기록된 시각을 정렬하세요.', '00초, 02초, 09초, 11초 순서입니다.']),
        stage('전송량 대조', '이번 점검 구간에서 증가한 외부 전송량은 몇 바이트인가요? 숫자로 입력하세요.', '0', '네트워크 계량기 / 03:16:50 → 03:17:20\n\n외부 회선 누적량: 8192 → 8192 바이트\n내부 복제 누적량: 4096 → 6144 바이트\n\n두 계량기는 서로 다른 회선입니다. 누적량은 초기화되지 않았습니다. 해당 구간에 다른 외부 작업은 없었습니다.', hints=['누적량 전체가 이번 요청의 전송량은 아닙니다.', '내부 복제 회선과 외부 회선을 나누어 보세요.', '외부 회선의 마지막 값에서 처음 값을 빼세요.']),
        stage('최종 영수증 찾기', '지금까지 확인한 요청·처리·계량기 기록에 모두 맞는 영수증을 고르세요.', 'B', '보관소 영수증 색인\n\nA · TX-0917 · 외부 보관소 · 완료 1건 · 2048바이트\nB · TX-0917 · 외부 보관소 · 승인 취소 · 0바이트\nC · TX-0916 · 외부 보관소 · 승인 취소 · 0바이트\n\n선택한 색인을 원본 영수증과 대조합니다.', refs=['f-queue'], mode='choice', choices=[('A','색인 A'),('B','색인 B'),('C','색인 C')], hints=['같은 결과라도 다른 요청의 영수증이면 근거가 될 수 없습니다.', '요청 번호, 취소 처리, 외부 회선 증가량을 함께 비교하세요.', 'TX-0917의 취소 처리와 0바이트가 동시에 맞아야 합니다.']),
    ],
    [
        stage('열린 문 추적', '마지막으로 열린 장치의 실제 문 번호는? 영문과 숫자 네 글자로 입력하세요.', 'B204', refs=['hotel-404-f1','hotel-404-f2'], hints=['카메라 이름과 출입 장치 이름을 구분하세요.', '출입 이벤트의 장치 번호를 대장에서 찾으세요.', 'D-07의 연결 위치를 영문까지 입력하세요.']),
        stage('화면 속 날짜', '모니터 안쪽 원본 기록의 촬영일은? 월·일 네 자리로 입력하세요.', '0612', '시설 점검 메모\n\n오늘: 09-28\n6월 보수공사: 06-10 시작 / 06-15 종료\n복도 우측 노란 덮개: 보수공사 종료일 철거\n\n캡처에서 원본 기록과 프런트 화면 표지를 각각 확인하세요.', refs=['hotel-404-f3'], hints=['화면의 큰 표지 외에 원본 기록을 살펴보세요.', '장면 아래쪽에 촬영 날짜가 남아 있습니다.', '06-12를 월·일 네 자리로 쓰세요.']),
        stage('반복 구간 찾기', 'F-8821 장면이 다시 나타나기까지 몇 초가 지났나요?', '12', '프런트 모니터 점검 / 관찰 시각은 오늘의 프런트 시계\n\n00:04:00 · 원본 F-8821 · 카트 앞바퀴가 문턱에 닿음\n00:04:04 · 원본 F-8822 · 카트가 복도 가운데에 있음\n00:04:08 · 원본 F-8823 · 카트가 우측으로 빠져나감\n00:04:12 · 원본 F-8821 · 카트 앞바퀴가 문턱에 닿음\n\n원본 장면 번호는 촬영 때 붙은 번호입니다.', refs=['hotel-404-f3'], hints=['관찰 시각과 원본 장면 번호를 따로 읽으세요.', '같은 장면 번호가 나오는 두 줄을 찾으세요.', '00:04:00과 00:04:12의 차이를 계산하세요.']),
        stage('오늘의 이동 경로', '오늘 남은 R17의 위치 기록을 시간순으로 배열하세요.', '3142', '배송 장치 R17 / 09-28 위치 기록\n\n지점 1 · B204 문 · 00:04:08\n지점 2 · 세탁실 · 00:06:21\n지점 3 · 지하 적재대 · 00:03:42\n지점 4 · 지하 연결 통로 · 00:05:10\n\n모두 오늘의 장치 시계로 기록했습니다. 지점 번호는 지도에 붙인 번호이며 이동 순서가 아닙니다.', mode='sequence', choices=[('1','B204 문'),('2','세탁실'),('3','지하 적재대'),('4','지하 연결 통로')], hints=['오늘의 위치 기록만으로 경로를 만들어 보세요.', '지점 번호보다 시각을 먼저 비교하세요.', '적재대에서 시작해 세탁실에서 끝납니다.']),
        stage('배송 수량 검산', '오늘 R17이 인계한 시트는 몇 묶음인가요?', '12', '야간 세탁물 재고표 / 09-28\n\n적재 전 지하 창고: 20묶음\nR17 출발 후 창고: 8묶음\n세탁실 인수 전: 3묶음\n세탁실 인수 후: 15묶음\n\n점검 구간에 다른 반출입은 없었습니다. 창고 감소량과 세탁실 증가량이 일치하는지 확인한 뒤 완료증을 열어 주세요.', hints=['출발지와 도착지의 재고 변화를 각각 구하세요.', '창고의 20과 8, 세탁실의 3과 15를 대조하세요.', '20−8과 15−3이 같은지 확인하세요.']),
    ],
    [
        stage('유효 입찰 선별', '마감과 취소를 반영한 최종 유효 최고 입찰자의 닉네임은?', 'ORBIT', refs=['auction-seven-f0','auction-seven-f1','auction-seven-f2','auction-seven-f3'], hints=['최고 금액부터 바로 고르지 말고 무효 입찰을 제외하세요.', 'B-72는 취소됐고, 마감은 접수 순번 120입니다.', '남은 최고 금액이 같으면 먼저 접수된 입찰을 고르세요.']),
        stage('봉인표 대조', '유효 최고 입찰 B-71의 원본 봉투를 고르세요.', 'B', '봉투 검수대 / 촬영 사진의 봉인표 확대 기록\n\n봉투 A · 물품 LOT-11 · 입찰 B-71 · 봉인 손상 없음\n봉투 B · 물품 LOT-27 · 입찰 B-71 · 봉인 손상 없음\n봉투 C · 물품 LOT-27 · 입찰 B-73 · 봉인 손상 없음\n\n입찰 번호는 경매 회차마다 다시 사용됩니다. 물품 번호와 입찰 번호를 함께 확인합니다.', mode='choice', choices=[('A','봉투 A'),('B','봉투 B'),('C','봉투 C')], hints=['봉투의 물품 번호도 확인해야 합니다.', '이번 사건은 LOT-27 경매입니다.', 'LOT-27과 B-71이 함께 적힌 봉투를 찾으세요.']),
        stage('정산 금액 확인', '낙찰자가 추가로 낼 금액은 몇 만 원인가요?', '222', 'LOT-27 정산 규정\n\n유효 낙찰가: 입찰 접수표 참조\n구매 수수료: 낙찰가의 5%\n이미 낸 보증금: 30만 원\n추가 납부액 = 낙찰가 + 수수료 − 보증금\n\n추가 세금과 배송비는 없습니다. 모두 만 원 단위입니다.', refs=['auction-seven-f1'], hints=['유효 낙찰가에 수수료를 더한 뒤 보증금을 빼세요.', '240만 원의 5%를 먼저 계산하세요.', '240 + 12 − 30을 계산하세요.']),
        stage('화면 갱신 추적', 'MOTH의 접속 종료 뒤 화면 값이 바뀌기까지 걸린 시간은 몇 초인가요?', '7', '전광판 갱신 점검 / 서버 시각\n\n21:59:53 · MOTH 접속 종료\n21:59:53 · 전광판 마지막 수신값 유지\n22:00:00 · 마감 처리 후 전광판 갱신\n\n접속 상태 기록은 입찰 원장과 별도로 남습니다. 두 시각 사이에 전광판 갱신은 없었습니다.', hints=['59분에서 다음 분으로 넘어가는 구간입니다.', '21:59:53부터 22:00:00까지 세어 보세요.', '60초에서 53초를 빼세요.']),
        stage('접수 순서 재구성', '같은 물품의 접수 조각을 순번이 빠른 순서대로 배열하세요.', '2413', 'LOT-27 접수 조각\n\n조각 1 · 순번 120 · PEARL 입찰\n조각 2 · 순번 115 · ORBIT 입찰\n조각 3 · 순번 121 · MOTH 재입찰\n조각 4 · 순번 117 · B-72 취소 처리\n\n취소 처리도 접수 순번을 사용합니다. 마감 이후 기록까지 포함해 원장의 순서를 복원하세요.', mode='sequence', choices=[('1','PEARL 입찰'),('2','ORBIT 입찰'),('3','MOTH 재입찰'),('4','B-72 취소 처리')], hints=['조각 번호가 아니라 접수 순번으로 정렬하세요.', '115, 117, 120, 121 순서입니다.', 'ORBIT의 입찰 다음에 취소 처리가 옵니다.']),
    ],
    [
        stage('조명 큐 복원', '실제로 실행된 조명의 카드 번호를 순서대로 입력하세요. 취소된 색은 제외합니다.', '2413', refs=['encore-last-f1','encore-last-f2'], hints=['예정표와 실제 실행 기록을 구분하세요.', '실행된 색을 카드 번호로 바꾸세요.', 'AMBER → BLUE → WHITE → RED 순서입니다.']),
        stage('음원 흔적 비교', '객석 녹음과 기침 간격 두 개가 모두 같은 음원은?', 'B', '음향팀 파형 측정표 / 첫 기침부터 잰 간격\n\n객석 녹음: 4.2초 / 6.8초\n리허설 05: 4.2초 / 7.1초\n리허설 06: 4.2초 / 6.8초\n리허설 07: 3.9초 / 6.8초\n\n두 간격을 모두 비교합니다. 이 비교만으로 사람의 위치까지 알 수는 없습니다.', mode='choice', choices=[('A','리허설 05'),('B','리허설 06'),('C','리허설 07')], hints=['한 구간이 같은 것만으로 고르지 마세요.', '객석 기록의 두 간격이 모두 맞아야 합니다.', '4.2초와 6.8초를 함께 가진 음원을 찾으세요.']),
        stage('앵콜 길이 계산', '비상 재생 구간의 길이는 총 몇 초인가요?', '138', '음향 재생 시각표\n\n비상 재생 시작: 21:56:52\n비상 재생 종료: 21:59:10\n\n장치 시계는 중간에 조정되지 않았고 일시정지도 없었습니다. 전체 길이를 초로 환산하세요.', hints=['분과 초를 나누어 계산해도 됩니다.', '21:56:52부터 21:58:52까지는 120초입니다.', '남은 18초를 더하세요.']),
        stage('안전 통로 연결', '센서에 남은 이동 지점을 시간순으로 배열하세요.', '3241', '스태프 동행 이동 / 센서 시계 일치 확인\n\n지점 1 · 휴게실 · 21:57:21\n지점 2 · 안전 통로 입구 · 21:56:54\n지점 3 · 무대 뒤 · 21:56:50\n지점 4 · 통로 중간 · 21:57:05\n\n센서는 출입 위치만 기록하며 신원은 최종 인계서에서 확인합니다.', mode='sequence', choices=[('1','휴게실'),('2','안전 통로 입구'),('3','무대 뒤'),('4','통로 중간')], hints=['각 센서의 시각을 비교하세요.', '무대 뒤가 가장 이르고 휴게실이 가장 늦습니다.', '무대 뒤 → 입구 → 중간 → 휴게실 순서입니다.']),
        stage('카메라 범위 대조', '정문 영상에 사람이 없었다는 사실만으로 확인할 수 있는 것은?', 'C', '공연장 촬영 구역 안내\n\n정문 카메라: 정문 계단과 매표소만 촬영\n무대 뒤 안전 통로: 카메라 촬영 범위 밖\n휴게실: 건물 내부, 촬영하지 않음\n\n확인 구간 21:56:49~21:57:21의 정문 영상에는 출입자가 없습니다. 센서 기록과 함께 해석하세요.', mode='choice', choices=[('A','건물 안에서 아무도 이동하지 않았다'),('B','누구도 휴게실에 갈 수 없었다'),('C','촬영 구역인 정문으로 출입한 사람은 없었다')], hints=['카메라가 실제로 보는 구역을 확인하세요.', '찍히지 않는 통로의 이동까지 부정할 수 있을까요?', '정문 영상은 정문 촬영 구역에 대해서만 말해 줍니다.']),
    ],
    [
        stage('수신 신호 해독', '세 묶음의 수신 신호를 영문으로 해독하세요. 글자 사이에 공백은 넣지 않습니다.', 'SOS', refs=['monday-loop-f1','monday-loop-f2'], hints=['빗금 하나마다 글자가 나뉩니다.', '점 세 개와 선 세 개를 통신 카드에서 찾으세요.', '첫 글자와 마지막 글자는 S입니다.']),
        stage('마지막 관측 찾기', '종이 노트에서 가장 나중에 남긴 관측 번호 네 자리는?', '1086', refs=['monday-loop-f3'], hints=['화면의 달력 대신 필기의 순서를 확인하세요.', '첫 번째부터 세 번째 관측까지 번호를 비교하세요.', '세 번째 관측에 적힌 번호를 입력하세요.']),
        stage('날짜 조각 맞추기', '마지막 관측의 실제 날짜는? 월·일 네 자리로 입력하세요.', '0916', '정비선 수신 대장 / 하루 한 번 새벽 관측, 누락 없음\n\n09-14 · 월요일 · 첫 번호 1084\n09-15 · 화요일 · 다음 번호 1085\n09-?? · 수요일 · 마지막 번호 1086\n\n마지막 날짜의 끝 두 숫자는 물에 번졌습니다. 이 세 기록은 재전송이 아니며 연속한 사흘 동안 수신했습니다.', refs=['monday-loop-f3'], hints=['번호의 증가와 날짜의 순서를 함께 확인하세요.', '9월 14일과 15일 다음 날입니다.', '9월 16일을 네 자리로 입력하세요.']),
        stage('독립 기록 고르기', 'PC 전원과 저장장치를 모두 공유하지 않는 기록 묶음은?', 'B', '관측소 연결 대장\n\nPC 달력 / 본체 전원 / 본체 저장장치\n외부 모니터 / 별도 전원 / PC 화면을 그대로 표시\n관측 부표 / 독립 배터리 / 부표 내부 저장장치\n종이 노트 / 전원 없음 / 직접 필기\n\n전원만 별개인 것으로는 부족합니다. 기록을 보관하는 곳도 비교하세요.', mode='choice', choices=[('A','PC 달력과 외부 모니터'),('B','관측 부표와 종이 노트'),('C','외부 모니터와 관측 부표')], hints=['별도 전원과 별도 저장은 다른 조건입니다.', '외부 모니터가 보여 주는 내용은 어디에서 오나요?', 'PC 화면을 복사하지 않는 두 기록을 찾으세요.']),
        stage('아침의 순서 복원', '점검 장치에 남은 사건을 발생 순서대로 배열하세요.', '3142', '외부 점검 장치 / 09-16 아침 기록\n\n조각 1 · 07:59:55 · PC 다시 켜짐\n조각 2 · 08:00:02 · 월요일 안내문 표시\n조각 3 · 07:59:40 · PC 전원 끊김\n조각 4 · 07:59:58 · SNAP-MONDAY 불러오기 완료\n\n점검 장치는 별도 배터리로 작동합니다. 순서를 복원하면 정비 담당자의 작업일지와 대조할 수 있습니다.', mode='sequence', choices=[('1','PC 다시 켜짐'),('2','월요일 안내문 표시'),('3','PC 전원 끊김'),('4','백업 불러오기 완료')], hints=['외부 장치의 시각으로 정렬하세요.', '전원이 끊긴 뒤 다시 켜지는 부분을 먼저 놓으세요.', '다시 켜진 후 백업을 불러오고 안내문이 표시됩니다.']),
    ],
]

assets = ['lab','hotel','auction','stage','island']
photo_notes = [
    [('촬영 시각','점검 촬영: 벽시계 기준 03:20. 두 컴퓨터와 보관 장치, 분리된 연결선이 보입니다.'), ('시계 대조표','동시 측정 / 벽시계 03:10 / 기록용 PC 03:17. 사진 속 작은 문자 대신 점검표에 옮긴 측정값입니다.')],
    [('원본 기록','06-12 14:32 / F-8821'),('복도 우측','복도 오른쪽에 노란 공사용 덮개가 있습니다.'),('중앙 카트','접힌 흰 시트가 금속 카트에 여러 겹 놓여 있습니다.')],
    [('검수대','봉투 세 개와 포장된 작품, 입찰 접수표가 놓여 있습니다. 봉인표는 다음 조사 단계의 검수 기록에서 확대해 확인합니다.')],
    [('무대','마이크 스탠드와 닫힌 커튼, 앰버색과 파란색 조명이 보입니다.'),('촬영 시각','공연 종료 후 22:03 촬영. 이 사진만으로 공연 중 사람의 위치를 확정할 수 없습니다.')],
    [('관측 책상','종이 노트, 무전기, 파란 밧줄과 별도 배터리가 놓여 있습니다.'),('창밖','관측 부표가 바다 위에 떠 있습니다. 장치별 전원과 저장 위치는 연결 대장에 따로 기록되어 있습니다.')],
]
alts = ['야간 연구실의 책상과 두 컴퓨터, 기록 보관 장치.', '호텔 복도의 카트 위에 흰 시트가 접혀 있고 오른쪽에 노란 공사 덮개가 있는 녹화 장면.', '경매 검수대 위 봉투 세 개와 포장된 그림.', '닫힌 커튼 앞의 빈 마이크 스탠드와 객석 쪽 음향 장비.', '비 오는 바다를 향한 관측소 책상 위 노트와 무전기, 창밖의 부표.']

expanded = []
for ci, old in enumerate(cases):
    c = copy.deepcopy(old)
    cid = c['caseId']
    c['versionId'] = cid + '-v2'
    c['estimatedMinutes'] = [25,25,30,30,30][ci]
    # Keep story, original evidence and endings. Move final confirmation behind all five checks.
    finals = [f for f in c['files'] if not f['visible']]
    c['files'] = [f for f in c['files'] if not f.get('puzzleId')]
    for f in finals:
        f['parentId'] = cid + '-stage-5'
    c['rules'] = []
    c['puzzles'] = []
    first = next(f for f in c['files'] if f['type'] == 'TEXT' and f['parentId'] is None)
    # Replace old references to a single lock with an honest five-step investigation brief.
    intros = [
        '다음 근무자에게 / 기록 담당 윤서\n\n기록용 PC는 벽시계보다 7분 빠릅니다. 휴지통의 마지막 전송 요청부터 확인해 주세요.\n\n실제 시각을 맞추고, 요청 접수표·처리 순서·전송량·영수증을 차례로 대조해야 합니다. 보관함을 한 번 여는 것만으로는 조사가 끝나지 않습니다.\n\n첫 확인: 요청이 남은 실제 시각을 시·분 네 자리로 적어 주세요. 새벽 3시 5분은 0305입니다.',
        '야간 인계 / 프런트 담당 서린\n\n00:04, 폐쇄된 4층의 404호 앞에 흰 형체가 지나갔습니다. 화면에는 LIVE 표시가 켜져 있었어요. 객실 키는 모두 프런트에 있습니다.\n\n먼저 실제로 열린 문부터 찾고, 녹화 장면과 오늘의 위치·재고 기록을 각각 대조해 주세요. 다섯 확인이 끝나면 재생 진단서와 배송 완료증을 함께 검토할 수 있습니다.',
        '밤의 경매 / LOT-27 “푸른 궤도”\n\n마감 7초 전 MOTH가 접속을 끊었습니다. 전광판에는 MOTH가 남아 있는데 ORBIT는 자신이 낙찰자라고 주장합니다.\n\n마감 이후 입찰은 무효입니다. 가격이 같으면 접수 순번이 빠른 사람이 우선이며 취소는 개별 입찰 번호에 적용합니다.\n\n유효 입찰자를 찾은 뒤 봉투·정산·화면 갱신·접수 순서를 대조하고 봉인 원장을 확인해 주세요.',
        '공연 뒤 남겨진 의뢰\n\n앵콜은 계속 들렸는데 해온은 무대에서 보이지 않았습니다. 정문으로 나가는 모습도 찍히지 않았어요.\n\n실제 실행된 조명의 카드 번호부터 복원해 주세요. 음원 흔적, 재생 시간, 이동 기록과 카메라 범위를 차례로 확인하면 최종 음향 기록과 인계서를 대조할 수 있습니다.',
        '관측 담당 나루의 메모\n\n아침마다 “오늘은 월요일”이라는 문장과 9월 14일 달력이 나옵니다. 하지만 우유는 줄고 파란 밧줄에는 해초가 붙었어요.\n\n먼저 세 묶음의 수신 신호를 통신 카드로 해독해 주세요. 마지막 관측 번호와 실제 날짜, 독립된 기록, 아침에 일어난 순서를 차례로 확인한 뒤 작업일지를 검토해야 합니다.',
    ]
    first['text'] = intros[ci]
    if ci == 0:
        # Keep the exact clock comparison plus a separate scene photo.
        photo_id = cid + '-scene'
        c['files'].append(dict(id=photo_id,type='IMAGE',title='연구실_점검사진',parentId=None,visible=True,text='점검 담당자가 남긴 현장 사진.',assetId='lab',alt=alts[ci],observations=[dict(label=a,text=b) for a,b in photo_notes[ci]]))
    elif ci == 1:
        photo_id = cid + '-f3'
        f = next(f for f in c['files'] if f['id'] == photo_id)
        f.update(type='IMAGE',title='CAM-404_녹화장면',text='프런트 화면에서 보관한 한 장면. 표시와 원본 기록을 살펴보세요.',assetId='hotel',alt=alts[ci],observations=[dict(label=a,text=b) for a,b in photo_notes[ci]])
    else:
        photo_id = cid + '-scene'
        c['files'].append(dict(id=photo_id,type='IMAGE',title=['','','경매_검수대_사진','공연장_현장사진','관측소_현장사진'][ci],parentId=None,visible=True,text='사건 자료에 첨부된 현장 사진.',assetId=assets[ci],alt=alts[ci],observations=[dict(label=a,text=b) for a,b in photo_notes[ci]]))
    stages = plans[ci]
    for n,s in enumerate(stages,1):
        pid, fid, rid = f'{cid}-p{n}-v2', f'{cid}-stage-{n}', f'{cid}-record-{n}'
        refs = s['refs'][:]
        if s['text']:
            refs.insert(0,rid)
            clid = f'{cid}-record-clue-{n}'
            c['files'].append(dict(id=rid,type='TEXT',title=s['name']+'_자료.txt',parentId=None,visible=n==1,text=s['text'],clueId=clid))
            c['clues'].append(dict(id=clid,title=s['name']+' 자료',description='조사 중 확인한 원본 기록.'))
        if n==1 and photo_id not in refs:
            refs.append(photo_id)
        if ci==2 and n==2: refs.append(photo_id)
        if ci==4 and n==4: refs.append(photo_id)
        p=dict(id=pid,title=s['question'],answer=s['answer'],ignoreCase=True,hints=[*s['hints'], '정답: '+s['answer']],stageTitle=s['name'],evidenceIds=refs,inputMode=s['mode'])
        if s['choices']: p['choices']=[dict(value=a,label=b) for a,b in s['choices']]
        c['puzzles'].append(p)
        c['files'].append(dict(id=fid,type='FOLDER',title=f'{n}단계 · '+s['name'],parentId=None,visible=n==1,text='이 단계의 확인을 마쳤습니다. 조사 단계에서 다음 기록을 열어 주세요.' if n<5 else '다섯 확인을 마쳤습니다. 아래의 최종 원본 자료를 읽고 증거를 대조해 결론을 작성하세요.',puzzleId=pid))
        effects=[]
        if n<5:
            effects.append(dict(type='REVEAL_FILE',id=f'{cid}-stage-{n+1}'))
            if stages[n]['text']: effects.append(dict(type='REVEAL_FILE',id=f'{cid}-record-{n+1}'))
        else:
            effects += [dict(type='REVEAL_FILE',id=f['id']) for f in finals]
        if n==1:
            effects += [dict(type='APPEND_MESSAGE',id=m['id']) for m in c['messages'][2:3]]
        if n==5:
            effects += [dict(type='APPEND_MESSAGE',id=m['id']) for m in c['messages'][3:]]
        c['rules'].append(dict(id=f'{cid}-advance-{n}',priority=n,once=True,when=dict(type='PUZZLE_SOLVED',id=pid),then=effects))
    # Neutral summaries in the package too; old saves use the same source-index presentation.
    for cl in c['clues']:
        f = next((f for f in c['files'] if f.get('clueId')==cl['id']),None)
        if f: cl.update(title=f['title'],description='확인한 원본 자료. 기록 사이의 관계는 직접 대조해 보세요.')
    if ci==4:
        c['messages'][3]['text']='다섯 기록을 모두 확인했군요. 작업일지와 부표 원본을 보내 드립니다.'
        next(f for f in c['files'] if f['id']=='monday-loop-f4')['text'] = next(f for f in c['files'] if f['id']=='monday-loop-f4')['text'].split('\n\n외부 관측함 암호')[0]
    expanded.append(c)

out=ROOT/'apps/ghostdesk/src/expanded-cases.json'
out.write_text(json.dumps(expanded,ensure_ascii=False,indent=2)+'\n')
sql=['-- Additive release: preserve v1 packages and every existing account save.']
for c in expanded:
    data=json.dumps(c,ensure_ascii=False,separators=(',',':'))
    sql.append(f"INSERT INTO ghostdesk.case_versions(version_id, case_id, package, published) VALUES ('{c['versionId']}', '{c['caseId']}', $case${data}$case$::jsonb, true);")
sql.append('INSERT INTO ghostdesk.schema_migrations(version) VALUES (4);')
(ROOT/'db/migrations/V004__five_stage_cases.sql').write_text('\n'.join(sql)+'\n')
print('Authored 5 cases, 25 stages; generated additive V004 migration.')
