# GhostDesk — 가상 컴퓨터 속 추리게임

첨부된 「GhostDesk 웹게임 기획서 v2.0」에 따라 개발한 브라우저 추리게임입니다.
첫 사건은 **03:17에 멈춘 전송**입니다. 설치 없이 웹브라우저에서 기록을 읽고, 보관함을 열고, 증거를 골라 결론을 제출합니다.

## 지금 가능한 것

- 가상 데스크톱: 파일 열기, 창 이동·전환·최소화·최대화·좌우 배치, 작업표시줄.
- 인수인계·메신저·시계 자료·휴지통 로그·잠금 보관함·처리 영수증.
- 단서 수집, 추리 노트, 단계별 힌트, 두 결론과 오답 결론에서 조사 재개.
- DOM과 분리된 결정론적 엔진: 논리 타이머, 순서가 고정된 once 규칙, 전파 예산과 롤백.
- IndexedDB 저장, JSON 내보내기/복구, 탭 이탈 시 일시정지.
- 로컬 제작기: 샘플 복제, 10개 초안, 파일·단서·퍼즐·대화·규칙·엔딩·가설 폼, React Flow 연결 보기, 실행 취소/다시 실행, 참조 오류 검사, 별도 스냅샷 테스트.
- 원본과 다른 ID로 JSON 가져오기. HTML·외부 URL·잘못된 참조·용량/깊이 초과 검사.

## 플레이

웹 주소: https://ghostdesk-p24l.onrender.com

Neon DB와 Render API 연결을 완료했습니다. 공개 사건 목록과 버전 패키지를 DB에서 조회합니다. 서버 응답이 늦을 때는 번들 사건으로 바로 플레이할 수 있습니다. 개인 진행과 제작기 초안은 현재 기기에 저장됩니다. 배포 검증 결과는 `docs/DEPLOYMENT.md`에서 확인할 수 있습니다.

배포 전 확인용 `output/GhostDesk_Play.html`은 JS/CSS를 포함한 단일 HTML입니다. 다운로드한 파일을 Chrome/Edge로 열 수 있습니다. 브라우저별 file origin 저장 정책은 다를 수 있으므로 중요한 진행은 JSON으로 내보내세요. Chrome/Edge 실기기에서의 단일 파일 실행은 별도 확인 대상입니다.

조작: 바탕화면에서 파일을 더블클릭하거나 Tab → Enter. 모바일 너비에서는 한 번 눌러 엽니다. Esc는 현재 창을 닫습니다. 창 제목 표시줄 버튼으로 좌우 배치/최대화가 가능합니다.

## 개발 명령

Node 24.19.0 / npm lockfile을 사용합니다.

```sh
npm ci
npm run typecheck
npm test
npm run dev -- --host 0.0.0.0 --port 4173
npm run build
npm run standalone
```

- `apps/ghostdesk`: React/TypeScript/Vite 화면, 샘플 사건, IndexedDB 어댑터
- `packages/engine-ghostdesk`: 외부 I/O 없는 사건 reducer
- `packages/contracts`: Zod 형식 검사, 참조/접근성 검사, 복제
- `tests`: 자동 검증
- `docs/IMPLEMENTATION.md`: 구현 범위, 한계, 후속 단계
- `docs/VERIFICATION.md`: 실제 실행 결과
- `apps/api`: Java 21 / Spring Boot 3.5 / MyBatis 공개 사건 API
- `db/migrations`: 버전 관리하는 Neon PostgreSQL 초기 스키마·샘플
- `render.yaml`: Render 정적 사이트 + 무료 Docker API 배포 설정
- `docs/DEPLOYMENT.md`: 서버 설정과 운영 확인 방법

## 구현 단계

G0 게임 진행과 G1 로컬 기능, G2 제작기 기본 기능까지 구현했습니다. G2의 모든 기획 항목이 완료된 것은 아닙니다. 세부 차이는 IMPLEMENTATION.md에 기록했습니다.

Spring Boot/MyBatis 공개 사건 조회 API와 Neon PostgreSQL 스키마·샘플을 추가했습니다. 웹은 서버의 사건 패키지를 검증해 가져오며, 서버 응답이 늦거나 없을 때 번들 샘플로 즉시 플레이할 수 있습니다.

G3 인증·개인 초안/진행 동기화·제작기 서버 발행·초대, G4 커뮤니티 목록 화면·신고·운영 도구는 **미구현**입니다. 현재 API는 공개 샘플 조회만 제공합니다.

이 버전은 소스 번들에 정답이 있습니다. 경쟁/상품용 판정이나 비밀 콘텐츠 배포에 사용할 수 없습니다. 로컬 저장은 백업이나 기기 간 동기화가 아닙니다.

## 서버 실행

Java 21과 Maven 3.9가 필요합니다. `.env.example`에 적힌 서버 변수를 환경에 주입합니다.

```sh
mvn -s apps/api/maven-settings.xml -f apps/api/pom.xml verify
java -jar apps/api/target/ghostdesk-api.jar
```

- `GET /health/live`: DB를 깨우지 않는 프로세스 상태
- `GET /health/ready`: 실제 DB·공개 사건 조회 확인
- `GET /api/v1/ghostdesk/catalog`: 최대 50개 공개 사건
- `GET /api/v1/ghostdesk/versions/demo-0317-v1/package`: 샘플 사건

이 저장소는 공개입니다. DB 비밀번호·개인 진행·초안은 커밋하지 않습니다.
