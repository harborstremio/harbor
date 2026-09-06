import { ExternalLink, Link2, LogOut } from "./icons";
import { useEffect, useState } from "react";
import { TraktDeviceModal } from "@/components/trakt/trakt-device-modal";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { fetchTraktAvatar } from "@/lib/trakt/profile";
import { useTrakt } from "@/lib/trakt/provider";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { ROW_DESC, Section, ToggleRow } from "./shared";
import traktLogo from "@/assets/trakt.svg";
import {
  ModalButton,
  ROW_ACTION,
  ROW_ACTION_DANGER,
  ROW_ACTION_PRIMARY,
  SettingRow,
  SettingsModal,
} from "./kit";
import { TrackerIdentity } from "./tracker-identity";
import { WatchlistSync } from "./trakt-panel/watchlist-sync";

export function TraktPanel() {
  const t = useT();
  const { isConnected, username, disconnect, session } = useTrakt();
  const { settings, update } = useSettings();
  const { activeProfile, updateProfile } = useProfiles();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [traktAvatar, setTraktAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      setTraktAvatar(null);
      return;
    }
    let live = true;
    fetchTraktAvatar().then((url) => {
      if (live) setTraktAvatar(url);
    });
    return () => {
      live = false;
    };
  }, [isConnected]);

  const pushAvatar = (url: string | null) => {
    if (activeProfile) updateProfile(activeProfile.id, { avatar: url });
  };

  useEffect(() => {
    if (settings.useTraktAvatar && traktAvatar && settings.harborAvatar !== traktAvatar) {
      pushAvatar(traktAvatar);
    }
  }, [settings.useTraktAvatar, traktAvatar]);

  const toggleTraktAvatar = (on: boolean) => {
    if (on) {
      if (traktAvatar) pushAvatar(traktAvatar);
      update({ useTraktAvatar: true });
    } else {
      update({ useTraktAvatar: false });
      if (settings.harborAvatar === traktAvatar) pushAvatar(null);
    }
  };

  return (
    <>
      {!isConnected ? (
        <Section
          title={t("Connect your Trakt account")}
          subtitle={t("Track everything you watch, see your watchlist, and get personalized recommendations on Harbor's home page. Free at trakt.tv.")}
        >
          <SettingRow
            label={t("Connect Trakt")}
            desc={t("Harbor shows you a short code to type in at trakt.tv. Scrobbling and watchlist sync begin the moment you approve it.")}
          >
            <button type="button" onClick={() => setModalOpen(true)} className={ROW_ACTION_PRIMARY}>
              <Link2 size={18} strokeWidth={2.2} />
              {t("Connect")}
            </button>
          </SettingRow>

          <SettingRow
            label={t("About Trakt")}
            desc={t("Opens trakt.tv in your browser, where you can read what Trakt does and make a free account.")}
          >
            <button
              type="button"
              onClick={() => openUrl("https://trakt.tv")}
              className={ROW_ACTION}
            >
              {t("Open trakt.tv")}
              <ExternalLink size={18} strokeWidth={2.2} />
            </button>
          </SettingRow>
        </Section>
      ) : (
        <Section
          title={t("Your Trakt account")}
          subtitle={t("Harbor scrobbles your playback to Trakt and keeps your watchlist in sync.")}
        >
          <TrackerIdentity
            logo={traktLogo}
            service="Trakt"
            handle={username ?? undefined}
            avatar={traktAvatar}
            meta={t("Authorized {when}", { when: sessionAge(t, session?.createdAt) })}
            profileUrl={
              username ? `https://trakt.tv/users/${encodeURIComponent(username)}` : undefined
            }
            onDisconnect={() => setConfirmDisconnect(true)}
          />
          {traktAvatar && (
            <ToggleRow
              label={t("Use my Trakt avatar as my Harbor avatar")}
              sub={t("Wear your Trakt profile picture across Harbor instead of the default.")}
              value={settings.useTraktAvatar}
              onChange={toggleTraktAvatar}
            />
          )}
          <SettingsModal
            open={confirmDisconnect}
            onClose={() => setConfirmDisconnect(false)}
            title={t("Disconnect from Trakt")}
            actions={
              <>
                <ModalButton ghost onClick={() => setConfirmDisconnect(false)}>
                  {t("Cancel")}
                </ModalButton>
                <button
                  type="button"
                  onClick={() => {
                    if (settings.useTraktAvatar && settings.harborAvatar === traktAvatar) {
                      pushAvatar(null);
                    }
                    update({ useTraktAvatar: false });
                    disconnect();
                    setConfirmDisconnect(false);
                  }}
                  className={ROW_ACTION_DANGER}
                >
                  <LogOut size={18} strokeWidth={2.2} />
                  {t("Disconnect")}
                </button>
              </>
            }
          >
            <p className={`max-w-[66ch] ${ROW_DESC}`}>
              {t("Disconnect Trakt? Scrobbles and syncs will stop until you reconnect.")}
            </p>
          </SettingsModal>
        </Section>
      )}

      {isConnected && (
        <Section
          title={t("Move your watchlist")}
          subtitle={t("Copy your Harbor watchlist over to Trakt, or pull your Trakt watchlist into Harbor.")}
        >
          <WatchlistSync />
        </Section>
      )}

      <Section
        title={t("Comments")}
        subtitle={t("Comments and reviews posted by other Trakt members.")}
      >
        <ToggleRow
          label={t("Show comments on detail pages")}
          sub={t("Adds a comments section to movie, show, and episode pages. No Trakt account needed to read them.")}
          value={settings.showTraktComments === true}
          onChange={(on) => update({ showTraktComments: on })}
        />
        <ToggleRow
          label={t("Blur comments and reviews by default")}
          sub={t(
            "Comments and reviews on detail pages stay blurred until you reveal them, even when they are not tagged as spoilers. This one switch covers Trakt and Letterboxd.",
          )}
          value={!!settings.blurComments}
          onChange={(on) => update({ blurComments: on })}
        />
      </Section>

      {modalOpen && <TraktDeviceModal onClose={() => setModalOpen(false)} />}
    </>
  );
}

function sessionAge(t: (key: string, vars?: Record<string, string | number>) => string, createdAt?: number): string {
  if (!createdAt) return "";
  const days = Math.floor((Date.now() / 1000 - createdAt) / 86400);
  if (days < 1) return t("today");
  if (days < 30) return days === 1 ? t("{n} day ago", { n: days }) : t("{n} days ago", { n: days });
  const months = Math.floor(days / 30);
  return months === 1 ? t("{n} month ago", { n: months }) : t("{n} months ago", { n: months });
}
