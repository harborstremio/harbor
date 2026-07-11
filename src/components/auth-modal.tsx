import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { Check, ExternalLink, Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { StremioWebButton } from "./auth-modal/stremio-web-button";

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { signIn } = useAuth();
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password, remember);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[210] flex items-center justify-center bg-canvas/80"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="animate-modal-in flex w-[min(92vw,400px)] flex-col gap-5 rounded-2xl border border-edge-soft bg-elevated p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="flex flex-col items-center gap-2">
          <h2 className="font-display text-[22px] font-medium tracking-tight text-ink">{t("Login to Stremio")}</h2>
          <p className="text-center text-[13px] leading-snug text-ink-muted">
            {t("Brings in your library, watchlist, and installed addons.")}
          </p>
        </div>

        <StremioWebButton onDone={onClose} disabled={busy} />

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-edge-soft" />
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
            {t("or use email")}
          </span>
          <span className="h-px flex-1 bg-edge-soft" />
        </div>

        <div className="flex flex-col gap-3">
          <Field label={t("Email")} type="email" value={email} onChange={setEmail} disabled={busy} />
          <Field label={t("Password")} type="password" value={password} onChange={setPassword} disabled={busy} />
        </div>

        <button
          type="button"
          onClick={() => setRemember((v) => !v)}
          disabled={busy}
          className="flex items-center gap-2.5 self-start text-start"
        >
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors ${
              remember ? "border-ink bg-ink" : "border-edge"
            }`}
          >
            {remember && <Check size={11} strokeWidth={3} className="text-canvas" />}
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] font-medium text-ink">{t("Remember me")}</span>
            <span className="text-[11.5px] text-ink-subtle">{t("Stays signed in on this device only.")}</span>
          </span>
        </button>

        {error && <p className="rounded-lg bg-danger/15 px-3 py-2 text-[12.5px] text-danger">{error}</p>}

        <button
          type="submit"
          disabled={busy || !email || !password}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-edge bg-elevated text-[14px] font-semibold text-ink transition-colors hover:bg-raised disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {t("Signing in...")}
            </>
          ) : (
            t("Sign in with email")
          )}
        </button>

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-[12.5px] text-ink-subtle transition-colors hover:text-ink-muted"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={() => openUrl("https://www.stremio.com/register")}
            className="flex items-center gap-1.5 text-[12.5px] text-ink-subtle transition-colors hover:text-ink-muted"
          >
            <span>{t("Create account")}</span>
            <ExternalLink size={11} />
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function Field({
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
  const t = useT();
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">{label}</span>
      <div className="relative">
        <input
          type={isPassword && show ? "text" : type}
          value={value}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoComplete={isPassword ? "current-password" : "email"}
          className={`h-11 w-full rounded-xl border border-edge bg-canvas px-3.5 text-[14px] text-ink outline-none transition-colors focus:border-ink disabled:opacity-50 ${
            isPassword ? "pe-11" : ""
          }`}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShow((v) => !v)}
            disabled={disabled}
            aria-label={show ? t("Hide password") : t("Show password")}
            title={show ? t("Hide password") : t("Show password")}
            className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-ink-subtle transition-colors hover:text-ink disabled:opacity-50"
          >
            {show ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
          </button>
        )}
      </div>
    </label>
  );
}
