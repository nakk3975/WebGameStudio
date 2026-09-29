import { expect, it } from "vitest";
import {
  archivedCases,
  caseLibrary,
  legacyCases,
} from "../apps/ghostdesk/src/cases";
import {
  availableMedia,
  mediaAttachments,
} from "../apps/ghostdesk/src/case-media";
import { initialState, transition } from "../packages/engine-ghostdesk/src";

it.each(caseLibrary)(
  "keeps $number later-stage pictures hidden until their source opens",
  ({ case: c }) => {
    const before = JSON.stringify(c);
    let state = initialState(c);
    for (const item of mediaAttachments.filter((m) => m.caseId === c.caseId)) {
      const visible = item.sourceIds.some(
        (id) =>
          state.visibleFileIds.includes(id) &&
          c.files.find((f) => f.id === id)?.parentId === null,
      );
      expect(availableMedia(c, state).some((m) => m.id === item.id)).toBe(
        visible,
      );
    }
    for (const puzzle of c.puzzles) {
      state = transition(c, state, {
        type: "SOLVE",
        id: puzzle.id,
        answer: puzzle.answer,
      }).state;
    }
    expect(availableMedia(c, state)).toHaveLength(
      ["hotel-404", "auction-seven", "encore-last", "monday-loop"].includes(
        c.caseId,
      )
        ? c.caseId === "encore-last"
          ? 5
          : 4
        : 3,
    );
    expect(JSON.stringify(c)).toBe(before);
  },
);

it("does not expose pictures attached only to a locked ancestor or another case", () => {
  const c = legacyCases.find((c) => c.caseId === "encore-last")!;
  const state = initialState(c);
  // Visibility alone must not bypass the original final folder's lock.
  state.visibleFileIds.push("encore-last-f4", "encore-last-f5");
  expect(availableMedia(c, state)).toEqual([]);
  const custom = { ...c, caseId: "custom-case", versionId: "custom-case-v1" };
  expect(availableMedia(custom, state)).toEqual([]);
});

it("does not retrofit the three new video puzzles into archived editions", () => {
  for (const c of archivedCases.filter((c) => !c.versionId.endsWith("-v4"))) {
    let s = initialState(c);
    for (const p of c.puzzles)
      s = transition(c, s, { type: "SOLVE", id: p.id, answer: p.answer }).state;
    expect(
      availableMedia(c, s).some((m) =>
        ["stage-cues", "auction-monitor", "island-receiver"].includes(m.id),
      ),
    ).toBe(false);
  }
});

it("attaches a photo only to its own accessible source document", () => {
  const c = caseLibrary.find((e) => e.case.caseId === "hotel-404")!.case;
  const state = initialState(c);
  expect(availableMedia(c, state, "hotel-404-f0").map((m) => m.id)).toEqual([
    "hotel-frontdesk",
  ]);
  expect(availableMedia(c, state, "hotel-404-f1")).toEqual([]);
  expect(availableMedia(c, state, "hotel-404-record-4")).toEqual([]);
});
