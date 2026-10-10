import { useCallback, type Dispatch, type SetStateAction } from "react";
import {
  DEFAULT_DEFAULT_CONFIG,
  DEFAULT_STREMIO_CONFIG,
  PANEL_META,
  type ControlVariant,
  type PanelCorner,
  type PanelId,
  type PlayerChromeConfig,
  type PlayerControlConfig,
  type PlayerControlId,
  type ThemeId,
} from "@/lib/player-chrome";
import { moveControlOrder, moveControlSlot } from "./config-helpers";

const THEME_BASELINES: Record<ThemeId, PlayerChromeConfig> = {
  default: DEFAULT_DEFAULT_CONFIG,
  stremio: DEFAULT_STREMIO_CONFIG,
};

export function useChromeEdits(
  setDraft: Dispatch<SetStateAction<PlayerChromeConfig>>,
  selectedId: PlayerControlId | null,
  theme: ThemeId,
) {
  const moveSlot = useCallback(
    (dir: -1 | 1) => {
      if (!selectedId) return;
      setDraft((cur) => moveControlSlot(cur, selectedId, dir));
    },
    [selectedId, setDraft],
  );

  const moveOrder = useCallback(
    (dir: -1 | 1) => {
      if (!selectedId) return;
      setDraft((cur) => moveControlOrder(cur, selectedId, dir));
    },
    [selectedId, setDraft],
  );

  const toggleHidden = useCallback(() => {
    if (!selectedId) return;
    setDraft((cur) => ({
      ...cur,
      controls: cur.controls.map((c) => (c.id === selectedId ? { ...c, hidden: !c.hidden } : c)),
    }));
  }, [selectedId, setDraft]);

  const unhideControl = useCallback(
    (id: PlayerControlId) => {
      setDraft((cur) => ({
        ...cur,
        controls: cur.controls.map((c) => (c.id === id ? { ...c, hidden: false } : c)),
      }));
    },
    [setDraft],
  );

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
  }, [selectedId, theme, setDraft]);

  const setCustomIcon = useCallback(
    (id: PlayerControlId, dataUrl: string | null, state?: string) => {
      setDraft((cur) => {
        const nextIcons = { ...(cur.customIcons ?? {}) };
        const k = state ? `${id}:${state}` : id;
        if (dataUrl == null) delete nextIcons[k];
        else nextIcons[k] = dataUrl;
        return { ...cur, customIcons: nextIcons };
      });
    },
    [setDraft],
  );

  const setVariant = useCallback(
    (id: PlayerControlId, variant: ControlVariant | null) => {
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
    },
    [setDraft],
  );

  const setPanelCorner = useCallback(
    (id: PanelId, corner: PanelCorner) => {
      setDraft((cur) => {
        const panels = { ...(cur.panels ?? {}) };
        const prev = panels[id];
        panels[id] = { corner, hidden: prev?.hidden ?? false };
        return { ...cur, panels };
      });
    },
    [setDraft],
  );

  const togglePanelHidden = useCallback(
    (id: PanelId) => {
      setDraft((cur) => {
        const panels = { ...(cur.panels ?? {}) };
        const prev = panels[id];
        panels[id] = { corner: prev?.corner ?? PANEL_META[id].defaultCorner, hidden: !prev?.hidden };
        return { ...cur, panels };
      });
    },
    [setDraft],
  );

  return {
    moveSlot,
    moveOrder,
    toggleHidden,
    unhideControl,
    resetControl,
    setCustomIcon,
    setVariant,
    setPanelCorner,
    togglePanelHidden,
  };
}
