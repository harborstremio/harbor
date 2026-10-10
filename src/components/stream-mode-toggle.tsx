import { useT } from "@/lib/i18n";
import type { StreamMode } from "@/lib/streams/mode";

export type { StreamMode } from "@/lib/streams/mode";

const MODES: Array<{ v: StreamMode; label: string }> = [
  { v: "both", label: "Both" },
  { v: "addons", label: "Direct/debrid" },
  { v: "p2p", label: "P2P" },
];

export function StreamModeToggle({
  mode,
  onChange,
  className = "",
}: {
  mode: StreamMode;
  onChange: (m: StreamMode) => void;
  className?: string;
}) {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t("Source mode")}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border border-edge-soft bg-surface/70 p-0.5 ${className}`}
    >
      {MODES.map((m) => (
        <button
          key={m.v}
          type="button"
          onClick={() => onChange(m.v)}
          aria-pressed={mode === m.v}
          title={
            m.v === "both"
              ? t("Show direct, debrid, and peer-to-peer sources")
              : m.v === "addons"
                ? t("Prefer direct and debrid sources; keep P2P when only web links are available")
                : t("Prefer peer-to-peer torrent sources")
          }
          className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
            mode === m.v ? "bg-accent text-canvas" : "text-ink-muted hover:text-ink"
          }`}
        >
          {t(m.label)}
        </button>
      ))}
    </div>
  );
}
