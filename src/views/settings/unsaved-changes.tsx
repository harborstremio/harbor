import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { setNavGuard } from "@/lib/nav-guard";
import { useSettings, type Settings } from "@/lib/settings";
import { changedSettingKeys } from "@/lib/settings/diff";

/** Settings apply live so previews keep working. This snapshots them on entry
 *  and offers Save (accept the current values) or Reset (restore the snapshot),
 *  and blocks navigation away while the two differ. */
export function SettingsUnsavedChanges({ active }: { active: boolean }) {
  const t = useT();
  const { settings, update } = useSettings();
  const [snapshot, setSnapshot] = useState<Settings | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<{ proceed: () => void } | null>(null);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Start a session when Settings becomes visible; end it when we leave, so a
  // kept-alive Settings view doesn't hold a stale baseline.
  useEffect(() => {
    if (active) setSnapshot((cur) => cur ?? settingsRef.current);
    else {
      setSnapshot(null);
      setConfirmReset(false);
      setPendingLeave(null);
    }
  }, [active]);

  const changed = useMemo(
    () => (snapshot ? changedSettingKeys(settings, snapshot) : []),
    [settings, snapshot],
  );
  const dirty = changed.length > 0;

  const save = useCallback(() => {
    setSnapshot(settingsRef.current);
  }, []);

  const reset = useCallback(() => {
    if (snapshot) update(snapshot);
    setConfirmReset(false);
  }, [snapshot, update]);

  useEffect(() => {
    if (!dirty) return;
    setNavGuard((proceed) => {
      setPendingLeave({ proceed });
      return true;
    });
    return () => setNavGuard(null);
  }, [dirty]);

  const leaveSaving = useCallback(() => {
    const go = pendingLeave?.proceed;
    setSnapshot(settingsRef.current);
    setPendingLeave(null);
    setNavGuard(null);
    go?.();
  }, [pendingLeave]);

  const leaveDiscarding = useCallback(() => {
    const go = pendingLeave?.proceed;
    if (snapshot) update(snapshot);
    setPendingLeave(null);
    setNavGuard(null);
    go?.();
  }, [pendingLeave, snapshot, update]);

  if (!active) return null;

  return (
    <>
      {/* The bar is centered on the content column and lifted clear of
          SettingsJumpBar, which is fixed at bottom-5 with the same nav offset. */}
      {dirty && !pendingLeave && (
        <div className="pointer-events-none fixed bottom-[88px] left-[calc(50%+144px)] z-[190] flex w-full max-w-2xl -translate-x-1/2 justify-center px-4 rtl:left-[calc(50%-144px)]">
          <div className="animate-modal-in pointer-events-auto flex w-full items-center gap-3 rounded-xl border border-edge-soft bg-elevated/95 px-4 py-3 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-sm">
            <AlertTriangle size={17} className="shrink-0 text-amber-300" strokeWidth={2.2} />
            <span className="flex-1 truncate text-[13.5px] text-ink">
              {changed.length === 1
                ? t("Careful — you have 1 unsaved change.")
                : t("Careful — you have {n} unsaved changes.", { n: changed.length })}
            </span>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
            >
              {t("Reset")}
            </button>
            <button
              type="button"
              onClick={save}
              className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              {t("Save Changes")}
            </button>
          </div>
        </div>
      )}

      {confirmReset && (
        <ConfirmDialog
          title={t("Discard your changes?")}
          body={
            changed.length === 1
              ? t("1 setting will be restored to what it was when you opened Settings.")
              : t("{n} settings will be restored to what they were when you opened Settings.", {
                  n: changed.length,
                })
          }
          onCancel={() => setConfirmReset(false)}
          actions={[
            { label: t("Keep editing"), onClick: () => setConfirmReset(false), tone: "ghost" },
            { label: t("Discard changes"), onClick: reset, tone: "danger" },
          ]}
        />
      )}

      {pendingLeave && (
        <ConfirmDialog
          title={t("You have unsaved changes")}
          body={t("Apply your changes before leaving Settings, or discard them?")}
          onCancel={() => setPendingLeave(null)}
          actions={[
            { label: t("Cancel"), onClick: () => setPendingLeave(null), tone: "ghost" },
            { label: t("Discard"), onClick: leaveDiscarding, tone: "danger" },
            { label: t("Apply"), onClick: leaveSaving, tone: "accent" },
          ]}
        />
      )}
    </>
  );
}

type Action = { label: string; onClick: () => void; tone: "ghost" | "danger" | "accent" };

function ConfirmDialog({
  title,
  body,
  onCancel,
  actions,
}: {
  title: string;
  body: string;
  onCancel: () => void;
  actions: Action[];
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const tone: Record<Action["tone"], string> = {
    ghost: "text-ink-muted hover:bg-raised hover:text-ink",
    danger: "text-rose-300 hover:bg-rose-500/10",
    accent: "bg-accent text-canvas hover:opacity-90",
  };

  return createPortal(
    <div
      data-tv-focus-scope
      className="animate-fade-in fixed inset-0 z-[220] flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-modal-in flex w-[min(92vw,420px)] flex-col gap-3 rounded-2xl border border-edge-soft bg-elevated p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <h2 className="font-display text-[18px] font-medium text-ink">{title}</h2>
        <p className="text-[13.5px] leading-relaxed text-ink-muted">{body}</p>
        <div className="mt-2 flex items-center justify-end gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${tone[a.tone]}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
