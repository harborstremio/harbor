import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { StartupLoader } from "@/components/startup-loader";
import { isLinuxDesktop, isMacDesktop, isWindowsDesktop } from "@/lib/platform";
import { ModalOverlayApp } from "@/views/modal-overlay-app";
import { HdrOverlayApp } from "@/views/hdr-overlay-app";
import { PipApp } from "@/views/pip";
import { RemoteApp } from "@/views/remote-app";
import "@/index.css";

function detectRemoteMode(): boolean {
  try {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/remote" || path.endsWith("/remote")) return true;
    if (new URLSearchParams(window.location.search).get("remote") === "1") return true;
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
const isRemote = detectRemoteMode();
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
if (isRemote) {
  document.documentElement.style.overflow = "auto";
  document.body.style.overflow = "auto";
  document.body.style.userSelect = "auto";
  document.body.style.cursor = "auto";
}
if (!isPip && !isModal && !isHdrOverlay) {
  document.documentElement.dataset.os = isLinuxDesktop()
    ? "linux"
    : isMacDesktop()
      ? "macos"
      : isWindowsDesktop()
        ? "windows"
        : "web";
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

function StartupReady() {
  useEffect(() => {
    requestAnimationFrame(() => {
      document.getElementById("harbor-boot")?.remove();
      const root = document.getElementById("root");
      if (root instanceof HTMLElement) {
        root.removeAttribute("data-startup-hidden");
        root.inert = false;
      }
    });
  }, []);
  return null;
}

function MainRoot() {
  const [appReady, setAppReady] = useState(false);
  const [startupVisible, setStartupVisible] = useState(true);
  const markAppReady = useCallback(() => setAppReady(true), []);
  const revealApplication = useCallback(() => {
    setStartupVisible(false);
    document.getElementById("harbor-boot")?.remove();
    const root = document.getElementById("root");
    if (root instanceof HTMLElement) {
      root.removeAttribute("data-startup-hidden");
      root.inert = false;
    }
    if ("__TAURI_INTERNALS__" in window) {
      void import("@tauri-apps/api/core").then(({ invoke }) =>
        invoke("harbor_startup_ready").catch(() => {}),
      );
    }
  }, []);

  // Fail-open: never strand the window on the boot loader when the ready
  // signal hangs (stalled network, dead query) — reveal the UI anyway.
  useEffect(() => {
    if (!startupVisible) return;
    const t = window.setTimeout(revealApplication, 6000);
    return () => window.clearTimeout(t);
  }, [startupVisible, revealApplication]);

  return (
    <>
      <App onReady={markAppReady} />
      {startupVisible && <StartupLoader ready={appReady} onComplete={revealApplication} />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isHdrOverlay ? (
      <HdrOverlayApp />
    ) : isModal ? (
      <ModalOverlayApp />
    ) : isPip ? (
      <PipApp />
    ) : isRemote ? (
      <RemoteApp />
    ) : (
      <MainRoot />
    )}
    {(isHdrOverlay || isModal || isPip || isRemote) && <StartupReady />}
  </StrictMode>,
);
