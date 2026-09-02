import type { PlayerSnapshot } from "../bridge";
import { t } from "@/lib/i18n";

export function mountCustomPip(
  pipWin: Window,
  video: HTMLVideoElement,
  _host: HTMLElement,
  emit: () => void,
  getSnap: () => PlayerSnapshot,
): void {
  const doc = pipWin.document;
  doc.head.innerHTML = "";
  doc.body.innerHTML = "";
  const style = doc.createElement("style");
  style.textContent = PIP_CSS;
  doc.head.appendChild(style);

  const root = doc.createElement("div");
  root.className = "pip-root";
  doc.body.appendChild(root);

  const stage = doc.createElement("div");
  stage.className = "pip-stage";
  root.appendChild(stage);

  video.style.width = "100%";
  video.style.height = "100%";
  video.style.objectFit = "contain";
  video.style.background = "black";
  stage.appendChild(video);

  const topBar = doc.createElement("div");
  topBar.className = "pip-top";
  topBar.innerHTML = `
    <button class="pip-exit" type="button">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9V5a2 2 0 0 1 2-2h4"/><path d="M21 9V5a2 2 0 0 0-2-2h-4"/><path d="M3 15v4a2 2 0 0 0 2 2h4"/><path d="M21 15v4a2 2 0 0 1-2 2h-4"/></svg>
    </button>
  `;
  stage.appendChild(topBar);

  const bottom = doc.createElement("div");
  bottom.className = "pip-bottom";
  bottom.innerHTML = `
    <button class="pip-btn pip-back30" type="button">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 10 9 10"/></svg>
      <span class="pip-step">30</span>
    </button>
    <button class="pip-play" type="button">
      <svg class="pip-play-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
      <svg class="pip-pause-icon" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
    </button>
    <button class="pip-btn pip-fwd30" type="button">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 4 21 10 15 10"/></svg>
      <span class="pip-step">30</span>
    </button>
    <button class="pip-mute" type="button">
      <svg class="pip-vol-on" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
      <svg class="pip-vol-off" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>
    </button>
    <input class="pip-volume" type="range" min="0" max="1" step="0.02" />
  `;
  stage.appendChild(bottom);

  const progress = doc.createElement("div");
  progress.className = "pip-progress";
  progress.innerHTML = `<div class="pip-progress-fill"></div>`;
  stage.appendChild(progress);

  const exitBtn = root.querySelector<HTMLButtonElement>(".pip-exit")!;
  const back30 = root.querySelector<HTMLButtonElement>(".pip-back30")!;
  const fwd30 = root.querySelector<HTMLButtonElement>(".pip-fwd30")!;
  const playBtn = root.querySelector<HTMLButtonElement>(".pip-play")!;
  const muteBtn = root.querySelector<HTMLButtonElement>(".pip-mute")!;
  const volRange = root.querySelector<HTMLInputElement>(".pip-volume")!;
  const playIcon = root.querySelector<HTMLElement>(".pip-play-icon")!;
  const pauseIcon = root.querySelector<HTMLElement>(".pip-pause-icon")!;
  const volOn = root.querySelector<HTMLElement>(".pip-vol-on")!;
  const volOff = root.querySelector<HTMLElement>(".pip-vol-off")!;
  const fillEl = root.querySelector<HTMLElement>(".pip-progress-fill")!;
  exitBtn.setAttribute("aria-label", t("Exit Picture in Picture"));
  exitBtn.appendChild(doc.createTextNode(t("Exit PiP")));
  back30.setAttribute("aria-label", t("Back 30 seconds"));
  playBtn.setAttribute("aria-label", t("Play / Pause"));
  fwd30.setAttribute("aria-label", t("Forward 30 seconds"));
  muteBtn.setAttribute("aria-label", t("Mute / Unmute"));
  volRange.setAttribute("aria-label", t("Volume"));

  exitBtn.addEventListener("click", () => {
    pipWin.close();
  });
  back30.addEventListener("click", () => {
    if (Number.isFinite(video.currentTime)) {
      video.currentTime = Math.max(0, video.currentTime - 30);
    }
  });
  fwd30.addEventListener("click", () => {
    if (Number.isFinite(video.currentTime) && Number.isFinite(video.duration)) {
      video.currentTime = Math.min(video.duration - 0.25, video.currentTime + 30);
    }
  });
  playBtn.addEventListener("click", () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });
  muteBtn.addEventListener("click", () => {
    video.muted = !video.muted;
  });
  volRange.value = String(video.muted ? 0 : video.volume);
  volRange.addEventListener("input", () => {
    const v = parseFloat(volRange.value);
    video.volume = v;
    if (v > 0) video.muted = false;
  });

  const sync = () => {
    if (video.paused || video.ended) {
      playIcon.style.display = "";
      pauseIcon.style.display = "none";
    } else {
      playIcon.style.display = "none";
      pauseIcon.style.display = "";
    }
    const muted = video.muted || video.volume === 0;
    volOn.style.display = muted ? "none" : "";
    volOff.style.display = muted ? "" : "none";
    if (Number.isFinite(video.duration) && video.duration > 0) {
      const pct = Math.max(0, Math.min(1, video.currentTime / video.duration)) * 100;
      fillEl.style.width = `${pct}%`;
    }
    volRange.value = String(video.muted ? 0 : video.volume);
    emit();
    void getSnap;
  };

  video.addEventListener("play", sync);
  video.addEventListener("pause", sync);
  video.addEventListener("timeupdate", sync);
  video.addEventListener("volumechange", sync);
  video.addEventListener("durationchange", sync);
  sync();

  pipWin.addEventListener(
    "pagehide",
    () => {
      video.removeEventListener("play", sync);
      video.removeEventListener("pause", sync);
      video.removeEventListener("timeupdate", sync);
      video.removeEventListener("volumechange", sync);
      video.removeEventListener("durationchange", sync);
    },
    { once: true },
  );

  pipWin.addEventListener("keydown", (e) => {
    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      video.currentTime = Math.max(0, video.currentTime - 5);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (Number.isFinite(video.duration)) {
        video.currentTime = Math.min(video.duration - 0.25, video.currentTime + 5);
      }
    }
  });
}

const PIP_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; background: #050505; font-family: 'Inter', -apple-system, system-ui, sans-serif; color: #fafafa; overflow: hidden; }
  .pip-root { position: relative; width: 100%; height: 100%; }
  .pip-stage { position: relative; width: 100%; height: 100%; background: #000; }
  .pip-stage video { display: block; }
  .pip-top {
    position: absolute; top: 0; left: 0; right: 0; padding: 10px 12px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0));
    pointer-events: none;
    opacity: 0; transition: opacity 200ms ease;
    display: flex; align-items: center;
  }
  .pip-stage:hover .pip-top, .pip-stage:focus-within .pip-top { opacity: 1; }
  .pip-exit {
    pointer-events: auto;
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 11px; border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.16);
    background: rgba(0,0,0,0.55); backdrop-filter: blur(10px);
    color: #fafafa; font-size: 12px; font-weight: 600;
    letter-spacing: 0.04em; cursor: pointer;
    transition: background-color 150ms ease, border-color 150ms ease;
  }
  .pip-exit:hover { background: rgba(0,0,0,0.8); border-color: rgba(255,255,255,0.28); }
  .pip-bottom {
    position: absolute; left: 0; right: 0; bottom: 0;
    padding: 12px 14px 14px;
    background: linear-gradient(to top, rgba(0,0,0,0.78), rgba(0,0,0,0));
    display: flex; align-items: center; gap: 8px; justify-content: center;
    opacity: 0; transition: opacity 200ms ease;
  }
  .pip-stage:hover .pip-bottom, .pip-stage:focus-within .pip-bottom { opacity: 1; }
  .pip-btn, .pip-mute {
    position: relative;
    display: inline-flex; align-items: center; justify-content: center;
    height: 38px; width: 38px;
    border: none; background: transparent; color: #fafafa; cursor: pointer;
    border-radius: 999px;
    transition: background-color 150ms ease;
  }
  .pip-btn:hover, .pip-mute:hover { background: rgba(255,255,255,0.10); }
  .pip-step {
    position: absolute; bottom: 4px; right: 4px;
    font-size: 8.5px; font-weight: 700; color: #fafafa;
    background: rgba(0,0,0,0.55); padding: 1px 3px; border-radius: 3px; line-height: 1;
    letter-spacing: 0.03em;
  }
  .pip-play {
    display: inline-flex; align-items: center; justify-content: center;
    height: 50px; width: 50px;
    border: none; background: rgba(255,255,255,0.14); color: #fafafa; cursor: pointer;
    border-radius: 999px; backdrop-filter: blur(10px);
    transition: background-color 150ms ease, transform 100ms ease;
  }
  .pip-play:hover { background: rgba(255,255,255,0.24); }
  .pip-play:active { transform: scale(0.95); }
  .pip-volume {
    width: 70px; appearance: none; height: 3px; border-radius: 999px;
    background: rgba(255,255,255,0.18); outline: none;
    accent-color: #fafafa;
  }
  .pip-volume::-webkit-slider-thumb {
    appearance: none; height: 11px; width: 11px; border-radius: 999px;
    background: #fafafa; cursor: pointer;
  }
  .pip-progress {
    position: absolute; left: 0; right: 0; bottom: 0;
    height: 2px; background: rgba(255,255,255,0.12); pointer-events: none;
  }
  .pip-progress-fill {
    height: 100%; background: oklch(0.78 0.13 60); width: 0%;
    transition: width 200ms linear;
  }
`;
