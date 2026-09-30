# Desktop investigation UX

## Changes

- Files now live in a row-first grid on the desktop, underneath floating windows. The narrow scrolling file rail is removed.
- The grid measures its available area and font size. When the files do not fit, Previous / Next pages keep every file reachable without a scrolling icon strip. Resizing and changing the number of files clamp the page safely.
- A single click opens a file or restores its existing window. Enter and native button Space activation remain supported. Opening a file focuses its window.
- New investigations offer a compact first-memo introduction. The mission bar has an optional investigation guide, and the taskbar explicitly labels the desktop button.
- Locked folders no longer show an evidence list, embedded evidence excerpts, or the specific password question by default. Input and observation controls remain available.
- The password question is in the optional hint dialog. A collapsed section there provides links to available source files; opening the dialog does not mark any source as read. The source is read only when the player chooses to open it.
- Existing incremental hints and the confirmation before revealing a final answer remain unchanged.

## Compatibility and checks

Case packages, puzzle answers, evidence assets, save schema, logical time and persistence are unchanged.

Type checking and all 262 tests across 17 files pass. New regression checks cover single-click file opening and restoration, default-hidden guidance, opt-in source reading and unchanged case data in all five current cases. A measured-grid test covers paging through every file, growing/shrinking the viewport, page clamping after files disappear, and observer cleanup. The existing 50-puzzle UI walkthrough now also verifies that the password question and evidence panel are absent from locked folders.

Production browser checks are recorded separately from automated tests.
