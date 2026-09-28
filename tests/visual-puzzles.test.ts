import { describe, expect, it } from "vitest";
import {
  archivedCases,
  caseLibrary,
  isOfficialCaseVersion,
} from "../apps/ghostdesk/src/cases";
import {
  cctvFrameIndex,
  cctvSample,
  repeatAnswer,
} from "../apps/ghostdesk/src/cctv";
import { validateCase } from "../packages/contracts/src";
import {
  initialState,
  restoreState,
  transition,
} from "../packages/engine-ghostdesk/src";
import { parseSave } from "../apps/ghostdesk/src/storage";
import expanded from "../apps/ghostdesk/src/expanded-cases.json";

it("requires an actual matching pair instead of accepting the recording length or one frame", () => {
  expect(repeatAnswer([0, 12])).toBe("12");
  expect(repeatAnswer([4, 16])).toBe("12");
  expect(repeatAnswer([20, 8])).toBe("12");
  expect(repeatAnswer([0, 8])).toBe("different-scenes");
  expect(repeatAnswer([4, 4])).toBe("different-scenes");
  expect(repeatAnswer([0, 24])).toBe("24");
  for (const times of [
    [],
    [0],
    [0, 28],
    [0, -4],
    [0, Infinity],
    [0, NaN],
    [0, 12, 24],
  ])
    expect(repeatAnswer(times)).toBe("");
  expect(cctvSample(11.99)).toBe(8);
  expect(cctvFrameIndex(12)).toBe(cctvFrameIndex(0));
  expect(cctvFrameIndex(24)).toBe(cctvFrameIndex(0));
});

it("requires both the photographed observation and its supporting record", () => {
  const c = caseLibrary[0].case;
  let s = initialState(c);
  for (const p of c.puzzles.slice(0, 3))
    s = transition(c, s, { type: "SOLVE", id: p.id, answer: p.answer }).state;
  const p = c.puzzles[3];
  for (const answer of ["0", "B", "A:0", "B:2048"]) {
    const wrong = transition(c, s, { type: "SOLVE", id: p.id, answer });
    expect(wrong.state.solvedPuzzleIds).toHaveLength(3);
  }
  expect(
    transition(c, s, { type: "SOLVE", id: p.id, answer: "B:0" }).state
      .solvedPuzzleIds,
  ).toHaveLength(4);
});

it("declares visual sources explicitly, without changing the saved schema or engine", () => {
  const puzzles = caseLibrary
    .flatMap((e) => e.case.puzzles)
    .filter((p) => p.inputMode === "visual");
  expect(puzzles).toHaveLength(6);
  expect(new Set(puzzles.map((p) => p.visualId)).size).toBe(6);
  const c = structuredClone(caseLibrary[0].case);
  delete c.puzzles[3].visualId;
  expect(validateCase(c).errors.some((e) => e.path.endsWith("visualId"))).toBe(
    true,
  );
  c.puzzles[3].inputMode = "text";
  c.puzzles[3].visualId = "lab-network";
  expect(validateCase(c).errors.some((e) => e.path.endsWith("visualId"))).toBe(
    true,
  );
});

describe.each(expanded)("previous $caseId five-stage edition", (old) => {
  it("preserves the exact package, answers, progress and finished ending", () => {
    const c = archivedCases.find((c) => c.versionId === old.versionId)!;
    expect(c).toEqual(old);
    expect(isOfficialCaseVersion(c)).toBe(true);
    let s = initialState(c);
    for (const p of c.puzzles)
      s = transition(c, s, { type: "SOLVE", id: p.id, answer: p.answer }).state;
    expect(s.solvedPuzzleIds).toHaveLength(5);
    const save = parseSave({
      format: "ghostdesk-save-1",
      case: c,
      state: s,
      notes: "기존 조사 메모",
      checkpoint: null,
    });
    expect(save.case).toEqual(old);
    expect(save.state.solvedPuzzleIds).toEqual(s.solvedPuzzleIds);
    expect(restoreState(c, save.state).mode).toBe("PAUSED");
    expect(
      caseLibrary.find((e) => e.case.caseId === c.caseId)!.case.endings,
    ).toEqual(c.endings);
  });
});
