import { useCallback } from "react";
import { ContinueCard } from "@/components/continue-card";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { clearLocalCw } from "@/lib/local-cw";
import type { LibraryItem } from "@/lib/stremio";
import type { LocalEntry } from "@/lib/local-library";
import { localPlayerSrc } from "@/lib/local-library/player-src";
import { findLocalMovieVersions, findLocalEpisodeVersions } from "@/lib/local-library/versions";
import { openLocalVersions } from "@/lib/player/local-versions-modal";
import { useLocalContinueWatching } from "@/lib/local-library/use-local-cw";

/**
 * Continue Watching for files on disk. Same store, item shape and card as the
 * Home row; scoped to the local library and hidden when nothing is in progress.
 */
export function LocalCwRow() {
  const t = useT();
  const { openPlayer } = useView();
  const cards = useLocalContinueWatching();

  const play = useCallback(
    (entry: LocalEntry, item: LibraryItem) => {
      const versions =
        entry.type === "show" && entry.season != null && entry.episode != null
          ? findLocalEpisodeVersions(entry.season, entry.episode, entry.tmdbId, entry.imdbId)
          : findLocalMovieVersions(entry.tmdbId, entry.imdbId);
      const start = (target: LocalEntry) => {
        const src = localPlayerSrc(target);
        // Keep the CW id so playback resumes and updates the same entry.
        openPlayer({ ...src, meta: { ...src.meta, id: item._id } });
      };
      if (versions.length > 1) {
        openLocalVersions({
          title: entry.title,
          poster: item.poster ?? entry.poster ?? null,
          entries: versions,
          onPlayLocal: start,
        });
        return;
      }
      start(entry);
    },
    [openPlayer],
  );

  const onDismiss = useCallback((item: LibraryItem) => clearLocalCw(item._id), []);

  if (cards.length === 0) return null;

  return (
    <Row title={t("Continue Watching")} min={260} shape="landscape" scrollKey="library:local:cw">
      {cards.map(({ item, entry }) => (
        <ContinueCard
          key={item._id}
          item={item}
          onDismiss={onDismiss}
          onPlayOverride={() => play(entry, item)}
        />
      ))}
    </Row>
  );
}
