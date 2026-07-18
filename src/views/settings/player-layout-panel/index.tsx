import { useCallback, useEffect, useMemo, useState } from "react";
import { alertDialog, confirmDialog } from "@/lib/dialog";
import {
  DEFAULT_DEFAULT_CONFIG,
  DEFAULT_STREMIO_CONFIG,
  notifyPlayerChromeChanged,
  PANEL_META,
  readPlayerChromeConfig,
  resetPlayerChromeConfig,
  writePlayerChromeConfig,
  type ControlVariant,
  type PanelCorner,
  type PanelId,
  type PlayerChromeConfig,
  type PlayerControlConfig,
  type PlayerControlId,
  type ThemeId,
  type TimeFormat,
  type VolumeStyle,
} from "@/lib/player-chrome";
import {
  createProfile,
  deleteProfile as deleteProfileApi,
  exportProfileJson,
  getActiveProfile,
  importProfileJson,
  listProfiles,
  PROFILE_DB_KEY,
  renameProfile as renameProfileApi,
  setActiveProfile,
} from "@/lib/player-chrome-profiles";
import { useSettings } from "@/lib/settings";
import { resolveChromeTheme } from "@/lib/theme";
import { moveControlOrder, moveControlSlot, sameConfig } from "./config-helpers";
import { EditorOverlay } from "./editor-overlay";
import { OptionsSection } from "./options-section";
import { EditLayoutCard, FooterBar, ThemeTabs } from "./panel-bars";
import { ToggleRow } from "../shared";
import { pushActivityHint } from "@/lib/discord/activity-hint";
import { useT } from "@/lib/i18n";

const THEME_BASELINES: Record<ThemeId, PlayerChromeConfig> = {
  default: DEFAULT_DEFAULT_CONFIG,
  stremio: DEFAULT_STREMIO_CONFIG,
};

function themeIdFromSettings(settings: ReturnType<typeof useSettings>["settings"]): ThemeId {
  return resolveChromeTheme(settings.theme, settings.playerChromeTheme);
}

export function PlayerLayoutPanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const appTheme = themeIdFromSettings(settings);
  const [theme, setTheme] = useState<ThemeId>(appTheme);
  const [saved, setSaved] = useState<PlayerChromeConfig>(() => readPlayerChromeConfig(appTheme));
  const [draft, setDraft] = useState<PlayerChromeConfig>(saved);
  const [selectedId, setSelectedId] = useState<PlayerControlId | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<PanelId | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [profileVersion, setProfileVersion] = useState(0);
  const bumpProfiles = useCallback(() => setProfileVersion((v) => v + 1), []);

  const profiles = useMemo(() => listProfiles(theme), [theme, profileVersion]);
  const activeProfileId = useMemo(
    () => getActiveProfile(theme)?.id ?? null,
    [theme, profileVersion],
  );

  useEffect(() => {
    const next = readPlayerChromeConfig(theme);
    setSaved(next);
    setDraft(next);
    setSelectedId(null);
    setSelectedPanelId(null);
    setConfirmingReset(false);
  }, [theme, profileVersion]);

  useEffect(() => {
    setTheme(appTheme);
  }, [appTheme]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PROFILE_DB_KEY) bumpProfiles();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [bumpProfiles]);

  useEffect(() => {
    return pushActivityHint({
      details: editorOpen ? t("Designing the player layout") : t("Customizing the player"),
      state: t("Player layout"),
    });
  }, [editorOpen]);

  useEffect(() => {
    if (!confirmingReset) return;
    const id = window.setTimeout(() => setConfirmingReset(false), 4000);
    return () => window.clearTimeout(id);
  }, [confirmingReset]);

  const dirty = useMemo(() => !sameConfig(draft, saved), [draft, saved]);

  const moveSlot = useCallback(
    (dir: -1 | 1) => {
      if (!selectedId) return;
      setDraft((cur) => moveControlSlot(cur, selectedId, dir));
    },
    [selectedId],
  );

  const moveOrder = useCallback(
    (dir: -1 | 1) => {
      if (!selectedId) return;
      setDraft((cur) => moveControlOrder(cur, selectedId, dir));
    },
    [selectedId],
  );

  const toggleHidden = useCallback(() => {
    if (!selectedId) return;
    setDraft((cur) => ({
      ...cur,
      controls: cur.controls.map((c) => (c.id === selectedId ? { ...c, hidden: !c.hidden } : c)),
    }));
  }, [selectedId]);

  const unhideControl = useCallback((id: PlayerControlId) => {
    setDraft((cur) => ({
      ...cur,
      controls: cur.controls.map((c) => (c.id === id ? { ...c, hidden: false } : c)),
    }));
  }, []);

  const resetControl = useCallback(() => {
    if (!selectedId) return;
    const baseline = THEME_BASELINES[theme].controls.find((c) => c.id === selectedId);
    if (!baseline) return;
    setDraft((cur) => {
      const nextIcons = { ...(cur.customIcons ?? {}) };
      for (const k of Object.keys(nextIcons)) {
        if (k === selectedId || k.startsWith(`${selectedId}:`)) delete nextIcons[k];
      }
      return {
        ...cur,
        controls: cur.controls.map((c) => (c.id === selectedId ? { ...baseline } : c)),
        customIcons: nextIcons,
      };
    });
  }, [selectedId, theme]);

  const setCustomIcon = useCallback(
    (id: PlayerControlId, dataUrl: string | null, state?: string) => {
      setDraft((cur) => {
        const nextIcons = { ...(cur.customIcons ?? {}) };
        const k = state ? `${id}:${state}` : id;
        if (dataUrl == null) {
          delete nextIcons[k];
        } else {
          nextIcons[k] = dataUrl;
        }
        return { ...cur, customIcons: nextIcons };
      });
    },
    [],
  );

  const setVariant = useCallback((id: PlayerControlId, variant: ControlVariant | null) => {
    setDraft((cur) => ({
      ...cur,
      controls: cur.controls.map((c) => {
        if (c.id !== id) return c;
        const next: PlayerControlConfig = { ...c };
        if (variant == null) delete next.variant;
        else next.variant = variant;
        return next;
      }),
    }));
  }, []);

  const setPanelCorner = useCallback((id: PanelId, corner: PanelCorner) => {
    setDraft((cur) => {
      const panels = { ...(cur.panels ?? {}) };
      const prev = panels[id];
      panels[id] = { corner, hidden: prev?.hidden ?? false };
      return { ...cur, panels };
    });
  }, []);

  const togglePanelHidden = useCallback((id: PanelId) => {
    setDraft((cur) => {
      const panels = { ...(cur.panels ?? {}) };
      const prev = panels[id];
      panels[id] = {
        corner: prev?.corner ?? PANEL_META[id].defaultCorner,
        hidden: !prev?.hidden,
      };
      return { ...cur, panels };
    });
  }, []);

  const onSave = useCallback(() => {
    const res = writePlayerChromeConfig(theme, draft);
    if (!res.ok) {
      void alertDialog(t("Couldn't save your layout. {error}", { error: res.error }));
      return;
    }
    setSaved(draft);
    bumpProfiles();
    notifyPlayerChromeChanged(theme);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1600);
  }, [draft, theme, bumpProfiles]);

  const onSwitchProfile = useCallback(
    async (id: string) => {
      if (!sameConfig(draft, saved)) {
        const ok = await confirmDialog(
          t("You have unsaved changes that will be lost when switching profiles. Continue?"),
        );
        if (!ok) return;
      }
      const res = setActiveProfile(theme, id);
      if (!res.ok) {
        void alertDialog(t("Couldn't switch profile. {error}", { error: res.error }));
        return;
      }
      bumpProfiles();
      notifyPlayerChromeChanged(theme);
    },
    [draft, saved, theme, bumpProfiles],
  );

  const onSaveAsNew = useCallback(
    (name: string) => {
      const res = createProfile(theme, name, draft);
      if (!res.ok) {
        void alertDialog(t("Couldn't create the profile. {error}", { error: res.error }));
        return;
      }
      bumpProfiles();
      notifyPlayerChromeChanged(theme);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 1600);
    },
    [draft, theme, bumpProfiles],
  );

  const onRenameProfile = useCallback(
    (newName: string) => {
      if (!activeProfileId) return;
      const res = renameProfileApi(activeProfileId, newName);
      if (!res.ok) {
        void alertDialog(t("Couldn't rename the profile. {error}", { error: res.error }));
        return;
      }
      bumpProfiles();
    },
    [activeProfileId, bumpProfiles],
  );

  const onDeleteProfile = useCallback(async () => {
    if (!activeProfileId) return;
    const ok = await confirmDialog(t("Delete this profile permanently? This cannot be undone."));
    if (!ok) return;
    const res = deleteProfileApi(activeProfileId);
    if (!res.ok) {
      void alertDialog(t("Couldn't delete the profile. {error}", { error: res.error }));
      return;
    }
    bumpProfiles();
    notifyPlayerChromeChanged(theme);
  }, [activeProfileId, theme, bumpProfiles]);

  const onExportProfile = useCallback(() => {
    if (!activeProfileId) return;
    const json = exportProfileJson(activeProfileId);
    if (!json) return;
    const active = getActiveProfile(theme);
    const safeName = (active?.name ?? "layout").replace(/[^a-zA-Z0-9._-]+/g, "-");
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `harbor-${theme}-${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeProfileId, theme]);

  const onImportProfile = useCallback(
    (text: string) => {
      const res = importProfileJson(text);
      if (!res.ok) {
        void alertDialog(t("Couldn't import that file. {error}", { error: res.error }));
        return;
      }
      bumpProfiles();
      notifyPlayerChromeChanged(res.profile.themeId);
      if (res.profile.themeId !== theme) setTheme(res.profile.themeId);
    },
    [theme, bumpProfiles],
  );

  const onResetToDefaults = useCallback(() => {
    const baseline = resetPlayerChromeConfig(theme);
    setSaved(baseline);
    setDraft(baseline);
    bumpProfiles();
    notifyPlayerChromeChanged(theme);
    setSelectedId(null);
  }, [theme, bumpProfiles]);

  const onDiscard = useCallback(() => {
    setDraft(saved);
    setSelectedId(null);
  }, [saved]);

  const onResetAll = useCallback(() => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    const baseline = resetPlayerChromeConfig(theme);
    setSaved(baseline);
    setDraft(baseline);
    notifyPlayerChromeChanged(theme);
    setSelectedId(null);
    setConfirmingReset(false);
  }, [confirmingReset, theme]);

  const visibleCount = draft.controls.filter((c) => !c.hidden).length;
  const hiddenCount = draft.controls.length - visibleCount;

  return (
    <div className="flex flex-col gap-7">
      <ThemeTabs
        value={theme}
        onChange={(id) => {
          update({ playerChromeTheme: id });
          setTheme(id);
        }}
      />

      <ToggleRow
        label="True black menus"
        sub="Force player menus and panels to pure black, ignoring your theme tint."
        value={settings.playerMenuBlack}
        onChange={(v) => update({ playerMenuBlack: v })}
      />

      <EditLayoutCard
        theme={theme}
        visibleCount={visibleCount}
        hiddenCount={hiddenCount}
        activeProfileName={profiles.find((p) => p.id === activeProfileId)?.name ?? null}
        onOpen={() => setEditorOpen(true)}
      />

      <OptionsSection
        config={draft}
        onTimeFormat={(v: TimeFormat) =>
          setDraft((cur) => ({ ...cur, options: { ...cur.options, timeFormat: v } }))
        }
        onVolumeStyle={(v: VolumeStyle) =>
          setDraft((cur) => ({ ...cur, options: { ...cur.options, volumeStyle: v } }))
        }
      />

      <ToggleRow
        label={t("Show P2P status chip")}
        sub={t(
          "Peers, speed and progress while a torrent streams. Sits clear of the exit button, top left.",
        )}
        value={settings.playerP2pChip}
        onChange={(v) => update({ playerP2pChip: v })}
      />

      <ToggleRow
        label={t("Content advisory on start")}
        sub={t(
          "When a movie or episode starts, briefly show its IMDb parental guide (violence, profanity, substances, frightening scenes and more) with severity. Fades on its own.",
        )}
        value={settings.contentAdvisoryToast}
        onChange={(v) => update({ contentAdvisoryToast: v })}
      />

      <FooterBar
        dirty={dirty}
        justSaved={justSaved}
        confirmingReset={confirmingReset}
        onSave={onSave}
        onDiscard={onDiscard}
        onResetAll={onResetAll}
      />

      {editorOpen && (
        <EditorOverlay
          theme={theme}
          config={draft}
          selectedId={selectedId}
          onSelect={setSelectedId}
          selectedPanelId={selectedPanelId}
          onSelectPanel={setSelectedPanelId}
          onSetPanelCorner={setPanelCorner}
          onTogglePanelHidden={togglePanelHidden}
          onClose={async () => {
            if (!sameConfig(draft, saved)) {
              const ok = await confirmDialog(
                t("You have unsaved changes. Close the editor and discard them?"),
              );
              if (!ok) return;
              setDraft(saved);
              setSelectedId(null);
              setSelectedPanelId(null);
            }
            setEditorOpen(false);
          }}
          onMoveSlot={moveSlot}
          onMoveOrder={moveOrder}
          onToggleHidden={toggleHidden}
          onResetControl={resetControl}
          onSetCustomIcon={setCustomIcon}
          onSetVariant={setVariant}
          profiles={profiles}
          activeProfileId={activeProfileId}
          dirty={dirty}
          justSaved={justSaved}
          onSave={onSave}
          onSwitchProfile={onSwitchProfile}
          onSaveAsNew={onSaveAsNew}
          onRenameProfile={onRenameProfile}
          onDeleteProfile={onDeleteProfile}
          onExportProfile={onExportProfile}
          onImportProfile={onImportProfile}
          onResetToDefaults={onResetToDefaults}
          onUnhide={unhideControl}
        />
      )}
    </div>
  );
}
