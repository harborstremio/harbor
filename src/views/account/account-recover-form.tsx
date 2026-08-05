import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { recoverIdentity } from "@/lib/account/identity";
import { accountErrorMessage } from "@/lib/account/error-messages";
import { PasswordField, TextField } from "./fields";
import { RECOVERY_KEY_LENGTH, RecoveryKeyInput } from "./recovery-key-input";
import { useT } from "@/lib/i18n";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export function AccountRecoverForm({
  onBack,
  onReset,
}: {
  onBack: () => void;
  onReset: (newCode: string) => void;
}) {
  const t = useT();
  const [username, setUsername] = useState("");
  const [key, setKey] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    USERNAME_RE.test(username.trim()) && key.length >= RECOVERY_KEY_LENGTH && password.length >= 8;

  const submit = async () => {
    if (!ready || busy) return;
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

  return (
    <div className="flex flex-col gap-5 rounded-[16px] border border-edge-soft bg-surface p-6">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={t("Back to sign in")}
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink active:scale-90"
        >
          <ArrowLeft size={17} strokeWidth={2} />
        </button>
        <div className="flex flex-col">
          <h3 className="text-[16px] font-semibold tracking-tight text-ink">{t("Reset your password")}</h3>
          <p className="text-[12.5px] text-ink-subtle">
            {t("Enter your username and the recovery key you saved. We'll set a new password and sign you in.")}
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
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
          onEnter={submit}
        />

        {error && <p className="text-[12.5px] text-danger">{error}</p>}

        <button
          type="submit"
          disabled={!ready || busy}
          className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-accent text-[14px] font-semibold text-canvas transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {t("Reset password")}
        </button>
      </form>
    </div>
  );
}
