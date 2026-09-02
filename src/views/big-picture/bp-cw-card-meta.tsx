import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Check, Clock } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import simklLogo from "@/assets/simkl.png";
import { getAnimeCwId } from "@/lib/anime-cw-ids";
import type { Meta } from "@/lib/cinemeta";
import { peekCachedLogo, resolveLogo } from "@/lib/logo";
import { useHasNewEpisode } from "@/lib/new-episodes";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { useProfiles, type Profile } from "@/lib/profiles";
import { useProxiedImageSrc } from "@/lib/remote-image-proxy";
import { fetchSeasonEpisodes } from "@/lib/series-episodes";
import { useSettings } from "@/lib/settings";
import { episodeFromVideoId, libraryMetaType, type LibraryItem } from "@/lib/stremio";
import { fetchWatchedKeySet } from "@/lib/trakt/history";
import { isLibraryItemWatched } from "@/lib/trakt/library-key";
import { useTrakt } from "@/lib/trakt/provider";
import { useWatchedBy } from "@/lib/watched-by";
import { useBpT } from "./bp-i18n";

const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;
const TRAKT_TTL = 10 * 60 * 1000;
const NO_KEYS: Set<string> = new Set();

let traktKeys: Set<string> = NO_KEYS;
let traktAt = 0;
let traktInflight = false;
// Trakt sessions are per profile: profiles.tsx clears harbor.trakt.session.v1
// per id. A module cache with only a TTL therefore serves one profile's watched
// history to the next one for up to ten minutes, painting a confident Watched
// check on titles that profile has never seen. The cache is keyed to the owner.
let traktFor: string | null = null;
const traktSubs = new Set<() => void>();

function readTraktKeys(): Set<string> {
  return traktKeys;
}

function subscribeTrakt(fn: () => void): () => void {
  traktSubs.add(fn);
  return () => {
    traktSubs.delete(fn);
  };
}

// One history pull for the whole row. fetchWatchedKeySet asks Trakt for a
// thousand rows and caches nothing, so a per-card call fires it once per
// visible card on every mount.
function pullTraktKeys(profileId: string | null): void {
  if (traktFor !== profileId) {
    traktFor = profileId;
    traktKeys = NO_KEYS;
    traktAt = 0;
    for (const fn of traktSubs) fn();
  }
  if (traktInflight || Date.now() - traktAt < TRAKT_TTL) return;
  traktInflight = true;
  const owner = profileId;
  fetchWatchedKeySet()
    .then((set) => {
      if (traktFor !== owner) return;
      traktKeys = set;
      traktAt = Date.now();
      for (const fn of traktSubs) fn();
    })
    .catch(() => {})
    .finally(() => {
      traktInflight = false;
    });
}

function useTraktWatchedKeys(profileId: string | null): Set<string> {
  const { isConnected } = useTrakt();
  const keys = useSyncExternalStore(subscribeTrakt, readTraktKeys);
  useEffect(() => {
    if (isConnected) pullTraktKeys(profileId);
  }, [isConnected, profileId]);
  return isConnected && traktFor === profileId ? keys : NO_KEYS;
}

function isKitsuThreeSeg(item: LibraryItem): boolean {
  return ANIME_ID.test(item._id) && (item.state?.video_id ?? "").split(":").length === 3;
}

function cwEpisode(item: LibraryItem): { season: number; episode: number } | null {
  const s = item.state?.season ?? 0;
  const e = item.state?.episode ?? 0;
  if (s > 0 && e > 0) return { season: s, episode: e };
  return episodeFromVideoId(item.state?.video_id ?? "");
}

function airFields(item: LibraryItem): { waiting: boolean; at: string | undefined } {
  const rec = item as unknown as Record<string, unknown>;
  const waiting = rec.waitingForAir === true;
  const at = waiting && typeof rec.nextAirDate === "string" ? rec.nextAirDate : undefined;
  return { waiting, at };
}

// cloudWriteId returns null for every anime scheme, so the player stamps an
// anime watch under the kitsu/mal/anilist id while the library row for the same
// title is often the resolved tt entry. One watch, two ids. The write-side dual
// key belongs in use-stremio-sync; this only recovers the tt -> anime direction
// that anime-cw-ids already records.
function useCwWatcher(mediaId: string, activeId: string | undefined): Profile | null {
  const { profiles } = useProfiles();
  // getAnimeCwId is its own localStorage read and parse, so it is memoised on
  // the id rather than run on every render of every visible card.
  const animeId = useMemo(() => getAnimeCwId(mediaId), [mediaId]);
  const watcherId = useWatchedBy(mediaId, animeId);
  // Never the active profile's own face. That rule is the whole reason the
  // badge carries meaning.
  if (!watcherId || watcherId === activeId) return null;
  return profiles.find((p) => p.id === watcherId) ?? null;
}

function useAirCountdown(at: string | undefined): string {
  const t = useBpT();
  if (!at) return "";
  const diff = Date.parse(at) - Date.now();
  if (!Number.isFinite(diff)) return "";
  if (diff <= 0) return t("Airing now");
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return t("Next in {days}d {hours}h", { days: String(days), hours: String(hours) });
  if (hours > 0)
    return t("Next in {hours}h {minutes}m", { hours: String(hours), minutes: String(minutes) });
  return t("Next in {minutes}m", { minutes: String(Math.max(1, minutes)) });
}

async function episodeTitleFor(item: LibraryItem, tmdbKey: string): Promise<string> {
  const videoId = item.state?.video_id ?? "";
  if (ANIME_ID.test(item._id)) {
    const num = isKitsuThreeSeg(item)
      ? Number(videoId.split(":")[2])
      : (item.state?.episode ?? cwEpisode(item)?.episode ?? 0);
    const m = await animeKitsuMeta(item._id).catch(() => null);
    if (!m) return "";
    const byId = m.videos.find((v) => v.id === videoId);
    const byNum =
      Number.isFinite(num) && num > 0 ? m.videos.find((v) => v.episode === num) : undefined;
    return (byId ?? byNum)?.title ?? "";
  }
  const ep = cwEpisode(item);
  if (!ep || ep.episode <= 0) return "";
  const shell: Meta = { id: item._id, type: "series", name: item.name };
  const eps = await fetchSeasonEpisodes(shell, ep.season, { tmdbKey }).catch(() => []);
  return eps.find((e) => e.episode === ep.episode)?.name ?? "";
}

function useCwLogoAndTitle(
  item: LibraryItem,
  ref: RefObject<HTMLElement | null>,
): { logo: string | undefined; episodeTitle: string } {
  const tmdbKey = useSettings().settings.tmdbKey;
  const id = item._id;
  const videoId = item.state?.video_id ?? "";
  const shell = useMemo<Meta>(
    () => ({
      id,
      type: libraryMetaType(item.type),
      name: item.name,
      poster: item.poster,
      background: item.background,
    }),
    [id, item.type, item.name, item.poster, item.background],
  );
  const [logo, setLogo] = useState<string | undefined>(() => peekCachedLogo(tmdbKey, shell));
  const [episodeTitle, setEpisodeTitle] = useState("");
  const itemRef = useRef(item);
  itemRef.current = item;

  useEffect(() => {
    setLogo(peekCachedLogo(tmdbKey, shell));
    setEpisodeTitle("");
    const el = ref.current;
    if (!el) return;
    let alive = true;
    let fired = false;
    // A private observer, not lib/visibility's shared one: that helper keeps a
    // single callback per element, and useBpArt has already claimed this exact
    // button. Registering there would silently cancel its art hydration.
    //
    // That observer is GONE and the note above is why nobody may bring it back
    // through the shared helper. Row visibility was the wrong gate in the first
    // place: it watched [data-bp-rail-row], so one row scrolling into view fired
    // every card in it at the same instant. Twenty cards, and resolveLogo on a tt
    // id ends in a cinemeta fetch, which is a Tauri bridge crossing at roughly
    // 275ms each, plus episodeTitleFor behind it. None of it paints the card: the
    // name and the time remaining are already on screen, and peekCachedLogo above
    // still fills the logo instantly on every visit after the first.
    //
    // So the gate is focus. One card at a time, the one the viewer is looking at.
    const run = () => {
      if (fired) return;
      fired = true;
      el.removeEventListener("focusin", run);
      resolveLogo(tmdbKey, shell)
        .then((url) => {
          if (alive && url) setLogo(url);
        })
        .catch(() => {});
      episodeTitleFor(itemRef.current, tmdbKey)
        .then((title) => {
          if (alive && title) setEpisodeTitle(title);
        })
        .catch(() => {});
    };
    // applyBpFocus marks the ring before it calls focus(), and this effect
    // re-runs on an item update, so the card that already holds the ring has to
    // answer here or it would sit waiting for a focus event it has already had.
    if (el.contains(document.activeElement) || el.matches('[data-bp-focus="true"]')) run();
    else el.addEventListener("focusin", run);
    return () => {
      alive = false;
      el.removeEventListener("focusin", run);
    };
  }, [shell, videoId, tmdbKey, ref]);

  return { logo, episodeTitle };
}

export type BpCwCardMeta = {
  watched: boolean;
  newEpisode: number;
  upNext: boolean;
  waitingForAir: boolean;
  countdown: string;
  episodeTitle: string;
  logo: string | undefined;
  watcher: Profile | null;
};

export function useBpCwCardMeta(
  item: LibraryItem,
  ref: RefObject<HTMLElement | null>,
): BpCwCardMeta {
  const air = airFields(item);
  const activeId = useProfiles().activeProfile?.id;
  const traktKeySet = useTraktWatchedKeys(activeId ?? null);
  const newEpisode = useHasNewEpisode(item);
  const countdown = useAirCountdown(air.at);
  const { logo, episodeTitle } = useCwLogoAndTitle(item, ref);
  const watcher = useCwWatcher(item._id, activeId);
  return {
    watched: isLibraryItemWatched(item, traktKeySet),
    newEpisode,
    upNext: item.upNext === true,
    waitingForAir: air.waiting,
    countdown,
    episodeTitle,
    logo,
    watcher,
  };
}

// The badges are aria-hidden so they cannot pollute the card button's name, so
// everything they carry has to reach a screen reader through the label instead.
export function bpCwCardLabel(
  item: LibraryItem,
  sub: string,
  remaining: string,
  meta: BpCwCardMeta,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const state = meta.waitingForAir
    ? meta.countdown
    : meta.upNext
      ? t("Up Next")
      : meta.episodeTitle || remaining;
  const fresh =
    meta.newEpisode <= 0
      ? ""
      : meta.newEpisode === 1
        ? t("1 new episode since you last watched")
        : t("{n} new episodes since you last watched", { n: meta.newEpisode });
  return [
    item.name,
    sub,
    state,
    meta.watched ? t("Watched on Trakt") : "",
    fresh,
    meta.watcher ? t("Watched by {name}", { name: meta.watcher.name }) : "",
  ]
    .filter(Boolean)
    .join(", ");
}

const BADGE = "h-[clamp(21px,2.7vh,32px)] items-center";

export function BpCwCardBadges({ watched, newEpisode }: { watched: boolean; newEpisode: number }) {
  if (!watched && newEpisode <= 0) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute start-[clamp(11px,1.3vw,20px)] top-[clamp(11px,1.3vw,20px)] z-[1] flex items-center gap-[clamp(5px,0.5vw,9px)]"
    >
      {watched && (
        <span
          className={`flex w-[clamp(21px,2.7vh,32px)] justify-center rounded-full border-transparent bg-[var(--color-ink)] text-[var(--color-canvas)] ${BADGE}`}
        >
          <Check className="h-[clamp(11px,1.4vh,17px)] w-auto" strokeWidth={3.2} />
        </span>
      )}
      {newEpisode > 0 && (
        <span
          className={`flex rounded-sm border-transparent bg-[var(--color-ink)] px-[clamp(6px,0.62vw,11px)] text-[clamp(9.8px,1.22vh,14px)] font-bold leading-none tracking-[0.04em] text-[var(--color-canvas)] ${BADGE}`}
        >
          +{newEpisode}
        </span>
      )}
    </span>
  );
}

// No backdrop-blur here even though the top badges carry one. The pill always
// sits on the bottom scrim, which is already near opaque, so the blur would
// render identically and still cost a filtered layer on every visible card.
const PILL =
  "inline-flex min-w-0 max-w-full items-center gap-[0.45em] self-start rounded-sm border-transparent bg-[var(--bp-void)]/92 px-[0.62em] py-[0.34em] text-[clamp(10.5px,1.4vh,16px)] font-semibold leading-none text-ink-muted";

const GLYPH = "h-[1.05em] w-auto shrink-0";

// Amber and --bp-live both stay off this pill. --bp-live means live broadcast,
// and a countdown to an episode that has not aired is the opposite of live.
export function BpCwCardPill({
  sub,
  simkl,
  meta,
  remaining,
}: {
  sub: string;
  simkl: boolean;
  meta: BpCwCardMeta;
  remaining: string;
}) {
  const t = useBpT();
  const upNext = meta.upNext && !meta.waitingForAir;
  const trailing = meta.waitingForAir
    ? meta.countdown
    : upNext
      ? t("Up Next")
      : meta.episodeTitle || remaining;
  if (!sub && !trailing && !simkl) return null;

  return (
    <span data-bp-cw-pill className={PILL}>
      {simkl ? (
        <img src={simklLogo} alt="" className="h-[1.15em] w-[1.15em] shrink-0 rounded-[3px]" />
      ) : meta.waitingForAir ? (
        <Clock className={GLYPH} strokeWidth={2.6} />
      ) : (
        <Play className={`${GLYPH} fill-current`} strokeWidth={0} />
      )}
      {sub && <span className="shrink-0 text-ink">{sub}</span>}
      {sub && trailing && (
        <span aria-hidden className="shrink-0 opacity-40">
          ·
        </span>
      )}
      {trailing && (
        <span className={`min-w-0 truncate ${upNext ? "text-[var(--bp-touch)]" : ""}`}>
          {trailing}
        </span>
      )}
    </span>
  );
}

// The ring is a neutral edge token, not the profile colour. Profile colours are
// arbitrary user-chosen values with no saturation bound, and four of them in one
// row sit directly beside the --bp-touch progress bar and Watched check until
// --bp-touch stops reading as "you can act on this". Identity is carried by the
// face, or by the initial when there is no avatar.
export function BpCwWatcher({ watcher }: { watcher: Profile }) {
  const src = useProxiedImageSrc(watcher.avatar ?? undefined);
  return (
    <span
      aria-hidden
      className="flex h-[clamp(34px,4vh,50px)] w-[clamp(34px,4vh,50px)] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--bp-panel-2)] text-[clamp(13px,1.7vh,20px)] font-bold leading-none text-ink shadow-[0_0_0_2px_var(--bp-edge-2),0_4px_14px_rgba(0,0,0,0.55)]"
    >
      {src ? (
        <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />
      ) : (
        (watcher.name.trim()[0]?.toUpperCase() ?? "?")
      )}
    </span>
  );
}
