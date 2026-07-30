import { Check, ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n";

type Level = "strict" | "balanced" | "off";
type Reason = "clean" | "cam" | "mismatch" | "oversized" | "malware";

const REJECT: Record<Reason, Level[]> = {
  clean: [],
  malware: ["strict", "balanced"],
  mismatch: ["strict", "balanced"],
  oversized: ["strict"],
  cam: ["strict"],
};

const REASON_LABEL: Record<Exclude<Reason, "clean">, string> = {
  cam: "Likely cam",
  mismatch: "Wrong year",
  oversized: "Size outlier",
  malware: "Suspicious file",
};

const STREAMS: Array<{ badges: string[]; name: string; reason: Reason }> = [
  { badges: ["2160p", "HDR", "Atmos"], name: "Example.Movie.2024.2160p.WEB-DL", reason: "clean" },
  { badges: ["1080p"], name: "Example.Movie.2024.1080p.BluRay", reason: "clean" },
  { badges: ["CAM"], name: "Example.Movie.2024.CAM", reason: "cam" },
  { badges: ["1080p"], name: "Example.Movie.2021.1080p", reason: "mismatch" },
  { badges: ["2160p", "REMUX"], name: "Example.Movie.2024.REMUX.94GB", reason: "oversized" },
  { badges: ["EXE"], name: "Example.Movie.setup.exe", reason: "malware" },
];

function isBlocked(reason: Reason, level: Level): boolean {
  return level !== "off" && REJECT[reason].includes(level);
}

function Badge({ label }: { label: string }) {
  const tone =
    label === "CAM" || label === "EXE"
      ? "bg-amber-500/15 text-amber-300 ring-amber-500/30"
      : label === "HDR" || label === "DV"
        ? "bg-violet-500/15 text-violet-300 ring-violet-500/30"
        : label === "Atmos"
          ? "bg-sky-500/15 text-sky-300 ring-sky-500/30"
          : label === "REMUX"
            ? "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30"
            : "bg-elevated text-ink-muted ring-edge-soft";
  return (
    <span className={`flex h-5 shrink-0 items-center rounded-[5px] px-1.5 text-[9.5px] font-bold tracking-wide ring-1 ${tone}`}>
      {label}
    </span>
  );
}

export function StreamFilterPreview({ level }: { level: Level }) {
  const t = useT();
  const blocked = STREAMS.filter((s) => isBlocked(s.reason, level)).length;
  const shown = STREAMS.length - blocked;
  return (
    <div className="mt-1 flex flex-col gap-3 rounded-2xl border border-edge-soft bg-canvas/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          <ShieldCheck size={14} className={level === "off" ? "text-ink-subtle" : "text-accent"} />
          {t("What gets through")}
        </span>
        {level === "off" ? (
          <span className="text-[11px] text-amber-400/90">{t("No filtering")}</span>
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] tabular-nums text-ink-subtle">
            <span className="font-semibold text-ink">{blocked}</span> {t("blocked")}
            <span className="text-edge">·</span>
            <span className="font-semibold text-ink">{shown}</span> {t("shown")}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {STREAMS.map((s) => {
          const off = isBlocked(s.reason, level);
          return (
            <div
              key={s.name}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${off ? "bg-canvas/40" : ""}`}
            >
              <span
                aria-hidden
                className={`h-[18px] w-[18px] shrink-0 rounded-[4px] bg-elevated ring-1 ring-inset ring-white/10 ${off ? "opacity-50" : ""}`}
              />
              <span className={`flex shrink-0 items-center gap-1 ${off ? "opacity-55" : ""}`}>
                {s.badges.map((b) => (
                  <Badge key={b} label={b} />
                ))}
              </span>
              <span
                className={`min-w-0 flex-1 truncate font-mono text-[11px] ${
                  off ? "text-ink-subtle/70 line-through" : "text-ink-muted"
                }`}
              >
                {s.name}
              </span>
              {off ? (
                <span className="shrink-0 rounded-md bg-danger/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-danger ring-1 ring-danger/25">
                  {t(REASON_LABEL[s.reason as Exclude<Reason, "clean">])}
                </span>
              ) : (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/90 text-canvas">
                  <Check size={10} strokeWidth={3} />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
