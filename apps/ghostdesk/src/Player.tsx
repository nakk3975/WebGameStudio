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
  Video,
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
import { caseEntry, isOfficialCaseVersion } from "./cases";
import {
  boardRecord,
  recordText,
  messageText,
  evidenceFile,
  isVideoFile,
} from "./presentation";
import EvidenceView from "./EvidenceView";
import MediaGallery from "./MediaGallery";
import { availableMedia } from "./case-media";
import PuzzleAnswer from "./PuzzleAnswer";
import VisualPuzzle from "./VisualPuzzle";
import DesktopFiles from "./DesktopFiles";
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
    [helpVisible, setHelpVisible] = useState(false),
    [reveal, setReveal] = useState(false),
    [endVisible, setEndVisible] = useState(state.mode === "ENDED"),
    [exiting, setExiting] = useState(false);
  const files = c.files.map((file) => evidenceFile(c, file));
  const player = useRef<HTMLDivElement>(null),
    area = useRef<HTMLDivElement>(null),
    latest = useRef<Save>(initial),
    saveQueue = useRef(createSaveQueue<Save>(persistSave)),
    leaving = useRef(false),
    pendingWindowFocus = useRef<string | null>(null),
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
    const pause = () => {
      // pagehide may be the last task before this document is frozen/unloaded.
      // Queue the paused snapshot now; do not wait for React's 500ms autosave.
      const snapshot = structuredClone(latest.current);
      snapshot.state = transition(c, snapshot.state, { type: "PAUSE" }).state;
      latest.current = snapshot;
      setState(snapshot.state);
      void persist(snapshot);
    };
    const hidden = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", pause);
    window.addEventListener("pagehide", pause);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", pause);
      window.removeEventListener("pagehide", pause);
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
  const separatePhotos = isOfficialCaseVersion(c);
  const photos = separatePhotos
    ? availableMedia(c, state).filter((m) => !m.video)
    : [];
  const videos = separatePhotos
    ? availableMedia(c, state).filter((m) => m.video)
    : [];
  function open(id: string) {
    if (
      id.startsWith("@photo:") &&
      !photos.some((m) => id === `@photo:${m.id}`)
    )
      return;
    if (
      id.startsWith("@video:") &&
      !videos.some((m) => id === `@video:${m.id}`)
    )
      return;
    const f = files.find((x) => x.id === id);
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
    pendingWindowFocus.current = id;
    showWindow(id);
  }
  function showWindow(id: string, replaceId?: string) {
    setWins((old) => {
      const replaced = old.find((w) => w.id === replaceId);
      const remaining = old.filter((w) => w.id !== replaceId);
      const win = remaining.find((w) => w.id === id);
      if (win)
        return [
          ...remaining.filter((w) => w.id !== id),
          { ...win, minimized: false },
        ];
      if (remaining.length >= 12) {
        setToast("창은 최대 12개까지 열 수 있습니다.");
        return old;
      }
      return [
        ...remaining,
        {
          id,
          x: replaced?.x ?? Math.min(48 + remaining.length * 28, 180),
          y: replaced?.y ?? 40 + remaining.length * 20,
          layout: replaced?.layout ?? "normal",
          minimized: false,
        },
      ];
    });
  }
  const close = (id: string) => {
    setWins((w) => w.filter((x) => x.id !== id));
    setTimeout(() => {
      const target =
        document.getElementById("desktop-" + id) ||
        player.current?.querySelector<HTMLElement>(".desktop-grid");
      target?.focus();
    }, 0);
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
      photos.find((m) => id === `@photo:${m.id}`)?.title ||
      videos.find((m) => id === `@video:${m.id}`)?.title ||
      files.find((f) => f.id === id)?.title ||
      (id === "@photos"
        ? "이미지 자료"
        : id === "@board"
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
          open(f.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            open(f.id);
          }
        }}
        aria-label={f.title}
        title={`${f.title} · 한 번 클릭하여 열기`}
      >
        <span
          className={
            "file-symbol " +
            (isVideoFile(c, f) ? "video" : f.type.toLowerCase())
          }
        >
          {isVideoFile(c, f) ? <Video /> : <Icon file={f} />}
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
  function attachments(fileId: string, paused: boolean) {
    const items = availableMedia(c, state, fileId);
    if (!separatePhotos)
      return <MediaGallery key={fileId} items={items} paused={paused} />;
    const pictures = items.filter((item) => !item.video);
    const source = files.find((f) => f.id === fileId);
    const embedded = source && isVideoFile(c, source);
    const clips = items.filter((item) => item.video);
    return (
      <>
        {embedded && (
          <MediaGallery key={fileId} items={clips} paused={paused} />
        )}
        {!embedded && clips.length > 0 && (
          <nav className="photo-links" aria-label="별도 영상 자료">
            {clips.map((item) => (
              <button key={item.id} onClick={() => open(`@video:${item.id}`)}>
                <Video size={16} aria-hidden="true" /> {item.title} · 영상 열기
              </button>
            ))}
          </nav>
        )}
        {pictures.length ? (
          <nav className="photo-links" aria-label="별도 이미지 자료">
            {pictures.map((item) => (
              <button key={item.id} onClick={() => open(`@photo:${item.id}`)}>
                <ImageIcon size={16} aria-hidden="true" /> {item.title} · 이미지
                열기
              </button>
            ))}
          </nav>
        ) : null}
      </>
    );
  }
  function content(id: string) {
    const mediaPaused =
      state.mode !== "RUNNING" || !!wins.find((w) => w.id === id)?.minimized;
    if (id === "@photos")
      return (
        <div className="folder-content" aria-label="이미지 자료 목록">
          {photos.map((item) => (
            <button
              className="file-row"
              key={item.id}
              onClick={() => open(`@photo:${item.id}`)}
            >
              <ImageIcon size={20} aria-hidden="true" /> {item.title}
            </button>
          ))}
        </div>
      );
    if (id.startsWith("@photo:")) {
      const item = photos.find((m) => id === `@photo:${m.id}`);
      return item ? (
        <MediaGallery key={item.id} items={[item]} paused={mediaPaused} />
      ) : null;
    }
    if (id.startsWith("@video:")) {
      const item = videos.find((m) => id === `@video:${m.id}`);
      return item ? (
        <MediaGallery key={item.id} items={[item]} paused={mediaPaused} />
      ) : null;
    }
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
                      const f = files.find(
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
                {c.puzzles.length}단계의 확인을 마친 뒤 최종 결론을 제출할 수
                있어요.
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
    const f = files.find((x) => x.id === id);
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
          <div className="section-kicker">암호로 보호된 폴더</div>
          <h2>{f.title}</h2>
          <p className="folder-lock-notice">
            이 폴더를 열려면 암호가 필요합니다.
          </p>
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
              let nextState = r.state;
              const newlySolved =
                !state.solvedPuzzleIds.includes(p.id) &&
                nextState.solvedPuzzleIds.includes(p.id);
              if (newlySolved)
                nextState = transition(c, nextState, {
                  type: "OPEN_FILE",
                  id: f.id,
                }).state;
              setState(nextState);
              if (r.message)
                setToast(
                  newlySolved
                    ? `‘${f.title}’ 폴더의 잠금이 해제되었습니다.`
                    : nextState.attempts[p.id] !== state.attempts[p.id]
                      ? "암호가 맞지 않습니다. 자료와 암호 힌트를 다시 확인해 주세요."
                      : r.message,
                );
              // Use the post-solve state: the next folder is still hidden in
              // this render. Reuse the solved window, even at the 12-window cap.
              if (newlySolved && p.stageTitle && nextState.mode === "RUNNING") {
                const next = c.puzzles
                  .slice(c.puzzles.indexOf(p) + 1)
                  .filter(
                    (puzzle) => !nextState.solvedPuzzleIds.includes(puzzle.id),
                  )
                  .map((puzzle) =>
                    files.find((file) => file.puzzleId === puzzle.id),
                  )
                  .find((file) => file && canInspect(c, nextState, file.id));
                if (next) {
                  pendingWindowFocus.current = next.id;
                  showWindow(next.id, f.id);
                  setToast(`‘${f.title}’ 잠금 해제 · 다음 폴더: ${next.title}`);
                }
              }
            }}
          />
          <p className="small muted">
            {(!p.inputMode || p.inputMode === "text") && (
              <>
                암호 앞뒤의 빈칸은 무시합니다.{" "}
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
            <Lightbulb size={16} /> 암호 힌트 보기
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
          {f.text && <p className="muted">{recordText(c, f)}</p>}
          {f.puzzleId &&
            c.puzzles
              .find((p) => p.id === f.puzzleId)
              ?.evidenceIds?.map((eid) => {
                const source = files.find((x) => x.id === eid);
                return source && canInspect(c, state, eid)
                  ? fileButton(source)
                  : null;
              })}
          {f.puzzleId &&
            c.puzzles.find((p) => p.id === f.puzzleId)?.stageTitle && (
              <button
                className="primary"
                onClick={() => {
                  const next = files.find(
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
                  ? "다음 폴더 열기"
                  : "결론 작성하기"}
              </button>
            )}
          {files
            .filter(
              (x) => x.parentId === id && state.visibleFileIds.includes(x.id),
            )
            .map((x) => fileButton(x))}
          {!f.puzzleId &&
            !files.some(
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
                  <p>{messageText(c, m)}</p>
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
        <>
          <EvidenceView
            casePackage={c}
            key={f.id}
            file={f}
            related={availableMedia(c, state)}
            paused={mediaPaused}
          />
          {separatePhotos && attachments(f.id, mediaPaused)}
        </>
      );
    return (
      <article
        className={
          "document document-reader " + (isLogFile(f) ? "log-document" : "")
        }
      >
        <div className="document-meta">
          <span>
            {isVideoFile(c, f) ? (
              <Video size={16} aria-hidden="true" />
            ) : (
              <FileText size={16} aria-hidden="true" />
            )}
            {isVideoFile(c, f)
              ? "영상 기록"
              : isLogFile(f)
                ? "시스템 기록"
                : "메모장"}
          </span>
          <span>읽기 전용</span>
        </div>
        {attachments(f.id, mediaPaused)}
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
        <button
          className="quiet investigation-help"
          onClick={() => setHelpVisible(true)}
        >
          <BookOpen size={16} /> 조사 방법
        </button>
      </div>
      {c.puzzles.some((p) => p.stageTitle) && (
        <nav className="stage-rail" aria-label="폴더 바로가기">
          <span>
            잠금 해제 {state.solvedPuzzleIds.length}/{c.puzzles.length}
          </span>
          {c.puzzles.map((p) => {
            const f = files.find((f) => f.puzzleId === p.id)!;
            const solved = state.solvedPuzzleIds.includes(p.id);
            return (
              <button
                key={p.id}
                disabled={!canInspect(c, state, f.id)}
                aria-label={`${f.title}${solved ? " · 잠금 해제됨" : " · 암호 필요"}`}
                onClick={() => open(f.id)}
                className={solved ? "stage-done" : ""}
              >
                <b>{solved ? "✓" : <Folder size={14} aria-hidden="true" />}</b>
                <span>{f.title}</span>
              </button>
            );
          })}
        </nav>
      )}
      <div className="desktop-layout">
        <main className="desktop-area" ref={area}>
          <div className="desktop-watermark">
            <span>
              {entry.location} / CASE {entry.number}
            </span>
            <strong>{entry.display}</strong>
            <p>모든 기록에는, 빈틈이 있다.</p>
          </div>
          <DesktopFiles
            items={[
              ...files
                .filter(
                  (f) => !f.parentId && state.visibleFileIds.includes(f.id),
                )
                .map((f) => ({ id: f.id, content: fileButton(f, true) })),
              ...(photos.length
                ? [
                    {
                      id: "@photos",
                      content: (
                        <button
                          className="desktop-icon"
                          id="desktop-@photos"
                          aria-label="이미지 자료"
                          onClick={() => open("@photos")}
                        >
                          <span className="file-symbol folder">
                            <Folder />
                          </span>
                          <span className="file-name">이미지 자료</span>
                        </button>
                      ),
                    },
                  ]
                : []),
            ]}
            introduction={
              !state.readFileIds.length && (
                <div className="desktop-start">
                  <div>
                    <b>처음이라면 첫 메모부터</b>
                    <span>
                      의뢰를 읽고, 바탕화면의 기록을 자유롭게 살펴보세요.
                    </span>
                  </div>
                  <button
                    className="primary"
                    onClick={() =>
                      open(
                        files.find(
                          (f) => f.type === "TEXT" && f.visible && !f.parentId,
                        )?.id || files[0].id,
                      )
                    }
                  >
                    첫 메모 열기 <ChevronRight size={16} />
                  </button>
                </div>
              )
            }
          />
          {wins.map((w, i) => (
            <section
              key={w.id}
              tabIndex={-1}
              ref={(node) => {
                if (node && pendingWindowFocus.current === w.id) {
                  pendingWindowFocus.current = null;
                  node.focus();
                }
              }}
              aria-label={title(w.id) + " 창"}
              data-view={(() => {
                const file = files.find((f) => f.id === w.id);
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
          onClick={() => {
            setWins((w) => w.map((x) => ({ ...x, minimized: true })));
            player.current
              ?.querySelector<HTMLElement>(".desktop-grid")
              ?.focus();
          }}
          aria-label="바탕화면 보기"
        >
          <Ghost size={22} />
          <span className="desktop-home-label">바탕화면</span>
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
            const f = files.find((x) => x.type === "CHAT_LINK");
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
        <Modal title="조사를 잠시 멈췄습니다">
          <p>자리를 비운 동안 사건 속 시간은 흐르지 않았습니다.</p>
          <button className="primary" onClick={() => send({ type: "RESUME" })}>
            <PlayIcon /> 조사 계속하기
          </button>
          <button className="secondary" onClick={leave}>
            {isTest ? "제작기로 돌아가기" : "홈으로"}
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
      {helpVisible && (
        <Modal title="조사 방법" onClose={() => setHelpVisible(false)}>
          <ul className="investigation-help-list">
            <li>
              <b>파일은 한 번 클릭</b>
              <p>
                바탕화면의 메모, 사진, 영상과 메신저를 열어보세요. 읽은 파일에는
                ✓ 표시가 남습니다.
              </p>
            </li>
            <li>
              <b>기록을 대조해서 암호 찾기</b>
              <p>
                자물쇠가 있는 폴더는 암호가 필요합니다. 막힐 때만 ‘암호 힌트
                보기’에서 안내와 자료 위치를 확인하세요.
              </p>
            </li>
            <li>
              <b>여러 자료를 함께 보기</b>
              <p>
                창 위쪽 버튼으로 나란히 배치할 수 있습니다. 아래 ‘바탕화면’을
                누르면 열린 창을 잠시 내려놓고 다른 파일을 찾을 수 있어요.
              </p>
            </li>
          </ul>
          <p className="small muted">
            Tab으로 이동 · Enter 또는 Space로 열기 · Esc로 창 닫기
          </p>
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
                <div className="hint-context">
                  <h3>암호 안내</h3>
                  <p>{p.title}</p>
                </div>
                {!!p.evidenceIds?.length && (
                  <details className="hint-locations">
                    <summary>관련 자료 위치 보기</summary>
                    <p className="small muted">
                      자료를 선택하면 원본 파일을 엽니다.
                    </p>
                    {p.evidenceIds.map((id) => {
                      const source = files.find((f) => f.id === id);
                      return source && canOpen(c, state, id) ? (
                        <button
                          key={id}
                          className="file-row"
                          onClick={() => {
                            setHintId(null);
                            setReveal(false);
                            open(id);
                          }}
                        >
                          <Icon file={source} />
                          {source.title}
                        </button>
                      ) : null;
                    })}
                  </details>
                )}
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
