import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { archivedCases, caseLibrary } from "../apps/ghostdesk/src/cases";
import { validateCase } from "../packages/contracts/src";
import {
  canOpen,
  initialState,
  transition,
} from "../packages/engine-ghostdesk/src";
import { parseSave } from "../apps/ghostdesk/src/storage";
import { recordText } from "../apps/ghostdesk/src/presentation";
import {
  availableMedia,
  auctionEvidencePhoto,
} from "../apps/ghostdesk/src/case-media";
import previous from "../apps/ghostdesk/src/ten-stage-cases.json";
import walkthrough from "./fixtures/resolution-walkthrough.json";
import seals from "../apps/ghostdesk/src/assets/auction-seals.webp";

import { solutions } from "./fixtures/resolution-solutions";

it.each(
  caseLibrary.map((entry, i) => ({
    ...entry,
    answers: solutions[i],
    guide: walkthrough[i],
  })),
)(
  "$number has reachable in-world rules, rejects guessing, reuses evidence and resolves only on the final action",
  ({ case: c, answers, guide }) => {
    expect(validateCase(c).errors).toEqual([]);
    expect(c.puzzles).toHaveLength(10);
    const original = JSON.stringify(c);
    const intro = c.files.find(
      (f) => f.visible && f.type === "TEXT" && !f.parentId,
    )!;
    expect(intro.text).toContain(c.description);
    let s = initialState(c);
    const previousSources = new Set<string>();
    for (const [i, p] of c.puzzles.entries()) {
      const guideStep = guide.steps[i];
      const rule = c.files.find((f) => f.id === guideStep.ruleSource)!;
      expect(canOpen(c, s, rule.id), `rule before lock ${p.id}`).toBe(true);
      expect(recordText(c, rule)).toContain(
        `「${guideStep.folder}」 폴더 암호:`,
      );
      expect(p.inputMode).toBe("text");
      expect(p.choices).toBeUndefined();
      for (const id of p.evidenceIds!) {
        expect(canOpen(c, s, id), `source before lock ${p.id}: ${id}`).toBe(
          true,
        );
        s = transition(c, s, { type: "OPEN_FILE", id }).state;
      }
      if (i === 9) {
        expect(
          p.evidenceIds!.filter((id) => previousSources.has(id)).length,
        ).toBeGreaterThanOrEqual(3);
        expect(s.mode).toBe("RUNNING");
        expect(s.endingId).toBeNull();
        for (const piece of answers[i].split("-")) {
          expect(
            transition(c, s, { type: "SOLVE", id: p.id, answer: piece }).state
              .solvedPuzzleIds,
          ).toHaveLength(9);
        }
      }
      for (const answer of ["A", "B", "C", "WRONG"]) {
        const wrong = transition(c, s, {
          type: "SOLVE",
          id: p.id,
          answer,
        }).state;
        expect(wrong.solvedPuzzleIds).toHaveLength(i);
        expect(wrong.mode).toBe("RUNNING");
      }
      // Future answers and the old conclusion endpoint cannot bypass the investigation.
      const final = c.puzzles[9];
      if (i < 9)
        expect(
          transition(c, s, { type: "SOLVE", id: final.id, answer: answers[9] })
            .state.solvedPuzzleIds,
        ).toHaveLength(i);
      expect(
        transition(c, s, {
          type: "CONCLUDE",
          id: c.hypotheses[0].id,
          evidence: s.clueIds,
        }).state.mode,
      ).toBe("RUNNING");
      s = transition(c, s, { type: "TICK", ms: 750 }).state;
      s = transition(c, s, {
        type: "SOLVE",
        id: p.id,
        answer: answers[i],
      }).state;
      expect(s.solvedPuzzleIds).toHaveLength(i + 1);
      const saved = parseSave({
        format: "ghostdesk-save-1",
        case: c,
        state: s,
        notes: "자료 대조",
        checkpoint: null,
      });
      expect(saved.state.mode).toBe(i === 9 ? "ENDED" : "PAUSED");
      let waiting = saved.state;
      for (let tick = 0; tick < 240; tick++)
        waiting = transition(c, waiting, { type: "TICK", ms: 250 }).state;
      expect(waiting.logicalMs).toBe(s.logicalMs);
      expect(saved.case).toEqual(c);
      s = transition(c, waiting, { type: "RESUME" }).state;
      p.evidenceIds!.forEach((id) => previousSources.add(id));
    }
    expect(s.mode).toBe("ENDED");
    expect(s.endingId).toBe(c.endings[0].id);
    expect(s.deliveredMessageIds).toContain(c.messages.at(-1)!.id);
    expect(JSON.stringify(c)).toBe(original);
    expect(
      availableMedia(c, s).some((m) => m.id.endsWith("chapter-image")),
    ).toBe(true);
  },
);

it("preserves every v5 package and only adds the five v6 catalog rows", () => {
  for (const old of previous)
    expect(archivedCases.find((c) => c.versionId === old.versionId)).toEqual(
      old,
    );
  const sql = readFileSync(
    "db/migrations/V008__resolution_investigations.sql",
    "utf8",
  );
  expect(
    [...sql.matchAll(/\$case\$(.*?)\$case\$::jsonb/g)].map((m) =>
      JSON.parse(m[1]),
    ),
  ).toEqual(caseLibrary.map((e) => e.case));
  expect(sql).not.toMatch(/\b(?:UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/);
  expect(sql).not.toContain("user_saves");
});

it("keeps new deductions consistent with the existing recordings and photographs", () => {
  const [lab, hotel, auction, stage, island] = caseLibrary.map((e) => e.case);
  expect(auctionEvidencePhoto(auction)).toBe(seals);
  const interval = (a: string, b: string) => {
    const seconds = (v: string) =>
      v.split(":").reduce((n, x) => n * 60 + Number(x), 0);
    return seconds(b) - seconds(a);
  };
  expect(lab.puzzles[3].answer).toBe(`${6144 - 4096}-${8192 - 8192}`);
  expect(hotel.puzzles[3].answer).toBe(
    String(interval("00:04:08", "00:06:21")),
  );
  expect(hotel.puzzles[8].answer).toBe(`9221-${(9221 - 9101) / 5}`);
  expect(hotel.files.find((f) => f.id.endsWith("record-9b"))!.text).toContain(
    "06-12 14:32:00",
  );
  expect(auction.puzzles[2].answer).toBe(String(240 * 1.05 - 30));
  expect(stage.puzzles[4].answer).toBe(
    `3708-${interval("21:57:21", "21:59:10")}`,
  );
  expect(stage.puzzles[8].answer).toBe(`${interval("21:56:50", "21:59:12")}-3`);
  expect(island.puzzles[8].answer).toBe(
    `R-086-${interval("06:42:00", "07:30:00") / 60}`,
  );
});
