import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import flagAe from "@/assets/regions/ae.svg";
import flagAr from "@/assets/regions/ar.svg";
import flagAu from "@/assets/regions/au.svg";
import flagBr from "@/assets/regions/br.svg";
import flagCa from "@/assets/regions/ca.svg";
import flagCl from "@/assets/regions/cl.svg";
import flagCo from "@/assets/regions/co.svg";
import flagDe from "@/assets/regions/de.svg";
import flagDk from "@/assets/regions/dk.svg";
import flagEs from "@/assets/regions/es.svg";
import flagFi from "@/assets/regions/fi.svg";
import flagFr from "@/assets/regions/fr.svg";
import flagGb from "@/assets/regions/gb.svg";
import flagHk from "@/assets/regions/hk.svg";
import flagId from "@/assets/regions/id.svg";
import flagIe from "@/assets/regions/ie.svg";
import flagIn from "@/assets/regions/in.svg";
import flagIt from "@/assets/regions/it.svg";
import flagJp from "@/assets/regions/jp.svg";
import flagKr from "@/assets/regions/kr.svg";
import flagMx from "@/assets/regions/mx.svg";
import flagMy from "@/assets/regions/my.svg";
import flagNl from "@/assets/regions/nl.svg";
import flagNo from "@/assets/regions/no.svg";
import flagNz from "@/assets/regions/nz.svg";
import flagPh from "@/assets/regions/ph.svg";
import flagPl from "@/assets/regions/pl.svg";
import flagPt from "@/assets/regions/pt.svg";
import flagSa from "@/assets/regions/sa.svg";
import flagSe from "@/assets/regions/se.svg";
import flagSg from "@/assets/regions/sg.svg";
import flagTh from "@/assets/regions/th.svg";
import flagTr from "@/assets/regions/tr.svg";
import flagTw from "@/assets/regions/tw.svg";
import flagUs from "@/assets/regions/us.svg";
import flagZa from "@/assets/regions/za.svg";

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

const REGION_FLAGS: Record<string, string> = {
  AE: flagAe,
  AR: flagAr,
  AU: flagAu,
  BR: flagBr,
  CA: flagCa,
  CL: flagCl,
  CO: flagCo,
  DE: flagDe,
  DK: flagDk,
  ES: flagEs,
  FI: flagFi,
  FR: flagFr,
  GB: flagGb,
  HK: flagHk,
  ID: flagId,
  IE: flagIe,
  IN: flagIn,
  IT: flagIt,
  JP: flagJp,
  KR: flagKr,
  MX: flagMx,
  MY: flagMy,
  NL: flagNl,
  NO: flagNo,
  NZ: flagNz,
  PH: flagPh,
  PL: flagPl,
  PT: flagPt,
  SA: flagSa,
  SE: flagSe,
  SG: flagSg,
  TH: flagTh,
  TR: flagTr,
  TW: flagTw,
  US: flagUs,
  ZA: flagZa,
};

function flagFor(code: string): string | null {
  return REGION_FLAGS[code.toUpperCase()] ?? null;
}

function FlagChip({ code, size = 24 }: { code: string; size?: number }) {
  const src = flagFor(code);
  if (!src) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-sm bg-canvas/60 font-mono text-[9px] font-bold text-ink-subtle ring-1 ring-edge-soft"
        style={{ width: size, height: Math.round(size * 0.75) }}
      >
        {code}
      </span>
    );
  }
  return (
    <span
      className="inline-block overflow-hidden rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.4)] ring-1 ring-black/20"
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
  const t = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = REGIONS.find((r) => r.code === value) ?? { code: value, label: value };

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
    const q = query.trim().toLowerCase();
    if (!q) return REGIONS;
    return REGIONS.filter(
      (r) => r.label.toLowerCase().includes(q) || r.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-14 w-full items-center gap-3.5 rounded-2xl border bg-elevated px-4 text-start transition-all ${
          open
            ? "border-ink shadow-[0_0_0_3px_rgba(255,255,255,0.04)]"
            : "border-edge hover:border-edge"
        }`}
      >
        <FlagChip code={current.code} size={36} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            {t("Region")}
          </span>
          <span className="truncate text-[15px] font-medium text-ink">{current.label}</span>
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
            className="absolute left-0 right-0 z-30 mt-2 flex max-h-[420px] flex-col overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
            style={{ animation: "harbor-fade-in 140ms ease-out both" }}
          >
            <div className="flex items-center gap-2 border-b border-edge-soft px-4 py-3">
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
                className="h-7 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-subtle/60 outline-none"
              />
            </div>
            <div className="flex-1 overflow-y-auto py-1.5">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13px] text-ink-subtle">
                  {t("No matches")}
                </div>
              ) : (
                filtered.map((r) => {
                  const selected = r.code === current.code;
                  return (
                    <button
                      key={r.code}
                      onClick={() => {
                        onChange(r.code);
                        setOpen(false);
                      }}
                      className={`flex h-12 w-full items-center gap-3 px-3 text-start transition-colors ${
                        selected
                          ? "bg-raised text-ink"
                          : "text-ink-muted hover:bg-canvas/50 hover:text-ink"
                      }`}
                    >
                      <FlagChip code={r.code} size={30} />
                      <span className="flex-1 truncate text-[14px] font-medium">{r.label}</span>
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
