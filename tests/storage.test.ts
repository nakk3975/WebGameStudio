import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { caseLibrary } from "../apps/ghostdesk/src/cases";
import { initialState } from "../packages/engine-ghostdesk/src";
import type { Save } from "../apps/ghostdesk/src/storage";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", new IDBFactory());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const save = (i: number, notes: string): Save => ({
  format: "ghostdesk-save-1",
  case: caseLibrary[i].case,
  state: initialState(caseLibrary[i].case),
  notes,
  checkpoint: null,
});
describe("IndexedDB storage transactions", () => {
  it("recovers after IndexedDB.open throws synchronously", async () => {
    const store = await import("../apps/ghostdesk/src/storage");
    vi.spyOn(indexedDB, "open").mockImplementationOnce(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    await expect(store.read("play")).rejects.toThrow("Storage denied");
    await store.writePlay(save(0, "recovered after synchronous denial"));
    expect((await store.read<Save>("play"))?.notes).toBe(
      "recovered after synchronous denial",
    );
  });
  it("preserves a legacy single-slot save when a different case starts", async () => {
    const { write, writePlay, read } =
      await import("../apps/ghostdesk/src/storage");
    const legacy = save(0, "original progress before the five-case update");
    await write("play", legacy);
    await writePlay(save(4, "new case"));
    expect(await read("play:" + legacy.case.caseId)).toEqual(legacy);
    expect((await read<Save>("play"))?.case.caseId).toBe(
      caseLibrary[4].case.caseId,
    );
  });
  it("keeps separate progress for all five cases and updates the recent slot", async () => {
    const { writePlay, read, parseSave } =
      await import("../apps/ghostdesk/src/storage");
    for (let i = 0; i < 5; i++) await writePlay(save(i, "note " + i));
    for (let i = 0; i < 5; i++) {
      const restored = parseSave(
        await read("play:" + caseLibrary[i].case.caseId),
      );
      expect(restored.notes).toBe("note " + i);
      expect(restored.state.mode).toBe("PAUSED");
    }
    expect(parseSave(await read("play")).case.caseId).toBe(
      caseLibrary[4].case.caseId,
    );
  });
  it("does not partially overwrite progress when a second write fails", async () => {
    const { writePlay, read } = await import("../apps/ghostdesk/src/storage");
    const old = save(0, "previous");
    await writePlay(old);
    const original = IDBObjectStore.prototype.put;
    let calls = 0;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value,
      key,
    ) {
      if (++calls === 2)
        throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, value, key);
    });
    await expect(writePlay(save(1, "unsaved"))).rejects.toThrow("Storage full");
    expect(await read("play")).toEqual(old);
    expect(await read("play:" + caseLibrary[1].case.caseId)).toBeUndefined();
    vi.restoreAllMocks();
    await writePlay(save(1, "retry"));
    expect((await read<Save>("play"))?.notes).toBe("retry");
  });
  it("reports unavailable storage and recovers after access becomes available", async () => {
    const store = await import("../apps/ghostdesk/src/storage");
    const open = vi.spyOn(indexedDB, "open").mockImplementationOnce(() => {
      const request = {} as IDBOpenDBRequest;
      queueMicrotask(() => {
        Object.defineProperty(request, "error", {
          value: new DOMException("Storage denied", "SecurityError"),
        });
        request.onerror?.call(request, new Event("error"));
      });
      return request;
    });
    await expect(store.read("play")).rejects.toThrow("Storage denied");
    open.mockRestore();
    await store.writePlay(save(0, "recovered"));
    expect((await store.read<Save>("play"))?.notes).toBe("recovered");
  });
});
