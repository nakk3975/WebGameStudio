import { expect, it } from "vitest";
import {
  archivedCases,
  caseLibrary,
  legacyCases,
  tenStageLibrary,
} from "../apps/ghostdesk/src/cases";
import {
  availableMedia,
  mediaAttachments,
} from "../apps/ghostdesk/src/case-media";
import { initialState, transition } from "../packages/engine-ghostdesk/src";
import {
  evidenceFile,
  fileTitle,
  isVideoFile,
  recordText,
} from "../apps/ghostdesk/src/presentation";
import { auctionClip } from "../apps/ghostdesk/src/recordings";
import { hotelClip } from "../apps/ghostdesk/src/cctv";

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
  for (const c of archivedCases.filter((c) => !/-v[45]$/.test(c.versionId))) {
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

it("keeps the output recording end label on its last captured second", () => {
  const clip = mediaAttachments.find((m) => m.id === "stage-output-meter")!;
  expect(clip.recording!.stamp(0)).toBe("제어기 21:56:50");
  expect(clip.recording!.stamp(2)).toBe("제어기 21:56:52");
  expect(clip.recording!.stamp(10.9)).toBe("제어기 21:57:00");
  expect(clip.recording!.stamp(11)).toBe("제어기 21:57:00");
});

it("matches file names to actual viewers and media in every official saved edition", () => {
  for (const c of [...archivedCases, ...caseLibrary.map((e) => e.case)]) {
    let state = initialState(c);
    for (const p of c.puzzles)
      state = transition(c, state, {
        type: "SOLVE",
        id: p.id,
        answer: p.answer,
      }).state;
    for (const original of c.files) {
      const file = evidenceFile(c, original);
      expect(fileTitle(c, file), c.versionId).not.toMatch(/\.(img|csv|cam)$/i);
      if (isVideoFile(c, file)) {
        expect(file.title).toMatch(/\.mp4$/);
        const videos =
          file.id === "hotel-404-f3"
            ? [hotelClip]
            : availableMedia(c, state, file.id).filter((m) => m.video);
        expect(videos.length, `${c.versionId}:${file.id}`).toBeGreaterThan(0);
        expect(videos.every((m) => m.video?.endsWith(".mp4"))).toBe(true);
      }
      if (file.type === "IMAGE" && !isVideoFile(c, file))
        expect(file.assetId, `${c.versionId}:${file.id}`).toBeTruthy();
    }
  }
});

it("does not promise unavailable video controls in archived text-only investigations", () => {
  for (const c of archivedCases.filter((c) => /-v[123]$/.test(c.versionId))) {
    let state = initialState(c);
    for (const p of c.puzzles)
      state = transition(c, state, {
        type: "SOLVE",
        id: p.id,
        answer: p.answer,
      }).state;
    const island = c.files.find((f) => f.assetId === "island");
    if (island) {
      const viewed = evidenceFile(c, island);
      expect(viewed.text).toBe("관측소 · 세 번째 아침");
      expect(viewed.text).not.toContain("영상");
      expect(c.files.some((f) => f.title === "수신_신호.txt")).toBe(true);
    }
    const monitor = availableMedia(c, state).find(
      (m) => m.id === "auction-display",
    );
    if (monitor) expect(monitor.caption).not.toContain("경과 9초");
    if (c.versionId === "hotel-404-v2") {
      const record = c.files.find((f) => f.id === "hotel-404-record-3")!;
      expect(recordText(c, record)).toContain("초를 입력");
      expect(recordText(c, record)).not.toContain("담아");
    }
  }
  expect(hotelClip.caption).toBe("CAM-404 · 프런트 보관 영상");
});

it("keeps hotel frame 8821 at its original clock time without changing the published evidence", () => {
  const c = tenStageLibrary.find((e) => e.case.caseId === "hotel-404")!.case;
  const record = c.files.find((f) => f.id === "hotel-404-record-9b")!;
  expect(record.text).toContain("06-12 14:20");
  expect(recordText(c, record)).toContain(
    "06-12 14:32:00, 번호 8821 → 06-12 14:32:05, 번호 8941",
  );
  expect(recordText(c, record)).not.toContain("14:20");
  expect(hotelClip.recording!.stamp(0)).toContain("14:32 · F-8821");
  expect(record.text).toContain("06-12 14:20");
});

it("does not advance the auction clock beyond its last decoded frame at the end", () => {
  expect(auctionClip.recording!.stamp(2)).toBe("서버 시각 21:59:53");
  expect(auctionClip.recording!.stamp(9)).toBe("서버 시각 22:00:00");
  expect(auctionClip.recording!.stamp(11 - 1 / 24)).toBe("서버 시각 22:00:01");
  expect(auctionClip.recording!.stamp(11)).toBe("서버 시각 22:00:01");
});

it("distinguishes the 03:20 equipment photos from the simultaneous clock photo in saved editions", () => {
  for (const c of [...archivedCases, ...caseLibrary.map((e) => e.case)].filter(
    (c) => c.caseId === "demo-0317",
  )) {
    const original = JSON.stringify(c);
    const record = c.files.find((f) => f.id === "demo-0317-record-3");
    if (!record) continue;
    expect(recordText(c, record)).toContain(
      "연구실 전경과 통신 장비함 사진은 03:20",
    );
    const clock = evidenceFile(
      c,
      c.files.find((f) => f.id === "f-photo")!,
    );
    expect(clock.assetId).toBe("clock-comparison");
    expect(clock.text).not.toContain("03:20");
    expect(JSON.stringify(c)).toBe(original);
  }
});

it("keeps captions as recording labels while retaining accessible visual observations", () => {
  for (const item of [...mediaAttachments, hotelClip]) {
    expect(item.caption, item.id).not.toMatch(
      /확인하세요|대조하세요|살펴보세요|관찰하세요|판단할|증명|원문에서/,
    );
    expect(item.alt, item.id).toBeTruthy();
  }
});
