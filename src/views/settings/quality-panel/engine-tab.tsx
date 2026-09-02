import { useT } from "@/lib/i18n";
import { PlayerEnginePanel } from "../player-panel";
import { Section } from "../shared";

export function EngineTab() {
  const t = useT();
  return (
    <Section
      title={t("Player engine")}
      subtitle={t("HTML5 plays everything WebView2 supports. mpv handles TrueHD, DTS-HD, AV1, weird containers, and HDR. Auto picks based on the source.")}
    >
      <PlayerEnginePanel />
    </Section>
  );
}
