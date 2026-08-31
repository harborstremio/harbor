import type { ReactNode } from "react";
import { ArrowDownToLine, Star } from "lucide-react";
import type { StoreTheme } from "@/lib/theme-store";
import type { StoreBundle } from "@/lib/bundle-store";
import { FeaturedBadge } from "@/views/profile/profile-bits";
import { UserHoverCard } from "@/views/profile/user-hover-card";
import { fmtCount } from "../format";
import { Fit } from "./fit";
import { PaletteSeam } from "./palette-seam";
import { PackContents } from "./pack-contents";
import { MarketCta } from "./market-cta";
import { useAcquireState } from "./use-acquire";
import { tokensFromStoreTheme } from "./fit-palette";

function KindChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-elevated px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted ring-1 ring-edge-soft">
      {text}
    </span>
  );
}

export function MarketHero({
  item,
  kind,
  label,
  tag,
  onOpen,
  onGet,
}: {
  item: StoreTheme | StoreBundle;
  kind: "theme" | "badge" | "award";
  label: string;
  tag?: string;
  onOpen: (item: StoreTheme | StoreBundle) => void;
  onGet: () => Promise<void>;
}) {
  const { state, run } = useAcquireState(onGet);

  let payload: ReactNode;
  let art: ReactNode;
  if ("swatch" in item) {
    payload = <PaletteSeam swatch={item.swatch} labeled />;
    art = <Fit kind="theme" tokens={tokensFromStoreTheme(item)} cover={item.cover ?? item.screenshots[0] ?? null} size="hero" />;
  } else {
    payload = <PackContents bundle={item} variant="hero" />;
    art = <Fit kind={item.kind} icons={item.icons} cover={item.cover} size="hero" />;
  }

  return (
    <section className="group/card relative grid min-h-[380px] overflow-hidden rounded-md bg-canvas ring-1 ring-edge-soft md:grid-cols-[45%_55%]">
      <div className="order-2 flex flex-col justify-center gap-5 p-8 sm:p-10 md:order-1">
        <div className="flex flex-wrap items-center gap-2">
          <FeaturedBadge />
          <KindChip text={label} />
          {tag && tag !== label && <KindChip text={tag} />}
        </div>
        <h2
          className="font-display font-medium leading-[1.03] tracking-tight text-ink"
          style={{ fontSize: "clamp(34px, 4.6vw, 52px)" }}
        >
          {item.name}
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-ink-subtle">
          {item.ratingCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Star size={14} className="fill-accent text-accent" />
              <span className="tabular-nums text-ink">{item.ratingAvg.toFixed(1)}</span>
              <span className="tabular-nums">({item.ratingCount})</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <ArrowDownToLine size={14} strokeWidth={2.2} />
            {fmtCount(item.downloads)} downloads
          </span>
          {"swatch" in item && item.authorHandle ? (
            <UserHoverCard handle={item.authorHandle}>
              <span className="cursor-pointer transition-colors hover:text-ink">
                by {item.author || "Anonymous"}
              </span>
            </UserHoverCard>
          ) : (
            <span>by {item.author || "Anonymous"}</span>
          )}
        </div>
        <div className="max-w-[34rem]">{payload}</div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <MarketCta
            variant="acquire"
            size="lg"
            state={state}
            onClick={() => run()}
            label={kind === "theme" ? "Get theme" : "Install"}
          />
          <MarketCta variant="ghost" size="lg" onClick={() => onOpen(item)} label="View details" />
        </div>
      </div>
      <div className="relative order-1 min-h-[220px] overflow-hidden md:order-2 md:min-h-full">{art}</div>
    </section>
  );
}
