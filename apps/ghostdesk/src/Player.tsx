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
  type Event,
  type State,
} from "../../../packages/engine-ghostdesk/src";
import { write, download, type Save } from "./storage";
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
export default function Player({
  initial,
  isTest,
  onExit,
  onSaved,
  onSettings,
}: {
  initial: Save;
  isTest: boolean;
  onExit: () => void;
  onSaved: (s: Save) => void;
  onSettings: () => void;
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
    [endVisible, setEndVisible] = useState(state.mode === "ENDED");
  const area = useRef<HTMLDivElement>(null),
    latest = useRef<Save>(initial),
    writeQueue = useRef(Promise.resolve()),
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
  function persist(s: Save) {
    if (isTest || s.state.mode === "ERROR") return;
    setSaveStatus("저장 중");
    writeQueue.current = writeQueue.current
      .catch(() => {})
      .then(() => write("play", s))
      .then(() => {
        setSaveStatus("이 기기에 저장됨");
        onSaved(s);
      })
      .catch(() => setSaveStatus("저장 실패 · 진행을 내보내세요"));
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
      send({ type: "OPEN_FILE", id });
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
      { board: "증거 보드", conclusion: "결론 작성" }[id] ||
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
        <span>{f.title}</span>
        {state.readFileIds.includes(f.id) && (
          <Check className="read-check" size={13} />
        )}
      </button>
    );
  }
  function content(id: string) {
    if (id === "board")
      return (
        <div className="board-content">
          <div className="section-kicker">
            COLLECTED EVIDENCE / {state.clueIds.length}
          </div>
          <h2>기록을 연결해 보세요.</h2>
          <p className="muted">파일을 읽으면 단서가 자동으로 모입니다.</p>
          <div className="clue-grid">
            {c.clues
              .filter((x) => state.clueIds.includes(x.id))
              .map((cl, i) => (
                <article className="clue-card" key={cl.id}>
                  <span className="clue-number">
                    E-{String(i + 1).padStart(2, "0")}
                  </span>
                  <h3>{cl.title}</h3>
                  <p>{cl.description}</p>
                  <button
                    className="quiet"
                    onClick={() => {
                      const f = c.files.find((f) => f.clueId === cl.id);
                      if (f) open(f.id);
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
              바탕화면의 인수인계 메모부터 열어보세요.
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
    if (id === "conclusion")
      return (
        <div className="conclusion-content">
          <div className="section-kicker">FINAL DEDUCTION</div>
          <h2>그날, 무슨 일이 있었을까?</h2>
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
                {cl.title}
              </label>
            ))}
          {!state.clueIds.length && (
            <p className="muted">아직 수집한 증거가 없습니다.</p>
          )}
          <button
            className="primary"
            disabled={!hypothesis || state.mode !== "RUNNING"}
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
    if (f.puzzleId && !state.solvedPuzzleIds.includes(f.puzzleId)) {
      const p = c.puzzles.find((p) => p.id === f.puzzleId)!;
      return (
        <div className="vault">
          <div className="vault-lock">
            <LockKeyhole size={32} />
          </div>
          <div className="section-kicker">PROTECTED ARCHIVE</div>
          <h2>보관함이 잠겨 있습니다.</h2>
          <p>
            마지막 전송 요청의 <b>실제 시각</b>을 입력하세요.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const answer = new FormData(e.currentTarget).get(
                "answer",
              ) as string;
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
          >
            <label className="field">
              암호
              <input
                name="answer"
                aria-label="보관함 암호"
                maxLength={100}
                autoComplete="off"
                placeholder="HHMM"
                className="code-input"
              />
            </label>
            <button className="primary" type="submit">
              보관함 열기 <ChevronRight size={17} />
            </button>
          </form>
          <p className="small muted">
            앞뒤 공백 제거 · NFC 정규화 ·{" "}
            {p.ignoreCase ? "대소문자 무시" : "대소문자 구분"}
            <br />
            시도 {state.attempts[p.id] || 0}회 · 횟수 제한 없음
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
            TERMINAL 04 <ChevronRight size={14} />
            {f.title}
          </div>
          {f.text && <p className="muted">{f.text}</p>}
          {c.files
            .filter(
              (x) => x.parentId === id && state.visibleFileIds.includes(x.id),
            )
            .map((x) => fileButton(x))}
          {!c.files.some(
            (x) => x.parentId === id && state.visibleFileIds.includes(x.id),
          ) && <p className="empty">표시할 파일이 없습니다.</p>}
        </div>
      );
    if (f.type === "CHAT_LINK")
      return (
        <div className="chat-content">
          <div className="chat-person">
            <div className="avatar">M</div>
            <div>
              <b>민재</b>
              <span>야간 연구팀</span>
            </div>
            <button
              className="quiet"
              onClick={() => send({ type: "READ_MESSAGES" })}
            >
              모두 읽음
            </button>
          </div>
          <div className="chat-date">사건 당일 · 새벽</div>
          {c.messages
            .filter((m) => state.deliveredMessageIds.includes(m.id))
            .map((m) => (
              <div className="message" key={m.id}>
                <span className="message-author">
                  {m.author} <small>{m.time}</small>
                  {!state.readMessageIds.includes(m.id) && (
                    <b className="new-label">새 메시지</b>
                  )}
                </span>
                <p>{m.text}</p>
              </div>
            ))}
          <p className="chat-note">
            기록된 대화입니다. 메시지를 직접 전송할 수 없습니다.
          </p>
        </div>
      );
    if (f.type === "IMAGE")
      return (
        <div className="image-content">
          <div className="clock-evidence" role="img" aria-label={f.alt}>
            <div>
              <span>벽시계</span>
              <strong>03:10</strong>
              <small>WALL CLOCK</small>
            </div>
            <div>
              <span>기록용 PC</span>
              <strong>03:17</strong>
              <small>TERMINAL 04</small>
            </div>
          </div>
          <p>{f.text}</p>
          <details open>
            <summary>이미지 대체 설명</summary>
            <p>{f.alt}</p>
          </details>
        </div>
      );
    return (
      <article
        className={"document " + (f.id === "f-queue" ? "log-document" : "")}
      >
        <div className="document-meta">
          <span>{f.id === "f-queue" ? "SYSTEM LOG" : "TEXT DOCUMENT"}</span>
          <span>읽기 전용</span>
        </div>
        <pre>{f.text}</pre>
        {f.clueId && (
          <div className="evidence-found">
            <Check size={16} /> 단서가 증거 보드에 기록되었습니다.
          </div>
        )}
      </article>
    );
  }
  return (
    <div className="player">
      <header className="topbar">
        <button
          className="brand-button"
          onClick={() => {
            persist(latest.current);
            onExit();
          }}
          aria-label={isTest ? "제작기로 돌아가기" : "홈으로"}
        >
          <Brand />
        </button>
        <div className="player-case">
          <span className="case-tag">
            {isTest ? "TEST SNAPSHOT" : "CASE 001"}
          </span>
          <b>{c.title}</b>
        </div>
        <nav>
          <span className="save-state" role="status">
            {saveStatus}
          </span>
          <button
            className="icon-button"
            onClick={() => download("ghostdesk-save.json", latest.current)}
            aria-label="진행 내보내기"
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
            onClick={onSettings}
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
      <div className="desktop-layout">
        <aside className="desktop-files">
          {c.files
            .filter((f) => !f.parentId && state.visibleFileIds.includes(f.id))
            .map((f) => fileButton(f, true))}
        </aside>
        <main className="desktop-area" ref={area}>
          <div className="desktop-watermark">
            <span>ARCHIVE / TERMINAL 04</span>
            <strong>03:17</strong>
            <p>모든 기록에는, 빈틈이 있다.</p>
          </div>
          {!wins.length && (
            <div className="desktop-welcome">
              <BookOpen size={24} />
              <h2>남겨진 기록에서 시작하세요.</h2>
              <p>인수인계 메모를 읽고 서로 다른 기록을 대조하세요.</p>
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
          <div className="section-kicker">INVESTIGATION</div>
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
                <button key={cl.id} onClick={() => open("board")}>
                  <Check size={14} />
                  {cl.title}
                </button>
              ))}
            {!state.clueIds.length && <p>아직 단서를 발견하지 못했습니다.</p>}
          </div>
          <button className="secondary" onClick={() => open("board")}>
            <Network size={17} /> 증거 보드
          </button>
          <div className="investigation-bottom">
            <span className="section-kicker">YOUR DEDUCTION</span>
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
                  : open("conclusion")
              }
            >
              <ClipboardCheck size={17} />
              {state.mode === "ENDED" ? "결론 다시 보기" : "결론 작성"}
            </button>
            <button
              className="quiet"
              onClick={() => setHintId(c.puzzles[0]?.id || null)}
            >
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
          onClick={() => open("board")}
          aria-label="증거 보드"
        >
          <Network size={18} />
        </button>
        <button
          className="mobile-board"
          onClick={() => open("conclusion")}
          aria-label="결론 작성"
        >
          <ClipboardCheck size={18} />
        </button>
        <button
          className="message-task"
          onClick={() => {
            const f = c.files.find((x) => x.type === "CHAT_LINK");
            if (f) open(f.id);
          }}
        >
          <MessageSquare size={17} />
          {unread > 0 && <b>{unread}</b>}
        </button>
        <span className="task-clock">
          03:17 <small>사건 속 PC 시각</small>
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
          <p>{state.diagnostic}</p>
          <p>
            이번 행동 전 상태로 되돌렸으며, 직전 정상 저장은 덮어쓰지
            않았습니다.
          </p>
          <button
            onClick={() =>
              download("ghostdesk-diagnostic.json", {
                code: state.diagnostic,
                eventSeq: state.eventSeq,
                versionId: c.versionId,
              })
            }
          >
            진단 내보내기
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
            const n = state.hintLevels[p.id] || 0;
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
                ? "REOPEN THE CASE"
                : "CASE CLOSED"}
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
              onClick={() => download("ghostdesk-save.json", latest.current)}
            >
              <Download size={16} /> 진행 내보내기
            </button>
            <button
              onClick={() => {
                persist(latest.current);
                onExit();
              }}
            >
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
