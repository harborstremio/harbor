import { AddonLogo, resolveAddonLogo } from "@/components/addon-logo";
import { AddonStarBadge } from "@/components/addon-star-badge";
import { CardArtBackdrop } from "@/components/card-art-backdrop";
import type { ResolvedAddon } from "@/lib/addons-store/store";
import { idOf, nameOf } from "./addons-utils";
import { InstallPill } from "./install-pill";
import { TagRow } from "./tag-row";

export function FeatureCard({
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
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="group relative flex w-full cursor-pointer items-start gap-5 overflow-hidden rounded-2xl border border-edge-soft bg-elevated p-6 text-start transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-edge hover:shadow-[0_18px_40px_-22px_rgba(0,0,0,0.4)]"
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
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[16.5px] font-semibold text-ink">
              {nameOf(resolved)}
            </span>
            <AddonStarBadge manifestId={resolved.manifest?.id} size="sm" />
          </div>
          <InstallPill
            resolved={resolved}
            installed={installed}
            onInstall={onInstall}
            onUninstall={onUninstall}
            onOpen={onOpen}
          />
        </div>
        {resolved.manifest?.description && (
          <p className="line-clamp-3 text-[13px] leading-relaxed text-ink-muted">
            {resolved.manifest.description}
          </p>
        )}
        <TagRow resolved={resolved} />
      </div>
    </div>
  );
}
