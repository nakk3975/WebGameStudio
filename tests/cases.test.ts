import { describe, expect, it } from "vitest";
import { caseLibrary } from "../apps/ghostdesk/src/cases";
import { validateCase } from "../packages/contracts/src";
import {
  canInspect,
  canOpen,
  initialState,
  transition,
  restoreState,
  type State,
} from "../packages/engine-ghostdesk/src";
import { parseSave } from "../apps/ghostdesk/src/storage";

const solutions = [
  ["0310", "C", "2413", "0", "B"],
  ["B204", "0612", "12", "3142", "12"],
  ["ORBIT", "B", "222", "7", "2413"],
  ["2413", "B", "138", "3241", "C"],
  ["SOS", "1086", "0916", "B", "3142"],
];

describe.each(
  caseLibrary.map((entry, index) => ({ ...entry, answers: solutions[index] })),
)("case $number: $case.title", ({ case: c, answers }) => {
  function investigate() {
    let s = initialState(c);
    for (let step = 0; step < 8; step++) {
      for (const f of c.files)
        if (canOpen(c, s, f.id))
          s = transition(c, s, { type: "OPEN_FILE", id: f.id }).state;
      for (let i = 0; i < c.puzzles.length; i++) {
        const p = c.puzzles[i];
        if (c.files.some((f) => f.puzzleId === p.id && canInspect(c, s, f.id)))
          s = transition(c, s, {
            type: "SOLVE",
            id: p.id,
            answer: answers[i],
          }).state;
      }
    }
    return s;
  }
  it("requires all five stages in order and resumes at every stage", () => {
    expect(c.puzzles).toHaveLength(5);
    let s = initialState(c);
    for (let i = 0; i < 5; i++) {
      for (let future = i + 1; future < 5; future++) {
        const blocked = transition(c, s, {
          type: "SOLVE",
          id: c.puzzles[future].id,
          answer: answers[future],
        });
        expect(blocked.state.solvedPuzzleIds).toEqual(s.solvedPuzzleIds);
      }
      expect(
        transition(c, s, {
          type: "CONCLUDE",
          id: c.hypotheses[1].id,
          evidence: [],
        }).state.mode,
      ).toBe("RUNNING");
      const wrong = transition(c, s, {
        type: "SOLVE",
        id: c.puzzles[i].id,
        answer: "WRONG",
      }).state;
      expect(wrong.solvedPuzzleIds).toHaveLength(i);
      s = transition(c, wrong, {
        type: "SOLVE",
        id: c.puzzles[i].id,
        answer: answers[i],
      }).state;
      const restored = parseSave({
        format: "ghostdesk-save-1",
        case: c,
        state: s,
        notes: "진행 중인 추리",
        checkpoint: null,
      });
      expect(restored.state.solvedPuzzleIds).toHaveLength(i + 1);
      s = transition(c, restored.state, { type: "RESUME" }).state;
      for (const f of c.files)
        if (canOpen(c, s, f.id))
          s = transition(c, s, { type: "OPEN_FILE", id: f.id }).state;
    }
    expect(s.solvedPuzzleIds).toHaveLength(5);
  });
  it("passes package validation and solves using the authored walkthrough", () => {
    expect(validateCase(c).errors).toEqual([]);
    const s = investigate();
    expect(s.mode).toBe("RUNNING");
    expect(s.solvedPuzzleIds).toHaveLength(c.puzzles.length);
    expect(s.clueIds).toHaveLength(c.clues.length);
    const h = c.hypotheses[0];
    const result = transition(c, s, {
      type: "CONCLUDE",
      id: h.id,
      evidence: h.requiredClues,
    });
    expect(result.state.mode).toBe("ENDED");
    expect(result.state.endingId).toBe(h.endingId);
  });
  it("rejects a premature conclusion and permits reconsidering the wrong ending", () => {
    const first = initialState(c);
    expect(
      transition(c, first, {
        type: "CONCLUDE",
        id: c.hypotheses[0].id,
        evidence: [],
      }).state.mode,
    ).toBe("RUNNING");
    const checkpoint = investigate();
    const wrong = transition(c, checkpoint, {
      type: "CONCLUDE",
      id: c.hypotheses[1].id,
      evidence: [],
    }).state;
    expect(c.endings.find((e) => e.id === wrong.endingId)?.revisitable).toBe(
      true,
    );
    const restored = parseSave({
      format: "ghostdesk-save-1",
      case: c,
      state: wrong,
      notes: "case-specific note",
      checkpoint,
    });
    expect(restored.state.mode).toBe("ENDED");
    const resumed = { ...restored.checkpoint!, mode: "RUNNING" } as State;
    const truth = c.hypotheses[0];
    expect(
      transition(c, resumed, {
        type: "CONCLUDE",
        id: truth.id,
        evidence: truth.requiredClues,
      }).state.endingId,
    ).toBe(truth.endingId);
  });
  it("retains progress and emits each delayed message only once", () => {
    let s = investigate();
    for (let i = 0; i < 6; i++)
      s = transition(c, s, { type: "TICK", ms: 1000 }).state;
    expect(new Set(s.deliveredMessageIds).size).toBe(
      s.deliveredMessageIds.length,
    );
    expect(s.deliveredMessageIds).toHaveLength(c.messages.length);
    const restored = restoreState(c, JSON.parse(JSON.stringify(s)));
    expect(restored.mode).toBe("PAUSED");
    expect(restored.solvedPuzzleIds).toEqual(s.solvedPuzzleIds);
    expect(restored.clueIds).toEqual(s.clueIds);
  });
});

it("ships five distinct cases with individually pinned versions", () => {
  expect(caseLibrary).toHaveLength(5);
  expect(new Set(caseLibrary.map((entry) => entry.case.versionId)).size).toBe(
    5,
  );
});
