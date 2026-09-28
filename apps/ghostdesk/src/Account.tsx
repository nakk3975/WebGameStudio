import { UserMessage, userMessage } from "./feedback";
import { useEffect, useState, type ReactNode } from "react";
import { UserRound, LogIn } from "lucide-react";
import { Modal } from "./App";
export type User = { id: string; name: string; email: string };
export type Account = {
  user: User | null;
  ready: boolean;
  enabled: boolean;
  open: () => void;
  token: () => Promise<string>;
};
type Client = NonNullable<Awaited<typeof import("./auth")>["authClient"]>;
export function AccountProvider({
  children,
}: {
  children: (account: Account) => ReactNode;
}) {
  const [client, setClient] = useState<Client | null>(null),
    [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!import.meta.env.VITE_AUTH_URL),
    [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "reset" | "reset-code">(
    "login",
  );
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [connectionFailed, setConnectionFailed] = useState(false);
  const enabled = !!import.meta.env.VITE_AUTH_URL;
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    import("./auth")
      .then(async ({ authClient: c }) => {
        if (!c || !active) return;
        // Better Auth is a callable proxy; wrap it so React stores the client
        // instead of invoking it as a state updater.
        setClient(() => c);
        const r = await c.getSession();
        if (active)
          setUser(
            r.data?.user
              ? {
                  id: r.data.user.id,
                  name: r.data.user.name,
                  email: r.data.user.email,
                }
              : null,
          );
      })
      .catch(() => {
        if (active) {
          setConnectionFailed(true);
          setMessage("로그인 서버에 연결하지 못했습니다. 다시 시도해 주세요.");
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [enabled]);
  async function refresh() {
    if (!client)
      throw new UserMessage(
        "로그인 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.",
      );
    const r = await client.getSession({ query: { disableCookieCache: true } });
    if (r.error) throw new UserMessage("로그인 상태를 확인하지 못했습니다.");
    const u = r.data?.user;
    setUser(u ? { id: u.id, name: u.name, email: u.email } : null);
    return u;
  }
  useEffect(() => {
    if (!client) return;
    const update = () => {
      void refresh().catch(() => {});
    };
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, [client]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (mode === "reset") {
        const r = await client.forgetPassword.emailOtp({ email });
        if (r.error)
          throw new UserMessage(
            "코드 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          );
        setMode("reset-code");
        setMessage(
          "가입된 이메일이면 재설정 코드가 발송됩니다. 스팸함도 확인해 주세요.",
        );
        return;
      }
      if (mode === "reset-code") {
        const r = await client.emailOtp.resetPassword({ email, otp, password });
        if (r.error)
          throw new UserMessage("코드 또는 새 비밀번호를 확인해 주세요.");
        setMode("login");
        setPassword("");
        setMessage("비밀번호를 변경했습니다. 다시 로그인해 주세요.");
        return;
      }
      const r =
        mode === "signup"
          ? await client.signUp.email({
              email,
              password,
              name: "조사관",
            })
          : await client.signIn.email({ email, password });
      if (r.error)
        throw new UserMessage(
          mode === "signup"
            ? "가입 정보를 확인해 주세요. 이미 가입한 이메일이면 로그인하거나 비밀번호를 재설정하세요."
            : "이메일 또는 비밀번호를 확인해 주세요.",
        );
      const u = await refresh();
      if (!u)
        throw new UserMessage(
          "로그인을 유지하지 못했습니다. 브라우저의 사이트 저장 설정을 확인해 주세요.",
        );
      setOpen(false);
      setPassword("");
      setOtp("");
    } catch (e) {
      setMessage(
        userMessage(e, "연결하지 못했습니다. 잠시 후 다시 시도해 주세요."),
      );
    } finally {
      setBusy(false);
    }
  }
  const account: Account = {
    user,
    ready,
    enabled,
    open: () => {
      setMessage("");
      setOpen(true);
    },
    token: async () => {
      if (!client || !user) throw new UserMessage("로그인이 필요합니다.");
      const session = await client.getSession({
        query: { disableCookieCache: true },
      });
      if (session.data?.user.id !== user.id)
        throw new UserMessage("계정이 변경되었습니다. 홈을 새로고침해 주세요.");
      const r = await client.token();
      if (r.error || !r.data?.token)
        throw new UserMessage("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      return r.data.token;
    },
  };
  return (
    <>
      {children(account)}
      {open && (
        <Modal
          title={
            user
              ? "내 계정"
              : mode === "signup"
                ? "조사관 계정 만들기"
                : mode.startsWith("reset")
                  ? "비밀번호 재설정"
                  : "로그인"
          }
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          {user ? (
            <div className="account-form">
              <p>
                <b>{user.name}</b>
                <br />
                {user.email}
              </p>
              <p>
                같은 계정으로 로그인하면 폰과 컴퓨터에서 공식 사건의
                진행·단서·노트를 이어 볼 수 있습니다.
              </p>
              <p className="muted">
                기기를 바꾸기 전 ‘계정에 저장됨’을 확인하세요. 제작기 초안은 이
                기기에만 저장됩니다.
              </p>
              <button
                disabled={busy}
                onClick={async () => {
                  if (!client) return;
                  setBusy(true);
                  try {
                    const r = await client.signOut();
                    if (r.error) throw new UserMessage();
                    setUser(null);
                    setOpen(false);
                  } catch {
                    setMessage("로그아웃하지 못했습니다. 다시 시도해 주세요.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <form className="account-form" onSubmit={submit}>
              <p>
                {mode === "signup"
                  ? "이메일과 비밀번호만 입력하면 바로 시작할 수 있어요."
                  : "같은 계정으로 로그인하고 다른 기기에서도 이어 하세요."}
              </p>
              <label className="field">
                이메일
                <input
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              {mode === "reset-code" && (
                <label className="field">
                  이메일 인증 코드
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={10}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />
                </label>
              )}
              {mode !== "reset" && (
                <label className="field">
                  {mode === "reset-code" ? "새 비밀번호" : "비밀번호"}
                  <input
                    type="password"
                    minLength={mode === "login" ? 1 : 8}
                    maxLength={128}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {mode !== "login" && (
                    <small>비밀번호는 8자 이상으로 입력하세요.</small>
                  )}
                </label>
              )}
              {connectionFailed && !client && (
                <p role="alert">
                  로그인 연결을 준비하지 못했습니다. 사이트를 새로고침한 뒤 다시
                  시도해 주세요.
                </p>
              )}
              <button className="primary" disabled={busy || !client}>
                {busy
                  ? "처리 중…"
                  : mode === "signup"
                    ? "계정 만들기"
                    : mode === "reset"
                      ? "재설정 코드 받기"
                      : mode === "reset-code"
                        ? "비밀번호 변경"
                        : "로그인"}
              </button>
              <div className="account-links">
                <div className="account-switch">
                  {mode === "login" && <span>아직 계정이 없나요?</span>}
                  {mode === "signup" && <span>이미 계정이 있나요?</span>}
                  <button
                    className="account-text-button account-switch-button"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setMode(mode === "login" ? "signup" : "login");
                      setMessage("");
                      setPassword("");
                    }}
                  >
                    {mode === "login"
                      ? "회원가입"
                      : mode === "signup"
                        ? "로그인"
                        : "로그인으로 돌아가기"}
                  </button>
                </div>
                {mode === "login" && (
                  <button
                    className="account-text-button"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setMode("reset");
                      setMessage("");
                      setPassword("");
                    }}
                  >
                    비밀번호 찾기
                  </button>
                )}
              </div>
            </form>
          )}
          {message && (
            <p role="alert" className="account-message">
              {message}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
export function AccountButton({ account }: { account: Account }) {
  if (!account.enabled) return null;
  return (
    <button
      className="account-button"
      onClick={account.open}
      disabled={!account.ready}
    >
      {account.user ? <UserRound size={17} /> : <LogIn size={17} />}
      <span>
        {!account.ready
          ? "계정 확인 중"
          : account.user
            ? "내 계정"
            : "로그인 / 회원가입"}
      </span>
    </button>
  );
}
