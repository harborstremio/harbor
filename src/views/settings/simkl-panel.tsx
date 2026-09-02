import { Dropdown } from "@/components/dropdown";
import { ExternalLink, Link2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { SimklDeviceModal } from "@/components/simkl/simkl-device-modal";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { fetchSimklAvatar } from "@/lib/simkl/profile";
import { useSimkl } from "@/lib/simkl/provider";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";
import simklLogo from "@/assets/simkl.png";
import { ModalButton, SettingGroup, SettingRow, SettingsModal } from "./kit";
import { TrackerIdentity } from "./tracker-identity";
import { Disclosure } from "./disclosure";
import { CardsArt, RailsArt, RatingArt, ScrobbleArt } from "./group-art";
import { clearCalendarCache } from "@/lib/simkl/calendar";
import { clearHomeRailsCache } from "@/lib/simkl/home-rails";
import { clearCalendarSourceCache } from "@/lib/calendar-sources";
import { clearAnimeGroupingCache } from "@/lib/simkl/anime-grouping";

export function SimklPanel() {
  const t = useT();
  const { isConnected, username, disconnect } = useSimkl();
  const { settings, update } = useSettings();
  const { activeProfile, updateProfile } = useProfiles();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [simklAvatar, setSimklAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      setSimklAvatar(null);
      return;
    }
    let live = true;
    fetchSimklAvatar().then((url) => {
      if (live) setSimklAvatar(url);
    });
    return () => {
      live = false;
    };
  }, [isConnected]);

  const pushAvatar = (url: string | null) => {
    if (activeProfile) updateProfile(activeProfile.id, { avatar: url });
  };

  useEffect(() => {
    if (settings.useSimklAvatar && simklAvatar && settings.harborAvatar !== simklAvatar) {
      pushAvatar(simklAvatar);
    }
  }, [settings.useSimklAvatar, simklAvatar]);

  const toggleSimklAvatar = (on: boolean) => {
    if (on) {
      if (simklAvatar) pushAvatar(simklAvatar);
      update({ useSimklAvatar: true });
    } else {
      update({ useSimklAvatar: false });
      if (settings.harborAvatar === simklAvatar) pushAvatar(null);
    }
  };

  return (
    <>
      {!isConnected ? (
        <section className="flex flex-col gap-5 rounded-md bg-elevated p-7">
          <div className="flex flex-col gap-2">
            <h2 className="text-[19px] font-medium tracking-tight text-ink">
              {t("Connect your Simkl account")}
            </h2>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {t("Sync and track movies, shows, and anime across everything you use. Harbor marks what you finish as watched on Simkl and keeps your plan-to-watch list in step. Free at simkl.com.")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setModalOpen(true)}
              className="flex h-11 items-center gap-2.5 rounded-md bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
            >
              <Link2 size={16} strokeWidth={2.2} />
              {t("Connect Simkl")}
            </button>
            <button
              onClick={() => openUrl("https://simkl.com")}
              className="flex h-11 items-center gap-2 rounded-md bg-raised px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {t("About Simkl")}
              <ExternalLink size={14} strokeWidth={2.2} />
            </button>
          </div>
        </section>
      ) : (
        <>
          <Section
            title={t("Connected")}
            subtitle={t("Harbor will mark what you finish as watched on Simkl and sync your plan-to-watch list.")}
          >
            <TrackerIdentity
              logo={simklLogo}
              service="Simkl"
              handle={username || undefined}
              avatar={simklAvatar}
              meta={t("Authorized on this device")}
              profileUrl={
                username ? `https://simkl.com/${encodeURIComponent(username)}` : undefined
              }
              onDisconnect={() => setConfirmDisconnect(true)}
            />
            {simklAvatar && (
              <ToggleRow
                label={t("Use my Simkl avatar as my Harbor avatar")}
                sub={t("Wear your Simkl profile picture across Harbor instead of the default.")}
                value={settings.useSimklAvatar}
                onChange={toggleSimklAvatar}
              />
            )}

            <Disclosure
              art={<RailsArt />}
              title={t("Rows on Home")}
              summary={t("Which Simkl lists show up as rows on your home screen.")}
              defaultOpen
            >
              <ToggleRow
                label={t("Show Simkl rails on Home")}
                sub={t("Display your Watching, Plan to Watch, Up Next, and Trending rows on the home screen.")}
                value={settings.simklHomeRailsEnabled}
                onChange={(val) => update({ simklHomeRailsEnabled: val })}
              />
              <ToggleRow
                label={t("Show Up Next on Simkl rail")}
                sub={t("Display upcoming episodes from your watching and plan-to-watch lists.")}
                value={settings.simklUpNextRailEnabled}
                onChange={(val) => update({ simklUpNextRailEnabled: val })}
              />
              <ToggleRow
                label={t("Show Simkl Trending Today rail")}
                sub={t("Display today's trending movies, TV shows, and anime from Simkl.")}
                value={settings.simklTrendingRailEnabled}
                onChange={(val) => update({ simklTrendingRailEnabled: val })}
              />
            </Disclosure>

            <Disclosure
              art={<ScrobbleArt />}
              title={t("Tracking what you watch")}
              summary={t("Whether Harbor reports playback to Simkl while you watch.")}
            >
              <ToggleRow
                label={t("Scrobble to SIMKL")}
                sub={t("Automatically track what you are playing and save watch progress in real-time.")}
                value={settings.simklScrobbleEnabled}
                onChange={(val) => update({ simklScrobbleEnabled: val })}
              />
            </Disclosure>

            <Disclosure
              art={<RatingArt />}
              title={t("Ratings")}
              summary={t("Simkl community scores on detail pages, and your own star ratings.")}
            >
              <ToggleRow
                label={t("Display SIMKL Community Ratings")}
                sub={t("Display SIMKL community score badge on details pages.")}
                value={settings.showSimklBadge}
                onChange={(val) => update({ showSimklBadge: val, simklShowCommunityRatings: val })}
              />
              <ToggleRow
                label={t("Enable User Ratings")}
                sub={t("Allow rating movies, shows, and anime directly using the star picker.")}
                value={settings.simklEnableUserRatings}
                onChange={(val) => update({ simklEnableUserRatings: val })}
              />
            </Disclosure>

            <Disclosure
              art={<CardsArt />}
              title={t("Anime titles")}
              summary={t("Which language anime titles appear in on poster cards.")}
            >
              <SettingRow
                label={t("Anime Title Language")}
                desc={t("Preferred language for anime titles displayed on poster cards.")}
              >
                <Dropdown
                  size="sm"
                  value={settings.simklAnimeTitleLanguage}
                  onChange={(v) => update({ simklAnimeTitleLanguage: v as "english" | "romaji" | "native" })}
                  className="w-[200px] shrink-0"
                  options={[
                    { value: "english", label: t("English") },
                    { value: "romaji", label: t("Romaji") },
                    { value: "native", label: t("Native/Japanese") },
                  ]}
                />
              </SettingRow>
            </Disclosure>

            <SettingsModal
              open={confirmDisconnect}
              onClose={() => setConfirmDisconnect(false)}
              title={t("Disconnect from Simkl")}
              actions={
                <>
                  <ModalButton ghost onClick={() => setConfirmDisconnect(false)}>
                    {t("Cancel")}
                  </ModalButton>
                  <button
                    type="button"
                    onClick={() => {
                      if (settings.useSimklAvatar && settings.harborAvatar === simklAvatar) {
                        pushAvatar(null);
                      }
                      update({
                        useSimklAvatar: false,
                        simklScrobbleEnabled: true,
                        simklShowCommunityRatings: true,
                        simklEnableUserRatings: true,
                        simklHomeRailsEnabled: false,
                        simklUpNextRailEnabled: false,
                        simklTrendingRailEnabled: false,
                        showSimklBadge: true,
                        simklAnimeTitleLanguage: "english",
                        simklGranularFilters: {
                          movies: { plantowatch: true },
                          shows: { watching: true, plantowatch: true },
                          anime: { watching: true, plantowatch: true },
                        },
                      });
                      clearCalendarCache();
                      clearHomeRailsCache();
                      clearCalendarSourceCache();
                      clearAnimeGroupingCache();
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
                {t("Disconnect Simkl? Syncing will stop until you reconnect.")}
              </p>
            </SettingsModal>
          </Section>

          <Section
            title={t("Home Rail Settings")}
            subtitle={t("Choose which Simkl rails appear on your home screen.")}
          >
            <div className="flex flex-col gap-4">
              <SettingGroup label={t("Movies")}>
                <ToggleRow
                  label={t("Plan to Watch")}
                  value={settings.simklGranularFilters.movies.plantowatch}
                  onChange={(val) =>
                    update({
                      simklGranularFilters: {
                        ...settings.simklGranularFilters,
                        movies: { ...settings.simklGranularFilters.movies, plantowatch: val },
                      },
                    })
                  }
                />
              </SettingGroup>

              <SettingGroup label={t("TV Shows")}>
                <ToggleRow
                  label={t("Watching")}
                  value={settings.simklGranularFilters.shows.watching}
                  onChange={(val) =>
                    update({
                      simklGranularFilters: {
                        ...settings.simklGranularFilters,
                        shows: { ...settings.simklGranularFilters.shows, watching: val },
                      },
                    })
                  }
                />
                <ToggleRow
                  label={t("Plan to Watch")}
                  value={settings.simklGranularFilters.shows.plantowatch}
                  onChange={(val) =>
                    update({
                      simklGranularFilters: {
                        ...settings.simklGranularFilters,
                        shows: { ...settings.simklGranularFilters.shows, plantowatch: val },
                      },
                    })
                  }
                />
              </SettingGroup>

              <SettingGroup label={t("Anime")}>
                <ToggleRow
                  label={t("Watching")}
                  value={settings.simklGranularFilters.anime.watching}
                  onChange={(val) =>
                    update({
                      simklGranularFilters: {
                        ...settings.simklGranularFilters,
                        anime: { ...settings.simklGranularFilters.anime, watching: val },
                      },
                    })
                  }
                />
                <ToggleRow
                  label={t("Plan to Watch")}
                  value={settings.simklGranularFilters.anime.plantowatch}
                  onChange={(val) =>
                    update({
                      simklGranularFilters: {
                        ...settings.simklGranularFilters,
                        anime: { ...settings.simklGranularFilters.anime, plantowatch: val },
                      },
                    })
                  }
                />
              </SettingGroup>
            </div>
          </Section>
        </>
      )}

      {modalOpen && <SimklDeviceModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
