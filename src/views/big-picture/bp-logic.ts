export type BpDir = "up" | "down" | "left" | "right";

export type BpRect = { x: number; y: number; w: number; h: number; cx: number; cy: number };

export function toBpRect(r: { left: number; top: number; width: number; height: number }): BpRect {
  return {
    x: r.left,
    y: r.top,
    w: r.width,
    h: r.height,
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
  };
}

const FORWARD_WEIGHT = 3;
const DRIFT_WEIGHT = 1.2;
const ALIGN_BONUS = 120;

function overlap(a: number, aLen: number, b: number, bLen: number): number {
  return Math.max(0, Math.min(a + aLen, b + bLen) - Math.max(a, b));
}

export function directionScore(a: BpRect, b: BpRect, dir: BpDir): number | null {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const centred = dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;

  // A neighbour that spans the whole axis shares the source's centre, so a
  // centre-only test declares it unreachable. Compare the edge that faces the
  // travel direction: a box contained inside the source's own span is not ahead.
  const lead =
    dir === "left"
      ? a.x - b.x
      : dir === "right"
        ? b.x + b.w - (a.x + a.w)
        : dir === "up"
          ? a.y - b.y
          : b.y + b.h - (a.y + a.h);

  const reach = Math.max(centred, lead);
  if (reach <= 1) return null;

  const cross =
    dir === "left" || dir === "right"
      ? overlap(a.y, a.h, b.y, b.h) / Math.max(1, Math.min(a.h, b.h))
      : overlap(a.x, a.w, b.x, b.w) / Math.max(1, Math.min(a.w, b.w));

  const drift = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
  return reach * FORWARD_WEIGHT + drift * DRIFT_WEIGHT - cross * ALIGN_BONUS;
}

// Ranked, not just best: a refused focus has to fall through to the next
// sensible target instead of dropping the whole keypress.
export function rankIndicesInDirection(from: BpRect, pool: BpRect[], dir: BpDir): number[] {
  const scored: Array<{ at: number; score: number }> = [];
  for (let i = 0; i < pool.length; i += 1) {
    const score = directionScore(from, pool[i], dir);
    if (score === null) continue;
    scored.push({ at: i, score });
  }
  scored.sort((x, y) => x.score - y.score);
  return scored.map((e) => e.at);
}

export function pickIndexInDirection(from: BpRect, pool: BpRect[], dir: BpDir): number {
  const ranked = rankIndicesInDirection(from, pool, dir);
  return ranked.length > 0 ? ranked[0] : -1;
}

export type BpNavMode = "grid" | "rail" | "spatial";

export function navigationMode(container: {
  inGrid: boolean;
  inRail: boolean;
  dir: BpDir;
}): BpNavMode {
  if (container.inGrid) return "grid";
  const horizontal = container.dir === "left" || container.dir === "right";
  if (container.inRail && horizontal) return "rail";
  return "spatial";
}

export function railEscapes(dir: BpDir): boolean {
  return dir === "up" || dir === "down";
}

// Free on both surfaces per the binding audit: no keyboard or pad handler in
// Big Picture claims Home or the west face button.
export const BP_NAV_JUMP = { key: "Home", keyGlyph: "Home", padGlyph: "X" } as const;

export function isBpNavJumpKey(key: string): boolean {
  return key === BP_NAV_JUMP.key;
}

export function gridEscapes(dir: BpDir, hasTargetInGrid: boolean): boolean {
  if (hasTargetInGrid) return false;
  return dir === "up" || dir === "down";
}

const ROW_TOLERANCE = 8;

function sameRow(a: BpRect, b: BpRect): boolean {
  return Math.abs(a.cy - b.cy) <= Math.max(ROW_TOLERANCE, Math.min(a.h, b.h) * 0.4);
}

export function gridStep(from: number, rects: BpRect[], dir: BpDir, rtl = false): number {
  if (from < 0 || from >= rects.length) return -1;

  if (dir === "left" || dir === "right") {
    const forward = rtl ? dir === "left" : dir === "right";
    const next = forward ? from + 1 : from - 1;
    return next >= 0 && next < rects.length ? next : -1;
  }

  const a = rects[from];
  let best = -1;
  let bestScore = Infinity;
  for (let i = 0; i < rects.length; i += 1) {
    if (i === from) continue;
    const b = rects[i];
    if (sameRow(a, b)) continue;
    const ahead = dir === "down" ? b.cy > a.cy : b.cy < a.cy;
    if (!ahead) continue;
    const rowGap = Math.abs(b.cy - a.cy);
    const score = rowGap * 4 + Math.abs(b.cx - a.cx);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export type BpMediaKind = "movie" | "series";

const KNOWN_KINDS = new Set(["movie", "series", "anime", "tv"]);

export function parseBpMetaId(metaId: string): { type: BpMediaKind; id: string } {
  const cut = metaId.indexOf(":");
  if (cut < 0) return { type: "movie", id: metaId };
  const head = metaId.slice(0, cut);
  if (!KNOWN_KINDS.has(head)) return { type: "movie", id: metaId };
  const id = metaId.slice(cut + 1);
  if (!id) return { type: "movie", id: metaId };
  return { type: head === "series" || head === "anime" ? "series" : "movie", id };
}

export type BpFactsInput = {
  releaseInfo?: string;
  releaseDate?: string;
  runtime?: string;
  genres?: string[];
};

export type BpFactsDetail = {
  year?: string;
  runtime?: string;
  genres?: string[];
  kind?: "movie" | "tv";
  numberOfSeasons?: number;
} | null;

export function buildBpFacts(meta: BpFactsInput, detail: BpFactsDetail): string[] {
  const out: string[] = [];
  const year = detail?.year || meta.releaseInfo || meta.releaseDate?.slice(0, 4);
  if (year) out.push(String(year));

  const seasonCount = detail?.kind === "tv" ? (detail.numberOfSeasons ?? 0) : 0;
  const seasons = seasonCount > 0 ? `${seasonCount} season${seasonCount === 1 ? "" : "s"}` : "";
  const runtime = detail?.runtime || meta.runtime || "";
  if (seasons) out.push(seasons);
  else if (runtime) out.push(runtime);

  const genres = (detail?.genres?.length ? detail.genres : (meta.genres ?? [])).slice(0, 3);
  if (genres.length) out.push(genres.join(", "));

  const seen = new Set<string>();
  return out.filter((f) => {
    const k = f.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// A collection detail belongs to the Collections tab, and a detail or person
// page belongs to whichever tab it was opened from, so shoulder cycling steps
// from where the user thinks they are rather than always from index 0.
export function bpActiveTab<T extends string>(stack: readonly string[], tabs: readonly T[]): T {
  const fallback = tabs[0] ?? ("home" as T);
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const kind = stack[i] === "tmdb-collection" ? "collections" : stack[i];
    const hit = tabs.find((t) => t === kind);
    if (hit) return hit;
  }
  return fallback;
}

export function cycleTab<T>(order: readonly T[], current: T, delta: number): T {
  if (order.length === 0) return current;
  const at = order.indexOf(current);
  const from = at < 0 ? 0 : at;
  const next = (((from + delta) % order.length) + order.length) % order.length;
  return order[next];
}

export type BpAvailability = {
  kidProfileActive: boolean;
  buttonEnabled: boolean;
  suppressedByChrome: boolean;
};

export function shouldOfferBigPicture(state: BpAvailability): boolean {
  if (state.kidProfileActive) return false;
  if (!state.buttonEnabled) return false;
  return !state.suppressedByChrome;
}

// Set once at module scope by the Android TV entry, which renders nothing but
// BigPictureShell. Kept as a module flag rather than a prop because every caller of
// shouldRenderBigPicture would otherwise have to learn about it, and a caller that
// forgot would silently reintroduce the black screen below.
let tvShell = false;

export function setBpTvShell(on: boolean): void {
  tvShell = on;
}

export function bpTvShell(): boolean {
  return tvShell;
}

export function shouldRenderBigPicture(state: {
  active: boolean;
  kidProfileActive: boolean;
  tvShell?: boolean;
}): boolean {
  if (!state.active) return false;
  // A kid profile sends the DESKTOP out to its own kids surface, which is why this
  // refuses there. On the television there is no such surface: returning false makes
  // the only component the entry mounts render null, so the panel goes black with no
  // chrome, no focusable element and no remote input that recovers it, and a power
  // cycle relaunches straight into the same active kid profile. Big Picture stays
  // mounted on that entry and gates content from inside.
  if (state.kidProfileActive && !(state.tvShell ?? tvShell)) return false;
  return true;
}

export type BpChromeState = {
  mounted: boolean;
  hidden: boolean;
  navigationEnabled: boolean;
};

export function bigPictureChromeState(state: {
  active: boolean;
  kidProfileActive: boolean;
  playbackOpen: boolean;
}): BpChromeState {
  const mounted = shouldRenderBigPicture(state);
  if (!mounted) return { mounted: false, hidden: false, navigationEnabled: false };
  return {
    mounted: true,
    hidden: state.playbackOpen,
    navigationEnabled: !state.playbackOpen,
  };
}

export function shouldAutoStartBigPicture(state: {
  autoStart: boolean;
  alreadyBooted: boolean;
  kidProfileActive: boolean;
}): boolean {
  if (state.alreadyBooted || !state.autoStart) return false;
  return !state.kidProfileActive;
}

export function remainingMinutes(durationMs: number, offsetMs: number): number | null {
  if (durationMs <= 0) return null;
  return Math.max(0, Math.round((durationMs - offsetMs) / 60000));
}
