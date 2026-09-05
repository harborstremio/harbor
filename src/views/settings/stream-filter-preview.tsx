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

const SAMPLE: Array<{ reason: Reason; weight: number }> = [
  { reason: "clean", weight: 100 },
  { reason: "clean", weight: 82 },
  { reason: "cam", weight: 64 },
  { reason: "mismatch", weight: 74 },
  { reason: "oversized", weight: 92 },
  { reason: "malware", weight: 46 },
];

function isBlocked(reason: Reason, level: Level): boolean {
  return level !== "off" && REJECT[reason].includes(level);
}

export function StreamFilterPreview({ level }: { level: Level }) {
  const t = useT();
  const kept = SAMPLE.filter((s) => !isBlocked(s.reason, level)).length;

  return (
    <div className="flex flex-col gap-3 rounded-md bg-elevated px-4 py-4">
      <span className="harbor-settings-label flex items-baseline gap-2">
        {t("What gets through")}
        <span className="text-ink tabular-nums">
          {kept}/{SAMPLE.length}
        </span>
      </span>

      <div className="flex flex-col gap-1.5">
        {SAMPLE.map((s, i) => {
          const blocked = isBlocked(s.reason, level);
          return (
            <span key={i} className="flex items-center gap-3">
              <span className="relative block h-[7px] flex-1 overflow-hidden rounded-full bg-canvas">
                <span
                  className="absolute inset-y-0 start-0 block rounded-full bg-ink transition-[width,opacity] duration-300 ease-in-out"
                  style={{ width: `${s.weight}%`, opacity: blocked ? 0.14 : 0.72 }}
                />
              </span>
              <span
                className={`w-[104px] shrink-0 text-end text-[13px] font-bold leading-[17px] tracking-[0.72px] transition-colors duration-200 ${
                  blocked ? "text-ink-subtle" : "text-ink-subtle/0"
                }`}
              >
                {s.reason === "clean" ? "" : t(REASON_LABEL[s.reason])}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
