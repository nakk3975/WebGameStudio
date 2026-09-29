// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../apps/ghostdesk/src/App";
import Player from "../apps/ghostdesk/src/Player";
import { caseLibrary } from "../apps/ghostdesk/src/cases";
import { initialState } from "../packages/engine-ghostdesk/src";
import * as engine from "../packages/engine-ghostdesk/src";
import type { Account } from "../apps/ghostdesk/src/Account";
import {
  download,
  read,
  writePlay,
  type Save,
} from "../apps/ghostdesk/src/storage";
import type { RemoteSave } from "../apps/ghostdesk/src/cloud";

const account = vi.hoisted(() => ({
  user: null as null | { id: string; name: string; email: string },
}));
vi.mock("../apps/ghostdesk/src/Account", () => ({
  AccountProvider: ({
    children,
  }: {
    children: (account: Account) => ReactNode;
  }) =>
    children({
      user: account.user,
      ready: true,
      enabled: true,
      open: () => {},
      token: async () => "test-token",
    }),
  AccountButton: () => null,
}));
vi.mock("../apps/ghostdesk/src/storage", async (original) => ({
  ...(await original<typeof import("../apps/ghostdesk/src/storage")>()),
  download: vi.fn(),
}));

let root: Root;
let host: HTMLDivElement;
let remote: RemoteSave | undefined;
const c = caseLibrary[0].case;
const saved = (): Save => ({
  format: "ghostdesk-save-1",
  case: c,
  state: { ...initialState(c), logicalMs: 4250 },
  notes: "preserve notes",
  checkpoint: null,
});
async function settle() {
  // IndexedDB transactions use real setImmediate, independently of the game clock.
  await act(async () => {
    for (let i = 0; i < 25; i++)
      await new Promise<void>((resolve) => setImmediate(resolve));
  });
}
async function mount(element: ReactNode = createElement(App)) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(element));
  await settle();
}
async function unmount() {
  await act(async () => root.unmount());
  host.remove();
}
async function advance(ms: number) {
  // Commit React updates between timer callbacks, as separate browser tasks do.
  while (ms > 0) {
    const step = Math.min(ms, 250);
    await act(async () => vi.advanceTimersByTimeAsync(step));
    await settle();
    ms -= step;
  }
}
function button(name: string) {
  const el = [...host.querySelectorAll("button")].find(
    (b) =>
      b.getAttribute("aria-label") === name || b.textContent?.trim() === name,
  );
  if (!el) throw Error("Missing button: " + name);
  return el;
}
async function click(name: string) {
  await act(async () => button(name).click());
  await settle();
}
function snapshot(): Save {
  button("진행 파일 저장").click();
  return structuredClone(vi.mocked(download).mock.lastCall![1]) as Save;
}
async function frozen() {
  const before = snapshot().state;
  expect(before.mode).toBe("PAUSED");
  await advance(5000);
  expect(snapshot().state.logicalMs).toBe(before.logicalMs);
  return before.logicalMs;
}
beforeEach(async () => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
    ],
  });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // One connection per module; clear records between tests without replacing its database.
  if (!(globalThis.indexedDB instanceof IDBFactory))
    vi.stubGlobal("indexedDB", new IDBFactory());
  const db = await new Promise<IDBDatabase>((resolve) => {
    const r = indexedDB.open("ghostdesk-local-v1", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("records");
    r.onsuccess = () => resolve(r.result);
  });
  await new Promise<void>((resolve) => {
    const t = db.transaction("records", "readwrite");
    t.objectStore("records").clear();
    t.oncomplete = () => resolve();
  });
  db.close();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  account.user = null;
  remote = undefined;
  vi.mocked(download).mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, init) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(init.body as string);
        if ((remote?.revision ?? 0) !== body.expectedRevision)
          return new Response(JSON.stringify({ current: remote ?? null }), {
            status: 409,
          });
        remote = {
          caseId: body.save.case.caseId,
          save: body.save,
          revision: body.expectedRevision + 1,
          updatedAt: "2026-09-29T04:00:00Z",
        };
        return new Response(JSON.stringify(remote));
      }
      return new Response(JSON.stringify(remote ? [remote] : []));
    }),
  );
});
afterEach(async () => {
  if (host?.isConnected) await unmount();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe.each(["guest", "account"] as const)("%s lifecycle", (kind) => {
  async function launch() {
    if (kind === "account")
      account.user = {
        id: "test-account",
        name: "Test",
        email: "test@example.invalid",
      };
    await mount();
    await click("사건 조사 시작");
    await advance(1000);
  }
  it("home -> continue stays frozen until the explicit continue button", async () => {
    await launch();
    const before = snapshot().state.logicalMs;
    await click("홈으로");
    await click("이어서 조사");
    expect(await frozen()).toBe(before);
    await click("조사 계속하기");
    await advance(1000);
    expect(snapshot().state.logicalMs).toBe(before + 1000);
  });
  it("remounts the workspace from a committed RUNNING save without offline catch-up", async () => {
    await launch();
    await advance(3000);
    const stored =
      kind === "guest"
        ? await read<Save>("play")
        : (
            await read<Record<string, { save: Save }>>("account:test-account")
          )?.[c.caseId].save;
    const before = stored!.state.logicalMs;
    expect(stored!.state.mode).toBe("RUNNING");
    await unmount(); // No blur/pause delivery: abrupt renderer termination model.
    await act(async () => vi.advanceTimersByTimeAsync(60 * 60 * 1000));
    await mount();
    await click("이어서 조사");
    expect(await frozen()).toBe(before);
  });
  it("does not resume when the restored pause dialog receives Escape/cancel", async () => {
    await launch();
    await click("홈으로");
    await click("이어서 조사");
    const before = snapshot().state.logicalMs;
    await act(async () =>
      host
        .querySelector("dialog")!
        .dispatchEvent(new Event("cancel", { cancelable: true })),
    );
    await advance(1000);
    expect({
      mode: snapshot().state.mode,
      logicalMs: snapshot().state.logicalMs,
    }).toEqual({ mode: "PAUSED", logicalMs: before });
  });
  it("does not expose an ambiguous close action that resumes the clock", async () => {
    await launch();
    await click("홈으로");
    await click("이어서 조사");
    const before = snapshot().state.logicalMs;
    const close = host.querySelector<HTMLButtonElement>(
      'dialog button[aria-label="대화상자 닫기"]',
    );
    if (close) await act(async () => close.click());
    await advance(1000);
    expect({
      mode: snapshot().state.mode,
      logicalMs: snapshot().state.logicalMs,
    }).toEqual({ mode: "PAUSED", logicalMs: before });
  });
  it("pauses on pagehide even if blur and visibilitychange were not delivered", async () => {
    await launch();
    const before = snapshot().state.logicalMs;
    await act(async () =>
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: true }),
      ),
    );
    await advance(5000);
    expect({
      mode: snapshot().state.mode,
      logicalMs: snapshot().state.logicalMs,
    }).toEqual({ mode: "PAUSED", logicalMs: before });
  });
  it("commits the pause snapshot when unmounted immediately after pagehide", async () => {
    await launch();
    const before = snapshot().state.logicalMs;
    // No 500ms debounce opportunity after the lifecycle event.
    await act(async () =>
      window.dispatchEvent(new PageTransitionEvent("pagehide")),
    );
    await unmount();
    await settle();
    const stored =
      kind === "guest"
        ? await read<Save>("play")
        : (
            await read<Record<string, { save: Save }>>("account:test-account")
          )?.[c.caseId].save;
    expect(stored!.state).toMatchObject({ mode: "PAUSED", logicalMs: before });
    await act(async () => vi.advanceTimersByTimeAsync(60 * 60 * 1000));
    await mount();
    await click("이어서 조사");
    expect(await frozen()).toBe(before);
  });
  it.each(["blur", "visibilitychange"])(
    "persists a pause immediately on %s",
    async (event) => {
      await launch();
      const before = snapshot().state.logicalMs;
      if (event === "visibilitychange")
        vi.spyOn(document, "hidden", "get").mockReturnValue(true);
      await act(async () =>
        (event === "blur" ? window : document).dispatchEvent(new Event(event)),
      );
      await settle();
      const stored =
        kind === "guest"
          ? await read<Save>("play")
          : (
              await read<Record<string, { save: Save }>>("account:test-account")
            )?.[c.caseId].save;
      expect(stored!.state).toMatchObject({
        mode: "PAUSED",
        logicalMs: before,
      });
      expect(await frozen()).toBe(before);
    },
  );
  it("restores an in-memory RUNNING snapshot after an engine error exit", async () => {
    await launch();
    await advance(3000);
    vi.spyOn(engine, "transition").mockImplementationOnce(
      (_case, previous) => ({
        state: { ...previous, mode: "ERROR", diagnostic: "test fault" },
      }),
    );
    await advance(250);
    expect(snapshot().state.mode).toBe("ERROR");
    await click("돌아가기");
    await click("이어서 조사");
    await frozen();
  });
});

it("restores a server-only RUNNING snapshot through the real account response parser", async () => {
  account.user = {
    id: "new-device",
    name: "Test",
    email: "test@example.invalid",
  };
  remote = {
    caseId: c.caseId,
    save: saved(),
    revision: 17,
    updatedAt: "2020-01-01T00:00:00Z",
  };
  await mount();
  await click("이어서 조사");
  expect(await frozen()).toBe(4250);
  expect(snapshot().notes).toBe("preserve notes");
  await click("조사 계속하기");
  await advance(1000);
  expect(snapshot().state.logicalMs).toBe(5250);
});

it("drains the older RUNNING write before the final PAUSED home save", async () => {
  let release!: () => void;
  let first = true;
  const writes: Save[] = [];
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const exit = vi.fn();
  await mount(
    createElement(Player, {
      initial: saved(),
      isTest: false,
      onExit: exit,
      onSettings: () => {},
      onSaved: () => {},
      persistSave: async (s) => {
        if (first) {
          first = false;
          await gate;
        }
        await writePlay(s);
        writes.push(s);
      },
    }),
  );
  await advance(1000);
  const before = snapshot().state.logicalMs;
  await click("홈으로");
  expect(exit).not.toHaveBeenCalled();
  release();
  await settle();
  expect(exit).toHaveBeenCalledOnce();
  expect(writes.map((s) => s.state.mode)).toEqual(["RUNNING", "PAUSED"]);
  expect((await read<Save>("play"))!.state).toMatchObject({
    mode: "PAUSED",
    logicalMs: before,
  });
});
