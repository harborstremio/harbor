import { Dropdown } from "@/components/dropdown";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT, useUiLanguage } from "@/lib/i18n";
import { LIBRARY_PLAYTIME_FILTERS, libraryPlaytime, type LibraryPlaytimeFilter as PlaytimeFilter } from "@/lib/games/library-playtime";
import type { UnifiedLibraryGame } from "@/lib/games/unified-library";
import { CustomPlaytimeLabel } from "./game-custom-playtime";

export function LibraryPlaytimeFilter({ value = "all", onChange }: { value?: PlaytimeFilter; onChange: (value: PlaytimeFilter) => void }) {
  const t = useT();
  return <Dropdown value={value} onChange={value => onChange(value as PlaytimeFilter)} ariaLabel={t("games.unified.playtime")} size="sm"
    options={LIBRARY_PLAYTIME_FILTERS.map(value => ({ value, label: t(`games.unified.playtime.${value}`) }))} />;
}

export function LibraryPlaytimeLabel({ game, showUnknown }: { game: UnifiedLibraryGame; showUnknown: boolean }) {
  const t = useT(), language = useUiLanguage(), time = libraryPlaytime(game);
  if (!time) return showUnknown ? <HoverTooltip label={t("games.unified.playtime.unknownHint")}><small className="games-unified-playtime" tabIndex={0}>{t("games.unified.playtime.unknown")}</small></HoverTooltip> : null;
  if (game.quick?.source === "custom" && (time.seconds > 0 || game.quick.custom.playtimeCorrection)) return <CustomPlaytimeLabel game={game.quick.custom} />;
  const duration = t("games.playtime.duration", { hours: Math.floor(time.seconds / 3600).toLocaleString(language), minutes: Math.floor(time.seconds % 3600 / 60).toLocaleString(language) });
  return <small className="games-unified-playtime" title={time.source === "hydra" ? t("games.hydra.includesTime") : time.source === "harbor" ? t("games.playtime.tracked") : undefined}>{time.seconds === 0 ? t(time.source === "steam" ? "games.unified.playtime.zeroSteam" : "games.unified.playtime.zeroHarbor") : t(time.source === "steam" ? "games.unified.playtime.steam" : "games.playtime.card", { time: duration })}</small>;
}
