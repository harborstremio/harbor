import { TraktDeviceModal } from "@/components/trakt/trakt-device-modal";
import { useT } from "@/lib/i18n";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { fetchTraktAvatar } from "@/lib/trakt/profile";
import { useTrakt } from "@/lib/trakt/provider";
import { openUrl } from "@/lib/window";
import { Check, ExternalLink, Link2, LogOut, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Section, ToggleRow } from "./shared";
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
    update({ harborAvatar: url });
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
        <section className="flex flex-col gap-5 rounded-2xl border border-edge-soft bg-elevated/40 p-7">
          <div className="flex flex-col gap-2">
            <h2 className="text-[19px] font-medium tracking-tight text-ink">{t("Connect your Trakt account")}</h2>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {t(
                "Track everything you watch, see your watchlist, and get personalized recommendations on Harbor's home page. Free at trakt.tv.",
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setModalOpen(true)}
              className="flex h-11 items-center gap-2.5 rounded-xl bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
            >
              <Link2 size={15} strokeWidth={2.2} />
              {t("Connect Trakt")}
            </button>
            <button
              onClick={() => openUrl("https://trakt.tv")}
              className="flex h-11 items-center gap-2 rounded-xl border border-edge-soft px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
            >
              {t("About Trakt")}
              <ExternalLink size={13} strokeWidth={2.2} />
            </button>
          </div>
        </section>
      ) : (
        <Section
          title={t("Connected")}
          subtitle={t("Harbor will scrobble your playback to Trakt and sync your watchlist.")}
        >
          <div className="flex items-center justify-between gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3">
            <div className="flex items-center gap-3">
              {traktAvatar ? (
                <img
                  src={traktAvatar}
                  alt=""
                  draggable={false}
                  className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-edge"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400/12 ring-1 ring-emerald-400/30 text-emerald-300">
                  <Check size={16} strokeWidth={2.4} />
                </span>
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-[14px] font-medium text-ink">{username ? `@${username}` : t("Connected")}</span>
                <span className="text-[12px] text-ink-subtle">
                  {t("Authorized {when}", { when: sessionAge(t, session?.createdAt) })}
                </span>
              </div>
            </div>
            {username && (
              <button
                onClick={() => openUrl(`https://trakt.tv/users/${encodeURIComponent(username)}`)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-edge-soft px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                {t("Open profile")}
                <ExternalLink size={11} strokeWidth={2.2} />
              </button>
            )}
          </div>
          {traktAvatar && (
            <ToggleRow
              label={t("Use my Trakt avatar as my Harbor avatar")}
              sub={t("Wear your Trakt profile picture across Harbor instead of the default.")}
              value={settings.useTraktAvatar}
              onChange={toggleTraktAvatar}
              leading={<img src={traktAvatar} alt="" draggable={false} className="h-9 w-9 rounded-full object-cover" />}
            />
          )}
          {!confirmDisconnect ? (
            <button
              onClick={() => setConfirmDisconnect(true)}
              className="flex items-center gap-2 self-start rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-red-300"
            >
              <Trash2 size={12} />
              {t("Disconnect from Trakt")}
            </button>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-red-400/30 bg-red-400/5 p-3">
              <span className="text-[12.5px] text-red-200">
                {t("Disconnect Trakt? Scrobbles and syncs will stop until you reconnect.")}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmDisconnect(false)}
                  className="rounded-md px-2.5 py-1 text-[12px] text-ink-muted hover:text-ink"
                >
                  {t("Cancel")}
                </button>
                <button
                  onClick={() => {
                    if (settings.useTraktAvatar && settings.harborAvatar === traktAvatar) {
                      pushAvatar(null);
                    }
                    update({ useTraktAvatar: false });
                    disconnect();
                    setConfirmDisconnect(false);
                  }}
                  className="flex items-center gap-1.5 rounded-md bg-red-400/20 px-3 py-1 text-[12px] font-semibold text-red-200 hover:bg-red-400/30"
                >
                  <LogOut size={11} strokeWidth={2.4} />
                  {t("Disconnect")}
                </button>
              </div>
            </div>
          )}
        </Section>
      )}

      {isConnected && (
        <Section
          title={t("Move your watchlist")}
          subtitle={t(
            "Copy your Harbor watchlist over to Trakt, or pull your Trakt watchlist into Harbor. Safe to run again, Trakt skips anything it already has.",
          )}
        >
          <WatchlistSync />
        </Section>
      )}

      <Section title={t("Comments")} subtitle={t("Community comments from Trakt that appear on movie and show pages.")}>
        <ToggleRow
          label={t("Show comments on detail pages")}
          sub={t("Turn on to show the Trakt comments section on movies, shows, and episodes.")}
          value={settings.showTraktComments === true}
          onChange={(on) => update({ showTraktComments: on })}
        />
        {settings.showTraktComments === true && (
          <ToggleRow
            label={t("Blur comments by default")}
            sub={t("Comments are blurred until you reveal them, even if they are not tagged as spoilers.")}
            value={!!settings.blurComments}
            onChange={(on) => update({ blurComments: on })}
          />
        )}
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
