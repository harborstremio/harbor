function bootLog(msg: string) {
  const boot = document.getElementById("harbor-boot");
  if (!boot) return;
  let el = boot.querySelector(".boot-debug") as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.className = "boot-debug";
    el.style.cssText = "position:absolute;bottom:40px;left:0;right:0;color:#4ade80;font-family:monospace;font-size:13px;text-align:center;padding:8px;pointer-events:none;";
    boot.appendChild(el);
  }
  const lines = (el.textContent || "").split("\n").filter(Boolean);
  lines.push(msg);
  if (lines.length > 8) lines.shift();
  el.textContent = lines.join("\n");
}

try { bootLog("main.tsx loaded"); } catch(e) {}

import { getCurrentWindow } from "@tauri-apps/api/window";
try { bootLog("tauri imports ok"); } catch(e) {}
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
try { bootLog("react imports ok"); } catch(e) {}
import { App } from "@/App";
try { bootLog("App imported"); } catch(e) {}
import { isLinuxDesktop, isMacDesktop, isWindowsDesktop } from "@/lib/platform";
try { bootLog("platform imported"); } catch(e) {}
import { ModalOverlayApp } from "@/views/modal-overlay-app";
try { bootLog("modal overlay imported"); } catch(e) {}
import { HdrOverlayApp } from "@/views/hdr-overlay-app";
try { bootLog("hdr overlay imported"); } catch(e) {}
import { PipApp } from "@/views/pip";
try { bootLog("pip imported"); } catch(e) {}
import { RemoteApp } from "@/views/remote-app";
try { bootLog("remote imported"); } catch(e) {}
import "@/index.css";
try { bootLog("css imported"); } catch(e) {}

try { bootLog("rendering App..."); } catch(e) {}

function dismissBootScreen() {
  const boot = document.getElementById("harbor-boot");
  if (!boot) return;
  boot.classList.add("gone");
  setTimeout(() => boot.remove(), 260);
}

try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  bootLog("render() OK");
} catch (err) {
  bootLog("RENDER ERROR: " + ((err instanceof Error) ? err.message : String(err)));
}

requestAnimationFrame(() => dismissBootScreen());

setTimeout(() => {
  const boot = document.getElementById("harbor-boot");
  if (boot && !boot.classList.contains("gone")) {
    bootLog("TIMEOUT: forced dismiss");
    dismissBootScreen();
  }
}, 5000);

try {
  const observer = new MutationObserver(() => {
    const root = document.getElementById("root");
    if (root && root.children.length > 0) {
      const boot = document.getElementById("harbor-boot");
      if (boot && !boot.classList.contains("gone")) {
        bootLog("MutationObserver: React rendered");
        dismissBootScreen();
      }
    }
  });
  const root = document.getElementById("root");
  if (root) observer.observe(root, { childList: true, subtree: true });
} catch {}
