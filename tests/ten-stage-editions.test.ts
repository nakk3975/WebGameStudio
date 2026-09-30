import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  archivedCases,
  tenStageLibrary as caseLibrary,
} from "../apps/ghostdesk/src/cases";
import { availableMedia } from "../apps/ghostdesk/src/case-media";
import {
  initialState,
  transition,
  canOpen,
} from "../packages/engine-ghostdesk/src";
import { parseSave } from "../apps/ghostdesk/src/storage";
import visual from "../apps/ghostdesk/src/visual-cases.json";
import motion from "../apps/ghostdesk/src/motion-cases.json";

it.each(caseLibrary)(
  "$number keeps every chapter checkpoint paused and retains the old edition",
  ({ case: c }) => {
    const predecessor = [visual[0], ...motion].find(
      (old) => old.caseId === c.caseId,
    )!;
    expect(
      archivedCases.find((old) => old.versionId === predecessor.versionId),
    ).toEqual(predecessor);
    expect(c.puzzles.slice(0, 5).map((p) => p.answer)).toEqual(
      predecessor.puzzles.map((p) => p.answer),
    );
    let state = initialState(c);
    for (let i = 0; i < c.puzzles.length; i++) {
      state = transition(c, state, { type: "TICK", ms: 750 }).state;
      state = transition(c, state, {
        type: "SOLVE",
        id: c.puzzles[i].id,
        answer: c.puzzles[i].answer,
      }).state;
      const payload = {
        format: "ghostdesk-save-1",
        case: c,
        state,
        notes: "후속 조사 메모",
        checkpoint: null,
      };
      const restored = parseSave(JSON.parse(JSON.stringify(payload)));
      const waiting = transition(c, restored.state, {
        type: "TICK",
        ms: 60000,
      }).state;
      expect(waiting.mode).toBe("PAUSED");
      expect(waiting.logicalMs).toBe(state.logicalMs);
      expect(waiting.solvedPuzzleIds).toEqual(state.solvedPuzzleIds);
      expect(restored.case).toEqual(c);
      if (i === 4) {
        expect(canOpen(c, state, `${c.caseId}-record-6a`)).toBe(true);
        expect(canOpen(c, state, `${c.caseId}-record-7a`)).toBe(false);
      }
      state = transition(c, waiting, { type: "RESUME" }).state;
    }
  },
);

it.each(caseLibrary)(
  "$number makes each new source and image accessible at the intended stage",
  ({ case: c }) => {
    let state = initialState(c);
    expect(
      availableMedia(c, state).some((m) => m.id.endsWith("chapter-image")),
    ).toBe(false);
    for (const [i, puzzle] of c.puzzles.entries()) {
      for (const id of puzzle.evidenceIds ?? [])
        expect(canOpen(c, state, id), id).toBe(true);
      if (i >= 5) {
        expect(puzzle.evidenceIds).toHaveLength(2);
        for (const id of puzzle.evidenceIds!)
          expect(c.files.find((f) => f.id === id)?.text.length).toBeGreaterThan(
            100,
          );
      }
      state = transition(c, state, {
        type: "SOLVE",
        id: puzzle.id,
        answer: puzzle.answer,
      }).state;
    }
    expect(
      availableMedia(c, state).filter((m) => m.id.endsWith("chapter-image")),
    ).toHaveLength(1);
    const hypothesis = c.hypotheses[0];
    expect(hypothesis.requiredClues).toContain(`${c.caseId}-clue-10a`);
    expect(hypothesis.requiredClues).toContain(`${c.caseId}-clue-10b`);
  },
);

it("publishes exactly the five bundled packages without editing old versions or saves", () => {
  const sql = readFileSync(
    "db/migrations/V007__ten_stage_investigations.sql",
    "utf8",
  );
  const packages = [...sql.matchAll(/\$case\$(.*?)\$case\$::jsonb/g)].map((m) =>
    JSON.parse(m[1]),
  );
  expect(packages).toEqual(caseLibrary.map((entry) => entry.case));
  expect(sql).not.toMatch(/\b(?:UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/);
  expect(sql).not.toContain("user_saves");
});

// Opt-in fixtures for manual browser checks, never served by the production build.
if (process.env.GHOSTDESK_BROWSER_FIXTURES === "1") {
  mkdirSync("output/chapter-checkpoints", { recursive: true });
  for (const { case: c } of caseLibrary) {
    let state = initialState(c);
    for (const puzzle of c.puzzles.slice(0, 5)) {
      for (const f of c.files)
        if (canOpen(c, state, f.id))
          state = transition(c, state, { type: "OPEN_FILE", id: f.id }).state;
      state = transition(c, state, {
        type: "SOLVE",
        id: puzzle.id,
        answer: puzzle.answer,
      }).state;
    }
    state = transition(c, state, { type: "PAUSE" }).state;
    writeFileSync(
      `output/chapter-checkpoints/${c.caseId}.gdsave`,
      JSON.stringify({
        format: "ghostdesk-save-1",
        case: c,
        state,
        notes: "검증용 후반부 시작점",
        checkpoint: null,
      }),
    );
  }
}
