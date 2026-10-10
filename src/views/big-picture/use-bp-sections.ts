import { useEffect, useState } from "react";

export type BpBandId =
  | "resume"
  | "live"
  | "catalog"
  | "services"
  | "collections"
  | "addons"
  | "more";

export type BpBandOwner = "card" | "band";

export type BpBand = {
  id: BpBandId;
  eyebrow: string;
  title: string;
  line: string;
  // A band that owns the backdrop paints it for as long as focus stays inside
  // it, and the focused card's art is suppressed to nothing. A card-owned band
  // never paints: its cells are single titles and the spotlight speaks for them.
  // There is no third state, and no band may declare both still and mosaic.
  owns: BpBandOwner;
  floor: string;
  tint: boolean;
  still: boolean;
  wash: boolean;
  mosaic: boolean;
};

export type BpBandArt = {
  key: string;
  src?: string;
  tint?: string;
  posters?: readonly string[];
  title?: string;
  line?: string;
  logo?: string;
  logoScale?: "bug" | "subject";
};

export const BP_BANDS: Record<BpBandId, BpBand> = {
  resume: {
    id: "resume",
    eyebrow: "Continue",
    title: "Jump back in",
    line: "Pick up exactly where you left off.",
    owns: "card",
    floor: "44%",
    tint: false,
    still: false,
    wash: false,
    mosaic: false,
  },
  live: {
    id: "live",
    eyebrow: "Live",
    title: "On right now",
    line: "Your channels, playing this minute.",
    owns: "band",
    floor: "52%",
    tint: true,
    still: true,
    wash: false,
    mosaic: false,
  },
  catalog: {
    id: "catalog",
    eyebrow: "Catalog",
    title: "Now on Harbor",
    line: "What your catalogs are showing right now.",
    owns: "card",
    floor: "46%",
    tint: false,
    still: false,
    wash: false,
    mosaic: false,
  },
  services: {
    id: "services",
    eyebrow: "Streaming",
    title: "Your services",
    line: "Straight into the apps you already pay for.",
    owns: "band",
    floor: "52%",
    // The tint here is the service's own brand hex carried on BpBandArt, never
    // a sample: this band has no photograph to sample from, and the earlier
    // reading of that fact was that it could have no tint at all.
    tint: true,
    still: false,
    wash: true,
    mosaic: true,
  },
  collections: {
    id: "collections",
    eyebrow: "Collections",
    title: "Every saga, in order",
    line: "Whole runs gathered so nothing arrives out of sequence.",
    owns: "band",
    floor: "54%",
    tint: true,
    still: true,
    wash: false,
    mosaic: false,
  },
  addons: {
    id: "addons",
    eyebrow: "Installed",
    title: "Your addons",
    line: "What each addon is actually serving up right now.",
    owns: "band",
    floor: "52%",
    // No wash: an addon ships no brand hex, and inventing one would put a
    // seventh colour in a palette that allows two. tint alone makes BpAmbient
    // sample the addon's own mark, so the hue is still the addon's own.
    tint: true,
    still: false,
    wash: false,
    mosaic: true,
  },
  more: {
    id: "more",
    eyebrow: "Explore",
    title: "Keep going",
    line: "Deeper cuts from every catalog and add-on you have installed.",
    owns: "card",
    floor: "48%",
    tint: false,
    still: false,
    wash: false,
    mosaic: false,
  },
};

export const BP_BAND_FLOOR_REST = "46%";

// Holding Down through five bands must settle once, not strobe five times.
export const BAND_SETTLE_MS = 180;

export type BpBandState = { band: BpBand | null; art: BpBandArt | null };

let active: BpBandId | null = null;
const artOf = new Map<BpBandId, BpBandArt>();
const subs = new Set<() => void>();

// Comparing keys alone would swallow the services republish: the row mints the
// same key again once its poster list resolves, and that second record is the
// only thing that ever fills the mosaic.
function same(prev: BpBandArt | undefined, next: BpBandArt): boolean {
  if (prev === next) return true;
  if (!prev) return false;
  return (
    prev.key === next.key &&
    prev.src === next.src &&
    prev.tint === next.tint &&
    prev.title === next.title &&
    prev.line === next.line &&
    prev.logo === next.logo &&
    prev.logoScale === next.logoScale &&
    prev.posters?.length === next.posters?.length
  );
}

function emit(): void {
  for (const fn of subs) fn();
}

function read(): BpBandState {
  return {
    band: active ? BP_BANDS[active] : null,
    art: active ? (artOf.get(active) ?? null) : null,
  };
}

export function publishBpBand(id: BpBandId | null): void {
  if (active === id) return;
  active = id;
  emit();
}

export function publishBpBandArt(id: BpBandId, art: BpBandArt | null): void {
  if (!art) {
    if (!artOf.has(id)) return;
    artOf.delete(id);
    if (id === active) emit();
    return;
  }
  if (same(artOf.get(id), art)) return;
  artOf.set(id, art);
  if (id === active) emit();
}

export function useBpBandState(settleMs = 0): BpBandState {
  const [state, setState] = useState<BpBandState>(read);

  useEffect(() => {
    let timer = 0;
    const onChange = () => {
      if (settleMs <= 0) {
        setState(read());
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setState(read()), settleMs);
    };
    subs.add(onChange);
    onChange();
    return () => {
      window.clearTimeout(timer);
      subs.delete(onChange);
    };
  }, [settleMs]);

  return state;
}
