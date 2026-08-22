import { useEffect, useRef } from "react";
import { hdrOverlayEmitProps } from "@/lib/hdr-overlay";
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
  onInput,
}: {
  active: boolean;
  payload: HdrStagePayload;
  handlers: HdrStageHandlers;
  onInput?: () => void;
}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const onInputRef = useRef(onInput);

  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

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
      const bindInput = async (event: string, fn: (p: unknown) => void) =>
        bind(event, (inputPayload) => {
          onInputRef.current?.();
          fn(inputPayload);
        });
      const h = () => handlersRef.current;
      await bindInput("hdr-stage://play-pause", () => h().playPause());
      await bindInput("hdr-stage://fullscreen", () => h().fullscreen());
      await bindInput("hdr-stage://seek", (p) => h().seek((p as { sec: number }).sec));
      await bindInput("hdr-stage://seek-step", (p) => h().seekStep((p as { delta: number }).delta));
      await bindInput("hdr-stage://remember-sub", (p) => {
        const lang = (p as { lang: string | null }).lang;
        h().rememberSub(lang ? { lang } : null);
      });
      await bindInput("hdr-stage://pip", () => h().pip());
      await bindInput("hdr-stage://cast", () => h().cast());
      await bindInput("hdr-stage://back", () => h().back());
      await bindInput("hdr-stage://prev-ep", () => h().prevEp());
      await bindInput("hdr-stage://next-ep", () => h().nextEp());
      await bindInput("hdr-stage://pick-another", () => h().pickAnother());
      await bindInput("hdr-stage://screenshot", () => h().screenshot());
      await bind("hdr-stage://menu-open", (p) => h().menuOpen((p as { open: boolean }).open));
      await bindInput("hdr-stage://activity", () => h().activity());
      await bind("hdr-stage://request", () => void hdrOverlayEmitProps(payloadRef.current));
    })();
    return () => {
      cancelled = true;
      for (const off of offs) off();
    };
  }, [active]);

  return null;
}
