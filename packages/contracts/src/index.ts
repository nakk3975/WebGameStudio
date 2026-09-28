import { z } from "zod";
export const ENGINE = "ghostdesk-core-1";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const plain = (max: number) =>
  z
    .string()
    .max(max)
    .refine(
      (v) => !/<[^>]*>|javascript:|data:|https?:\/\//i.test(v),
      "HTML·스크립트·외부 URL은 사용할 수 없습니다.",
    );
export type Condition =
  | { type: "ALL"; conditions: Condition[] }
  | { type: "ANY"; conditions: Condition[] }
  | { type: "NOT"; condition: Condition }
  | {
      type: "FILE_READ" | "CLUE_FOUND" | "PUZZLE_SOLVED" | "TIMER_REACHED";
      id: string;
    }
  | { type: "FLAG_EQUALS"; id: string; value: boolean };
export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("ALL"),
        conditions: z.array(conditionSchema).min(1).max(16),
      })
      .strict(),
    z
      .object({
        type: z.literal("ANY"),
        conditions: z.array(conditionSchema).min(1).max(16),
      })
      .strict(),
    z.object({ type: z.literal("NOT"), condition: conditionSchema }).strict(),
    z
      .object({
        type: z.enum([
          "FILE_READ",
          "CLUE_FOUND",
          "PUZZLE_SOLVED",
          "TIMER_REACHED",
        ]),
        id,
      })
      .strict(),
    z
      .object({ type: z.literal("FLAG_EQUALS"), id, value: z.boolean() })
      .strict(),
  ]),
);
export const effectSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.enum(["REVEAL_FILE", "APPEND_MESSAGE", "ADD_CLUE", "END_CASE"]),
      id,
    })
    .strict(),
  z.object({ type: z.literal("SET_FLAG"), id, value: z.boolean() }).strict(),
  z
    .object({
      type: z.literal("START_TIMER"),
      id,
      durationMs: z.number().int().min(1).max(3600000),
    })
    .strict(),
]);
export type Effect = z.infer<typeof effectSchema>;
export const caseSchema = z
  .object({
    schemaVersion: z.literal(1),
    engineVersion: z.literal(ENGINE),
    caseId: id,
    versionId: id,
    title: plain(80).min(1),
    description: plain(1000),
    estimatedMinutes: z.number().int().min(1).max(180),
    contentWarning: plain(500),
    files: z
      .array(
        z
          .object({
            id,
            type: z.enum(["TEXT", "IMAGE", "CHAT_LINK", "FOLDER"]),
            title: plain(80).min(1),
            parentId: id.nullable(),
            text: plain(20000),
            visible: z.boolean(),
            puzzleId: id.optional(),
            clueId: id.optional(),
            assetId: z.literal("clock-comparison").optional(),
            alt: plain(1000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    clues: z
      .array(
        z.object({ id, title: plain(100), description: plain(1000) }).strict(),
      )
      .max(100),
    puzzles: z
      .array(
        z
          .object({
            id,
            title: plain(100),
            answer: plain(100).min(1),
            ignoreCase: z.boolean(),
            hints: z.array(plain(1000)).min(1).max(4),
          })
          .strict(),
      )
      .max(30),
    messages: z
      .array(
        z
          .object({
            id,
            author: plain(80),
            time: plain(30),
            text: plain(3000),
            initial: z.boolean(),
          })
          .strict(),
      )
      .max(300),
    rules: z
      .array(
        z
          .object({
            id,
            priority: z.number().int().min(-10000).max(10000),
            once: z.literal(true),
            when: conditionSchema,
            then: z.array(effectSchema).min(1).max(16),
          })
          .strict(),
      )
      .max(100),
    endings: z
      .array(
        z
          .object({
            id,
            title: plain(100),
            text: plain(3000),
            revisitable: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    hypotheses: z
      .array(
        z
          .object({
            id,
            label: plain(200),
            endingId: id,
            requiredClues: z.array(id).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();
export type CasePackage = z.infer<typeof caseSchema>;
export type CaseFile = CasePackage["files"][number];
export type Rule = CasePackage["rules"][number];
export type Issue = { path: string; message: string };
export function conditionAtoms(
  c: Condition,
): Exclude<Condition, { type: "ALL" | "ANY" | "NOT" }>[] {
  if (c.type === "ALL" || c.type === "ANY")
    return c.conditions.flatMap(conditionAtoms);
  if (c.type === "NOT") return conditionAtoms(c.condition);
  return [c as Exclude<Condition, { type: "ALL" | "ANY" | "NOT" }>];
}
function jsonDepth(v: unknown, d = 0): number {
  if (d > 30) return d;
  if (!v || typeof v !== "object") return d;
  return Math.max(d, ...Object.values(v).map((x) => jsonDepth(x, d + 1)));
}
export function validateCase(input: unknown): {
  data?: CasePackage;
  errors: Issue[];
  warnings: Issue[];
} {
  const errors: Issue[] = [],
    warnings: Issue[] = [];
  let raw: string;
  try {
    raw = JSON.stringify(input);
  } catch {
    return {
      errors: [{ path: "$", message: "순환 객체는 허용되지 않습니다." }],
      warnings,
    };
  }
  if (
    !raw ||
    new TextEncoder().encode(raw).length > 1048576 ||
    jsonDepth(input) > 28
  )
    return {
      errors: [
        {
          path: "$",
          message: "JSON 용량(1MiB) 또는 중첩 제한을 초과했습니다.",
        },
      ],
      warnings,
    };
  const parsed = caseSchema.safeParse(input);
  if (!parsed.success)
    return {
      errors: parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
      warnings,
    };
  const c = parsed.data;
  const all = new Set<string>();
  for (const kind of [
    "files",
    "clues",
    "puzzles",
    "messages",
    "rules",
    "endings",
    "hypotheses",
  ] as const)
    c[kind].forEach((v, i) => {
      if (all.has(v.id))
        errors.push({ path: `${kind}.${i}.id`, message: "중복 ID입니다." });
      all.add(v.id);
    });
  const has = (
    kind: "files" | "clues" | "puzzles" | "messages" | "endings",
    ref: string,
    path: string,
  ) => {
    if (!c[kind].some((x) => x.id === ref))
      errors.push({ path, message: `없는 ${kind} 참조: ${ref}` });
  };
  c.files.forEach((f, i) => {
    if (f.parentId) {
      const p = c.files.find((x) => x.id === f.parentId);
      if (!p || p.type !== "FOLDER")
        errors.push({
          path: `files.${i}.parentId`,
          message: "부모 폴더가 없습니다.",
        });
    }
    const seen = new Set([f.id]);
    let current = f,
      depth = 0;
    while (current.parentId) {
      if (seen.has(current.parentId)) {
        errors.push({
          path: `files.${i}.parentId`,
          message: "폴더 순환이 있습니다.",
        });
        break;
      }
      seen.add(current.parentId);
      const p = c.files.find((x) => x.id === current.parentId);
      if (!p) break;
      current = p;
      if (++depth > 6) {
        errors.push({
          path: `files.${i}.parentId`,
          message: "폴더 깊이는 6 이하여야 합니다.",
        });
        break;
      }
    }
    if (f.puzzleId) has("puzzles", f.puzzleId, `files.${i}.puzzleId`);
    if (f.clueId) has("clues", f.clueId, `files.${i}.clueId`);
    if (f.type === "IMAGE" && (!f.assetId || !f.alt))
      errors.push({
        path: `files.${i}.alt`,
        message: "번들 이미지와 대체 설명이 필요합니다.",
      });
  });
  const timerIds = new Set<string>();
  c.rules.forEach((r, i) =>
    r.then.forEach((e, j) => {
      if (e.type === "START_TIMER") {
        if (timerIds.has(e.id))
          errors.push({
            path: `rules.${i}.then.${j}`,
            message: "타이머 ID가 중복됩니다.",
          });
        timerIds.add(e.id);
      }
    }),
  );
  function inspectCond(cond: Condition, path: string, depth = 1) {
    if (depth > 8) {
      errors.push({ path, message: "조건 깊이는 8 이하여야 합니다." });
      return;
    }
    if (cond.type === "ALL" || cond.type === "ANY") {
      cond.conditions.forEach((x, i) =>
        inspectCond(x, `${path}.conditions.${i}`, depth + 1),
      );
      return;
    }
    if (cond.type === "NOT") {
      inspectCond(cond.condition, `${path}.condition`, depth + 1);
      return;
    }
    if (cond.type === "FILE_READ") has("files", cond.id, path);
    if (cond.type === "CLUE_FOUND") has("clues", cond.id, path);
    if (cond.type === "PUZZLE_SOLVED") has("puzzles", cond.id, path);
    if (cond.type === "TIMER_REACHED" && !timerIds.has(cond.id))
      errors.push({ path, message: "시작 규칙이 없는 타이머입니다." });
  }
  c.rules.forEach((r, i) => {
    inspectCond(r.when, `rules.${i}.when`);
    r.then.forEach((e, j) => {
      const p = `rules.${i}.then.${j}`;
      if (e.type === "REVEAL_FILE") has("files", e.id, p);
      if (e.type === "ADD_CLUE") has("clues", e.id, p);
      if (e.type === "APPEND_MESSAGE") has("messages", e.id, p);
      if (e.type === "END_CASE") has("endings", e.id, p);
      if (
        e.type === "REVEAL_FILE" &&
        conditionAtoms(r.when).some(
          (a) => a.type === "FILE_READ" && a.id === e.id,
        ) &&
        !c.files.find((f) => f.id === e.id)?.visible
      )
        errors.push({
          path: p,
          message: "숨겨진 파일을 읽어야 자신이 나타나는 조건입니다.",
        });
    });
  });
  c.hypotheses.forEach((h, i) => {
    has("endings", h.endingId, `hypotheses.${i}.endingId`);
    h.requiredClues.forEach((cl) =>
      has("clues", cl, `hypotheses.${i}.requiredClues`),
    );
  });
  // Monotone reachability approximation; NOT/flag contradictions still need a playthrough.
  const visible = new Set(c.files.filter((f) => f.visible).map((f) => f.id)),
    read = new Set<string>(),
    solved = new Set(c.puzzles.map((p) => p.id)),
    clues = new Set<string>(),
    timers = new Set<string>();
  const potential = (cond: Condition): boolean => {
    if (cond.type === "ALL") return cond.conditions.every(potential);
    if (cond.type === "ANY") return cond.conditions.some(potential);
    if (cond.type === "NOT" || cond.type === "FLAG_EQUALS") return true;
    if (cond.type === "FILE_READ") return read.has(cond.id);
    if (cond.type === "CLUE_FOUND") return clues.has(cond.id);
    if (cond.type === "PUZZLE_SOLVED") return solved.has(cond.id);
    if (cond.type === "TIMER_REACHED") return timers.has(cond.id);
    return false;
  };
  for (let n = 0; n < 101; n++) {
    for (const f of c.files)
      if (visible.has(f.id) && (!f.parentId || read.has(f.parentId))) {
        read.add(f.id);
        if (f.clueId) clues.add(f.clueId);
      }
    for (const r of c.rules)
      if (potential(r.when))
        for (const e of r.then) {
          if (e.type === "REVEAL_FILE") visible.add(e.id);
          if (e.type === "ADD_CLUE") clues.add(e.id);
          if (e.type === "START_TIMER") timers.add(e.id);
        }
  }
  c.hypotheses.forEach((h, i) =>
    h.requiredClues.forEach((cl) => {
      if (!clues.has(cl))
        errors.push({
          path: `hypotheses.${i}.requiredClues`,
          message: `접근할 수 없는 필수 근거: ${cl}`,
        });
    }),
  );
  if (
    c.rules.some(
      (r) =>
        JSON.stringify(r.when).includes("NOT") ||
        JSON.stringify(r.when).includes("FLAG_EQUALS"),
    )
  )
    warnings.push({
      path: "rules",
      message: "부정·플래그 조건의 논리적 모순은 직접 테스트해야 합니다.",
    });
  return { data: errors.length ? undefined : c, errors, warnings };
}
export function duplicateCase(c: CasePackage, suffix: string): CasePackage {
  const keys = new Set<string>();
  for (const k of [
    "files",
    "clues",
    "puzzles",
    "messages",
    "rules",
    "endings",
    "hypotheses",
  ] as const)
    c[k].forEach((x) => keys.add(x.id));
  c.rules.forEach((r) => {
    conditionAtoms(r.when).forEach((a) => keys.add(a.id));
    r.then.forEach((e) => keys.add(e.id));
  });
  const map = new Map([...keys].map((x) => [x, `${x.slice(0, 50)}-${suffix}`]));
  function walk(v: unknown, key = ""): unknown {
    if (Array.isArray(v)) return v.map((x) => walk(x, key));
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, walk(x, k)]),
      );
    if (
      typeof v === "string" &&
      [
        "id",
        "parentId",
        "puzzleId",
        "clueId",
        "endingId",
        "requiredClues",
      ].includes(key)
    )
      return map.get(v) || v;
    return v;
  }
  const copy = walk(c) as CasePackage;
  copy.caseId = `case-${suffix}`;
  copy.versionId = `draft-${suffix}`;
  copy.title = `${c.title.slice(0, 73)} (복사)`;
  return copy;
}
