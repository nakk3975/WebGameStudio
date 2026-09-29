# GhostDesk 종료·복원 시간 검증 — 2026-09-29

기준 커밋: `ea0b24d1e6fe3e4add9bf1414a1b2ee50a789105`

## 확인한 원인과 범위

사용자가 겪은 브라우저 종료 상황 자체는 이 환경에서 직접 재현하지 못했다. 아래는 실제 App/Player 컴포넌트와 저장 모듈을 실행한 재현 결과다. 실제 브라우저의 종료 이벤트 순서나 운영 계정 서버 검증으로 해석하면 안 된다.

1. **일시정지 창을 닫으면 의도치 않게 재개된다.** `Player`의 pause Modal에 전달한 `onClose`가 `RESUME`이었다. `Modal`은 ×와 Esc의 `cancel` 이벤트 모두 이 콜백으로 전달한다. 홈 → 이어서 조사 → ×/cancel 경로에서 `계속하기`를 누르지 않아도 `PAUSED / logicalMs=1000`이 `RUNNING / 2000`으로 변했다. 비회원과 계정 경로 모두 동일했다.
2. **메모리에 남은 RUNNING 저장은 복원 검증을 우회할 수 있다.** 정상 `leave()`는 일시정지 저장을 기다리므로 문제없다. 하지만 엔진 ERROR 화면의 `onExit`는 직접 홈으로 이동한다. 이때 마지막 정상 저장은 RUNNING일 수 있고, 홈의 `setActive(saved)`가 `parseSave` 없이 이를 Player에 전달한다. 테스트에서 엔진 오류를 주입한 뒤 홈 → 이어서 조사로 재현했다. 사용자 사건에서 실제로 같은 엔진 오류가 발생했다는 증거는 없다.
3. **종료 직전 저장에는 빈틈이 있다.** 기존 blur/visibilitychange는 상태 업데이트만 보내며 저장은 500ms debounce에 의존한다. 그 전에 언마운트하면 pause 저장이 취소된다. `pagehide`에는 핸들러가 없었다. 단독 pagehide 이벤트를 전달한 테스트에서는 RUNNING 상태가 유지됐고, 즉시 언마운트한 테스트에서는 최신 `1000 / PAUSED` 대신 이전 `250 / RUNNING` 저장이 남았다. 실제 브라우저에서 blur/visibilitychange가 누락됐는지는 확인하지 못했다.

다음 후보는 재현되지 않았다.

- **종료 중 경과한 실제 시간을 logicalMs에 더하는 동작**: 코드에 없으며, 마지막 저장 이후 1시간을 진행한 재마운트에서도 logicalMs가 증가하지 않았다.
- **오래된 RUNNING 디스크/서버 저장만으로 자동 재개**: `parseSave → restoreState`를 거치면 PAUSED가 된다.
- **저장 순서 역전**: 기존 `createSaveQueue`는 이전 RUNNING 쓰기가 끝난 뒤 최종 PAUSED 쓰기를 수행했다. 계정의 지연된 RUNNING PUT 응답도 최신 PAUSED 로컬 상태를 덮지 않았다.

## 수정

- pause Modal의 ×를 없애고 Esc/cancel은 일시정지 상태를 유지한다. `조사 계속하기` 버튼만 RESUME을 보낸다. 같은 창에 `홈으로`(테스트 플레이에서는 `제작기로 돌아가기`)를 제공한다.
- 홈의 `이어서 조사`는 메모리에 있는 저장도 `parseSave`를 거쳐 연다.
- blur, 숨김 visibilitychange, pagehide에서 일시정지 스냅샷을 즉시 기존 직렬 저장 큐에 넣는다. React 렌더 후 debounce를 기다리지 않는다.
- `ghostdesk-save-1`, schemaVersion, engineVersion, 저장 키, 서버 revision 계약은 변경하지 않았다. 엔진의 restoreState/TICK도 그대로다.

종료 이벤트가 전달되더라도 브라우저가 종료 직전 비동기 IndexedDB/HTTP 작업 완료를 보장하지는 않는다. 강제 종료 시에는 마지막으로 커밋된 저장으로 복원되며, 그 저장이 RUNNING이어도 PAUSED로 복원된다. 이 수정은 종료 시점의 모든 미커밋 진행을 무조건 보존한다고 보장하지 않는다.

## 회귀 검증 결과

`tests/player-lifecycle.test.ts`는 실제 React App/Player를 jsdom에 마운트한다. IndexedDB API 구현은 fake-indexeddb이며, 로그인 상태와 HTTP 서버만 테스트 대역이다. 계정의 CloudSaves, cloudTransport, parseRemote, parseSave는 실제 코드를 실행한다. `download`만 감시 함수로 교체해 Player의 현재 스냅샷을 관찰한다. 250ms마다 React 업데이트를 커밋하며 게임 시간을 진행한다.

| 시나리오 | 결과 |
| --- | --- |
| 비회원·계정: 홈 → 이어서 조사 → 5초 대기 | 1000 → 1000, PAUSED |
| 위 상태에서 명시적 조사 계속하기 → 1초 | 1000 → 2000, RUNNING |
| 비회원·계정: 마지막 RUNNING 저장 후 컴포넌트 종료 → 1시간 → 재마운트 | 마지막 커밋 값 유지, PAUSED |
| 비회원·계정: 복원 창 ×/cancel | × 없음, cancel 후 1000 유지 |
| 비회원·계정: pagehide만 전달 → 5초 대기 | 1000 → 1000, PAUSED |
| 비회원·계정: pagehide 직후 언마운트, debounce 대기 없음 | PAUSED/1000 저장, 재마운트 후 동일 |
| 비회원·계정: blur/숨김 visibilitychange | debounce 전에 PAUSED/1000 저장 |
| 비회원·계정: 엔진 오류 주입 → 홈 → 메모리 저장 이어하기 | PAUSED 복원, 대기 중 증가 없음 |
| 새 계정 기기: 서버에만 RUNNING/4250 저장 | 5초 대기 후 4250, 계속하기 1초 후 5250 |
| IndexedDB 이전 RUNNING 쓰기를 지연한 채 홈 이동 | RUNNING → PAUSED 순서로 커밋 후 홈 이동 |
| 계정 RUNNING 업로드 응답을 최종 PAUSED 저장보다 늦게 반환 | PAUSED/4250 유지, 재초기화 후 revision 2로 업로드 |

수정된 테스트를 기준 main의 App/Player에 다시 실행했을 때 관련 33개 중 **14개 실패 / 19개 통과**였다. 패치에서는 관련 **33개 전부 통과**했다. 따라서 기존 저장 큐 검증은 원래도 통과하며, 새 pause·재진입·종료 처리 회귀는 기존 코드에서 실패한다.

최종 검사:

- `npm run typecheck`: 통과
- `npm test`: **11개 파일, 167개 테스트 통과** (기존 146개 + 신규 21개)
- `npm run build`: 통과. 라이브러리의 use-client 지시문 및 번들 크기 경고는 남아 있다.
- `git diff --check`: 통과

## 실제 브라우저에서 남은 확인

Chromium은 설치했지만 실행 시 `socket() failed: Operation not permitted`로 종료되어 아래 항목은 미검증이다. jsdom의 재마운트는 탭/브라우저 프로세스 재시작과 같지 않으며, 합성 pagehide는 실제 BFCache 검증이 아니다.

- 비회원: 실제 IndexedDB가 있는 프로필에서 탭 닫기·브라우저 종료·강제 종료 → 재실행
- 로그인: 실제 인증 세션 및 운영 저장 API를 사용한 동일 경로, 오프라인 종료 후 재연결
- 실제 pagehide/visibilitychange 순서 및 BFCache 복귀

실기기 확인 시 종료 직전 진행 파일의 `state.logicalMs`와 재실행 뒤 값을 기록한다. 정상 홈 이동은 값이 같아야 한다. 강제 종료는 마지막 커밋 이전으로 돌아갈 수 있지만, 이어서 조사 화면에서 계속하기를 누르기 전에는 값이 증가하면 안 된다. 복원 뒤 5초 기다린 다음 홈으로 돌아가 진행 파일을 내보내 비교하면, 계속하기를 누르지 않고도 복원 값의 동결 여부를 확인할 수 있다.
