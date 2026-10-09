import { Music2 } from "lucide-react";
import { CoverImg } from "@/components/cover-img";
import type { MusicSearchHit } from "@/lib/search";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { requestMusicSearch } from "@/lib/music/navigation";

const KIND_LABEL: Record<MusicSearchHit["kind"], string> = {
  artist: "Artist",
  album: "Album",
  track: "Song",
};

export function MusicRow({ items, onClose }: { items: MusicSearchHit[]; onClose: () => void }) {
  const { setView } = useView();
  const t = useT();
  if (items.length === 0) return null;

  const open = (hit: MusicSearchHit) => {
    onClose();
    requestMusicSearch(hit.kind === "artist" ? hit.title : `${hit.title} ${hit.subtitle}`.trim());
    setView("music");
  };

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
        <Music2 size={11} strokeWidth={2.2} />
        {t("Music")}
      </h3>
      <div className="grid min-w-0 gap-1">
        {items.slice(0, 8).map((hit) => (
          <button
            key={hit.id}
            onClick={() => open(hit)}
            className="group flex min-w-0 items-center gap-4 rounded-2xl border border-transparent px-3 py-2.5 text-start transition-colors hover:border-edge-soft hover:bg-elevated/50 active:scale-[0.997]"
          >
            <span
              className={`flex size-[64px] shrink-0 items-center justify-center overflow-hidden bg-canvas shadow-[0_6px_16px_-8px_rgba(0,0,0,0.55)] ring-1 ring-edge-soft ${
                hit.kind === "artist" ? "rounded-full" : "rounded-xl"
              }`}
            >
              {hit.artwork ? (
                <CoverImg
                  src={hit.artwork}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Music2 size={20} className="text-ink-subtle" />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-[16px] font-semibold text-ink">{hit.title}</span>
              {hit.subtitle && (
                <span className="truncate text-[12.5px] text-ink-muted">{hit.subtitle}</span>
              )}
              <span className="flex items-center gap-1 text-[12px] text-ink-subtle">
                <Music2 size={11} strokeWidth={2.2} />
                {t(KIND_LABEL[hit.kind])}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
