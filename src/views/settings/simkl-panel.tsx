import { Check, ExternalLink, Link2, LogOut, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SimklDeviceModal } from "@/components/simkl/simkl-device-modal";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { fetchSimklAvatar } from "@/lib/simkl/profile";
import { useSimkl } from "@/lib/simkl/provider";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";
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
    update({ harborAvatar: url });
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
        <section className="flex flex-col gap-5 rounded-2xl border border-edge-soft bg-elevated/40 p-7">
          <div className="flex flex-col gap-2">
            <h2 className="text-[19px] font-medium tracking-tight text-ink">
              {t("Connect your Simkl account")}
            </h2>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {t(
                "Sync and track movies, shows, and anime across everything you use. Harbor marks what you finish as watched on Simkl and keeps your plan-to-watch list in step. Free at simkl.com.",
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setModalOpen(true)}
              className="flex h-11 items-center gap-2.5 rounded-xl bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
            >
              <Link2 size={15} strokeWidth={2.2} />
              {t("Connect Simkl")}
            </button>
            <button
              onClick={() => openUrl("https://simkl.com")}
              className="flex h-11 items-center gap-2 rounded-xl border border-edge-soft px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
            >
              {t("About Simkl")}
              <ExternalLink size={13} strokeWidth={2.2} />
            </button>
          </div>
        </section>
      ) : (
        <>
          <Section
            title={t("Connected")}
            subtitle={t(
              "Harbor will mark what you finish as watched on Simkl and sync your plan-to-watch list.",
            )}
          >
            <div className="flex items-center justify-between gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3">
              <div className="flex items-center gap-3">
                {simklAvatar ? (
                  <img
                    src={simklAvatar}
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
                  <span className="text-[14px] font-medium text-ink">
                    {username || t("Connected")}
                  </span>
                  <span className="text-[12px] text-ink-subtle">
                    {t("Authorized on this device")}
                  </span>
                </div>
              </div>
              {username && (
                <button
                  onClick={() => openUrl(`https://simkl.com/${encodeURIComponent(username)}`)}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-edge-soft px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
                >
                  {t("Open profile")}
                  <ExternalLink size={11} strokeWidth={2.2} />
                </button>
              )}
            </div>
            {simklAvatar && (
              <ToggleRow
                label={t("Use my Simkl avatar as my Harbor avatar")}
                sub={t("Wear your Simkl profile picture across Harbor instead of the default.")}
                value={settings.useSimklAvatar}
                onChange={toggleSimklAvatar}
                leading={
                  <img
                    src={simklAvatar}
                    alt=""
                    draggable={false}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                }
              />
            )}
            <ToggleRow
              label={t("Show Simkl rails on Home")}
              sub={t(
                "Display your Watching, Plan to Watch, Up Next, and Trending rows on the home screen.",
              )}
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
            <ToggleRow
              label={t("Scrobble to SIMKL")}
              sub={t(
                "Automatically track what you are playing and save watch progress in real-time.",
              )}
              value={settings.simklScrobbleEnabled}
              onChange={(val) => update({ simklScrobbleEnabled: val })}
            />
            <ToggleRow
              label={t("Display SIMKL Community Ratings")}
              sub={t("Display SIMKL community score badge on details pages.")}
              value={settings.simklShowCommunityRatings}
              onChange={(val) => update({ simklShowCommunityRatings: val })}
            />
            <ToggleRow
              label={t("Enable User Ratings")}
              sub={t("Allow rating movies, shows, and anime directly using the star picker.")}
              value={settings.simklEnableUserRatings}
              onChange={(val) => update({ simklEnableUserRatings: val })}
            />
            <div className="flex flex-col gap-1.5 pt-1">
              <p className="text-[13px] font-medium text-ink">{t("Anime Title Language")}</p>
              <p className="text-[12px] leading-relaxed text-ink-subtle">
                {t("Preferred language for anime titles displayed on poster cards.")}
              </p>
              <select
                value={settings.simklAnimeTitleLanguage}
                onChange={(e) =>
                  update({
                    simklAnimeTitleLanguage: e.target.value as "english" | "romaji" | "native",
                  })
                }
                className="h-11 w-full max-w-[340px] rounded-xl border border-edge-soft bg-canvas/40 px-3.5 text-[13.5px] text-ink outline-none transition-colors hover:border-edge focus:border-accent cursor-pointer"
              >
                <option value="english" className="bg-elevated text-ink">
                  {t("English")}
                </option>
                <option value="romaji" className="bg-elevated text-ink">
                  {t("Romaji")}
                </option>
                <option value="native" className="bg-elevated text-ink">
                  {t("Native/Japanese")}
                </option>
              </select>
            </div>
            {!confirmDisconnect ? (
              <button
                onClick={() => setConfirmDisconnect(true)}
                className="flex items-center gap-2 self-start rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-red-300"
              >
                <Trash2 size={12} />
                {t("Disconnect from Simkl")}
              </button>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-red-400/30 bg-red-400/5 p-3">
                <span className="text-[12.5px] text-red-200">
                  {t("Disconnect Simkl? Syncing will stop until you reconnect.")}
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
                    className="flex items-center gap-1.5 rounded-md bg-red-400/20 px-3 py-1 text-[12px] font-semibold text-red-200 hover:bg-red-400/30"
                  >
                    <LogOut size={11} strokeWidth={2.4} />
                    {t("Disconnect")}
                  </button>
                </div>
              </div>
            )}
          </Section>

          <Section
            title={t("Home Rail Settings")}
            subtitle={t("Choose which Simkl rails appear on your home screen.")}
          >
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 rounded-xl border border-edge-soft/60 bg-canvas/30 p-4">
                <h3 className="text-[14px] font-bold text-ink">{t("Movies")}</h3>
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
              </div>

              <div className="flex flex-col gap-2 rounded-xl border border-edge-soft/60 bg-canvas/30 p-4">
                <h3 className="text-[14px] font-bold text-ink">{t("TV Shows")}</h3>
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
              </div>

              <div className="flex flex-col gap-2 rounded-xl border border-edge-soft/60 bg-canvas/30 p-4">
                <h3 className="text-[14px] font-bold text-ink">{t("Anime")}</h3>
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
              </div>
            </div>
          </Section>
        </>
      )}

      {modalOpen && <SimklDeviceModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
