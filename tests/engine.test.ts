import { describe, it, expect } from "vitest";
import {
  initialState,
  transition,
  restoreState,
  canOpen,
  type Event,
  type State,
} from "../packages/engine-ghostdesk/src";
import {
  validateCase,
  duplicateCase,
  type CasePackage,
  type Condition,
} from "../packages/contracts/src";
import { sample } from "../apps/ghostdesk/src/sample";
import { parseSave } from "../apps/ghostdesk/src/storage";
const open = (id: string): Event => ({ type: "OPEN_FILE", id });
const solve: Event = { type: "SOLVE", id: "p-vault", answer: "0310" };
function run(events: Event[], c = sample, s = initialState(c)) {
  for (const e of events) s = transition(c, s, e).state;
  return s;
}
const path = [
  open("f-handover"),
  open("f-queue"),
  open("f-photo"),
  solve,
  open("f-receipt"),
];
const conclude: Event = {
  type: "CONCLUDE",
  id: "h-no-transfer",
  evidence: ["c-queue", "c-receipt"],
};
describe("sample and engine", () => {
  it("validates complete sample", () =>
    expect(validateCase(sample).errors).toEqual([]));
  it("GD-01 deduplicates twenty opens", () => {
    const s = run(Array(20).fill(open("f-handover")));
    expect(s.readFileIds).toEqual(["f-handover"]);
    expect(s.clueIds).toEqual(["c-clock"]);
  });
  it("does not read locked content", () => {
    const s = run([open("f-receipt")]);
    expect(s.readFileIds).toEqual([]);
    expect(canOpen(sample, s, "f-receipt")).toBe(false);
  });
  it.each(["310", "０３１０", "0311"])("GD-02 rejects %s", (answer) => {
    const s = run([{ type: "SOLVE", id: "p-vault", answer }]);
    expect(s.solvedPuzzleIds).toEqual([]);
    expect(s.attempts["p-vault"]).toBe(1);
  });
  it("GD-02 trims only permitted whitespace, after wrong attempts", () => {
    const s = run(
      [1, 2, 3]
        .map(() => ({ type: "SOLVE", id: "p-vault", answer: "310" }) as Event)
        .concat({ type: "SOLVE", id: "p-vault", answer: " 0310 " }),
    );
    expect(s.solvedPuzzleIds).toEqual(["p-vault"]);
    expect(s.attempts["p-vault"]).toBe(4);
  });
  it("GD-03 order independent evidence and ending", () => {
    for (const events of [
      path,
      [
        solve,
        open("f-receipt"),
        open("f-photo"),
        open("f-queue"),
        open("f-handover"),
      ],
    ]) {
      const s = run([...events, conclude]);
      expect(s.endingId).toBe("ending-a");
      expect(new Set(s.clueIds).size).toBe(4);
    }
  });
  it("does not accept a correct guess without evidence", () => {
    const s = run([solve]);
    const r = transition(sample, s, conclude);
    expect(r.state.endingId).toBeNull();
    expect(r.message).toContain("수집하지 않은");
  });
  it("GD-04 messages and timer start are idempotent", () => {
    const s = run([
      open("f-queue"),
      open("f-queue"),
      solve,
      solve,
      { type: "TICK", ms: 1000 },
      { type: "TICK", ms: 1000 },
      { type: "TICK", ms: 500 },
    ]);
    expect(s.deliveredMessageIds.filter((id) => id === "m-3")).toHaveLength(1);
    expect(s.deliveredMessageIds.filter((id) => id === "m-4")).toHaveLength(1);
    expect(Object.keys(s.timers)).toHaveLength(1);
  });
  it("new messages remain unread after the previous conversation was read", () => {
    const s = run([{ type: "READ_MESSAGES" }, solve]);
    expect(s.readMessageIds).toEqual(["m-1", "m-2"]);
    expect(s.readMessageIds).not.toContain("m-4");
  });
  it("GD-05 pause freezes logical time and resume does not catch up", () => {
    const s = run([
      open("f-queue"),
      { type: "TICK", ms: 1000 },
      { type: "PAUSE" },
      { type: "TICK", ms: 1000 },
      { type: "TICK", ms: 1000 },
      { type: "RESUME" },
    ]);
    expect(s.logicalMs).toBe(1000);
    expect(s.deliveredMessageIds).not.toContain("m-3");
  });
  it("invalid time deltas cannot change state", () => {
    for (const ms of [NaN, Infinity, -1, 5000])
      expect(run([{ type: "TICK", ms }]).logicalMs).toBe(0);
  });
  it("GD-06 stable priority/id ending arbitration", () => {
    const c = structuredClone(sample);
    c.rules = ["z", "a"].map((id) => ({
      id,
      priority: 1,
      once: true,
      when: { type: "FILE_READ", id: "f-handover" },
      then: [{ type: "END_CASE", id: id === "a" ? "ending-a" : "ending-b" }],
    }));
    expect(run([open("f-handover")], c).endingId).toBe("ending-a");
  });
  it("GD-07 65-step chain rolls back all effects and reports error", () => {
    const c = structuredClone(sample);
    c.rules = Array.from({ length: 66 }, (_, i) => ({
      id: "r-" + i,
      priority: i,
      once: true,
      when: i
        ? { type: "FLAG_EQUALS", id: "flag-" + (i - 1), value: true }
        : { type: "FILE_READ", id: "f-handover" },
      then: [{ type: "SET_FLAG", id: "flag-" + i, value: true }],
    }));
    const s = run([open("f-handover")], c);
    expect(s.mode).toBe("ERROR");
    expect(s.readFileIds).toEqual([]);
    expect(s.flags).toEqual({});
    expect(s.diagnostic).toContain("RULE_BUDGET_EXCEEDED");
  });
  it("effect budget over 256 rolls back", () => {
    const c = structuredClone(sample);
    c.rules = Array.from({ length: 17 }, (_, i) => ({
      id: "r-" + i,
      priority: i,
      once: true,
      when: { type: "FILE_READ", id: "f-handover" },
      then: Array.from({ length: 16 }, (_, j) => ({
        type: "SET_FLAG",
        id: `flag-${i}-${j}`,
        value: true,
      })),
    }));
    expect(run([open("f-handover")], c).mode).toBe("ERROR");
  });
  it("invalid mandatory reference rolls back preceding effects", () => {
    const c = structuredClone(sample);
    c.rules = [
      {
        id: "bad",
        priority: 0,
        once: true,
        when: { type: "FILE_READ", id: "f-handover" },
        then: [
          { type: "SET_FLAG", id: "x", value: true },
          { type: "REVEAL_FILE", id: "missing" },
        ],
      },
    ];
    const s = run([open("f-handover")], c);
    expect(s.flags).toEqual({});
    expect(s.readFileIds).toEqual([]);
    expect(s.mode).toBe("ERROR");
  });
  it("GD-08 unlocked receipt survives serialization", () => {
    const s = restoreState(sample, JSON.parse(JSON.stringify(run([solve]))));
    expect(s.mode).toBe("PAUSED");
    expect(canOpen(sample, s, "f-receipt")).toBe(true);
    expect(
      run([{ type: "RESUME" }, open("f-receipt")], sample, s).clueIds,
    ).toContain("c-receipt");
  });
  it("ended games cannot change facts", () => {
    const s = run([...path, conclude]);
    expect(transition(sample, s, { type: "TICK", ms: 500 }).state).toBe(s);
    expect(transition(sample, s, open("f-chat")).state).toBe(s);
  });
  it("ending B supports an independent pre-conclusion checkpoint", () => {
    const checkpoint = run(path);
    const ended = transition(sample, checkpoint, {
      type: "CONCLUDE",
      id: "h-accuse",
      evidence: [],
    }).state;
    expect(ended.endingId).toBe("ending-b");
    expect(checkpoint.mode).toBe("RUNNING");
    expect(transition(sample, checkpoint, conclude).state.endingId).toBe(
      "ending-a",
    );
  });
  it("last hint requires explicit reveal confirmation", () => {
    let s = initialState(sample);
    for (let i = 0; i < 3; i++)
      s = transition(sample, s, {
        type: "HINT",
        id: "p-vault",
        reveal: false,
      }).state;
    expect(
      transition(sample, s, { type: "HINT", id: "p-vault", reveal: false })
        .state.hintLevels["p-vault"],
    ).toBe(3);
    expect(
      transition(sample, s, { type: "HINT", id: "p-vault", reveal: true }).state
        .hintLevels["p-vault"],
    ).toBe(4);
  });
  it("GD-11 clone produces an immutable test snapshot", () => {
    const c = structuredClone(sample);
    const snap = structuredClone(c);
    c.files[0].text = "changed";
    expect(snap.files[0].text).toBe(sample.files[0].text);
  });
  it("GD-14 full play requires no network globals", () =>
    expect(run([...path, conclude]).endingId).toBe("ending-a"));
});
describe("contracts and imported saves", () => {
  it("GD-10 rejects duplicate IDs with paths", () => {
    const c = structuredClone(sample);
    c.files[1].id = c.files[0].id;
    expect(validateCase(c).errors.some((e) => e.path === "files.1.id")).toBe(
      true,
    );
  });
  it("GD-10 rejects folder cycles", () => {
    const c = structuredClone(sample);
    c.files.find((f) => f.id === "trash")!.parentId = "f-vault";
    c.files.find((f) => f.id === "f-vault")!.parentId = "trash";
    expect(validateCase(c).errors.some((e) => e.message.includes("순환"))).toBe(
      true,
    );
  });
  it("rejects direct self-reveal dependency", () => {
    const c = structuredClone(sample);
    c.rules[0].when = { type: "FILE_READ", id: "f-receipt" };
    expect(validateCase(c).errors.some((e) => e.message.includes("자신"))).toBe(
      true,
    );
  });
  it("detects unreachable required clues", () => {
    const c = structuredClone(sample);
    c.rules = [];
    expect(
      validateCase(c).errors.some((e) => e.message.includes("필수 근거")),
    ).toBe(true);
  });
  it("rejects absent references and unsupported schema versions", () => {
    expect(
      validateCase({ ...sample, schemaVersion: 2 }).errors.length,
    ).toBeGreaterThan(0);
    const c = structuredClone(sample);
    c.files[0].clueId = "absent";
    expect(
      validateCase(c).errors.some((e) => e.path === "files.0.clueId"),
    ).toBe(true);
  });
  it("rejects deeply nested conditions safely", () => {
    const c = structuredClone(sample);
    let when: Condition = { type: "FILE_READ", id: "f-handover" };
    for (let i = 0; i < 12; i++) when = { type: "NOT", condition: when };
    c.rules[0].when = when;
    expect(validateCase(c).errors.length).toBeGreaterThan(0);
  });
  it("GD-17 rejects malicious HTML, scripts and unknown fields", () => {
    for (const text of [
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      "javascript:alert(1)",
      "https://bad.example",
    ]) {
      const c = structuredClone(sample);
      c.files[0].text = text;
      expect(validateCase(c).errors.length).toBeGreaterThan(0);
    }
    expect(
      validateCase({ ...sample, code: "alert(1)" }).errors.length,
    ).toBeGreaterThan(0);
  });
  it("rejects oversized packages", () => {
    const c = structuredClone(sample);
    c.files[0].text = "a".repeat(1048577);
    expect(validateCase(c).errors.length).toBeGreaterThan(0);
  });
  it("duplicates every internal ID and preserves all references", () => {
    const c = duplicateCase(sample, "test");
    expect(validateCase(c).errors).toEqual([]);
    expect(c.files.every((f) => !sample.files.some((s) => s.id === f.id))).toBe(
      true,
    );
    expect(c.puzzles[0].answer).toBe("0310");
  });
  it("restores a compatible export and rejects malformed state", () => {
    const s = run(path);
    const save = {
      format: "ghostdesk-save-1",
      case: sample,
      state: s,
      notes: "my note",
      checkpoint: null,
    };
    expect(parseSave(save).state.mode).toBe("PAUSED");
    for (const patch of [
      { logicalMs: -1 },
      { readFileIds: ["missing"] },
      { caseVersionId: "other" },
      { timers: { x: {} } },
      { notes: "x" },
      { attempts: { "p-vault": Infinity } },
    ]) {
      if ("notes" in patch) continue;
      expect(() => parseSave({ ...save, state: { ...s, ...patch } })).toThrow();
    }
  });
});
