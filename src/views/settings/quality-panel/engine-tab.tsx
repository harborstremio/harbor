import { useT } from "@/lib/i18n";
import { PlayerEnginePanel } from "../player-panel";
import { ROW_DESC, Section } from "../shared";

export function EngineTab() {
  const t = useT();
  return (
    <Section title={t("Player engine")} bare>
      <div className="flex flex-col gap-[11px]">
        <p className={`max-w-[70ch] ${ROW_DESC}`}>
          {t("HTML5 plays everything WebView2 supports. mpv handles TrueHD, DTS-HD, AV1, weird containers, and HDR. Auto picks based on the source.")}
        </p>
        <PlayerEnginePanel />
      </div>
    </Section>
  );
}
