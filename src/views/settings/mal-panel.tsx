import { ExternalLink, Info, Link2, LogOut, RefreshCw, Trash2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { MalConnectModal } from "@/components/mal/mal-connect-modal";
import { fetchMalAvatar } from "@/lib/mal/profile";
import { useMal } from "@/lib/mal/provider";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";
import { ModalButton, ROW_DESC, SettingRow, SettingsModal } from "./kit";
import { SButton } from "./ui";
import { SyncIndicatorSetting } from "./sync-indicator-setting";

export function MalPanel() {
  const t = useT();
  const { isConnected, userName, disconnect, session } = useMal();
  const { settings, update } = useSettings();
  const { activeProfile, updateProfile } = useProfiles();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [malAvatar, setMalAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      setMalAvatar(null);
      return;
    }
    let live = true;
    fetchMalAvatar().then((url) => {
      if (live) setMalAvatar(url);
    });
    return () => {
      live = false;
    };
  }, [isConnected]);

  const pushAvatar = (url: string | null) => {
    update({ harborAvatar: url });
    if (activeProfile) updateProfile(activeProfile.id, { avatar: url });
  };

  useEffect(() => {
    if (settings.useMalAvatar && malAvatar && settings.harborAvatar !== malAvatar) {
      pushAvatar(malAvatar);
    }
  }, [settings.useMalAvatar, malAvatar]);

  const toggleMalAvatar = (on: boolean) => {
    if (on) {
      if (malAvatar) pushAvatar(malAvatar);
      update({ useMalAvatar: true });
    } else {
      update({ useMalAvatar: false });
      if (settings.harborAvatar === malAvatar) pushAvatar(null);
    }
  };

  const authorized = sessionAge(t, session?.createdAt);

  return (
    <>
      {!isConnected ? (
        <Section
          title={t("Not connected")}
          subtitle={t("Sync your MyAnimeList watch progress and list as you finish episodes.")}
        >
          <SettingRow
            icon={<Link2 size={20} strokeWidth={2.1} />}
            label={t("Connect your MyAnimeList account")}
            desc={t("Sign in once with MyAnimeList. Harbor then updates your episode count as you watch, and never lowers a count you already have.")}
          >
            <SButton variant="primary" onClick={() => setModalOpen(true)}>
              <Link2 size={18} strokeWidth={2.2} />
              {t("Connect MyAnimeList")}
            </SButton>
          </SettingRow>
          <SettingRow
            icon={<Info size={20} strokeWidth={2.1} />}
            label={t("About MyAnimeList")}
            desc={t("MyAnimeList is a free site for tracking the anime you watch. Open it to read more or to make an account.")}
          >
            <SButton onClick={() => openUrl("https://myanimelist.net")}>
              {t("Open myanimelist.net")}
              <ExternalLink size={18} strokeWidth={2.2} />
            </SButton>
          </SettingRow>
        </Section>
      ) : (
        <Section
          title={t("Connected")}
          subtitle={t("Harbor keeps your MyAnimeList watch progress in sync.")}
        >
          <SettingRow
            icon={<UserRound size={20} strokeWidth={2.1} />}
            label={userName ? `@${userName}` : t("Your MyAnimeList account")}
            desc={
              authorized
                ? t("Authorized {when}", { when: authorized })
                : t("Harbor is signed in to your MyAnimeList account.")
            }
          >
            {userName && (
              <SButton
                onClick={() =>
                  openUrl(`https://myanimelist.net/profile/${encodeURIComponent(userName)}`)
                }
              >
                {t("Open profile")}
                <ExternalLink size={18} strokeWidth={2.2} />
              </SButton>
            )}
          </SettingRow>
          <ToggleRow
            label={t("Sync watch progress")}
            sub={t("Finishing an anime episode updates your MyAnimeList progress. Forward only: it never lowers a count you already have.")}
            value={settings.malAutoSync}
            onChange={(v) => update({ malAutoSync: v })}
            leading={<RefreshCw size={20} strokeWidth={2.1} />}
          />
          {malAvatar && (
            <ToggleRow
              label={t("Use MyAnimeList avatar")}
              sub={t("Set your MyAnimeList profile picture as your Harbor avatar.")}
              value={settings.useMalAvatar}
              onChange={toggleMalAvatar}
              leading={
                <img
                  src={malAvatar}
                  alt=""
                  draggable={false}
                  className="h-6 w-6 rounded-full object-cover"
                />
              }
            />
          )}
          <SettingRow
            icon={<LogOut size={20} strokeWidth={2.1} />}
            label={t("Disconnect from MyAnimeList")}
            desc={t("Harbor signs out and stops updating your progress. Your list on MyAnimeList is left as it is.")}
          >
            <SButton variant="danger" onClick={() => setConfirmDisconnect(true)}>
              <Trash2 size={18} strokeWidth={2.2} />
              {t("Disconnect")}
            </SButton>
          </SettingRow>
          <SettingsModal
            open={confirmDisconnect}
            onClose={() => setConfirmDisconnect(false)}
            title={t("Disconnect from MyAnimeList")}
            actions={
              <>
                <ModalButton ghost onClick={() => setConfirmDisconnect(false)}>
                  {t("Cancel")}
                </ModalButton>
                <SButton
                  variant="danger"
                  onClick={() => {
                    if (settings.useMalAvatar && settings.harborAvatar === malAvatar) {
                      pushAvatar(null);
                    }
                    update({ useMalAvatar: false });
                    disconnect();
                    setConfirmDisconnect(false);
                  }}
                >
                  <LogOut size={18} strokeWidth={2.2} />
                  {t("Disconnect")}
                </SButton>
              </>
            }
          >
            <p className={`max-w-[66ch] ${ROW_DESC}`}>
              {t("Disconnect MyAnimeList? Your progress will stop syncing until you reconnect.")}
            </p>
          </SettingsModal>
        </Section>
      )}

      {isConnected && <SyncIndicatorSetting />}

      {modalOpen && <MalConnectModal onClose={() => setModalOpen(false)} />}
    </>
  );
}

function sessionAge(t: (key: string, vars?: Record<string, string | number>) => string, createdAt?: number): string {
  if (!createdAt) return "";
  const days = Math.floor((Date.now() - createdAt) / 86400000);
  if (days < 1) return t("today");
  if (days < 30) return days === 1 ? t("{n} day ago", { n: days }) : t("{n} days ago", { n: days });
  const months = Math.floor(days / 30);
  return months === 1 ? t("{n} month ago", { n: months }) : t("{n} months ago", { n: months });
}
