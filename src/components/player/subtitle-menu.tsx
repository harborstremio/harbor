import { Subtitles as SubsIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { modalOverlayClose, modalOverlayEmitState, modalOverlayOpen } from "@/lib/modal-overlay";
import { openStyleBar } from "@/lib/player/sub-presets";
import { setSecondarySub } from "@/lib/player/secondary-sub";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { MenuBody } from "./subtitle-menu/menu-body";
import type { SubtitleMenuProps } from "./subtitle-menu/types";
import { buildOverlayState } from "./subtitle-menu/utils";
import { Tooltip } from "./transport/tooltip";

export type { SubtitleMenuProps } from "./subtitle-menu/types";

type Props = SubtitleMenuProps;

export function SubtitleMenu(props: Props) {
  const t = useT();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const [forceInline, setForceInline] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const useOverlay = props.useOverlayPopup === true;
  const propsRef = useRef(props);
  propsRef.current = props;
  const preferredLanguages =
    settings.preferredSubLangs.length > 0
      ? settings.preferredSubLangs
      : settings.preferredLanguages;
  const onOpenChange = props.onOpenChange;
  useEffect(() => {
    onOpenChange?.(open && (forceInline || !useOverlay));
  }, [open, forceInline, useOverlay, onOpenChange]);

  useEffect(() => {
    if (useOverlay) return;
    if (!open) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (wrap.current?.contains(target)) return;
      if (target?.closest("[data-title-suggest-dropdown]")) return;
      setOpen(false);
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
      listen<{ id: string | null }>("modal://subtitle/secondary", (e) => {
        setSecondarySub(e.payload.id);
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
    void modalOverlayEmitState("subtitle", buildOverlayState(props, preferredLanguages));
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
    preferredLanguages,
  ]);

  useEffect(() => {
    return () => {
      if (useOverlay && open) {
        void modalOverlayClose();
      }
    };
  }, [useOverlay, open]);

  const handleClick = () => {
    if (!useOverlay) {
      setOpen((v) => !v);
      return;
    }
    if (open) {
      void modalOverlayClose();
      setOpen(false);
      setForceInline(false);
    } else {
      void modalOverlayOpen("subtitle", buildOverlayState(propsRef.current, preferredLanguages))
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

  const subSelected = props.selectedId != null && settings.showSubtitleIndicator;

  return (
    <div ref={wrap} className="relative">
      <Tooltip label={t("Subtitles")}>
        <button
          data-player-subtitles
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
        <div className="fixed end-2 bottom-[84px] flex h-[460px] max-h-[calc(100vh-108px)] w-[560px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_24px_60px_-18px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <MenuBody
            {...props}
            preferredLanguages={preferredLanguages}
            onClose={() => setOpen(false)}
            onOpenStyleBar={openStyleBar}
          />
        </div>
      )}
    </div>
  );
}

export function SubtitleMenuBody(props: Props & { onClose: () => void }) {
  return <MenuBody {...props} />;
}
