import { Bell, X } from "lucide-react";
import { useRef, useState } from "react";
import { AnchoredMenu } from "@/components/anchored-menu";
import { emitListToast } from "@/components/lists/list-toast";
import { useT } from "@/lib/i18n";
import { removeReminder, useReminders, type ReminderEntry } from "@/lib/reminders";

function summary(entry: ReminderEntry, t: ReturnType<typeof useT>): string {
  const parts: string[] = [];
  if (entry.episodes) parts.push(t("Episodes"));
  if (entry.seasons) parts.push(t("Seasons"));
  const tone =
    entry.tone === "chime" ? t("Chime") : entry.tone === "pulse" ? t("Pulse") : t("Silent");
  return `${parts.join(" + ")} · ${tone}`;
}

export function RemindersManagerButton({
  onOpenItem,
}: {
  onOpenItem?: (entry: ReminderEntry) => void;
}) {
  const t = useT();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const reminders = useReminders();

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("Reminders")}
        title={t("Reminders")}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-edge-soft text-ink-muted transition-colors hover:border-edge hover:text-ink"
      >
        <Bell size={16} strokeWidth={2} />
        {reminders.length > 0 && (
          <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold leading-none text-canvas">
            {reminders.length}
          </span>
        )}
      </button>
      <AnchoredMenu anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} width={320}>
        <div className="animate-popover-in overflow-hidden rounded-2xl border border-edge-soft bg-elevated shadow-[0_18px_50px_-15px_rgba(0,0,0,0.6)]">
          <div className="border-b border-edge-soft/55 px-3.5 pb-2 pt-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
              {t("Reminders")}
            </span>
          </div>
          {reminders.length === 0 ? (
            <p className="px-3.5 py-4 text-[12.5px] leading-snug text-ink-subtle">
              {t("No reminders yet. Use the clock on a show's page to get told about new episodes and seasons.")}
            </p>
          ) : (
            <div className="max-h-[320px] overflow-y-auto py-1.5">
              {reminders.map((r) => (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setOpen(false);
                    onOpenItem?.(r);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setOpen(false);
                      onOpenItem?.(r);
                    }
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 px-3.5 py-2 text-start transition-colors hover:bg-raised"
                >
                  {r.poster ? (
                    <img
                      src={r.poster}
                      alt=""
                      className="h-12 w-9 shrink-0 rounded-md object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded-md bg-raised text-ink-subtle">
                      <Bell size={14} strokeWidth={2} />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13.5px] font-medium text-ink">{r.name}</span>
                    <span className="text-[11.5px] text-ink-subtle">{summary(r, t)}</span>
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeReminder(r.id);
                      emitListToast(t("Reminder removed"));
                    }}
                    aria-label={t("Remove reminder")}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-danger"
                  >
                    <X size={14} strokeWidth={2.2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </AnchoredMenu>
    </>
  );
}
