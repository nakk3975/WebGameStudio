// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Player from "../apps/ghostdesk/src/Player";
import { archivedCases, caseLibrary } from "../apps/ghostdesk/src/cases";
import { initialState, transition } from "../packages/engine-ghostdesk/src";
import { hotelClip, hotelStill } from "../apps/ghostdesk/src/cctv";
import { recordText, fileTitle } from "../apps/ghostdesk/src/presentation";
import { parseSave, type Save } from "../apps/ghostdesk/src/storage";

const c = caseLibrary.find((e) => e.case.caseId === "hotel-404")!.case;
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
async function mount(stages = 0) {
  let state = initialState(c);
  for (const p of c.puzzles.slice(0, stages))
    state = transition(c, state, {
      type: "SOLVE",
      id: p.id,
      answer: p.answer,
    }).state;
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
        onSaved: () => {},
        onExit: () => {},
        onSettings: () => {},
      }),
    ),
  );
}
async function click(name: string) {
  const b = [...host.querySelectorAll("button")].find(
    (el) =>
      el.getAttribute("aria-label") === name || el.textContent?.trim() === name,
  );
  expect(b, `button ${name}`).toBeTruthy();
  await act(async () => b!.click());
}
async function openFile(id: string) {
  const b = host.querySelector(`#desktop-${id}`);
  expect(b).toBeTruthy();
  await act(async () =>
    b!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
}
function windowByTitle(title: string) {
  const el = host.querySelector(`section[aria-label="${title} 창"]`);
  expect(el, `window ${title}`).toBeTruthy();
  return el!;
}

it("opens the night handover as text and its photograph in a separate window", async () => {
  await mount();
  await openFile("hotel-404-f0");
  const memo = windowByTitle("야간_인계.txt");
  expect(memo.querySelectorAll("img, video")).toHaveLength(0);
  expect(memo.textContent).toContain("404호 문이 살짝 열려");
  await click("야간 프런트 · 이미지 열기");
  expect(windowByTitle("야간 프런트").querySelector("img")).toBeTruthy();
  expect(memo.querySelector("img")).toBeNull();
  await click("이미지 자료");
  const files = host.querySelector('[aria-label="이미지 자료 목록"]')!;
  expect(files.textContent).toContain("야간 프런트");
  expect(files.textContent).not.toContain("지하 세탁실");
  expect(files.textContent).toContain(hotelStill.title);
});

it("uses the recording frame for the separate photo and date puzzle, with no unrelated gallery", async () => {
  await mount(1);
  await openFile("hotel-404-f3");
  expect(
    host.querySelector("#desktop-hotel-404-f3 .file-symbol.video"),
  ).toBeTruthy();
  const clip = windowByTitle(
    fileTitle(
      c,
      c.files.find((f) => f.id === "hotel-404-f3")!,
    ),
  );
  expect(clip.querySelector("video")?.getAttribute("poster")).toBe(
    hotelStill.src,
  );
  expect(clip.querySelectorAll("img")).toHaveLength(0);
  expect(clip.textContent).not.toContain("사람의 동작은 복원하지");
  await click(hotelStill.title + " · 이미지 열기");
  expect(
    windowByTitle(hotelStill.title).querySelector("img")?.getAttribute("src"),
  ).toBe(hotelClip.src);
  const puzzleFile = c.files.find((f) => f.puzzleId === c.puzzles[1].id)!;
  await click(fileTitle(c, puzzleFile) + " · 암호 필요");
  const puzzle = windowByTitle(fileTitle(c, puzzleFile));
  expect(
    [...puzzle.querySelectorAll("img")].some(
      (img) => img.getAttribute("src") === hotelStill.src,
    ),
  ).toBe(true);
  expect(hotelClip.alt).toContain("흰 옷");
  expect(hotelClip.alt).toContain("404호 문이 조금 열려");
});

it("keeps unlocked later photographs separate from their text records", async () => {
  await mount(5);
  await openFile("hotel-404-record-4");
  const record = windowByTitle(
    c.files.find((f) => f.id === "hotel-404-record-4")!.title,
  );
  expect(record.querySelector("img")).toBeNull();
  await click("지하 세탁실 · 이미지 열기");
  expect(windowByTitle("지하 세탁실").querySelector("img")).toBeTruthy();
});

it.each([...archivedCases.filter((v) => v.caseId === c.caseId), c])(
  "preserves $versionId packages, answers and logical time when displaying corrected evidence",
  (version) => {
    const before = JSON.stringify(version);
    const save: Save = {
      format: "ghostdesk-save-1",
      case: version,
      state: { ...initialState(version), logicalMs: 4250 },
      notes: "old notes",
      checkpoint: null,
    };
    for (const file of version.files) recordText(version, file);
    const loaded = parseSave(JSON.parse(JSON.stringify(save)));
    expect(loaded.case).toEqual(version);
    expect(loaded.state.mode).toBe("PAUSED");
    expect(
      transition(loaded.case, loaded.state, { type: "TICK", ms: 60000 }).state
        .logicalMs,
    ).toBe(4250);
    expect(JSON.stringify(version)).toBe(before);
  },
);
