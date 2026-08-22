import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { cancelSyncSignIn, completeSyncSignIn } from "@/lib/sync/engine";
import type { AdoptionPlan, AdoptionProfileInfo, AdoptionSummary } from "@/lib/sync/adopt";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function ProfileSummary({
  label,
  profiles,
  t,
}: {
  label: string;
  profiles: AdoptionProfileInfo[];
  t: Translate;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-edge-soft bg-elevated/60 p-3">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {profiles.length > 0 ? (
          profiles.map((profile) => (
            <div key={profile.id} className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="truncate text-[12.5px] font-medium text-ink">{profile.name}</span>
              {profile.isPrimary && (
                <span className="rounded-full bg-raised px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {t("Primary")}
                </span>
              )}
              {profile.kid && (
                <span className="rounded-full border border-edge-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                  {t("Kid")}
                </span>
              )}
            </div>
          ))
        ) : (
          <span className="text-[12.5px] text-ink-subtle">{t("No profiles")}</span>
        )}
      </div>
    </div>
  );
}

export function SyncAdoptionModal({ summary }: { summary: AdoptionSummary }) {
  const t = useT();
  const recommendedOptionRef = useRef<HTMLButtonElement>(null);
  const [strategy, setStrategy] = useState<AdoptionPlan["kind"]>("merge");
  const [targetProfileId, setTargetProfileId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const requiresTarget = strategy === "merge-into-profile" && targetProfileId === null;

  useEffect(() => {
    recommendedOptionRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      event.preventDefault();
      void cancelSyncSignIn();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy]);

  const continueSignIn = async () => {
    if (busy || requiresTarget) return;

    let plan: AdoptionPlan;
    switch (strategy) {
      case "merge":
        plan = { kind: "merge" };
        break;
      case "bring-profiles":
        plan = { kind: "bring-profiles" };
        break;
      case "merge-into-profile":
        if (targetProfileId === null) return;
        plan = { kind: "merge-into-profile", targetProfileId };
        break;
      case "cloud":
        plan = { kind: "cloud" };
        break;
      case "local":
        plan = { kind: "local" };
        break;
    }

    setError(false);
    setBusy(true);
    try {
      await completeSyncSignIn(plan);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-adoption-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-edge-soft bg-canvas p-5 shadow-2xl sm:p-6"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="sync-adoption-title"
            className="text-[20px] font-semibold tracking-tight text-ink"
          >
            {t("This account already has data")}
          </h2>
          <p className="text-[13px] leading-relaxed text-ink-muted">
            {t(
              "Your account and this device both contain profiles and settings. Choose how to combine them.",
            )}
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ProfileSummary label={t("On this device")} profiles={summary.localProfiles} t={t} />
          <ProfileSummary label={t("In your account")} profiles={summary.cloudProfiles} t={t} />
        </div>
        <p className="mt-2 text-[12px] text-ink-subtle">
          {t("{count} settings differ", { count: summary.conflictingKeys })}
        </p>

        <div
          className="mt-5 flex flex-col gap-2"
          role="radiogroup"
          aria-label={t("How to combine data")}
        >
          <button
            ref={recommendedOptionRef}
            type="button"
            role="radio"
            aria-checked={strategy === "merge"}
            onClick={() => {
              setStrategy("merge");
              setError(false);
            }}
            disabled={busy}
            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-start transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-55 ${
              strategy === "merge"
                ? "border-[var(--color-accent)] bg-elevated"
                : "border-edge-soft bg-elevated/40 hover:border-edge"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 size-4 shrink-0 rounded-full border-2 ${
                strategy === "merge"
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                  : "border-edge-soft"
              }`}
            />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink">
                {t("Merge everything")}
                <span className="rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-ink">
                  {t("Recommended")}
                </span>
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">
                {t("Combine both: keeps all profiles, addons, and watch history. Cloud wins ties.")}
              </span>
            </span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={strategy === "bring-profiles"}
            onClick={() => {
              setStrategy("bring-profiles");
              setError(false);
            }}
            disabled={busy}
            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-start transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-55 ${
              strategy === "bring-profiles"
                ? "border-[var(--color-accent)] bg-elevated"
                : "border-edge-soft bg-elevated/40 hover:border-edge"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 size-4 shrink-0 rounded-full border-2 ${
                strategy === "bring-profiles"
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                  : "border-edge-soft"
              }`}
            />
            <span className="min-w-0">
              <span className="text-[13px] font-semibold text-ink">
                {t("Keep my profile separate")}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">
                {t("Adds this device's profile alongside the account's profiles.")}
              </span>
            </span>
          </button>

          <div
            className={`rounded-xl border transition-colors ${
              strategy === "merge-into-profile"
                ? "border-[var(--color-accent)] bg-elevated"
                : "border-edge-soft bg-elevated/40"
            }`}
          >
            <button
              type="button"
              role="radio"
              aria-checked={strategy === "merge-into-profile"}
              onClick={() => {
                setStrategy("merge-into-profile");
                setError(false);
              }}
              disabled={busy}
              className="flex w-full items-start gap-3 rounded-xl p-3 text-start transition-colors hover:bg-raised/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 size-4 shrink-0 rounded-full border-2 ${
                  strategy === "merge-into-profile"
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                    : "border-edge-soft"
                }`}
              />
              <span className="min-w-0">
                <span className="text-[13px] font-semibold text-ink">
                  {t("Merge into a profile…")}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">
                  {t("Choose an account profile to receive this device's settings.")}
                </span>
              </span>
            </button>
            {strategy === "merge-into-profile" && (
              <div className="flex flex-col gap-2 border-t border-edge-soft/70 px-3 pb-3 pt-2">
                {summary.cloudProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => {
                      setTargetProfileId(profile.id);
                      setError(false);
                    }}
                    disabled={busy}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-start text-[12.5px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-55 ${
                      targetProfileId === profile.id
                        ? "border-[var(--color-accent)] bg-raised"
                        : "border-edge-soft bg-canvas hover:border-edge"
                    }`}
                  >
                    <span className="truncate font-medium text-ink">{profile.name}</span>
                    {profile.isPrimary && (
                      <span className="shrink-0 rounded-full bg-raised px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                        {t("Primary")}
                      </span>
                    )}
                  </button>
                ))}
                {summary.cloudProfiles.length === 0 && (
                  <p className="text-[12.5px] text-ink-subtle">
                    {t("No account profiles are available.")}
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            role="radio"
            aria-checked={strategy === "cloud"}
            onClick={() => {
              setStrategy("cloud");
              setError(false);
            }}
            disabled={busy}
            className={`flex w-full items-start gap-3 rounded-xl border p-3 text-start transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-55 ${
              strategy === "cloud"
                ? "border-[var(--color-accent)] bg-danger/5"
                : "border-danger/35 bg-danger/5 hover:bg-danger/10"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 size-4 shrink-0 rounded-full border-2 ${
                strategy === "cloud"
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                  : "border-edge-soft"
              }`}
            />
            <span className="min-w-0">
              <span className="text-[13px] font-semibold text-ink">
                {t("Use account data only")}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-danger/80">
                {t("This device's local data is replaced by your account data.")}
              </span>
            </span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={strategy === "local"}
            onClick={() => {
              setStrategy("local");
              setError(false);
            }}
            disabled={busy}
            className={`flex w-full items-start gap-3 rounded-xl border border-danger/35 bg-danger/5 p-3 text-start transition-colors hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-55 ${
              strategy === "local" ? "ring-1 ring-danger" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 size-4 shrink-0 rounded-full border-2 ${
                strategy === "local" ? "border-danger bg-danger" : "border-danger/50"
              }`}
            />
            <span className="min-w-0">
              <span className="text-[13px] font-semibold text-danger">
                {t("Replace account with this device")}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-danger/80">
                {t("Cloud data is overwritten with this device's local data.")}
              </span>
            </span>
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12.5px] text-danger"
          >
            {t("Something went wrong. Try again.")}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-edge-soft/70 pt-4">
          <button
            type="button"
            onClick={() => void cancelSyncSignIn()}
            disabled={busy}
            className="flex h-10 items-center rounded-xl border border-edge-soft px-4 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={() => void continueSignIn()}
            disabled={busy || requiresTarget}
            className="flex h-10 items-center rounded-xl bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {busy ? t("Finishing sign-in…") : t("Continue")}
          </button>
        </div>
      </section>
    </div>
  );
}
