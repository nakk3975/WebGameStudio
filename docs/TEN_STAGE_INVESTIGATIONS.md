# Ten-stage investigations (v5)

Based on the supplied **GhostDesk Web Game Plan v2 (2026-09-28)**, especially
sections 03, 06–08, 10, 13 and 19. The core remains a fictional desktop: open
files, compare independent records, unlock material, and submit a conclusion
with evidence. No real operating-system commands, external investigation,
runtime AI, or new paid service is involved.

## Scope

Five existing cases now have **10 stages each, 50 total**. Their original five
answers are unchanged. Each new second half adds ten source documents, three
messages, a document image and an extended evidence-based ending. The theatre
also adds an 11-second output-meter recording. Estimated 45–50 minutes is an
editorial estimate, not a measured user completion time.

| Case | Second-half investigation | New deductions, stages 6–10 |
| --- | --- | --- |
| 03:17에 멈춘 전송 | 남겨진 복사본 | Identify matching internal copy; correct the card reader's separate clock; reconstruct preservation handover; distinguish confirmed signatures from a rehearsal form; explain the empty filtered work list |
| 자정의 404호 | LIVE 아래의 기록 | Identify fallback profile; correct a timestamp across midnight; reconstruct maintenance; distinguish fresh frames from moving old frames; establish the missed fixed-label check |
| 낙찰 7초 전 | 잘못 붙은 인수표 | Match the work and its crate; deduplicate payment notifications; trace temporary/final printing; select a valid collection slip; identify the stale display as the source of the wrong name |
| 마지막 앙코르 | 객석에 닿지 않은 말 | Identify the request and relay; trace headset/audience outputs; order the request and track switch; reconcile audience testimony with successful playback; establish the retained test output selection |
| 월요일이 두 번 온 날 | 돌아오지 않은 작업 목록 | Identify the independent Wednesday original; convert the relay's explicitly labelled UTC time; order preservation steps; distinguish attempt/receipt/handover; restore the work index without overwriting the original |

All new tables are exact authored document images with complete text
transcripts, not new photographs of inconsistent locations. The output-meter
clip is explicitly a reconstruction of recorded signal presence, not a video
of a person's position. Its poster is extracted from its decoded frame 20.

## Consistency review

- Hotel: the 404 door is ajar; the repair cover is between doors; the worker
  moves forward. The original 12-second footage repeats on the monitor. The
  current delivery robot is in the basement and is not the person in June's
  footage. A static LIVE label is separate from input and door events.
- Auction: v5 uses the same striped original envelope in the scene and puzzle.
  Old plain-envelope editions remain archived. The new crate index explicitly
  concerns artwork packaging, not the three bid envelopes. One payment ID
  produces two notifications but only one completed payment.
- Lab: the PC is seven minutes fast, the card reader five minutes fast. Internal
  validation/copy/seal occur at 03:10:03/12/18, within the original meter interval
  (PC 03:16:50–03:17:20). Card entry 03:12 and signed handover 03:13 follow.
- Theatre: the compressed lighting clip does not measure performance duration.
  Photographs are from 22:03 after the show. NOTICE-02 uses B2/headsets at
  21:56:51–54, while REHEARSAL-06 starts on B1/audience at 21:56:52. The later
  21:59:12 announcement does not contradict testimony ending at 21:57:00.
- Island: independent buoy and relay storage are distinct from the restored PC
  list. The maintenance boat originally sent SOS; receipt and subsequent
  handover require their own matching R-086 records. 09-15 21:42 UTC becomes
  09-16 06:42 local; 07:30 handover precedes the investigation messages.
- Message ordering and evidence availability were checked. New late records
  cannot be opened before their stage, including their image attachments.

## Save and publication compatibility

`schemaVersion: 1` and `ghostdesk-core-1` remain unchanged. The 19 earlier
published packages remain immutable. Old progress continues its original
edition; choosing **새 조사 시작** opens v5 and uses the existing previous-save
archive flow. There is no automatic conversion of solved puzzle IDs or endings.
The home screen states saved/new stage counts explicitly.

`V007__ten_stage_investigations.sql` only inserts the five official v5 packages
into the existing catalog. No schema, permission, user-save or publication
visibility setting is changed. Existing public cases receive new public
editions, within the user's requested deployment scope. The API code is unchanged.

## Verification

- `npm run typecheck`, `npm test`, `npm run build` are required for this release.
- Authored answer fixtures cover all 50 stages, incorrect answers, locked future
  stages, both endings, complete clue collection, and delayed-message uniqueness.
- At every stage, serialization/restoration and a 60,000ms TICK leave logicalMs
  unchanged until explicit RESUME. Existing guest IndexedDB, account outbox,
  lifecycle and stale-save regression tests remain enabled.
- Component tests submit all 25 new answers through actual Player controls and
  check every text/photo/video attachment and every late-source access boundary.
  These jsdom checks are not a real-browser playtest.
- Migration is first applied on `verify-initial-catalog` and compared against all
  19 old package fingerprints before production. Bundled JSON and SQL payloads
  must be structurally identical for account saves.
- Real-browser and production verification are recorded separately in the
  release result. Local-browser access was blocked by the browser environment;
  this is not counted as a passed local browser check.

Reproduction sources: `scripts/ten-stage-cases.py`,
`scripts/build-chapter-media.py --font <Korean-font.ttf>`. The latter uses Pillow
for exact diagrams and FFmpeg for the time-based recording; no image-generation
or runtime network dependency is needed to play.

Rollback: deploy the prior frontend commit. Leave additive v5 catalog rows in
place so any v5 account save remains valid. Old version URLs remain available.

## Production/browser verification, 2026-09-29

- 240 automated tests, typecheck and build passed after the browser follow-up.
- All five production API v5 packages are structurally identical to the bundle.
  All 19 preceding database packages kept their original fingerprints.
- 35 deployed image/video/CSS assets matched the verified local build byte for
  byte (5,919,272 bytes before the small UI-only follow-up).
- Real Chrome: old hotel v4 save resumed PAUSED; Escape did not resume it.
- Real Chrome: theatre v5 stages 6–10 were played from a generated five-stage
  checkpoint. Separate document image, video playback to the end, choice/text/
  sequence controls, late unlocks, and the final ending were verified. Old-only
  conclusion evidence was rejected; adding the new final records allowed it.
  This is not a claim of manual playthrough of all 50 stages.
- Browser checks found two display issues: stage five still had old final-stage
  boilerplate, and the output video's end marker rounded one second past the
  last captured frame. The viewer now gives a midpoint instruction and clamps
  that timestamp. Regression checks cover both without rewriting published v5.
- Original browser progress was exported before the test; the theatre save is
  restored afterwards. Account outbox/restore is tested automatically; no live
  signed-in player's save was modified for testing.
- The API cold start initially exceeded the request timeout. After it started,
  /health/ready returned 200 and all five package checks passed.
