import { hdrOverlayEmitProps } from "@/lib/hdr-overlay";
import { useEffect, useRef } from "react";

import type { HdrStagePayload } from "../hdr-overlay-app";

export type HdrStageHandlers = {
  playPause: () => void;
  fullscreen: () => void;
  seek: (sec: number) => void;
  seekStep: (delta: number) => void;
  rememberSub: (t: { lang?: string } | null | undefined) => void;
  pip: () => void;
  cast: () => void;
  back: () => void;
  prevEp: () => void;
  nextEp: () => void;
  pickAnother: () => void;
  screenshot: () => void;
  menuOpen: (open: boolean) => void;
  activity: () => void;
};

export function HdrStageBridge({
  active,
  payload,
  handlers,
}: {
  active: boolean;
  payload: HdrStagePayload;
  handlers: HdrStageHandlers;
}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  useEffect(() => {
    if (!active) return;
    void hdrOverlayEmitProps(payload);
  }, [active, payload]);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => void hdrOverlayEmitProps(payloadRef.current), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const isTauri = "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;
    let cancelled = false;
    const offs: Array<() => void> = [];
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const bind = async (event: string, fn: (p: unknown) => void) => {
        const off = await listen(event, (e) => fn(e.payload));
        if (cancelled) off();
        else offs.push(off);
      };
      const h = () => handlersRef.current;
      await bind("hdr-stage://play-pause", () => h().playPause());
      await bind("hdr-stage://fullscreen", () => h().fullscreen());
      await bind("hdr-stage://seek", (p) => h().seek((p as { sec: number }).sec));
      await bind("hdr-stage://seek-step", (p) => h().seekStep((p as { delta: number }).delta));
      await bind("hdr-stage://remember-sub", (p) => {
        const lang = (p as { lang: string | null }).lang;
        h().rememberSub(lang ? { lang } : null);
      });
      await bind("hdr-stage://pip", () => h().pip());
      await bind("hdr-stage://cast", () => h().cast());
      await bind("hdr-stage://back", () => h().back());
      await bind("hdr-stage://prev-ep", () => h().prevEp());
      await bind("hdr-stage://next-ep", () => h().nextEp());
      await bind("hdr-stage://pick-another", () => h().pickAnother());
      await bind("hdr-stage://screenshot", () => h().screenshot());
      await bind("hdr-stage://menu-open", (p) => h().menuOpen((p as { open: boolean }).open));
      await bind("hdr-stage://activity", () => h().activity());
      await bind("hdr-stage://request", () => void hdrOverlayEmitProps(payloadRef.current));
    })();
    return () => {
      cancelled = true;
      for (const off of offs) off();
    };
  }, [active]);

  return null;
}
