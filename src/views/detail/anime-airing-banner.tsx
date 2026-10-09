import { CalendarClock } from "lucide-react";
import { ReminderInlineLink } from "@/components/reminder-button";
import { useT } from "@/lib/i18n";
import { formatRemaining, useNow } from "@/lib/use-now";

export function AnimeAiringBanner({
  nextAiring,
  reminderSeed,
}: {
  nextAiring: { airingAt: number; episode: number };
  reminderSeed?: { id: string; name: string; poster?: string };
}) {
  const t = useT();
  const now = useNow(30000);
  const airMs = nextAiring.airingAt * 1000;
  const remaining = airMs - now;
  if (remaining <= 0) return null;

  const when = new Date(airMs).toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-elevated px-5 py-4">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
          <CalendarClock size={16} strokeWidth={2.2} className="shrink-0 text-accent" />
          {t("Episode {n} airs {when}", { n: nextAiring.episode, when })}
        </div>
        <div className="ps-[26px] text-[13px] tabular-nums text-ink-muted">
          {t("in {time}", { time: formatRemaining(remaining) })}
        </div>
      </div>
      {reminderSeed && (
        <ReminderInlineLink
          id={reminderSeed.id}
          type="series"
          name={reminderSeed.name}
          poster={reminderSeed.poster}
        />
      )}
    </div>
  );
}
