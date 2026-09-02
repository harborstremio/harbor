import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { t, useUiLanguage } from "@/lib/i18n";
import { regionFlagSrc } from "@/lib/region-flags";

const REGIONS: Array<{ code: string; label: string }> = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "GB", label: "United Kingdom" },
  { code: "IE", label: "Ireland" },
  { code: "AU", label: "Australia" },
  { code: "NZ", label: "New Zealand" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" },
  { code: "SE", label: "Sweden" },
  { code: "NO", label: "Norway" },
  { code: "DK", label: "Denmark" },
  { code: "FI", label: "Finland" },
  { code: "PL", label: "Poland" },
  { code: "PT", label: "Portugal" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
  { code: "AR", label: "Argentina" },
  { code: "CL", label: "Chile" },
  { code: "CO", label: "Colombia" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
  { code: "IN", label: "India" },
  { code: "ID", label: "Indonesia" },
  { code: "TH", label: "Thailand" },
  { code: "PH", label: "Philippines" },
  { code: "SG", label: "Singapore" },
  { code: "MY", label: "Malaysia" },
  { code: "TW", label: "Taiwan" },
  { code: "HK", label: "Hong Kong" },
  { code: "TR", label: "Türkiye" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "SA", label: "Saudi Arabia" },
  { code: "ZA", label: "South Africa" },
];

function FlagChip({ code, size = 24 }: { code: string; size?: number }) {
  const src = regionFlagSrc(code);
  if (!src) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-sm bg-canvas font-mono text-[9px] font-bold text-ink-subtle ring-1 ring-edge-soft"
        style={{ width: size, height: Math.round(size * 0.75) }}
      >
        {code}
      </span>
    );
  }
  return (
    <span
      className="inline-block overflow-hidden rounded-sm ring-1 ring-edge-soft"
      style={{ width: size, height: Math.round(size * 0.75) }}
    >
      <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />
    </span>
  );
}

export function RegionPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const language = useUiLanguage();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = REGIONS.find((r) => r.code === value);
  const currentCode = current?.code ?? value;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      setQuery("");
    }
  }, [open]);

  const filtered: Array<{ code: string; label: string }> = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return REGIONS;
    return REGIONS.filter((region) => {
      const localizedLabel = t(region.label).toLocaleLowerCase();
      return (
        localizedLabel.includes(q) ||
        region.label.toLocaleLowerCase().includes(q) ||
        region.code.toLocaleLowerCase().includes(q)
      );
    });
  }, [language, query]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-14 w-full items-center gap-3.5 rounded-md px-4 text-start transition-colors ${
          open ? "bg-elevated" : "bg-surface hover:bg-elevated"
        }`}
      >
        <FlagChip code={currentCode} size={36} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            {t("Region")}
          </span>
          <span className="truncate text-[15px] font-medium text-ink">
            {current ? t(current.label) : value}
          </span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={`text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onMouseDown={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            className="absolute left-0 right-0 z-30 mt-2 flex max-h-[420px] flex-col overflow-hidden rounded-md bg-surface harbor-float"
            style={{ animation: "harbor-fade-in 140ms ease-out both" }}
          >
            <div className="p-2">
              <div className="flex items-center gap-2 rounded-md bg-canvas px-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle
                    cx="11"
                    cy="11"
                    r="6.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    className="text-ink-subtle"
                  />
                  <path
                    d="M16 16l4 4"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    className="text-ink-subtle"
                  />
                </svg>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("Search countries...")}
                  className="h-10 flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-subtle outline-none"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-1.5 pb-1.5 [scrollbar-width:thin]">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13px] text-ink-subtle">
                  {t("No matches")}
                </div>
              ) : (
                filtered.map((r) => {
                  const selected = r.code === currentCode;
                  return (
                    <button
                      key={r.code}
                      onClick={() => {
                        onChange(r.code);
                        setOpen(false);
                      }}
                      className={`flex h-12 w-full items-center gap-3 rounded-md px-2.5 text-start transition-colors ${
                        selected
                          ? "bg-elevated text-ink"
                          : "text-ink-muted hover:bg-elevated hover:text-ink"
                      }`}
                    >
                      <FlagChip code={r.code} size={30} />
                      <span className="flex-1 truncate text-[13.5px] font-medium">
                        {t(r.label)}
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] tracking-wider text-ink-subtle">
                        {r.code}
                      </span>
                      {selected && <Check size={14} strokeWidth={2.4} className="ms-1 text-ink" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
