import { useState } from "react";
import { Check, Copy, Download, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { setCustomThemePreview } from "@/lib/custom-themes";
import type { ThemePreset } from "@/lib/theme";
import { useT } from "@/lib/i18n";
import { Fit } from "./community-store/market/fit";
import { tokensFromPreset } from "./community-store/market/fit-palette";
import { PaletteSeam } from "./community-store/market/palette-seam";
import { fileToPreviewDataUrl } from "./theme-upload/upload-utils";

export function BrowserCard({
  theme,
  removable,
  active,
  onActivate,
  onExport,
  onDownload,
  onRemove,
}: {
  theme: ThemePreset;
  removable: boolean;
  active: boolean;
  onActivate: () => void;
  onExport: () => void;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const hasImage = !!theme.previewImage;
  const localizedBlurb = !removable && theme.blurb ? t(theme.blurb) : theme.blurb;
  const cover = theme.previewImage ?? theme.background?.image ?? null;
  const [busy, setBusy] = useState(false);
  const addImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      setBusy(true);
      const url = await fileToPreviewDataUrl(f);
      if (url) setCustomThemePreview(theme.id, url);
      setBusy(false);
    };
    input.click();
  };
  return (
    <div
      className={`group/card relative flex flex-col overflow-hidden rounded-md bg-surface transition-colors duration-200 ease-out hover:harbor-float motion-reduce:transform-none motion-reduce:transition-none ${
        active ? "ring-2 ring-accent" : ""
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-elevated">
        <Fit kind="theme" tokens={tokensFromPreset(theme)} cover={cover} />
        {active && (
          <span className="absolute end-2.5 top-2.5 z-10 flex h-7 items-center gap-1.5 rounded-[8px] bg-accent px-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-canvas">
            <Check size={12} strokeWidth={3} /> {t("Active")}
          </span>
        )}
        {removable && !hasImage && (
          <button
            type="button"
            onClick={addImage}
            disabled={busy}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-canvas/70 text-[12.5px] font-semibold text-ink-muted opacity-0 transition-opacity hover:text-ink group-hover/card:opacity-100"
          >
            {busy ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ImagePlus size={18} strokeWidth={1.9} />
            )}
            {busy ? t("Adding") : t("Add image")}
          </button>
        )}
        <div className="absolute inset-x-0 bottom-0 z-10">
          <PaletteSeam swatch={theme.swatch} />
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[14.5px] font-semibold tracking-tight text-ink">
            {theme.name}
          </span>
          {localizedBlurb && (
            <span className="line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">
              {localizedBlurb}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onActivate}
            disabled={active}
            className={`h-10 flex-1 rounded-md text-[13px] font-semibold transition-opacity ${
              active ? "bg-elevated text-ink" : "bg-ink text-canvas hover:opacity-90"
            }`}
          >
            {active ? t("Active") : t("Apply")}
          </button>
          <IconButton label="Copy theme" onClick={onExport}>
            <Copy size={14} strokeWidth={2.2} />
          </IconButton>
          <IconButton label="Download" onClick={onDownload}>
            <Download size={14} strokeWidth={2.2} />
          </IconButton>
          {removable && (
            <IconButton label="Remove" onClick={onRemove} danger>
              <Trash2 size={14} strokeWidth={2.2} />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <button
      type="button"
      aria-label={t(label)}
      title={t(label)}
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-md bg-canvas text-ink-muted transition-colors ${
        danger ? "hover:text-danger hover:ring-danger" : "hover:text-ink hover:ring-edge"
      }`}
    >
      {children}
    </button>
  );
}
