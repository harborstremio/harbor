import { AddonLogo, resolveAddonLogo } from "@/components/addon-logo";
import { AddonStarBadge } from "@/components/addon-star-badge";
import { CardArtBackdrop } from "@/components/card-art-backdrop";
import type { ResolvedAddon } from "@/lib/addons-store/store";

import { idOf, nameOf, subtitleFromManifest } from "./addons-utils";
import { InstallPill } from "./install-pill";

export function ListCard({
  resolved,
  onOpen,
  onInstall,
  onUninstall,
  installed,
}: {
  resolved: ResolvedAddon;
  onOpen: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  installed: boolean;
}) {
  const description = resolved.manifest?.description ?? subtitleFromManifest(resolved);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="group relative flex w-full cursor-pointer items-start gap-5 overflow-hidden rounded-2xl border border-edge-soft bg-elevated px-5 py-5 text-start transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-edge hover:shadow-[0_18px_36px_-22px_rgba(0,0,0,0.4)]"
    >
      <CardArtBackdrop
        logo={resolveAddonLogo(resolved.manifest?.logo, resolved.transportUrl)}
        background={resolved.manifest?.background}
      />
      <AddonLogo
        addonId={idOf(resolved)}
        addonName={nameOf(resolved)}
        manifestLogo={resolveAddonLogo(resolved.manifest?.logo, resolved.transportUrl)}
        size="tile"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[16px] font-semibold text-ink">{nameOf(resolved)}</span>
          <AddonStarBadge manifestId={resolved.manifest?.id} size="sm" />
        </div>
        <p className="line-clamp-3 text-[13.5px] leading-relaxed text-ink-muted">{description}</p>
      </div>
      <InstallPill
        resolved={resolved}
        installed={installed}
        onInstall={onInstall}
        onUninstall={onUninstall}
        onOpen={onOpen}
      />
    </div>
  );
}
