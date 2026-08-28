import { AlignLeft, Rows3, Star } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow, type SectionId } from "./shared";

export type PagePreference = {
  favorite: boolean;
  compact: boolean;
  showIntro: boolean;
};

export function pagePreference(
  preferences: Record<string, Partial<PagePreference>> | undefined,
  section: SectionId,
): PagePreference {
  const stored = preferences?.[section];
  return {
    favorite: stored?.favorite === true,
    compact: stored?.compact === true,
    showIntro: stored?.showIntro !== false,
  };
}

export function PagePreferences({
  value,
  onChange,
}: {
  value: PagePreference;
  onChange: (patch: Partial<PagePreference>) => void;
}) {
  const t = useT();
  return (
    <Section
      title={t("This Settings page")}
      subtitle={t("These preferences apply only to the page you are viewing.")}
    >
      <div className="grid gap-2.5">
        <ToggleRow
          label={t("Keep at the top of its menu group")}
          sub={t("Marks this page with a star and moves it before the other pages in the same group.")}
          value={value.favorite}
          onChange={(favorite) => onChange({ favorite })}
          leading={<Star size={18} />}
        />
        <ToggleRow
          label={t("Compact page spacing")}
          sub={t("Fits more settings on screen by reducing card spacing without changing any feature.")}
          value={value.compact}
          onChange={(compact) => onChange({ compact })}
          leading={<Rows3 size={18} />}
        />
        <ToggleRow
          label={t("Show page introduction")}
          sub={t("Shows the short explanation below this page's title.")}
          value={value.showIntro}
          onChange={(showIntro) => onChange({ showIntro })}
          leading={<AlignLeft size={18} />}
        />
      </div>
    </Section>
  );
}
