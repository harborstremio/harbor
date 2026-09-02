import { useT } from "@/lib/i18n";
import { Section } from "../shared";
import { SettingGroup } from "../kit";
import { DesktopOnlyBlock } from "../player-panel/internals";
import { AnimeRepairRow, LibraryRepairRow } from "./library-repair-rows";

export function RepairTab() {
  const t = useT();
  return (
    <>
      <Section
        title={t("Stremio library repair")}
        subtitle={t(
          "Scans your Stremio library and rewrites any item whose shape doesn't match Stremio's exact schema. Safe to run anytime; only items that need fixing get touched.",
        )}
      >
        <DesktopOnlyBlock>
          <SettingGroup>
            <LibraryRepairRow />
            <AnimeRepairRow />
          </SettingGroup>
        </DesktopOnlyBlock>
      </Section>
    </>
  );
}

