import { useState } from "react";
import { AlertCircle, Check, Loader2, UserRound } from "../../../icons";
import { useT } from "@/lib/i18n";
import { loginAuthor, recoverAuthor, registerAuthor } from "@/lib/theme-auth";
import { ROW_ACTION_PRIMARY } from "../../../kit";
import { ROW_DESC, ROW_TITLE, RowNote, Segmented } from "../../../shared";
import { TextField } from "../field";
import { PasswordField } from "./password-field";
import { useUsernameAvailability, type Availability } from "./use-username-availability";

type Mode = "signin" | "register" | "recover";

const MODES: { value: Mode; label: string; action: string }[] = [
  { value: "signin", label: "Sign in", action: "Sign in" },
  { value: "register", label: "Create account", action: "Create account" },
  { value: "recover", label: "Reset", action: "Reset password" },
];

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

const STATUS_LINE = "flex items-center gap-2 text-[15.5px] leading-[22px]";

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

  const active = MODES.find((m) => m.value === mode)!;

  return (
    <div className="flex flex-col gap-5 rounded-md bg-surface p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
          <UserRound size={20} strokeWidth={2} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className={ROW_TITLE}>{t("Author account")}</h3>
          <p className={`max-w-[66ch] ${ROW_DESC}`}>
            {t("Publish themes under your name and update them anytime.")}
          </p>
        </div>
      </div>

      <Segmented
        value={mode}
        options={MODES}
        onChange={(m) => {
          setMode(m);
          setError(null);
        }}
      />

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

        {error && <RowNote>{error}</RowNote>}
        {mode === "register" && !error && (
          <p className={`max-w-[66ch] ${ROW_DESC}`}>
            {t("You will get a one-time recovery code right after this.")}
          </p>
        )}

        <button
          type="submit"
          disabled={!ready || busy}
          className={`${ROW_ACTION_PRIMARY} w-full justify-center`}
        >
          {busy && <Loader2 size={18} className="animate-spin" />}
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
      <span className={`${STATUS_LINE} text-ink-muted`}>
        <Loader2 size={16} className="shrink-0 animate-spin" /> {t("Checking availability")}
      </span>
    );
  }
  if (state === "available") {
    return (
      <span className={`${STATUS_LINE} font-medium text-success`}>
        <Check size={16} strokeWidth={2.6} className="shrink-0" />{" "}
        {t("{name} is available", { name })}
      </span>
    );
  }
  if (state === "taken") {
    return <RowNote>{t("{name} is taken", { name })}</RowNote>;
  }
  if (state === "error") {
    return (
      <span className={`${STATUS_LINE} text-ink-muted`}>
        <AlertCircle size={16} strokeWidth={2.2} className="shrink-0" />{" "}
        {t("Couldn't check availability")}
      </span>
    );
  }
  return null;
}
