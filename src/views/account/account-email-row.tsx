import { useState } from "react";
import { Loader2 } from "lucide-react";
import { attachEmail, fetchMe, resendVerification } from "@/lib/account/identity";
import { useCapabilities } from "@/lib/account/capabilities";
import { accountErrorMessage } from "@/lib/account/error-messages";
import type { Author } from "@/lib/theme-auth";
import { useT } from "@/lib/i18n";
import { TextField } from "./fields";

/**
 * The email state of a signed-in account: absent, pending, or verified.
 *
 * Renders nothing at all when the instance reports no mail support, which is
 * also the state every client sees until the backend half ships.
 *
 * Accounts created before this feature have no address, and are PROMPTED here
 * rather than blocked at login. Locking out the ~7.6k existing accounts on the
 * day this shipped would be a far worse outcome than some of them never adding
 * one.
 */
export function AccountEmailRow({ author }: { author: Author }) {
  const t = useT();
  const caps = useCapabilities();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  if (!caps.email) return null;

  const verified = author.emailVerified === true && !!author.email;
  const pending = author.emailPending || "";
  const trimmed = value.trim();
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await attachEmail(trimmed, caps.newsletter.enabled ? caps.newsletter.defaultChecked : false);
      // The address is now PENDING on the server. Refetch so this row shows that
      // rather than optimistically claiming a verified state it does not have.
      await fetchMe();
      setEditing(false);
      setValue("");
    } catch (err) {
      setError(accountErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError(null);
    try {
      await resendVerification();
      setResent(true);
    } catch (err) {
      setError(accountErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-ink">{t("Email")}</p>
          <p className="mt-0.5 truncate text-[12.5px] leading-snug text-ink-subtle">
            {verified
              ? author.email
              : pending
                ? t("Waiting for confirmation: {{email}}", { email: pending })
                : t("Not set. Add one so you can reset your password without your recovery key.")}
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => { setEditing(true); setError(null); setResent(false); }}
            className="shrink-0 text-[12px] font-medium text-ink-subtle transition-colors hover:text-ink"
          >
            {verified || pending ? t("Change") : t("Add email")}
          </button>
        )}
      </div>

      {pending && !editing && (
        <button
          type="button"
          onClick={() => void resend()}
          disabled={busy || resent}
          className="self-start text-[12px] font-medium text-ink-subtle transition-colors hover:text-ink disabled:opacity-50"
        >
          {resent ? t("Sent. Check your inbox.") : t("Resend confirmation")}
        </button>
      )}

      {editing && (
        <div className="flex flex-col gap-2.5">
          <TextField
            label={t("Email")}
            value={value}
            onChange={setValue}
            placeholder={t("you@example.com")}
            autoComplete="email"
            hint={
              verified
                ? /* The current address keeps working until the new one is
                     confirmed, so say so rather than implying it is replaced now. */
                  t("Your current address stays active until you confirm the new one.")
                : undefined
            }
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!valid || busy}
              onClick={() => void submit()}
              className="flex h-9 items-center gap-2 rounded-[9px] bg-ink px-3.5 text-[13px] font-semibold text-canvas transition-all hover:opacity-90 disabled:opacity-40"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {t("Send confirmation")}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setValue(""); setError(null); }}
              className="text-[12px] font-medium text-ink-subtle transition-colors hover:text-ink"
            >
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-[10px] border border-danger/25 bg-danger/10 px-3 py-2 text-[12px] leading-snug text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
