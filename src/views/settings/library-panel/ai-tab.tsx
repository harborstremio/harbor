import { AiSearchSection } from "../ai-search-section";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "../shared";
import { SearchShortcutsSection } from "../search-shortcuts-section";

export function AiTab() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <>
      <SearchShortcutsSection />
      <Section title={t("AI assistant")}>
        <ToggleRow
          label={t("Enable AI chat")}
          sub={t("Show the AI chat button and assistant. Turning this off closes any open chat.")}
          value={settings.aiChatEnabled}
          onChange={(value) => update({ aiChatEnabled: value })}
        />
      </Section>
      <AiSearchSection />
    </>
  );
}
