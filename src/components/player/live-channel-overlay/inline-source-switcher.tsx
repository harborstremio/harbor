import { useT } from "@/lib/i18n";
import type { IptvPlaylistSource } from "@/lib/iptv/types";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function InlineSourceSwitcher({
  sources,
  selectedId,
  onSelect,
}: {
  sources: IptvPlaylistSource[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  if (sources.length <= 1) return null;
  const active = sources.find((s) => s.id === selectedId);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-2.5 rounded-xl border border-edge-soft/55 bg-elevated px-3.5 pe-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-raised"
      >
        <span className="flex h-2 w-2 shrink-0 rounded-full bg-danger" />
        <span className="max-w-[200px] truncate">{active?.name ?? t("Pick playlist")}</span>
        <ChevronDown
          size={15}
          strokeWidth={2}
          className={`text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute start-0 top-[calc(100%+8px)] z-[100] w-[300px] overflow-hidden rounded-2xl border border-edge-soft bg-elevated shadow-[0_18px_50px_-15px_rgba(0,0,0,0.6)]">
          <div className="border-b border-edge-soft/55 px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {t("Browse provider")}
          </div>
          <div className="max-h-[320px] overflow-y-auto py-1.5">
            {sources.map((s) => {
              const isActive = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelect(s.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start text-[13.5px] transition-colors ${
                    isActive ? "bg-raised text-ink" : "text-ink-muted hover:bg-raised hover:text-ink"
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${isActive ? "bg-danger" : "bg-ink-subtle/45"}`} />
                  <span className="truncate">{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
