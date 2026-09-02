import { useT } from "@/lib/i18n";
import { PlayModePanel } from "../player-panel";
import { Section } from "../shared";

export function PlayTab() {
  const t = useT();
  return (
    <Section
      title={t("Play button behavior")}
      subtitle={t("Choose what happens when you hit Play on a title. Manual gives you full control over quality and source.")}
    >
      <PlayModePanel />
    </Section>
  );
}
