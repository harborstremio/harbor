import { CommunityAddonsRail } from "@/components/community-addons-rail";
import type { ResolvedAddon } from "@/lib/addons-store/store";
import { useT } from "@/lib/i18n";
import { idOf } from "./addons-utils";
import { CategoryGrid } from "./category-grid";
import { HeroCard } from "./hero-card";
import { Rail } from "./rail";
import { LazyReveal } from "./lazy-reveal";

export function DiscoverPane({
  hero,
  rails,
  onOpen,
  onInstall,
  onUninstall,
  onCategorySelect,
  installedIds,
  authKey,
  onRefetch,
}: {
  hero: { entry: { id: string }; resolved: ResolvedAddon } | null;
  rails: {
    rail: { id: string; title: string; blurb?: string; layout: string };
    items: ResolvedAddon[];
  }[];
  onOpen: (id: string) => void;
  onInstall: (r: ResolvedAddon) => Promise<void>;
  onUninstall: (r: ResolvedAddon) => Promise<void>;
  onCategorySelect: (cat: string) => void;
  installedIds: Set<string>;
  authKey: string | null;
  onRefetch?: () => void;
}) {
  const t = useT();
  const essentialRail = rails.find((r) => r.rail.id === "essential");
  const otherRails = rails.filter((r) => r.rail.id !== "essential");
  const editorPicks = essentialRail
    ? essentialRail.items.filter((it) => idOf(it) !== (hero?.entry.id ?? ""))
    : [];

  return (
    <div className="flex flex-col gap-12">
      {!authKey && (
        <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] px-5 py-4 text-[13.5px] text-ink">
          <p className="font-semibold text-amber-200">
            {t("Sign in to sync your addons across devices")}
          </p>
          <p className="mt-1 text-ink-muted">
            {t(
              "Anything you install in Harbor pushes back to your Stremio account so it shows up on mobile too. Sign in via the avatar in the bottom-left of the sidebar.",
            )}
          </p>
        </div>
      )}
      {hero && (
        <HeroCard
          resolved={hero.resolved}
          onOpen={() => onOpen(hero.entry.id)}
          onInstall={() => onInstall(hero.resolved)}
          onUninstall={() => onUninstall(hero.resolved)}
          installed={installedIds.has(hero.entry.id)}
        />
      )}
      <CommunityAddonsRail installedIds={installedIds} onChange={onRefetch} onOpen={onOpen} />
      {editorPicks.length > 0 && (
        <LazyReveal minHeight={320}>
          <Rail
            title={t("Starters")}
            blurb={t("Common picks for a fresh setup.")}
            layout="list"
            items={editorPicks}
            onOpen={onOpen}
            onInstall={onInstall}
            onUninstall={onUninstall}
            installedIds={installedIds}
          />
        </LazyReveal>
      )}
      <LazyReveal minHeight={220}>
        <CategoryGrid onCategorySelect={onCategorySelect} />
      </LazyReveal>
      {otherRails.map(({ rail, items }) => (
        <LazyReveal key={rail.id} minHeight={360}>
          <Rail
            title={t(rail.title)}
            blurb={rail.blurb ? t(rail.blurb) : undefined}
            layout={rail.layout}
            items={items}
            onOpen={onOpen}
            onInstall={onInstall}
            onUninstall={onUninstall}
            installedIds={installedIds}
          />
        </LazyReveal>
      ))}
    </div>
  );
}
