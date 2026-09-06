import { useEffect, useRef, useState } from "react";
import { HarborMark } from "@/components/icons/harbor-mark";
import uploadGlyph from "@/assets/nav-icons/download.svg?raw";
import { resizeAvatar } from "./account/avatar-utils";
import { ProfileAvatar, SubtitleText } from "@/chrome/account-menu/account-menu-parts";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { TOP_GROUPS } from "./groups";
import { SECTION_ICONS } from "./section-icons";
import { SetIcon } from "./set-icon";
import type { TabEntry } from "./tab-registry";
import { useNavSearch } from "./nav";
import { settingsAnchor, type SectionId } from "./shared";

function Glyph({ name, size }: { name: string; size: number }) {
  return <SetIcon name={name} size={size} />;
}

type Band = { section: string; sections: SectionId[] };

const BAND_LABELS: Record<string, string> = {
  SETUP: "Account & setup",
  WATCHING: "Playback",
  LANGUAGE: "Languages",
  CONTENT: "Sources & library",
  "LOOK & FEEL": "Appearance",
  DEVICES: "Controls & devices",
  SYSTEM: "System",
  HELP: "Help & about",
};

const BAND_ICONS: Record<string, string> = {
  SETUP: "Users",
  WATCHING: "Play",
  LANGUAGE: "Languages",
  CONTENT: "Library",
  "LOOK & FEEL": "Palette",
  DEVICES: "Gamepad2",
  SYSTEM: "SlidersHorizontal",
  HELP: "Heart",
};

function bands(): Band[] {
  const out: Band[] = [];
  const bySection = new Map<string, Band>();
  for (const group of TOP_GROUPS) {
    const seen = bySection.get(group.section);
    if (seen) {
      seen.sections.push(...group.children);
      continue;
    }
    const band: Band = { section: group.section, sections: [...group.children] };
    bySection.set(group.section, band);
    out.push(band);
  }
  return out;
}

function RailAccount() {
  const t = useT();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();
  const { profiles, activeProfile, updateProfile } = useProfiles();
  const { settings, update } = useSettings();
  const harborAvatar = settings.harborAvatar?.startsWith("/kids/avatars/")
    ? null
    : settings.harborAvatar;
  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resizeAvatar(file, 320);
      update({ harborAvatar: dataUrl });
      if (activeProfile) updateProfile(activeProfile.id, { avatar: dataUrl });
    } catch (err) {
      console.warn("[avatar] resize failed", err);
    }
  };

  const name =
    activeProfile?.name ?? user?.fullname ?? user?.email?.split("@")[0] ?? t("profile.fallback");

  return (
    <div className="hset-rail-me">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        aria-label={t("Change your picture")}
        className="hset-rail-me-avatar"
      >
        <ProfileAvatar
          profile={activeProfile}
          user={user}
          fallbackAvatar={harborAvatar}
          size="lg"
        />
        <span
          aria-hidden
          className="hset-rail-me-swap"
          dangerouslySetInnerHTML={{ __html: uploadGlyph }}
        />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onPickAvatar}
        className="hidden"
      />
      <span className="hset-rail-me-text">
        <span className="hset-rail-me-name">{name}</span>
        <span className="hset-rail-me-sub">
          <SubtitleText active={activeProfile} profiles={profiles} user={user} />
        </span>
      </span>
    </div>
  );
}

function SectionRow({
  id,
  label,
  on,
  onPick,
}: {
  id: SectionId;
  label: string;
  on: boolean;
  onPick: (id: SectionId, tab?: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(id)}
      aria-current={on ? "page" : undefined}
      className={`hset-rail-row ${on ? "is-on" : ""}`}
    >
      <span className="hset-rail-chip">
        <Glyph name={SECTION_ICONS[id]} size={20} />
      </span>
      <span className="hset-rail-label">{label}</span>
    </button>
  );
}

export function SettingsSidebar({
  active,
  activeTab,
  activeTabs,
  meta,
  query = "",
  onSelect,
  onJump,
}: {
  active: SectionId;
  activeTab: string | null;
  activeTabs: TabEntry[];
  meta: Record<SectionId, { label: string; sub: string }>;
  query?: string;
  onSelect: (section: SectionId, tab?: string) => void;
  onJump?: (section: SectionId, anchor?: string) => void;
}) {
  const t = useT();
  const trimmed = query.trim().toLowerCase();
  const { matches, optionMatches } = useNavSearch(trimmed);
  const searching = trimmed.length > 0;
  const activeBand = bands().find((band) => band.sections.includes(active))?.section ?? "SETUP";
  const [openBand, setOpenBand] = useState<string | null>(activeBand);
  useEffect(() => setOpenBand(activeBand), [activeBand, active, searching]);

  if (searching) {
    const sections = matches ?? [];
    const options = optionMatches ?? [];
    const empty = sections.length === 0 && options.length === 0;
    return (
      <nav id="hset-page-navigation" className="hset-rail" aria-label={t("Settings")}>
        <RailAccount />
        <div className="hset-rail-nav" key="search">
          <div className="hset-rail-band hset-rail-results">
            {empty && <p className="hset-rail-empty">{t("No settings match that.")}</p>}
            {sections.length > 0 && (
              <>
                <h2 className="hset-rail-band-title">{t("Pages")}</h2>
                {sections.map((item) => (
                  <div key={item.id} className="hset-rail-item">
                    <SectionRow
                      id={item.id}
                      label={t(item.label)}
                      on={item.id === active}
                      onPick={onSelect}
                    />
                  </div>
                ))}
              </>
            )}
            {options.length > 0 && (
              <>
                <h2 className="hset-rail-band-title is-spaced">{t("Settings")}</h2>
                {options.slice(0, 24).map((o, i) => (
                  <button
                    key={`${o.section}-${o.label}-${i}`}
                    type="button"
                    onClick={() =>
                      (onJump ?? onSelect)(
                        o.section,
                        o.anchorTitle ? settingsAnchor(o.anchorTitle) : undefined,
                      )
                    }
                    className="hset-rail-kid"
                  >
                    <span className="hset-rail-kid-chip">
                      <Glyph name={SECTION_ICONS[o.section]} size={18} />
                    </span>
                    <span className="hset-rail-stack">
                      <span className="hset-rail-label">{t(o.label)}</span>
                      <span className="hset-rail-where">{t(meta[o.section].label)}</span>
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav id="hset-page-navigation" className="hset-rail" aria-label={t("Settings")}>
      <RailAccount />
      <div className="hset-rail-nav" key="browse">
        {bands().map((band) => (
          <div key={band.section} className="hset-rail-band">
            <button
              type="button"
              className={`hset-rail-category ${activeBand === band.section ? "is-current" : ""}`}
              aria-expanded={openBand === band.section}
              aria-controls={`hset-category-${band.section.replaceAll(" ", "-")}`}
              onClick={() => setOpenBand(openBand === band.section ? null : band.section)}
            >
              <span className="hset-category-icon" aria-hidden>
                <Glyph name={BAND_ICONS[band.section]} size={20} />
              </span>
              <span className="hset-category-name">{t(BAND_LABELS[band.section] ?? band.section)}</span>
              <span className="hset-category-caret" aria-hidden />
            </button>
            <div id={`hset-category-${band.section.replaceAll(" ", "-")}`} className="hset-category-pages" hidden={openBand !== band.section}>
            {band.sections.map((id) => {
              const on = id === active;
              const tabs = on ? activeTabs : [];
              return (
                <div key={id} className="hset-rail-item">
                  <SectionRow id={id} label={t(meta[id].label)} on={on} onPick={onSelect} />
                  {tabs.length > 0 && (
                    <div className="hset-rail-kids">
                      {tabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => onSelect(id, tab.id)}
                          aria-current={activeTab === tab.id ? "page" : undefined}
                          className={`hset-rail-kid ${activeTab === tab.id ? "is-on" : ""}`}
                        >
                          <span className="hset-rail-kid-chip">
                            {tab.icon === "Harbor" ? (
                              <HarborMark className="h-[18px] w-[18px]" />
                            ) : tab.img ? (
                              <img
                                src={tab.img}
                                alt=""
                                draggable={false}
                                className="h-[18px] w-[18px] rounded-[4px] object-contain"
                              />
                            ) : (
                              <Glyph name={tab.icon} size={18} />
                            )}
                          </span>
                          <span className="hset-rail-label">{t(tab.label)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
