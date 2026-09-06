import { SettingGroup } from "./kit";
import { useSettings } from "@/lib/settings";
import { useState } from "react";
import { Info, Link2 } from "./icons";
import { useT } from "@/lib/i18n";
import { ROW_DESC, Section, ToggleRow } from "./shared";
import { useSubTabs } from "./sub-tabs";
import { IdentityTab } from "./account/identity-tab";
import { ProfilesStrip } from "./account/profiles-strip";
import { StartupDefaults } from "./account/startup-defaults";
import { SettingsScopeCard } from "./account/settings-scope-card";
import { StremioCard } from "./account/stremio-card";
import { SyncedAddonsCard } from "./account/synced-addons-card";
import { HarborAccountPanel } from "@/views/account/harbor-account-panel";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type Tab = "you" | "profiles" | "harbor" | "stremio";

export function AccountStub() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("you");
  const tabs = [
    { id: "you" as const, label: t("Your profile") },
    { id: "profiles" as const, label: t("Profiles") },
    { id: "harbor" as const, label: t("Harbor account") },
    { id: "stremio" as const, label: t("Stremio") },
  ];

  useSubTabs(tabs, tab, (id) => setTab(id as Tab));
  return (
    <div key={tab} className="harbor-cascade flex flex-col gap-10">
      {tab === "you" && <IdentityTab />}
      {tab === "profiles" && <ProfilesTab />}
      {tab === "harbor" && <HarborAccountPanel />}
      {tab === "stremio" && <StremioTab />}
    </div>
  );
}

function ProfilesTab() {
  const t = useT();
  return (
    <Section
      title={t("Profiles")}
      subtitle={t("Create profiles for the people who use Harbor. Each can have its own appearance, settings, and PIN.")}
    >
      <SettingGroup label={t("Everyone on this Harbor")}>
        <p className={`max-w-[70ch] ${ROW_DESC}`}>
          {t("Choose a profile to switch. Use the pencil to edit its details and access settings.")}
        </p>
        <ProfilesStrip />
      </SettingGroup>
      <StartupDefaults />
      <SettingsScopeCard />
    </Section>
  );
}

function StremioTab() {
  const t = useT();
  return (
    <>
      {isTauri && (
        <Section
          title={t("Stremio install links")}
          subtitle={t(
            "Harbor catches stremio:// install links so the configure-and-install flow stays inside the app. Every install also syncs to your Stremio account, so the official app remains the canonical home for your library.",
          )}
        >
          <StremioDeeplinkRow />
        </Section>
      )}

      <Section
        title={t("Stremio account")}
        subtitle={t("Library, watch progress, and addon collection sync from this account.")}
      >
        <StremioCard />
      </Section>
      <Section
        title={t("Synced addons")}
        subtitle={t("Harbor pulls your addon collection from Stremio. Manage individual addons in Streaming sources.")}
      >
        <SyncedAddonsCard />
      </Section>
    </>
  );
}

function StremioDeeplinkRow() {
  const t = useT();
  const { settings, update } = useSettings();
  const on = settings.stremioDeeplinkInstall;
  return (
    <SettingGroup>
      <ToggleRow
        label={t("Catch stremio:// install links inside Harbor")}
        sub={t(
          "Harbor's in-app installer animates the manifest install and keeps you in context. Anything Harbor installs is also synced to your Stremio account, so the official app stays the canonical library. Turn this off and Stremio becomes the only handler for stremio:// links; Harbor still installs anything you trigger from inside the app (Configure & install, paste, drag-and-drop).",
        )}
        leading={<Link2 size={18} strokeWidth={2} />}
        value={on}
        onChange={(stremioDeeplinkInstall) => update({ stremioDeeplinkInstall })}
      />
      <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
        <Info size={18} className="mt-[2px] shrink-0 text-ink-subtle" />
        <p className={`max-w-[66ch] ${ROW_DESC}`}>
          {on
            ? t(
                "Heads up: if Stremio is also installed, Windows may ask which app to use the first time a stremio:// link fires. Pick Harbor to make it stick.",
              )
            : t(
                "stremio:// links now open in the Stremio app. Harbor will only install when you trigger it from inside Harbor.",
              )}
        </p>
      </div>
    </SettingGroup>
  );
}
