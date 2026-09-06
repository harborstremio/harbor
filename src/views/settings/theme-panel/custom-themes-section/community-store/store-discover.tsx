import {
  Clock,
  Flame,
  Minus,
  Moon,
  Snowflake,
  Sparkles,
  Sun,
  Zap,
  type LucideIcon,
} from "../../../icons";
import { t as translate, useT } from "@/lib/i18n";
import type { StoreTheme } from "@/lib/theme-store";
import type { Mood } from "./color-rank";
import type { StoreData } from "./use-store-themes";
import { StoreHero } from "./store-hero";
import { StoreRail } from "./store-rail";
import { StoreCategoryChips } from "./store-category-chips";
import { StoreFeatureCards } from "./store-feature-cards";
import { TopAuthors } from "./top-authors";

const MOOD_ICON: Record<Mood, LucideIcon> = {
  dark: Moon,
  vibrant: Zap,
  warm: Flame,
  cool: Snowflake,
  muted: Minus,
  light: Sun,
};

function heroTag(data: StoreData): string | undefined {
  const h = data.hero;
  if (!h) return undefined;
  if (data.popular[0]?.id === h.id) return translate("#1 this week");
  const created = Date.parse(h.createdAt);
  if (Number.isFinite(created) && Date.now() - created < 14 * 86_400_000) return translate("New");
  return translate("Staff pick");
}

export function StoreDiscover({
  data,
  onOpen,
  onAuthor,
  onBrowseAll,
  onPickMood,
  onShare,
}: {
  data: StoreData;
  onOpen: (t: StoreTheme) => void;
  onAuthor: (author: string) => void;
  onBrowseAll: () => void;
  onPickMood: (mood: Mood) => void;
  onShare: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-10">
      {data.hero && (
        <StoreHero
          theme={data.hero}
          label={t("Featured theme")}
          tag={heroTag(data)}
          onOpen={onOpen}
        />
      )}

      <StoreCategoryChips rails={data.moodRails} onPick={onPickMood} />

      <StoreRail
        icon={<Sparkles size={16} strokeWidth={2.2} />}
        title={t("You might like")}
        subtitle={t("Highly rated by the community")}
        themes={data.topRated.slice(0, 20)}
        scrollKey="themestore:toprated"
        onOpen={onOpen}
        onViewAll={onBrowseAll}
      />

      <StoreRail
        icon={<Clock size={16} strokeWidth={2.2} />}
        title={t("New this week")}
        subtitle={t("Fresh from the community")}
        themes={data.fresh.slice(0, 20)}
        scrollKey="themestore:fresh"
        onOpen={onOpen}
        onViewAll={onBrowseAll}
      />

      {data.moodRails.map((r) => {
        const Icon = MOOD_ICON[r.mood];
        return (
          <StoreRail
            key={r.mood}
            icon={<Icon size={16} strokeWidth={2.2} />}
            title={t(r.title)}
            subtitle={t(r.blurb)}
            themes={r.items.slice(0, 16)}
            scrollKey={`themestore:mood-${r.mood}`}
            onOpen={onOpen}
            onViewAll={onBrowseAll}
          />
        );
      })}

      <TopAuthors authors={data.authors} onSelect={onAuthor} />

      <StoreFeatureCards onShare={onShare} />
    </div>
  );
}
