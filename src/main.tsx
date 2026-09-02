import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { hydrateCustomThemes } from "@/lib/custom-themes";
import { getUiLanguage } from "@/lib/i18n/store";
import { ensureUiLocale } from "@/lib/i18n/load-locale";
import { applyOsDataset } from "@/lib/platform";
import { loadSecrets } from "@/lib/secret-store";
import { initSubtitleCache } from "@/lib/subtitles/subtitle-cache";
import { CaptionsApp } from "@/views/captions-app";
import { ModalOverlayApp } from "@/views/modal-overlay-app";
import { HdrOverlayApp } from "@/views/hdr-overlay-app";
import { PipApp } from "@/views/pip";
import "@/lib/awards-history-eager";
import "@/index.css";
import "flag-icons/css/flag-icons.min.css";
import { startTaskbarProgress } from "@/lib/download/taskbar-progress";

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

function detectModalOverlay(): boolean {
  if (new URLSearchParams(window.location.search).get("harbor-modal") === "1") return true;
  try {
    const w = getCurrentWindow();
    if (w.label === "harbor-modal-overlay") return true;
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
const isModal = detectModalOverlay();
const isHdrOverlay = detectHdrOverlay();
const isCaptions = detectCaptions();
const isRemote = detectRemoteMode();
applyOsDataset();
if (isRemote) {
  document.documentElement.style.overflow = "auto";
  document.body.style.overflow = "auto";
  document.body.style.userSelect = "auto";
  document.body.style.cursor = "auto";
}
if (isModal || isHdrOverlay) {
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
if (import.meta.env.DEV && !isPip && !isModal && !isHdrOverlay && !isRemote) {
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
      void import("@tauri-apps/api/core").then(({ invoke }) =>
        invoke("harbor_startup_ready").catch(() => {}),
      );
    }
  }, [appReady]);
  return <App onReady={markAppReady} />;
}

async function mount() {
  await Promise.all([
    loadSecrets(),
    hydrateCustomThemes().catch(() => {}),
    ensureUiLocale(getUiLanguage()),
  ]);
  if (!isHdrOverlay && !isModal && !isCaptions) void initSubtitleCache();
  if (!isHdrOverlay && !isModal && !isCaptions && !isPip) startTaskbarProgress();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      {isHdrOverlay ? (
        <HdrOverlayApp />
      ) : isCaptions ? (
        <CaptionsApp />
      ) : isModal ? (
        <ModalOverlayApp />
      ) : isPip ? (
        <PipApp />
      ) : (
        <MainRoot />
      )}
      {(isHdrOverlay || isModal || isPip || isCaptions) && <StartupReady />}
    </StrictMode>,
  );
}
void mount();
