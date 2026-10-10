import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { hydrateCustomThemes } from "@/lib/custom-themes";
import { applyOsDataset } from "@/lib/platform";
import { getUiLanguage } from "@/lib/i18n/store";
import { ensureUiLocale } from "@/lib/i18n/load-locale";
import { loadSecrets } from "@/lib/secret-store";
import { BpTvApp } from "@/views/big-picture/bp-tv-app";
import "@/index.css";

// The Android TV entry. index.html / main.tsx stay the desktop entry and must
// never import this file: pulling BpTvApp into that graph changes the desktop
// bundle, which is the one thing this build is not allowed to do.
//
// No pip, modal, hdr or remote branch here on purpose. Those are separate
// desktop windows, and Android has exactly one webview.

applyOsDataset();

// No startup-ready ping here, and that is deliberate. Desktop sets
// visible:false on its window and reveals it from on_page_load inside the
// #[cfg(desktop)] run(); harbor_startup_ready only calls set_focus and is not
// registered in mobile.rs at all. Android is visible purely because
// tauri.android.conf.json replaces the whole windows array and omits the flag.
// Add visible:false there and the TV stays black forever, because none of the
// reveal machinery is compiled into the Android binary.

async function mount() {
  performance.mark("harbor:mount-start");
  await Promise.all([loadSecrets(), hydrateCustomThemes().catch(() => {})]);
  performance.mark("harbor:secrets-done");
  // Only the selected language, and only if it is not the one compiled in.
  // The other catalogs never enter this entry's graph.
  await ensureUiLocale(getUiLanguage());
  performance.mark("harbor:locale-done");
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BpTvApp />
    </StrictMode>,
  );
  performance.mark("harbor:render-called");
  // The subtitle cache configures storage hooks that nothing reads until a
  // stream plays, and importing it up here put the whole subtitle stack in
  // front of the television's first paint. Loaded after the root is handed to
  // React so it parses on an idle frame instead of a critical one.
  void import("@/lib/subtitles/subtitle-cache")
    .then((m) => m.initSubtitleCache())
    .catch(() => {});
}

void mount();
