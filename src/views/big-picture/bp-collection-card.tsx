import { useState } from "react";
import { SFX } from "@/lib/sfx";
import { bpCardArt, bpTileArtWidth } from "./bp-art";
import { BpArt } from "./bp-art-img";
import { useBpT } from "./bp-i18n";
import { publishBpBandArt, type BpBandArt } from "./use-bp-sections";
import type { BpCollectionEntry } from "./use-bp-collection-feed";

const SCRIM =
  "linear-gradient(to top, color-mix(in oklab, var(--bp-void) 92%, transparent) 0%, color-mix(in oklab, var(--bp-void) 44%, transparent) 54%, transparent 100%)";

const SHELL =
  "relative flex shrink-0 items-end overflow-hidden rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] text-start";

type T = (key: string, vars?: Record<string, string | number>) => string;

function metaLine(entry: BpCollectionEntry, t: T): string {
  const bits: string[] = [];
  if (entry.byline) bits.push(entry.byline);
  if (entry.source === "mine" || entry.source === "community") {
    if (entry.count != null) bits.push(t("{count} items", { count: entry.count }));
  } else if (entry.count != null) {
    bits.push(t("{count} films", { count: entry.count }));
  } else if (entry.source === "tvdb") {
    bits.push(t("TVDB list"));
  } else {
    bits.push(t("Collection"));
  }
  return bits.join("  ·  ");
}

// The row's label tile and every card in it must mint the same record, or
// focusing the label would show one collection and focusing a card another.
export function bpCollectionBandArt(
  entry: BpCollectionEntry | undefined,
  t: T,
): BpBandArt | undefined {
  if (!entry) return undefined;
  return {
    key: entry.key,
    src: bpCardArt(entry.image ?? undefined, bpTileArtWidth("wide")),
    title: entry.name,
    line: metaLine(entry, t),
  };
}

export function BpCollectionCard({
  entry,
  onOpen,
  autofocus,
  width,
}: {
  entry: BpCollectionEntry;
  onOpen: (entry: BpCollectionEntry) => void;
  autofocus?: boolean;
  width?: string;
}) {
  const t = useBpT();
  const [sized, setSized] = useState(true);
  const bandArt = bpCollectionBandArt(entry, t);
  // A sized url is a guess about what the host serves at that path, and TVDB
  // list images are guessed hardest. This card had no error path at all, so a
  // miss was a permanently artless card with nothing in any log.
  const src = sized ? bandArt?.src : (entry.image ?? undefined);

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile="wide"
      data-bp-autofocus={autofocus ? "true" : undefined}
      data-bp-restore-key={entry.key}
      onFocus={() => publishBpBandArt("collections", bandArt ?? null)}
      onClick={() => {
        SFX.click();
        onOpen(entry);
      }}
      aria-label={entry.name}
      className={SHELL}
      style={{ width: width ?? "100%", aspectRatio: "16 / 9" }}
    >
      <BpArt
        src={src}
        className="object-cover opacity-0 transition-opacity duration-[var(--bp-dur-slow)] data-[on=true]:opacity-85"
        onLoad={(e) => e.currentTarget.setAttribute("data-on", "true")}
        onError={() => setSized(false)}
      />
      <span aria-hidden className="absolute inset-0" style={{ background: SCRIM }} />
      <span className="relative flex w-full flex-col gap-[clamp(3px,0.5vh,7px)] p-[clamp(10px,0.9vw,18px)]">
        <span className="truncate text-[clamp(12px,1.6vh,18px)] font-bold uppercase tracking-[0.1em] text-ink-subtle">
          {metaLine(entry, t)}
        </span>
        <span className="line-clamp-2 text-[clamp(12.5px,1.7vh,20px)] font-semibold leading-tight text-ink">
          {entry.name}
        </span>
      </span>
    </button>
  );
}

export function BpCollectionMoreCard({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile="wide"
      data-bp-restore-key="bp-collection-more"
      onClick={() => {
        SFX.click();
        onOpen();
      }}
      className={`${SHELL} items-center justify-center border-dashed`}
      style={{ width: "100%", aspectRatio: "16 / 9" }}
    >
      <span className="px-[clamp(10px,0.9vw,18px)] text-center text-[clamp(12.5px,1.7vh,20px)] font-semibold leading-tight text-ink-muted">
        {label}
      </span>
    </button>
  );
}

// A quiet plate, never animate-pulse. A pulsing plate is a group opacity
// strictly between 0 and 1, which is a live render surface per element, against
// a GPU cliff that saturates around eight: six of these on Home cost more than
// the whole rest of the row. The motion belongs to one shared BpShimmer over the
// plate group, which is what bp-cw-row and bp-anime-row already do.
export function BpCollectionCardSkeleton() {
  return (
    <div
      className="rounded-[var(--bp-r-md)] border border-[var(--bp-edge)] bg-[var(--bp-panel)]"
      style={{ width: "100%", aspectRatio: "16 / 9" }}
    />
  );
}
