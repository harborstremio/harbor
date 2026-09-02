import { Subtitles as SubsIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  modalOverlayClose,
  modalOverlayEmitResult,
  modalOverlayEmitState,
  modalOverlayOpen,
} from "@/lib/modal-overlay";
import { openStyleBar } from "@/lib/player/sub-presets";
import { setSecondarySub } from "@/lib/player/secondary-sub";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { wasLimitReached } from "@/lib/subtitles/limit-signal";
import { bindSubtitleDownloadAuth } from "@/lib/subtitles/provider-auth";
import type { SubtitleLoadMetadata } from "@/lib/subtitles/types";
import { MenuBody } from "./subtitle-menu/menu-body";
import { ResizableSubtitlePanel } from "./subtitle-menu/resizable-panel";
import { useSubtitleContext } from "./subtitle-menu/subtitle-context-store";
import type { SubtitleMenuProps } from "./subtitle-menu/types";
import { buildOverlayState } from "./subtitle-menu/utils";
import { Tooltip } from "./transport/tooltip";
import { watchOutsideMouseDown } from "@/lib/player/overlay-dismiss";

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
  const subtitleContext = useSubtitleContext();
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
      if (target?.closest("[data-dropdown-menu]")) return;
      setOpen(false);
    };
    return watchOutsideMouseDown(close);
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
      listen("modal://subtitle/live-sync", () => {
        void modalOverlayClose();
        setOpen(false);
        setForceInline(false);
        propsRef.current.onEnterSync?.();
      }),
    );
    offs.push(
      listen<
        SubtitleLoadMetadata & {
          url: string;
          lang?: string;
          title?: string;
          requestId?: string;
        }
      >("modal://subtitle/add", (e) => {
        const { url, lang, title, requestId, ...metadata } = e.payload;
        void (async () => {
          const authKind = metadata.downloadAuth?.kind;
          const apiKey =
            authKind === "subsource-api-key"
              ? settings.subsourceApiKey
              : authKind === "subdl-api-key"
                ? settings.subdlApiKey
                : null;
          const downloadAuth = await bindSubtitleDownloadAuth(authKind, apiKey);
          const mainWindowMetadata: SubtitleLoadMetadata = { ...metadata, downloadAuth };
          return propsRef.current.onAddSubtitle(url, lang, title, mainWindowMetadata);
        })()
          .then((result) => (result !== false ? "ok" : wasLimitReached(url) ? "limited" : "failed"))
          .catch(() => "failed" as const)
          .then((result) => {
            if (!requestId) return;
            return modalOverlayEmitResult("modal://subtitle/add-result", {
              requestId,
              result,
            });
          });
      }),
    );
    offs.push(listen("modal://closed", () => setOpen(false)));
    return () => {
      offs.forEach((p) => p.then((fn) => fn()).catch(() => {}));
    };
  }, [useOverlay, settings.subsourceApiKey, settings.subdlApiKey]);

  useEffect(() => {
    if (!useOverlay || !open) return;
    void modalOverlayEmitState(
      "subtitle",
      buildOverlayState(props, preferredLanguages, subtitleContext),
    );
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
    subtitleContext,
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
      void modalOverlayOpen(
        "subtitle",
        buildOverlayState(propsRef.current, preferredLanguages, subtitleContext),
      )
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
          {props.iconUrl ? (
            <img
              src={props.iconUrl}
              alt=""
              className="h-[22px] w-[22px] shrink-0 select-none object-contain"
              draggable={false}
            />
          ) : (
            <SubsIcon size={19} strokeWidth={2} />
          )}
          {subSelected && (
            <span className="absolute end-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
          )}
        </button>
      </Tooltip>
      {open && (forceInline || !useOverlay) && (
        <ResizableSubtitlePanel className="fixed end-14 bottom-[150px] animate-menu-pop">
          <MenuBody
            {...props}
            preferredLanguages={preferredLanguages}
            onClose={() => setOpen(false)}
            onOpenStyleBar={openStyleBar}
          />
        </ResizableSubtitlePanel>
      )}
    </div>
  );
}

export function SubtitleMenuBody(props: Props & { onClose: () => void }) {
  return <MenuBody {...props} />;
}
