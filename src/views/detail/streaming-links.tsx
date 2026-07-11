import { useT } from "@/lib/i18n";
import { animeStreamerInfo } from "@/lib/providers/anime-streamer";
import type { KitsuStreamer } from "@/lib/providers/kitsu";
import { openUrl } from "@/lib/window";
import { useState } from "react";

export function StreamingLinks({ streamers }: { streamers: KitsuStreamer[] }) {
  const t = useT();
  const seen = new Set<string>();
  const unique = streamers.filter((s) => {
    const k = s.service.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-subtle">{t("Watch on")}</p>
      <div className="flex flex-wrap gap-2.5">
        {unique.map((s) => (
          <StreamingLinkChip key={`${s.id}-${s.url}`} streamer={s} />
        ))}
      </div>
    </div>
  );
}

function StreamingLinkChip({ streamer }: { streamer: KitsuStreamer }) {
  const info = animeStreamerInfo(streamer.service);
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={() => openUrl(streamer.url)}
      className="group flex h-11 items-center gap-2.5 rounded-xl border border-edge-soft bg-elevated/70 px-4 transition-[transform,background-color,border-color] duration-150 hover:border-ink-subtle hover:bg-elevated active:scale-[0.97]"
      style={{ boxShadow: `inset 0 0 0 1px ${info.brandColor}22` }}
    >
      {info.logo && !logoFailed ? (
        <img
          src={info.logo}
          alt={streamer.service}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setLogoFailed(true)}
          className="h-[18px] w-auto select-none object-contain"
          style={{ maxWidth: 110 }}
        />
      ) : (
        <span className="text-[13.5px] font-semibold tracking-tight" style={{ color: info.brandColor }}>
          {streamer.service}
        </span>
      )}
    </button>
  );
}
