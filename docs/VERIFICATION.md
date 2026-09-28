# GhostDesk 0.1 검증 기록

검증일: 2026-09-28. 로컬 개발 환경. 원격 커밋·Render 배포 ID·Neon migration은 없음.

## 자동 실행

- Node 24.19.0 / npm 11.9.0.
- `npm run typecheck`: 성공 (exit 0).
- `npm test`: Vitest 테스트 파일 1개, 테스트 33개 성공 (exit 0).
- `npm run build`: Vite 생산 빌드 성공 (exit 0).
- `npm run standalone`: 단일 HTML 생성 성공. 정확한 최종 용량은 release-manifest.json 참고.
- `render.yaml`: Render 공식 JSON Schema로 검증 성공. 실제 서비스 생성/Render 배포는 미실행.
- `tests/engine.test.ts`: 중복 읽음/단서, 앞자리 0, 전각 숫자 거부, 공백 정규화, 오답 후 재시도, 순서 교환, 필요한 증거, 타이머/메시지 중복, 숨김/일시정지 의미, 엔딩 우선순위, 64단계·256효과 초과 롤백, 잘못된 참조 롤백, 저장 복원, 엔딩 이후 동결, 힌트 마지막 확인, 스냅샷 독립성, 악성/초과 JSON, 폴더 순환, 복제 참조 보존.

## 실제 Chrome UI 검증

개발 HTTP 미리보기에서 사용자가 누르는 버튼/입력으로 수행했다. 아래는 자동 단위 테스트와 구분되는 브라우저 검증이다.

| 동작 | 확인 결과 |
|---|---|
| 사건 시작 → 첫 메모 | 읽음과 단서가 표시됨 |
| 휴지통 → 전송 로그 | 창이 열리고 두 번째 단서 수집 |
| 보관함 `310` 입력 | 암호 불일치 메시지 |
| 보관함 ` 0310 ` 입력 | 해제되고 영수증 파일 표시 |
| 해제 뒤 페이지 새로고침 → 이어서 조사 | PAUSED로 복구, 재개 후 보관함 해제·단서 유지 |
| 영수증 읽기 → 정답 가설, 근거 미선택 | 필수 근거 부족 안내, 계속 조사 가능 |
| 민재 단정 → 엔딩 B | 근거 부족 설명과 조사 재개 제공 |
| 조사 재개 → 로그·영수증 선택 → 정답 가설 | 엔딩 A 도달 |
| 제작기 제목 수정 → 실행 취소 | 기존 제목 복원, revision 증가 |
| 조건 그래프 | 실제 규칙/조건/효과 노드 표시 |
| 테스트 플레이 | TEST SNAPSHOT 표시, 별도 초기 상태 |
| 테스트 중 메모/시계 자료 열기 | 단서 수집; Enter로 파일 열기 동작 |
| 두 문서 좌우 배치 | 같은 화면에서 비교 가능, 캡처 첨부 |
| 테스트 종료 → 일반 이어하기 | 기존 엔딩 A 유지; 테스트가 기존 슬롯을 덮어쓰지 않음 |
| 360px iframe의 홈/플레이 | 버튼 줄바꿈/가로 넘침 수정 후 body scrollWidth=clientWidth |
| 360px 파일 열기·엔딩 보기 | 한 번 클릭으로 열기, 내용 영역 스크롤 가능 |

화면 근거: `docs/evidence/ghostdesk-home.jpg`, `ghostdesk-desktop.jpg`, `ghostdesk-mobile-fixed.jpg`.

브라우저 초기 연결에서 지연이 있었으며 개발 서버 옵션을 정리한 뒤 연결됐다. 로컬 file: URL은 테스트 브라우저 정책상 열 수 없어 HTTP 미리보기를 사용했다. 이는 단일 HTML 파일을 Windows Chrome/Edge에서 직접 실행한 검증과는 다르다.

검증 중 발견/수정: 논리 시간 TICK으로 인해 저장 debounce가 반복 취소되는 문제를 실제 변경 키와 타이머 주기 저장으로 분리; 360px 첫 화면의 버튼/상단 폭 초과 수정; HTTP 환경 제작기에서 UUID API 대신 getRandomValues 사용; 복제된 사건의 목표 안내가 원본 ID에 의존하지 않도록 수정.

## 미검증/후속

- Windows Chrome/Edge의 file origin 단일 HTML 실행, Safari/Firefox/WebKit, 실제 휴대전화.
- 네트워크 완전 차단 브라우저 시나리오, 저장소 quota 거부, 두 탭 쓰기 경합의 전체 E2E.
- 200% 브라우저 확대의 전 화면, 스크린리더, 드래그 경계 전체, UI 창 위치 복구.
- 100파일/300메시지 성능, p50/p95, 10Mbps/RTT100ms, cold 5회/warm 30회 목표.
- 처음 플레이하는 사용자 5명의 난이도/재미. 개발자의 정답 경로 완료는 재미 검증이 아니다.
- 서버 인증/소유자 권한, 온라인 저장/409, Neon·Render 유휴 복귀, 운영 백업. 공개 읽기 API의 실제 DB 연결은 아래 0.2 기록 참조.

현재 브라우저 시나리오는 지속 CI E2E 파일이 아닌 실행 기록이다. 원격 저장소 연결 이후 Playwright CI 시나리오를 추가하는 것이 후속 작업이다.

## 0.2 서버 연결 검증

- 프런트 타입 검사, 37개 테스트, 프로덕션 빌드 통과.
- Java 21 / Spring Boot 3.5.16: API 테스트 6개, Maven verify 통과.
- Neon 새 프로젝트의 검증 브랜치에서 마이그레이션 트랜잭션 및 사건 1개, 파일 7개, 엔딩 2개를 확인 후 같은 SQL을 운영 브랜치에 적용.
- 운영 ghostdesk_app 역할: SELECT=true, INSERT/UPDATE/DELETE=false, CREATEDB/CREATEROLE/BYPASSRLS=false 확인.
- 승인 후 Render에 DB 비밀번호를 적용하고 재배포 완료. `/health/ready`, 공개 사건 목록·패키지 모두 200 확인. 패키지는 프런트 검증기를 통과하고 번들 원본과 일치.
- 공개 웹 Origin 허용, 다른 Origin 403, 알 수 없는 버전 404 확인. 웹 새로고침 후 단서 보존과 이어서 조사/재개 확인.
- 프런트 타입 검사·37개 테스트·빌드를 다시 통과. 배포 주소·배포 ID·HTTP 응답 기록은 DEPLOYMENT.md 및 evidence/deployment-2026-09-28.json에 기록.
