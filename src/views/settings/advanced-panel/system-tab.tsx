import { useT } from "@/lib/i18n";
import { Section } from "../shared";
import { TrayRow } from "../tray-row";
import { DownloadsSection } from "../player-panel";
import { isTauri } from "../player-panel/internals";

export function SystemTab() {
  const t = useT();
  return (
    <>
      <Section
        title={t("Downloads")}
        subtitle={t(
          "Where Harbor saves videos when you hit Download in the player. Pick any folder, including one on a different drive.",
        )}
      >
        <DownloadsSection />
      </Section>

      {isTauri && (
        <Section
          title={t("System tray")}
          subtitle={t(
            "Keep Harbor a click away. Close it to the system tray instead of quitting, and control it from the tray menu. These also mirror into the tray menu live.",
          )}
        >
          <TrayRow />
        </Section>
      )}

    </>
  );
}

