import type { Meta } from "@/lib/cinemeta";
import { exitBigPicture, pushBigPicture } from "@/lib/big-picture";
import { resolveMangaIdByTitle } from "@/lib/search-manga-resolve";
import { BpResultCard } from "../bp-result-card";
import { BpTile } from "../bp-tile";
import {
  BpAddonHitCell,
  BpChannelCell,
  BpCollectionCell,
  BpMangaCell,
  BpPersonCell,
  animeMeta,
} from "../bp-search-rows";
import type { BpSearchSection } from "../use-bp-search";
import type { BpGroupCell } from "./bp-search-group";

export type BpCellHandlers = {
  onSelect: (m: Meta) => void;
  onCommit: () => void;
  openManga: (mangaId?: string) => void;
};

const WIDE = "clamp(230px, 19vw, 380px)";
const HERO = "clamp(360px, 30vw, 620px)";

function addonBase(transportUrl: string): string {
  return transportUrl.replace(/\/manifest\.json$/, "");
}

// A franchise row's manga entries carry an AniList id, and the reader is keyed by
// manga source id, so the id has to be resolved back by title before anything can
// open. Handing the AniList id straight to openManga opens nothing at all, which
// is what made every franchise manga poster a dead card.
async function openMangaMeta(meta: Meta, h: BpCellHandlers): Promise<void> {
  const id = meta.id.startsWith("anilist:")
    ? await resolveMangaIdByTitle(meta.name ?? "")
    : meta.id;
  h.onCommit();
  h.openManga(id);
  exitBigPicture();
}

function titleCell(m: Meta, width: string, h: BpCellHandlers): BpGroupCell {
  if (m.type === "manga") {
    return {
      key: m.id,
      node: (
        <div className="shrink-0" style={{ width }}>
          <BpResultCard meta={m} onSelect={() => void openMangaMeta(m, h)} />
        </div>
      ),
    };
  }
  return {
    key: m.id,
    node: (
      <div className="shrink-0" style={{ width }}>
        <BpResultCard meta={m} onSelect={h.onSelect} />
      </div>
    ),
  };
}

// Every section kind produces cells. A kind with no branch here renders a heading
// and a count over an empty track, which is exactly the "search found less than it
// should" the owner reported: manga and the addon index counted toward hasResults
// while nothing on screen drew them.
export function bpSearchCells(section: BpSearchSection, h: BpCellHandlers): BpGroupCell[] {
  switch (section.kind) {
    case "top":
      return section.meta ? [titleCell(section.meta, HERO, h)] : [];

    case "titles":
      return section.metas.map((m) => titleCell(m, WIDE, h));

    case "people":
      return section.people.map((p) => ({
        key: `person:${p.id}`,
        node: (
          <BpPersonCell
            person={p}
            onOpen={() => {
              h.onCommit();
              pushBigPicture({ kind: "person", personId: p.id, name: p.name });
            }}
          />
        ),
      }));

    case "anime":
      return section.anime.map((hit) => {
        const meta = animeMeta(hit);
        return { key: meta.id, node: <BpTile meta={meta} onSelect={h.onSelect} /> };
      });

    case "manga":
      return section.manga.map((m) => ({
        key: `manga:${m.id}`,
        node: (
          <BpMangaCell
            manga={m}
            onOpen={() => {
              h.onCommit();
              h.openManga(m.id);
              exitBigPicture();
            }}
          />
        ),
      }));

    case "livetv":
      return section.channels.map((hit) => ({
        key: `iptv:${hit.playlistId}:${hit.channelId}`,
        node: <BpChannelCell hit={hit} onCommit={h.onCommit} />,
      }));

    case "collections":
      return section.collections.map((hit) => ({
        key: `collection:${hit.id}`,
        node: <BpCollectionCell hit={hit} onCommit={h.onCommit} />,
      }));

    case "addonIndex":
      // An entry with no transport url has no base to browse, so it is dropped
      // rather than drawn as a card that cannot open.
      return section.addons.flatMap((hit) => {
        const url = hit.transportUrl;
        if (!url) return [];
        return [
          {
            key: `addonhit:${hit.id}`,
            node: (
              <BpAddonHitCell
                hit={hit}
                onOpen={() => {
                  h.onCommit();
                  pushBigPicture({
                    kind: "addon",
                    addonId: hit.id,
                    name: hit.name,
                    base: addonBase(url),
                    logo: hit.logo,
                  });
                }}
              />
            ),
          },
        ];
      });
  }
}
