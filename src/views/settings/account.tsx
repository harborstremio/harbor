import { SettingGroup } from "./kit";
import { useSettings } from "@/lib/settings";
import { useState } from "react";
import { Link2 } from "./icons";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";
import { useSubTabs } from "./sub-tabs";
import { IdentityTab } from "./account/identity-tab";
import { ProfilesStrip } from "./account/profiles-strip";
import { StartupDefaults } from "./account/startup-defaults";
import { SettingsScopeCard } from "./account/settings-scope-card";
import { StremioCard } from "./account/stremio-card";
import { SyncedAddonsCard } from "./account/synced-addons-card";
import { HarborAccountPanel } from "@/views/account/harbor-account-panel";

// Keep persisted tab IDs and deep links compatible with earlier releases.
type Tab = "you" | "profiles" | "harbor" | "stremio";
export function AccountStub() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("stremio");
  const tabs = [
    { id: "you", label: t("Your profile") },
    { id: "profiles", label: t("Profiles") },
    { id: "stremio", label: t("JL account") },
    { id: "harbor", label: t("Community account") },
  ];
  useSubTabs(tabs, tab, (id) => setTab(id as Tab));
  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
      {tab === "you" && <IdentityTab />}
      {tab === "profiles" && <ProfilesTab />}
      {tab === "harbor" && <HarborAccountPanel />}
      {tab === "stremio" && <JlAccountTab />}
    </div>
  );
}
function ProfilesTab() {
  const t = useT();
  return (
    <Section
      title={t("Profiles")}
      subtitle={t("Each JL profile keeps its own settings, library, and PIN.")}
    >
      <SettingGroup label={t("Profiles on this device")}>
        <ProfilesStrip />
      </SettingGroup>
      <StartupDefaults />
      <SettingsScopeCard />
    </Section>
  );
}
function JlAccountTab() {
  const t = useT();
  const { settings, update } = useSettings();
  return (
    <>
      <Section
        title={t("JL Media Vision account")}
        subtitle={t("Your local library remains available without an account.")}
      >
        <StremioCard />
      </Section>
      <Section
        title={t("Installed addons")}
        subtitle={t(
          "Your addon configurations are kept on this device. Manage each installation in Addons.",
        )}
      >
        <SyncedAddonsCard />
      </Section>
      <Section
        title={t("Addon install links")}
        subtitle={t(
          "JL Media Vision supports compatible manifests and stremio:// install links without an external account.",
        )}
      >
        <ToggleRow
          label={t("Open compatible addon links in JL Media Vision")}
          sub={t(
            "Choose JL Media Vision when your operating system asks which app should open an addon link. You can also paste a manifest URL in Addons.",
          )}
          leading={<Link2 size={18} />}
          value={settings.stremioDeeplinkInstall}
          onChange={(stremioDeeplinkInstall) => update({ stremioDeeplinkInstall })}
        />
      </Section>
    </>
  );
}
