import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { useT } from "@/lib/i18n";
import { SetupShell, type SetupChrome } from "./setup-shell";
import { SetupButton, SetupCard, SetupHeading } from "./setup-ui";

type CopyResult = "copied" | "failed" | null;

/** The phone page is served over plain http, so it is not a secure context and
    navigator.clipboard is undefined on most browsers. execCommand is the only
    copy path left, and it still fails on some of them. */
async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const el = document.createElement("textarea");
    el.value = value;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function SetupRecovery({
  chrome,
  code,
  onContinue,
}: {
  chrome: SetupChrome;
  code: string;
  onContinue: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState<CopyResult>(null);
  const [saved, setSaved] = useState(false);

  const action = (
    <SetupButton onClick={onContinue} disabled={!saved}>
      {t("Continue")}
    </SetupButton>
  );

  return (
    <SetupShell {...chrome} action={action}>
      <SetupHeading
        title={t("Save your recovery code")}
        body={t(
          "This is the only way back into your account if you forget your password. It is shown once.",
        )}
      />

      <SetupCard>
        <p
          className="select-all break-all rounded-xl border border-edge bg-elevated px-4 py-4 text-center font-mono text-[22px] font-bold leading-relaxed tracking-[0.12em] text-ink"
          aria-label={t("Recovery code")}
        >
          {code}
        </p>
        <div className="mt-3">
          <SetupButton
            variant="quiet"
            onClick={async () => setCopied((await copyText(code)) ? "copied" : "failed")}
          >
            {copied === "copied" ? <Check size={18} /> : <Copy size={18} />}
            {copied === "copied" ? t("Copied") : t("Copy code")}
          </SetupButton>
        </div>
        {copied === "failed" && (
          <p className="mt-3 text-[13px] leading-relaxed text-ink-subtle">
            {t("This browser blocked the copy. Long-press the code above, or write it down.")}
          </p>
        )}
      </SetupCard>

      {/* Converts in place rather than unmounting. A red warning that simply
          disappears reads as the nag going away; the same block turning into a
          receipt reads as the requirement being met, and holding the block
          stops the layout jumping under the thumb that is about to press
          Continue. It is also not an error: nothing has gone wrong here. */}
      <p
        className={`flex items-start gap-2 rounded-xl border px-3.5 py-3 text-[14px] leading-relaxed transition-colors duration-200 ${
          saved ? "border-success/40 bg-success/10 text-ink" : "border-edge bg-elevated text-ink-muted"
        }`}
      >
        {saved ? (
          <Check size={17} className="mt-0.5 shrink-0 text-success" />
        ) : (
          <KeyRound size={17} className="mt-0.5 shrink-0 text-ink-subtle" />
        )}
        <span>
          {saved
            ? t("Kept. Your TV gets your account when you continue.")
            : t("Nothing on your TV changes until you confirm you have saved this.")}
        </span>
      </p>

      <button
        type="button"
        onClick={() => setSaved((v) => !v)}
        aria-pressed={saved}
        className="flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-edge bg-surface px-4 text-start"
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
            saved ? "border-success bg-success text-canvas" : "border-edge bg-elevated"
          }`}
        >
          {saved && <Check size={15} strokeWidth={3} />}
        </span>
        <span className="text-[15.5px] font-semibold text-ink">
          {t("I have saved my recovery code")}
        </span>
      </button>
    </SetupShell>
  );
}
