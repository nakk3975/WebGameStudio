import { userMessage } from "./feedback";
import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { caseLibrary, caseEntry, isOfficialCaseVersion } from "./cases";
import { investigationStatus } from "./presentation";
import {
  read,
  write,
  writePlay,
  parseSave,
  download,
  importJson,
  type Save,
} from "./storage";
import Player from "./Player";
import { AccountProvider, AccountButton, type Account } from "./Account";
import { CloudSaves, cloudTransport } from "./cloud";
const Studio = lazy(() => import("./Studio"));
import { loadPublishedCase } from "./catalog";
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
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
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        {onClose && (
          <button onClick={onClose} aria-label="대화상자 닫기">
            ×
          </button>
        )}
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
  return (
    <AccountProvider>
      {(account) => (
        <Workspace key={account.user?.id || "guest"} account={account} />
      )}
    </AccountProvider>
  );
}
function Workspace({ account }: { account: Account }) {
  const [view, setView] = useState<"home" | "play" | "studio">("home"),
    [saves, setSaves] = useState<Record<string, Save>>({}),
    [selectedCaseId, setSelectedCaseId] = useState(caseLibrary[0].case.caseId),
    [importedCase, setImportedCase] = useState<CasePackage | null>(null),
    [active, setActive] = useState<Save | null>(null),
    [test, setTest] = useState(false),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState(""),
    [settings, setSettings] = useState(false),
    [settingsSave, setSettingsSave] = useState<Save | null>(null),
    [font, setFont] = useState(1),
    [motion, setMotion] = useState(false),
    [restart, setRestart] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const [remotePackages, setRemotePackages] = useState<
    Record<string, CasePackage>
  >({});
  const customCases = new Map(
    Object.values(saves)
      .filter((s) => !caseLibrary.some((e) => e.case.caseId === s.case.caseId))
      .map((s) => [s.case.caseId, s.case]),
  );
  if (
    importedCase &&
    !caseLibrary.some((e) => e.case.caseId === importedCase.caseId)
  )
    customCases.set(importedCase.caseId, importedCase);
  const entries = [
    ...caseLibrary,
    ...Array.from(customCases.values(), caseEntry),
  ];
  const selectedEntry =
    entries.find((entry) => entry.case.caseId === selectedCaseId) || entries[0];
  const chosen =
    remotePackages[selectedEntry.case.caseId] || selectedEntry.case;
  const saved = saves[chosen.caseId] || null;
  const status = investigationStatus(saved);
  const archiveKey = `previous-investigation:${account.user?.id || "guest"}:${chosen.caseId}`;
  const [archived, setArchived] = useState<Save | null>(null);
  useEffect(() => {
    let current = true;
    setArchived(null);
    read<Save>(archiveKey)
      .then((s) => {
        if (current && s) setArchived(parseSave(s));
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [archiveKey]);
  async function restartInvestigation() {
    try {
      if (saved) {
        await write(archiveKey, saved);
        setArchived(saved);
      }
      start();
    } catch {
      setNotice(
        "기존 조사를 보관하지 못해 새 조사를 시작하지 않았어요. 다시 시도해 주세요.",
      );
    }
  }
  const [cloudStatus, setCloudStatus] = useState("");
  const [cloud, setCloud] = useState<CloudSaves | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const accountRef = useRef(account);
  accountRef.current = account;
  useEffect(() => {
    if (!account.user) return;
    const c = new CloudSaves(
      account.user.id,
      cloudTransport(
        import.meta.env.VITE_API_BASE_URL || "",
        account.user.id,
        () => accountRef.current.token(),
      ),
      () => {
        setSaves(c.saves());
        setCloudStatus(c.status);
      },
    );
    setCloud(c);
    void c.initialize().finally(() => setReady(true));
    return () => c.close();
  }, [account.user?.id]);
  useEffect(() => {
    if (cloud) cloud.playing = view === "play";
    if (!cloud || view !== "home") return;
    const refresh = () => {
      void cloud.refresh();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [cloud, view]);
  async function syncNow() {
    if (!cloud || syncBusy) return;
    setSyncBusy(true);
    try {
      await cloud.refresh();
    } finally {
      setSyncBusy(false);
    }
  }
  async function importGuest() {
    if (!cloud || syncBusy) return;
    setSyncBusy(true);
    try {
      const keys = ["play", ...caseLibrary.map((e) => "play:" + e.case.caseId)];
      const records: Record<string, Save> = Object.create(null);
      for (const key of keys) {
        const raw = await read<unknown>(key);
        if (raw) {
          const s = parseSave(raw);
          records[s.case.caseId] = s;
        }
      }
      let count = 0;
      for (const s of Object.values(records))
        if (!cloud.records[s.case.caseId]) {
          await cloud.persist(s);
          count++;
        }
      await cloud.flush();
      setNotice(
        `${count}개 사건의 비회원 진행을 가져왔습니다. 계정에 이미 있는 사건은 유지했습니다.`,
      );
    } catch {
      setNotice("진행을 가져오지 못했습니다. 비회원 저장은 그대로 유지됩니다.");
    } finally {
      setSyncBusy(false);
    }
  }
  const persistSave = (s: Save) =>
    cloud
      ? cloud.persist(s)
      : account.user
        ? Promise.reject(Error("계정 저장을 준비 중입니다."))
        : writePlay(s);
  function remember(s: Save) {
    setSaves((previous) => ({ ...previous, [s.case.caseId]: s }));
    if (!caseLibrary.some((entry) => entry.case.caseId === s.case.caseId))
      setImportedCase(s.case);
  }
  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL;
    if (
      !base ||
      !caseLibrary.some((entry) => entry.case.caseId === chosen.caseId)
    )
      return;
    const controller = new AbortController();
    loadPublishedCase(base, chosen.versionId, controller.signal)
      .then((c) =>
        setRemotePackages((previous) => ({ ...previous, [c.caseId]: c })),
      )
      .catch(() => {
        /* Every shipped case also works from its offline package. */
      });
    return () => controller.abort();
  }, [chosen.versionId]);
  useEffect(() => {
    if (account.user) return;
    const keys = [
      "play",
      ...caseLibrary.map((entry) => "play:" + entry.case.caseId),
    ];
    Promise.allSettled(
      keys.map(async (key) => {
        const raw = await read<unknown>(key);
        return raw ? parseSave(raw) : null;
      }),
    )
      .then((results) => {
        const restored: Record<string, Save> = Object.create(null);
        for (const result of results) {
          if (result.status === "fulfilled" && result.value)
            restored[result.value.case.caseId] = result.value;
        }
        setSaves(restored);
        const recent = results[0];
        if (recent.status === "fulfilled" && recent.value) {
          setSelectedCaseId(recent.value.case.caseId);
          if (
            !caseLibrary.some(
              (entry) => entry.case.caseId === recent.value!.case.caseId,
            )
          )
            setImportedCase(recent.value.case);
        }
        if (results.some((result) => result.status === "rejected"))
          setNotice(
            "일부 저장을 읽지 못했습니다. 다른 사건은 계속 플레이하거나 저장해 둔 진행 파일을 가져올 수 있습니다.",
          );
      })
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    read<{ font: number; motion: boolean }>("settings")
      .then((x) => {
        if (x) {
          setFont(Math.max(1, Math.min(1.4, x.font || 1)));
          setMotion(!!x.motion);
        }
      })
      .catch(() => {});
  }, []);
  function start(c = chosen, isTest = false) {
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
      {(view === "studio" || (view === "play" && test)) && (
        <div hidden={view !== "studio"}>
          <Suspense
            fallback={
              <div className="loading">사건 제작소를 여는 중입니다.</div>
            }
          >
            <Studio onHome={goHome} onTest={(c) => start(c, true)} />
          </Suspense>
        </div>
      )}
      {view === "play" && active ? (
        <Player
          initial={active}
          isTest={test}
          onExit={() => {
            if (test) setView("studio");
            else goHome();
          }}
          onSaved={(s) => {
            if (!test) remember(s);
          }}
          persistSave={persistSave}
          cloudStatus={
            test
              ? undefined
              : account.user && !isOfficialCaseVersion(active.case)
                ? "직접 만든 사건 · 이 기기에 저장됨"
                : cloudStatus
          }
          onSettings={(snapshot) => {
            setSettingsSave(snapshot);
            setSettings(true);
          }}
        />
      ) : view === "home" ? (
        <>
          <header className="topbar">
            <Brand />
            <nav>
              <span className="pill">직접 푸는 미스터리</span>
              <AccountButton account={account} />
              <button
                className="icon-button"
                onClick={() => {
                  setSettingsSave(saved);
                  setSettings(true);
                }}
                aria-label="설정"
              >
                <Settings size={19} />
              </button>
            </nav>
          </header>
          <main className="launch">
            {account.enabled && (
              <section className="account-strip" aria-label="진행 저장">
                <div>
                  <b>
                    {account.user
                      ? `${account.user.name}의 조사 기록`
                      : "비회원 · 이 브라우저에 자동 저장"}
                  </b>
                  <p role="status">
                    {account.user
                      ? cloudStatus || "계정 저장 준비 중"
                      : "로그인하면 폰과 컴퓨터에서 이어 할 수 있어요."}
                  </p>
                </div>
                {account.user ? (
                  <div className="button-row">
                    <button disabled={!ready || syncBusy} onClick={syncNow}>
                      {syncBusy ? "동기화 중…" : "계정 저장 새로고침"}
                    </button>
                    <button disabled={!ready || syncBusy} onClick={importGuest}>
                      비회원 진행 가져오기
                    </button>
                  </div>
                ) : (
                  <AccountButton account={account} />
                )}
              </section>
            )}
            {cloud &&
              Object.entries(cloud.records)
                .filter(([, r]) => r.conflict !== undefined)
                .map(([id, r]) => (
                  <section key={id} className="save-conflict" role="alert">
                    <b>{r.save.case.title} · 다른 기기의 진행이 있습니다</b>
                    <p>
                      자동 덮어쓰기를 멈췄습니다. 이어갈 기록을 선택하세요. 선택
                      전 두 기록을 이 기기에 백업합니다.
                    </p>
                    <p>
                      이 기기 단서 {r.save.state.clueIds.length}개 · 계정 단서{" "}
                      {r.conflict?.save.state.clueIds.length ?? 0}개
                    </p>
                    <div className="button-row">
                      <button
                        disabled={syncBusy || !r.conflict}
                        onClick={async () => {
                          setSyncBusy(true);
                          try {
                            await cloud.resolve(id, "cloud");
                          } catch {
                            setNotice(
                              "기록 선택에 실패했습니다. 다시 시도해 주세요.",
                            );
                          } finally {
                            setSyncBusy(false);
                          }
                        }}
                      >
                        계정 기록으로 이어가기
                      </button>
                      <button
                        disabled={syncBusy}
                        onClick={async () => {
                          setSyncBusy(true);
                          try {
                            await cloud.resolve(id, "device");
                          } catch {
                            setNotice(
                              "기록 선택에 실패했습니다. 다시 시도해 주세요.",
                            );
                          } finally {
                            setSyncBusy(false);
                          }
                        }}
                      >
                        이 기기 기록을 계정에 저장
                      </button>
                      <button
                        onClick={() =>
                          download("ghostdesk-device-backup.gdsave", r.save)
                        }
                      >
                        이 기기 기록 파일 저장
                      </button>
                    </div>
                  </section>
                ))}
            <section className="case-library" aria-label="사건 선택">
              <div className="library-heading">
                <div>
                  <span className="section-kicker">사건 기록</span>
                  <h2>어떤 기록부터 열어볼까요?</h2>
                </div>
                <span className="library-count">{entries.length}개의 사건</span>
              </div>
              <div className="case-cards">
                {entries.map((entry) => {
                  const progress = saves[entry.case.caseId];
                  return (
                    <button
                      key={entry.case.caseId}
                      className={
                        "case-card " +
                        (entry.case.caseId === chosen.caseId
                          ? "selected-case"
                          : "")
                      }
                      aria-label={
                        "사건 " + entry.number + " " + entry.case.title
                      }
                      aria-pressed={entry.case.caseId === chosen.caseId}
                      onClick={() => setSelectedCaseId(entry.case.caseId)}
                    >
                      <span className="case-card-top">
                        <span>{entry.number}</span>
                        <span>
                          {progress
                            ? investigationStatus(progress)
                            : entry.difficulty}
                        </span>
                      </span>
                      <b>{entry.case.title}</b>
                      <small>
                        {entry.theme} · 약 {entry.case.estimatedMinutes}분
                      </small>
                    </button>
                  );
                })}
              </div>
            </section>
            <div className="case-intro">
              <div className="eyebrow">
                <span className="square" /> 사건 {selectedEntry.number} ·{" "}
                {selectedEntry.theme}
              </div>
              <h1>
                {chosen.title}
                <span className="title-dot">.</span>
              </h1>
              <p>{chosen.description}</p>
              <div className="case-meta">
                <span>
                  <Clock3 size={16} /> 약 {chosen.estimatedMinutes}분
                </span>
                <span>
                  <FileCheck2 size={16} /> {selectedEntry.difficulty} ·{" "}
                  {chosen.puzzles.length}단계
                </span>
              </div>
              <div className="launch-actions">
                <button
                  className={saved ? "secondary" : "primary"}
                  disabled={!ready || !account.ready}
                  onClick={() => (saved ? setRestart(true) : start())}
                >
                  <Play size={18} /> {saved ? "새 조사 시작" : "사건 조사 시작"}
                  <ArrowUpRight size={18} />
                </button>
                {saved && (
                  <button
                    className="primary"
                    disabled={!ready || !account.ready}
                    onClick={() => {
                      // Memory snapshots can still be RUNNING (for example after
                      // an error exit). Every continuation uses the restore boundary.
                      setActive(parseSave(saved));
                      setTest(false);
                      setView("play");
                    }}
                  >
                    {status === "조사 완료" ? "결과 보기" : "이어서 조사"}
                  </button>
                )}
              </div>
              {saved && (
                <div className="resume-summary">
                  <FileCheck2 size={16} />
                  <span>
                    {status} · 단서 {saved.state.clueIds.length}/
                    {saved.case.clues.length}
                  </span>
                </div>
              )}
              {saved && saved.case.versionId !== chosen.versionId && (
                <p className="edition-notice">
                  현재 저장은 {saved.case.puzzles.length}단계 사건입니다.
                  ‘이어서 조사’는 기존 기록을 그대로 엽니다. 추가 이야기와
                  자료가 있는
                  {chosen.puzzles.length}단계 확장판은 ‘새 조사 시작’에서 만날
                  수 있어요.
                </p>
              )}
              {archived && (
                <button
                  className="quiet"
                  onClick={() =>
                    download(
                      "ghostdesk-previous-investigation.gdsave",
                      archived,
                    )
                  }
                >
                  이 기기의 이전 조사 파일 저장
                </button>
              )}
              <p className="small muted">
                이곳은 가상의 컴퓨터입니다. 실제 파일에는 접근하지 않습니다.
              </p>
            </div>
            <div className="case-visual" aria-label="사건 기록 미리보기">
              <div className="visual-top">
                <span>사건 기록 / {selectedEntry.location}</span>
                <span className="file-status">{status}</span>
              </div>
              <div
                className={
                  "big-clock" +
                  (selectedEntry.display.length > 5 ? " word-clock" : "")
                }
              >
                {selectedEntry.display}
              </div>
              <p className="preview-caption">{selectedEntry.caption}</p>
              <div className="log-preview">
                <span className="amber">{selectedEntry.previewKey}</span>
                <span>CASE {selectedEntry.number}</span>
                <div>
                  화면 표시 <b>{selectedEntry.previewValue}</b>
                </div>
                <div>
                  확인 상태 <b>{status}</b>
                </div>
              </div>
              <div className="visual-bottom">
                <LockKeyhole size={16} />
                <span>
                  {status === "조사 완료"
                    ? "기록을 대조하고 조사를 마쳤습니다."
                    : status === "재조사 필요"
                      ? "기록을 다시 살펴볼 수 있습니다."
                      : "기록은 남았다. 진실은 아직."}
                </span>
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
              <button
                className="import-link"
                disabled={!ready || !account.ready}
                onClick={() => file.current?.click()}
              >
                <Upload size={22} />
                <span>
                  <b>저장 파일 가져오기</b>
                  <small>내보낸 진행으로 조사를 이어가세요</small>
                </span>
                <ArrowUpRight size={20} />
              </button>
            </footer>
          </main>
        </>
      ) : null}
      <input
        hidden
        ref={file}
        type="file"
        accept=".gdsave,.json,application/json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const s = parseSave(await importJson(f));
            await persistSave(s);
            remember(s);
            setSelectedCaseId(s.case.caseId);
            setActive(s);
            setTest(false);
            setView("play");
          } catch (err) {
            setNotice(
              userMessage(
                err,
                "진행을 가져오지 못했습니다. 기존 기록은 유지됩니다. 잠시 후 다시 시도해 주세요.",
              ),
            );
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
            이 사건을 첫 단계부터 다시 시작합니다. 기존 진행은 이 기기에 별도로
            보관하며, 홈에서 이전 조사 파일로 저장해 다시 불러올 수 있어요.
            계정에는 새 조사가 저장됩니다.
          </p>
          <div className="button-row">
            <button
              onClick={() =>
                saved && download("ghostdesk-progress.gdsave", saved)
              }
            >
              <Download size={16} /> 기존 진행 파일 저장
            </button>
            <button className="primary" onClick={restartInvestigation}>
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
            {account.user
              ? "공식 사건의 진행은 계정에 자동 저장됩니다. 다른 기기로 옮기기 전 ‘계정에 저장됨’을 확인해 주세요. 직접 만든 사건과 제작 중인 초안은 이 기기에만 저장됩니다."
              : "진행은 현재 브라우저에 자동 저장됩니다. 다른 기기에서도 이어 하려면 로그인하거나 진행 파일을 저장해 옮겨 주세요."}
          </p>
          <p className="muted">현재는 효과음이 없습니다.</p>
          {settingsSave && (
            <button
              onClick={() =>
                download("ghostdesk-progress.gdsave", settingsSave)
              }
            >
              <Download size={16} /> 진행 파일 저장
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}
