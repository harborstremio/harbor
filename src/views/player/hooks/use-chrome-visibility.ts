import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getSeekHovering, subscribeSeekHovering } from "@/lib/player/playback-clock";
import { CHROME_HIDE_MS_PAUSED, CHROME_HIDE_MS_PLAYING, CHROME_HIDE_MS_RESUME } from "../player-utils";

const UI_SCALE_ACTIVITY_EVENT = "harbor:ui-scale-activity";
const UI_SCALE_RESIZE_HOLD_MS = 700;

export function useChromeVisibility(params: {
  playing: boolean;
  drawMode: boolean;
  pipMode: boolean;
  setChromeHidden: (hidden: boolean) => void;
  keyboardPauseShowsControls: boolean;
}) {
  const { playing, drawMode, pipMode, setChromeHidden, keyboardPauseShowsControls } = params;
  const [chromeVisible, setChromeVisible] = useState(false);
  const lastInputKeyboardRef = useRef(false);
  const prevPlayingRef = useRef(playing);
  const chromeVisibleRef = useRef(false);
  useEffect(() => {
    chromeVisibleRef.current = chromeVisible;
    document.documentElement.toggleAttribute("data-player-chrome-visible", chromeVisible);
    document.documentElement.setAttribute("data-player-chrome-mounted", "");
    return () => {
      document.documentElement.removeAttribute("data-player-chrome-visible");
      document.documentElement.removeAttribute("data-player-chrome-mounted");
    };
  }, [chromeVisible]);

  const hideTimer = useRef<number | null>(null);
  const resizeTimer = useRef<number | null>(null);
  const resizingUiRef = useRef(false);
  const anyMenuOpenRef = useRef(false);
  const resumeHideRef = useRef(false);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const drawModeRef = useRef(drawMode);
  drawModeRef.current = drawMode;
  const pipModeRef = useRef(pipMode);
  pipModeRef.current = pipMode;

  const wakeChrome = useCallback(() => {
    setChromeVisible(true);
    setChromeHidden(pipModeRef.current);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    if (resizingUiRef.current || anyMenuOpenRef.current || getSeekHovering()) return;
    let wait = playingRef.current && !drawModeRef.current ? CHROME_HIDE_MS_PLAYING : CHROME_HIDE_MS_PAUSED;
    if (resumeHideRef.current) {
      resumeHideRef.current = false;
      wait = CHROME_HIDE_MS_RESUME;
    }
    hideTimer.current = window.setTimeout(() => {
      setChromeVisible(false);
      setChromeHidden(true);
    }, wait);
  }, [setChromeHidden]);
  const wakeChromeRef = useRef(wakeChrome);
  wakeChromeRef.current = wakeChrome;

  const hideForResume = useCallback(() => {
    resumeHideRef.current = true;
  }, []);

  useEffect(() => {
    const playingChanged = prevPlayingRef.current !== playing;
    prevPlayingRef.current = playing;
    if (playingChanged && lastInputKeyboardRef.current && !keyboardPauseShowsControls) {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      setChromeVisible(false);
      setChromeHidden(true);
    } else {
      wakeChrome();
    }
    const onMove = () => {
      lastInputKeyboardRef.current = false;
      wakeChrome();
    };
    const onPointerDown = () => {
      lastInputKeyboardRef.current = false;
    };
    const onKeyDown = () => {
      lastInputKeyboardRef.current = true;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchstart", onMove);
    window.addEventListener("harbor:controller-activity", onMove);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onMove);
      window.removeEventListener("harbor:controller-activity", onMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (resizeTimer.current) window.clearTimeout(resizeTimer.current);
      setChromeHidden(false);
    };
  }, [wakeChrome, setChromeHidden, playing, keyboardPauseShowsControls]);

  useEffect(() => {
    const onScaleActivity = () => {
      resizingUiRef.current = true;
      setChromeVisible(true);
      setChromeHidden(pipMode);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (resizeTimer.current) window.clearTimeout(resizeTimer.current);
      resizeTimer.current = window.setTimeout(() => {
        resizingUiRef.current = false;
        wakeChrome();
      }, UI_SCALE_RESIZE_HOLD_MS);
    };
    window.addEventListener(UI_SCALE_ACTIVITY_EVENT, onScaleActivity);
    return () => {
      window.removeEventListener(UI_SCALE_ACTIVITY_EVENT, onScaleActivity);
      if (resizeTimer.current) window.clearTimeout(resizeTimer.current);
    };
  }, [pipMode, setChromeHidden, wakeChrome]);

  useEffect(() => {
    const onLeave = (e: MouseEvent) => {
      if (e.relatedTarget) return;
      if (!playing || drawMode) return;
      if (anyMenuOpenRef.current || getSeekHovering()) return;
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      setChromeVisible(false);
      setChromeHidden(true);
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }, [playing, drawMode, setChromeHidden]);

  useEffect(() => {
    const onBlur = () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      setChromeVisible(false);
      setChromeHidden(true);
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [setChromeHidden]);

  useEffect(
    () =>
      subscribeSeekHovering(() => {
        if (getSeekHovering()) {
          setChromeVisible(true);
          if (hideTimer.current) window.clearTimeout(hideTimer.current);
        } else {
          wakeChrome();
        }
      }),
    [wakeChrome],
  );

  const [anyMenuOpen, setAnyMenuOpen] = useState(false);
  useEffect(() => {
    anyMenuOpenRef.current = anyMenuOpen;
    if (anyMenuOpen) {
      setChromeVisible(true);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    } else {
      wakeChromeRef.current();
    }
  }, [anyMenuOpen]);

  const cursorStyle: CSSProperties = useMemo(
    () =>
      drawMode
        ? { cursor: "none" }
        : !chromeVisible && playing
          ? { cursor: "none" }
          : { cursor: "default" },
    [drawMode, chromeVisible, playing],
  );

  return {
    chromeVisible,
    wakeChrome,
    hideForResume,
    anyMenuOpen,
    setAnyMenuOpen,
    cursorStyle,
  };
}
