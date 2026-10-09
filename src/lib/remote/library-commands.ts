import type { Meta } from "@/lib/cinemeta";
import { toggleWatchlist, watchlistHas } from "@/lib/watchlist";
import { markMetaWatched, unmarkMetaWatched } from "@/lib/mark-watched";
import { setMediaFavorite } from "@/lib/media-favorites";
import { readActiveProfileIdentity } from "@/lib/profiles";
import { resolveSimklTarget } from "@/lib/simkl/ids";
import { setSimklStatus, clearSimklStatus } from "@/lib/simkl/list-status";
import { resolveAnilistMediaId } from "@/lib/anilist/sync";
import {
  saveListEntry as anilistSaveEntry,
  deleteListEntry as anilistDeleteEntry,
  fetchListEntry as anilistFetchEntry,
} from "@/lib/anilist/mutations";
import {
  resolveMalMediaId,
  saveListEntry as malSaveEntry,
  deleteListEntry as malDeleteEntry,
} from "@/lib/mal/mutations";
import type { RemoteCommand } from "./protocol";

type LibraryActionCommand = Extract<RemoteCommand, { action: "libraryAction" }>;

export async function runLibraryAction(cmd: LibraryActionCommand): Promise<void> {
  const { metaId, metaType, name, poster, imdbId, op } = cmd;
  const simklType = metaType === "movie" ? "movie" : "series";

  switch (op.kind) {
    case "watchlist": {
      const current = watchlistHas(metaId) || (!!imdbId && watchlistHas(imdbId));
      if (current !== op.on) {
        toggleWatchlist({ id: metaId, type: metaType, name, poster, imdbId });
      }
      return;
    }
    case "watched": {
      const meta: Meta = { id: metaId, type: metaType as Meta["type"], name: name ?? "", poster };
      if (op.on) await markMetaWatched(meta, imdbId);
      else await unmarkMetaWatched(meta, imdbId);
      return;
    }
    case "favorite": {
      const pid = readActiveProfileIdentity()?.id ?? "default";
      setMediaFavorite(pid, { id: metaId, type: metaType, name, poster }, op.on);
      return;
    }
    case "simkl": {
      const target = await resolveSimklTarget(metaId, simklType);
      if (!target) return;
      if (op.status) await setSimklStatus(target, op.status);
      else await clearSimklStatus(target);
      return;
    }
    case "anilist": {
      const mediaId = await resolveAnilistMediaId(metaId);
      if (mediaId == null) return;
      if (op.status) {
        await anilistSaveEntry({ mediaId, status: op.status });
      } else {
        const info = await anilistFetchEntry(mediaId);
        if (info.entry?.id != null) await anilistDeleteEntry(info.entry.id);
      }
      return;
    }
    case "mal": {
      const malId = await resolveMalMediaId(metaId);
      if (malId == null) return;
      if (op.status) await malSaveEntry({ malId, status: op.status });
      else await malDeleteEntry(malId);
      return;
    }
  }
}
