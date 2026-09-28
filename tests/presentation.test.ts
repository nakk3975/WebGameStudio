import { expect, it } from "vitest";
import {
  caseLibrary,
  legacyCases,
  isOfficialCaseVersion,
} from "../apps/ghostdesk/src/cases";
import {
  boardRecord,
  investigationStatus,
} from "../apps/ghostdesk/src/presentation";
import { initialState } from "../packages/engine-ghostdesk/src";
import { parseSave, type Save } from "../apps/ghostdesk/src/storage";

it.each([...legacyCases, ...caseLibrary.map((e) => e.case)])(
  "keeps $versionId saves official and does not infer a solved case from a retry ending",
  (c) => {
    const save: Save = {
      format: "ghostdesk-save-1",
      case: c,
      state: initialState(c),
      notes: "기존 기록",
      checkpoint: null,
    };
    expect(isOfficialCaseVersion(c)).toBe(true);
    expect(parseSave(save).case.versionId).toBe(c.versionId);
    expect(investigationStatus(save)).toBe("진행 중");
    save.state.mode = "ENDED";
    save.state.endingId = c.endings.find((e) => e.revisitable)!.id;
    expect(investigationStatus(save)).toBe("재조사 필요");
    save.state.endingId = c.endings.find((e) => !e.revisitable)!.id;
    expect(investigationStatus(parseSave(save))).toBe("조사 완료");
  },
);
it("shows source names rather than the explanatory clue copy, including old saves", () => {
  for (const c of legacyCases)
    for (const cl of c.clues) {
      const record = boardRecord(c, cl.id);
      expect(record.description).not.toBe(cl.description);
      expect(record.title).toBe(
        c.files.find((f) => f.clueId === cl.id)?.title || "수집한 기록",
      );
      expect(record.description).not.toContain("정답");
    }
  expect(investigationStatus(null)).toBe("미해결");
});
