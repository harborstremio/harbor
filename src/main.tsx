import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { hydrateCustomThemes } from "@/lib/custom-themes";
import { getUiLanguage } from "@/lib/i18n/store";
import { ensureUiLocale } from "@/lib/i18n/load-locale";
import { applyOsDataset } from "@/lib/platform";
import { loadSecrets } from "@/lib/secret-store";
import { initializeMusic } from "@/lib/music/player";
import { initSubtitleCache } from "@/lib/subtitles/subtitle-cache";
import { CaptionsApp } from "@/views/captions-app";
import { DjDeckApp } from "@/views/dj-deck-app";
import { ModalOverlayApp } from "@/views/modal-overlay-app";
import { HdrOverlayApp } from "@/views/hdr-overlay-app";
import { hdrOverlayEmitAction } from "@/lib/hdr-overlay";
import { PipApp } from "@/views/pip";
import { VideoPipApp } from "@/views/video-pip";
import "@/lib/awards-history-eager";
import "@/index.css";
import "flag-icons/css/flag-icons.min.css";
import { startTaskbarProgress } from "@/lib/download/taskbar-progress";
import { completeBetaReturnPreferences } from "@/lib/updater/beta-return";

let returnPreferencesReady = true;

function detectRemoteMode(): boolean {
  try {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/remote" || path.endsWith("/remote")) return true;
    if (path === "/reader" || path.endsWith("/reader")) return true;
    const q = new URLSearchParams(window.location.search);
    if (q.get("remote") === "1" || q.get("reader") === "1") return true;
  } catch {}
  return false;
}

function detectPipMode(): boolean {
  if (new URLSearchParams(window.location.search).get("pip") === "1") return true;
  try {
    const w = getCurrentWindow();
    if (w.label === "harbor-pip") return true;
  } catch {}
  return false;
}

/** The detached player window: chrome only, with the live mpv surface behind it. */
function detectVideoPip(): boolean {
  if (new URLSearchParams(window.location.search).get("harbor-video-pip") === "1") return true;
  try {
    const w = getCurrentWindow();
    if (w.label === "harbor-video-pip") return true;
  } catch {}
  return false;
}

function detectModalOverlay(): boolean {
  if (new URLSearchParams(window.location.search).get("harbor-modal") === "1") return true;
  try {
    const w = getCurrentWindow();
    if (w.label === "harbor-modal-overlay") return true;
  } catch {}
  return false;
}

function detectDjDeck(): boolean {
  if (new URLSearchParams(window.location.search).get("harbor-dj") === "1") return true;
  try {
    if (getCurrentWindow().label === "harbor-dj") return true;
  } catch {}
  return false;
}

function detectCaptions(): boolean {
  if (new URLSearchParams(window.location.search).get("harbor-captions") === "1") return true;
  try {
    const w = getCurrentWindow();
    if (w.label === "harbor-captions") return true;
  } catch {}
  return false;
}

function detectHdrOverlay(): boolean {
  if (new URLSearchParams(window.location.search).get("harbor-overlay") === "1") return true;
  try {
    const w = getCurrentWindow();
    if (w.label === "harbor-hdr-overlay") return true;
  } catch {}
  return false;
}

const isPip = detectPipMode();
const isVideoPip = detectVideoPip();
const isModal = detectModalOverlay();
const isHdrOverlay = detectHdrOverlay();
const isCaptions = detectCaptions();
const isDjDeck = detectDjDeck();
if (isDjDeck) {
  void initializeMusic().catch(() => {});
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || (event.ctrlKey && event.key.toLowerCase() === "w")) {
      void import("@tauri-apps/api/window")
        .then(({ getCurrentWindow }) => getCurrentWindow().close())
        .catch(() => {});
    }
  });
}
const isRemote = detectRemoteMode();
applyOsDataset();
if (isRemote) {
  document.documentElement.style.overflow = "auto";
  document.body.style.overflow = "auto";
  document.body.style.userSelect = "auto";
  document.body.style.cursor = "auto";
}
if (isModal || isHdrOverlay || isVideoPip) {
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
  document.body.style.backgroundColor = "transparent";
  const root = document.getElementById("root");
  if (root) {
    root.style.background = "transparent";
    root.style.backgroundColor = "transparent";
  }
}
if (import.meta.env.DEV)
  console.log(
    "[harbor] entry: pip =",
    isPip,
    "modal =",
    isModal,
    "hdr =",
    isHdrOverlay,
    "remote =",
    isRemote,
    "label =",
    (() => {
      try {
        return getCurrentWindow().label;
      } catch {
        return "?";
      }
    })(),
  );
if (import.meta.env.DEV && !isPip && !isVideoPip && !isModal && !isHdrOverlay && !isRemote) {
  void import("./lib/streams/__fixtures__/verify").then((m) => m.logVerificationReport());
}
function revealRoot() {
  const root = document.getElementById("root");
  if (root instanceof HTMLElement) {
    root.removeAttribute("data-startup-hidden");
    root.inert = false;
  }
}

function StartupReady() {
  useEffect(() => {
    requestAnimationFrame(() => {
      document.getElementById("harbor-boot")?.remove();
      document.getElementById("harbor-boot-chrome")?.remove();
      revealRoot();
    });
  }, []);
  return null;
}

function MainRoot() {
  const [appReady, setAppReady] = useState(false);
  const markAppReady = useCallback(() => setAppReady(true), []);
  useEffect(() => {
    if (!appReady) return;
    revealRoot();
    const boot = document.getElementById("harbor-boot");
    if (boot) {
      boot.classList.add("gone");
      setTimeout(() => boot.remove(), 280);
    }
    if ("__TAURI_INTERNALS__" in window) {
      void import("@tauri-apps/api/core").then(async ({ invoke }) => {
        await invoke("harbor_startup_ready").catch(() => {});
        if (returnPreferencesReady) {
          try {
            await invoke("handoff_confirm");
            const pending = JSON.parse(localStorage.getItem("harbor.update.pending") ?? "null");
            if (pending?.recoverable && pending.version === __APP_VERSION__) {
              localStorage.removeItem("harbor.update.pending");
            }
          } catch {
            /* Keep pending state and recovery files if startup cannot be acknowledged. */
          }
        }
      });
    }
  }, [appReady]);
  return <App onReady={markAppReady} />;
}

async function mount() {
  if (
    "__TAURI_INTERNALS__" in window &&
    !isHdrOverlay &&
    !isModal &&
    !isCaptions &&
    !isPip &&
    !isVideoPip &&
    !isDjDeck &&
    !isRemote
  ) {
    returnPreferencesReady = completeBetaReturnPreferences(__APP_VERSION__);
  }
  await Promise.all([
    loadSecrets(),
    hydrateCustomThemes().catch(() => {}),
    ensureUiLocale(getUiLanguage()),
    !isHdrOverlay && !isModal && !isCaptions && !isPip && !isVideoPip && !isDjDeck
      ? initializeMusic()
      : Promise.resolve(),
  ]);
  if (!isHdrOverlay && !isModal && !isCaptions && !isDjDeck) void initSubtitleCache();
  if (!isHdrOverlay && !isModal && !isCaptions && !isPip && !isVideoPip && !isDjDeck)
    startTaskbarProgress();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      {isHdrOverlay ? (
        <HdrOverlayApp />
      ) : isDjDeck ? (
        <DjDeckApp />
      ) : isCaptions ? (
        <CaptionsApp />
      ) : isModal ? (
        <ModalOverlayApp />
      ) : isVideoPip ? (
        <VideoPipApp />
      ) : isPip ? (
        <PipApp />
      ) : (
        <MainRoot />
      )}
      {(isModal || isPip || isVideoPip || isCaptions || isDjDeck) && <StartupReady />}
    </StrictMode>,
  );
}
void mount().catch(() => {
  if (isHdrOverlay) {
    void hdrOverlayEmitAction("hdr-stage://dead", {
      stageId: new URLSearchParams(window.location.search).get("stageId"),
    });
  }
  console.error("[harbor] application startup failed");
});
