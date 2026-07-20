import { Check, Loader2, Settings2 } from "lucide-react";
import { useState } from "react";
import { AddonLogo, resolveAddonLogo } from "@/components/addon-logo";
import { AddonStarBadge } from "@/components/addon-star-badge";
import { CardArtBackdrop } from "@/components/card-art-backdrop";
import type { ResolvedAddon } from "@/lib/addons-store/store";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { idOf, nameOf, subtitleFromManifest } from "./addons-utils";

export function TileCard({
  resolved,
  onOpen,
  onInstall,
  installed,
}: {
  resolved: ResolvedAddon;
  onOpen: () => void;
  onInstall: () => void | Promise<void>;
  installed: boolean;
}) {
  const t = useT();
  const { settings } = useSettings();
  const tv = settings.tvNavigation;
  const description = resolved.manifest?.description ?? subtitleFromManifest(resolved);
  const [installing, setInstalling] = useState(false);
  const configurable =
    !!resolved.manifest?.behaviorHints?.configurable ||
    !!resolved.manifest?.behaviorHints?.configurationRequired;

  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (installed || installing) return;
    if (configurable) {
      onOpen();
      return;
    }
    setInstalling(true);
    try {
      await onInstall();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border border-edge-soft bg-elevated p-6 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-edge hover:shadow-[0_18px_40px_-22px_rgba(0,0,0,0.4)]"
    >
      <CardArtBackdrop
        logo={resolveAddonLogo(resolved.manifest?.logo, resolved.transportUrl)}
        background={resolved.manifest?.background}
      />
      <div className="relative flex items-center gap-4">
        <AddonLogo
          addonId={idOf(resolved)}
          addonName={nameOf(resolved)}
          manifestLogo={resolveAddonLogo(resolved.manifest?.logo, resolved.transportUrl)}
          size="tile"
        />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className="line-clamp-2 font-semibold leading-tight text-ink" style={{ fontSize: tv ? "20px" : "15.5px" }}>
            {nameOf(resolved)}
          </span>
          <AddonStarBadge manifestId={resolved.manifest?.id} size="xs" />
        </div>
      </div>
      <p className="relative line-clamp-3 leading-relaxed text-ink-muted" style={{ fontSize: tv ? "17px" : "13.5px" }}>{description}</p>
      <button
        onClick={handle}
        disabled={installed || installing}
        className={`relative mt-auto flex items-center justify-center gap-1.5 rounded-full px-5 font-semibold transition-all duration-150 ease-out active:scale-[0.96] ${
          installed
            ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
            : installing
              ? "bg-ink/80 text-canvas"
              : "bg-ink text-canvas hover:opacity-90"
        }`}
        style={{
          height: tv ? "3.5rem" : "2.75rem",
          fontSize: tv ? "17px" : "13.5px",
        }}
      >
        {installed ? (
          <>
            <Check size={14} strokeWidth={2.4} />
            {t("Installed")}
          </>
        ) : installing ? (
          <>
            <Loader2 size={14} strokeWidth={2.2} className="animate-spin" />
            {t("Installing")}
          </>
        ) : configurable ? (
          <>
            <Settings2 size={14} strokeWidth={2.2} />
            {t("Set up")}
          </>
        ) : (
          t("Install")
        )}
      </button>
    </div>
  );
}
