// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Player from "../apps/ghostdesk/src/Player";
import { archivedCases, caseLibrary } from "../apps/ghostdesk/src/cases";
import {
  availableMedia,
  auctionEvidencePhoto,
} from "../apps/ghostdesk/src/case-media";
import {
  evidenceFile,
  messageText,
  recordText,
} from "../apps/ghostdesk/src/presentation";
import { parseSave, type Save } from "../apps/ghostdesk/src/storage";
import { initialState, transition } from "../packages/engine-ghostdesk/src";
import type { CasePackage } from "../packages/contracts/src";
import auctionSeals from "../apps/ghostdesk/src/assets/auction-seals.webp";
import auctionEnvelopes from "../apps/ghostdesk/src/assets/auction-envelopes.webp";
import auctionClosed from "../apps/ghostdesk/src/assets/auction-monitor-9.webp";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function unlocked(c: CasePackage) {
  return c.puzzles.reduce(
    (s, p) =>
      transition(c, s, { type: "SOLVE", id: p.id, answer: p.answer }).state,
    initialState(c),
  );
}
async function mount(c: CasePackage) {
  const state = unlocked(c);
  const initial: Save = {
    format: "ghostdesk-save-1",
    case: c,
    state,
    notes: "",
    checkpoint: null,
  };
  await act(async () =>
    root.render(
      createElement(Player, {
        initial,
        isTest: true,
        onSaved() {},
        onExit() {},
        onSettings() {},
      }),
    ),
  );
  return state;
}
async function openFile(id: string) {
  const button = host.querySelector(`#desktop-${id}`);
  expect(button, id).toBeTruthy();
  await act(async () =>
    button!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
}
function windowByTitle(title: string) {
  const win = host.querySelector(`section[aria-label="${title} 창"]`);
  expect(win, title).toBeTruthy();
  return win!;
}

it.each(caseLibrary)(
  "$number text records link to separate photos and recordings remain playable",
  async ({ case: c }) => {
    const state = await mount(c);
    const media = availableMedia(c, state);
    // Check all root records, including every supplemental photograph's source.
    for (const f of c.files.filter(
      (f) => f.type === "TEXT" && f.parentId === null,
    )) {
      await openFile(f.id);
      const win = windowByTitle(f.title);
      expect(win.querySelectorAll("img"), f.title).toHaveLength(0);
      const attached = availableMedia(c, state, f.id);
      expect(win.querySelectorAll("video")).toHaveLength(
        attached.filter((m) => m.video).length,
      );
      for (const item of attached.filter((m) => !m.video)) {
        const button = [...win.querySelectorAll("button")].find((b) =>
          b.textContent?.includes(item.title + " · 사진 열기"),
        );
        expect(button).toBeTruthy();
        await act(async () => button!.click());
        expect(
          windowByTitle(item.title).querySelector("img")?.getAttribute("src"),
        ).toBe(item.src);
        expect(win.querySelectorAll("img")).toHaveLength(0);
      }
    }
    const folder = host.querySelector<HTMLButtonElement>(
      'button[aria-label="사진 자료"]',
    )!;
    expect(folder).toBeTruthy();
    await act(async () => folder.click());
    const list = host.querySelector('[aria-label="사진 자료 목록"]')!;
    for (const item of media)
      expect(list.textContent?.includes(item.title)).toBe(!item.video);
  },
);

it.each(caseLibrary.filter((entry) => entry.case.caseId !== "hotel-404"))(
  "$number scene viewer contains its own photo without an unrelated gallery",
  async ({ case: c }) => {
    await mount(c);
    const scene = c.files.find((f) => f.id === `${c.caseId}-scene`)!;
    await openFile(scene.id);
    const win = windowByTitle(scene.title);
    expect(win.querySelectorAll("img")).toHaveLength(1);
    expect(win.querySelectorAll("video, .media-thumbnails")).toHaveLength(0);
    if (c.caseId === "auction-seven")
      expect(win.querySelector("img")?.getAttribute("src")).toBe(auctionSeals);
  },
);

it("uses the same auction seals in the scene and puzzle, with a matching CLOSED capture", () => {
  const c = caseLibrary.find(
    (entry) => entry.case.caseId === "auction-seven",
  )!.case;
  const media = availableMedia(c, unlocked(c));
  expect(auctionEvidencePhoto(c)).toBe(auctionSeals);
  expect(media.find((m) => m.id === "auction-envelopes")?.src).toBe(
    auctionEvidencePhoto(c),
  );
  expect(media.find((m) => m.id === "auction-display")?.src).toBe(
    auctionClosed,
  );
  const v2 = archivedCases.find((c) => c.versionId === "auction-seven-v2")!;
  expect(auctionEvidencePhoto(v2)).toBe(auctionEnvelopes);
  expect(
    availableMedia(v2, unlocked(v2)).find((m) => m.id === "auction-envelopes")
      ?.src,
  ).toBe(auctionEnvelopes);
});

it("describes signal gaps in the video edition and keeps the older written Morse message", () => {
  const c = caseLibrary.find(
    (entry) => entry.case.caseId === "monday-loop",
  )!.case;
  const message = c.messages.find((m) => m.text.includes("빗금"))!;
  expect(messageText(c, message)).toContain("긴 쉼");
  expect(messageText(c, message)).not.toContain("빗금");
  const older = archivedCases.find((c) => c.versionId === "monday-loop-v3")!;
  expect(messageText(older, message)).toBe(message.text);
});

it.each([...archivedCases, ...caseLibrary.map((entry) => entry.case)])(
  "preserves $versionId saves and freezes logicalMs before explicit resume",
  (c) => {
    const before = JSON.stringify(c);
    for (const file of c.files) {
      evidenceFile(c, file);
      recordText(c, file);
    }
    for (const message of c.messages) messageText(c, message);
    availableMedia(c, unlocked(c));
    const save: Save = {
      format: "ghostdesk-save-1",
      case: c,
      state: { ...initialState(c), mode: "RUNNING", logicalMs: 14250 },
      notes: "keep",
      checkpoint: null,
    };
    const restored = parseSave(JSON.parse(JSON.stringify(save)));
    expect(restored.case).toEqual(c);
    expect(restored.notes).toBe("keep");
    expect(restored.state.mode).toBe("PAUSED");
    const waiting = transition(c, restored.state, {
      type: "TICK",
      ms: 60000,
    }).state;
    expect(waiting.logicalMs).toBe(14250);
    const running = transition(c, waiting, { type: "RESUME" }).state;
    expect(
      transition(c, running, { type: "TICK", ms: 250 }).state.logicalMs,
    ).toBe(14500);
    expect(JSON.stringify(c)).toBe(before);
  },
);
