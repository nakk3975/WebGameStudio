import {
  ENGINE,
  type CasePackage,
  type Condition,
  type Effect,
} from "../../contracts/src";
export type State = {
  caseVersionId: string;
  schemaVersion: 1;
  engineVersion: string;
  mode: "RUNNING" | "PAUSED" | "ENDED" | "ERROR";
  logicalMs: number;
  readFileIds: string[];
  solvedPuzzleIds: string[];
  clueIds: string[];
  flags: Record<string, boolean>;
  visibleFileIds: string[];
  deliveredMessageIds: string[];
  readMessageIds: string[];
  firedRuleIds: string[];
  timers: Record<
    string,
    { startMs: number; durationMs: number; ruleId: string }
  >;
  endingId: string | null;
  eventSeq: number;
  attempts: Record<string, number>;
  hintLevels: Record<string, number>;
  diagnostic?: string;
};
export type Event =
  | { type: "OPEN_FILE"; id: string }
  | { type: "SOLVE"; id: string; answer: string }
  | { type: "TICK"; ms: number }
  | { type: "PAUSE" | "RESUME" | "READ_MESSAGES" }
  | { type: "CONCLUDE"; id: string; evidence: string[] }
  | { type: "HINT"; id: string; reveal: boolean };
export type Result = { state: State; message?: string };
const add = (a: string[], id: string) => {
  if (!a.includes(id)) a.push(id);
};
// IDs are data, including names such as "constructor" and "__proto__".
// structuredClone restores Object.prototype, so normalize after every clone.
function records(s: State): State {
  s.flags = Object.assign(Object.create(null), s.flags);
  s.timers = Object.assign(Object.create(null), s.timers);
  s.attempts = Object.assign(Object.create(null), s.attempts);
  s.hintLevels = Object.assign(Object.create(null), s.hintLevels);
  return s;
}
const order = (
  a: { priority: number; id: string },
  b: { priority: number; id: string },
) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export function initialState(c: CasePackage): State {
  return records({
    caseVersionId: c.versionId,
    schemaVersion: 1,
    engineVersion: ENGINE,
    mode: "RUNNING",
    logicalMs: 0,
    readFileIds: [],
    solvedPuzzleIds: [],
    clueIds: [],
    flags: {},
    visibleFileIds: c.files.filter((f) => f.visible).map((f) => f.id),
    deliveredMessageIds: c.messages.filter((m) => m.initial).map((m) => m.id),
    readMessageIds: [],
    firedRuleIds: [],
    timers: {},
    endingId: null,
    eventSeq: 0,
    attempts: {},
    hintLevels: {},
  });
}
export function matches(c: Condition, s: State): boolean {
  switch (c.type) {
    case "ALL":
      return c.conditions.every((x) => matches(x, s));
    case "ANY":
      return c.conditions.some((x) => matches(x, s));
    case "NOT":
      return !matches(c.condition, s);
    case "FILE_READ":
      return s.readFileIds.includes(c.id);
    case "CLUE_FOUND":
      return s.clueIds.includes(c.id);
    case "PUZZLE_SOLVED":
      return s.solvedPuzzleIds.includes(c.id);
    case "FLAG_EQUALS":
      return s.flags[c.id] === c.value;
    case "TIMER_REACHED": {
      const t = s.timers[c.id];
      return !!t && s.logicalMs - t.startMs >= t.durationMs;
    }
  }
}
export function canOpen(c: CasePackage, s: State, id: string): boolean {
  const f = c.files.find((x) => x.id === id);
  return (
    !!f &&
    canInspect(c, s, id) &&
    (!f.puzzleId || s.solvedPuzzleIds.includes(f.puzzleId))
  );
}
// A file's own lock screen is accessible; hidden files and locked ancestors are not.
export function canInspect(c: CasePackage, s: State, id: string): boolean {
  const f = c.files.find((x) => x.id === id);
  return (
    !!f &&
    s.visibleFileIds.includes(id) &&
    (!f.parentId || canOpen(c, s, f.parentId))
  );
}
export function transition(
  c: CasePackage,
  previous: State,
  event: Event,
): Result {
  if (previous.caseVersionId !== c.versionId)
    return { state: previous, message: "다른 사건 버전의 저장입니다." };
  if (previous.mode === "ERROR" || previous.mode === "ENDED")
    return { state: previous };
  if (event.type === "PAUSE") return { state: { ...previous, mode: "PAUSED" } };
  if (event.type === "RESUME")
    return { state: { ...previous, mode: "RUNNING" } };
  if (previous.mode !== "RUNNING") return { state: previous };
  const s = records(structuredClone(previous));
  let message: string | undefined;
  try {
    switch (event.type) {
      case "OPEN_FILE": {
        const f = c.files.find((x) => x.id === event.id);
        if (!f || !canOpen(c, s, event.id))
          return {
            state: previous,
            message: "먼저 폴더의 잠금을 해제해 주세요.",
          };
        add(s.readFileIds, f.id);
        if (f.clueId) add(s.clueIds, f.clueId);
        break;
      }
      case "SOLVE": {
        const p = c.puzzles.find((x) => x.id === event.id);
        if (!p || typeof event.answer !== "string" || event.answer.length > 100)
          return { state: previous, message: "유효하지 않은 암호 입력입니다." };
        if (!c.files.some((f) => f.puzzleId === p.id && canInspect(c, s, f.id)))
          return {
            state: previous,
            message: "먼저 잠긴 파일에 접근해 주세요.",
          };
        s.attempts[p.id] = (s.attempts[p.id] || 0) + 1;
        const normalize = (v: string) => {
          v = v.trim().normalize("NFC");
          return p.ignoreCase ? v.toLowerCase() : v;
        };
        if (normalize(event.answer) === normalize(p.answer)) {
          add(s.solvedPuzzleIds, p.id);
          message = "잠금이 해제되었습니다.";
        } else
          message =
            "암호가 일치하지 않습니다. 선행 0을 포함한 문자열을 확인하세요.";
        break;
      }
      case "TICK":
        if (!Number.isFinite(event.ms) || event.ms < 0 || event.ms > 1000)
          return { state: previous };
        else s.logicalMs += event.ms;
        break;
      case "READ_MESSAGES":
        s.readMessageIds = [...s.deliveredMessageIds];
        break;
      case "HINT": {
        const p = c.puzzles.find((x) => x.id === event.id);
        if (!p) return { state: previous };
        const level = s.hintLevels[p.id] || 0;
        if (level === p.hints.length - 1 && !event.reveal)
          return {
            state: previous,
            message:
              "마지막 힌트에는 정답이 포함됩니다. 정답 공개를 선택해 주세요.",
          };
        s.hintLevels[p.id] = Math.min(level + 1, p.hints.length);
        break;
      }
      case "CONCLUDE": {
        const h = c.hypotheses.find((x) => x.id === event.id);
        if (!h) return { state: previous, message: "가설을 선택해 주세요." };
        if (event.evidence.some((id) => !s.clueIds.includes(id)))
          return {
            state: previous,
            message: "아직 수집하지 않은 증거가 있습니다.",
          };
        if (!h.requiredClues.every((id) => event.evidence.includes(id)))
          return {
            state: previous,
            message:
              "필수 근거가 부족합니다. 전송 요청과 실제 처리 결과를 함께 선택해 주세요.",
          };
        s.endingId = h.endingId;
        s.mode = "ENDED";
        break;
      }
    }
    s.eventSeq++;
    if (s.mode === "ENDED") return { state: s };
    const sorted = [...c.rules].sort(order);
    let count = 0;
    const endings: { id: string; priority: number; endingId: string }[] = [];
    function effect(e: Effect, ruleId: string, priority: number) {
      const requireId = (list: { id: string }[]) => {
        if (!list.some((x) => x.id === e.id))
          throw Error(`INVALID_REFERENCE:${ruleId}:${e.id}`);
      };
      switch (e.type) {
        case "REVEAL_FILE":
          requireId(c.files);
          add(s.visibleFileIds, e.id);
          break;
        case "ADD_CLUE":
          requireId(c.clues);
          add(s.clueIds, e.id);
          break;
        case "APPEND_MESSAGE":
          requireId(c.messages);
          add(s.deliveredMessageIds, e.id);
          break;
        case "SET_FLAG":
          s.flags[e.id] = e.value;
          break;
        case "START_TIMER":
          if (!s.timers[e.id])
            s.timers[e.id] = {
              startMs: s.logicalMs,
              durationMs: e.durationMs,
              ruleId,
            };
          else if (s.timers[e.id].ruleId !== ruleId)
            throw Error("DUPLICATE_TIMER:" + e.id);
          break;
        case "END_CASE":
          requireId(c.endings);
          endings.push({ id: ruleId, priority, endingId: e.id });
          break;
      }
    }
    for (let step = 0; ; step++) {
      const active = sorted.filter(
        (r) => !s.firedRuleIds.includes(r.id) && matches(r.when, s),
      );
      if (!active.length) break;
      if (step >= 64) throw Error("RULE_BUDGET_EXCEEDED:steps");
      for (const r of active) {
        add(s.firedRuleIds, r.id);
        for (const e of r.then) {
          if (++count > 256) throw Error("RULE_BUDGET_EXCEEDED:effects");
          effect(e, r.id, r.priority);
        }
      }
    }
    if (endings.length) {
      s.endingId = endings.sort(order)[0].endingId;
      s.mode = "ENDED";
    }
    return { state: s, message };
  } catch (error) {
    return {
      state: {
        ...previous,
        mode: "ERROR",
        diagnostic: error instanceof Error ? error.message : "ENGINE_ERROR",
      },
      message: "사건 규칙 오류로 진행을 멈췄습니다. 직전 저장은 유지됩니다.",
    };
  }
}
export function restoreState(c: CasePackage, input: unknown): State {
  if (!input || typeof input !== "object")
    throw Error("저장 형식이 올바르지 않습니다.");
  const s = input as State;
  if (
    s.caseVersionId !== c.versionId ||
    s.engineVersion !== ENGINE ||
    s.schemaVersion !== 1
  )
    throw Error("사건 또는 엔진 버전이 일치하지 않습니다.");
  if (
    !["RUNNING", "PAUSED", "ENDED"].includes(s.mode) ||
    !Number.isSafeInteger(s.logicalMs) ||
    s.logicalMs < 0 ||
    !Number.isSafeInteger(s.eventSeq) ||
    s.eventSeq < 0
  )
    throw Error("손상된 저장 상태입니다.");
  const refs: Record<string, { id: string }[]> = {
    readFileIds: c.files,
    solvedPuzzleIds: c.puzzles,
    clueIds: c.clues,
    visibleFileIds: c.files,
    deliveredMessageIds: c.messages,
    readMessageIds: c.messages,
    firedRuleIds: c.rules,
  };
  for (const [key, allowed] of Object.entries(refs)) {
    const list = s[key as keyof State];
    if (
      !Array.isArray(list) ||
      list.length > 300 ||
      new Set(list).size !== list.length ||
      list.some(
        (x) => typeof x !== "string" || !allowed.some((a) => a.id === x),
      )
    )
      throw Error("저장 참조가 올바르지 않습니다: " + key);
  }
  for (const key of ["attempts", "hintLevels", "flags", "timers"] as const)
    if (
      !s[key] ||
      typeof s[key] !== "object" ||
      Array.isArray(s[key]) ||
      Object.keys(s[key]).length > 100
    )
      throw Error("손상된 저장: " + key);
  for (const [key, value] of Object.entries(s.flags))
    if (typeof value !== "boolean" || !/^[a-zA-Z0-9_-]{1,80}$/.test(key))
      throw Error("플래그 오류");
  for (const key of ["attempts", "hintLevels"] as const)
    for (const [pid, v] of Object.entries(s[key]))
      if (
        !c.puzzles.some((p) => p.id === pid) ||
        !Number.isSafeInteger(v) ||
        v < 0 ||
        (key === "hintLevels" &&
          v > c.puzzles.find((p) => p.id === pid)!.hints.length)
      )
        throw Error("퍼즐 저장 오류");
  for (const [id, t] of Object.entries(s.timers)) {
    const rule = c.rules.find((r) => r.id === t.ruleId);
    if (
      !rule ||
      !rule.then.some(
        (e) =>
          e.type === "START_TIMER" &&
          e.id === id &&
          e.durationMs === t.durationMs,
      ) ||
      !Number.isSafeInteger(t.startMs) ||
      t.startMs < 0 ||
      t.startMs > s.logicalMs
    )
      throw Error("타이머 저장 오류");
  }
  if (s.readMessageIds.some((id) => !s.deliveredMessageIds.includes(id)))
    throw Error("메시지 저장 오류");
  if (
    (s.mode === "ENDED") !== !!s.endingId ||
    (s.endingId && !c.endings.some((e) => e.id === s.endingId))
  )
    throw Error("엔딩 저장 오류");
  return records({
    ...structuredClone(s),
    mode: s.mode === "ENDED" ? "ENDED" : "PAUSED",
  });
}
