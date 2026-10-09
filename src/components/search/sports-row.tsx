import { Trophy } from "lucide-react";
import { CoverImg } from "@/components/cover-img";
import type { SportsEventHit } from "@/lib/sports/search-events";
import { usePlaylists } from "@/lib/iptv/playlists-store";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";

function dayLabel(ms: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(ms));
  } catch {
    return "";
  }
}

export function SportsRow({ items, onClose }: { items: SportsEventHit[]; onClose: () => void }) {
  const { setView } = useView();
  const playlists = usePlaylists();
  const t = useT();
  if (items.length === 0) return null;

  const open = () => {
    onClose();
    setView("sports");
  };

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
        <Trophy size={11} strokeWidth={2.2} />
        {t("Sports")}
      </h3>
      {playlists.length === 0 && (
        <p className="mb-2 px-3 text-[12px] text-ink-subtle">
          {t("Set up Live TV to watch these events.")}
        </p>
      )}
      <div className="grid min-w-0 gap-1">
        {items.map((event) => {
          const art = event.thumb || event.poster || event.badge;
          const meta = [event.league, dayLabel(event.startMs)].filter(Boolean).join(" · ");
          return (
            <button
              key={event.id}
              onClick={open}
              className="group flex min-w-0 items-center gap-4 rounded-2xl border border-transparent px-3 py-2.5 text-start transition-colors hover:border-edge-soft hover:bg-elevated/50 active:scale-[0.997]"
            >
              <span className="flex h-[64px] w-[96px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-canvas shadow-[0_6px_16px_-8px_rgba(0,0,0,0.55)] ring-1 ring-edge-soft">
                {art ? (
                  <CoverImg
                    src={art}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Trophy size={20} className="text-ink-subtle" />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[16px] font-semibold text-ink">{event.name}</span>
                {meta && <span className="truncate text-[12.5px] text-ink-muted">{meta}</span>}
                <span className="flex items-center gap-1 text-[12px] text-ink-subtle">
                  <Trophy size={11} strokeWidth={2.2} />
                  {t("Sports")}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
