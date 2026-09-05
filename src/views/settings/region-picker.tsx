import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnchoredMenu } from "@/components/anchored-menu";
import { advanceFocus } from "@/lib/keyboard-navigation";
import { getDirection, isBackKey } from "@/lib/keyboard-navigation/geometry";
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
        className="inline-flex items-center justify-center rounded-sm bg-canvas font-mono text-[13px] font-bold text-ink-subtle ring-1 ring-edge-soft"
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
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const current = REGIONS.find((r) => r.code === value);
  const currentCode = current?.code ?? value;

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const enterMenu = useCallback((el: HTMLDivElement | null) => {
    listRef.current = el;
    if (!el) return;
    const target =
      el.querySelector<HTMLElement>('[data-selected="true"]') ??
      el.querySelector<HTMLElement>('[role="option"]');
    if (target) advanceFocus(target);
  }, []);

  const close = (restore: boolean) => {
    setOpen(false);
    const trigger = btnRef.current;
    if (restore && trigger) advanceFocus(trigger);
  };

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isBackKey(e.nativeEvent)) {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    const dir = getDirection(e.nativeEvent);
    if (dir !== "up" && dir !== "down") return;
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    if (!items.length) return;
    e.preventDefault();
    const from = items.indexOf(e.target as HTMLElement);
    const next =
      from < 0
        ? dir === "down"
          ? items[0]
          : items[items.length - 1]
        : items[from + (dir === "down" ? 1 : -1)];
    if (!next) return;
    advanceFocus(next, dir);
  };

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
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-14 w-full items-center gap-3.5 rounded-md px-4 text-start transition-colors ${
          open ? "bg-elevated" : "bg-surface hover:bg-elevated"
        }`}
      >
        <FlagChip code={currentCode} size={36} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="harbor-settings-label">
            {t("Region")}
          </span>
          <span className="truncate text-[16.5px] font-medium leading-[24px] text-ink">
            {current ? t(current.label) : value}
          </span>
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2}
          className={`text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnchoredMenu
        anchorRef={btnRef}
        open={open}
        onClose={() => close(!!listRef.current?.contains(document.activeElement))}
      >
        <div
          ref={enterMenu}
          role="listbox"
          onKeyDown={onMenuKeyDown}
          className="flex max-h-[420px] flex-col overflow-hidden rounded-md bg-surface harbor-float"
          style={{ animation: "harbor-fade-in 140ms ease-out both" }}
        >
          <div className="p-2">
            <div className="flex items-center gap-2 rounded-md bg-canvas px-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Search countries...")}
                className="h-11 min-w-0 flex-1 bg-transparent text-[16.5px] text-ink placeholder:text-ink-subtle outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-1.5 pb-1.5 [scrollbar-width:thin]">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-[15.5px] text-ink-subtle">
                {t("No matches")}
              </div>
            ) : (
              filtered.map((r) => {
                const selected = r.code === currentCode;
                return (
                  <button
                    key={r.code}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-selected={selected}
                    onClick={() => {
                      onChange(r.code);
                      close(true);
                    }}
                    className={`flex h-12 w-full items-center gap-3 rounded-md px-2.5 text-start transition-colors ${
                      selected
                        ? "bg-elevated text-ink"
                        : "text-ink-muted hover:bg-elevated hover:text-ink"
                    }`}
                  >
                    <FlagChip code={r.code} size={30} />
                    <span className="min-w-0 flex-1 truncate text-[15.5px] font-medium">
                      {t(r.label)}
                    </span>
                    <span className="shrink-0 font-mono text-[13px] font-bold tracking-[0.72px] text-ink-subtle">
                      {r.code}
                    </span>
                    {selected && <Check size={18} strokeWidth={2.4} className="ms-1 shrink-0 text-ink" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </AnchoredMenu>
    </div>
  );
}
