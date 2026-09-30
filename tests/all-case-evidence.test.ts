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
  fileTitle,
  isVideoFile,
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
function unlocked(c: CasePackage, count = c.puzzles.length) {
  return c.puzzles
    .slice(0, count)
    .reduce(
      (s, p) =>
        transition(c, s, { type: "SOLVE", id: p.id, answer: p.answer }).state,
      initialState(c),
    );
}
async function mount(c: CasePackage, count = c.puzzles.length) {
  const state = unlocked(c, count);
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
  "$number describes stage five as the midpoint of the expanded case",
  async ({ case: c }) => {
    await mount(c, 5);
    const folder = c.files.find((f) => f.id === `${c.caseId}-stage-5`)!;
    await openFile(folder.id);
    const win = windowByTitle(fileTitle(c, folder));
    expect(win.textContent).toContain("다음 폴더에서 남은 의문");
    expect(win.textContent).not.toContain("결론을 작성하세요");
  },
);

it.each(caseLibrary)(
  "$number accepts all ten answers and advances through all player controls",
  async ({ case: c, number }) => {
    const walkthrough: Record<string, string[]> = {
      "001": ["0310", "C", "2413", "B:0", "B", "A", "0312", "3142", "C", "B"],
      "002": [
        "B204",
        "C:0612",
        "12",
        "3142",
        "12",
        "C",
        "2358",
        "2413",
        "B",
        "A",
      ],
      "003": ["ORBIT", "B", "222", "7", "2413", "B", "222", "3241", "C", "B"],
      "004": ["2413", "B", "138", "3241", "B:C", "C", "B2", "2413", "A", "B"],
      "005": [
        "SOS",
        "1086",
        "0916",
        "B:B",
        "3142",
        "B",
        "0642",
        "2413",
        "C",
        "B",
      ],
    };
    await mount(c, 0);
    for (let index = 0; index < 10; index++) {
      const p = c.puzzles[index];
      const f = c.files.find((f) => f.puzzleId === p.id)!;
      await openFile(f.id);
      const win = windowByTitle(fileTitle(c, f));
      expect(win.textContent).toContain("이 폴더를 열려면 암호가 필요합니다.");
      expect(
        win.querySelector(".folder-password-hint, .puzzle-sources"),
      ).toBeNull();
      expect(win.textContent).not.toContain("암호를 찾을 자료");
      expect(win.textContent).not.toContain(p.title);
      const answer = walkthrough[number][index];
      if (p.inputMode === "visual") {
        const click = async (selector: string) => {
          const b = win.querySelector<HTMLButtonElement>(selector)!;
          expect(b, selector).toBeTruthy();
          await act(async () => b.click());
        };
        const fill = async (input: HTMLInputElement, value: string) => {
          await act(async () => {
            Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              "value",
            )!.set!.call(input, value);
            input.dispatchEvent(new Event("input", { bubbles: true }));
          });
        };
        if (p.visualId === "hotel-repeat" || p.visualId === "auction-timing") {
          const times =
            p.visualId === "hotel-repeat"
              ? ["00:00.00", "00:12.00"]
              : ["00:02.00", "00:09.00"];
          for (const time of times) {
            const b = [
              ...win.querySelectorAll<HTMLButtonElement>(
                ".scene-description button",
              ),
            ].find((b) => b.textContent === time + " 장면 담기")!;
            await act(async () => b.click());
          }
        } else if (p.visualId === "stage-cues") {
          for (const color of ["주황빛", "파란빛", "흰빛", "붉은빛"]) {
            const b = [
              ...win.querySelectorAll<HTMLButtonElement>(
                ".puzzle-options button",
              ),
            ].find((b) => b.textContent === color)!;
            await act(async () => b.click());
          }
        } else if (p.visualId === "island-signal") {
          await fill(
            win.querySelector<HTMLInputElement>(
              'input[aria-label="폴더 암호"]',
            )!,
            answer,
          );
        } else {
          const [pin, value] = answer.split(":");
          await click(`button[aria-label="사진 ${pin} 선택"]`);
          if (value !== undefined) {
            const input = win.querySelector<HTMLInputElement>(
              'input[name="visual-answer"]',
            );
            if (input) await fill(input, value);
            else await click(`input[type="radio"][value="${value}"]`);
          }
        }
      } else if (p.inputMode === "text") {
        const input = win.querySelector<HTMLInputElement>(
          'input[name="answer"]',
        )!;
        await act(async () => {
          Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )!.set!.call(input, answer);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
      } else {
        for (const value of answer) {
          const label = p.choices!.find(
            (choice) => choice.value === value,
          )!.label;
          const button = [
            ...win.querySelectorAll<HTMLButtonElement>(
              ".puzzle-options button",
            ),
          ].find((b) => b.textContent?.includes(label))!;
          await act(async () => button.click());
        }
      }
      const submit = win.querySelector<HTMLButtonElement>(
        'button[type="submit"], .visual-puzzle > button.primary',
      )!;
      expect(submit.disabled).toBe(false);
      expect(submit.textContent?.trim()).toBe("폴더 열기");
      await act(async () => submit.click());
      expect(host.querySelector(".stage-rail")?.textContent).toContain(
        `잠금 해제 ${index + 1}/10`,
      );
      if (index < 9) {
        const next = c.files.find(
          (file) => file.puzzleId === c.puzzles[index + 1].id,
        )!;
        const nextWindow = windowByTitle(fileTitle(c, next));
        expect(nextWindow.classList.contains("active")).toBe(true);
        expect(document.activeElement).toBe(nextWindow);
        expect(win.isConnected).toBe(false);
      } else {
        // The last folder retains its sources; concluding remains an explicit action.
        expect(win.isConnected).toBe(true);
        expect(win.textContent).toContain("결론 작성하기");
        expect(host.querySelector('[aria-label="결론 작성 창"]')).toBeNull();
      }
    }
  },
);

it.each(caseLibrary)(
  "$number text records link to separate photos and recordings remain playable",
  async ({ case: c }) => {
    const state = await mount(c);
    const media = availableMedia(c, state);
    // Check all root records, including every supplemental photograph's source.
    for (const f of c.files.filter(
      (f) => f.type === "TEXT" && f.parentId === null,
    )) {
      // Respect the product limit of twelve simultaneous windows.
      for (const close of host.querySelectorAll<HTMLButtonElement>(
        'section button[aria-label$=" 닫기"]',
      ))
        await act(async () => close.click());
      await openFile(f.id);
      const win = windowByTitle(fileTitle(c, f));
      expect(win.querySelectorAll("img"), f.title).toHaveLength(0);
      const attached = availableMedia(c, state, f.id);
      expect(win.querySelectorAll("video")).toHaveLength(
        isVideoFile(c, f) ? attached.filter((m) => m.video).length : 0,
      );
      if (isVideoFile(c, f)) {
        expect(
          host.querySelector(`#desktop-${f.id} .file-symbol.video`),
        ).toBeTruthy();
        expect(win.querySelector(".document-meta")?.textContent).toContain(
          "영상 기록",
        );
      }
      if (!isVideoFile(c, f)) {
        for (const item of attached.filter((m) => m.video)) {
          const b = [...win.querySelectorAll("button")].find((b) =>
            b.textContent?.includes(item.title + " · 영상 열기"),
          )!;
          expect(b).toBeTruthy();
          await act(async () => b.click());
          expect(
            windowByTitle(item.title)
              .querySelector("video")
              ?.getAttribute("src"),
          ).toBe(item.video);
          expect(win.querySelector("video")).toBeNull();
        }
      }
      for (const item of attached.filter((m) => !m.video)) {
        const button = [...win.querySelectorAll("button")].find((b) =>
          b.textContent?.includes(item.title + " · 이미지 열기"),
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
      'button[aria-label="이미지 자료"]',
    )!;
    expect(folder).toBeTruthy();
    await act(async () => folder.click());
    const list = host.querySelector('[aria-label="이미지 자료 목록"]')!;
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
  const legacy = archivedCases.find((c) => c.versionId === "monday-loop-v4")!;
  const message = legacy.messages.find((m) => m.text.includes("빗금"))!;
  expect(c.messages.find((m) => m.id === message.id)?.text).toContain("긴 쉼");
  expect(messageText(legacy, message)).toContain("긴 쉼");
  expect(messageText(legacy, message)).not.toContain("빗금");
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
