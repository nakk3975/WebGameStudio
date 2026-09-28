import "fake-indexeddb/auto";
import { afterEach, expect, it, vi } from "vitest";
import {
  CloudSaves,
  SaveConflict,
  cloudTransport,
  type RemoteSave,
  type SaveTransport,
} from "../apps/ghostdesk/src/cloud";
import { caseLibrary } from "../apps/ghostdesk/src/cases";
import { initialState } from "../packages/engine-ghostdesk/src";
import { read, type Save } from "../apps/ghostdesk/src/storage";
const c = caseLibrary[0].case;
const save = (notes: string): Save => ({
  format: "ghostdesk-save-1",
  case: c,
  state: initialState(c),
  notes,
  checkpoint: null,
});
const running: CloudSaves[] = [];
afterEach(() => {
  running.forEach((x) => x.close());
  running.length = 0;
  vi.restoreAllMocks();
});
function server() {
  const rows: Record<string, RemoteSave> = {};
  const transport: SaveTransport = {
    list: async () => structuredClone(Object.values(rows)),
    put: async (s, r) => {
      const old = rows[s.case.caseId];
      if ((old?.revision ?? 0) !== r)
        throw new SaveConflict(structuredClone(old ?? null));
      return structuredClone(
        (rows[s.case.caseId] = {
          caseId: s.case.caseId,
          save: structuredClone(s),
          revision: r + 1,
          updatedAt: new Date().toISOString(),
        }),
      );
    },
  };
  return { rows, transport };
}
function device(
  t: SaveTransport,
  id = "qa",
  load: () => Promise<unknown> = async () => null,
  persist: (x: any) => Promise<void> = async () => {},
) {
  const d = new CloudSaves(id, t, () => {}, load, persist);
  running.push(d);
  return d;
}
it("continues all progress and notes on a second device", async () => {
  const { transport } = server(),
    a = device(transport),
    b = device(transport);
  await a.initialize();
  await a.persist(save("phone notes"));
  await a.flush();
  await b.initialize();
  expect(b.records[c.caseId].save.notes).toBe("phone notes");
  expect(b.records[c.caseId].dirty).toBe(false);
});
it("stops stale device overwrite and preserves both records before choosing", async () => {
  const { transport, rows } = server(),
    a = device(transport),
    b = device(transport);
  await a.persist(save("start"));
  await a.flush();
  await b.initialize();
  await a.persist(save("computer"));
  await a.flush();
  await b.persist(save("phone"));
  await b.flush();
  expect(rows[c.caseId].save.notes).toBe("computer");
  expect(b.records[c.caseId].conflict?.save.notes).toBe("computer");
  await b.resolve(c.caseId, "device");
  expect(rows[c.caseId].save.notes).toBe("phone");
  expect(await read("account-backup:qa:" + c.caseId)).toMatchObject({
    device: { notes: "phone" },
    cloud: { notes: "computer" },
  });
});
it("can accept the cloud record after a conflict", async () => {
  const { transport } = server(),
    a = device(transport),
    b = device(transport);
  await a.persist(save("remote"));
  await a.flush();
  await b.persist(save("local"));
  await b.flush();
  await b.resolve(c.caseId, "cloud");
  expect(b.records[c.caseId].save.notes).toBe("remote");
  expect(b.records[c.caseId].dirty).toBe(false);
});
it("queues offline progress durably and uploads it after restarting", async () => {
  const { transport, rows } = server();
  let cached: unknown;
  const offline = {
    ...transport,
    put: async () => {
      throw Error("offline");
    },
  };
  const a = device(
    offline,
    "qa",
    async () => null,
    async (x) => {
      cached = structuredClone(x);
    },
  );
  await a.persist(save("offline note"));
  await a.flush();
  a.close();
  const b = device(transport, "qa", async () => cached);
  await b.initialize();
  expect(rows[c.caseId].save.notes).toBe("offline note");
  expect(b.status).toBe("계정에 저장됨");
});
it("does not lose edits made while an upload is in flight", async () => {
  const { transport, rows } = server();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let first = true;
  const delayed = {
    ...transport,
    put: async (s: Save, r: number) => {
      if (first) {
        first = false;
        await gate;
      }
      return transport.put(s, r);
    },
  };
  const d = device(delayed);
  await d.persist(save("old"));
  const upload = d.flush();
  await d.persist(save("new"));
  release();
  await upload;
  expect(d.records[c.caseId].dirty).toBe(true);
  await d.flush();
  expect(rows[c.caseId].save.notes).toBe("new");
  expect(rows[c.caseId].revision).toBe(2);
});
it("does not replace active gameplay with a remote refresh", async () => {
  const { transport } = server(),
    a = device(transport),
    b = device(transport);
  await a.persist(save("start"));
  await a.flush();
  await b.initialize();
  b.playing = true;
  await a.persist(save("another device"));
  await a.flush();
  await b.refresh();
  expect(b.records[c.caseId].save.notes).toBe("start");
  b.playing = false;
  await b.refresh();
  expect(b.records[c.caseId].save.notes).toBe("another device");
});
it("isolates local caches by account and does not upload after sign-out", async () => {
  const { transport } = server();
  const a = new CloudSaves("account-a", transport, () => {}),
    b = new CloudSaves("account-b", transport, () => {});
  running.push(a, b);
  await a.persist(save("private"));
  expect(await read("account:account-b")).toBeUndefined();
  expect(await read("account:account-a")).toBeDefined();
  a.close();
  await expect(a.persist(save("late"))).rejects.toThrow("계정이 변경");
  await a.flush();
  expect(await transport.list()).toEqual([]);
});
it("sends the verified account guard and never sends cross-origin cookies", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response("[]", { status: 200 }));
  await cloudTransport(
    "https://api.example",
    "user-a",
    async () => "signed-token",
  ).list();
  expect(fetcher).toHaveBeenCalledWith(
    "https://api.example/api/v1/ghostdesk/saves",
    expect.objectContaining({
      credentials: "omit",
      cache: "no-store",
      headers: expect.objectContaining({
        "X-GhostDesk-Account": "user-a",
        Authorization: "Bearer signed-token",
      }),
    }),
  );
});
it("ignores a stale list response after a newer upload and another edit", async () => {
  const { transport } = server();
  const d = device(transport);
  await d.persist(save("first"));
  await d.flush();
  const old = await transport.list();
  let release!: (rows: RemoteSave[]) => void, started!: () => void;
  const began = new Promise<void>((r) => (started = r));
  const delayed = {
    ...transport,
    list: () => {
      started();
      return new Promise<RemoteSave[]>((r) => (release = r));
    },
  };
  const reader = device(delayed, "qa", async () => structuredClone(d.records));
  const refreshing = reader.initialize();
  await began;
  await reader.persist(save("second"));
  await reader.flush();
  await reader.persist(save("third"));
  release(old);
  await refreshing;
  expect(reader.records[c.caseId].revision).toBe(2);
  expect(reader.records[c.caseId].conflict).toBeUndefined();
  await reader.flush();
  expect((await transport.list())[0].save.notes).toBe("third");
});
it.each([
  new TypeError("Failed to fetch"),
  new DOMException("The operation was aborted.", "AbortError"),
])(
  "shows a friendly connection error instead of browser internals",
  async (failure) => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(failure);
    await expect(
      cloudTransport(
        "https://api.example",
        "user-a",
        async () => "signed-token",
      ).list(),
    ).rejects.toThrow("이 기기의 진행은 유지");
  },
);
