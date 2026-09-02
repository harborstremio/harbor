import { useState } from "react";
import { AlertCircle, Check, Loader2, UserRound, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { loginAuthor, recoverAuthor, registerAuthor } from "@/lib/theme-auth";
import { TextField } from "../field";
import { PasswordField } from "./password-field";
import { useUsernameAvailability, type Availability } from "./use-username-availability";

type Mode = "signin" | "register" | "recover";

const MODES: { id: Mode; label: string; action: string }[] = [
  { id: "signin", label: "Sign in", action: "Sign in" },
  { id: "register", label: "Create account", action: "Create account" },
  { id: "recover", label: "Reset", action: "Reset password" },
];

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export function AuthForm({ onRecovery }: { onRecovery: (code: string) => void }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameOk = USERNAME_RE.test(username.trim());
  const availability = useUsernameAvailability(username, mode === "register");
  const ready =
    mode === "signin"
      ? usernameOk && password.length > 0
      : mode === "register"
        ? usernameOk && password.length >= 8 && availability !== "taken"
        : usernameOk && recoveryCode.trim().length > 0 && newPassword.length >= 8;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        await loginAuthor(username.trim(), password);
      } else if (mode === "register") {
        const { recoveryCode: code } = await registerAuthor(username.trim(), password);
        onRecovery(code);
      } else {
        const { recoveryCode: code } = await recoverAuthor(
          username.trim(),
          recoveryCode.trim(),
          newPassword,
        );
        onRecovery(code);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const active = MODES.find((m) => m.id === mode)!;

  return (
    <div className="flex flex-col gap-5 rounded-md bg-surface p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft text-accent">
          <UserRound size={18} strokeWidth={2} />
        </span>
        <div className="flex flex-col">
          <h3 className="text-[16px] font-semibold tracking-tight text-ink">
            {t("Author account")}
          </h3>
          <p className="text-[12.5px] text-ink-subtle">
            {t("Publish themes under your name and update them anytime.")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-md bg-elevated p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMode(m.id);
              setError(null);
            }}
            className={`h-8 flex-1 rounded-md text-[12.5px] font-semibold transition-colors ${
              mode === m.id ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t(m.label)}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <TextField
            label={t("Username")}
            value={username}
            onChange={setUsername}
            placeholder={t("yourname")}
            maxLength={24}
            hint={
              mode === "register" && !usernameOk
                ? t("3 to 24 letters, numbers or underscores.")
                : undefined
            }
          />
          {mode === "register" && usernameOk && (
            <UsernameStatus state={availability} name={username.trim()} />
          )}
        </div>

        {mode === "signin" && (
          <PasswordField
            label={t("Password")}
            value={password}
            onChange={setPassword}
            placeholder={t("Your password")}
          />
        )}
        {mode === "register" && (
          <PasswordField
            label={t("Password")}
            value={password}
            onChange={setPassword}
            placeholder={t("At least 8 characters")}
            showStrength
          />
        )}
        {mode === "recover" && (
          <>
            <TextField
              label={t("Recovery code")}
              value={recoveryCode}
              onChange={setRecoveryCode}
              placeholder={t("The code from sign up")}
              maxLength={40}
            />
            <PasswordField
              label={t("New password")}
              value={newPassword}
              onChange={setNewPassword}
              placeholder={t("At least 8 characters")}
              showStrength
            />
          </>
        )}

        {error && <p className="text-[12.5px] text-danger">{error}</p>}
        {mode === "register" && !error && (
          <p className="text-[11.5px] text-ink-subtle">
            {t("You will get a one-time recovery code right after this.")}
          </p>
        )}

        <button
          type="submit"
          disabled={!ready || busy}
          className="flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-[13.5px] font-semibold text-canvas transition duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {t(active.action)}
        </button>
      </form>
    </div>
  );
}

function UsernameStatus({ state, name }: { state: Availability; name: string }) {
  const t = useT();
  if (state === "checking") {
    return (
      <span className="flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
        <Loader2 size={12} className="animate-spin" /> {t("Checking availability")}
      </span>
    );
  }
  if (state === "available") {
    return (
      <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-success">
        <Check size={12} strokeWidth={2.6} /> {t("{name} is available", { name })}
      </span>
    );
  }
  if (state === "taken") {
    return (
      <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-danger">
        <X size={12} strokeWidth={2.6} /> {t("{name} is taken", { name })}
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1.5 text-[11.5px] text-ink-subtle">
        <AlertCircle size={12} strokeWidth={2.2} /> {t("Couldn't check availability")}
      </span>
    );
  }
  return null;
}
