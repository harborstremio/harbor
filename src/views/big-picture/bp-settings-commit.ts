import { useCallback, useState } from "react";
import { setUiLanguage, type UiLanguage } from "@/lib/i18n";
import { useSettings, type StreamingService } from "@/lib/settings";
import type { Settings } from "@/lib/settings/types";
import { SFX } from "@/lib/sfx";
import { bpOverscan, setBpOverscan } from "./bp-safe-area";

type Commit = (controlId: string, value: string) => void;

export type BpSettingsWriter = {
  settings: Settings;
  overscan: number;
  commit: Commit;
  /** Sound packs are auditioned on focus, so the module theme moves before any
   *  value is committed and has to be put back if the viewer walks away. */
  auditionSound: (value: string) => void;
};

export function useBpSettingsWriter(): BpSettingsWriter {
  const { settings, update, toggleStreaming } = useSettings();
  const [overscan, setOverscanState] = useState(() => bpOverscan());

  const commit = useCallback<Commit>(
    (id, value) => {
      const on = value === "on";
      if (id === "overscan") {
        const next = Number(value);
        // Both, on purpose: the module holds it for this session and the
        // setting is what survives a restart. bp-shell reads the module once
        // on first render, so nothing re-reads storage mid-session.
        setBpOverscan(next);
        setOverscanState(next);
        update({ bigPictureOverscan: next });
        document.documentElement.style.setProperty("--bp-overscan", String(next));
        return;
      }
      if (id === "quality") {
        update({ posterQuality: value as Settings["posterQuality"] });
        return;
      }
      if (id === "backdrop") {
        update({ bigPictureMosaic: on });
        return;
      }
      if (id === "uiLanguage") {
        setUiLanguage(value as UiLanguage);
        update({ uiLanguage: value as UiLanguage });
        return;
      }
      if (id === "subSize") {
        update({ subFontSize: Number(value) });
        return;
      }
      if (id === "subLang") {
        const picked = settings.preferredSubLangs;
        update({
          preferredSubLangs: picked.includes(value)
            ? picked.filter((l) => l !== value)
            : [...picked, value],
        });
        return;
      }
      if (id === "engine") {
        update({ playerEngine: value as Settings["playerEngine"] });
        return;
      }
      if (id === "playbackSource") {
        update({ playbackSourcePreference: value as Settings["playbackSourcePreference"] });
        return;
      }
      if (id === "preferredMediaServer") {
        update({ preferredMediaServerId: value || null });
        return;
      }
      if (id === "hwdec") {
        update({ mpvHwdec: value as Settings["mpvHwdec"] });
        return;
      }
      if (id === "skipIntro") {
        update({ autoSkipIntro: on });
        return;
      }
      if (id === "autoNext") {
        update({ autoPlayNextEpisode: on });
        return;
      }
      if (id === "instantPlay") {
        update({ instantPlay: on });
        return;
      }
      if (id === "homeMode") {
        update({ homeMode: value as Settings["homeMode"] });
        return;
      }
      if (id === "hideWatched") {
        update({ hideWatchedInCatalogs: on });
        return;
      }
      if (id === "service") {
        toggleStreaming(value as StreamingService);
        return;
      }
      if (id === "sound") {
        const next = value as Settings["bigPictureSound"];
        update({ bigPictureSound: next });
        SFX.setTheme(next);
        return;
      }
      if (id === "controller") {
        update({ tvNavigation: on });
        return;
      }
      if (id === "autoStart") update({ bigPictureAutoStart: on });
    },
    [settings.preferredSubLangs, toggleStreaming, update],
  );

  const auditionSound = useCallback((value: string) => {
    SFX.setTheme(value as Settings["bigPictureSound"]);
    SFX.click();
  }, []);

  return { settings, overscan, commit, auditionSound };
}
