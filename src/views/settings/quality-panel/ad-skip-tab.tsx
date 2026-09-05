import { AdSkipShowcase } from "../ad-skip-showcase";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "../shared";

export function AdSkipTab() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <Section
      title={t("Injected ad skip (experimental)")}
      subtitle={t("Some cam and new-release rips have ads spliced into the video itself. When the community has marked one, a Skip button appears. You can also report ads you spot for review. Off by default.")}
    >
      <AdSkipShowcase />
      <ToggleRow
        label={t("Enable injected ad skip")}
        sub={t("Show a Skip button when a known injected ad plays, and a small report button on new releases so you can mark ads for review.")}
        value={settings.adSkipEnabled}
        onChange={(v) => update({ adSkipEnabled: v })}
      />
      {settings.adSkipEnabled && (
        <ToggleRow
          label={t("Always show the report button")}
          sub={t("Show the report button on every torrent stream, not just likely new releases.")}
          value={settings.adReportAlwaysShow}
          onChange={(v) => update({ adReportAlwaysShow: v })}
        />
      )}
      {settings.adSkipEnabled && (
        <ToggleRow
          label={t("Skip injected ads automatically")}
          sub={t("Jump past a known injected ad on its own instead of showing the Skip button.")}
          value={settings.autoSkipAd}
          onChange={(v) => update({ autoSkipAd: v })}
        />
      )}
    </Section>
  );
}
