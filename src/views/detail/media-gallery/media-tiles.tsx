import { t } from "@/lib/i18n";
import { Download, ImagePlus, Play } from "lucide-react";

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
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-canvas/80 text-ink shadow-[0_4px_14px_rgba(0,0,0,0.45)] backdrop-blur-md transition-transform hover:scale-110 active:scale-90 ${className}`}
    >
      {icon}
    </button>
  );
}

export function VideoTile({ v, onPlay, onDownload }: { v: GalleryVideo; onPlay: () => void; onDownload: () => void }) {
  return (
    <div className="group flex w-[300px] shrink-0 flex-col gap-2.5">
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
  pinnable = false,
}: {
  src: string;
  ratio: "landscape" | "portrait";
  onOpen: () => void;
  onDownload: () => void;
  onSetBackdrop?: () => void;
  pinnable?: boolean;
}) {
  const w = ratio === "landscape" ? "w-[300px]" : "w-[160px]";
  const aspect = ratio === "landscape" ? "aspect-video" : "aspect-[2/3]";
  return (
    <div className={`group relative ${w} shrink-0`} data-title-backdrop={pinnable ? src : undefined}>
      <button
        type="button"
        onClick={onOpen}
        className="block w-full cursor-zoom-in overflow-hidden rounded-xl bg-elevated/40"
      >
        <img
          src={src}
          alt=""
          loading="lazy"
          className={`${aspect} w-full object-cover transition-transform duration-300 group-hover:scale-105`}
        />
      </button>
      <span className="absolute end-2 top-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
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

export function LogoTile({ src, onOpen, onDownload }: { src: string; onOpen: () => void; onDownload: () => void }) {
  return (
    <div className="group relative flex h-[120px] w-[220px] shrink-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full cursor-zoom-in items-center justify-center rounded-xl border border-edge-soft bg-canvas/30 p-5"
      >
        <img
          src={src}
          alt=""
          loading="lazy"
          className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
        />
      </button>
      <span className="absolute end-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <TileButton icon={<Download size={15} strokeWidth={2.2} />} label={t("Download")} onClick={onDownload} />
      </span>
    </div>
  );
}
