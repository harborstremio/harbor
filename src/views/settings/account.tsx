import { SettingGroup } from "./kit";
import { useSettings } from "@/lib/settings";
import { useState } from "react";
import { Users, Link2 } from "lucide-react";
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

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type Tab = "you" | "profiles" | "harbor" | "stremio";

export function AccountStub() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("you");
  const tabs = [
    { id: "you" as const, label: t("You") },
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
      subtitle={t("Everyone who uses this Harbor gets their own watch history, avatar, color, and optional PIN. Switch anytime.")}
    >
      <div className="flex flex-col gap-4 rounded-md bg-elevated px-4 py-4">
        <span className="flex items-center gap-2.5">
          <Users size={16} strokeWidth={2} className="shrink-0 text-ink-muted" />
          <span className="text-[13.5px] font-medium text-ink">{t("Everyone on this Harbor")}</span>
          <span className="text-[12.5px] text-ink-subtle">
            {t("Tap to switch. The pencil renames, recolors, or adds a PIN.")}
          </span>
        </span>
        <ProfilesStrip />
      </div>
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
        leading={
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-md ${
              on ? "bg-accent-soft text-accent" : "bg-raised text-ink-subtle"
            }`}
          >
            <Link2 size={16} strokeWidth={2.2} />
          </span>
        }
        value={on}
        onChange={(stremioDeeplinkInstall) => update({ stremioDeeplinkInstall })}
      />
      {on ? (
        <p className="px-1 text-[11.5px] leading-relaxed text-ink-subtle">
          {t(
            "Heads up: if Stremio is also installed, Windows may ask which app to use the first time a stremio:// link fires. Pick Harbor to make it stick.",
          )}
        </p>
      ) : (
        <p className="px-1 text-[11.5px] leading-relaxed text-ink-subtle">
          {t(
            "stremio:// links now open in the Stremio app. Harbor will only install when you trigger it from inside Harbor.",
          )}
        </p>
      )}
    </SettingGroup>
  );
}
