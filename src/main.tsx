import { App } from "@/App";
import { isLinuxDesktop, isMacDesktop, isWindowsDesktop } from "@/lib/platform";
import { HdrOverlayApp } from "@/views/hdr-overlay-app";
import { ModalOverlayApp } from "@/views/modal-overlay-app";
import { PipApp } from "@/views/pip";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@/index.css";

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
    "label =",
    (() => {
      try {
        return getCurrentWindow().label;
      } catch {
        return "?";
      }
    })(),
  );
if (import.meta.env.DEV && !isPip && !isModal && !isHdrOverlay) {
  void import("./lib/streams/__fixtures__/verify").then((m) => m.logVerificationReport());
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isHdrOverlay ? <HdrOverlayApp /> : isModal ? <ModalOverlayApp /> : isPip ? <PipApp /> : <App />}
  </StrictMode>,
);

requestAnimationFrame(() => {
  const boot = document.getElementById("harbor-boot");
  if (!boot) return;
  boot.classList.add("gone");
  setTimeout(() => boot.remove(), 260);
});
