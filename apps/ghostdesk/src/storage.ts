import { z } from "zod";
import {
  validateCase,
  type CasePackage,
} from "../../../packages/contracts/src";
import {
  restoreState,
  type State,
} from "../../../packages/engine-ghostdesk/src";
export type Save = {
  format: "ghostdesk-save-1";
  case: CasePackage;
  state: State;
  notes: string;
  checkpoint: State | null;
};
export type Draft = { document: CasePackage; revision: number };
// Serialize snapshots, expose each transaction's failure, and let a retry recover.
export function createSaveQueue<T>(persist: (snapshot: T) => Promise<void>) {
  let pending = Promise.resolve();
  return (value: T): Promise<void> => {
    const snapshot = structuredClone(value);
    pending = pending.catch(() => {}).then(() => persist(snapshot));
    return pending;
  };
}
let dbPromise: Promise<IDBDatabase> | undefined;
function db() {
  return (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("ghostdesk-local-v1", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("records");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }).catch((error) => {
    dbPromise = undefined;
    throw error;
  }));
}
export async function read<T>(key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction("records").objectStore("records").get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function write(key: string, value: unknown): Promise<void> {
  return writeRecords([[key, value]]);
}
export async function writePlay(save: Save): Promise<void> {
  return writeRecords(
    [
      ["play", save],
      ["play:" + save.case.caseId, save],
    ],
    save.case.caseId,
  );
}
async function writeRecords(
  records: [string, unknown][],
  nextCaseId?: string,
): Promise<void> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("records", "readwrite");
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
    const store = t.objectStore("records");
    const putAll = (previous?: unknown) => {
      try {
        // Preserve the old single-slot save before the first case switch.
        // Read and both writes share one transaction, including rollback.
        let previousCaseId: string | undefined;
        if (previous) {
          try {
            previousCaseId = parseSave(previous).case.caseId;
          } catch {
            /* A damaged recent slot must not block other valid cases. */
          }
        }
        if (previousCaseId && previousCaseId !== nextCaseId)
          store.put(previous, "play:" + previousCaseId);
        for (const [key, value] of records) store.put(value, key);
      } catch (error) {
        t.abort();
        reject(error);
      }
    };
    if (nextCaseId) {
      const recent = store.get("play");
      recent.onsuccess = () => putAll(recent.result);
    } else putAll();
  });
}
export function parseSave(raw: unknown): Save {
  const p = z
    .object({
      format: z.literal("ghostdesk-save-1"),
      case: z.unknown(),
      state: z.unknown(),
      notes: z.string().max(10000),
      checkpoint: z.unknown().nullable(),
    })
    .strict()
    .parse(raw);
  const result = validateCase(p.case);
  if (!result.data) throw Error(result.errors[0]?.message || "사건 검증 실패");
  const state = restoreState(result.data, p.state);
  const checkpoint =
    p.checkpoint !== null ? restoreState(result.data, p.checkpoint) : null;
  if (checkpoint?.mode === "ENDED")
    throw Error("조사 복귀 지점이 올바르지 않습니다.");
  return {
    format: p.format,
    case: result.data,
    state,
    notes: p.notes,
    checkpoint,
  };
}
export function download(name: string, object: unknown) {
  const blob = new Blob([JSON.stringify(object, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export async function importJson(file: File) {
  if (file.size > 1048576)
    throw Error("1MiB 이하의 JSON만 가져올 수 있습니다.");
  return JSON.parse(await file.text()) as unknown;
}
