// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Player from "../apps/ghostdesk/src/Player";
import { caseLibrary } from "../apps/ghostdesk/src/cases";
import { initialState } from "../packages/engine-ghostdesk/src";
import { parseSave, type Save } from "../apps/ghostdesk/src/storage";
import { solutions } from "./fixtures/resolution-solutions";
import guide from "./fixtures/resolution-walkthrough.json";

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
async function click(selector: string) {
  const node = host.querySelector<HTMLButtonElement>(selector);
  expect(node, selector).toBeTruthy();
  await act(async () => node!.click());
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

it.each(
  caseLibrary.map((entry, i) => ({
    ...entry,
    answers: solutions[i],
    guide: guide[i],
  })),
)(
  "$number exposes the rules in documents, accepts every typed deduction and ends on the final approval",
  async ({ case: c, answers, guide }) => {
    await act(async () =>
      root.render(
        createElement(Player, {
          initial: parseSave({
            format: "ghostdesk-save-1",
            case: c,
            state: { ...initialState(c), logicalMs: 4250 },
            notes: "노트",
            checkpoint: null,
          }),
          isTest: true,
          onExit() {},
          onSaved() {},
          onSettings: settings,
        }),
      ),
    );
    const actions = host.querySelector("dialog .pause-actions")!;
    expect(actions.children).toHaveLength(2);
    await act(async () => vi.advanceTimersByTime(60_000));
    await click('[aria-label="설정"]');
    expect(settings.mock.lastCall![0].state).toMatchObject({
      mode: "PAUSED",
      logicalMs: 4250,
    });
    await click(".pause-actions .primary");
    await click(".investigation-bottom .primary");
    expect(
      host.querySelector('[aria-label="조사 목적 창"]')!.textContent,
    ).toContain(c.description);
    expect(host.querySelector('input[name="hypothesis"]')).toBeNull();

    for (const [i, p] of c.puzzles.entries()) {
      for (const button of host.querySelectorAll<HTMLButtonElement>(
        'section button[aria-label$=" 닫기"]',
      ))
        await act(async () => button.click());
      const step = guide.steps[i];
      await click(`#desktop-${step.ruleSource}`);
      const record = host.querySelector(
        `section[data-window-id="${step.ruleSource}"]`,
      )!;
      expect(record.textContent).toContain(`「${step.folder}」 폴더 암호:`);
      // Source text stays outside the lock form, with no exposed answer list.
      const f = c.files.find((f) => f.puzzleId === p.id)!;
      await click(`#desktop-${f.id}`);
      const win = host.querySelector(`section[data-window-id="${f.id}"]`)!;
      expect(
        win.querySelectorAll(
          '.puzzle-options, .puzzle-sources, input[type="radio"]',
        ),
      ).toHaveLength(0);
      const input = win.querySelector<HTMLInputElement>(
        'input[aria-label="폴더 암호"]',
      )!;
      expect(win.querySelector('button[type="submit"]')!.textContent).toBe(
        i === 9 ? "해결 승인" : "폴더 열기",
      );
      expect(input.type).toBe("password");
      await fill(input, "A");
      await act(async () =>
        win.querySelector<HTMLButtonElement>('button[type="submit"]')!.click(),
      );
      expect(host.querySelector(".stage-rail")!.textContent).toContain(
        `잠금 해제 ${i}/10`,
      );
      await fill(input, answers[i]);
      await act(async () =>
        win.querySelector<HTMLButtonElement>('button[type="submit"]')!.click(),
      );
      expect(host.querySelector(".stage-rail")!.textContent).toContain(
        `잠금 해제 ${i + 1}/10`,
      );
      if (i < 9) {
        expect(host.querySelector("dialog")).toBeNull();
        const next = c.files.find((f) => f.puzzleId === c.puzzles[i + 1].id)!;
        expect(document.activeElement?.getAttribute("data-window-id")).toBe(
          next.id,
        );
      } else {
        expect(host.querySelector("dialog")!.textContent).toContain(
          c.endings[0].title,
        );
        expect(host.querySelector("dialog")!.textContent).toContain(
          c.endings[0].text,
        );
        await click('[aria-label="설정"]');
        const final = settings.mock.lastCall![0];
        expect(final.state.mode).toBe("ENDED");
        expect(parseSave(final).state.endingId).toBe(c.endings[0].id);
        expect(final.notes).toBe("노트");
      }
    }
  },
);
