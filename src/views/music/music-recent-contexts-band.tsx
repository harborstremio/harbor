import { useState } from "react";
import { MusicCatalogRow } from "@/components/music/music-catalog-row";
import { requestMusicPlaylist } from "@/lib/music/navigation";
import {
  getMusicRecentContexts,
  reopenMusicMix,
  useMusicRecentContexts,
  type MusicRecentContext,
} from "@/lib/music/recent-context";
import type { MusicCatalogItem } from "@/lib/music/types";
import { localRow, type MusicBand, type MusicBandContext } from "./music-band-types";

type Translate = MusicBandContext["t"];

function contextItems(contexts: readonly MusicRecentContext[], t: Translate): MusicCatalogItem[] {
  return contexts.map((context) => ({
    kind: "playlist",
    id: `${context.kind}:${context.id}`,
    connectorId: "local",
    name: context.name,
    artwork: context.artwork,
    subtitle: t(
      context.kind === "similar" ? "music.card.moreLikeThis" : "music.recentContexts.playlist",
    ),
  }));
}

function MusicRecentContextsRow({ t, title }: { t: Translate; title: string }) {
  const contexts = useMusicRecentContexts();
  const [note, setNote] = useState<"loading" | "error" | null>(null);
  const open = (context: MusicRecentContext) => {
    if (context.kind === "playlist") {
      requestMusicPlaylist(context.id);
      return;
    }
    if (!context.seed || note === "loading") return;
    setNote("loading");
    void reopenMusicMix(context.seed)
      .then(() => setNote(null))
      .catch(() => setNote("error"));
  };
  if (contexts.length === 0) return null;
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <MusicCatalogRow
        row={localRow(
          "recent-contexts",
          title,
          t("music.recentContexts.subtitle"),
          "covers",
          contextItems(contexts, t),
        )}
        onOpen={(_item, index) => {
          const context = contexts[index];
          if (context) open(context);
        }}
      />
      {note && (
        <p
          role={note === "error" ? "alert" : "status"}
          className="ps-[9px] text-[13px] text-ink-muted"
        >
          {t(note === "error" ? "music.similar.error" : "music.similar.building")}
        </p>
      )}
    </section>
  );
}

export function recentContextsBand(ctx: MusicBandContext): MusicBand | null {
  if (getMusicRecentContexts().length === 0) return null;
  return {
    key: "recent-contexts",
    title: ctx.t("music.recentContexts.title"),
    catalog: false,
    render: (title) => <MusicRecentContextsRow t={ctx.t} title={title} />,
  };
}
