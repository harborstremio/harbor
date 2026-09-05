import { Dropdown } from "@/components/dropdown";
import {
  ExternalLink,
  Info,
  Languages,
  Link2,
  LogOut,
  PenLine,
  Radio,
  Star,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { SimklDeviceModal } from "@/components/simkl/simkl-device-modal";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { fetchSimklAvatar } from "@/lib/simkl/profile";
import { useSimkl } from "@/lib/simkl/provider";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { Section, ToggleRow } from "./shared";
import { ModalButton, ROW_DESC, SettingGroup, SettingRow, SettingsModal } from "./kit";
import { SButton } from "./ui";
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

  const filters = settings.simklGranularFilters;
  const railsOn = settings.simklHomeRailsEnabled;

  return (
    <>
      {!isConnected ? (
        <Section
          title={t("Not connected")}
          subtitle={t("Sync and track movies, shows, and anime across everything you use. Harbor marks what you finish as watched on Simkl and keeps your plan-to-watch list in step. Free at simkl.com.")}
        >
          <SettingRow
            icon={<Link2 size={20} strokeWidth={2.1} />}
            label={t("Connect your Simkl account")}
            desc={t("Sign in once with a short device code. Harbor then marks what you finish as watched and keeps your plan-to-watch list in step.")}
          >
            <SButton variant="primary" onClick={() => setModalOpen(true)}>
              <Link2 size={18} strokeWidth={2.2} />
              {t("Connect Simkl")}
            </SButton>
          </SettingRow>
          <SettingRow
            icon={<Info size={20} strokeWidth={2.1} />}
            label={t("About Simkl")}
            desc={t("Simkl is a free site for tracking the movies, shows, and anime you watch. Open it to read more or to make an account.")}
          >
            <SButton onClick={() => openUrl("https://simkl.com")}>
              {t("Open simkl.com")}
              <ExternalLink size={18} strokeWidth={2.2} />
            </SButton>
          </SettingRow>
        </Section>
      ) : (
        <>
          <Section
            title={t("Connected")}
            subtitle={t("Harbor will mark what you finish as watched on Simkl and sync your plan-to-watch list.")}
          >
            <SettingRow
              icon={<UserRound size={20} strokeWidth={2.1} />}
              label={username ? `@${username}` : t("Your Simkl account")}
              desc={t("Harbor is authorized on this device and syncing with Simkl.")}
            >
              {username && (
                <SButton
                  onClick={() => openUrl(`https://simkl.com/${encodeURIComponent(username)}`)}
                >
                  {t("Open profile")}
                  <ExternalLink size={18} strokeWidth={2.2} />
                </SButton>
              )}
            </SettingRow>

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
                    className="h-6 w-6 rounded-full object-cover"
                  />
                }
              />
            )}

            <ToggleRow
              label={t("Scrobble to Simkl")}
              sub={t("Automatically track what you are playing and save watch progress in real-time.")}
              value={settings.simklScrobbleEnabled}
              onChange={(val) => update({ simklScrobbleEnabled: val })}
              leading={<Radio size={20} strokeWidth={2.1} />}
            />

            <ToggleRow
              label={t("Display Simkl Community Ratings")}
              sub={t("Display SIMKL community score badge on details pages.")}
              value={settings.showSimklBadge}
              onChange={(val) => update({ showSimklBadge: val, simklShowCommunityRatings: val })}
              leading={<Star size={20} strokeWidth={2.1} />}
            />

            <ToggleRow
              label={t("Enable User Ratings")}
              sub={t("Allow rating movies, shows, and anime directly using the star picker.")}
              value={settings.simklEnableUserRatings}
              onChange={(val) => update({ simklEnableUserRatings: val })}
              leading={<PenLine size={20} strokeWidth={2.1} />}
            />

            <SettingRow
              icon={<Languages size={20} strokeWidth={2.1} />}
              label={t("Anime Title Language")}
              desc={t("Preferred language for anime titles displayed on poster cards.")}
            >
              <div className="w-[280px] max-w-full">
                <Dropdown
                  value={settings.simklAnimeTitleLanguage}
                  onChange={(v) =>
                    update({ simklAnimeTitleLanguage: v as "english" | "romaji" | "native" })
                  }
                  className="w-full"
                  options={[
                    { value: "english", label: t("English") },
                    { value: "romaji", label: t("Romaji") },
                    { value: "native", label: t("Native/Japanese") },
                  ]}
                />
              </div>
            </SettingRow>

            <SettingRow
              icon={<LogOut size={20} strokeWidth={2.1} />}
              label={t("Disconnect from Simkl")}
              desc={t("Harbor signs out and stops syncing. Your lists on Simkl are left exactly as they are.")}
            >
              <SButton variant="danger" onClick={() => setConfirmDisconnect(true)}>
                <Trash2 size={18} strokeWidth={2.2} />
                {t("Disconnect")}
              </SButton>
            </SettingRow>
          </Section>

          <Section
            title={t("Home Rail Settings")}
            subtitle={t("Choose which Simkl rails appear on your home screen.")}
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

            {!railsOn && (
              <div className="flex items-start gap-2.5 rounded-[10px] bg-elevated px-4 py-3">
                <Info size={18} className="mt-[2px] shrink-0 text-ink-subtle" />
                <p className={`max-w-[66ch] ${ROW_DESC}`}>
                  {t("Simkl rails are turned off, so none of the rows below appear on Home yet.")}
                </p>
              </div>
            )}

            <SettingGroup label={t("Movies")}>
              <ToggleRow
                label={t("Plan to Watch")}
                sub={t("Show a row of the movies on your Simkl plan-to-watch list.")}
                value={filters.movies.plantowatch}
                onChange={(val) =>
                  update({
                    simklGranularFilters: {
                      ...filters,
                      movies: { ...filters.movies, plantowatch: val },
                    },
                  })
                }
              />
            </SettingGroup>

            <SettingGroup label={t("TV Shows")}>
              <ToggleRow
                label={t("Watching")}
                sub={t("Show a row of the shows you are part way through.")}
                value={filters.shows.watching}
                onChange={(val) =>
                  update({
                    simklGranularFilters: {
                      ...filters,
                      shows: { ...filters.shows, watching: val },
                    },
                  })
                }
              />
              <ToggleRow
                label={t("Plan to Watch")}
                sub={t("Show a row of the shows on your Simkl plan-to-watch list.")}
                value={filters.shows.plantowatch}
                onChange={(val) =>
                  update({
                    simklGranularFilters: {
                      ...filters,
                      shows: { ...filters.shows, plantowatch: val },
                    },
                  })
                }
              />
            </SettingGroup>

            <SettingGroup label={t("Anime")}>
              <ToggleRow
                label={t("Watching")}
                sub={t("Show a row of the anime you are part way through.")}
                value={filters.anime.watching}
                onChange={(val) =>
                  update({
                    simklGranularFilters: {
                      ...filters,
                      anime: { ...filters.anime, watching: val },
                    },
                  })
                }
              />
              <ToggleRow
                label={t("Plan to Watch")}
                sub={t("Show a row of the anime on your Simkl plan-to-watch list.")}
                value={filters.anime.plantowatch}
                onChange={(val) =>
                  update({
                    simklGranularFilters: {
                      ...filters,
                      anime: { ...filters.anime, plantowatch: val },
                    },
                  })
                }
              />
            </SettingGroup>
          </Section>

          <SettingsModal
            open={confirmDisconnect}
            onClose={() => setConfirmDisconnect(false)}
            title={t("Disconnect from Simkl")}
            actions={
              <>
                <ModalButton ghost onClick={() => setConfirmDisconnect(false)}>
                  {t("Cancel")}
                </ModalButton>
                <SButton
                  variant="danger"
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
                >
                  <LogOut size={18} strokeWidth={2.2} />
                  {t("Disconnect")}
                </SButton>
              </>
            }
          >
            <p className={`max-w-[66ch] ${ROW_DESC}`}>
              {t("Disconnect Simkl? Syncing will stop until you reconnect.")}
            </p>
          </SettingsModal>
        </>
      )}

      {modalOpen && <SimklDeviceModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
