import { useT } from "@/lib/i18n";
import { formatRemaining, useNow } from "@/lib/use-now";

export function AiringCountdown({ atMs }: { atMs: number }) {
  const t = useT();
  const now = useNow(30000);
  const remaining = atMs - now;
  if (remaining <= 0) return null;
  return <span className="text-accent"> · {t("in {time}", { time: formatRemaining(remaining) })}</span>;
}
