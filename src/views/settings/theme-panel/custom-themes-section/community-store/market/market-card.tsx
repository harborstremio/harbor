import { useMemo } from "react";
import { Download, Star } from "lucide-react";
import { useT } from "@/lib/i18n";
import { downloadTheme, type StoreTheme } from "@/lib/theme-store";
import { getBundle, installBundle, type StoreBundle } from "@/lib/bundle-store";
import { UserHoverCard } from "@/views/profile/user-hover-card";
import { fmtCount } from "../format";
import { Fit } from "./fit";
import { PaletteSeam } from "./palette-seam";
import { MarketCta } from "./market-cta";
import { useAcquireState } from "./use-acquire";
import { tokensFromStoreTheme } from "./fit-palette";

const CARD_CLASS =
  "group/card relative flex w-full cursor-pointer flex-col overflow-hidden rounded-md bg-elevated text-start outline-none transition-colors duration-200 hover:bg-raised focus-visible:ring-2 focus-visible:ring-accent";

const ACTION_ROW =
  "absolute inset-x-0 bottom-1.5 z-10 flex translate-y-1.5 items-center p-2.5 opacity-0 transition duration-200 ease-out group-hover/card:translate-y-0 group-hover/card:opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100";

function RankChip({ rank }: { rank: number }) {
  const top = rank <= 3;
  return (
    <span
      className={`absolute start-2.5 top-2.5 z-10 grid h-7 min-w-7 place-items-center rounded-[8px] px-1.5 text-[12.5px] font-bold tabular-nums ${
        top ? "bg-accent text-canvas" : "bg-black/55 text-white backdrop-blur-sm"
      }`}
    >
      {rank}
    </span>
  );
}

function RatingChip({ avg }: { avg: number }) {
  return (
    <span className="absolute end-2.5 top-2.5 z-10 flex items-center gap-1 rounded-[8px] bg-black/55 px-1.5 py-0.5 text-[11.5px] font-semibold text-white backdrop-blur-sm transition-opacity duration-200 group-hover/card:opacity-0">
      <Star size={12} className="fill-accent text-accent" />
      {avg.toFixed(1)}
    </span>
  );
}

function cardKeyDown(e: React.KeyboardEvent, fn: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
}

function ThemeMarketCard({
  theme,
  rank,
  onOpen,
}: {
  theme: StoreTheme;
  rank?: number;
  onOpen: (t: StoreTheme) => void;
}) {
  const t = useT();
  const { state, run } = useAcquireState(() =>
    downloadTheme(theme.id, theme.cover ?? theme.screenshots[0] ?? null, theme.versionsCount).then(
      () => {},
    ),
  );
  const tokens = useMemo(() => tokensFromStoreTheme(theme), [theme]);
  return (
    <article
      role="button"
      tabIndex={0}
      title={theme.name}
      onClick={() => onOpen(theme)}
      onKeyDown={(e) => cardKeyDown(e, () => onOpen(theme))}
      className={CARD_CLASS}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-elevated">
        <Fit kind="theme" tokens={tokens} cover={theme.cover ?? theme.screenshots[0] ?? null} />
        {theme.ratingCount > 0 && <RatingChip avg={theme.ratingAvg} />}
        {rank != null && <RankChip rank={rank} />}
        <div className={ACTION_ROW}>
          <MarketCta variant="acquire" size="sm" state={state} onClick={run} label={t("Get")} />
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10">
          <PaletteSeam swatch={theme.swatch} />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 px-3.5 pb-3 pt-2.5">
        <span className="truncate text-[14.5px] font-semibold tracking-tight text-ink">
          {theme.name}
        </span>
        <span className="flex items-center gap-1.5 truncate text-[11.5px] text-ink-subtle">
          {theme.authorHandle ? (
            <UserHoverCard handle={theme.authorHandle}>
              <span className="truncate text-ink-muted transition-colors hover:text-ink">
                {theme.author || t("Anonymous")}
              </span>
            </UserHoverCard>
          ) : (
            <span className="truncate text-ink-muted">{theme.author || t("Anonymous")}</span>
          )}
          <span className="text-ink-subtle/60">·</span>
          <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
            <Download size={10.5} strokeWidth={2.2} />
            {fmtCount(theme.downloads)}
          </span>
        </span>
      </div>
    </article>
  );
}

function BundleMarketCard({
  bundle,
  rank,
  onOpen,
}: {
  bundle: StoreBundle;
  rank?: number;
  onOpen: (b: StoreBundle) => void;
}) {
  const t = useT();
  const { state, run } = useAcquireState(async () => {
    installBundle(bundle);
    await getBundle(bundle.id).catch(() => {});
  });
  return (
    <article
      role="button"
      tabIndex={0}
      title={bundle.name}
      onClick={() => onOpen(bundle)}
      onKeyDown={(e) => cardKeyDown(e, () => onOpen(bundle))}
      className={CARD_CLASS}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-elevated">
        <Fit kind={bundle.kind} icons={bundle.icons} cover={bundle.cover} />
        {bundle.ratingCount > 0 && <RatingChip avg={bundle.ratingAvg} />}
        {rank != null && <RankChip rank={rank} />}
        <div className={ACTION_ROW}>
          <MarketCta variant="acquire" size="sm" state={state} onClick={run} label={t("Install")} />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 px-3.5 pb-3 pt-2.5">
        <span className="truncate text-[14.5px] font-semibold tracking-tight text-ink">
          {bundle.name}
        </span>
        <span className="flex items-center gap-1.5 truncate text-[11.5px] text-ink-subtle">
          {bundle.authorAvatar && (
            <img
              src={bundle.authorAvatar}
              alt=""
              draggable={false}
              className="h-4 w-4 shrink-0 rounded-full object-cover ring-1 ring-edge-soft"
            />
          )}
          <span className="truncate text-ink-muted">{bundle.author || t("Anonymous")}</span>
          <span className="text-ink-subtle/60">·</span>
          <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
            <Download size={10.5} strokeWidth={2.2} />
            {fmtCount(bundle.downloads)}
          </span>
        </span>
      </div>
    </article>
  );
}

export function MarketCard({
  item,
  kind,
  rank,
  onOpen,
}: {
  item: StoreTheme | StoreBundle;
  kind: "theme" | "badge" | "award";
  rank?: number;
  onOpen: (item: StoreTheme | StoreBundle) => void;
}) {
  if (kind === "theme" && "swatch" in item) {
    return <ThemeMarketCard theme={item} rank={rank} onOpen={onOpen} />;
  }
  if ("kind" in item) {
    return <BundleMarketCard bundle={item} rank={rank} onOpen={onOpen} />;
  }
  return null;
}
