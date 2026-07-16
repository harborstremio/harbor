import { Subtitles as SubsIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { modalOverlayClose, modalOverlayEmitState, modalOverlayOpen } from "@/lib/modal-overlay";
import { openStyleBar } from "@/lib/player/sub-presets";
import { useT } from "@/lib/i18n";
import { MenuBody } from "./subtitle-menu/menu-body";
import type { SubtitleMenuProps } from "./subtitle-menu/types";
import { buildOverlayState } from "./subtitle-menu/utils";
import { useMenuSide } from "./menu-side";
import { Tooltip } from "./transport/tooltip";

export type { SubtitleMenuProps } from "./subtitle-menu/types";

type Props = SubtitleMenuProps;

export function SubtitleMenu(props: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [forceInline, setForceInline] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { side, measure } = useMenuSide(wrap, 500);
  const useOverlay = props.useOverlayPopup === true;
  const propsRef = useRef(props);
  propsRef.current = props;
  const onOpenChange = props.onOpenChange;
  useEffect(() => {
    onOpenChange?.(open && (forceInline || !useOverlay));
  }, [open, forceInline, useOverlay, onOpenChange]);

  useEffect(() => {
    if (useOverlay) return;
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open, useOverlay]);

  useEffect(() => {
    if (!useOverlay) return;
    const offs: Array<Promise<UnlistenFn>> = [];
    offs.push(
      listen<{ id: string | null }>("modal://subtitle/select", (e) => {
        propsRef.current.onSelect(e.payload.id);
      }),
    );
    offs.push(
      listen<{ sec: number }>("modal://subtitle/delay", (e) => {
        propsRef.current.onDelay(e.payload.sec);
      }),
    );
    offs.push(
      listen<{
        url: string;
        lang?: string;
        title?: string;
        format?: "srt" | "vtt" | "ass" | "ssa" | "sub";
        encoding?: string;
      }>("modal://subtitle/add", (e) => {
        propsRef.current.onAddSubtitle(e.payload.url, e.payload.lang, e.payload.title, {
          format: e.payload.format,
          encoding: e.payload.encoding,
        });
      }),
    );
    offs.push(listen("modal://closed", () => setOpen(false)));
    return () => {
      offs.forEach((p) => p.then((fn) => fn()).catch(() => {}));
    };
  }, [useOverlay]);

  useEffect(() => {
    if (!useOverlay || !open) return;
    void modalOverlayEmitState("subtitle", buildOverlayState(props));
  }, [
    useOverlay,
    open,
    props.tracks,
    props.selectedId,
    props.delaySec,
    props.metaImdbId,
    props.metaTitle,
    props.metaReleaseDate,
    props.season,
    props.episode,
  ]);

  useEffect(() => {
    return () => {
      if (useOverlay && open) {
        void modalOverlayClose();
      }
    };
  }, [useOverlay, open]);

  const handleClick = () => {
    if (!open) measure();
    if (!useOverlay) {
      setOpen((v) => !v);
      return;
    }
    if (open) {
      void modalOverlayClose();
      setOpen(false);
      setForceInline(false);
    } else {
      void modalOverlayOpen("subtitle", buildOverlayState(propsRef.current))
        .then(() => {
          setOpen(true);
          setForceInline(false);
        })
        .catch(() => {
          setOpen(true);
          setForceInline(true);
        });
    }
  };

  const subSelected = props.selectedId != null;

  return (
    <div ref={wrap} className="relative">
      <Tooltip label={t("Subtitles")}>
        <button
          type="button"
          onClick={handleClick}
          aria-label={t("Subtitles")}
          className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
            open ? "bg-white/22 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
          }`}
        >
          <SubsIcon size={19} strokeWidth={2} />
          {subSelected && (
            <span className="absolute end-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
          )}
        </button>
      </Tooltip>
      {open && (forceInline || !useOverlay) && (
        <div
          data-tv-focus-scope
          className={`absolute bottom-[calc(100%+10px)] ${side === "start" ? "start-0" : "end-0"} flex h-[400px] max-h-[72vh] w-[500px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_24px_60px_-18px_rgba(0,0,0,0.8)] backdrop-blur-xl`}
        >
          <MenuBody {...props} onClose={() => setOpen(false)} onOpenStyleBar={openStyleBar} />
        </div>
      )}
    </div>
  );
}

export function SubtitleMenuBody(props: Props & { onClose: () => void }) {
  return <MenuBody {...props} />;
}
