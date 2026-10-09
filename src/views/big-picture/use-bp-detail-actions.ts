import { useSyncExternalStore } from "react";
import {
  ArrowDownToLine,
  Bell,
  Check,
  Film,
  Heart,
  Layers,
  ListVideo,
  Plus,
  RotateCw,
  Star,
  X,
  type LucideIcon,
} from "lucide-react";
import traktLogo from "@/assets/trakt.png";
import type { Meta } from "@/lib/cinemeta";
import { activeDownloadFor, cancelDownload, useDownloads } from "@/lib/download/downloads-store";
import type { LibraryItem } from "@/lib/stremio";
import { useSettings } from "@/lib/settings";
import { useInWatchlist, toggleWatchlist } from "@/lib/watchlist";
import { useIsFavorite, useMediaFavorites } from "@/lib/media-favorites";
import { markMovieWatched, unmarkMovieWatched } from "@/lib/mark-watched";
import {
  isMovieWatchedLocal,
  movieWatchedVersion,
  subscribeMovieWatched,
} from "@/lib/movie-watched";
import { stremioMovieWatched } from "@/lib/stremio-watched";
import { ensureNotifyPermission, removeReminder, setReminder, useReminder } from "@/lib/reminders";
import { useRating } from "@/lib/ratings/store";
import { pushWatched } from "@/lib/trakt/history";
import { useTrakt } from "@/lib/trakt/provider";
import { useBpT } from "./bp-i18n";
import type { BpTracker } from "./use-bp-trackers";

export type BpDetailAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  logo?: string;
  filled?: boolean;
  active?: boolean;
  badge?: string;
  onPress: () => void;
};

export function useBpDetailActions(params: {
  meta: Meta;
  title: string;
  poster?: string;
  imdbId: string | null;
  isSeries: boolean;
  trailerYtId?: string | null;
  libraryItem?: LibraryItem | null;
  onSources: () => void;
  onDownload: () => void;
  onTrailer: () => void;
  onRate: () => void;
  onLists: () => void;
  trackers: BpTracker[];
  onTracker: (key: string) => void;
}): BpDetailAction[] {
  const { meta, title, poster, imdbId, isSeries, trailerYtId, libraryItem, trackers } = params;
  const t = useBpT();
  const { settings } = useSettings();
  const { toggle: toggleFavorite } = useMediaFavorites();
  const isFav = useIsFavorite(meta.id, [imdbId]);
  const saved = useInWatchlist(meta.id, [imdbId]);
  const reminder = useReminder(isSeries ? meta.id : undefined);
  const rating = useRating(meta.id);
  const isMovie = meta.type === "movie";
  const trakt = useTrakt();
  useDownloads();

  useSyncExternalStore(subscribeMovieWatched, movieWatchedVersion, movieWatchedVersion);
  const watched = isMovie && (isMovieWatchedLocal(meta.id) || stremioMovieWatched(libraryItem));

  const seed = { id: meta.id, type: meta.type, name: title || meta.name, poster };
  const out: BpDetailAction[] = [];

  // A series has no single set of streams. Sources belong to an episode, and in
  // manual mode the primary action already is the picker.
  if (isMovie && settings.instantPlay) {
    out.push({
      key: "sources",
      label: t("Sources"),
      icon: ListVideo,
      onPress: params.onSources,
    });
  }

  out.push({
    key: "watchlist",
    label: saved ? t("In Watchlist") : t("Add to Watchlist"),
    icon: saved ? Check : Plus,
    active: saved,
    onPress: () => toggleWatchlist({ ...seed, imdbId }),
  });

  for (const tr of trackers) {
    out.push({
      key: tr.key,
      label: tr.statusLabel
        ? `${tr.name} · ${t(tr.statusLabel)}`
        : t("Add to {name}", { name: tr.name }),
      icon: Plus,
      logo: tr.logo,
      active: tr.status != null,
      onPress: () => params.onTracker(tr.key),
    });
  }

  const traktTarget = isMovie && trakt.isConnected ? trakt.resolveTarget(meta.id) : null;
  if (traktTarget?.kind === "movie") {
    out.push({
      key: "trakt",
      label: t("Mark watched on Trakt"),
      icon: Check,
      logo: traktLogo,
      onPress: () => {
        void pushWatched(traktTarget).catch(() => {});
      },
    });
  }

  out.push({
    key: "favorite",
    label: isFav ? t("Favorited") : t("Add to favorites"),
    icon: Heart,
    filled: isFav,
    active: isFav,
    onPress: () => toggleFavorite(seed),
  });

  if (isSeries) {
    const on = !!reminder;
    out.push({
      key: "reminder",
      label: on ? t("Reminder on") : t("Remind me"),
      icon: Bell,
      filled: on,
      active: on,
      onPress: () => {
        if (on) {
          removeReminder(meta.id);
          return;
        }
        const now = Date.now();
        setReminder({
          id: meta.id,
          name: title || meta.name,
          poster,
          type: "series",
          episodes: true,
          seasons: true,
          tone: "chime",
          lastNotifiedAt: now,
          createdAt: now,
        });
        void ensureNotifyPermission();
      },
    });
  }

  out.push({
    key: "rate",
    label: rating?.score ? t("Your rating {n}/10", { n: rating.score }) : t("Rate this"),
    icon: Star,
    filled: !!rating?.score,
    active: !!rating?.score,
    badge: rating?.score ? String(rating.score) : undefined,
    onPress: params.onRate,
  });

  out.push({
    key: "lists",
    label: t("Add to list"),
    icon: Layers,
    onPress: params.onLists,
  });

  if (isMovie && settings.showWatchedButton) {
    out.push({
      key: "watched",
      label: watched ? t("Marked watched") : t("Mark watched"),
      icon: Check,
      active: watched,
      onPress: () => {
        const tmdb = meta.id.startsWith("tmdb:") ? meta.id.split(":")[2] : null;
        if (watched) void unmarkMovieWatched(meta, imdbId);
        else void markMovieWatched(meta, imdbId, tmdb);
      },
    });
  }

  if (trailerYtId) {
    out.push({
      key: "trailer",
      label: t("Watch trailer"),
      icon: Film,
      onPress: params.onTrailer,
    });
  }

  if (isMovie) {
    const dl = activeDownloadFor(meta.id, null, null);
    const downloading = dl?.status === "downloading";
    const done = dl?.status === "done";
    const failed = dl?.status === "error";
    const pct = Math.round((dl?.ratio ?? 0) * 100);
    out.push({
      key: "download",
      label: downloading
        ? t("Downloading {pct}% · cancel", { pct })
        : done
          ? t("Saved offline")
          : failed
            ? t("Retry download")
            : t("Download for offline"),
      icon: downloading ? X : done ? Check : failed ? RotateCw : ArrowDownToLine,
      active: done,
      onPress: () => {
        if (downloading && dl) cancelDownload(dl.id);
        else params.onDownload();
      },
    });
  }

  return out;
}
