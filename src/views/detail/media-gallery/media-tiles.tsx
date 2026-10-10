import { Check, Download, ImagePlus, RotateCcw } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { HoverTooltip } from "@/components/hover-tooltip";
import { t } from "@/lib/i18n";

export type GalleryVideo = { ytId: string; name: string; type: string };

const VIDEO_THUMB = (ytId: string) => `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;

function TileButton({
  icon,
  label,
  onClick,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <HoverTooltip label={label} align="center" className="shrink-0">
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={`flex h-8 w-8 items-center justify-center rounded-full bg-canvas/80 text-ink shadow-[0_4px_14px_rgba(0,0,0,0.45)] backdrop-blur-md transition-transform hover:scale-110 active:scale-90 ${className}`}
      >
        {icon}
      </button>
    </HoverTooltip>
  );
}

export function VideoTile({ v, onPlay, onDownload }: { v: GalleryVideo; onPlay: () => void; onDownload: () => void }) {
  return (
    <div className="group flex w-full flex-col gap-2.5">
      <div className="relative">
        <button
          type="button"
          onClick={onPlay}
          className="relative block aspect-video w-full overflow-hidden rounded-xl bg-elevated/40 text-start"
        >
          <img
            src={VIDEO_THUMB(v.ytId)}
            alt={v.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-canvas/30 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-canvas">
              <Play size={18} fill="currentColor" />
            </span>
          </span>
        </button>
        <span className="absolute end-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <TileButton icon={<Download size={15} strokeWidth={2.2} />} label={t("Download")} onClick={onDownload} />
        </span>
      </div>
      <div className="flex flex-col gap-0.5 px-0.5">
        <span className="truncate text-[13.5px] font-semibold text-ink">{v.name}</span>
        <span className="text-[11.5px] text-ink-subtle">{v.type}</span>
      </div>
    </div>
  );
}

export function ImageTile({
  src,
  ratio,
  onOpen,
  onDownload,
  onSetBackdrop,
  onSetShowBackdrop,
  onSetPoster,
  posterPinned = false,
  backdropPinned = false,
  pinnable = false,
}: {
  src: string;
  ratio: "landscape" | "portrait";
  onOpen: () => void;
  onDownload: () => void;
  onSetBackdrop?: () => void;
  onSetShowBackdrop?: () => void;
  onSetPoster?: () => void;
  posterPinned?: boolean;
  backdropPinned?: boolean;
  pinnable?: boolean;
}) {
  const aspect = ratio === "landscape" ? "aspect-video" : "aspect-[2/3]";
  const pinnedLabel = posterPinned ? t("Show poster") : backdropPinned ? t("Show backdrop") : null;
  return (
    <div className="group relative w-full" data-title-backdrop={pinnable ? src : undefined}>
      <button
        type="button"
        onClick={onOpen}
        className={`block w-full cursor-zoom-in overflow-hidden rounded-xl bg-elevated/40 ${
          posterPinned || backdropPinned ? "ring-2 ring-accent/60" : ""
        }`}
      >
        <img
          src={src}
          alt=""
          loading="lazy"
          className={`${aspect} w-full object-cover transition-transform duration-300 group-hover:scale-105`}
        />
      </button>
      {pinnedLabel && (
        <span className="pointer-events-none absolute start-2 top-2 flex h-5 items-center gap-1 rounded-full bg-accent/15 px-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-accent ring-1 ring-accent/30 backdrop-blur-sm">
          <Check size={9} strokeWidth={2.6} />
          {pinnedLabel}
        </span>
      )}
      <span className="absolute end-2 top-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onSetPoster && (
          <TileButton
            icon={
              posterPinned ? (
                <RotateCcw size={15} strokeWidth={2.2} />
              ) : (
                <Check size={15} strokeWidth={2.4} />
              )
            }
            label={posterPinned ? t("Reset to default poster") : t("Set as show poster")}
            onClick={onSetPoster}
          />
        )}
        {onSetShowBackdrop && (
          <TileButton
            icon={
              backdropPinned ? (
                <RotateCcw size={15} strokeWidth={2.2} />
              ) : (
                <Check size={15} strokeWidth={2.4} />
              )
            }
            label={backdropPinned ? t("Reset to default backdrop") : t("Set as show backdrop")}
            onClick={onSetShowBackdrop}
          />
        )}
        {onSetBackdrop && (
          <TileButton
            icon={<ImagePlus size={15} strokeWidth={2.2} />}
            label={t("Set as theme backdrop")}
            onClick={onSetBackdrop}
          />
        )}
        <TileButton icon={<Download size={15} strokeWidth={2.2} />} label={t("Download")} onClick={onDownload} />
      </span>
    </div>
  );
}

export function LogoTile({
  src,
  pinned = false,
  onOpen,
  onDownload,
  onSetLogo,
}: {
  src: string;
  pinned?: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onSetLogo?: () => void;
}) {
  return (
    <div className="group relative flex h-[120px] w-full">
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full cursor-zoom-in items-center justify-center rounded-xl border p-5 ${
          pinned ? "border-accent/50 bg-canvas/40" : "border-edge-soft bg-canvas/30"
        }`}
      >
        <img
          src={src}
          alt=""
          loading="lazy"
          className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
        />
      </button>
      {pinned && (
        <span className="pointer-events-none absolute start-2 top-2 flex h-5 items-center gap-1 rounded-full bg-accent/15 px-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-accent ring-1 ring-accent/30">
          <Check size={9} strokeWidth={2.6} />
          {t("Show logo")}
        </span>
      )}
      <span className="absolute end-2 top-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onSetLogo && (
          <TileButton
            icon={
              pinned ? (
                <RotateCcw size={15} strokeWidth={2.2} />
              ) : (
                <Check size={15} strokeWidth={2.4} />
              )
            }
            label={pinned ? t("Reset to default logo") : t("Set as show logo")}
            onClick={onSetLogo}
          />
        )}
        <TileButton icon={<Download size={15} strokeWidth={2.2} />} label={t("Download")} onClick={onDownload} />
      </span>
    </div>
  );
}
