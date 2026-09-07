import { useState } from "react";
import { ArrowLeft, Loader2 } from "@/views/settings/icons";
import { recoverIdentity } from "@/lib/account/identity";
import { finishDiscordRecovery, startDiscordRecovery } from "@/lib/account/discord-link";
import { accountErrorMessage, type AccountErrorMessage } from "@/lib/account/error-messages";
import { canDiscordAuth } from "@/lib/discord-auth";
import { DiscordIcon } from "@/components/discord-icon";
import { PasswordField, TextField } from "./fields";
import { RECOVERY_KEY_LENGTH, RecoveryKeyInput } from "./recovery-key-input";
import { useT } from "@/lib/i18n";
import { Section } from "@/views/settings/shared";
import { ROW_ACTION, ROW_ACTION_PRIMARY } from "@/views/settings/kit";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
const PIN_RE = /^\d{6}$/;

type Mode = "key" | "discord-request" | "discord-confirm";

export function AccountRecoverForm({
  onBack,
  onReset,
  inline = false,
}: {
  onBack: () => void;
  onReset: (newCode: string) => void;
  inline?: boolean;
}) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("key");
  const [username, setUsername] = useState("");
  const [key, setKey] = useState("");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountErrorMessage | null>(null);
  const canDiscord = canDiscordAuth();

  const usernameOk = USERNAME_RE.test(username.trim());
  const keyReady = usernameOk && key.length >= RECOVERY_KEY_LENGTH && password.length >= 8;
  const confirmReady = usernameOk && PIN_RE.test(pin) && password.length >= 8;

  const submitKey = async () => {
    if (!keyReady || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { recoveryCode } = await recoverIdentity(username.trim(), key, password);
      onReset(recoveryCode);
    } catch (err) {
      setError(accountErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const requestDiscordCode = async () => {
    if (!usernameOk || busy) return;
    setBusy(true);
    setError(null);
    try {
      await startDiscordRecovery(username.trim());
      setMode("discord-confirm");
    } catch (err) {
      setError(accountErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDiscordCode = async () => {
    if (!confirmReady || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { recoveryCode } = await finishDiscordRecovery(username.trim(), pin, password);
      onReset(recoveryCode);
    } catch (err) {
      setError(accountErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPin("");
    setPassword("");
  };

  const heading =
    mode === "key"
      ? t("Reset your password")
      : mode === "discord-request"
        ? t("Recover via Discord")
        : t("Enter your code");
  const subheading =
    mode === "key"
      ? t(
          "Enter your username and the recovery key you saved. We'll set a new password and sign you in.",
        )
      : mode === "discord-request"
        ? t(
            "If this account has Discord linked, we'll DM you a code to reset your password without the recovery key.",
          )
        : t("We sent a 6-digit code to your Discord DMs. It expires in 10 minutes.");

  const content = (
    <div className={inline ? "flex min-w-0 flex-col gap-6 pt-4" : "flex flex-col gap-6 bg-surface p-6"}>
      {!inline && <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => (mode === "key" ? onBack() : switchMode("key"))}
          aria-label={t("Back")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <ArrowLeft size={17} strokeWidth={2} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-[20px] font-semibold leading-7 tracking-tight text-ink">{heading}</h2>
          <p className="mt-1 text-[15px] leading-[22px] text-ink-muted">{subheading}</p>
        </div>
      </div>}

      {mode === "key" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitKey();
          }}
          className="flex flex-col gap-4"
        >
          <TextField
            label={t("Username")}
            value={username}
            onChange={setUsername}
            placeholder={t("yourname")}
            maxLength={24}
            autoComplete="username"
          />
          <RecoveryKeyInput onChange={setKey} inline={inline} />
          <PasswordField
            label={t("New password")}
            value={password}
            onChange={setPassword}
            placeholder={t("At least 8 characters")}
            onEnter={submitKey}
          />

          {error && (
            <p role={inline ? "alert" : undefined} className={inline ? "rounded-md bg-danger/10 px-3.5 py-3 text-[15.5px] leading-[22px] text-danger" : "text-[12.5px] text-danger"}>
              {error.kind === "built-in" ? t(error.key) : error.detail}
            </p>
          )}

          <button
            type="submit"
            disabled={!keyReady || busy}
            className={inline ? `${ROW_ACTION_PRIMARY} self-end justify-center` : "flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-[14px] font-semibold text-canvas transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {t("Reset password")}
          </button>

          {canDiscord && (
            <>
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-edge-soft" />
                <span className={inline ? "text-[15px] text-ink-muted" : "text-[11px] font-medium uppercase tracking-wide text-ink-subtle"}>
                  {t("or")}
                </span>
                <span className="h-px flex-1 bg-edge-soft" />
              </div>
              <button
                type="button"
                onClick={() => switchMode("discord-request")}
                className={inline ? `${ROW_ACTION} justify-center` : "flex h-11 items-center justify-center gap-2 rounded-[11px] border border-edge-soft text-[13.5px] font-semibold text-ink transition-all duration-150 hover:bg-elevated/60 active:scale-[0.99]"}
              >
                <DiscordIcon size={16} />
                {t("Recover via a code sent to Discord")}
              </button>
            </>
          )}
        </form>
      )}

      {mode === "discord-request" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void requestDiscordCode();
          }}
          className="flex flex-col gap-4"
        >
          <TextField
            label={t("Username")}
            value={username}
            onChange={setUsername}
            placeholder={t("yourname")}
            maxLength={24}
            autoComplete="username"
          />

          {error && (
            <p role={inline ? "alert" : undefined} className={inline ? "rounded-md bg-danger/10 px-3.5 py-3 text-[15.5px] leading-[22px] text-danger" : "text-[12.5px] text-danger"}>
              {error.kind === "built-in" ? t(error.key) : error.detail}
            </p>
          )}

          <button
            type="submit"
            disabled={!usernameOk || busy}
            className={inline ? `${ROW_ACTION_PRIMARY} self-end justify-center` : "flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-[14px] font-semibold text-canvas transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {t("Send code")}
          </button>
        </form>
      )}

      {mode === "discord-confirm" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void confirmDiscordCode();
          }}
          className="flex flex-col gap-4"
        >
          <TextField
            label={t("Code")}
            value={pin}
            onChange={(v) => setPin(v.replace(/\D/g, "").slice(0, 6))}
            placeholder={t("6-digit code")}
            maxLength={6}
            autoComplete="one-time-code"
          />
          <PasswordField
            label={t("New password")}
            value={password}
            onChange={setPassword}
            placeholder={t("At least 8 characters")}
            onEnter={confirmDiscordCode}
          />

          {error && (
            <p role={inline ? "alert" : undefined} className={inline ? "rounded-md bg-danger/10 px-3.5 py-3 text-[15.5px] leading-[22px] text-danger" : "text-[12.5px] text-danger"}>
              {error.kind === "built-in" ? t(error.key) : error.detail}
            </p>
          )}

          <button
            type="submit"
            disabled={!confirmReady || busy}
            className={inline ? `${ROW_ACTION_PRIMARY} self-end justify-center` : "flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-[14px] font-semibold text-canvas transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {t("Reset password")}
          </button>

          <button
            type="button"
            onClick={() => void requestDiscordCode()}
            disabled={busy}
            className={inline ? "min-h-11 self-end text-[15px] font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-40" : "self-center text-[12px] font-medium text-ink-subtle transition-colors hover:text-ink disabled:opacity-40"}
          >
            {t("Didn't get it? Send another code")}
          </button>
        </form>
      )}
    </div>
  );

  if (!inline) return content;
  return (
    <div className="hset-account-auth relative w-full max-w-[560px] [&_.hset-section-title]:pe-14 [&_.harbor-settings-section>p]:pe-14 [&_label]:text-[16.5px] [&_label]:leading-6 [&_label~span]:text-[15.5px] [&_label~span]:leading-[22px] [&_input]:bg-elevated [&_input]:rounded-[10px]">
      <Section title={heading} subtitle={subheading}>{content}</Section>
      <button
        type="button"
        onClick={() => (mode === "key" ? onBack() : switchMode("key"))}
        aria-label={t("Back")}
        className="absolute end-0 top-0 grid h-11 w-11 place-items-center rounded-md text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        <ArrowLeft size={17} strokeWidth={2} className="rtl:rotate-180" />
      </button>
    </div>
  );
}
