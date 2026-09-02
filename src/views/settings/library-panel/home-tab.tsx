import { Nested, RowIcon, SliderRow } from "../theme-panel/display-section";
import { useEffect, useState } from "react";
import harborStyleImg from "@/assets/onboarding/harborstyle.webp";
import traditionalStyleImg from "@/assets/onboarding/traditional.webp";
import { Camera, Clock, Contrast, Image as ImageIcon, LayoutGrid, LayoutTemplate, Maximize, Trash2, Play, Volume2 } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { clearAllSnapshots, snapshotCount } from "@/lib/snapshots";
import { useT } from "@/lib/i18n";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { Section, Segmented, ToggleRow } from "../shared";
import { SettingGroup, SettingRow } from "../kit";
import { HomeRowPreview } from "../home-layout-previews";
import { CwSnapshotShowcase } from "../cw-snapshot-showcase";
import { PreviewImage } from "../preview-image";

export function HomeTab() {
  const { settings, update } = useSettings();
  const t = useT();
  return (
    <>
      <Section
        title={t("Home hero")}
        subtitle={t("Make the featured banner on Home bigger and sharper.")}
      >
        <SettingGroup>
          <SettingRow
            wide
            icon={<LayoutTemplate size={16} strokeWidth={1.9} />}
            label={t("Featured source")}
            desc={t("What fills the hero. Trending is a fresh top list from Harbor, refreshed through the day. Classic uses your own Home rows.")}
          >
            <Segmented
              value={settings.heroFeed}
              options={[
                { value: "trending", label: t("Trending") },
                { value: "trakt", label: t("Trakt") },
                { value: "simkl", label: t("Simkl") },
                { value: "classic", label: t("Classic") },
              ]}
              onChange={(v) => update({ heroFeed: v as "trending" | "trakt" | "simkl" | "classic" })}
            />
          </SettingRow>
          <ToggleRow
            label={t("Full hero banner")}
            sub={t("Stretch the featured hero edge to edge and taller, across every layout.")}
            value={settings.heroFull}
            onChange={(v) => update({ heroFull: v })}
            leading={<RowIcon on={settings.heroFull}><Maximize size={16} strokeWidth={2.2} /></RowIcon>}
          />
          <ToggleRow
            label={t("Full quality hero image")}
            sub={t("Load the highest-resolution artwork for the featured hero. Uses more bandwidth.")}
            value={settings.heroFullQuality}
            onChange={(v) => update({ heroFullQuality: v })}
            leading={<RowIcon on={settings.heroFullQuality}><ImageIcon size={16} strokeWidth={2.2} /></RowIcon>}
          />
        </SettingGroup>

        <SettingGroup label={t("Hero trailers")}>
          <ToggleRow
            label={t("Play trailers in the hero")}
            newId="theme:hero-video"
            sub={t("After a moment on a slide, the featured title's trailer plays muted in the background. Uses more bandwidth.")}
            value={settings.heroTrailers}
            onChange={(v) => update({ heroTrailers: v })}
            leading={<RowIcon on={settings.heroTrailers}><Play size={16} strokeWidth={2.2} /></RowIcon>}
          />
          {settings.heroTrailers && (
            <Nested>
              <ToggleRow
                label={t("Home hero audio")}
                sub={t("The home hero trailer plays with sound and a mute button in the corner, then shows a replay button when it ends. Auto-rotation pauses so it stays on the featured title.")}
                value={settings.heroTrailerAudio}
                onChange={(v) => update({ heroTrailerAudio: v })}
                leading={<RowIcon on={settings.heroTrailerAudio}><Volume2 size={16} strokeWidth={2.2} /></RowIcon>}
              />
            </Nested>
          )}
        </SettingGroup>
      </Section>

      <Section
        title={t("Home hero shadow")}
        subtitle={t("How dark the gradient behind the featured title on Home is. 100% is the classic look; lower it to let more of the artwork show through.")}
      >
        <SettingGroup>
          <SliderRow
            label={t("Shadow")}
            desc={t("Lower it to let more of the artwork show through.")}
            icon={<Contrast size={16} strokeWidth={1.9} />}
            value={settings.heroShadow}
            min={0}
            max={100}
            step={5}
            readout={`${settings.heroShadow}%`}
            resetTo={100}
            onChange={(heroShadow) => update({ heroShadow })}
          />
        </SettingGroup>
      </Section>

      <Section title={t("Home layout")} subtitle={t("How the Home page assembles its rails.")}>
        <SettingRow
          wide
          icon={<LayoutGrid size={16} />}
          label={t("Home style")}
          desc={t("The shape of the whole Home page. Everything below tunes the rows inside it.")}
        >
          <HomeModePicker value={settings.homeMode} onChange={(v) => update({ homeMode: v })} />
        </SettingRow>

        <SettingGroup label={t("Rows")}>
          <ToggleRow
            label={t("New Episodes row")}
            sub={t(
              "Adds a row under Continue Watching listing episodes that aired recently for shows you were already watching. Dismiss them one at a time or clear the whole row. Off by default.",
            )}
            value={settings.homeNewEpisodes}
            onChange={(v) => update({ homeNewEpisodes: v })}
          />
          <ToggleRow
            label={t("Show every addon row")}
            sub={t(
              "By default, addon rails that duplicate the built-in ones (Trending, Popular, Top Rated, etc.) are merged so you don't see the same row twice. Turn this on to show every one, duplicates and all.",
            )}
            value={settings.homeShowAllAddonRows}
            onChange={(v) => update({ homeShowAllAddonRows: v })}
            preview={<HomeRowPreview kind="all-addon-rows" />}
          />
          <ToggleRow
            label={t("Hide watched titles in catalogs")}
            sub={t(
              "Movies you've watched and shows you've made progress on stop appearing in the built-in catalog rows, using your local watch history (and Trakt if connected). Continue Watching is never touched.",
            )}
            value={settings.hideWatchedInCatalogs}
            onChange={(v) => update({ hideWatchedInCatalogs: v })}
            preview={<HomeRowPreview kind="hide-watched" />}
          />
          <ToggleRow
            label={t("Hide unreleased titles")}
            sub={t(
              "Movies and shows with a future release date stop appearing in the built-in home catalog rows, so Home only shows what you can watch right now.",
            )}
            value={settings.hideUnreleased}
            onChange={(v) => update({ hideUnreleased: v })}
          />
          <ToggleRow
            label={t("Watchlist shows only saved titles")}
            sub={t(
              "Keep the Library Watchlist tab limited to titles you added in Stremio. Turn this off to also include anything Stremio auto-added when you pressed play.",
            )}
            value={settings.libraryBookmarkedOnly}
            onChange={(v) => update({ libraryBookmarkedOnly: v })}
            preview={<HomeRowPreview kind="watchlist-saved" />}
          />
        </SettingGroup>

        <SettingGroup label={t("Continue Watching")}>
          <ToggleRow
            label={t("Advance Continue Watching to the next episode")}
            sub={t(
              "When you finish an episode, the Home Continue Watching card moves on to the next episode instead of sitting at 0 minutes left.",
            )}
            value={settings.cwAdvanceNext}
            onChange={(v) => update({ cwAdvanceNext: v })}
            preview={<HomeRowPreview kind="cw-advance" />}
          />
          <ToggleRow
            label={t("Remove shows once you're caught up")}
            sub={t(
              "On by default: once you've watched every episode that has aired, the show leaves Continue Watching and returns when a new episode drops. Turn it off to keep caught-up shows on the row.",
            )}
            value={settings.cwHideCaughtUp}
            onChange={(v) => update({ cwHideCaughtUp: v })}
          />
          <SettingRow
            icon={<Clock size={16} />}
            label={t("When the latest episode ends")}
            desc={t(
              "Hide until the next episode airs, or keep showing a countdown to when it drops.",
            )}
          >
            <Segmented
              value={settings.animeCwEnd}
              options={[
                { value: "hide", label: t("Hide") },
                { value: "timer", label: t("Timer") },
              ]}
              onChange={(v) => update({ animeCwEnd: v as "hide" | "timer" })}
            />
          </SettingRow>
          <ToggleRow
            label={t("Keep anime in the Anime room only")}
            sub={t(
              "Hides anime from the Home Continue Watching row. It still appears in the Anime tab's own Continue Watching.",
            )}
            value={settings.animeOnlyInAnimeRoom}
            onChange={(v) => update({ animeOnlyInAnimeRoom: v })}
            preview={<HomeRowPreview kind="anime-room" />}
          />
          <ToggleRow
            label={t("Keep Continue Watching private to each profile")}
            sub={t(
              "Only show Continue Watching for the profile that's active. Each profile sees just its own progress, so what you watch stays hidden from the other profiles that share this Stremio account.",
            )}
            value={settings.cwPerProfile}
            onChange={(v) => update({ cwPerProfile: v })}
          />
        </SettingGroup>

        <SettingGroup label={t("Navigation")}>
          <ToggleRow
            label={t("Show Playlists tab")}
            sub={t(
              "Adds a Playlists item to the navigation for browsing movies and shows from your M3U or Xtream playlists (the same ones you add for Live TV). Off by default to keep the nav tidy.",
            )}
            value={settings.showPlaylistsTab}
            onChange={(v) => update({ showPlaylistsTab: v })}
            preview={<HomeRowPreview kind="playlists-tab" />}
          />
          <ToggleRow
            label={t("Smooth scrolling")}
            sub={t(
              "Eases mouse-wheel scrolling instead of jumping line by line. Turn off if you prefer an instant response or notice any lag.",
            )}
            value={settings.smoothScroll}
            onChange={(v) => update({ smoothScroll: v })}
          />
        </SettingGroup>
      </Section>

      <Section
        title={t("Continue Watching screenshots")}
        subtitle={t(
          "When you back out of a title, Harbor saves a frame so the Continue Watching card looks like the spot you left. Tune how long they stick around, or wipe them all.",
        )}
      >
        <CwSnapshotShowcase />
        <RetentionPicker
          value={settings.cwSnapshotRetentionDays}
          onChange={(v) => update({ cwSnapshotRetentionDays: v })}
        />
        <ToggleRow
          label={t("Full quality frames")}
          sub={t(
            "Save sharper frames instead of light thumbnails. They look crisper on the card but take more space, so fewer are kept before the oldest roll off.",
          )}
          value={settings.cwSnapshotFullQuality}
          onChange={(v) => update({ cwSnapshotFullQuality: v })}
        />
        <ClearSnapshotsButton />
      </Section>
    </>
  );
}

function HomeModePicker({
  value,
  onChange,
}: {
  value: "harbor" | "classic";
  onChange: (v: "harbor" | "classic") => void;
}) {
  const t = useT();
  const options: Array<{ id: "harbor" | "classic"; label: string; sub: string; img: string }> = [
    {
      id: "harbor",
      label: t("Harbor curated"),
      sub: t(
        "Hero carousel, Top 10, Trending, In Theaters, per-service rails. Addon catalogs append underneath, deduped.",
      ),
      img: harborStyleImg,
    },
    {
      id: "classic",
      label: t("Classic Stremio"),
      sub: t(
        "Continue Watching, then your installed addons. Every catalog renders as its own row, install order, no dedup, no hero.",
      ),
      img: traditionalStyleImg,
    },
  ];
  return (
    <div
      role="radiogroup"
      aria-label={t("Home style")}
      className="grid w-full grid-cols-1 gap-3 md:grid-cols-2"
    >
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.id)}
            className="group flex flex-col gap-2.5 rounded-md text-start"
          >
            <span
              className={`block overflow-hidden rounded-md bg-canvas ring-2 transition-[box-shadow] duration-200 ease-out ${
                selected ? "ring-accent" : "ring-transparent group-hover:ring-edge"
              }`}
            >
              <PreviewImage
                src={opt.img}
                className="block aspect-[16/10] w-full select-none object-cover object-top"
              />
            </span>
            <span className="flex flex-col gap-1 px-0.5">
              <span
                className={`text-[14px] tracking-tight transition-colors duration-200 ${
                  selected ? "font-semibold text-ink" : "font-medium text-ink-muted group-hover:text-ink"
                }`}
              >
                {opt.label}
              </span>
              <span className="text-[12px] leading-relaxed text-ink-subtle">{opt.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RetentionPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const t = useT();
  const options: DropdownOption[] = [
    { value: "0", label: t("None") },
    { value: "7", label: t("1 week") },
    { value: "30", label: t("30 days") },
    { value: "90", label: t("3 months") },
    { value: "180", label: t("6 months") },
    { value: "365", label: t("1 year") },
  ];
  return (
    <SettingRow
      icon={<Camera size={16} />}
      label={t("Keep frames for")}
      desc={t("How long a saved frame sticks around before the oldest roll off.")}
    >
      <Dropdown
        className="w-44 shrink-0"
        value={String(value)}
        options={options}
        onChange={(v) => onChange(Number(v))}
      />
    </SettingRow>
  );
}

function ClearSnapshotsButton() {
  const t = useT();
  const [count, setCount] = useState<number>(() => snapshotCount());
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirming]);
  const onClick = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    const cleared = clearAllSnapshots();
    setCount(0);
    setConfirming(false);
    void cleared;
  };
  return (
    <SettingRow
      icon={<Trash2 size={16} />}
      label={t("Clear all saved frames")}
      desc={
        count > 0
          ? count === 1
            ? t("1 frame stored. Wiping rebuilds them next time you watch.")
            : t("{n} frames stored. Wiping rebuilds them next time you watch.", { n: count })
          : t("No frames stored yet. They'll appear here as you watch things.")
      }
    >
      <button
        type="button"
        onClick={onClick}
        disabled={count === 0 && !confirming}
        className={`harbor-press-pop h-9 shrink-0 rounded-md px-4 text-[12.5px] font-semibold transition-colors ${
          confirming
            ? "bg-danger text-canvas hover:opacity-90"
            : "bg-canvas text-ink-muted hover:text-ink disabled:opacity-40"
        }`}
      >
        {confirming ? t("Confirm clear") : t("Clear all")}
      </button>
    </SettingRow>
  );
}
