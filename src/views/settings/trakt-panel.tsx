import { ExternalLink, Link2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { TraktDeviceModal } from "@/components/trakt/trakt-device-modal";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { fetchTraktAvatar } from "@/lib/trakt/profile";
import { useTrakt } from "@/lib/trakt/provider";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";
import traktLogo from "@/assets/trakt.svg";
import { ModalButton, SettingsModal } from "./kit";
import { TrackerIdentity } from "./tracker-identity";
import { Disclosure } from "./disclosure";
import { CommentArt } from "./group-art";
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
        <section className="flex flex-col gap-5 rounded-md bg-elevated p-7">
          <div className="flex flex-col gap-2">
            <h2 className="text-[19px] font-medium tracking-tight text-ink">
              {t("Connect your Trakt account")}
            </h2>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {t("Track everything you watch, see your watchlist, and get personalized recommendations on Harbor's home page. Free at trakt.tv.")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setModalOpen(true)}
              className="flex h-11 items-center gap-2.5 rounded-md bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
            >
              <Link2 size={16} strokeWidth={2.2} />
              {t("Connect Trakt")}
            </button>
            <button
              onClick={() => openUrl("https://trakt.tv")}
              className="flex h-11 items-center gap-2 rounded-md bg-raised px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {t("About Trakt")}
              <ExternalLink size={14} strokeWidth={2.2} />
            </button>
          </div>
        </section>
      ) : (
        <Section
          title={t("Connected")}
          subtitle={t("Harbor will scrobble your playback to Trakt and sync your watchlist.")}
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
                  className="harbor-press-pop flex h-9 items-center gap-1.5 rounded-md bg-danger/15 px-4 text-[12.5px] font-semibold text-danger transition-colors hover:bg-danger/25"
                >
                  <LogOut size={12} strokeWidth={2.4} />
                  {t("Disconnect")}
                </button>
              </>
            }
          >
            <p className="rounded-md bg-elevated px-4 py-3.5 text-[13px] leading-relaxed text-ink-muted">
              {t("Disconnect Trakt? Scrobbles and syncs will stop until you reconnect.")}
            </p>
          </SettingsModal>
        </Section>
      )}

      {isConnected && (
        <Section
          title={t("Move your watchlist")}
          subtitle={t("Copy your Harbor watchlist over to Trakt, or pull your Trakt watchlist into Harbor. Safe to run again, Trakt skips anything it already has.")}
        >
          <WatchlistSync />
        </Section>
      )}

      <Disclosure
        art={<CommentArt />}
        title={t("Comments")}
        summary={t("Community comments from Trakt that appear on movie and show pages.")}
      >
        <ToggleRow
          label={t("Show comments on detail pages")}
          sub={t("Turn on to show the Trakt comments section on movies, shows, and episodes.")}
          value={settings.showTraktComments === true}
          onChange={(on) => update({ showTraktComments: on })}
        />
        {settings.showTraktComments === true && (
          <ToggleRow
            label={t("Blur comments and reviews by default")}
            sub={t(
              "Comments and reviews on detail pages stay blurred until you reveal them, even when they are not tagged as spoilers. This one switch covers Trakt and Letterboxd.",
            )}
            value={!!settings.blurComments}
            onChange={(on) => update({ blurComments: on })}
          />
        )}
      </Disclosure>

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
