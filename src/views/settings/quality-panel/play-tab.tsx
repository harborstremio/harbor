import { useT } from "@/lib/i18n";
import { PlayModePanel } from "../player-panel";
import { ROW_DESC, Section } from "../shared";

export function PlayTab() {
  const t = useT();
  return (
    <Section title={t("Play button behavior")} bare>
      <div className="flex flex-col gap-[11px]">
        <p className={`max-w-[70ch] ${ROW_DESC}`}>
          {t("Choose what happens when you hit Play on a title. Manual gives you full control over quality and source.")}
        </p>
        <PlayModePanel />
      </div>
    </Section>
  );
}
