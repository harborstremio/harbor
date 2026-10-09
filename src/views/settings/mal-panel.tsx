import { TrackerIdentity } from "./tracker-identity";
import malLogo from "@/assets/mal.png";
import { TrackerConnect } from "./tracker-connect";
import { LogOut, RefreshCw } from "./icons";
import { useEffect, useState } from "react";
import { MalConnectModal } from "@/components/mal/mal-connect-modal";
import { fetchMalAvatar } from "@/lib/mal/profile";
import { useMal } from "@/lib/mal/provider";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";
import { ModalButton, ROW_DESC, SettingsModal } from "./kit";
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


  return (
    <>
      {!isConnected ? (
        <Section title={t("Not connected")} bare>
          <TrackerConnect
            service="MyAnimeList"
            logo={malLogo}
            description={t("Bring your anime list into Harbor and update your episode count as you watch. Your existing progress is kept.")}
            onConnect={() => setModalOpen(true)}
            website="https://myanimelist.net"
          />
        </Section>
      ) : (
        <Section
          title={t("Connected")}
          subtitle={t("Harbor keeps your MyAnimeList watch progress in sync.")}
        >
          <TrackerIdentity
            service="MyAnimeList"
            logo={malLogo}
            handle={userName || undefined}
            avatar={malAvatar}
            meta={session?.createdAt ? t("Authorized {when}", { when: sessionAge(t, session.createdAt) }) : undefined}
            profileUrl={userName ? `https://myanimelist.net/profile/${encodeURIComponent(userName)}` : undefined}
            onDisconnect={() => setConfirmDisconnect(true)}
          />

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
