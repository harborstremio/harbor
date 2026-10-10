import { useEffect, useState, type RefObject } from "react";
import { narrowMediaType } from "@/lib/cinemeta";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { useSettings } from "@/lib/settings";
import { hydrateLibraryMeta } from "@/views/library/hydrate-meta";
import { bpCardArt, bpTileArtWidth } from "./bp-art";
import { bpHydrateSlot } from "./bp-art-hydrate";
import { onBpCardVisible } from "./bp-card-visible";

const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;

type Shape = "poster" | "wide";

type BpArtSource = {
  ref: RefObject<HTMLElement | null>;
  id: string;
  type?: string;
  shape?: Shape;
  pinned?: string;
  override?: string;
  poster?: string;
  background?: string;
  /** CSS px the art is actually drawn at. Omitted keeps the caller-free default. */
  targetWidth?: number;
};

type Picked = { url: string | undefined; wide: boolean; raw?: string };

type BpArt = { url: string | undefined; wide: boolean; onError: () => void };

const NONE: Picked = { url: undefined, wide: false };

function pickArt(
  shape: Shape,
  width: number | undefined,
  poster?: string,
  background?: string,
  pinned?: string,
  override?: string,
): Picked {
  if (pinned) return { url: pinned, wide: true, raw: pinned };
  // A custom poster is 2:3 like meta.poster, never wide. Routing it through
  // `pinned` instead would mark it wide and break the fill.
  if (override && shape !== "wide") return { url: override, wide: false, raw: override };
  const raw = shape === "wide" ? (background ?? poster) : (poster ?? background);
  if (!raw) return NONE;
  // A poster-shaped tile with no poster paints 16:9 art object-cover into a 2:3
  // box, so the source has to cover the box HEIGHT, which is 8/3 of its width.
  // Asking for the box width pulled metahub background/small, 480x270, and
  // upscaled it 1.47x on a card that is supposed to be the product.
  const drawn = width ?? bpTileArtWidth(shape);
  const coverWidth = shape !== "wide" && raw === background ? drawn * (8 / 3) : drawn;
  return { url: bpCardArt(raw, coverWidth), wide: raw === background, raw };
}

// Module scoped, and it has to be. This was component state wiped on every id
// change, so one dead url was re-requested by every tile showing that title and
// again by all of them after every route change. The escalation is what made it
// expensive rather than merely wasteful: live() answering NONE flips `missing`,
// which fires animeKitsuMeta or hydrateLibraryMeta, so a broken poster costs an
// image AND a follow-up fetch, per tile, per visit. A failure costs once per
// session now. Do not move it back inside the hook.
const DEAD_CAP = 400;
const dead = new Set<string>();

export function bpArtDead(url: string): boolean {
  return dead.has(url);
}

export function markBpArtDead(url: string): void {
  if (dead.has(url)) return;
  // Evict one, never clear. Clearing at the cap made every url remembered so far
  // requestable again, which on a surface that mounts a thousand rows is the
  // request storm this set exists to stop, fired all at once.
  if (dead.size >= DEAD_CAP) {
    const oldest = dead.values().next().value;
    if (oldest !== undefined) dead.delete(oldest);
  }
  dead.add(url);
}

// A sized url is a GUESS about what the host serves at that path, and a guess
// that misses used to cost a permanently blank card plus a hydrate round trip
// for art the tile already had. So a broken sized url falls back to the
// untransformed original first, and only a raw url that also fails counts as
// missing art.
function live(picked: Picked): Picked {
  if (!picked.url || !dead.has(picked.url)) return picked;
  const { raw } = picked;
  if (raw && raw !== picked.url && !dead.has(raw)) return { ...picked, url: raw };
  return NONE;
}

export function useBpArt({
  ref,
  id,
  type,
  shape = "poster",
  pinned,
  override,
  poster,
  background,
  targetWidth,
}: BpArtSource): BpArt {
  const { settings } = useSettings();
  const tmdbKey = settings.tmdbKey ?? null;
  const [found, setFound] = useState<{ poster?: string; background?: string }>();
  const [, redraw] = useState(0);

  useEffect(() => {
    setFound(undefined);
  }, [id]);

  // Two picks, not one: a custom poster that 404s has to fall back to the plain
  // one, and a single pick would report NONE and send the tile off to hydrate
  // art it already has.
  const withOverride = live(pickArt(shape, targetWidth, poster, background, pinned, override));
  const stored = withOverride.url
    ? withOverride
    : live(pickArt(shape, targetWidth, poster, background, pinned));
  const missing = !stored.url;

  useEffect(() => {
    if (!missing || found) return;
    const el = ref.current;
    if (!el) return;
    let alive = true;
    let fired = false;
    // The rail row, not the tile. Same trap as bp-card-visible: content-visibility
    // on an unfocused row makes every tile inside it permanently non-intersecting,
    // so this observation never fires and never retires, and a tile missing its
    // art in an unfocused row can never hydrate either.
    const stop = onBpCardVisible(el, () => {
      if (fired) return;
      fired = true;
      const pending = bpHydrateSlot(() =>
        ANIME_ID.test(id)
          ? animeKitsuMeta(id)
          : hydrateLibraryMeta(id, narrowMediaType(type), tmdbKey),
      );
      pending
        .then((full) => {
          if (alive && full) setFound({ poster: full.poster, background: full.background });
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
      stop();
    };
  }, [ref, id, type, tmdbKey, missing, found]);

  const hydrated = found
    ? live(pickArt(shape, targetWidth, found.poster, found.background))
    : NONE;
  const chosen = missing ? hydrated : stored;
  const failing = chosen.url;

  return {
    url: chosen.url,
    wide: chosen.wide,
    // The redraw is unconditional even when the url is already known dead. A
    // second tile showing the same title requested it before the first one
    // failed, so its own error is the only signal it will ever get to fall back.
    onError: () => {
      if (!failing) return;
      markBpArtDead(failing);
      redraw((n) => n + 1);
    },
  };
}
