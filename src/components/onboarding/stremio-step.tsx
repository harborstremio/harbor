import { Check, ChevronLeft, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import stremioLogo from "@/assets/stremio-wordmark.png";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";

const STREMIO_REGISTER = "https://www.stremio.com/register";

/* Same form as tmdb-step.tsx, and for the same reason: a button that calls
   openUrl is a programmatic navigation, and where that is not credited as a
   user gesture the tap can take over the current tab instead of opening one.
   A real anchor cannot do that. The Tauri branch keeps the desktop app handing
   the url to the OS browser rather than a webview tab. */
function openRegister(e: React.MouseEvent) {
  if (!("__TAURI_INTERNALS__" in window)) return;
  e.preventDefault();
  openUrl(STREMIO_REGISTER);
}

export function StremioStep() {
  const { user, signIn } = useAuth();
  const t = useT();
  const [mode, setMode] = useState<"intro" | "form">("intro");
  const [direction, setDirection] = useState<"forward" | "back" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const goToForm = () => {
    setDirection("forward");
    setMode("form");
  };

  const goToIntro = () => {
    setDirection("back");
    setMode("intro");
    setError(null);
  };

  const animClass =
    direction === "forward"
      ? "animate-slide-from-right"
      : direction === "back"
        ? "animate-slide-from-left"
        : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Sign-in failed"));
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="flex flex-col gap-6">
        <span className="text-[12.5px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
          {t("Step 2 · Stremio")}
        </span>
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-[36px] font-medium leading-[1.08] tracking-tight text-ink">
            {t("You're in")}
          </h1>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            {t("Library and addons will sync in once you're past setup.")}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-edge-soft bg-canvas px-5 py-4">
          <StremioAvatar
            src={user.avatar}
            initial={(user.fullname || user.email || "?").trim()[0]?.toUpperCase() ?? "?"}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-medium text-ink">
              {user.fullname || user.email.split("@")[0]}
            </div>
            <div className="truncate text-[12.5px] text-ink-subtle">{user.email}</div>
          </div>
          <Check size={18} strokeWidth={2.4} className="text-accent" />
        </div>
      </div>
    );
  }

  if (mode === "form") {
    return (
      <form key="form" onSubmit={submit} className={`flex flex-col gap-5 ${animClass}`}>
        <button
          type="button"
          onClick={goToIntro}
          className="flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink-muted"
        >
          <ChevronLeft size={14} strokeWidth={2.2} className="dir-icon" />
          {t("Back")}
        </button>
        <div className="flex justify-center">
          <img
            src={stremioLogo}
            alt="Stremio"
            className="h-12"
            style={{ filter: "grayscale(1) invert(1)" }}
          />
        </div>
        <div className="flex flex-col gap-3">
          <FormField
            label={t("Email")}
            type="email"
            value={email}
            onChange={setEmail}
            autoFocus
            disabled={busy}
          />
          <FormField
            label={t("Password")}
            type="password"
            value={password}
            onChange={setPassword}
            disabled={busy}
          />
        </div>
        {error && (
          <p className="rounded-lg bg-danger/15 px-3 py-2 text-[13px] text-danger">{error}</p>
        )}
        <button
          type="submit"
          disabled={busy || !email || !password}
          className="flex h-12 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          style={{
            background: "linear-gradient(135deg, #6c5cff 0%, #8b5cff 100%)",
            boxShadow: "0 10px 30px -12px rgba(108, 92, 255, 0.55)",
          }}
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t("Signing in…")}
            </>
          ) : (
            t("Sign in to Stremio")
          )}
        </button>
        <a
          href={STREMIO_REGISTER}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openRegister}
          className="flex items-center justify-center gap-1.5 text-[12.5px] text-ink-subtle transition-colors hover:text-ink-muted"
        >
          <span>{t("Don't have an account?")}</span>
          <span className="font-medium text-ink-muted">{t("Create one")}</span>
          <ExternalLink size={11} />
        </a>
      </form>
    );
  }

  return (
    <div key="intro" className={`flex flex-col gap-6 ${animClass}`}>
      <span className="text-[12.5px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
        {t("Step 2 · Stremio")}
      </span>
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[36px] font-medium leading-[1.08] tracking-tight text-ink">
          {t("Bring in your library")}
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-muted">
          {t(
            "Sign in to mirror your Continue Watching, watchlist, and any addons you've already curated. Optional; Harbor works fully signed-out.",
          )}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <button
          onClick={goToForm}
          className="group flex h-14 items-center justify-center gap-3 rounded-2xl border border-edge bg-canvas/60 px-6 transition-all hover:border-ink-subtle/40 hover:bg-canvas"
        >
          <span className="text-[14.5px] font-medium text-ink">{t("Sign in with")}</span>
          <img
            src={stremioLogo}
            alt="Stremio"
            className="h-7 opacity-90 transition-opacity group-hover:opacity-100"
            style={{ filter: "grayscale(1) invert(1)" }}
          />
        </button>
        <a
          href={STREMIO_REGISTER}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openRegister}
          className="text-center text-[12.5px] text-ink-subtle transition-colors hover:text-ink-muted"
        >
          {t("Don't have an account? Create one →")}
        </a>
      </div>
    </div>
  );
}

function FormField({
  label,
  type,
  value,
  onChange,
  autoFocus,
  disabled,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete={type === "password" ? "current-password" : "email"}
        className="h-12 rounded-xl border border-edge bg-canvas px-4 text-[14px] text-ink outline-none transition-colors focus:border-[#8b5cff]/60 disabled:opacity-50"
      />
    </label>
  );
}

function StremioAvatar({ src, initial }: { src?: string; initial: string }) {
  const [failed, setFailed] = useState(false);
  const url = !failed ? src || "https://web.stremio.com/images/default_avatar.png" : null;
  if (url) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setFailed(true)}
        className="h-10 w-10 rounded-full bg-canvas object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-[15px] font-medium text-canvas">
      {initial}
    </div>
  );
}
