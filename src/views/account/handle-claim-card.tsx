import { useState } from "react";
import { AlertCircle, Check, Loader2, Lock, X } from "@/views/settings/icons";
import { claimHandle, HANDLE_MIN, HANDLE_MAX } from "@/lib/account/handle";
import { accountErrorMessage, type AccountErrorMessage } from "@/lib/account/error-messages";
import type { Author } from "@/lib/theme-auth";
import { inputClass } from "./fields";
import { useHandleAvailability, type HandleStatus } from "./use-handle-availability";
import { HandleChangeConfirm } from "./handle-change-confirm";
import { useT } from "@/lib/i18n";
import { ROW_ACTION, ROW_ACTION_PRIMARY, ROW_DESC, ROW_TITLE } from "@/views/settings/kit";

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
      <div className="flex flex-col gap-3">
        <HandleHeader hasCustom={hasCustom} />
        <div className="flex items-center gap-3 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-raised text-ink-muted">
            <Lock size={16} />
          </span>
          <div className="flex min-w-0 flex-col">
            <bdi dir="ltr" className={ROW_TITLE}>@{author.handle}</bdi>
            <span className={ROW_DESC}>
              {t("Locked until")} {formatDate(availableAt)}. {t("You can change your handle")}{" "}
              {t(COOLDOWN_LABEL)}.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <HandleHeader hasCustom={hasCustom} />

      <div className="flex flex-wrap items-center gap-3">
        <div dir="ltr" className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute inset-y-0 start-0 flex w-10 items-center justify-center text-[18px] leading-none text-ink-muted">
            @
          </span>
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            aria-label={t("Handle")}
            placeholder={hasCustom ? (author.handle ?? t("yourhandle")) : t("yourhandle")}
            maxLength={24}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className={inputClass + " ps-10 pe-10"}
          />
          {value.length > 0 && (
            <span className="pointer-events-none absolute inset-y-0 end-3.5 flex items-center">
              <StatusIcon status={status} />
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => startClaim(value)}
          disabled={!canClaim}
          aria-busy={busy}
          className={ROW_ACTION_PRIMARY}
        >
          {busy && <Loader2 size={16} className="animate-spin" />}
          {hasCustom ? t("Change") : t("Claim")}
        </button>
      </div>

      <StatusLine status={status} onPick={startClaim} />
      <p className="text-[14px] leading-[21px] text-ink-muted">
        {hasCustom
          ? `${t("You can change your handle")} ${t(COOLDOWN_LABEL)}, ${t("so pick one you'll keep.")}`
          : `${t("You can change your handle")} ${t(COOLDOWN_LABEL)} ${t("after you claim it.")}`}
      </p>
      {error && (
        <p role="alert" className="text-[15px] leading-[22px] text-danger">
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
    <div className="flex flex-col gap-1">
      <span className={ROW_TITLE}>{t("Handle")}</span>
      <span className={ROW_DESC}>
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
    return <span className="text-[14px] leading-[21px] text-ink-muted">{t("Checking availability")}</span>;
  if (status.state === "available")
    return (
      <span className="text-[14px] font-medium leading-[21px] text-accent">
        {t("That handle is yours to claim.")}
      </span>
    );
  if (status.state === "error")
    return (
      <span className="text-[14px] leading-[21px] text-ink-muted">
        {t("Sign in to Harbor to check availability.")}
      </span>
    );

  const reason = status.reason === `Handles are at least ${HANDLE_MIN} characters.`
    ? t("Handles are at least {count} characters.", { count: HANDLE_MIN })
    : status.reason === `Handles are at most ${HANDLE_MAX} characters.`
      ? t("Handles are at most {count} characters.", { count: HANDLE_MAX })
      : status.reason ? t(status.reason) : undefined;
  const label =
    status.state === "taken"
      ? (reason ?? t("That handle is taken."))
      : status.state === "reserved"
        ? (reason ?? t("That handle is reserved."))
        : (reason ?? t("That handle is not valid."));
  const suggestions = "suggestions" in status ? (status.suggestions ?? []) : [];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] font-medium leading-[21px] text-danger">{label}</span>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className={ROW_ACTION}
              dir="ltr"
            >
              @{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
