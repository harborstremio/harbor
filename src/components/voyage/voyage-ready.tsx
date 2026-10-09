import { Flag } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useT } from "@/lib/i18n";
import { endVoyage, metaById } from "@/lib/voyage/store";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { usePosterChain } from "@/components/poster";
import type { Voyage } from "@/lib/voyage/types";

export function VoyageReady({ voyage, onStart, inline = false }: { voyage: Voyage; onStart: () => void; inline?: boolean }) {
  const t = useT();
  const picks = voyage.routeIds.map(id => metaById(voyage, id)).filter((m): m is Meta => !!m);
  return (
    <div className={inline ? "voyage-inline-ready" : "flex flex-col items-center gap-3.5 rounded-lg bg-canvas/40 px-6 py-9 text-center ring-1 ring-inset ring-edge-soft"}>
      {inline ? (
        <div className="voyage-ready-posters" style={{ gridTemplateColumns: `repeat(${picks.length}, minmax(0, 1fr))` }}>
          {picks.map(meta => <ReadyPoster key={meta.id} meta={meta} />)}
        </div>
      ) : <span
        className="grid h-14 w-14 place-items-center rounded-md"
        style={{
          background: `color-mix(in oklch, ${voyage.accent}, transparent 88%)`,
          color: voyage.accent,
        }}
      >
        <Play size={22} strokeWidth={2} fill="currentColor" />
      </span>}
      {!inline && <span className="text-[16px] font-semibold text-ink">{t("Your voyage is ready")}</span>}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onStart}
          className="flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-[opacity,transform] hover:opacity-90 active:scale-[0.97]"
        >
          <Play size={14} strokeWidth={2.4} fill="currentColor" /> {t("Start voyage")}
        </button>
        <button
          type="button"
          onClick={endVoyage}
          className="flex h-10 items-center gap-1.5 rounded-full border border-edge-soft px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-danger/40 hover:text-danger"
        >
          <Flag size={13} strokeWidth={2.2} /> {t("Start over")}
        </button>
      </div>
    </div>
  );
}

function ReadyPoster({ meta }: { meta: Meta }) {
  const { settings } = useSettings();
  const poster = usePosterChain(settings.rpdbKey, meta.id, meta.poster, meta.type === "series" ? "series" : "movie");
  return <figure className="min-w-0">
    <img data-voyage-launch-thumb src={poster.src} onError={poster.onError} alt="" draggable={false} className="aspect-[2/3] w-full rounded-md object-cover" />
    <figcaption className="mt-2 line-clamp-2 text-[12.5px] leading-snug text-ink-muted">{meta.name}</figcaption>
  </figure>;
}
