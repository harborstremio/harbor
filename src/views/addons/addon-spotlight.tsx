import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Loader2, Plus, Star, TrendingUp } from "lucide-react";
import { addonSiteUrl, isAdultAddon, listAddons, listRising, type SAAddon } from "@/lib/providers/stremio-addons";
import { useSettings } from "@/lib/settings";
import { fetchManifestAt, installAddon, manifestToConfigureUrl } from "@/lib/addon-store";
import { rememberPendingAddon } from "@/lib/addons-store/pending-detail";
import { openInstallerViewport } from "@/components/installer-viewport";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";

const SITE = "stremio-addons.net";

export function AddonSpotlight({
  installedIds,
  onOpen,
  onChange,
}: {
  installedIds: Set<string>;
  onOpen?: (manifestId: string) => void;
  onChange?: () => void;
}) {
  const { settings } = useSettings();
  const showAdult = settings.showAdultAddons;
  const [pick, setPick] = useState<{ addon: SAAddon; trending: boolean } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = (a: SAAddon) => !!a.manifest?.id && (showAdult || !isAdultAddon(a));
      const usable = (a: SAAddon) => ok(a) && !!a.manifest?.background;
      const rising = (await listRising().catch(() => [] as SAAddon[])).filter(ok);
      const trend = rising.find(usable) ?? rising[0];
      if (trend) {
        if (!cancelled) setPick({ addon: trend, trending: true });
        return;
      }
      const top = await listAddons({
        limit: 14,
        sort_by: "stars",
        order: "desc",
        nsfw: showAdult ? undefined : "exclude",
      }).catch(() => null);
      const clean = (top?.addons ?? []).filter(ok);
      const best = clean.find(usable) ?? clean[0];
      if (!cancelled) {
        if (best) setPick({ addon: best, trending: false });
        else setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAdult]);

  if (failed) return null;
  if (!pick) return <SpotlightSkeleton />;
  return (
    <SpotlightCard
      addon={pick.addon}
      trending={pick.trending}
      installedIds={installedIds}
      onOpen={onOpen}
      onChange={onChange}
    />
  );
}

function SpotlightCard({
  addon,
  trending,
  installedIds,
  onOpen,
  onChange,
}: {
  addon: SAAddon;
  trending: boolean;
  installedIds: Set<string>;
  onOpen?: (manifestId: string) => void;
  onChange?: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const m = addon.manifest;
  const name = m?.name ?? addon.slug;
  const description = m?.description ?? "";
  const logo = m?.logo;
  const background = m?.background;
  const installed = !!m?.id && installedIds.has(m.id);
  const types = useMemo(() => (Array.isArray(m?.types) ? m!.types!.slice(0, 4) : []), [m?.types]);

  const install = async () => {
    if (!m?.id || busy || installed) return;
    setBusy(true);
    try {
      let hints = (m as { behaviorHints?: { configurable?: boolean; configurationRequired?: boolean } })
        .behaviorHints;
      if (!hints) hints = (await fetchManifestAt(addon.manifestUrl).catch(() => null))?.behaviorHints;
      if (hints?.configurable === true || hints?.configurationRequired === true) {
        openInstallerViewport(manifestToConfigureUrl(addon.manifestUrl), name, logo ?? null);
        return;
      }
      await installAddon(m.id, addon.manifestUrl);
      onChange?.();
    } catch (err) {
      console.warn("[spotlight] install failed", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="relative min-h-[300px] overflow-hidden rounded-2xl border border-edge-soft bg-elevated/30">
      {background ? (
        <img
          src={background}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0.9 }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, var(--color-elevated), var(--color-raised))" }} />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.1 0.02 260 / 0.15) 0%, oklch(0.09 0.02 260 / 0.45) 46%, oklch(0.07 0.02 260 / 0.86) 82%, oklch(0.06 0.02 260 / 0.95) 100%)",
        }}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(80deg, oklch(0.07 0.02 260 / 0.72) 0%, transparent 58%)" }} />

      <div className="relative flex h-full min-h-[300px] flex-col justify-end gap-3.5 p-7 sm:p-9">
        <span className="flex w-fit items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)]">
          <TrendingUp size={11} strokeWidth={2.6} className="text-accent" />
          {trending ? t("Trending on {site}", { site: SITE }) : t("Top rated on {site}", { site: SITE })}
        </span>
        <div className="flex items-center gap-3.5">
          {logo && (
            <img
              src={logo}
              alt=""
              draggable={false}
              className="h-14 w-14 shrink-0 rounded-lg bg-canvas/85 object-contain p-1.5 ring-1 ring-white/10"
            />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="truncate font-display text-[28px] font-semibold leading-none tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
              {name}
            </h2>
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white/85">
              <Star size={12} strokeWidth={2.6} fill="currentColor" className="text-accent" />
              {addon.stars.toLocaleString()} {t("stars")}
              {types.length > 0 && <span className="text-white/45"> · {types.join(" · ")}</span>}
            </span>
          </div>
        </div>
        {description && (
          <p className="max-w-[62ch] line-clamp-2 text-[13.5px] leading-relaxed text-white/75 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
            {description}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          {installed ? (
            <span className="flex h-11 items-center gap-1.5 rounded-full bg-white/15 px-5 text-[13.5px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-md">
              <Check size={15} strokeWidth={2.6} />
              {t("Installed")}
            </span>
          ) : (
            <button
              type="button"
              onClick={install}
              disabled={busy || !m?.id}
              className="flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[13.5px] font-semibold text-black transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 motion-reduce:transform-none"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} strokeWidth={2.6} />}
              {t("Install")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (m?.id && onOpen) {
                rememberPendingAddon(m.id, addon.manifestUrl, addon.manifest);
                onOpen(m.id);
              } else openUrl(addonSiteUrl(addon.slug));
            }}
            className="flex h-11 items-center gap-2 rounded-full bg-white/12 px-5 text-[13.5px] font-semibold text-white ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/20"
          >
            {t("Details")}
          </button>
          <button
            type="button"
            onClick={() => openUrl(addonSiteUrl(addon.slug))}
            className="flex h-11 items-center gap-1.5 px-2 text-[12.5px] font-semibold text-white/70 transition-colors hover:text-white"
          >
            <ArrowUpRight size={13} strokeWidth={2.4} className="dir-icon" />
            {SITE}
          </button>
        </div>
      </div>
    </section>
  );
}

function SpotlightSkeleton() {
  return (
    <div className="harbor-skel relative min-h-[300px] overflow-hidden rounded-2xl border border-edge-soft bg-elevated/25">
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3.5 p-8 sm:p-10">
        <div className="h-5 w-40 rounded-full bg-elevated/60" />
        <div className="h-9 w-1/2 max-w-[380px] rounded-lg bg-elevated/60" />
        <div className="h-3.5 w-2/3 max-w-[440px] rounded bg-elevated/45" />
        <div className="mt-2 flex gap-3">
          <div className="h-11 w-36 rounded-full bg-elevated/60" />
          <div className="h-11 w-28 rounded-full bg-elevated/45" />
        </div>
      </div>
    </div>
  );
}
