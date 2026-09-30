// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Player from "../apps/ghostdesk/src/Player";
import DesktopFiles from "../apps/ghostdesk/src/DesktopFiles";
import { caseLibrary } from "../apps/ghostdesk/src/cases";
import { fileTitle } from "../apps/ghostdesk/src/presentation";
import { initialState } from "../packages/engine-ghostdesk/src";
import type { Save } from "../apps/ghostdesk/src/storage";

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
async function click(name: string) {
  const button = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) =>
      b.getAttribute("aria-label") === name || b.textContent?.trim() === name,
  );
  expect(button, name).toBeTruthy();
  await act(async () => button!.click());
}
async function snapshot() {
  await click("설정");
  return settings.mock.lastCall![0];
}

it.each(caseLibrary)(
  "$number opens files with one click and keeps guidance opt-in",
  async ({ case: c }) => {
    const original = JSON.stringify(c);
    await act(async () =>
      root.render(
        createElement(Player, {
          initial: {
            format: "ghostdesk-save-1",
            case: c,
            state: initialState(c),
            notes: "notes",
            checkpoint: null,
          },
          isTest: true,
          onExit() {},
          onSaved() {},
          onSettings: settings,
        }),
      ),
    );
    const memo = c.files.find(
      (f) => f.type === "TEXT" && f.visible && !f.parentId,
    )!;
    const button = host.querySelector<HTMLButtonElement>(
      `#desktop-${memo.id}`,
    )!;
    expect(button.closest(".desktop-area .desktop-grid")).toBeTruthy();
    await act(async () => button.click());
    expect(host.querySelectorAll(".os-window")).toHaveLength(1);
    expect((await snapshot()).state.readFileIds).toContain(memo.id);
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      fileTitle(c, memo) + " 창",
    );
    expect(host.querySelector(".desktop-start")).toBeNull();
    // A second click focuses the same file instead of adding a duplicate window.
    await act(async () => button.click());
    expect(host.querySelectorAll(".os-window")).toHaveLength(1);
    await click("바탕화면 보기");
    expect(
      (host.querySelector(".os-window") as HTMLElement).style.display,
    ).toBe("none");
    expect(document.activeElement).toBe(host.querySelector(".desktop-grid"));
    await act(async () => button.click());
    expect(
      (host.querySelector(".os-window") as HTMLElement).style.display,
    ).toBe("");

    const p = c.puzzles[0];
    const folder = c.files.find((f) => f.puzzleId === p.id)!;
    await act(async () =>
      host.querySelector<HTMLButtonElement>(`#desktop-${folder.id}`)!.click(),
    );
    const locked = host.querySelector(
      `section[aria-label="${fileTitle(c, folder)} 창"]`,
    )!;
    expect(
      locked.querySelector(".puzzle-sources, .folder-password-hint"),
    ).toBeNull();
    expect(locked.textContent).not.toContain(p.title);
    const beforeHint = (await snapshot()).state;
    await click("암호 힌트 보기");
    expect(host.querySelector("dialog .hint-context")?.textContent).toContain(
      p.title,
    );
    const locations = host.querySelector<HTMLDetailsElement>(
      "dialog .hint-locations",
    )!;
    expect(locations.open).toBe(false);
    const afterHint = (await snapshot()).state;
    expect(afterHint.readFileIds).toEqual(beforeHint.readFileIds);
    expect(afterHint.hintLevels).toEqual(beforeHint.hintLevels);
    expect(afterHint.solvedPuzzleIds).toEqual([]);
    const sourceId = p.evidenceIds!.find(
      (id) => !beforeHint.readFileIds.includes(id),
    )!;
    const source = c.files.find((f) => f.id === sourceId)!;
    await act(async () => {
      locations.open = true;
    });
    const shortcut = [
      ...locations.querySelectorAll<HTMLButtonElement>("button"),
    ].find((b) => b.textContent === fileTitle(c, source))!;
    await act(async () => shortcut.click());
    expect(host.querySelector("dialog")).toBeNull();
    const afterOpen = (await snapshot()).state;
    expect(afterOpen.readFileIds).toEqual([
      ...beforeHint.readFileIds,
      sourceId,
    ]);
    expect(
      host.querySelector(`section[aria-label="${fileTitle(c, source)} 창"]`),
    ).toBeTruthy();
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      fileTitle(c, source) + " 창",
    );
    expect(JSON.stringify(c)).toBe(original);
    expect((await snapshot()).notes).toBe("notes");
  },
);

it("keeps every file reachable when the desktop shrinks, grows, or loses its last page", async () => {
  let size = { width: 400, height: 264 };
  let resize: () => void = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      return {
        ...size,
        top: 0,
        left: 0,
        x: 0,
        y: 0,
        right: size.width,
        bottom: size.height,
        toJSON() {},
      };
    },
  );
  const items = Array.from({ length: 17 }, (_, i) => ({
    id: String(i),
    content: createElement("button", { "data-file": i }, `기록 ${i}`),
  }));
  const render = async (count = 17) =>
    act(async () =>
      root.render(
        createElement(DesktopFiles, { items: items.slice(0, count) }),
      ),
    );
  await render();
  const ids = () =>
    [...host.querySelectorAll("[data-file]")].map((el) =>
      el.getAttribute("data-file"),
    );
  expect(ids()).toHaveLength(6);
  const visited = [...ids()];
  await click("다음 바탕화면 페이지");
  visited.push(...ids());
  await click("다음 바탕화면 페이지");
  visited.push(...ids());
  expect(visited).toEqual(items.map((i) => i.id));
  size = { width: 1500, height: 700 };
  await act(async () => resize());
  expect(ids()).toHaveLength(17);
  expect(host.textContent).not.toContain("페이지");
  size = { width: 250, height: 132 };
  await act(async () => resize());
  expect(ids()).toEqual(["0", "1"]);
  await click("다음 바탕화면 페이지");
  expect(ids()).toEqual(["2", "3"]);
  await render(1);
  expect(ids()).toEqual(["0"]);
  expect(host.textContent).not.toContain("페이지");
  await act(async () => root.render(null));
  expect(disconnect).toHaveBeenCalledOnce();
});
