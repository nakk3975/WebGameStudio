import {
  UserMessage,
  userMessage,
  issueLocation,
  issueMessage,
} from "./feedback";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  Plus,
  Copy,
  Undo2,
  Redo2,
  Play,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  GitBranch,
  FileText,
} from "lucide-react";
import {
  duplicateCase,
  validateCase,
  conditionAtoms,
  type CasePackage,
  type Condition,
  type Effect,
} from "../../../packages/contracts/src";
import {
  read,
  write,
  download,
  importJson,
  createSaveQueue,
  type Draft,
} from "./storage";
import { sample } from "./sample";
import { Brand, Modal } from "./App";
const uid = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
type Category =
  | "info"
  | "files"
  | "clues"
  | "puzzles"
  | "messages"
  | "rules"
  | "endings"
  | "hypotheses"
  | "graph";
const labels: Record<Category, string> = {
  info: "기본 정보",
  files: "파일·폴더",
  clues: "단서",
  puzzles: "퍼즐·힌트",
  messages: "메시지",
  rules: "조건 규칙",
  endings: "엔딩",
  hypotheses: "결론 선택지",
  graph: "조건 그래프",
};
function TextField({
  label,
  value,
  onCommit,
  multiline = false,
  maxLength = 20000,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
  maxLength?: number;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <label className="field">
      {label}
      {multiline ? (
        <textarea
          value={local}
          maxLength={maxLength}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => local !== value && onCommit(local)}
        />
      ) : (
        <input
          value={local}
          maxLength={maxLength}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => local !== value && onCommit(local)}
        />
      )}
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
  empty,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  empty?: string;
}) {
  return (
    <label className="field">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {empty && <option value="">{empty}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
export default function Studio({
  onHome,
  onTest,
}: {
  onHome: () => void;
  onTest: (c: CasePackage) => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]),
    [active, setActive] = useState(0),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("불러오는 중"),
    [category, setCategory] = useState<Category>("info"),
    [selected, setSelected] = useState(0),
    [history, setHistory] = useState<CasePackage[]>([]),
    [future, setFuture] = useState<CasePackage[]>([]),
    [message, setMessage] = useState(""),
    [deletion, setDeletion] = useState(false),
    [lastTest, setLastTest] = useState<number | null>(null),
    [readOnly, setReadOnly] = useState(true),
    [accessNote, setAccessNote] = useState(""),
    [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    queue = useRef(createSaveQueue<Draft[]>((value) => write("drafts", value))),
    leaving = useRef(false);
  const d = drafts[active],
    c = d?.document;
  useEffect(() => {
    let disposed = false;
    let release = () => {};
    const access = new Promise<boolean>((resolve) => {
      if (!navigator.locks) {
        setAccessNote("다른 탭에서 동시에 편집하지 마세요.");
        resolve(true);
        return;
      }
      navigator.locks
        .request(
          "ghostdesk-studio-editor",
          { ifAvailable: true },
          async (lock) => {
            if (disposed) {
              resolve(false);
              return;
            }
            if (!lock) {
              setAccessNote("다른 탭에서 편집 중 · 읽기 전용");
              resolve(false);
              return;
            }
            resolve(true);
            await new Promise<void>((done) => {
              release = done;
            });
          },
        )
        .catch(() => {
          if (!disposed)
            setAccessNote("편집 권한을 확인하지 못했습니다 · 읽기 전용");
          resolve(false);
        });
    });
    // Acquire the editor lock before reading: a previous editor may still be saving.
    access
      .then(async (writable) => {
        if (disposed) return;
        const rows = await read<Draft[]>("drafts");
        if (disposed) return;
        if (rows && Array.isArray(rows) && rows.length) {
          if (
            !rows.every(
              (r) =>
                r &&
                r.document &&
                Number.isSafeInteger(r.revision) &&
                [
                  "files",
                  "clues",
                  "puzzles",
                  "messages",
                  "rules",
                  "endings",
                  "hypotheses",
                ].every((key) =>
                  Array.isArray(r.document[key as keyof CasePackage]),
                ),
            )
          )
            throw Error("손상된 초안");
          setDrafts(rows);
        } else
          setDrafts([{ document: duplicateCase(sample, uid()), revision: 1 }]);
        setReadOnly(!writable);
        setStatus("이 기기에 저장됨");
      })
      .catch(() => {
        if (disposed) return;
        setAccessNote(
          "초안을 불러오지 못했습니다. 기존 저장을 덮어쓰지 않도록 편집을 잠갔습니다.",
        );
        setReadOnly(true);
        setDrafts([{ document: duplicateCase(sample, uid()), revision: 1 }]);
      })
      .finally(() => {
        if (!disposed) setReady(true);
      });
    return () => {
      disposed = true;
      release();
    };
  }, []);
  async function persist(final = false): Promise<boolean> {
    if (readOnly) return true;
    if (leaving.current && !final) return false;
    setStatus("저장 중");
    try {
      await queue.current(drafts);
      setStatus("이 기기에 저장됨");
      return true;
    } catch {
      setStatus("저장 실패 · 사건 파일을 저장해 주세요");
      setMessage(
        "초안을 저장하지 못했습니다. 사건 파일을 내려받아 보관하거나 다시 시도해 주세요.",
      );
      return false;
    }
  }
  async function navigate(action: () => void) {
    if (leaving.current) return;
    leaving.current = true;
    setBusy(true);
    if (await persist(true)) action();
    leaving.current = false;
    setBusy(false);
  }
  useEffect(() => {
    if (!ready || !c || readOnly) return;
    setStatus("저장 중");
    const t = setTimeout(() => {
      void persist();
    }, 500);
    return () => clearTimeout(t);
  }, [drafts, ready, readOnly]);
  const validation = useMemo(
    () => (c ? validateCase(c) : { errors: [], warnings: [] }),
    [c],
  );
  function edit(fn: (c: CasePackage) => void) {
    if (!c || readOnly) return;
    const next = structuredClone(c);
    fn(next);
    setHistory((h) => [...h, c].slice(-100));
    setFuture([]);
    setDrafts((all) =>
      all.map((x, i) =>
        i === active ? { document: next, revision: x.revision + 1 } : x,
      ),
    );
  }
  function swap(next: CasePackage) {
    setDrafts((all) =>
      all.map((x, i) =>
        i === active ? { document: next, revision: x.revision + 1 } : x,
      ),
    );
  }
  function undo() {
    if (!history.length || readOnly) return;
    setFuture((f) => [c!, ...f]);
    swap(history.at(-1)!);
    setHistory((h) => h.slice(0, -1));
  }
  function redo() {
    if (!future.length || readOnly) return;
    setHistory((h) => [...h, c!]);
    swap(future[0]);
    setFuture((f) => f.slice(1));
  }
  function select(cat: Category, i = 0) {
    setCategory(cat);
    setSelected(i);
  }
  function addDraft(doc: CasePackage) {
    if (readOnly) return false;
    if (drafts.length >= 10) {
      setMessage(
        "이 기기에는 초안을 10개까지 보관할 수 있습니다. 현재 사건을 파일로 저장해 보관해 주세요.",
      );
      return false;
    }
    setDrafts((x) => [...x, { document: doc, revision: 1 }]);
    setActive(drafts.length);
    setHistory([]);
    setFuture([]);
    select("info");
    setLastTest(null);
    return true;
  }
  if (!ready || !c)
    return <div className="loading">사건 제작소를 여는 중입니다.</div>;
  const options = (
    kind: "files" | "clues" | "puzzles" | "messages" | "endings",
  ) =>
    c[kind].map((x) => ({
      id: x.id,
      label: "title" in x ? x.title : x.author + " · " + x.text.slice(0, 25),
    }));
  function conditionForm(
    cond: Condition,
    set: (v: Condition) => void,
    depth = 0,
  ): ReactNode {
    const typeOptions = [
      ["FILE_READ", "파일을 읽으면"],
      ["CLUE_FOUND", "단서를 찾으면"],
      ["PUZZLE_SOLVED", "퍼즐을 풀면"],
      ["FLAG_EQUALS", "진행 표시가 켜지거나 꺼지면"],
      ["TIMER_REACHED", "기다리는 시간이 끝나면"],
      ["ALL", "모든 조건"],
      ["ANY", "하나 이상의 조건"],
      ["NOT", "조건의 반대"],
    ].map(([id, label]) => ({ id, label }));
    return (
      <div className="condition-box">
        <Select
          label="조건"
          value={cond.type}
          options={typeOptions}
          onChange={(type) => {
            if (type === "ALL" || type === "ANY")
              set({
                type,
                conditions: [
                  { type: "FILE_READ", id: c.files[0]?.id || "missing" },
                ],
              });
            else if (type === "NOT")
              set({
                type,
                condition: {
                  type: "FILE_READ",
                  id: c.files[0]?.id || "missing",
                },
              });
            else if (type === "FLAG_EQUALS")
              set({ type, id: "flag-new", value: true });
            else {
              const ids = {
                FILE_READ: c.files[0]?.id,
                CLUE_FOUND: c.clues[0]?.id,
                PUZZLE_SOLVED: c.puzzles[0]?.id,
                TIMER_REACHED: c.rules
                  .flatMap((r) => r.then)
                  .find((e) => e.type === "START_TIMER")?.id,
              };
              set({
                type: type as "FILE_READ",
                id: ids[type as keyof typeof ids] || "missing",
              });
            }
          }}
        />
        {cond.type === "ALL" || cond.type === "ANY" ? (
          <>
            {cond.conditions.map((x, i) => (
              <div key={i}>
                {conditionForm(
                  x,
                  (v) =>
                    set({
                      ...cond,
                      conditions: cond.conditions.map((old, j) =>
                        j === i ? v : old,
                      ),
                    }),
                  depth + 1,
                )}
                {cond.conditions.length > 1 && (
                  <button
                    onClick={() =>
                      set({
                        ...cond,
                        conditions: cond.conditions.filter((_, j) => j !== i),
                      })
                    }
                  >
                    하위 조건 삭제
                  </button>
                )}
              </div>
            ))}
            {depth < 7 && cond.conditions.length < 16 && (
              <button
                onClick={() =>
                  set({
                    ...cond,
                    conditions: [
                      ...cond.conditions,
                      { type: "FILE_READ", id: c.files[0]?.id || "missing" },
                    ],
                  })
                }
              >
                <Plus size={14} /> 하위 조건
              </button>
            )}
          </>
        ) : cond.type === "NOT" ? (
          depth < 8 ? (
            conditionForm(
              cond.condition,
              (v) => set({ ...cond, condition: v }),
              depth + 1,
            )
          ) : (
            <p>조건 깊이 제한을 넘었습니다.</p>
          )
        ) : cond.type === "FLAG_EQUALS" ? (
          <>
            <TextField
              label="진행 표시 이름"
              value={cond.id}
              onCommit={(id) => set({ ...cond, id })}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={cond.value}
                onChange={(e) => set({ ...cond, value: e.target.checked })}
              />
              켜짐
            </label>
          </>
        ) : (
          <Select
            label="대상"
            value={cond.id}
            onChange={(id) => set({ ...cond, id })}
            options={
              cond.type === "FILE_READ"
                ? options("files")
                : cond.type === "CLUE_FOUND"
                  ? options("clues")
                  : cond.type === "PUZZLE_SOLVED"
                    ? options("puzzles")
                    : c.rules
                        .flatMap((r) => r.then)
                        .filter((e) => e.type === "START_TIMER")
                        .map((e) => ({ id: e.id, label: e.id }))
            }
          />
        )}
      </div>
    );
  }
  function effectForm(e: Effect, set: (v: Effect) => void) {
    return (
      <div className="effect-box">
        <Select
          label="효과"
          value={e.type}
          options={[
            ["REVEAL_FILE", "파일 공개"],
            ["APPEND_MESSAGE", "메시지 도착"],
            ["ADD_CLUE", "단서 추가"],
            ["SET_FLAG", "진행 표시 바꾸기"],
            ["START_TIMER", "기다리기 시작"],
            ["END_CASE", "엔딩 확정"],
          ].map(([id, label]) => ({ id, label }))}
          onChange={(type) => {
            if (type === "START_TIMER")
              set({ type, id: "timer-" + uid(), durationMs: 3000 });
            else if (type === "SET_FLAG")
              set({ type, id: "flag-new", value: true });
            else {
              const k =
                type === "REVEAL_FILE"
                  ? "files"
                  : type === "APPEND_MESSAGE"
                    ? "messages"
                    : type === "ADD_CLUE"
                      ? "clues"
                      : "endings";
              set({
                type: type as "REVEAL_FILE",
                id: c[k][0]?.id || "missing",
              });
            }
          }}
        />
        {e.type === "SET_FLAG" || e.type === "START_TIMER" ? (
          <>
            <TextField
              label={e.type === "SET_FLAG" ? "진행 표시 이름" : "대기 이름"}
              value={e.id}
              onCommit={(id) => set({ ...e, id })}
            />
            {e.type === "SET_FLAG" ? (
              <label className="check">
                <input
                  type="checkbox"
                  checked={e.value}
                  onChange={(event) =>
                    set({ ...e, value: event.target.checked })
                  }
                />
                켜기 (선택을 해제하면 끄기)
              </label>
            ) : (
              <label className="field">
                대기 시간(초)
                <input
                  type="number"
                  min="0.001"
                  max="3600"
                  step="0.001"
                  value={e.durationMs / 1000}
                  onChange={(event) =>
                    set({
                      ...e,
                      durationMs: Math.round(Number(event.target.value) * 1000),
                    })
                  }
                />
              </label>
            )}
          </>
        ) : (
          <Select
            label="대상"
            value={e.id}
            onChange={(id) => set({ ...e, id })}
            options={options(
              e.type === "REVEAL_FILE"
                ? "files"
                : e.type === "APPEND_MESSAGE"
                  ? "messages"
                  : e.type === "ADD_CLUE"
                    ? "clues"
                    : "endings",
            )}
          />
        )}
      </div>
    );
  }
  function add() {
    edit((x) => {
      const id = category.slice(0, 1) + "-" + uid();
      if (category === "files")
        x.files.push({
          id,
          type: "TEXT",
          title: "새 파일.txt",
          text: "",
          parentId: null,
          visible: true,
        });
      if (category === "clues")
        x.clues.push({ id, title: "새 단서", description: "" });
      if (category === "puzzles")
        x.puzzles.push({
          id,
          title: "새 퍼즐",
          answer: "0000",
          ignoreCase: false,
          hints: ["단서를 찾아보세요.", "정답은 0000입니다."],
        });
      if (category === "messages")
        x.messages.push({
          id,
          author: "동료",
          time: "03:30",
          text: "새 메시지",
          initial: true,
        });
      if (category === "rules")
        x.rules.push({
          id,
          priority: 10,
          once: true,
          when: { type: "FILE_READ", id: x.files[0].id },
          then: [{ type: "SET_FLAG", id: "flag-" + uid(), value: true }],
        });
      if (category === "endings")
        x.endings.push({
          id,
          title: "새 엔딩",
          text: "사건의 결말을 작성하세요.",
          revisitable: false,
        });
      if (category === "hypotheses")
        x.hypotheses.push({
          id,
          label: "새 결론",
          endingId: x.endings[0].id,
          requiredClues: [],
        });
    });
    if (category !== "info" && category !== "graph")
      setSelected(c[category].length);
  }
  const item =
    category !== "info" && category !== "graph"
      ? c[category][selected]
      : undefined;
  const refPaths = item
    ? (["files", "rules", "hypotheses"] as const).flatMap((kind) =>
        c[kind].flatMap((v, i) =>
          v.id !== item.id && JSON.stringify(v).includes('"' + item.id + '"')
            ? [
                `${labels[kind]} / ${"title" in v ? v.title : "label" in v ? v.label : "규칙 " + (i + 1)}`,
              ]
            : [],
        ),
      )
    : [];
  const updateItem = (patch: object) =>
    edit((x) => {
      if (category !== "info" && category !== "graph")
        Object.assign(x[category][selected], patch);
    });
  const targetName = (id: string) => {
    for (const kind of [
      "files",
      "clues",
      "puzzles",
      "messages",
      "endings",
    ] as const) {
      const found = options(kind).find((x) => x.id === id);
      if (found) return found.label;
    }
    const waits = c.rules
      .flatMap((r) => r.then)
      .filter((e) => e.type === "START_TIMER");
    const wait = waits.findIndex((e) => e.id === id);
    if (wait >= 0) return "대기 " + (wait + 1);
    const marks = c.rules
      .flatMap((r) => r.then)
      .filter((e) => e.type === "SET_FLAG");
    const mark = marks.findIndex((e) => e.id === id);
    return mark >= 0 ? "진행 표시 " + (mark + 1) : "연결 대상 확인 필요";
  };
  const nodes: Node[] = [],
    edges: Edge[] = [];
  if (category === "graph")
    c.rules.forEach((r, i) => {
      const a = "r-" + r.id;
      nodes.push({
        id: a,
        data: { label: "규칙 " + (i + 1) + " · 실행 순서 " + r.priority },
        position: { x: 270, y: i * 150 },
      });
      conditionAtoms(r.when).forEach((atom, j) => {
        const id = a + "-c" + j;
        nodes.push({
          id,
          data: {
            label:
              {
                FILE_READ: "파일 읽기",
                CLUE_FOUND: "단서 수집",
                PUZZLE_SOLVED: "퍼즐 해결",
                TIMER_REACHED: "기다리기 완료",
                FLAG_EQUALS: "진행 표시 확인",
              }[atom.type] +
              "\n" +
              targetName(atom.id),
          },
          position: { x: 0, y: i * 150 + j * 65 },
        });
        edges.push({ id: id + "-edge", source: id, target: a });
      });
      r.then.forEach((e, j) => {
        const id = a + "-e" + j;
        nodes.push({
          id,
          data: {
            label:
              {
                REVEAL_FILE: "파일 공개",
                APPEND_MESSAGE: "메시지 도착",
                ADD_CLUE: "단서 추가",
                SET_FLAG: "진행 표시 바꾸기",
                START_TIMER: "기다리기 시작",
                END_CASE: "엔딩 표시",
              }[e.type] +
              "\n" +
              targetName(e.id),
          },
          position: { x: 540, y: i * 150 + j * 65 },
        });
        edges.push({ id: id + "-edge", source: a, target: id });
      });
    });
  return (
    <div className="studio" inert={busy}>
      <header className="topbar">
        <button className="brand-button" onClick={() => void navigate(onHome)}>
          <Brand />
        </button>
        <b className="studio-name">사건 제작소</b>
        <nav>
          <span className="save-state" role="status">
            {readOnly ? accessNote || status : status}
          </span>
          <button
            onClick={() =>
              void navigate(() => {
                setLastTest(d.revision);
                const snap = structuredClone(c);
                const suffix = "-r" + d.revision;
                snap.versionId =
                  c.versionId.slice(0, 80 - suffix.length) + suffix;
                onTest(snap);
              })
            }
            className="primary"
            disabled={validation.errors.length > 0 || readOnly}
          >
            <Play size={15} /> 테스트 플레이
          </button>
        </nav>
      </header>
      {!readOnly && accessNote && <p className="info-banner">{accessNote}</p>}
      <div className="studio-toolbar">
        <button onClick={() => void navigate(onHome)}>
          <ArrowLeft size={16} /> 돌아가기
        </button>
        <select
          aria-label="작업 중인 초안"
          value={active}
          onChange={(e) => {
            setActive(Number(e.target.value));
            setHistory([]);
            setFuture([]);
            setLastTest(null);
            select("info");
          }}
        >
          {drafts.map((d, i) => (
            <option key={d.document.caseId} value={i}>
              {d.document.title}
            </option>
          ))}
        </select>
        <span className="pill">나만의 초안</span>
        <button
          disabled={readOnly}
          onClick={() => addDraft(duplicateCase(c, uid()))}
        >
          <Copy size={15} /> 복제
        </button>
        <button
          disabled={readOnly}
          onClick={() => addDraft(duplicateCase(sample, uid()))}
        >
          <Plus size={15} /> 샘플로 새 사건
        </button>
        <div className="toolbar-spacer" />
        <button
          aria-label="실행 취소"
          disabled={!history.length || readOnly}
          onClick={undo}
        >
          <Undo2 size={17} />
        </button>
        <button
          aria-label="다시 실행"
          disabled={!future.length || readOnly}
          onClick={redo}
        >
          <Redo2 size={17} />
        </button>
        <button onClick={() => download("ghostdesk-case.gdcase", c)}>
          <Download size={16} /> 사건 파일 저장
        </button>
        <button disabled={readOnly} onClick={() => input.current?.click()}>
          <Upload size={16} /> 사건 파일 가져오기
        </button>
      </div>
      <div className="studio-layout">
        <aside className="studio-nav">
          {Object.entries(labels).map(([key, label]) => (
            <button
              key={key}
              className={category === key ? "active" : ""}
              onClick={() => select(key as Category)}
            >
              {key === "graph" ? (
                <GitBranch size={17} />
              ) : (
                <FileText size={17} />
              )}{" "}
              {label}
              {key !== "info" && key !== "graph" && (
                <span>
                  {c[key as Exclude<Category, "info" | "graph">].length}
                </span>
              )}
            </button>
          ))}
        </aside>
        <main className="studio-main">
          <div className="studio-section-title">
            <div>
              <span className="section-kicker">사건 제작소</span>
              <h1>{labels[category]}</h1>
            </div>
            {category !== "info" && category !== "graph" && (
              <button disabled={readOnly} onClick={add}>
                <Plus size={16} /> 추가
              </button>
            )}
          </div>
          {lastTest && lastTest !== d.revision && (
            <p className="info-banner">
              테스트 이후 초안이 변경되었습니다. 변경한 내용으로 다시
              테스트하세요.
            </p>
          )}
          {category === "graph" ? (
            <>
              <p className="muted">
                조건과 효과의 연결을 보여줍니다. 가운데 규칙을 눌러 편집
                화면에서 수정하세요.
              </p>
              <div className="flow-wrap">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  fitView
                  colorMode="dark"
                  nodesDraggable={false}
                  nodesConnectable={false}
                  onNodeClick={(_, n) => {
                    const index = c.rules.findIndex(
                      (r) => "r-" + r.id === n.id,
                    );
                    if (index >= 0) select("rules", index);
                  }}
                >
                  <Background />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </div>
            </>
          ) : (
            <div className="editor-split">
              {category !== "info" && (
                <div className="item-list">
                  {c[category].map((x, i) => (
                    <button
                      key={x.id}
                      className={i === selected ? "active" : ""}
                      onClick={() => setSelected(i)}
                    >
                      {"title" in x
                        ? x.title
                        : "label" in x
                          ? x.label
                          : "author" in x
                            ? x.author + " · " + x.text.slice(0, 20)
                            : "규칙 " + (i + 1)}
                    </button>
                  ))}
                </div>
              )}
              <fieldset
                disabled={readOnly}
                className="editor-form"
                key={category + "-" + selected}
              >
                {category === "info" ? (
                  <>
                    <TextField
                      label="사건 제목"
                      value={c.title}
                      maxLength={80}
                      onCommit={(title) => edit((x) => (x.title = title))}
                    />
                    <TextField
                      label="사건 설명"
                      value={c.description}
                      maxLength={1000}
                      multiline
                      onCommit={(description) =>
                        edit((x) => (x.description = description))
                      }
                    />
                    <label className="field">
                      예상 플레이 시간(분)
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={c.estimatedMinutes}
                        onChange={(e) =>
                          edit(
                            (x) =>
                              (x.estimatedMinutes = Number(e.target.value)),
                          )
                        }
                      />
                    </label>
                    <TextField
                      label="콘텐츠 안내"
                      value={c.contentWarning}
                      maxLength={500}
                      onCommit={(v) => edit((x) => (x.contentWarning = v))}
                    />
                    <p className="muted">
                      초안은 현재 기기에만 저장됩니다. 다른 사람에게 전달하려면
                      사건 파일을 저장해서 보내 주세요.
                    </p>
                  </>
                ) : !item ? (
                  <p className="empty">항목을 추가하거나 선택하세요.</p>
                ) : (
                  <>
                    <div className="item-id">
                      {labels[category]} {selected + 1}
                      <button
                        className="danger quiet"
                        onClick={() => setDeletion(true)}
                      >
                        <Trash2 size={14} /> 삭제
                      </button>
                    </div>
                    {category === "files" &&
                      (() => {
                        const f = c.files[selected];
                        return (
                          <>
                            <TextField
                              label="파일 이름"
                              value={f.title}
                              maxLength={80}
                              onCommit={(title) => updateItem({ title })}
                            />
                            <Select
                              label="파일 유형"
                              value={f.type}
                              options={[
                                "TEXT",
                                "IMAGE",
                                "CHAT_LINK",
                                "FOLDER",
                              ].map((id) => ({
                                id,
                                label: (
                                  {
                                    TEXT: "문서",
                                    IMAGE: "그림",
                                    CHAT_LINK: "메신저 연결",
                                    FOLDER: "폴더",
                                  } as Record<string, string>
                                )[id],
                              }))}
                              onChange={(type) =>
                                updateItem({
                                  type,
                                  ...(type === "IMAGE"
                                    ? {
                                        assetId: "clock-comparison",
                                        alt: "벽시계 03:10, PC 시계 03:17",
                                      }
                                    : {}),
                                })
                              }
                            />
                            <Select
                              label="위치"
                              value={f.parentId || ""}
                              empty="바탕화면"
                              options={c.files
                                .filter(
                                  (x) => x.type === "FOLDER" && x.id !== f.id,
                                )
                                .map((x) => ({ id: x.id, label: x.title }))}
                              onChange={(v) =>
                                updateItem({ parentId: v || null })
                              }
                            />
                            <label className="check">
                              <input
                                type="checkbox"
                                checked={f.visible}
                                onChange={(e) =>
                                  updateItem({ visible: e.target.checked })
                                }
                              />
                              처음부터 표시
                            </label>
                            <Select
                              label="잠금 퍼즐"
                              value={f.puzzleId || ""}
                              empty="잠금 없음"
                              options={options("puzzles")}
                              onChange={(puzzleId) =>
                                updateItem({ puzzleId: puzzleId || undefined })
                              }
                            />
                            <Select
                              label="읽으면 수집할 단서"
                              value={f.clueId || ""}
                              empty="단서 없음"
                              options={options("clues")}
                              onChange={(clueId) =>
                                updateItem({ clueId: clueId || undefined })
                              }
                            />
                            <TextField
                              label="파일 내용"
                              value={f.text}
                              multiline
                              onCommit={(text) => updateItem({ text })}
                            />
                            {f.type === "IMAGE" && (
                              <TextField
                                label="이미지 대체 설명"
                                value={f.alt || ""}
                                multiline
                                onCommit={(alt) => updateItem({ alt })}
                              />
                            )}
                          </>
                        );
                      })()}
                    {category === "clues" && (
                      <>
                        <TextField
                          label="단서 제목"
                          value={c.clues[selected].title}
                          onCommit={(title) => updateItem({ title })}
                        />
                        <TextField
                          label="단서 설명"
                          value={c.clues[selected].description}
                          multiline
                          onCommit={(description) =>
                            updateItem({ description })
                          }
                        />
                      </>
                    )}
                    {category === "puzzles" &&
                      (() => {
                        const p = c.puzzles[selected];
                        return (
                          <>
                            <TextField
                              label="퍼즐 이름"
                              value={p.title}
                              onCommit={(title) => updateItem({ title })}
                            />
                            <TextField
                              label="정답"
                              value={p.answer}
                              maxLength={100}
                              onCommit={(answer) => updateItem({ answer })}
                            />
                            <p className="muted">
                              답 앞뒤의 빈칸은 무시합니다. 숫자 앞의 0은 정답에
                              포함됩니다. 예: 0310
                            </p>
                            <label className="check">
                              <input
                                type="checkbox"
                                checked={p.ignoreCase}
                                onChange={(e) =>
                                  updateItem({ ignoreCase: e.target.checked })
                                }
                              />
                              대소문자 무시
                            </label>
                            {p.hints.map((h, i) => (
                              <TextField
                                key={i}
                                label={`힌트 ${i + 1}${i === p.hints.length - 1 ? " · 정답 공개 확인 필요" : ""}`}
                                value={h}
                                maxLength={1000}
                                onCommit={(v) =>
                                  updateItem({
                                    hints: p.hints.map((h, j) =>
                                      i === j ? v : h,
                                    ),
                                  })
                                }
                              />
                            ))}
                            {p.hints.length < 4 && (
                              <button
                                onClick={() =>
                                  updateItem({ hints: [...p.hints, "새 힌트"] })
                                }
                              >
                                힌트 추가
                              </button>
                            )}
                          </>
                        );
                      })()}
                    {category === "messages" &&
                      (() => {
                        const m = c.messages[selected];
                        return (
                          <>
                            <TextField
                              label="작성자"
                              value={m.author}
                              onCommit={(author) => updateItem({ author })}
                            />
                            <TextField
                              label="표시 시각"
                              value={m.time}
                              onCommit={(time) => updateItem({ time })}
                            />
                            <TextField
                              label="메시지 내용"
                              value={m.text}
                              multiline
                              onCommit={(text) => updateItem({ text })}
                            />
                            <label className="check">
                              <input
                                type="checkbox"
                                checked={m.initial}
                                onChange={(e) =>
                                  updateItem({ initial: e.target.checked })
                                }
                              />
                              처음부터 대화에 표시
                            </label>
                          </>
                        );
                      })()}
                    {category === "rules" &&
                      (() => {
                        const r = c.rules[selected];
                        return (
                          <>
                            <label className="field">
                              우선순위(작을수록 먼저)
                              <input
                                type="number"
                                value={r.priority}
                                onChange={(e) =>
                                  updateItem({
                                    priority: Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                            {conditionForm(r.when, (when) =>
                              updateItem({ when }),
                            )}
                            <h3>조건을 만족하면</h3>
                            {r.then.map((e, i) => (
                              <div key={i}>
                                {effectForm(e, (v) =>
                                  updateItem({
                                    then: r.then.map((old, j) =>
                                      i === j ? v : old,
                                    ),
                                  }),
                                )}
                                {r.then.length > 1 && (
                                  <button
                                    onClick={() =>
                                      updateItem({
                                        then: r.then.filter((_, j) => i !== j),
                                      })
                                    }
                                  >
                                    효과 삭제
                                  </button>
                                )}
                              </div>
                            ))}
                            {r.then.length < 16 && (
                              <button
                                onClick={() =>
                                  updateItem({
                                    then: [
                                      ...r.then,
                                      {
                                        type: "SET_FLAG",
                                        id: "flag-" + uid(),
                                        value: true,
                                      },
                                    ],
                                  })
                                }
                              >
                                효과 추가
                              </button>
                            )}
                            <p className="muted">
                              모든 규칙은 한 번만 실행합니다.
                            </p>
                          </>
                        );
                      })()}
                    {category === "endings" && (
                      <>
                        <TextField
                          label="엔딩 제목"
                          value={c.endings[selected].title}
                          onCommit={(title) => updateItem({ title })}
                        />
                        <TextField
                          label="엔딩 본문"
                          value={c.endings[selected].text}
                          multiline
                          onCommit={(text) => updateItem({ text })}
                        />
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={c.endings[selected].revisitable}
                            onChange={(e) =>
                              updateItem({ revisitable: e.target.checked })
                            }
                          />
                          결론 직전 조사로 돌아가기 허용
                        </label>
                      </>
                    )}
                    {category === "hypotheses" &&
                      (() => {
                        const h = c.hypotheses[selected];
                        return (
                          <>
                            <TextField
                              label="플레이어가 선택할 가설"
                              value={h.label}
                              onCommit={(label) => updateItem({ label })}
                            />
                            <Select
                              label="연결된 엔딩"
                              value={h.endingId}
                              options={options("endings")}
                              onChange={(endingId) => updateItem({ endingId })}
                            />
                            <h3>필수 근거</h3>
                            {c.clues.map((cl) => (
                              <label className="check" key={cl.id}>
                                <input
                                  type="checkbox"
                                  checked={h.requiredClues.includes(cl.id)}
                                  onChange={(e) =>
                                    updateItem({
                                      requiredClues: e.target.checked
                                        ? [...h.requiredClues, cl.id]
                                        : h.requiredClues.filter(
                                            (id) => id !== cl.id,
                                          ),
                                    })
                                  }
                                />
                                {cl.title}
                              </label>
                            ))}
                          </>
                        );
                      })()}
                  </>
                )}
              </fieldset>
            </div>
          )}
        </main>
        <aside className="validation-panel">
          <div className="section-kicker">사건 점검</div>
          <h2>
            {validation.errors.length ? (
              <>
                <AlertTriangle size={21} /> 확인 필요
              </>
            ) : (
              <>
                <CheckCircle2 size={21} /> 플레이 준비 완료
              </>
            )}
          </h2>
          <p className="muted">
            {(
              new TextEncoder().encode(JSON.stringify(c)).length / 1024
            ).toFixed(1)}{" "}
            KB / 최대 1MB
          </p>
          {validation.errors.map((e, i) => (
            <button
              className="validation-error"
              key={i}
              onClick={() => {
                const [cat, index] = e.path.split(".");
                if (cat in labels) select(cat as Category, Number(index) || 0);
              }}
            >
              <strong>{issueLocation(e.path, c)}</strong>
              {issueMessage(e)}
            </button>
          ))}
          {validation.warnings.map((w, i) => (
            <p key={i} className="warning">
              {issueMessage(w)}
            </p>
          ))}
          <hr />
          <p>
            연결된 단서와 진행 조건을 자동으로 확인합니다. 이야기가 자연스럽게
            이어지는지는 직접 플레이하며 확인해 주세요.
          </p>
          <p className="small muted">
            수정이 필요한 초안도 이 기기에 보관하거나 파일로 저장할 수 있습니다.
            표시된 문제를 해결하면 테스트할 수 있습니다.
          </p>
        </aside>
      </div>
      <input
        ref={input}
        hidden
        type="file"
        accept=".gdcase,.json,application/json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const result = validateCase(await importJson(f));
            if (!result.data)
              throw new UserMessage(
                "이 사건 파일은 불러올 수 없습니다. 제작소에서 문제를 수정한 뒤 다시 저장해 주세요.",
              );
            if (addDraft(duplicateCase(result.data, uid())))
              setMessage("사건을 새로운 복사본으로 가져왔습니다.");
          } catch (err) {
            setMessage(
              userMessage(
                err,
                "사건 파일을 가져오지 못했습니다. 기존 초안은 유지됩니다.",
              ),
            );
          }
        }}
      />
      {message && (
        <Modal title="사건 제작소 안내" onClose={() => setMessage("")}>
          <p className="ending-text">{message}</p>
        </Modal>
      )}
      {deletion && item && (
        <Modal title="이 항목을 삭제할까요?" onClose={() => setDeletion(false)}>
          <p>
            {refPaths.length
              ? "다음 항목이 여기에 연결되어 있습니다. 삭제하면 연결을 다시 설정해야 플레이할 수 있습니다."
              : "이 항목에 연결된 다른 항목은 없습니다."}
          </p>
          <ul>
            {refPaths.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <button
            className="danger"
            onClick={() => {
              edit((x) => {
                if (category !== "info" && category !== "graph")
                  x[category].splice(selected, 1);
              });
              setSelected(0);
              setDeletion(false);
            }}
          >
            초안에서 삭제
          </button>
        </Modal>
      )}
    </div>
  );
}
