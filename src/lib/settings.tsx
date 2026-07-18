import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { applyTheme, isKnownPreset, nextColorTheme } from "@/lib/theme";
import { applyAppIcon } from "@/lib/app-icon";
import { getCustomThemes, subscribeCustomThemes } from "@/lib/custom-themes";
import { loadBgImage, saveBgImage } from "@/lib/theme-storage";
import { effectiveTmdbLanguage, setTmdbLanguage } from "@/lib/providers/tmdb/tmdb-client";
import { setPosterBaseUrl } from "@/lib/providers/rpdb";
import { setMdblistBatchKey } from "@/lib/providers/mdblist-batch";
import { setUiLanguage } from "@/lib/i18n";
import { setSnapshotRetentionDays } from "@/lib/snapshots";
import { makeSafeTauriUnlisten } from "@/lib/tauri-unlisten";
import { STORAGE_KEY } from "./settings/defaults";
import { readSettingsFile, writeSettingsFile } from "./settings/file-store";
import { loadFontData, saveFontData } from "./font-storage";
import {
  forkToProfile,
  loadEffective,
  persistEffective,
  seedSharedFromLegacy,
  sourceKeyFor,
} from "./settings/profile-store";
import type { Settings, StreamingService } from "./settings/types";

export type {
  ContentCategory,
  ContentFilters,
  Settings,
  StreamingService,
  WebhookTrigger,
} from "./settings/types";

type SettingsValue = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  toggleStreaming: (s: StreamingService) => void;
  switchProfile: (profileId: string, linked: boolean) => void;
  setSettingsLinked: (linked: boolean) => void;
};

type SettingsSource = { profileId: string; linked: boolean };

function readActiveSource(): SettingsSource {
  try {
    const raw = localStorage.getItem("harbor.profiles.v1");
    if (!raw) return { profileId: "default", linked: true };
    const s = JSON.parse(raw) as {
      profiles?: Array<{ id: string; settingsLinked?: boolean }>;
      activeId?: string | null;
    };
    const id = s.activeId || "default";
    const p = s.profiles?.find((x) => x.id === id);
    return { profileId: id, linked: p?.settingsLinked !== false };
  } catch {
    return { profileId: "default", linked: true };
  }
}

const Ctx = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const sourceRef = useRef<SettingsSource>({ profileId: "default", linked: true });
  const [settings, setSettings] = useState<Settings>(() => {
    seedSharedFromLegacy();
    const src = readActiveSource();
    sourceRef.current = src;
    const s = loadEffective(src.profileId, src.linked);
    setUiLanguage(s.uiLanguage);
    return s;
  });
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  setTmdbLanguage(settings.tmdbLanguage);

  useEffect(() => {
    let cancelled = false;
    void loadBgImage().then((img) => {
      if (cancelled || !img) return;
      setSettings((s) =>
        s.theme.backgroundImage ? s : { ...s, theme: { ...s.theme, backgroundImage: img } },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    let cancelled = false;
    void readSettingsFile().then((raw) => {
      if (cancelled || !raw || localStorage.getItem(STORAGE_KEY)) return;
      try {
        localStorage.setItem(STORAGE_KEY, raw);
        seedSharedFromLegacy();
        const restored = loadEffective(sourceRef.current.profileId, sourceRef.current.linked);
        setUiLanguage(restored.uiLanguage);
        setSettings(restored);
      } catch {}
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const lastSavedImageRef = useRef<string | null>(null);
  useEffect(() => {
    const img = settings.theme.backgroundImage;
    if (img === lastSavedImageRef.current) return;
    lastSavedImageRef.current = img;
    void saveBgImage(img);
  }, [settings.theme.backgroundImage]);

  const fileTimerRef = useRef(0);
  useEffect(() => {
    try {
      const json = persistEffective(
        settings,
        sourceRef.current.profileId,
        sourceRef.current.linked,
      );
      window.clearTimeout(fileTimerRef.current);
      fileTimerRef.current = window.setTimeout(() => void writeSettingsFile(json), 600);
    } catch (e) {
      if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22)) {
        console.warn("[settings] localStorage quota exceeded, dropping avatar");
        if (settings.harborAvatar != null) {
          setSettings((s) => ({ ...s, harborAvatar: null }));
        }
      }
    }
  }, [settings]);

  const tmdbLangRef = useRef<string | null>(null);
  useEffect(() => {
    const eff = effectiveTmdbLanguage();
    if (tmdbLangRef.current === null) {
      tmdbLangRef.current = eff;
      return;
    }
    if (tmdbLangRef.current === eff) return;
    tmdbLangRef.current = eff;
    window.location.reload();
  }, [settings.tmdbLanguage]);

  const imgLangRef = useRef<string | null>(null);
  useEffect(() => {
    const sig = settings.tmdbImageLangs.join(",");
    if (imgLangRef.current === null) {
      imgLangRef.current = sig;
      return;
    }
    if (imgLangRef.current === sig) return;
    imgLangRef.current = sig;
    const t = window.setTimeout(() => window.location.reload(), 1200);
    return () => window.clearTimeout(t);
  }, [settings.tmdbImageLangs]);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--poster-radius", `${settings.posterRadius}px`);
  }, [settings.posterRadius]);

  useEffect(() => {
    const scale = settings.uiScale > 0 ? settings.uiScale : 1;
    const root = document.getElementById("root") as
      | (HTMLElement & { style: CSSStyleDeclaration & { zoom?: string } })
      | null;
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      void import("@tauri-apps/api/webview")
        .then(({ getCurrentWebview }) => getCurrentWebview().setZoom(scale))
        .catch(() => {});
      if (root) root.style.zoom = scale !== 1 ? "1" : "";
    } else if (root) {
      root.style.zoom = scale !== 1 ? String(scale) : "";
    }
  }, [settings.uiScale]);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    const shouldServe = settings.serveWebUi || settings.remoteControlEnabled;
    void import("@tauri-apps/api/core").then(({ invoke }) => {
      if (shouldServe) invoke("web_serve_start").catch(() => {});
      else invoke("web_serve_stop").catch(() => {});
    });
  }, [settings.serveWebUi, settings.remoteControlEnabled]);

  useEffect(() => {
    setPosterBaseUrl(settings.posterBaseUrl);
  }, [settings.posterBaseUrl]);

  useEffect(() => {
    setMdblistBatchKey(settings.mdblistKey);
  }, [settings.mdblistKey]);

  useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document)) return;
    const fonts = settings.customFonts ?? [];
    const desiredFamilies = new Set(fonts.map((f) => `harbor-font-${f.id}`));
    let cancelled = false;
    void (async () => {
      for (const f of fonts) {
        const family = `harbor-font-${f.id}`;
        let exists = false;
        document.fonts.forEach((ff) => {
          if (ff.family === family) exists = true;
        });
        if (exists) continue;
        const dataUrl = f.dataUrl ?? (await loadFontData(f.id));
        if (cancelled || !dataUrl) continue;
        try {
          const ff = new FontFace(family, `url(${dataUrl})`, { display: "swap" });
          const loaded = await ff.load();
          if (!cancelled) document.fonts.add(loaded);
        } catch (e) {
          console.warn("[fonts] failed to load", family, e);
        }
      }
    })();
    return () => {
      cancelled = true;
      const toRemove: FontFace[] = [];
      document.fonts.forEach((ff) => {
        if (ff.family.startsWith("harbor-font-") && !desiredFamilies.has(ff.family)) {
          toRemove.push(ff);
        }
      });
      for (const ff of toRemove) document.fonts.delete(ff);
    };
  }, [settings.customFonts]);

  const fontMigratedRef = useRef(false);
  useEffect(() => {
    if (fontMigratedRef.current) return;
    const legacy = (settings.customFonts ?? []).filter((f) => f.dataUrl);
    if (legacy.length === 0) return;
    fontMigratedRef.current = true;
    void (async () => {
      for (const f of legacy) if (f.dataUrl) await saveFontData(f.id, f.dataUrl).catch(() => {});
      setSettings((s) => ({
        ...s,
        customFonts: (s.customFonts ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          format: f.format,
        })),
      }));
    })();
  }, [settings.customFonts]);

  useEffect(() => {
    void import("@/lib/privacy/blocklist").then(({ setTrackerBlocking }) => {
      setTrackerBlocking(settings.blockTrackers);
    });
  }, [settings.blockTrackers]);

  useEffect(() => {
    setSnapshotRetentionDays(settings.cwSnapshotRetentionDays);
  }, [settings.cwSnapshotRetentionDays]);

  useEffect(() => {
    window.__harborStremioDeeplink = settings.stremioDeeplinkInstall;
    if (!("__TAURI_INTERNALS__" in window)) return;
    void import("@tauri-apps/api/core").then(({ invoke }) => {
      void invoke("deeplink_set_stremio", { enabled: settings.stremioDeeplinkInstall }).catch((e) =>
        console.warn("[harbor] deeplink_set_stremio failed", e),
      );
    });
  }, [settings.stremioDeeplinkInstall]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      getCurrentWindow()
        .setDecorations(settings.useNativeTitleBar)
        .catch((e) => console.warn("[harbor] setDecorations failed", e));
    });
  }, [settings.useNativeTitleBar]);

  useEffect(() => {
    void applyAppIcon(settings.customAppIcon);
  }, [settings.customAppIcon]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    void import("@tauri-apps/api/core").then(({ invoke }) => {
      void invoke("tray_set_prefs", {
        prefs: {
          closeToTray: settings.closeToTray,
          alwaysOnTop: settings.trayAlwaysOnTop,
          pauseMinimized: settings.pauseMinimized,
          pauseUnfocused: settings.pauseUnfocused,
        },
      }).catch((e) => console.warn("[harbor] tray_set_prefs failed", e));
    });
  }, [
    settings.closeToTray,
    settings.trayAlwaysOnTop,
    settings.pauseMinimized,
    settings.pauseUnfocused,
  ]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let cancelled = false;
    const unlisteners: Array<() => void> = [];
    const track = (rawUnlisten: () => void) => {
      const u = makeSafeTauriUnlisten(rawUnlisten);
      if (cancelled) u();
      else unlisteners.push(u);
    };
    void import("@tauri-apps/api/event").then(({ listen }) => {
      void listen<{
        closeToTray: boolean;
        alwaysOnTop: boolean;
        pauseMinimized: boolean;
        pauseUnfocused: boolean;
      }>("harbor://tray-prefs", (e) => {
        const p = e.payload;
        setSettings((s) => ({
          ...s,
          closeToTray: p.closeToTray,
          trayAlwaysOnTop: p.alwaysOnTop,
          pauseMinimized: p.pauseMinimized,
          pauseUnfocused: p.pauseUnfocused,
        }));
      }).then(track);
      void listen("harbor://cycle-theme", () => {
        setSettings((s) => ({
          ...s,
          theme: { ...s.theme, preset: nextColorTheme(s.theme.preset) },
        }));
      }).then(track);
      void listen<string>("harbor://set-theme", (e) => {
        const id = e.payload;
        if (!id || (!isKnownPreset(id) && !id.startsWith("user:"))) return;
        setSettings((s) => ({ ...s, theme: { ...s.theme, preset: id as typeof s.theme.preset } }));
      }).then(track);
    });
    return () => {
      cancelled = true;
      unlisteners.forEach((u) => u());
    };
  }, []);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void import("@tauri-apps/api/core").then(({ invoke }) => {
      if (cancelled) return;
      const push = () => {
        const themes = getCustomThemes().map((t) => ({ id: t.id, name: t.name }));
        void invoke("tray_set_custom_themes", { themes }).catch(() => {});
      };
      push();
      unsub = subscribeCustomThemes(push);
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const toggleStreaming = useCallback((svc: StreamingService) => {
    setSettings((s) => ({
      ...s,
      streaming: { ...s.streaming, [svc]: !s.streaming[svc] },
    }));
  }, []);

  const switchProfile = useCallback((profileId: string, linked: boolean) => {
    const cur = sourceRef.current;
    if (sourceKeyFor(cur.profileId, cur.linked) === sourceKeyFor(profileId, linked)) {
      sourceRef.current = { profileId, linked };
      return;
    }
    persistEffective(settingsRef.current, cur.profileId, cur.linked);
    const next = loadEffective(profileId, linked);
    setUiLanguage(next.uiLanguage);
    setTmdbLanguage(next.tmdbLanguage);
    tmdbLangRef.current = effectiveTmdbLanguage();
    imgLangRef.current = next.tmdbImageLangs.join(",");
    sourceRef.current = { profileId, linked };
    persistEffective(next, profileId, linked);
    settingsRef.current = next;
    setSettings(next);
  }, []);

  const setSettingsLinked = useCallback(
    (linked: boolean) => {
      const cur = sourceRef.current;
      if (cur.linked === linked) return;
      if (!linked) forkToProfile(cur.profileId);
      switchProfile(cur.profileId, linked);
    },
    [switchProfile],
  );

  const value = useMemo(
    () => ({ settings, update, toggleStreaming, switchProfile, setSettingsLinked }),
    [settings, update, toggleStreaming, switchProfile, setSettingsLinked],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSettings outside SettingsProvider");
  return v;
}
