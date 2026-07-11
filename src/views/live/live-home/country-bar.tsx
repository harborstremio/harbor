import { useT } from "@/lib/i18n";
import { flagUrl, type Country } from "@/lib/iptv/country-detect";
import { Globe } from "lucide-react";
import { useState } from "react";

export function CountryBar({
  countries,
  selected,
  onToggle,
  onClear,
}: {
  countries: Array<Country & { count: number }>;
  selected: string[];
  onToggle: (code: string) => void;
  onClear: () => void;
}) {
  const t = useT();
  if (countries.length < 2) return null;
  const sel = new Set(selected);
  return (
    <div className="flex flex-col gap-3 ps-[9px]">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
        <Globe size={13} strokeWidth={2.2} />
        {t("Browse by country")}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip active={sel.size === 0} onClick={onClear} label={t("All")} />
        {countries.map((c) => (
          <Chip
            key={c.code}
            active={sel.has(c.code)}
            onClick={() => onToggle(c.code)}
            label={c.name}
            code={c.code}
            short={c.short}
            count={c.count}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  code,
  short,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  code?: string;
  short?: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-10 shrink-0 items-center gap-2.5 rounded-full border ps-2 pe-4 text-[13.5px] font-medium transition-colors ${
        active
          ? "border-transparent bg-ink text-canvas"
          : "border-edge-soft/60 bg-elevated text-ink-muted hover:border-edge hover:text-ink"
      }`}
    >
      {code ? (
        <FlagMark code={code} short={short ?? code} active={active} />
      ) : (
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full ${
            active ? "bg-canvas/20 text-canvas" : "bg-canvas/70 text-ink-subtle"
          }`}
        >
          <Globe size={13} strokeWidth={2.2} />
        </span>
      )}
      <span className="max-w-[150px] truncate">{label}</span>
      {count != null && (
        <span className={`text-[11.5px] tabular-nums ${active ? "text-canvas/65" : "text-ink-subtle"}`}>
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );
}

function FlagMark({ code, short, active }: { code: string; short: string; active: boolean }) {
  const [err, setErr] = useState(false);
  const url = flagUrl(code);
  if (url && !err) {
    return (
      <img
        src={url}
        alt=""
        draggable={false}
        onError={() => setErr(true)}
        className="h-[18px] w-[26px] shrink-0 rounded-[3px] object-cover ring-1 ring-black/25"
      />
    );
  }
  return (
    <span
      className={`flex h-6 min-w-[28px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold tracking-[0.04em] ${
        active ? "bg-canvas/20 text-canvas" : "bg-canvas/70 text-ink-subtle"
      }`}
    >
      {short}
    </span>
  );
}
