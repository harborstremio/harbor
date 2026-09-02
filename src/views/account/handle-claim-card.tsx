import { useState } from "react";
import { AlertCircle, Check, Loader2, Lock, X } from "lucide-react";
import { claimHandle } from "@/lib/account/handle";
import { accountErrorMessage, type AccountErrorMessage } from "@/lib/account/error-messages";
import type { Author } from "@/lib/theme-auth";
import { inputClass } from "./fields";
import { useHandleAvailability, type HandleStatus } from "./use-handle-availability";
import { HandleChangeConfirm } from "./handle-change-confirm";
import { useT } from "@/lib/i18n";

const COOLDOWN_LABEL = "once every 14 days";

function formatDate(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(undefined, { month: "long", day: "numeric" });
  } catch {
    return "soon";
  }
}

export function HandleClaimCard({ author }: { author: Author }) {
  const t = useT();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountErrorMessage | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const status = useHandleAvailability(value, value.length > 0);
  const hasCustom = !!author.handle && author.handleAuto === false;
  const availableAt = author.handleChangeAvailableAt
    ? Date.parse(author.handleChangeAvailableAt)
    : 0;
  const onCooldown = hasCustom && availableAt > Date.now();
  const canClaim = status.state === "available" && !busy && !onCooldown;

  const doClaim = async (handle: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await claimHandle(handle);
      setValue("");
      setPending(null);
    } catch (err) {
      setError(accountErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const startClaim = (handle: string) => {
    if (busy || onCooldown) return;
    if (hasCustom) setPending(handle);
    else void doClaim(handle);
  };

  if (onCooldown) {
    return (
      <div className="flex flex-col gap-2.5">
        <HandleHeader hasCustom={hasCustom} />
        <div className="flex items-center gap-3 rounded-md bg-elevated px-4 py-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-raised text-ink-muted">
            <Lock size={16} />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="font-display text-[15px] text-ink">@{author.handle}</span>
            <span className="text-[12px] text-ink-subtle">
              {t("Locked until")} {formatDate(availableAt)}. {t("You can change your handle")}{" "}
              {t(COOLDOWN_LABEL)}.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <HandleHeader hasCustom={hasCustom} />

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 start-0 flex w-9 items-center justify-center font-display text-[18px] leading-none text-ink-muted">
          @
        </span>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder={hasCustom ? (author.handle ?? t("yourhandle")) : t("yourhandle")}
          maxLength={24}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className={`${inputClass} ps-9 pe-[104px] font-display text-[15px]`}
        />
        <div className="absolute inset-y-0 end-1.5 flex items-center gap-2">
          {value.length > 0 && <StatusIcon status={status} />}
          <button
            type="button"
            onClick={() => startClaim(value)}
            disabled={!canClaim}
            className="harbor-press-pop flex h-8 items-center rounded-md bg-ink px-3.5 text-[12.5px] font-semibold text-canvas transition-opacity duration-150 hover:opacity-90 disabled:opacity-35"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : hasCustom ? (
              t("Change")
            ) : (
              t("Claim")
            )}
          </button>
        </div>
      </div>

      <StatusLine status={status} onPick={startClaim} />
      <p className="text-[11.5px] text-ink-subtle">
        {hasCustom
          ? `${t("You can change your handle")} ${t(COOLDOWN_LABEL)}, ${t("so pick one you'll keep.")}`
          : `${t("You can change your handle")} ${t(COOLDOWN_LABEL)} ${t("after you claim it.")}`}
      </p>
      {error && (
        <p className="text-[12px] text-danger">
          {error.kind === "built-in" ? t(error.key) : error.detail}
        </p>
      )}

      {pending && (
        <HandleChangeConfirm
          current={author.handle ?? ""}
          next={pending}
          busy={busy}
          onConfirm={() => void doClaim(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

function HandleHeader({ hasCustom }: { hasCustom: boolean }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] font-semibold text-ink">{t("Handle")}</span>
      <span className="text-[12px] text-ink-subtle">
        {hasCustom
          ? t("How people find you across Harbor.")
          : t("Claim one so people can find you across Harbor.")}
      </span>
    </div>
  );
}

function StatusIcon({ status }: { status: HandleStatus }) {
  if (status.state === "checking")
    return <Loader2 size={15} className="animate-spin text-ink-subtle" />;
  if (status.state === "available")
    return <Check size={15} strokeWidth={2.6} className="text-accent" />;
  if (
    status.state === "taken" ||
    status.state === "reserved" ||
    status.state === "invalid" ||
    status.state === "too-short"
  )
    return <X size={15} strokeWidth={2.6} className="text-danger" />;
  if (status.state === "error")
    return <AlertCircle size={15} strokeWidth={2.2} className="text-ink-subtle" />;
  return null;
}

function StatusLine({ status, onPick }: { status: HandleStatus; onPick: (s: string) => void }) {
  const t = useT();
  if (status.state === "idle") return null;
  if (status.state === "checking")
    return <span className="text-[11.5px] text-ink-subtle">{t("Checking availability")}</span>;
  if (status.state === "available")
    return (
      <span className="text-[11.5px] font-medium text-accent">
        {t("That handle is yours to claim.")}
      </span>
    );
  if (status.state === "error")
    return (
      <span className="text-[11.5px] text-ink-subtle">
        {t("Sign in to Harbor to check availability.")}
      </span>
    );

  const label =
    status.state === "taken"
      ? (status.reason ?? t("That handle is taken."))
      : status.state === "reserved"
        ? (status.reason ?? t("That handle is reserved."))
        : (status.reason ?? t("That handle is not valid."));
  const suggestions = "suggestions" in status ? (status.suggestions ?? []) : [];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11.5px] font-medium text-danger">{label}</span>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="harbor-press-pop flex h-8 items-center rounded-md bg-elevated px-3 font-display text-[13px] text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              @{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
