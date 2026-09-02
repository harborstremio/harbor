import { Check, ExternalLink, Link2, LogOut, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { MalConnectModal } from "@/components/mal/mal-connect-modal";
import { fetchMalAvatar } from "@/lib/mal/profile";
import { useMal } from "@/lib/mal/provider";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";
import { ModalButton, SettingRow, SettingsModal } from "./kit";
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
        <section className="flex flex-col gap-5 rounded-md bg-elevated p-7">
          <div className="flex flex-col gap-2">
            <h2 className="text-[19px] font-medium tracking-tight text-ink">
              {t("Connect your MyAnimeList account")}
            </h2>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {t("Sync your MyAnimeList watch progress and list as you finish episodes.")}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setModalOpen(true)}
              className="flex h-11 items-center gap-2.5 rounded-md bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
            >
              <Link2 size={16} strokeWidth={2.2} />
              {t("Connect MyAnimeList")}
            </button>
            <button
              onClick={() => openUrl("https://myanimelist.net")}
              className="flex h-11 items-center gap-2 rounded-md bg-raised px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {t("About MyAnimeList")}
              <ExternalLink size={14} strokeWidth={2.2} />
            </button>
          </div>
        </section>
      ) : (
        <Section
          title={t("Connected")}
          subtitle={t("Harbor keeps your MyAnimeList watch progress in sync.")}
        >
          <ToggleRow
            label={t("Sync watch progress")}
            sub={t("Finishing an anime episode updates your MyAnimeList progress. Forward only: it never lowers a count you already have.")}
            value={settings.malAutoSync}
            onChange={(v) => update({ malAutoSync: v })}
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
                  className="h-9 w-9 rounded-full object-cover"
                />
              }
            />
          )}
          <SettingRow
            icon={
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-success">
                <Check size={16} strokeWidth={2.4} />
              </span>
            }
            label={userName || t("Connected")}
            desc={t("Authorized {when}", { when: sessionAge(t, session?.createdAt) })}
          >
            {userName && (
              <button
                onClick={() =>
                  openUrl(`https://myanimelist.net/profile/${encodeURIComponent(userName)}`)
                }
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-raised px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
              >
                {t("Open profile")}
                <ExternalLink size={12} strokeWidth={2.2} />
              </button>
            )}
          </SettingRow>
          <SettingRow label={t("Disconnect from MyAnimeList")}>
            <button
              onClick={() => setConfirmDisconnect(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-raised px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-danger"
            >
              <Trash2 size={12} />
              {t("Disconnect")}
            </button>
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
                <button
                  type="button"
                  onClick={() => {
                    if (settings.useMalAvatar && settings.harborAvatar === malAvatar) {
                      pushAvatar(null);
                    }
                    update({ useMalAvatar: false });
                    disconnect();
                    setConfirmDisconnect(false);
                  }}
                  className="harbor-press-pop flex h-9 items-center gap-1.5 rounded-md bg-danger/15 px-4 text-[12.5px] font-semibold text-danger transition-colors hover:bg-danger/25"
                >
                  <LogOut size={12} strokeWidth={2.4} />
                  {t("Disconnect")}
                </button>
              </>
            }
          >
            <p className="rounded-md bg-elevated px-4 py-3.5 text-[13px] leading-relaxed text-ink-muted">
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
