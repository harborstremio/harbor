import { useMemo, useState } from "react";
import { Link2, Unlink, X } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import { useT } from "@/lib/i18n";
import { getEpgOverride, setEpgOverride } from "@/lib/iptv/epg-map";
import type { EpgIndex, IptvChannel } from "@/lib/iptv/types";

export function EpgMatchModal({
  channel,
  epg,
  onClose,
}: {
  channel: IptvChannel;
  epg: EpgIndex;
  onClose: () => void;
}) {
  const t = useT();
  const [query, setQuery] = useState(channel.name);
  const current = getEpgOverride(channel.id);

  const entries = useMemo(() => {
    const out: { id: string; sample: string }[] = [];
    for (const [id, programs] of epg.byChannel) {
      out.push({ id, sample: programs[0]?.title ?? "" });
    }
    out.sort((a, b) => a.id.localeCompare(b.id));
    return out;
  }, [epg]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    const scored = entries.filter((e) => {
      if (tokens.length === 0) return true;
      const hay = `${e.id} ${e.sample}`.toLowerCase();
      return tokens.some((t) => hay.includes(t));
    });
    return scored.slice(0, 120);
  }, [entries, query]);

  const assign = (tvgId: string | null) => {
    setEpgOverride(channel.id, tvgId);
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center bg-canvas/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-[520px] flex-col overflow-hidden rounded-lg bg-elevated ring-1 ring-edge-soft shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center gap-3 border-b border-edge-soft/55 px-5 py-4">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-semibold text-ink">{t("Match EPG channel")}</span>
            <span className="truncate text-[12px] text-ink-muted">{channel.name}</span>
          </div>
          {current && (
            <button
              onClick={() => assign(null)}
              className="flex h-9 items-center gap-1.5 rounded-md bg-white/[0.06] px-3 text-[12.5px] font-medium text-ink-muted transition-colors duration-150 hover:bg-white/[0.10] hover:text-ink"
            >
              <Unlink size={13} strokeWidth={2} />
              {t("Clear match")}
            </button>
          )}
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-white/[0.06] text-ink-subtle transition-colors duration-150 hover:bg-white/[0.10] hover:text-ink"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
        <div className="flex items-center gap-2.5 border-b border-edge-soft/55 px-5 py-3">
          <Search size={14} strokeWidth={2} className="text-ink-subtle" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search {n} EPG channels", { n: entries.length.toLocaleString() })}
            autoFocus
            className="flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-subtle focus:outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto py-1.5">
          {visible.map((e) => (
            <button
              key={e.id}
              onClick={() => assign(e.id)}
              className={`flex w-full items-center gap-2.5 px-5 py-2 text-start transition-colors hover:bg-elevated/70 ${
                current === e.id ? "bg-elevated text-ink" : "text-ink-muted"
              }`}
            >
              <Link2 size={13} strokeWidth={2} className="shrink-0 text-ink-subtle" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{e.id}</span>
                {e.sample && (
                  <span className="block truncate text-[11.5px] text-ink-subtle">{e.sample}</span>
                )}
              </span>
              {current === e.id && (
                <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                  {t("Matched")}
                </span>
              )}
            </button>
          ))}
          {visible.length === 0 && (
            <div className="px-5 py-8 text-center text-[12.5px] text-ink-subtle">
              {t("No EPG channels match. This playlist's EPG source may be empty.")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
