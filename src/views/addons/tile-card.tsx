import { Check, Loader2, Settings2 } from "lucide-react";
import { useState } from "react";
import { AddonLogo, resolveAddonLogo } from "@/components/addon-logo";
import { AddonStarBadge } from "@/components/addon-star-badge";
import type { ResolvedAddon } from "@/lib/addons-store/store";
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
      className="group relative flex cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl border border-edge-soft bg-elevated p-6 transition-colors duration-150 hover:border-edge hover:bg-raised"
    >
      <div className="relative flex items-center gap-4">
        <AddonLogo
          addonId={idOf(resolved)}
          addonName={nameOf(resolved)}
          manifestLogo={resolveAddonLogo(resolved.manifest?.logo, resolved.transportUrl)}
          size="tile"
        />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className="line-clamp-2 text-[15.5px] font-semibold leading-tight text-ink">
            {nameOf(resolved)}
          </span>
          <AddonStarBadge manifestId={resolved.manifest?.id} size="xs" />
        </div>
      </div>
      <p className="relative line-clamp-3 text-[13.5px] leading-relaxed text-ink-muted">{description}</p>
      <button
        onClick={handle}
        disabled={installed || installing}
        className={`relative mt-auto flex h-11 items-center justify-center gap-1.5 rounded-full px-5 text-[13.5px] font-semibold transition-all duration-150 ease-out active:scale-[0.96] ${
          installed
            ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
            : installing
              ? "bg-ink/80 text-canvas"
              : "bg-ink text-canvas hover:opacity-90"
        }`}
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
