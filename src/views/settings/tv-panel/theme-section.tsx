import { Check } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { customColorsToTokens, getThemeById } from "@/lib/theme";
import { Section } from "../shared";
import { SettingRow } from "../kit";
import { TV_BUILTIN_THEME_IDS } from "./model-lists";
import { writeTvTheme, type TvThemeDoc } from "./store";

const SWATCH_KEYS = ["--color-canvas", "--color-elevated", "--color-accent"];

type Card = { id: string; name: string; swatch: string[]; tokens: Record<string, string> | null };

function swatchOf(tokens: Record<string, string> | undefined, fallback: string[]): string[] {
  if (!tokens) return fallback;
  const picked = SWATCH_KEYS.map((k) => tokens[k]).filter((v): v is string => !!v);
  return picked.length === SWATCH_KEYS.length ? picked : fallback;
}

function builtinCards(): Card[] {
  return TV_BUILTIN_THEME_IDS.map((id) => {
    const preset = getThemeById(id);
    return {
      id,
      name: preset?.name ?? id,
      swatch: swatchOf(preset?.tokens, preset?.swatch ?? []),
      tokens: null,
    };
  });
}

function thisComputer(
  preset: string,
  custom: ReturnType<typeof customColorsToTokens> | null,
): Card | null {
  if (preset === "custom") {
    if (!custom) return null;
    return { id: "custom", name: "This computer", swatch: swatchOf(custom, []), tokens: custom };
  }
  const found = getThemeById(preset);
  if (!found) return null;
  return {
    id: preset,
    name: found.name,
    swatch: swatchOf(found.tokens, found.swatch),
    tokens: found.tokens,
  };
}

function Swatch({ colors }: { colors: string[] }) {
  if (colors.length === 0) {
    return <span className="h-8 w-full rounded-md bg-canvas" />;
  }
  return (
    <span className="flex h-8 w-full overflow-hidden rounded-md">
      {colors.map((c, i) => (
        <span key={i} className="flex-1" style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}

function Tile({
  card,
  on,
  onPick,
}: {
  card: Card;
  on: boolean;
  onPick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onPick}
      className={`flex flex-col gap-2 rounded-md p-2.5 text-start transition-colors ${
        on ? "bg-raised" : "bg-elevated hover:bg-raised"
      }`}
    >
      <Swatch colors={card.swatch} />
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[12.5px] font-medium text-ink">{t(card.name)}</span>
        {on && <Check size={14} strokeWidth={2.8} className="shrink-0 text-accent" />}
      </span>
    </button>
  );
}

export function TvThemeSection({
  profileId,
  active,
}: {
  profileId: string;
  active: TvThemeDoc | null;
}) {
  const t = useT();
  const { settings } = useSettings();
  const cards = builtinCards();
  const mine = thisComputer(
    settings.theme.preset,
    settings.theme.customColors ? customColorsToTokens(settings.theme.customColors) : null,
  );
  const activeId = active?.id ?? null;

  const pick = (card: Card) => {
    writeTvTheme(profileId, { id: card.id, name: card.name, tokens: card.tokens });
  };

  return (
    <Section
      title={t("Theme on the TV")}
      subtitle={t("Pick the palette Big Picture wears on the television. A theme this computer knows but the TV does not is sent whole, colors and all.")}
    >
      {mine && (
        <SettingRow
          wide
          label={t("Match this computer")}
          desc={t("Send the theme you are looking at right now, exactly as it is here.")}
        >
          <span className="w-32 shrink-0">
            <Swatch colors={mine.swatch} />
          </span>
          <button
            type="button"
            onClick={() => pick(mine)}
            className="shrink-0 rounded-md bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
          >
            {t("Send to TV")}
          </button>
        </SettingRow>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cards.map((c) => (
          <Tile key={c.id} card={c} on={activeId === c.id} onPick={() => pick(c)} />
        ))}
      </div>

      {activeId && (
        <button
          type="button"
          onClick={() => writeTvTheme(profileId, null)}
          className="self-start text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
        >
          {t("Let the TV keep its own theme")}
        </button>
      )}
    </Section>
  );
}
