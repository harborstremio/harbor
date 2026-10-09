import { MusicCollectionControls } from "./music-collection-controls";
import { MusicLibraryEmptyState } from "./music-library-empty-state";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "@/components/icons/music-icons";
import { MusicArtistCard } from "./music-artist-card";
import { MusicCoverCard } from "./music-cover-card";
import { useMusicItemMenu } from "./music-item-menu";
import { MusicTrackRow } from "./music-track-row";
import { MusicTrackRowsSkeleton } from "./music-skeletons";
import { useMusicPlaylistPicker } from "./music-playlist-picker";
import { useMusicSourcePicker } from "./music-source-picker";
import { useMusicCatalogPlayback } from "./use-music-catalog-playback";
import { enqueueMusic } from "@/lib/music/player";
import { localCollection } from "@/lib/music/catalog";
import type { MusicCatalogItem } from "@/lib/music/types";
import { useT } from "@/lib/i18n";

type Kind = "albums" | "artists" | "tracks";
export function MusicLocalCollection({
  kind,
  query,
  onOpen,
  onConnect,
  onTastes,
}: {
  kind: Kind;
  query: string;
  onOpen: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void;
  onConnect: () => void;
  onTastes: () => void;
}) {
  const t = useT();
  const { openPlaylistPicker } = useMusicPlaylistPicker();
  const { openSourcePicker } = useMusicSourcePicker();
  const playback = useMusicCatalogPlayback();
  const [items, setItems] = useState<MusicCatalogItem[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const itemMenu = useMusicItemMenu({ onOpen: (item) => onOpen(item, items) });
  const load = useCallback(
    (offset: number) => {
      const request = ++generation.current;
      setLoading(true);
      setError("");
      localCollection(kind, query.trim(), offset)
        .then((page) => {
          if (generation.current !== request) return;
          setItems((current) =>
            offset === 0
              ? page.items
              : [
                  ...current,
                  ...page.items.filter(
                    (item) => !current.some((old) => old.id === item.id && old.kind === item.kind),
                  ),
                ],
          );
          setNext(page.nextOffset);
        })
        .catch((cause) => {
          if (generation.current === request)
            setError(cause instanceof Error ? cause.message : String(cause));
        })
        .finally(() => {
          if (generation.current === request) setLoading(false);
        });
    },
    [kind, query],
  );
  useEffect(() => {
    setItems([]);
    setNext(null);
    setLoading(true);
    setError("");
    const timer = setTimeout(() => load(0), query ? 180 : 0);
    return () => {
      clearTimeout(timer);
      generation.current += 1;
    };
  }, [load, revision, query]);
  useEffect(() => {
    const changed = () => setRevision((value) => value + 1);
    window.addEventListener("harbor:music-library-changed", changed);
    return () => window.removeEventListener("harbor:music-library-changed", changed);
  }, []);
  return (
    <section className="music-library-local" aria-label={t("music.connections.local")} aria-busy={loading}>
      {kind === "tracks" && items.length > 0 && (
        <div className="mb-5">
          <MusicCollectionControls
            tracks={items.filter((item) => item.kind === "track")}
            onPlay={(track, queue) => openSourcePicker(track, queue)}
          />
        </div>
      )}
      {loading && items.length === 0 ? (
        <LocalCollectionLoading kind={kind} />
      ) : items.length > 0 ? (
        <div
          className={kind === "tracks" ? "music-library-local-tracks" : "music-library-cover-grid"}
        >
          {items.map((item, index) =>
            item.kind === "track" ? (
              <MusicTrackRow
                key={item.id}
                track={item}
                showDuration
                index={index + 1}
                onPlay={() => openSourcePicker(item, items.filter((entry) => entry.kind === "track"))}
                onOpen={() => onOpen(item, items)}
                onAddToQueue={() => enqueueMusic(item)}
                onAddToPlaylist={() => openPlaylistPicker(item)}
              />
            ) : item.kind === "artist" ? (
              <MusicArtistCard key={item.id} artist={item} onOpen={() => onOpen(item, items)} />
            ) : (
              <MusicCoverCard
                key={item.id}
                item={item}
                onOpen={() => onOpen(item, items)}
                onPlay={() => { void playback.play(item, items); }}
                playing={playback.pending === item}
                onMenu={itemMenu.openFor(item, index)}
              />
            ),
          )}
        </div>
      ) : (
        !error && (
          query ? <p className="music-library-empty">{t("music.library.noMatches")}</p> :
            <MusicLibraryEmptyState kind={kind} onConnect={onConnect} onTastes={onTastes} />
        )
      )}
      {error && (
        <div role="alert" className="music-library-empty">
          <p>{error}</p>
          <button type="button" onClick={() => load(next ?? 0)} className="music-library-button">
            {t("common.retry")}
          </button>
        </div>
      )}
      {playback.error && <p role="alert" className="text-[13px] text-ink-muted">{playback.error}</p>}
      {next !== null && !error && (
        <button
          type="button"
          disabled={loading}
          onClick={() => load(next)}
          className="music-library-button music-library-load-more"
        >
          {loading && (
            <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" />
          )}
          {t("music.library.loadMore")}
        </button>
      )}
      {itemMenu.menu}
    </section>
  );
}

function LocalCollectionLoading({ kind }: { kind: Kind }) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Fast local reads should never flash a loading indicator between tabs.
    const timer = setTimeout(() => setVisible(true), 250);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-64">
      {visible && (kind === "tracks" ? <MusicTrackRowsSkeleton rows={5} /> : (
        <div className="music-library-cover-grid" role="status" aria-label={t("music.loading")}>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className={`music-skeleton-card${kind === "artists" ? " is-round" : ""}`} aria-hidden="true">
              <span className="music-skeleton-fill music-skeleton-art" />
              <span className="music-skeleton-fill music-skeleton-title" />
              <span className="music-skeleton-fill music-skeleton-subtitle" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
