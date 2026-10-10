import { useEffect, useRef } from "react";
import { Lock, Unlock } from "lucide-react";
import { formatBindingForDisplay } from "@/lib/hotkeys";
import { useT } from "@/lib/i18n";

export function PlayerInteractionLockControls({
  enabled,
  locked,
  visible,
  binding,
  onLock,
  onUnlock,
}: {
  enabled: boolean;
  locked: boolean;
  visible: boolean;
  binding: string;
  onLock: () => void;
  onUnlock: () => void;
}) {
  const t = useT();
  const unlockRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (locked && visible) unlockRef.current?.focus({ preventScroll: true });
  }, [locked, visible]);

  if (!enabled || (!locked && !visible)) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[4000] ${locked ? "bg-black/[0.01]" : ""}`}
      aria-live="polite"
    >
      {locked && visible ? (
        <button
          ref={unlockRef}
          type="button"
          data-player-unlock-control
          onClick={onUnlock}
          className="pointer-events-auto absolute left-1/2 top-5 flex min-h-11 -translate-x-1/2 cursor-pointer items-center gap-2.5 rounded-full border border-white/15 bg-black/70 px-4 text-sm font-semibold text-white shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-[background-color,border-color,transform] duration-150 hover:border-white/25 hover:bg-black/80 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none"
          aria-label={t("Unlock player controls ({binding})", {
            binding: formatBindingForDisplay(binding),
          })}
        >
          <Unlock aria-hidden="true" className="size-4" strokeWidth={2} />
          <span>{t("Unlock controls")}</span>
          <kbd className="rounded-md border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/65">
            {formatBindingForDisplay(binding)}
          </kbd>
        </button>
      ) : !locked ? (
        <button
          type="button"
          onClick={onLock}
          className="pointer-events-auto absolute left-1/2 top-5 grid size-11 -translate-x-1/2 cursor-pointer place-items-center rounded-full border border-white/10 bg-black/45 text-white/85 shadow-lg backdrop-blur-xl transition-[background-color,border-color,color,transform] duration-150 hover:border-white/20 hover:bg-black/65 hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none"
          aria-label={t("Lock player controls ({binding})", {
            binding: formatBindingForDisplay(binding),
          })}
          title={t("Lock controls · {binding}", {
            binding: formatBindingForDisplay(binding),
          })}
        >
          <Lock aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
      ) : null}
      <span className="sr-only">
        {locked ? t("Player controls locked") : t("Player controls unlocked")}
      </span>
    </div>
  );
}
