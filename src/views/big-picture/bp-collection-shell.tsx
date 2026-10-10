import { bpHeroArt } from "./bp-art";
import { BP_POSTER_COLUMNS, BpGrid, BpGridScroller } from "./bp-grid";

const SCRIM =
  "linear-gradient(to bottom, color-mix(in oklab, var(--bp-void) 55%, transparent) 0%, color-mix(in oklab, var(--bp-void) 88%, transparent) 58%, var(--bp-void) 100%)";

export function BpCollectionShell({
  backdrop,
  header,
  children,
}: {
  backdrop: string | null;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-full flex-col gap-[clamp(11px,1.4vh,22px)] px-[var(--bp-gutter)] pb-[var(--bp-hint-h)] pt-[var(--bp-page-top)]">
      {backdrop && (
        <img
          aria-hidden
          src={bpHeroArt(backdrop)}
          alt=""
          decoding="async"
          onLoad={(e) => e.currentTarget.setAttribute("data-on", "true")}
          className="pointer-events-none absolute inset-x-0 top-0 h-[46vh] w-full object-cover opacity-0 transition-opacity duration-[var(--bp-dur-slow)] data-[on=true]:opacity-[0.22]"
        />
      )}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: SCRIM }} />

      <div className="relative flex shrink-0 items-end gap-[clamp(12px,1.4vw,28px)] [animation:bp-rise_var(--bp-dur-slow)_var(--bp-ease)_both] motion-reduce:[animation:none]">
        {header}
      </div>

      <BpGridScroller>{children}</BpGridScroller>
    </div>
  );
}

export function BpCollectionGrid({ children }: { children: React.ReactNode }) {
  return <BpGrid columns={BP_POSTER_COLUMNS}>{children}</BpGrid>;
}

// Twelve quiet plates. Twelve animate-pulse plates was twelve group opacities
// strictly between 0 and 1, so twelve live render surfaces against a cliff that
// saturates at eight.
export function BpCollectionSkeleton() {
  return (
    <div aria-hidden>
      <BpCollectionGrid>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            data-bp-plate
            className="rounded-sm bg-[var(--bp-panel)]"
            style={{ aspectRatio: "2 / 3" }}
          />
        ))}
      </BpCollectionGrid>
    </div>
  );
}

export function BpCollectionEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[30vh] items-center justify-center px-6 text-center">
      <p className="max-w-[46ch] text-[clamp(13.5px,1.95vh,22px)] font-medium text-ink-subtle">
        {text}
      </p>
    </div>
  );
}
