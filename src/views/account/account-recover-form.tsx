import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { recoverIdentity } from "@/lib/account/identity";
import { finishDiscordRecovery, startDiscordRecovery } from "@/lib/account/discord-link";
import { accountErrorMessage, type AccountErrorMessage } from "@/lib/account/error-messages";
import { canDiscordAuth } from "@/lib/discord-auth";
import { DiscordIcon } from "@/components/discord-icon";
import { PasswordField, TextField } from "./fields";
import { RECOVERY_KEY_LENGTH, RecoveryKeyInput } from "./recovery-key-input";
import { useT } from "@/lib/i18n";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;
const PIN_RE = /^\d{6}$/;

type Mode = "key" | "discord-request" | "discord-confirm";

export function AccountRecoverForm({
  onBack,
  onReset,
}: {
  onBack: () => void;
  onReset: (newCode: string) => void;
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

  return (
    <div className="flex flex-col gap-5 rounded-[16px] border border-edge-soft bg-surface p-6">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => (mode === "key" ? onBack() : switchMode("key"))}
          aria-label={t("Back")}
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink active:scale-90"
        >
          <ArrowLeft size={17} strokeWidth={2} />
        </button>
        <div className="flex flex-col">
          <h3 className="text-[16px] font-semibold tracking-tight text-ink">{heading}</h3>
          <p className="text-[12.5px] text-ink-subtle">{subheading}</p>
        </div>
      </div>

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
          <RecoveryKeyInput onChange={setKey} />
          <PasswordField
            label={t("New password")}
            value={password}
            onChange={setPassword}
            placeholder={t("At least 8 characters")}
            onEnter={submitKey}
          />

          {error && (
            <p className="text-[12.5px] text-danger">
              {error.kind === "built-in" ? t(error.key) : error.detail}
            </p>
          )}

          <button
            type="submit"
            disabled={!keyReady || busy}
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-[14px] font-semibold text-canvas transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {t("Reset password")}
          </button>

          {canDiscord && (
            <>
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-edge-soft" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                  {t("or")}
                </span>
                <span className="h-px flex-1 bg-edge-soft" />
              </div>
              <button
                type="button"
                onClick={() => switchMode("discord-request")}
                className="flex h-11 items-center justify-center gap-2 rounded-[11px] border border-edge-soft text-[13.5px] font-semibold text-ink transition-all duration-150 hover:bg-elevated/60 active:scale-[0.99]"
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
            <p className="text-[12.5px] text-danger">
              {error.kind === "built-in" ? t(error.key) : error.detail}
            </p>
          )}

          <button
            type="submit"
            disabled={!usernameOk || busy}
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-[14px] font-semibold text-canvas transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
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
            <p className="text-[12.5px] text-danger">
              {error.kind === "built-in" ? t(error.key) : error.detail}
            </p>
          )}

          <button
            type="submit"
            disabled={!confirmReady || busy}
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-accent text-[14px] font-semibold text-canvas transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {t("Reset password")}
          </button>

          <button
            type="button"
            onClick={() => void requestDiscordCode()}
            disabled={busy}
            className="self-center text-[12px] font-medium text-ink-subtle transition-colors hover:text-ink disabled:opacity-40"
          >
            {t("Didn't get it? Send another code")}
          </button>
        </form>
      )}
    </div>
  );
}
