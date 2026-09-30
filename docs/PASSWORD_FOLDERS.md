# Password-protected computer folders (2026-09-30)

All five themes now present their ten investigation folders as ordinary directories on the fictional computer. The lock screen says that a password is required, identifies the existing puzzle instruction as a password hint, and uses `폴더 열기` for every input mode. The folder rail shows locked/unlocked status. Correct passwords still open the next available folder automatically; the final conclusion remains explicit.

| Computer    | Folder names, in unlock order                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Laboratory  | 업무 자료, 접수 내역, 작업 기록, 장비 관리, 전송 내역, 보관 자료, 출입 관리, 파일 정리, 인수인계, 백업   |
| Hotel       | 객실 자료, 촬영 자료, CCTV, 근무 기록, 배송 내역, 장비 설정, 네트워크, 시설 관리, 복구 자료, 인수인계    |
| Auction     | 입찰 자료, 검수 자료, 정산 내역, 전광판, 접수 기록, 포장 자료, 결제 내역, 출력 기록, 반출 서류, 인수인계 |
| Concert     | 공연 자료, 음원, 재생 기록, 안전 관리, 현장 자료, 연락 내역, 음향 설정, 방송 기록, 접수 자료, 인수인계   |
| Observatory | 수신 자료, 관측 자료, 일정, 장비 관리, 근무 기록, 별도 보관, 점검 내역, 자료 정리, 인수인계, 백업        |

Direct password input is masked by default and can be shown without changing its value. Leading zeroes are preserved. Choice and ordering controls explain how the selected letter or sequence becomes the password. Photo and video tasks retain their observations and validation, with the same folder-unlock action. These passwords belong only to the fictional game and are not real authentication or encryption.

Names are applied by the viewer to the original folder/puzzle IDs, including older official editions. Published case JSON, saved packages, answers, hints and engine rules are unchanged. Custom folder names remain untouched. Wrong passwords, paused submissions and revisiting unlocked folders preserve the previous behavior.

Verification: the 256-test suite includes all 50 player submissions and automatic folder transitions, all 24 official saved editions, wrong/paused submissions, and password visibility toggling with a leading-zero value. Type checking and production build pass. Production browser verification is recorded separately in `output/password-folders-production-verification.json` and its screenshot.
