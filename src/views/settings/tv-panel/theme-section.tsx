import { Check } from "../icons";
import { useRef } from "react";
import { useT } from "@/lib/i18n";
import { tvFocus } from "@/lib/keyboard-navigation";
import { navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { useSettings } from "@/lib/settings";
import { customColorsToTokens, getThemeById } from "@/lib/theme";
import { Section } from "../shared";
import { SettingRow } from "../kit";
import { SButton } from "../ui";
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
    return <span className="h-[34px] w-full rounded-[8px] bg-canvas" />;
  }
  return (
    <span className="flex h-[34px] w-full overflow-hidden rounded-[8px]">
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
  btnRef,
}: {
  card: Card;
  on: boolean;
  onPick: () => void;
  btnRef?: (el: HTMLButtonElement | null) => void;
}) {
  const t = useT();
  return (
    <button
      ref={btnRef}
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className={`flex flex-col gap-2 rounded-[10px] p-2.5 text-start transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        on ? "bg-raised" : "bg-elevated hover:bg-raised"
      }`}
    >
      <Swatch colors={card.swatch} />
      <span className="flex min-h-[22px] items-center justify-between gap-2">
        <span className="truncate text-[15.5px] font-normal leading-[22px] text-ink">
          {t(card.name)}
        </span>
        {on && <Check size={16} strokeWidth={2.8} className="shrink-0 text-accent" />}
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
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);

  const pick = (card: Card) => {
    writeTvTheme(profileId, { id: card.id, name: card.name, tokens: card.tokens });
  };

  const keepOwn = () => {
    const at = cards.findIndex((c) => c.id === activeId);
    const back = tiles.current[at >= 0 ? at : 0];
    if (back && navOwnsFocus(document.activeElement as HTMLElement | null)) tvFocus(back);
    writeTvTheme(profileId, null);
  };

  return (
    <Section
      title={t("Theme on the TV")}
      subtitle={t("Choose a theme for Big Picture on your TV, or copy this computer's colors.")}
    >
      {mine && (
        <SettingRow
          label={t("Match this computer")}
          desc={t("Send the theme you are looking at right now, exactly as it is here.")}
        >
          <span className="w-32 shrink-0">
            <Swatch colors={mine.swatch} />
          </span>
          <SButton variant="primary" onClick={() => pick(mine)}>
            {t("Send to TV")}
          </SButton>
        </SettingRow>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cards.map((c, i) => (
          <Tile
            key={c.id}
            card={c}
            on={activeId === c.id}
            onPick={() => pick(c)}
            btnRef={(el) => {
              tiles.current[i] = el;
            }}
          />
        ))}
      </div>

      {activeId && (
        <SButton className="self-start" onClick={keepOwn}>
          {t("Let the TV keep its own theme")}
        </SButton>
      )}
    </Section>
  );
}
