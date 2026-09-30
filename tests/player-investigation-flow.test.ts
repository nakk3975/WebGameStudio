// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Player from "../apps/ghostdesk/src/Player";
import { archivedCases, caseLibrary } from "../apps/ghostdesk/src/cases";
import {
  boardRecord,
  evidenceFile,
  fileTitle,
} from "../apps/ghostdesk/src/presentation";
import { initialState, transition } from "../packages/engine-ghostdesk/src";
import { parseSave, type Save } from "../apps/ghostdesk/src/storage";
import type { CasePackage } from "../packages/contracts/src";

const versions = [...archivedCases, ...caseLibrary.map((e) => e.case)];
const lab = caseLibrary[0].case;
let host: HTMLDivElement;
let root: Root;
const settings = vi.fn<(save: Save) => void>();
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  settings.mockClear();
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
async function mount(c: CasePackage, count = 0, restore = false) {
  let state = initialState(c);
  for (const p of c.puzzles.slice(0, count))
    state = transition(c, state, {
      type: "SOLVE",
      id: p.id,
      answer: p.answer,
    }).state;
  state.logicalMs = 4250;
  const save: Save = {
    format: "ghostdesk-save-1",
    case: c,
    state,
    notes: "유지할 메모",
    checkpoint: null,
  };
  await act(async () =>
    root.render(
      createElement(Player, {
        initial: restore ? parseSave(JSON.parse(JSON.stringify(save))) : save,
        isTest: true,
        onSaved() {},
        onExit() {},
        onSettings: settings,
      }),
    ),
  );
}
async function click(name: string) {
  const b = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (el) =>
      el.getAttribute("aria-label") === name || el.textContent?.trim() === name,
  );
  expect(b, name).toBeTruthy();
  await act(async () => b!.click());
}
async function snapshot() {
  await click("설정");
  return settings.mock.lastCall![0];
}
async function open(id: string) {
  const b = host.querySelector(`#desktop-${id}`);
  expect(b, id).toBeTruthy();
  await act(async () =>
    b!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
}
function win(name: string) {
  const w = host.querySelector<HTMLElement>(`section[aria-label="${name} 창"]`);
  expect(w, name).toBeTruthy();
  return w!;
}
async function fill(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit(w: HTMLElement, answer: string) {
  await fill(
    w.querySelector<HTMLInputElement>('input[name="answer"]')!,
    answer,
  );
  await act(async () =>
    w.querySelector<HTMLButtonElement>('button[type="submit"]')!.click(),
  );
}

it.each(versions.filter((c) => c.caseId === "demo-0317"))(
  "$versionId presents the clock record as text and preserves its clue and saved package",
  async (c) => {
    const before = JSON.stringify(c);
    await mount(c);
    expect(host.querySelector("#desktop-f-photo")?.textContent).toContain(
      "시계_대조기록.txt",
    );
    expect(
      host.querySelector("#desktop-f-photo .file-symbol.text"),
    ).toBeTruthy();
    await open("f-photo");
    const record = win("시계_대조기록.txt");
    expect(record.dataset.view).toBe("document");
    expect(record.querySelector("img, .clock-evidence")).toBeNull();
    expect(record.textContent).toContain("벽시계      03:10");
    expect(record.textContent).toContain("기록용 PC   03:17");
    expect(boardRecord(c, "c-photo").title).toBe("시계_대조기록.txt");
    const save = await snapshot();
    expect(save.state.clueIds).toContain("c-photo");
    expect(save.state.readFileIds).toContain("f-photo");
    expect(save.case.files.find((f) => f.id === "f-photo")?.title).toBe(
      "작업실_기록.img",
    );
    expect(JSON.stringify(c)).toBe(before);
  },
);

it.each(
  versions.filter((c) => c.caseId === "demo-0317" && c.puzzles.length > 1),
)(
  "$versionId resumes only explicitly, rejects wrong answers, and opens the next named folder on success",
  async (c) => {
    await mount(c, 0, true);
    await act(async () => vi.advanceTimersByTime(60_000));
    expect((await snapshot()).state).toMatchObject({
      mode: "PAUSED",
      logicalMs: 4250,
      solvedPuzzleIds: [],
    });
    // Even a stale submit dispatched behind the pause dialog cannot advance.
    await open(`${c.caseId}-stage-1`);
    await submit(win("업무 자료"), "0310");
    expect((await snapshot()).state.solvedPuzzleIds).toEqual([]);
    expect(host.querySelector('section[aria-label="접수 내역 창"]')).toBeNull();
    await click("조사 계속하기");
    await open(`${c.caseId}-stage-1`);
    const first = win("업무 자료");
    expect(first.textContent).not.toMatch(/\d+\s*단계/);
    const password = first.querySelector<HTMLInputElement>(
      'input[name="answer"]',
    )!;
    expect(password.type).toBe("password");
    // Showing a password must preserve leading zeroes and the submitted value.
    await fill(password, "0310");
    const visibility = first.querySelector<HTMLInputElement>(
      ".password-visibility input",
    )!;
    await act(async () => visibility.click());
    expect(password.type).toBe("text");
    expect(password.value).toBe("0310");
    await act(async () => visibility.click());
    expect(password.type).toBe("password");
    await submit(first, "9999");
    expect(first.isConnected).toBe(true);
    expect(host.textContent).toContain("암호가 맞지 않습니다.");
    expect(host.querySelector('section[aria-label="접수 내역 창"]')).toBeNull();
    await submit(first, "0310");
    const next = win("접수 내역");
    expect(first.isConnected).toBe(false);
    expect(document.activeElement).toBe(next);
    expect(next.querySelector('[aria-pressed="true"]')).toBeNull();
    const saved = await snapshot();
    expect(saved.case).toEqual(c);
    expect(saved.notes).toBe("유지할 메모");
    expect(saved.state.solvedPuzzleIds).toEqual([c.puzzles[0].id]);
    expect(saved.state.readFileIds).toContain(`${c.caseId}-stage-1`);
    expect(saved.state.readFileIds).not.toContain(`${c.caseId}-stage-2`);
    const restored = parseSave(saved);
    expect(restored.state.mode).toBe("PAUSED");
    expect(
      transition(c, restored.state, { type: "TICK", ms: 1000 }).state.logicalMs,
    ).toBe(4250);
    await open(`${c.caseId}-stage-1`);
    expect(win("업무 자료").querySelector(".folder-content")).toBeTruthy();
    expect(win("업무 자료").querySelector(".puzzle-answer")).toBeNull();
  },
);

it("advances a visual answer at the window limit without hiding other evidence", async () => {
  await mount(lab, 3);
  const ids = [
    "f-handover",
    "f-chat",
    "f-photo",
    "trash",
    "demo-0317-scene",
    "demo-0317-stage-1",
    "demo-0317-record-2",
    "demo-0317-stage-2",
    "demo-0317-record-3",
    "demo-0317-stage-3",
    "demo-0317-record-4",
    "demo-0317-stage-4",
  ];
  for (const id of ids) await open(id);
  expect(host.querySelectorAll(".os-window")).toHaveLength(12);
  const photo = win("장비 관리");
  await click("사진 B 선택");
  await fill(
    photo.querySelector<HTMLInputElement>(
      'input[aria-label="외부 전송량 증가분"]',
    )!,
    "0",
  );
  await act(async () =>
    photo.querySelector<HTMLButtonElement>('button[type="submit"]')!.click(),
  );
  expect(host.querySelectorAll(".os-window")).toHaveLength(12);
  expect(photo.isConnected).toBe(false);
  expect(win("전송 내역").classList.contains("active")).toBe(true);
  expect(win("시계_대조기록.txt").isConnected).toBe(true);
  expect((await snapshot()).state.solvedPuzzleIds).toHaveLength(4);
});

it("keeps the original receipt accessible after automatically opening the follow-up investigation", async () => {
  await mount(lab, 4);
  await open("demo-0317-stage-5");
  const receiptFolder = win("전송 내역");
  const choice = [
    ...receiptFolder.querySelectorAll<HTMLButtonElement>(
      ".puzzle-options button",
    ),
  ].find((b) => b.textContent?.startsWith("B"))!;
  await act(async () => choice.click());
  await act(async () =>
    receiptFolder
      .querySelector<HTMLButtonElement>('button[type="submit"]')!
      .click(),
  );
  expect(win("보관 자료").classList.contains("active")).toBe(true);
  expect((await snapshot()).state.clueIds).not.toContain("c-receipt");
  await open("demo-0317-stage-5");
  await click("전송_처리_영수증.txt");
  expect(win("전송_처리_영수증.txt").textContent).toContain("0 bytes");
  expect((await snapshot()).state.clueIds).toContain("c-receipt");
});

it("uses ordinary folder names throughout every official edition without changing custom cases", () => {
  for (const c of versions) {
    const original = JSON.stringify(c);
    const names = c.files
      .filter((f) => f.type === "FOLDER")
      .map((f) => fileTitle(c, f));
    expect(names.every((name) => !/\d+\s*단계/.test(name))).toBe(true);
    expect(new Set(names).size).toBe(names.length);
    c.files.forEach((f) => evidenceFile(c, f));
    expect(JSON.stringify(c)).toBe(original);
  }
  const custom = { ...lab, versionId: "my-custom-version" };
  for (const f of custom.files) expect(evidenceFile(custom, f)).toBe(f);
});
