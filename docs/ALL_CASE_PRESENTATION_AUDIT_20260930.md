# All-case presentation audit (2026-09-30)

## Scope

Reviewed all five current cases: 158 files, 50 puzzles, messages, supporting records and endings. Compared the displayed photo subjects, video events, clue labels and document-table values with the written sources. Also checked file presentation and available media across all 24 official saved editions; this is not a claim that every archived story was replayed manually.

The current photographs, envelope markings, hotel room/door positions, characters, and all five follow-up comparison tables agree with the relevant sources. No additional photo replacement was warranted. The previously corrected laboratory tower, clock text record, ordinary folder names and automatic progression remain in place.

## Confirmed discrepancies corrected

| Area                    | Finding                                                                                                                                                         | Correction                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Auction reception       | `입찰_접수표.csv` contains prose rather than CSV rows.                                                                                                          | Present it as `입찰_접수표.txt` throughout the player.                                                            |
| Video files             | Hotel footage looked like a still-image file; three other recordings used `.cam` and text-file icons.                                                           | Present actual recordings as `.mp4` with video icons. Text-backed video views identify themselves as `영상 기록`. |
| Stage output log        | `버스_출력계.log` embedded a video in the ordinary log window.                                                                                                  | Keep the written log separate and open the attached recording in its own accessible window.                       |
| Archived editions       | Older island scenes and auction captions referred to videos those editions did not include; the older hotel text puzzle asked for unavailable capture controls. | Refer to the actual text source or use the input instruction appropriate to that edition.                         |
| Hotel stills            | The footage caption used the obsolete folder name `사진 자료`.                                                                                                  | Refer to `이미지 자료`.                                                                                           |
| Hotel source comparison | Candidate A gave frame F8821 a different time from its original recording.                                                                                      | Display the consistent original time, 06-12 14:32. Its date and puzzle answer are unchanged.                      |
| Auction endpoint        | At 11 seconds, the player time label advanced one second beyond the last encoded frame.                                                                         | Hold the label at frame 263's time. The two comparison moments and the seven-second answer are unchanged.         |

The production browser check found one further discrepancy: pausing the 10 fps output-meter recording at playback position 9.917966 seconds showed the frame marked 21:57:00 while the overlay said 21:56:59. `currentTime` is a playback position, not a guarantee of the displayed frame's timestamp. The shared video player now uses the presented frame's `mediaTime` for its timestamp overlay via `requestVideoFrameCallback`, with playback-clock fallback on older browsers. Timeline controls and puzzle answers are unchanged. Regressions cover clock/frame disagreement, pause, seeking back and callback cleanup. API reference: [MDN requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback).

These are presentation-only corrections. Published case JSON, schema/engine versions, file/clue IDs, rules, answers and database packages are unchanged. Both guest and account saves retain the original package required by exact package validation. No reset or migration is required. Custom packages keep their original file names.

## Automated and media verification

- `npm run typecheck`: passed.
- `npm test`: 256 tests passed across 16 files.
- `npm run build`: passed; existing dependency-directive and bundle-size warnings remain.
- Player tests now enter all 50 answers through the actual React controls, including photo choices, sequence inputs and video comparison controls. They check all 45 automatic transitions and keyboard focus, and require an explicit conclusion after the final puzzle. Video-comparison tests use the accessible scene-description controls because jsdom does not decode video.
- Every current root text record is checked for separate photo/video links. Attached videos open their own window where appropriate; genuine video files retain their player and video icon.
- All 24 official saved editions retain their exact case package and stay PAUSED with unchanged `logicalMs` until explicit resume. Existing IndexedDB and account-save lifecycle/race regressions pass. Account persistence tests use test doubles, not a signed-in production account.
- `python scripts/verify-recordings.py`: hotel, stage-cue, auction and receiver recordings passed frame/timing checks. Hotel/auction/receiver/stage posters agree with their decoded source frames.
- The separate stage output-meter MP4 was decoded as 110 frames at 10 fps. B1/B2 signal states at 0, 1, 2, 4 and 10 seconds agree with the written log; the poster matches frame 20 exactly.

Production browser checks are recorded separately after deployment in `output/all-case-audit-production-verification.json` and screenshots. Automated coverage is not a substitute for a human playthrough of all five stories.
