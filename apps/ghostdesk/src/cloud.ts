import { UserMessage, userMessage } from "./feedback";
import { parseSave, read, write, createSaveQueue, type Save } from "./storage";
import { caseLibrary } from "./cases";
export type RemoteSave = {
  caseId: string;
  save: Save;
  revision: number;
  updatedAt: string;
};
export type LocalSave = {
  save: Save;
  revision: number;
  dirty: boolean;
  sequence: number;
  conflict?: RemoteSave | null;
};
export interface SaveTransport {
  list(): Promise<RemoteSave[]>;
  put(save: Save, revision: number): Promise<RemoteSave>;
}
export class SaveConflict extends Error {
  constructor(public current: RemoteSave | null) {
    super("save_conflict");
  }
}
export function parseRemote(raw: unknown): RemoteSave {
  const x = raw as RemoteSave;
  if (
    !x ||
    !Number.isSafeInteger(x.revision) ||
    x.revision < 1 ||
    typeof x.updatedAt !== "string"
  )
    throw new UserMessage("저장 형식이 올바르지 않습니다.");
  const save = parseSave(x.save);
  if (save.case.caseId !== x.caseId)
    throw new UserMessage("사건 번호가 일치하지 않습니다.");
  return { ...x, save };
}
export function cloudTransport(
  base: string,
  userId: string,
  token: () => Promise<string>,
): SaveTransport {
  async function request(path: string, body?: unknown) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const jwt = await token();
      const r = await fetch(
        base.replace(/\/$/, "") + "/api/v1/ghostdesk/saves" + path,
        {
          method: body ? "PUT" : "GET",
          credentials: "omit",
          cache: "no-store",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            Authorization: "Bearer " + jwt,
            "X-GhostDesk-Account": userId,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        },
      );
      if (r.status === 401)
        throw new UserMessage("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      if (r.status === 409) {
        const x = await r.json();
        throw new SaveConflict(x.current ? parseRemote(x.current) : null);
      }
      if (!r.ok)
        throw new UserMessage(
          "계정 저장에 연결하지 못했습니다. 기기 진행은 보관됩니다.",
        );
      return await r.json();
    } catch (error) {
      if (error instanceof SaveConflict || error instanceof UserMessage)
        throw error;
      throw new UserMessage(
        "계정 저장에 연결하지 못했습니다. 이 기기의 진행은 유지되며 다시 연결되면 저장합니다.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    async list() {
      const rows = await request("");
      if (!Array.isArray(rows) || rows.length > 50)
        throw new UserMessage(
          "계정의 진행 목록을 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
        );
      return rows.map(parseRemote);
    },
    async put(save, revision) {
      return parseRemote(
        await request("/" + encodeURIComponent(save.case.caseId), {
          save,
          expectedRevision: revision,
        }),
      );
    },
  };
}
/** Coalesced upload queue. The server revision, never a device clock, decides conflicts. */
export class CloudSaves {
  records: Record<string, LocalSave> = Object.create(null);
  playing = false;
  status = "계정 저장을 확인하는 중";
  private closed = false;
  private busy?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private cache: (records: Record<string, LocalSave>) => Promise<void>;
  constructor(
    public userId: string,
    private transport: SaveTransport,
    private changed: () => void,
    private load: () => Promise<unknown> = () => read("account:" + userId),
    persist: (records: Record<string, LocalSave>) => Promise<void> = (
      records,
    ) => write("account:" + userId, records),
  ) {
    this.cache = createSaveQueue(persist);
  }
  private emit() {
    if (!this.closed) this.changed();
  }
  private label() {
    this.status = Object.values(this.records).some(
      (x) => x.conflict !== undefined,
    )
      ? "저장 충돌 · 홈에서 선택"
      : Object.values(this.records).some((x) => x.dirty)
        ? "계정 전송 대기 · 기기 저장됨"
        : "계정에 저장됨";
    this.emit();
  }
  private schedule(delay = 1000) {
    if (this.closed) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, delay);
  }
  async initialize() {
    try {
      const stored = await this.load();
      if (stored && typeof stored === "object")
        for (const raw of Object.values(stored)) {
          try {
            const x = raw as LocalSave,
              save = parseSave(x.save);
            if (
              !Number.isSafeInteger(x.revision) ||
              x.revision < 0 ||
              typeof x.dirty !== "boolean"
            )
              continue;
            this.records[save.case.caseId] = {
              save,
              revision: x.revision,
              dirty: x.dirty,
              sequence: 0,
              ...(x.conflict !== undefined
                ? { conflict: x.conflict ? parseRemote(x.conflict) : null }
                : {}),
            };
          } catch {
            /* Isolate a damaged slot; other cases still load. */
          }
        }
    } catch {
      this.status = "기기 저장을 읽지 못했습니다";
    }
    if (this.closed) return;
    await this.refresh();
  }
  saves(): Record<string, Save> {
    return Object.fromEntries(
      Object.entries(this.records).map(([id, x]) => [id, x.save]),
    );
  }
  async persist(save: Save) {
    if (this.closed) throw new UserMessage("계정이 변경되었습니다.");
    const id = save.case.caseId,
      old = this.records[id];
    const official = caseLibrary.some(
      (e) => e.case.versionId === save.case.versionId,
    );
    this.records[id] = {
      ...old,
      save: structuredClone(save),
      revision: old?.revision ?? 0,
      dirty: official,
      sequence: (old?.sequence ?? 0) + 1,
    };
    await this.cache(this.records);
    if (!official) {
      this.status = "사용자 사건은 기기에 저장됨";
      this.emit();
      return;
    }
    this.label();
    this.schedule();
  }
  async refresh() {
    if (this.closed) return;
    await this.flush();
    try {
      const rows = await this.transport.list();
      if (this.closed || this.playing) return;
      for (const remote of rows) {
        const id = remote.caseId,
          local = this.records[id];
        if (local?.dirty) {
          if (remote.revision > local.revision) local.conflict = remote;
        } else if (!local || remote.revision > local.revision) {
          this.records[id] = {
            save: remote.save,
            revision: remote.revision,
            dirty: false,
            sequence: (local?.sequence ?? 0) + 1,
          };
        }
      }
      await this.cache(this.records);
      this.label();
    } catch (e) {
      this.status = userMessage(
        e,
        "계정 기록을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
      this.emit();
    }
  }
  flush(): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (this.busy) return this.busy;
    clearTimeout(this.timer);
    this.busy = this.upload().finally(() => {
      this.busy = undefined;
    });
    return this.busy;
  }
  private async upload() {
    let retry = false;
    for (const id of Object.keys(this.records)) {
      const local = this.records[id];
      if (this.closed || !local.dirty || local.conflict !== undefined) continue;
      const snapshot = structuredClone(local);
      try {
        this.status = "계정에 저장 중";
        this.emit();
        const remote = await this.transport.put(
          snapshot.save,
          snapshot.revision,
        );
        if (this.closed) return;
        const current = this.records[id];
        current.revision = remote.revision;
        current.dirty = current.sequence !== snapshot.sequence;
        // Keep newer edits made while the HTTP request was in flight.
        await this.cache(this.records);
      } catch (e) {
        if (this.closed) return;
        if (e instanceof SaveConflict) this.records[id].conflict = e.current;
        else {
          retry = true;
          this.status = userMessage(
            e,
            "계정 저장을 기다리는 중입니다. 이 기기의 진행은 유지됩니다.",
          );
        }
        await this.cache(this.records).catch(() => {});
      }
    }
    if (!retry) this.label();
    else this.emit();
    if (
      Object.values(this.records).some(
        (x) => x.dirty && x.conflict === undefined,
      )
    )
      this.schedule(retry ? 15000 : 1000);
  }
  async resolve(id: string, choice: "cloud" | "device") {
    const local = this.records[id];
    if (!local || local.conflict === undefined) return;
    const remote = local.conflict;
    // Keep a recoverable backup before either explicit replacement.
    await write("account-backup:" + this.userId + ":" + id, {
      device: local.save,
      cloud: remote?.save ?? null,
    });
    if (choice === "cloud" && remote) {
      this.records[id] = {
        save: remote.save,
        revision: remote.revision,
        dirty: false,
        sequence: local.sequence + 1,
      };
    } else {
      local.revision = remote?.revision ?? 0;
      local.conflict = undefined;
      local.dirty = true;
      local.sequence++;
    }
    await this.cache(this.records);
    this.label();
    await this.flush();
  }
  close() {
    this.closed = true;
    clearTimeout(this.timer);
  }
}
