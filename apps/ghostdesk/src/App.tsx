import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Ghost,
  ArrowUpRight,
  FolderPlus,
  Settings,
  ArrowLeft,
  Upload,
  Download,
  Play,
  FileCheck2,
  Clock3,
  LockKeyhole,
} from "lucide-react";
import { type CasePackage } from "../../../packages/contracts/src";
import {
  initialState,
  type State,
} from "../../../packages/engine-ghostdesk/src";
import { sample } from "./sample";
import {
  read,
  write,
  parseSave,
  download,
  importJson,
  type Save,
} from "./storage";
import Player from "./Player";
import Studio from "./Studio";
import { loadPublishedCase } from "./catalog";
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="대화상자 닫기">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <Ghost size={24} />
      <b>
        GHOST<span>DESK</span>
      </b>
    </span>
  );
}
export default function App() {
  const [view, setView] = useState<"home" | "play" | "studio">("home"),
    [saved, setSaved] = useState<Save | null>(null),
    [active, setActive] = useState<Save | null>(null),
    [test, setTest] = useState(false),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState(""),
    [settings, setSettings] = useState(false),
    [font, setFont] = useState(1),
    [motion, setMotion] = useState(false),
    [restart, setRestart] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const [publishedCase, setPublishedCase] = useState(sample);
  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL;
    if (!base) return;
    const controller = new AbortController();
    loadPublishedCase(base, sample.versionId, controller.signal)
      .then(setPublishedCase)
      .catch(() => {
        /* The bundled case remains immediately playable offline. */
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    read<unknown>("play")
      .then((x) => {
        if (x) setSaved(parseSave(x));
      })
      .catch(() =>
        setNotice(
          "이 기기의 저장을 읽지 못했습니다. 내보낸 JSON을 가져오거나 새 조사를 시작할 수 있습니다.",
        ),
      )
      .finally(() => setReady(true));
    read<{ font: number; motion: boolean }>("settings")
      .then((x) => {
        if (x) {
          setFont(Math.max(1, Math.min(1.4, x.font || 1)));
          setMotion(!!x.motion);
        }
      })
      .catch(() => {});
  }, []);
  function start(c = publishedCase, isTest = false) {
    setActive({
      format: "ghostdesk-save-1",
      case: structuredClone(c),
      state: initialState(c),
      notes: "",
      checkpoint: null,
    });
    setTest(isTest);
    setView("play");
    setRestart(false);
  }
  const goHome = () => {
    setView("home");
    window.location.hash = "";
  };
  useEffect(() => {
    window.location.hash =
      view === "home"
        ? ""
        : view === "studio"
          ? "/studio"
          : "/play/" + active?.case.versionId;
  }, [view, active?.case.versionId]);
  return (
    <div
      className={motion ? "app reduce-motion" : "app"}
      style={{ fontSize: `${font}rem` }}
    >
      {view === "play" && active ? (
        <Player
          initial={active}
          isTest={test}
          onExit={() => {
            if (test) setView("studio");
            else goHome();
          }}
          onSaved={(s) => {
            if (!test) setSaved(s);
          }}
          onSettings={() => setSettings(true)}
        />
      ) : view === "studio" ? (
        <Studio onHome={goHome} onTest={(c) => start(c, true)} />
      ) : (
        <>
          <header className="topbar">
            <Brand />
            <nav>
              <span className="pill">GHOSTDESK · 0.2</span>
              <button
                className="icon-button"
                onClick={() => setSettings(true)}
                aria-label="설정"
              >
                <Settings size={19} />
              </button>
            </nav>
          </header>
          <main className="launch">
            <div className="case-intro">
              <div className="eyebrow">
                <span className="square" /> CASE FILE / 001
              </div>
              <h1>
                03:17에
                <br />
                멈춘 전송<span className="title-dot">.</span>
              </h1>
              <p>
                사라진 기록 담당자.
                <br />
                남겨진 컴퓨터. 그리고 전송 기록 한 줄.
                <br />
                당신은 무엇을 믿을 것인가.
              </p>
              <div className="case-meta">
                <span>
                  <Clock3 size={16} /> 약 10–15분
                </span>
                <span>
                  <FileCheck2 size={16} /> 추리 · 기록 대조
                </span>
              </div>
              <div className="launch-actions">
                <button
                  className="primary"
                  disabled={!ready}
                  onClick={() => (saved ? setRestart(true) : start())}
                >
                  <Play size={18} /> {saved ? "새 조사 시작" : "사건 조사 시작"}
                  <ArrowUpRight size={18} />
                </button>
                {saved && (
                  <button
                    className="secondary"
                    onClick={() => {
                      setActive(saved);
                      setTest(false);
                      setView("play");
                    }}
                  >
                    이어서 조사
                  </button>
                )}
              </div>
              <p className="small muted">
                이곳은 가상의 컴퓨터입니다. 실제 파일에는 접근하지 않습니다.
              </p>
            </div>
            <div className="case-visual" aria-label="사건 기록 미리보기">
              <div className="visual-top">
                <span>RESEARCH ARCHIVE</span>
                <span>TERMINAL 04</span>
              </div>
              <div className="big-clock">
                03<span>:</span>17
              </div>
              <div className="signal-lines">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="log-preview">
                <span className="amber">SEND_REQUEST</span>
                <span>TX-0917</span>
                <div>
                  상태 <b>QUEUED</b>
                </div>
                <div>
                  완료 시각 <b>—</b>
                </div>
              </div>
              <div className="visual-bottom">
                <LockKeyhole size={16} />
                <span>기록은 남았다. 진실은 아직.</span>
              </div>
            </div>
            <footer className="launch-footer">
              <button className="studio-link" onClick={() => setView("studio")}>
                <FolderPlus size={22} />
                <span>
                  <b>사건 제작소</b>
                  <small>샘플을 편집하고 나만의 사건을 만드세요</small>
                </span>
                <ArrowUpRight size={20} />
              </button>
              <button className="quiet" onClick={() => file.current?.click()}>
                <Upload size={16} /> 저장 파일 가져오기
              </button>
            </footer>
          </main>
        </>
      )}
      <input
        hidden
        ref={file}
        type="file"
        accept=".json,application/json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const s = parseSave(await importJson(f));
            await write("play", s);
            setSaved(s);
            setActive(s);
            setTest(false);
            setView("play");
          } catch (err) {
            setNotice(err instanceof Error ? err.message : "가져오기 실패");
          }
        }}
      />
      {notice && (
        <div className="global-notice" role="alert">
          {notice}
          <button onClick={() => setNotice("")}>닫기</button>
        </div>
      )}
      {restart && (
        <Modal title="새 조사를 시작할까요?" onClose={() => setRestart(false)}>
          <p>
            현재 진행 슬롯이 새 조사로 바뀝니다. 이어서 조사하거나 기존 진행을
            먼저 내보낼 수 있습니다.
          </p>
          <div className="button-row">
            <button
              onClick={() => saved && download("ghostdesk-save.json", saved)}
            >
              <Download size={16} /> 기존 진행 내보내기
            </button>
            <button className="primary" onClick={() => start()}>
              새 조사 시작
            </button>
          </div>
        </Modal>
      )}
      {settings && (
        <Modal title="설정" onClose={() => setSettings(false)}>
          <label className="field">
            글자 크기
            <select
              value={font}
              onChange={(e) => {
                const f = Number(e.target.value);
                setFont(f);
                write("settings", { font: f, motion }).catch(() =>
                  setNotice("설정을 저장하지 못했습니다."),
                );
              }}
            >
              <option value="1">기본</option>
              <option value="1.15">크게</option>
              <option value="1.3">아주 크게</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={motion}
              onChange={(e) => {
                setMotion(e.target.checked);
                write("settings", { font, motion: e.target.checked }).catch(
                  () => setNotice("설정을 저장하지 못했습니다."),
                );
              }}
            />
            모션 줄이기
          </label>
          <hr />
          <h3>키보드 조작</h3>
          <p>
            Tab으로 이동 · Enter로 파일 열기
            <br />
            Esc로 현재 창 닫기 · 제목 표시줄의 버튼으로 창 배치
          </p>
          <p className="muted">
            진행은 이 브라우저에 저장됩니다. 다른 기기로 옮기기 전 진행 JSON을
            내보내세요. 현재 버전은 효과음이 없습니다.
          </p>
          {saved && (
            <button onClick={() => download("ghostdesk-save.json", saved)}>
              <Download size={16} /> 진행 내보내기
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}
