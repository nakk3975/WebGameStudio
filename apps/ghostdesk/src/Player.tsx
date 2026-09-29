import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Ghost,
  FileText,
  Folder,
  Trash2,
  MessageSquare,
  Image as ImageIcon,
  LockKeyhole,
  Network,
  ClipboardCheck,
  Minus,
  Maximize2,
  X,
  PanelLeft,
  PanelRight,
  ArrowLeft,
  Settings,
  Pause,
  Download,
  Lightbulb,
  Check,
  ChevronRight,
  Search,
  BookOpen,
} from "lucide-react";
import type { CaseFile } from "../../../packages/contracts/src";
import {
  transition,
  canInspect,
  canOpen,
  type Event,
  type State,
} from "../../../packages/engine-ghostdesk/src";
import { writePlay, download, createSaveQueue, type Save } from "./storage";
import { caseEntry } from "./cases";
import { boardRecord, recordText } from "./presentation";
import EvidenceView from "./EvidenceView";
import MediaGallery from "./MediaGallery";
import { availableMedia } from "./case-media";
import PuzzleAnswer from "./PuzzleAnswer";
import VisualPuzzle from "./VisualPuzzle";
import { Brand, Modal } from "./App";
const Icon = ({ file }: { file: CaseFile }) =>
  file.id === "trash" ? (
    <Trash2 />
  ) : file.type === "FOLDER" ? (
    <Folder />
  ) : file.type === "CHAT_LINK" ? (
    <MessageSquare />
  ) : file.type === "IMAGE" ? (
    <ImageIcon />
  ) : (
    <FileText />
  );
type Win = {
  id: string;
  x: number;
  y: number;
  layout: "normal" | "max" | "left" | "right";
  minimized: boolean;
};
const isLogFile = (file: CaseFile) => /\.log$/i.test(file.title);
export default function Player({
  initial,
  isTest,
  onExit,
  onSaved,
  onSettings,
  persistSave = writePlay,
  cloudStatus,
}: {
  initial: Save;
  isTest: boolean;
  onExit: () => void;
  onSaved: (s: Save) => void;
  onSettings: (snapshot: Save) => void;
  persistSave?: (s: Save) => Promise<void>;
  cloudStatus?: string;
}) {
  const c = initial.case,
    [state, setState] = useState(initial.state),
    [notes, setNotes] = useState(initial.notes),
    [checkpoint, setCheckpoint] = useState<State | null>(initial.checkpoint),
    [wins, setWins] = useState<Win[]>([]),
    [selected, setSelected] = useState(""),
    [toast, setToast] = useState(""),
    [saveStatus, setSaveStatus] = useState(
      isTest ? "테스트 진행 · 원본과 분리" : "저장 준비 중",
    ),
    [hypothesis, setHypothesis] = useState(""),
    [evidence, setEvidence] = useState<string[]>([]),
    [hintId, setHintId] = useState<string | null>(null),
    [reveal, setReveal] = useState(false),
    [endVisible, setEndVisible] = useState(state.mode === "ENDED"),
    [exiting, setExiting] = useState(false);
  const player = useRef<HTMLDivElement>(null),
    area = useRef<HTMLDivElement>(null),
    latest = useRef<Save>(initial),
    saveQueue = useRef(createSaveQueue<Save>(persistSave)),
    leaving = useRef(false),
    drag = useRef<{ id: string; dx: number; dy: number } | null>(null),
    previousSolved = useRef(state.solvedPuzzleIds.length);
  latest.current = {
    format: "ghostdesk-save-1",
    case: c,
    state,
    notes,
    checkpoint,
  };
  const send = useCallback(
    (e: Event) => {
      setState((prev) => {
        const result = transition(c, prev, e);
        if (result.message) setToast(result.message);
        return result.state;
      });
    },
    [c],
  );
  useEffect(() => {
    if (state.mode === "ENDED") setEndVisible(true);
  }, [state.mode]);
  useEffect(() => {
    const t = setInterval(() => send({ type: "TICK", ms: 250 }), 250);
    return () => clearInterval(t);
  }, [send]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const el = player.current;
      if (!el) return;
      if (!viewport || viewport.scale !== 1 || window.innerWidth > 760) {
        el.style.removeProperty("--visible-height");
        delete el.dataset.keyboard;
        return;
      }
      el.style.setProperty(
        "--visible-height",
        `${Math.round(viewport.height)}px`,
      );
      const editing = document.activeElement?.matches(
        "input, textarea, select",
      );
      el.dataset.keyboard =
        editing && window.innerHeight - viewport.height > 120
          ? "open"
          : "closed";
    };
    update();
    viewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);
  useEffect(() => {
    const pause = () => send({ type: "PAUSE" });
    const hidden = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", pause);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", pause);
    };
  }, [send]);
  async function persist(s: Save, final = false): Promise<boolean> {
    if (isTest) return true;
    if (s.state.mode === "ERROR" || (leaving.current && !final)) return false;
    setSaveStatus("저장 중");
    try {
      await saveQueue.current(s);
      setSaveStatus("이 기기에 저장됨");
      onSaved(s);
      return true;
    } catch {
      setSaveStatus("저장 실패 · 진행을 내보내세요");
      return false;
    }
  }
  async function leave() {
    if (leaving.current) return;
    if (isTest) return onExit();
    leaving.current = true;
    setExiting(true);
    const snapshot = structuredClone(latest.current);
    if (snapshot.state.mode === "RUNNING") snapshot.state.mode = "PAUSED";
    setState(snapshot.state);
    if (await persist(snapshot, true)) onExit();
    else {
      leaving.current = false;
      setExiting(false);
      setToast(
        "저장에 실패해 이동을 멈췄습니다. 진행을 내보내거나 다시 시도하세요.",
      );
    }
  }
  const progressKey = JSON.stringify([
    state.readFileIds,
    state.solvedPuzzleIds,
    state.clueIds,
    state.flags,
    state.deliveredMessageIds,
    state.readMessageIds,
    state.firedRuleIds,
    state.timers,
    state.endingId,
    state.attempts,
    state.hintLevels,
  ]);
  useEffect(() => {
    if (isTest || state.mode === "ERROR") return;
    setSaveStatus("저장 중");
    const important =
      state.mode === "ENDED" ||
      state.solvedPuzzleIds.length !== previousSolved.current;
    previousSolved.current = state.solvedPuzzleIds.length;
    const t = setTimeout(() => persist(latest.current), important ? 0 : 500);
    return () => clearTimeout(t);
  }, [progressKey, state.mode, notes, checkpoint]);
  // Timer updates must not starve saves: periodically flush only when progress changed.
  useEffect(() => {
    let seq = -1;
    const t = setInterval(() => {
      if (latest.current.state.eventSeq !== seq) {
        seq = latest.current.state.eventSeq;
        persist(latest.current);
      }
    }, 3000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  function focus(id: string) {
    setWins((old) => {
      const win = old.find((w) => w.id === id);
      return win
        ? [...old.filter((w) => w.id !== id), { ...win, minimized: false }]
        : old;
    });
  }
  function open(id: string) {
    const f = c.files.find((x) => x.id === id);
    if (f) {
      if (!canInspect(c, state, id)) {
        setToast(
          "아직 접근할 수 없는 파일입니다. 폴더의 잠금과 공개 조건을 확인하세요.",
        );
        return;
      }
      if (canOpen(c, state, id)) send({ type: "OPEN_FILE", id });
      if (f.type === "CHAT_LINK") send({ type: "READ_MESSAGES" });
    }
    setWins((old) => {
      const win = old.find((w) => w.id === id);
      if (win)
        return [
          ...old.filter((w) => w.id !== id),
          { ...win, minimized: false },
        ];
      if (old.length >= 12) {
        setToast("창은 최대 12개까지 열 수 있습니다.");
        return old;
      }
      return [
        ...old,
        {
          id,
          x: Math.min(48 + old.length * 28, 180),
          y: 40 + old.length * 20,
          layout: "normal",
          minimized: false,
        },
      ];
    });
  }
  const close = (id: string) => {
    setWins((w) => w.filter((x) => x.id !== id));
    setTimeout(() => document.getElementById("desktop-" + id)?.focus(), 0);
  };
  const patch = (id: string, p: Partial<Win>) =>
    setWins((w) => w.map((x) => (x.id === id ? { ...x, ...p } : x)));
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !hintId &&
        !document.querySelector("dialog[open]")
      ) {
        const w = wins.filter((x) => !x.minimized).at(-1);
        if (w) close(w.id);
      }
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [wins, hintId]);
  useEffect(() => {
    const resize = () => {
      const a = area.current;
      if (a)
        setWins((w) =>
          w.map((x) => ({
            ...x,
            x: Math.max(0, Math.min(x.x, a.clientWidth - 100)),
            y: Math.max(0, Math.min(x.y, a.clientHeight - 80)),
          })),
        );
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  function beginDrag(e: ReactPointerEvent, id: string) {
    if ((e.target as HTMLElement).closest("button")) return;
    const w = wins.find((x) => x.id === id)!;
    if (w.layout !== "normal") return;
    drag.current = { id, dx: e.clientX - w.x, dy: e.clientY - w.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    focus(id);
  }
  function moveDrag(e: ReactPointerEvent) {
    const d = drag.current,
      a = area.current;
    if (d && a)
      patch(d.id, {
        x: Math.max(
          0,
          Math.min(e.clientX - d.dx, Math.max(0, a.clientWidth - 160)),
        ),
        y: Math.max(
          0,
          Math.min(e.clientY - d.dy, Math.max(0, a.clientHeight - 80)),
        ),
      });
  }
  const unread = state.deliveredMessageIds.filter(
    (x) => !state.readMessageIds.includes(x),
  ).length;
  const entry = caseEntry(c);
  const nextHint =
    c.puzzles.find((p) => !state.solvedPuzzleIds.includes(p.id))?.id ||
    c.puzzles[0]?.id ||
    null;
  const requiredClues = [
    ...new Set(c.hypotheses.flatMap((h) => h.requiredClues)),
  ];
  const goal =
    state.mode === "ENDED"
      ? "조사가 마무리되었습니다."
      : !state.readFileIds.length
        ? "첫 메모를 확인하세요."
        : c.puzzles.some((p) => !state.solvedPuzzleIds.includes(p.id))
          ? "기록을 대조해 잠금을 해제하세요."
          : requiredClues.some((id) => !state.clueIds.includes(id))
            ? "새로 열린 파일에서 근거를 확인하세요."
            : "수집한 증거로 결론을 작성하세요.";
  function title(id: string) {
    return (
      c.files.find((f) => f.id === id)?.title ||
      (id === "@board"
        ? "증거 보드"
        : id === "@conclusion"
          ? "결론 작성"
          : "") ||
      id
    );
  }
  function fileButton(f: CaseFile, desktop = false) {
    return (
      <button
        id={desktop ? "desktop-" + f.id : undefined}
        key={f.id}
        className={`${desktop ? "desktop-icon" : "file-row"} ${selected === f.id ? "selected" : ""}`}
        onClick={() => {
          setSelected(f.id);
          if (!desktop || window.matchMedia("(max-width: 760px)").matches)
            open(f.id);
        }}
        onDoubleClick={() => desktop && open(f.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            open(f.id);
          }
        }}
        aria-label={f.title}
      >
        <span className={"file-symbol " + f.type.toLowerCase()}>
          <Icon file={f} />
          {f.puzzleId && !state.solvedPuzzleIds.includes(f.puzzleId) && (
            <LockKeyhole className="lock-badge" size={13} />
          )}
        </span>
        <span className="file-name">{f.title}</span>
        {state.readFileIds.includes(f.id) && (
          <Check className="read-check" size={13} />
        )}
      </button>
    );
  }
  function content(id: string) {
    const mediaPaused =
      state.mode !== "RUNNING" || !!wins.find((w) => w.id === id)?.minimized;
    if (id === "@board")
      return (
        <div className="board-content">
          <div className="section-kicker">
            수집한 단서 / {state.clueIds.length}
          </div>
          <h2>기록을 연결해 보세요.</h2>
          <p className="muted">
            확인한 자료를 모아 둔 목록입니다. 자료 사이의 관계는 직접 추리해
            보세요.
          </p>
          <div className="clue-grid">
            {c.clues
              .filter((x) => state.clueIds.includes(x.id))
              .map((cl, i) => (
                <article className="clue-card" key={cl.id}>
                  <span className="clue-number">
                    E-{String(i + 1).padStart(2, "0")}
                  </span>
                  <h3>{boardRecord(c, cl.id).title}</h3>
                  <p>{boardRecord(c, cl.id).description}</p>
                  <button
                    className="quiet"
                    onClick={() => {
                      const f = c.files.find(
                        (f) => f.clueId === cl.id && canInspect(c, state, f.id),
                      );
                      if (f) open(f.id);
                      else setToast("원본 파일은 아직 접근할 수 없습니다.");
                    }}
                  >
                    원본 열기 <ArrowLeft size={14} />
                  </button>
                </article>
              ))}
          </div>
          {!state.clueIds.length && (
            <div className="empty">
              아직 발견한 단서가 없습니다.
              <br />
              사건 자료에서 첫 메모를 열어보세요.
            </div>
          )}
          <label className="field">
            나의 추리 노트
            <textarea
              maxLength={10000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="기록의 모순이나 떠오른 가설을 적어보세요."
            />
          </label>
          <small className="muted">
            {notes.length.toLocaleString()} / 10,000 · 메모는 결론 판정에
            사용되지 않습니다.
          </small>
        </div>
      );
    if (id === "@conclusion")
      return (
        <div className="conclusion-content">
          <div className="section-kicker">최종 결론</div>
          <h2>그날, 무슨 일이 있었을까?</h2>
          {c.puzzles.some((p) => p.stageTitle) &&
            state.solvedPuzzleIds.length < c.puzzles.length && (
              <p className="stage-notice">
                다섯 단계의 확인을 마친 뒤 최종 결론을 제출할 수 있어요.
              </p>
            )}
          <p className="muted">
            가설 하나와 그것을 뒷받침하는 근거를 선택하세요.
          </p>
          <div className="choice-list">
            {c.hypotheses.map((h) => (
              <label className="choice" key={h.id}>
                <input
                  type="radio"
                  name="hypothesis"
                  checked={hypothesis === h.id}
                  onChange={() => setHypothesis(h.id)}
                />
                {h.label}
              </label>
            ))}
          </div>
          <h3>결론의 근거</h3>
          {c.clues
            .filter((cl) => state.clueIds.includes(cl.id))
            .map((cl) => (
              <label className="check evidence-check" key={cl.id}>
                <input
                  type="checkbox"
                  checked={evidence.includes(cl.id)}
                  onChange={(e) =>
                    setEvidence((old) =>
                      e.target.checked
                        ? [...old, cl.id]
                        : old.filter((x) => x !== cl.id),
                    )
                  }
                />
                {boardRecord(c, cl.id).title}
              </label>
            ))}
          {!state.clueIds.length && (
            <p className="muted">아직 수집한 증거가 없습니다.</p>
          )}
          <button
            className="primary"
            disabled={
              !hypothesis ||
              state.mode !== "RUNNING" ||
              (c.puzzles.some((p) => p.stageTitle) &&
                c.puzzles.some((p) => !state.solvedPuzzleIds.includes(p.id)))
            }
            onClick={() => {
              setToast("");
              setCheckpoint(structuredClone(state));
              send({ type: "CONCLUDE", id: hypothesis, evidence });
            }}
          >
            결론 제출 <ChevronRight size={16} />
          </button>
        </div>
      );
    const f = c.files.find((x) => x.id === id);
    if (!f) return null;
    if (!canInspect(c, state, id))
      return <p className="empty">아직 접근할 수 없는 파일입니다.</p>;
    if (f.puzzleId && !state.solvedPuzzleIds.includes(f.puzzleId)) {
      const p = c.puzzles.find((p) => p.id === f.puzzleId)!;
      const Answer = p.inputMode === "visual" ? VisualPuzzle : PuzzleAnswer;
      return (
        <div className={"vault " + (p.stageTitle ? "stage-puzzle" : "")}>
          <div className="vault-lock">
            <LockKeyhole size={32} />
          </div>
          <div className="section-kicker">
            {p.stageTitle
              ? `${c.puzzles.indexOf(p) + 1} / ${c.puzzles.length} 단계`
              : "잠긴 보관함"}
          </div>
          <h2>{p.stageTitle || "보관함이 잠겨 있습니다."}</h2>
          <p>{p.title}</p>
          {!!p.evidenceIds?.length && (
            <div className="puzzle-sources">
              <h3>대조할 자료</h3>
              {p.evidenceIds.map((eid) => {
                const source = c.files.find((x) => x.id === eid);
                if (!source || !canOpen(c, state, eid)) return null;
                return (
                  <details
                    key={eid}
                    onToggle={(e) => {
                      if (e.currentTarget.open)
                        send({ type: "OPEN_FILE", id: eid });
                      else
                        e.currentTarget
                          .querySelectorAll("video")
                          .forEach((video) => video.pause());
                    }}
                  >
                    <summary>{source.title}</summary>
                    {source.type === "IMAGE" ? (
                      <EvidenceView
                        file={source}
                        related={availableMedia(c, state)}
                        paused={mediaPaused}
                      />
                    ) : (
                      <>
                        <MediaGallery
                          items={availableMedia(c, state, source.id)}
                          paused={mediaPaused}
                        />
                        <pre className="source-text">{recordText(c, source)}</pre>
                      </>
                    )}
                  </details>
                );
              })}
            </div>
          )}
          <Answer
            key={p.id}
            puzzle={p}
            paused={mediaPaused}
            onSubmit={(answer) => {
              const r = transition(c, state, {
                type: "SOLVE",
                id: p.id,
                answer,
              });
              setState(r.state);
              if (r.message) setToast(r.message);
              if (r.state.solvedPuzzleIds.includes(p.id))
                send({ type: "OPEN_FILE", id: f.id });
            }}
          />
          <p className="small muted">
            {(!p.inputMode || p.inputMode === "text") && (
              <>
                답 앞뒤의 빈칸은 무시합니다.{" "}
                {p.ignoreCase
                  ? "영문 대소문자는 상관없어요."
                  : "영문 대소문자를 구분해 주세요."}
                <br />
              </>
            )}
            시도{" "}
            {Object.hasOwn(state.attempts, p.id) ? state.attempts[p.id] : 0}회 ·
            횟수 제한 없음
          </p>
          <button className="quiet" onClick={() => setHintId(p.id)}>
            <Lightbulb size={16} /> 도움이 필요해요
          </button>
        </div>
      );
    }
    if (f.type === "FOLDER")
      return (
        <div className="folder-content">
          <div className="breadcrumbs">
            {entry.location} <ChevronRight size={14} />
            {f.title}
          </div>
          {f.text && <p className="muted">{f.text}</p>}
          {f.puzzleId &&
            c.puzzles
              .find((p) => p.id === f.puzzleId)
              ?.evidenceIds?.map((eid) => {
                const source = c.files.find((x) => x.id === eid);
                return source && canInspect(c, state, eid)
                  ? fileButton(source)
                  : null;
              })}
          {f.puzzleId &&
            c.puzzles.find((p) => p.id === f.puzzleId)?.stageTitle && (
              <button
                className="primary"
                onClick={() => {
                  const next = c.files.find(
                    (x) =>
                      x.puzzleId &&
                      !state.solvedPuzzleIds.includes(x.puzzleId) &&
                      canInspect(c, state, x.id),
                  );
                  if (next) open(next.id);
                  else open("@conclusion");
                }}
              >
                {state.solvedPuzzleIds.length < c.puzzles.length
                  ? "다음 단계 열기"
                  : "결론 작성하기"}
              </button>
            )}
          {c.files
            .filter(
              (x) => x.parentId === id && state.visibleFileIds.includes(x.id),
            )
            .map((x) => fileButton(x))}
          {!f.puzzleId &&
            !c.files.some(
              (x) => x.parentId === id && state.visibleFileIds.includes(x.id),
            ) && <p className="empty">표시할 파일이 없습니다.</p>}
        </div>
      );
    if (f.type === "CHAT_LINK") {
      const messages = c.messages.filter((m) =>
        state.deliveredMessageIds.includes(m.id),
      );
      const authors = [...new Set(messages.map((m) => m.author))];
      return (
        <div className="chat-content">
          <div className="chat-person">
            <div className="avatar" aria-hidden="true">
              <MessageSquare size={18} />
            </div>
            <div>
              <b>{entry.location} 대화방</b>
              <span>{authors.join(" · ") || "아직 도착한 대화가 없어요"}</span>
            </div>
            <button
              className="quiet"
              onClick={() => send({ type: "READ_MESSAGES" })}
            >
              모두 읽음
            </button>
          </div>
          <div className="chat-date">
            <span>사건 당시의 대화</span>
          </div>
          <ol className="chat-thread" aria-label="대화 기록">
            {messages.map((m) => (
              <li className="message" key={m.id}>
                <span
                  className={
                    "message-avatar speaker-" + (authors.indexOf(m.author) % 3)
                  }
                  aria-hidden="true"
                >
                  {Array.from(m.author)[0]}
                </span>
                <div className="message-content">
                  <span className="message-author">{m.author}</span>
                  <p>{m.text}</p>
                  <div className="message-meta">
                    <time>{m.time}</time>
                    {!state.readMessageIds.includes(m.id) && (
                      <b className="new-label">새 메시지</b>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className="chat-note">
            <LockKeyhole size={14} aria-hidden="true" />
            보관된 대화예요. 지금은 답장을 보낼 수 없어요.
          </p>
        </div>
      );
    }
    if (f.type === "IMAGE" || f.id === "hotel-404-f3")
      return (
        <EvidenceView
          key={f.id}
          file={f}
          related={availableMedia(c, state)}
          paused={mediaPaused}
        />
      );
    return (
      <article
        className={
          "document document-reader " + (isLogFile(f) ? "log-document" : "")
        }
      >
        <div className="document-meta">
          <span>
            <FileText size={16} aria-hidden="true" />
            {isLogFile(f) ? "시스템 기록" : "메모장"}
          </span>
          <span>읽기 전용</span>
        </div>
        <MediaGallery
          key={f.id}
          items={availableMedia(c, state, f.id)}
          paused={mediaPaused}
        />
        <div className="document-sheet">
          <pre>{recordText(c, f)}</pre>
          {f.clueId && (
            <div className="evidence-found">
              <Check size={16} /> 단서를 증거 보드에 기록했어요.
            </div>
          )}
        </div>
      </article>
    );
  }
  return (
    <div className="player" ref={player} inert={exiting}>
      <header className="topbar">
        <button
          className="brand-button"
          onClick={leave}
          aria-label={isTest ? "제작기로 돌아가기" : "홈으로"}
        >
          <Brand />
        </button>
        <div className="player-case">
          <span className="case-tag">
            {isTest ? "테스트 플레이" : "CASE " + entry.number}
          </span>
          <b>{c.title}</b>
        </div>
        <nav>
          <span className="save-state" role="status">
            {saveStatus.startsWith("저장 실패") || saveStatus === "저장 중"
              ? saveStatus
              : cloudStatus || saveStatus}
          </span>
          <button
            className="icon-button"
            onClick={() =>
              download("ghostdesk-progress.gdsave", latest.current)
            }
            aria-label="진행 파일 저장"
          >
            <Download size={18} />
          </button>
          <button
            className="icon-button"
            onClick={() => send({ type: "PAUSE" })}
            aria-label="일시정지"
          >
            <Pause size={18} />
          </button>
          <button
            className="icon-button"
            onClick={() => onSettings(structuredClone(latest.current))}
            aria-label="설정"
          >
            <Settings size={18} />
          </button>
        </nav>
      </header>
      <div className="mission-strip">
        <span>
          <Search size={16} /> 현재 목표
        </span>
        <b>{goal}</b>
        <span className="muted">파일 더블클릭 또는 Enter로 열기</span>
      </div>
      {c.puzzles.some((p) => p.stageTitle) && (
        <nav className="stage-rail" aria-label="조사 단계">
          <span>
            확인 {state.solvedPuzzleIds.length}/{c.puzzles.length}
          </span>
          {c.puzzles.map((p, i) => {
            const f = c.files.find((f) => f.puzzleId === p.id)!;
            const solved = state.solvedPuzzleIds.includes(p.id);
            return (
              <button
                key={p.id}
                disabled={!canInspect(c, state, f.id)}
                aria-label={`${i + 1}단계 ${p.stageTitle}${solved ? " · 완료" : ""}`}
                onClick={() => open(f.id)}
                className={solved ? "stage-done" : ""}
              >
                <b>{solved ? "✓" : i + 1}</b>
                <span>{p.stageTitle}</span>
              </button>
            );
          })}
        </nav>
      )}
      <div className="desktop-layout">
        <aside className="desktop-files">
          <span className="file-rail-label">사건 자료</span>
          {c.files
            .filter((f) => !f.parentId && state.visibleFileIds.includes(f.id))
            .map((f) => fileButton(f, true))}
        </aside>
        <main className="desktop-area" ref={area}>
          <div className="desktop-watermark">
            <span>
              {entry.location} / CASE {entry.number}
            </span>
            <strong>{entry.display}</strong>
            <p>모든 기록에는, 빈틈이 있다.</p>
          </div>
          {!wins.some((w) => !w.minimized) && (
            <div className="desktop-welcome">
              <BookOpen size={24} />
              <h2>남겨진 기록에서 시작하세요.</h2>
              <p>첫 메모에서 조사 의뢰와 잠금 해제 방법을 확인하세요.</p>
              <button
                className="primary"
                onClick={() =>
                  open(
                    c.files.find(
                      (f) => f.type === "TEXT" && f.visible && !f.parentId,
                    )?.id || c.files[0].id,
                  )
                }
              >
                첫 메모 열기 <ChevronRight size={17} />
              </button>
            </div>
          )}
          {wins.map((w, i) => (
            <section
              key={w.id}
              aria-label={title(w.id) + " 창"}
              data-view={(() => {
                const file = c.files.find((f) => f.id === w.id);
                return file?.type === "CHAT_LINK"
                  ? "chat"
                  : file?.type === "TEXT"
                    ? isLogFile(file)
                      ? "log"
                      : "document"
                    : undefined;
              })()}
              className={`os-window ${w.layout} ${i === wins.length - 1 ? "active" : ""}`}
              style={{
                display: w.minimized ? "none" : undefined,
                ...(w.layout === "normal" ? { left: w.x, top: w.y } : {}),
                zIndex: i + 1,
              }}
              onPointerDownCapture={() => focus(w.id)}
            >
              <header
                className="window-header"
                onPointerDown={(e) => beginDrag(e, w.id)}
                onPointerMove={moveDrag}
                onPointerUp={() => (drag.current = null)}
                onLostPointerCapture={() => (drag.current = null)}
              >
                <span>
                  <span className="window-led" />
                  {title(w.id)}
                </span>
                <div className="window-controls">
                  <button
                    aria-label={title(w.id) + " 왼쪽 배치"}
                    onClick={() => patch(w.id, { layout: "left" })}
                  >
                    <PanelLeft size={14} />
                  </button>
                  <button
                    aria-label={title(w.id) + " 오른쪽 배치"}
                    onClick={() => patch(w.id, { layout: "right" })}
                  >
                    <PanelRight size={14} />
                  </button>
                  <button
                    aria-label={title(w.id) + " 최소화"}
                    onClick={() => patch(w.id, { minimized: true })}
                  >
                    <Minus size={14} />
                  </button>
                  <button
                    aria-label={title(w.id) + " 최대화"}
                    onClick={() =>
                      patch(w.id, {
                        layout: w.layout === "max" ? "normal" : "max",
                      })
                    }
                  >
                    <Maximize2 size={14} />
                  </button>
                  <button
                    aria-label={title(w.id) + " 닫기"}
                    onClick={() => close(w.id)}
                  >
                    <X size={16} />
                  </button>
                </div>
              </header>
              <div className="window-body">{content(w.id)}</div>
            </section>
          ))}
        </main>
        <aside className="investigation">
          <div className="section-kicker">조사 현황</div>
          <h2>조사 기록</h2>
          <div className="progress-caption">
            <span>발견한 단서</span>
            <b>
              {state.clueIds.length}
              <small> / {c.clues.length}</small>
            </b>
          </div>
          <div className="progress-bar">
            <i
              style={{
                width: `${(state.clueIds.length / Math.max(c.clues.length, 1)) * 100}%`,
              }}
            />
          </div>
          <div className="evidence-mini">
            {c.clues
              .filter((cl) => state.clueIds.includes(cl.id))
              .map((cl) => (
                <button key={cl.id} onClick={() => open("@board")}>
                  <Check size={14} />
                  {boardRecord(c, cl.id).title}
                </button>
              ))}
            {!state.clueIds.length && <p>아직 단서를 발견하지 못했습니다.</p>}
          </div>
          <button className="secondary" onClick={() => open("@board")}>
            <Network size={17} /> 증거 보드
          </button>
          <div className="investigation-bottom">
            <span className="section-kicker">나의 추리</span>
            <p>
              의심을 결론으로 만들려면
              <br />
              근거가 필요합니다.
            </p>
            <button
              className="primary"
              onClick={() =>
                state.mode === "ENDED"
                  ? setEndVisible(true)
                  : open("@conclusion")
              }
            >
              <ClipboardCheck size={17} />
              {state.mode === "ENDED" ? "결론 다시 보기" : "결론 작성"}
            </button>
            <button className="quiet" onClick={() => setHintId(nextHint)}>
              <Lightbulb size={15} /> 단계별 힌트
            </button>
          </div>
        </aside>
      </div>
      <footer className="taskbar">
        <button
          className="task-home"
          onClick={() =>
            setWins((w) => w.map((x) => ({ ...x, minimized: true })))
          }
          aria-label="바탕화면 보기"
        >
          <Ghost size={22} />
          <span className="mobile-nav-label">자료</span>
        </button>
        <div className="task-list">
          {wins.map((w) => (
            <button
              key={w.id}
              className={!w.minimized ? "task active-task" : "task"}
              onClick={() => focus(w.id)}
            >
              {title(w.id)}
            </button>
          ))}
        </div>
        <button
          className="mobile-board"
          onClick={() => open("@board")}
          aria-label="증거 보드"
        >
          <Network size={18} />
          <span className="mobile-nav-label">증거</span>
        </button>
        <button
          className="mobile-board"
          onClick={() =>
            state.mode === "ENDED" ? setEndVisible(true) : open("@conclusion")
          }
          aria-label="결론 작성"
        >
          <ClipboardCheck size={18} />
          <span className="mobile-nav-label">결론</span>
        </button>
        <button
          className="mobile-board"
          aria-label="단계별 힌트"
          disabled={!c.puzzles.length}
          onClick={() => setHintId(nextHint)}
        >
          <Lightbulb size={18} />
          <span className="mobile-nav-label">힌트</span>
        </button>
        <button
          className="message-task"
          aria-label={
            unread ? `메신저 · 읽지 않은 메시지 ${unread}개` : "메신저 열기"
          }
          onClick={() => {
            const f = c.files.find((x) => x.type === "CHAT_LINK");
            if (f) open(f.id);
          }}
        >
          <MessageSquare size={17} />
          <span className="mobile-nav-label">대화</span>
          {unread > 0 && <b>{unread}</b>}
        </button>
        <span className="task-clock">
          {entry.display} <small>{entry.location}</small>
        </span>
      </footer>
      {toast && (
        <div className="toast" role="alert">
          {toast}
          <button onClick={() => setToast("")} aria-label="알림 닫기">
            <X size={15} />
          </button>
        </div>
      )}
      {state.mode === "PAUSED" && (
        <Modal
          title="조사를 잠시 멈췄습니다"
          onClose={() => send({ type: "RESUME" })}
        >
          <p>자리를 비운 동안 사건 속 시간은 흐르지 않았습니다.</p>
          <button className="primary" onClick={() => send({ type: "RESUME" })}>
            <PlayIcon /> 조사 계속하기
          </button>
        </Modal>
      )}
      {state.mode === "ERROR" && (
        <Modal title="사건 규칙을 확인해야 합니다" onClose={() => onExit()}>
          <p>
            사건을 진행하는 중 문제가 생겼습니다. 홈으로 돌아가 다시 이어 해
            주세요. 같은 문제가 반복되면 오류 기록을 저장해 알려 주세요.
          </p>
          <p>
            이번 행동 전 상태로 되돌렸으며, 직전 정상 저장은 덮어쓰지
            않았습니다.
          </p>
          <button
            onClick={() =>
              download("ghostdesk-support.txt", {
                code: state.diagnostic,
                eventSeq: state.eventSeq,
                versionId: c.versionId,
              })
            }
          >
            오류 기록 저장
          </button>
          <button onClick={onExit}>돌아가기</button>
        </Modal>
      )}
      {hintId && (
        <Modal
          title="단계별 힌트"
          onClose={() => {
            setHintId(null);
            setReveal(false);
          }}
        >
          {(() => {
            const p = c.puzzles.find((x) => x.id === hintId)!;
            const n = Object.hasOwn(state.hintLevels, p.id)
              ? state.hintLevels[p.id]
              : 0;
            return (
              <>
                <p className="muted">
                  필요한 만큼만 열어보세요. 힌트를 사용해도 엔딩은 달라지지
                  않습니다.
                </p>
                {p.hints.slice(0, n).map((h, i) => (
                  <p className="hint-step" key={i}>
                    <b>0{i + 1}</b>
                    {h}
                  </p>
                ))}
                {n < p.hints.length &&
                  (n === p.hints.length - 1 && !reveal ? (
                    <button onClick={() => setReveal(true)}>
                      마지막 힌트 확인
                    </button>
                  ) : (
                    <>
                      <p>
                        {reveal
                          ? "다음 힌트에는 정답이 포함됩니다. 공개할까요?"
                          : ""}
                      </p>
                      <button
                        className="primary"
                        onClick={() => {
                          send({ type: "HINT", id: p.id, reveal });
                          setReveal(false);
                        }}
                      >
                        {reveal ? "정답 공개" : "다음 힌트"}
                      </button>
                    </>
                  ))}
              </>
            );
          })()}
        </Modal>
      )}
      {state.mode === "ENDED" && endVisible && (
        <Modal
          title={c.endings.find((e) => e.id === state.endingId)!.title}
          onClose={() => setEndVisible(false)}
        >
          <div className="ending-mark">
            <FileText size={28} />
            <span>
              {c.endings.find((e) => e.id === state.endingId)!.revisitable
                ? "다시 조사하기"
                : "조사 완료"}
            </span>
          </div>
          <p className="ending-text">
            {c.endings.find((e) => e.id === state.endingId)!.text}
          </p>
          <div className="button-row">
            {c.endings.find((e) => e.id === state.endingId)!.revisitable &&
            checkpoint ? (
              <button
                className="primary"
                onClick={() => {
                  setState({ ...checkpoint, mode: "RUNNING" });
                  setEndVisible(false);
                }}
              >
                조사 재개
              </button>
            ) : (
              <button className="primary" onClick={() => setEndVisible(false)}>
                조사 기록 다시 보기
              </button>
            )}
            <button
              onClick={() =>
                download("ghostdesk-progress.gdsave", latest.current)
              }
            >
              <Download size={16} /> 진행 파일 저장
            </button>
            <button onClick={leave}>
              {isTest ? "제작기로 돌아가기" : "사건 선택으로"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function PlayIcon() {
  return <ChevronRight size={17} />;
}
