import { ChevronRight } from "lucide-react";
import { AddonLogo, resolveAddonLogo } from "@/components/addon-logo";
import { AddonStarBadge } from "@/components/addon-star-badge";
import type { ResolvedAddon } from "@/lib/addons-store/store";
import { useT } from "@/lib/i18n";
import { idOf } from "./addons-utils";
import { TorrentioHeroArt } from "./torrentio-hero-art";

export function HeroCard({
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
  const t = useT();
  const c = resolved.curated;
  if (!c?.hero) return null;
  const isTorrentio = idOf(resolved) === "com.stremio.torrentio.addon";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="group relative flex min-h-[260px] w-full cursor-pointer overflow-hidden rounded-3xl border border-edge-soft bg-surface text-start transform-gpu transition-[border-color,box-shadow,transform] duration-[260ms] ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:border-edge hover:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.6)] active:scale-[0.995] motion-reduce:transform-none motion-reduce:transition-none"
    >
      {isTorrentio ? (
        <TorrentioHeroArt />
      ) : (
        <>
          <div
            aria-hidden
            className={`absolute inset-y-0 end-0 w-1/2 opacity-60 bg-gradient-to-l rtl:bg-gradient-to-r ${c.hero.accent}`}
          />
          <div className="absolute inset-y-0 end-0 w-2/3 bg-gradient-to-l rtl:bg-gradient-to-r from-transparent to-surface" />
          <div className="pointer-events-none absolute end-[8%] top-1/2 hidden -translate-y-1/2 md:block">
            <AddonLogo
              addonId={resolved.curated?.id ?? ""}
              addonName={resolved.manifest?.name ?? c.hero.title}
              manifestLogo={resolveAddonLogo(resolved.manifest?.logo, resolved.transportUrl)}
              size="4xl"
            />
          </div>
        </>
      )}

      <div className="relative z-10 flex flex-1 flex-col justify-center gap-7 px-10 py-10">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.32em] text-ink-subtle">
              {c.hero.eyebrow}
            </span>
            <AddonStarBadge manifestId={resolved.manifest?.id} size="md" />
          </div>
          <h2 className="font-display text-[42px] font-medium leading-[1.05] tracking-tight text-ink">
            {c.hero.title}
          </h2>
          <p className="max-w-[26rem] text-[14.5px] leading-relaxed text-ink-muted">
            {c.hero.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              installed ? onUninstall() : onInstall();
            }}
            className={`h-9 rounded-full px-5 text-[13px] font-semibold transition-all ${
              installed
                ? "bg-elevated/70 text-ink ring-1 ring-edge-soft hover:bg-danger/15 hover:text-danger hover:ring-danger/30"
                : "bg-ink text-canvas hover:opacity-90 active:scale-[0.97]"
            }`}
          >
            {installed ? t("Installed") : t("Get")}
          </button>
          <span className="inline-flex h-9 items-center gap-1 rounded-full px-4 text-[12.5px] font-medium text-ink-muted transition-colors group-hover:text-ink">
            {t("View details")}
            <ChevronRight size={13} strokeWidth={2.4} className="transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
          </span>
        </div>
      </div>
    </div>
  );
}
