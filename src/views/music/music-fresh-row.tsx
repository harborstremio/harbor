import { MusicCatalogRow } from "@/components/music/music-catalog-row";
import { MusicSectionHead } from "@/components/music/music-track-grid";
import { useT } from "@/lib/i18n";
import type { MusicData } from "./use-music-data";
import { localRow, trackItem, type MusicBandContext } from "./music-band-types";

export function MusicFreshRow({ title, data, onOpen }: {
  title: string;
  data: Pick<MusicData, "fresh" | "freshStatus" | "reloadFresh">;
  onOpen: MusicBandContext["openItem"];
}) {
  const t = useT();
  const items = data.fresh.map(trackItem);
  const subtitle = t("music.row.freshSubtitle");
  // Keep playable results on screen while another artist is loading or unavailable.
  if (items.length || data.freshStatus === "loading") {
    return <MusicCatalogRow
      row={localRow("fresh", title, subtitle, "trackGrid", items)}
      status={items.length ? "ready" : "loading"}
      count={9}
      onOpen={(item) => onOpen(item, items)}
    />;
  }
  return (
    <section className="flex min-w-0 flex-col gap-3 ps-[9px]">
      <MusicSectionHead title={title} subtitle={subtitle} />
      <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-muted">
        <p role="status">{t(data.freshStatus === "error" ? "music.row.freshUnavailable" : "music.row.freshEmpty")}</p>
        {data.freshStatus === "error" && <button type="button" onClick={data.reloadFresh}
          className="min-h-9 rounded-md bg-elevated px-3 text-[12px] font-medium text-ink transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent">
          {t("music.row.tryAgain")}
        </button>}
      </div>
    </section>
  );
}
