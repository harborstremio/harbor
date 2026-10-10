import { useT } from "@/lib/i18n";
import { Section } from "../shared";
import { DesktopOnlyBlock, isTauri } from "../player-panel/internals";
import { AnimeRepairRow, LibraryRepairRow } from "./library-repair-rows";

export function RepairTab() {
  const t = useT();
  const rows = (
    <>
      <LibraryRepairRow />
      <AnimeRepairRow />
    </>
  );
  return (
    <Section
      title={t("Local library repair")}
      subtitle={t(
        "Checks the active JL profile library for malformed item records and repairs compatible fields locally.",
      )}
    >
      {isTauri ? (
        rows
      ) : (
        <div data-tv-skip="">
          <DesktopOnlyBlock>{rows}</DesktopOnlyBlock>
        </div>
      )}
    </Section>
  );
}
