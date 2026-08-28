import { useEffect, useRef } from "react";
import {
  HDR_OVERLAY_WINDOW_LABEL,
  HDR_STAGE_ADD_SUBTITLE,
  HDR_STAGE_ADD_SUBTITLE_RESULT,
  HDR_STAGE_SET_SECONDARY_SUBTITLE_TRACK,
  HDR_STAGE_SET_SUBTITLE_TRACK,
  hdrOverlayEmitClock,
  hdrOverlayEmitProps,
  type HdrStageAddSubtitleRequest,
  type HdrStageAddSubtitleResult,
  type HdrStageSubtitleTrackRequest,
} from "@/lib/hdr-overlay";
import type { PlayerBridge } from "@/lib/player/bridge";
import { buildSubtitleTimingMediaKey } from "@/lib/player/subtitle-fps";
import {
  getPlaybackBuffered,
  getPlaybackPosition,
  subscribePlaybackClock,
} from "@/lib/player/playback-clock";
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
  lock: () => void;
  unlock: () => void;
} & Pick<PlayerBridge, "setSubtitleTrack" | "setSecondarySubtitleTrack" | "addSubtitle">;

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
    if (!active || !payload.visible) return;
    // Keep the transport clock live without resending and reconciling the
    // complete transparent HDR control surface on every playback tick.
    let frame = 0;
    const publish = () => {
      frame = 0;
      void hdrOverlayEmitClock(getPlaybackPosition(), getPlaybackBuffered());
    };
    publish();
    const unsubscribe = subscribePlaybackClock(() => {
      if (!frame) frame = window.requestAnimationFrame(publish);
    });
    return () => {
      unsubscribe();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [active, payload.visible]);

  useEffect(() => {
    if (!active) return;
    const isTauri = "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;
    let cancelled = false;
    const offs: Array<() => void> = [];
    void (async () => {
      const { emitTo, listen } = await import("@tauri-apps/api/event");
      const bind = async (event: string, fn: (p: unknown) => void) => {
        const off = await listen(event, (e) => fn(e.payload));
        if (cancelled) off();
        else offs.push(off);
      };
      const h = () => handlersRef.current;
      const isCurrentMediaRequest = (mediaKey: unknown) => {
        const current = payloadRef.current.src;
        return (
          typeof mediaKey === "string" &&
          mediaKey ===
            buildSubtitleTimingMediaKey({
              sourceUrl: current.url,
              mediaId: current.meta.id,
              season: current.episode?.season,
              episode: current.episode?.episode,
            })
        );
      };
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
      await bind("hdr-stage://lock", () => h().lock());
      await bind("hdr-stage://unlock", () => h().unlock());
      await bind("hdr-stage://request", () => void hdrOverlayEmitProps(payloadRef.current));
      await bind(HDR_STAGE_SET_SUBTITLE_TRACK, (p) => {
        const request = p as Partial<HdrStageSubtitleTrackRequest>;
        if (!isCurrentMediaRequest(request.mediaKey)) return;
        if (request.id === null || typeof request.id === "string") {
          h().setSubtitleTrack(request.id);
        }
      });
      await bind(HDR_STAGE_SET_SECONDARY_SUBTITLE_TRACK, (p) => {
        const request = p as Partial<HdrStageSubtitleTrackRequest>;
        if (!isCurrentMediaRequest(request.mediaKey)) return;
        if (request.id === null || typeof request.id === "string") {
          h().setSecondarySubtitleTrack(request.id);
        }
      });
      await bind(HDR_STAGE_ADD_SUBTITLE, (p) => {
        const request = p as Partial<HdrStageAddSubtitleRequest>;
        if (typeof request.requestId !== "string") return;
        const requestId = request.requestId;
        void (async () => {
          let ok = false;
          if (
            isCurrentMediaRequest(request.mediaKey) &&
            typeof request.url === "string" &&
            request.url.length > 0
          ) {
            try {
              ok = await h().addSubtitle(
                request.url,
                typeof request.lang === "string" ? request.lang : undefined,
                typeof request.title === "string" ? request.title : undefined,
                typeof request.select === "boolean" ? request.select : undefined,
                request.metadata && typeof request.metadata === "object"
                  ? request.metadata
                  : undefined,
              );
            } catch (error) {
              console.warn("[hdr-overlay] forwarded subtitle addition failed", error);
            }
          }
          const result: HdrStageAddSubtitleResult = { requestId, ok };
          await emitTo(HDR_OVERLAY_WINDOW_LABEL, HDR_STAGE_ADD_SUBTITLE_RESULT, result).catch(
            (error) => console.warn("[hdr-overlay] could not return subtitle result", error),
          );
        })();
      });
    })();
    return () => {
      cancelled = true;
      for (const off of offs) off();
    };
  }, [active]);

  return null;
}
