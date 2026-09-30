# Investigation folder and 03:17 evidence corrections (2026-09-30)

The clock evidence called `작업실_기록.img` rendered two HTML clock labels, not an image. Official editions now present the same file ID and clue as `시계_대조기록.txt`, with the simultaneous measurements (wall clock 03:10, PC 03:17) in the text reader. Desktop icons, inline puzzle sources, window titles and the evidence board share the corrected name and type.

The laboratory overview's squat five-bay device has been replaced with a conventional black office PC tower. The two monitors remain off. Captions describe the actual scene and link to the separate clock record. The network-cabinet photograph is a different work area and has not changed; its puzzle pins and answers remain valid.

Official numbered puzzle folders now use ordinary record names in all five cases, including old editions. For example, the laboratory begins with `전송 보관함`, `요청 접수함`, `처리 이력`. The navigation strip and lock heading use the same names without stage-number labels.

After a newly correct answer, Player checks the **post-transition** state for the next accessible puzzle folder and reuses the current window, preserving its position/layout and moving keyboard focus. Wrong answers and submissions while paused do not advance. A full set of 12 windows still permits advancing, and other evidence windows stay open. Solved folders can be reopened. The last folder remains open for reading evidence and explicitly submitting a conclusion; advancing never collects unread child-file clues or submits a conclusion automatically.

All corrections are presentation changes. Published case JSON, case/version IDs, answers, rules and database packages remain unchanged. Guest and account saves retain their original case package for exact package validation. No new case edition, database migration or progress reset is needed.

## Verification before deployment

- `npm run typecheck`: passed.
- `npm test`: 250 tests passed across 15 files.
- `npm run build`: passed (existing bundle-size and dependency directive warnings).
- Added 10 regressions: text evidence/clue preservation in every laboratory edition; restored pause and explicit resume; stale paused submit and wrong answer; next-folder activation/focus; a visual answer at the 12-window cap; access to the original receipt after auto-advance; immutable official packages and unaffected custom file names.
- Existing player tests now verify automatic transitions across all 25 follow-up puzzles in all five cases, and explicit conclusions after the last puzzle.
- Existing guest/account lifecycle regressions and archived-save pause tests pass. These use IndexedDB and cloud test doubles; they are not a claim of signed-in production playtesting.
- Live browser verification is recorded separately after deployment in `output/folder-flow-production-verification.json` and screenshots.

## Image edit provenance

Final project asset: `apps/ghostdesk/src/assets/lab.webp`.
Built-in image generation tool, edit mode; original asset supplied as the edit target. Generated PNG converted to WebP with FFmpeg at quality 88. Visual inspection confirmed the upright PC tower and preserved dark monitors, room layout and loose Ethernet cable.

Final prompt:

> Use case: precise-object-edit. This image is the EDIT TARGET, an existing photographic evidence asset for a mystery game. Replace ONLY the large unnatural squat silver/black five-bay device sitting on the center of the foreground desk with an ordinary realistic compact black desktop PC tower standing upright. The tower must be a coherent rectangular metal enclosure, understated office PC front panel with small power button, two USB sockets, a normal lower vent, no exposed hard-drive bays and no glowing gaming components. Keep its scale practical and its desk footprint similar; leave the books behind it visible. Match the existing camera perspective, cool dim room lighting, shadows, realism and photographic texture. Preserve everything else: both monitors black/off, keyboards, desk, existing disconnected Ethernet cable on the desk, books, notebook, chairs, shelves, back doorway, empty room. Do not add people, clocks, readable text, screen content, new loose cables or new evidence. Wide landscape same framing as input, no cropping.
