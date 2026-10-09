import type { ReactNode } from "react";
import { Film, Sparkles, Tv2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { CustomCalendar } from "./constants";

export function MediaTypeGate({
  value,
  onToggle,
}: {
  value: CustomCalendar["mediaTypes"];
  onToggle: (kind: "movie" | "tv" | "anime") => void;
}) {
  const t = useT();
  const items: Array<{ kind: "movie" | "tv" | "anime"; label: string; icon: ReactNode }> = [
    { kind: "movie", label: t("Movies"), icon: <Film size={15} strokeWidth={2.1} /> },
    { kind: "tv", label: t("Series"), icon: <Tv2 size={15} strokeWidth={2.1} /> },
    { kind: "anime", label: t("Anime"), icon: <Sparkles size={15} strokeWidth={2.1} /> },
  ];
  return (
    <div className="flex items-center gap-1 rounded-2xl bg-elevated/40 p-1 ring-1 ring-edge-soft/60">
      {items.map((it) => {
        const on = value[it.kind];
        return (
          <button
            key={it.kind}
            type="button"
            onClick={() => onToggle(it.kind)}
            aria-pressed={on}
            className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold transition-colors ${
              on ? "bg-ink text-canvas" : "text-ink-muted hover:bg-raised hover:text-ink"
            }`}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
