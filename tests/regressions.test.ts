import { describe, expect, it, vi } from "vitest";
import { sample } from "../apps/ghostdesk/src/sample";
import { createSaveQueue, parseSave } from "../apps/ghostdesk/src/storage";
import {
  duplicateCase,
  validateCase,
  type CasePackage,
} from "../packages/contracts/src";
import {
  canInspect,
  canOpen,
  initialState,
  restoreState,
  transition,
} from "../packages/engine-ghostdesk/src";

describe("file access regressions", () => {
  it("allows a visible lock screen while denying its contents and descendants", () => {
    const c = structuredClone(sample);
    c.files.find((f) => f.id === "f-receipt")!.visible = true;
    const s = initialState(c);
    expect(canInspect(c, s, "f-vault")).toBe(true);
    expect(canOpen(c, s, "f-vault")).toBe(false);
    expect(canInspect(c, s, "f-receipt")).toBe(false);
    const unlocked = transition(c, s, {
      type: "SOLVE",
      id: "p-vault",
      answer: "0310",
    }).state;
    expect(canInspect(c, unlocked, "f-receipt")).toBe(true);
  });
  it("denies hidden files even when a rule has already awarded their clue", () => {
    const s = initialState(sample);
    s.clueIds.push("c-receipt");
    expect(canInspect(sample, s, "f-receipt")).toBe(false);
  });
  it("does not solve a puzzle behind a hidden ancestor", () => {
    const c = structuredClone(sample);
    c.files.find((f) => f.id === "f-vault")!.parentId = "trash";
    c.files.find((f) => f.id === "trash")!.visible = false;
    const s = initialState(c);
    expect(
      transition(c, s, { type: "SOLVE", id: "p-vault", answer: "0310" }).state,
    ).toBe(s);
  });
});

describe("imported case IDs", () => {
  it.each(["constructor", "__proto__", "toString"])(
    "handles %s as flag, timer and puzzle IDs across save restoration",
    (id) => {
      const c = JSON.parse(
        JSON.stringify(sample).replaceAll('"p-vault"', JSON.stringify(id)),
      ) as CasePackage;
      c.rules = [
        {
          id: "start",
          once: true,
          priority: 0,
          when: { type: "FILE_READ", id: "f-handover" },
          then: [
            { type: "SET_FLAG", id, value: true },
            { type: "START_TIMER", id, durationMs: 250 },
          ],
        },
        {
          id: "finish",
          once: true,
          priority: 1,
          when: {
            type: "ALL",
            conditions: [
              { type: "FLAG_EQUALS", id, value: true },
              { type: "TIMER_REACHED", id },
            ],
          },
          then: [{ type: "REVEAL_FILE", id: "f-receipt" }],
        },
      ];
      expect(validateCase(c).errors).toEqual([]);
      let s = transition(c, initialState(c), {
        type: "OPEN_FILE",
        id: "f-handover",
      }).state;
      expect(s.mode).toBe("RUNNING");
      expect(s.flags[id]).toBe(true);
      s = restoreState(c, JSON.parse(JSON.stringify(s)));
      s = transition(c, s, { type: "RESUME" }).state;
      s = transition(c, s, { type: "SOLVE", id, answer: "0310" }).state;
      expect(s.attempts[id]).toBe(1);
      expect(s.solvedPuzzleIds).toContain(id);
      s = transition(c, s, { type: "HINT", id, reveal: false }).state;
      expect(s.hintLevels[id]).toBe(1);
      s = transition(c, s, { type: "TICK", ms: 250 }).state;
      expect(s.firedRuleIds).toContain("finish");
      expect(s.mode).toBe("RUNNING");
    },
  );
  it("keeps long IDs distinct when duplicating a case", () => {
    const c = structuredClone(sample);
    const prefix = "f".repeat(60);
    c.files.push(
      ...["a", "b"].map((suffix) => ({
        id: prefix + suffix,
        type: "TEXT" as const,
        title: suffix,
        text: "",
        parentId: null,
        visible: true,
      })),
    );
    const copy = duplicateCase(c, "12345678");
    expect(new Set(copy.files.map((f) => f.id)).size).toBe(copy.files.length);
    expect(validateCase(copy).errors).toEqual([]);
  });
});

describe("durable save sequencing", () => {
  it("waits for the transaction and preserves the enqueued snapshot", async () => {
    let finish!: () => void;
    const stored: { notes: string }[] = [];
    const save = createSaveQueue<{ notes: string }>(async (value) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      stored.push(value);
    });
    const draft = { notes: "before leaving" };
    const completed = vi.fn();
    const pending = save(draft).then(completed);
    draft.notes = "changed later";
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    expect(completed).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(stored).toEqual([{ notes: "before leaving" }]);
    expect(completed).toHaveBeenCalledOnce();
  });
  it("keeps the newest save after rapid consecutive writes", async () => {
    const written: number[] = [];
    const save = createSaveQueue<number>(async (value) => {
      written.push(value);
    });
    await Promise.all([save(1), save(2), save(3)]);
    expect(written).toEqual([1, 2, 3]);
  });
  it("reports storage failure and allows a later retry", async () => {
    const writer = vi
      .fn<(value: number) => Promise<void>>()
      .mockRejectedValueOnce(new Error("quota exceeded"))
      .mockResolvedValueOnce(undefined);
    const save = createSaveQueue(writer);
    await expect(save(1)).rejects.toThrow("quota exceeded");
    await expect(save(2)).resolves.toBeUndefined();
    expect(writer).toHaveBeenLastCalledWith(2);
  });
  it.each([false, 0, "", undefined])(
    "rejects a malformed checkpoint: %s",
    (checkpoint) => {
      expect(() =>
        parseSave({
          format: "ghostdesk-save-1",
          case: sample,
          state: initialState(sample),
          notes: "",
          checkpoint,
        }),
      ).toThrow();
    },
  );
});
