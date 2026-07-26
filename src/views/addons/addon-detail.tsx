import {
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Settings2,
  Star,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AddonLogo, resolveAddonLogo } from "@/components/addon-logo";
import { setActiveAddon } from "@/lib/active-addon";
import { manifestToConfigureUrl, manifestToShareUrl } from "@/lib/addon-store";
import { categorizeAddon, isAdultAddon, type ResolvedAddon } from "@/lib/addons-store/store";
import {
  addonSiteUrl,
  rateOnSiteUrl,
  risingEntryFor,
  useRising,
} from "@/lib/providers/stremio-addons";
import { useCommunity } from "@/lib/providers/stremio-addons-index";
import { openInstallerViewport } from "@/components/installer-viewport";
import { pushActivityHint } from "@/lib/discord/activity-hint";
import { isWeb } from "@/lib/platform";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";
import { AddonDescription } from "./addon-description";
import { AddonDocumentation } from "./addon-documentation";
import { categoryLabel } from "./addons-types";
import { idOf, nameOf, resourceLabels } from "./addons-utils";
import { DetailRail } from "./detail-rail";
import { TagRow } from "./tag-row";

export function AddonDetail({
  resolved,
  related,
  recommended,
  installedIds,
  onOpen,
  onInstall,
  onInstallAddon,
  onUninstall,
  showToast,
}: {
  resolved: ResolvedAddon;
  related: ResolvedAddon[];
  recommended: ResolvedAddon[];
  installedIds: Set<string>;
  onOpen: (id: string) => void;
  onInstall: () => Promise<boolean>;
  onInstallAddon: (r: ResolvedAddon) => Promise<boolean>;
  onUninstall: () => Promise<void>;
  onInstallUrl: (rawUrl: string) => Promise<string | null>;
  showToast: (kind: "ok" | "error", text: string) => void;
}) {
  const t = useT();
  const m = resolved.manifest;
  const c = resolved.curated;
  const isConfigurable =
    m?.behaviorHints?.configurable === true || m?.behaviorHints?.configurationRequired === true;
  const web = isWeb();
  const configureUrl = manifestToConfigureUrl(resolved.transportUrl);
  const stremioShareUrl = manifestToShareUrl(resolved.transportUrl, "stremio");

  const [copied, setCopied] = useState<"https" | "stremio" | null>(null);
  const [busy, setBusy] = useState<"install" | "remove" | null>(null);
  const [optimisticInstalled, setOptimisticInstalled] = useState<boolean | null>(null);
  const [manifestVisible, setManifestVisible] = useState(false);
  const community = useCommunity(m?.id);
  const rising = useRising();
  const risingEntry = community ? risingEntryFor(rising, community) : null;
  const openRate = () => {
    if (!community) return;
    openUrl(rateOnSiteUrl(community.slug));
    showToast("ok", t("Opening stremio-addons.net in your browser to sign in and rate"));
  };

  useEffect(() => {
    setActiveAddon({ id: idOf(resolved), name: nameOf(resolved) });
    return () => setActiveAddon(null);
  }, [resolved]);

  const maskedManifestUrl = (() => {
    try {
      const u = new URL(resolved.transportUrl);
      return `${u.protocol}//${u.hostname}/…/manifest.json`;
    } catch {
      return "••••••••••••••••";
    }
  })();

  useEffect(() => {
    if (optimisticInstalled === null) return;
    if (resolved.installed === optimisticInstalled) setOptimisticInstalled(null);
  }, [resolved.installed, optimisticInstalled]);

  useEffect(() => {
    const addonName = nameOf(resolved);
    if (isAdultAddon(resolved))
      return pushActivityHint({ details: "Browsing the addon store", state: "Stremio addons" });
    const rawLogo = resolveAddonLogo(m?.logo, resolved.transportUrl);
    const largeImage = rawLogo && rawLogo.startsWith("https://") ? rawLogo : undefined;
    const shared = { largeImage, largeText: addonName };
    const hint =
      busy === "install"
        ? { details: `Installing ${addonName}`, ...shared }
        : { details: `Browsing ${addonName}`, state: "Stremio addon", ...shared };
    return pushActivityHint(hint);
  }, [resolved, m?.logo, busy]);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ id?: string; installed?: boolean }>).detail;
      if (!detail?.id) return;
      if (detail.id !== m?.id) return;
      if (typeof detail.installed === "boolean") setOptimisticInstalled(detail.installed);
    };
    window.addEventListener("harbor:addons-changed", onChange);
    return () => window.removeEventListener("harbor:addons-changed", onChange);
  }, [m?.id]);

  const installed = optimisticInstalled !== null ? optimisticInstalled : resolved.installed;

  const handleInstall = async () => {
    if (busy) return;
    setBusy("install");
    setOptimisticInstalled(true);
    try {
      // A falsy result means nothing was installed (a failed fetch, or the
      // addon was routed to configuration instead). Drop the optimistic flag
      // so the button doesn't claim an install that never happened.
      if (!(await onInstall())) setOptimisticInstalled(null);
    } catch {
      setOptimisticInstalled(null);
    } finally {
      setBusy(null);
    }
  };

  const handleUninstall = async () => {
    if (busy) return;
    setBusy("remove");
    setOptimisticInstalled(false);
    try {
      await onUninstall();
    } catch {
      setOptimisticInstalled(null);
    } finally {
      setBusy(null);
    }
  };

  const stats: Array<[string, string]> = [
    [t("Version"), m?.version ?? "–"],
    [t("Resources"), resourceLabels(m?.resources ?? []).join(", ") || "–"],
    [t("Types"), (m?.types ?? []).join(", ") || "–"],
    [t("ID prefixes"), (m?.idPrefixes ?? []).slice(0, 3).join(", ") || "–"],
    [t("Catalogs"), String(m?.catalogs?.length ?? 0)],
    [t("P2P"), m?.behaviorHints?.p2p ? t("Yes") : t("No")],
  ];

  const copy = async (kind: "https" | "stremio") => {
    const text = kind === "stremio" ? stremioShareUrl : resolved.transportUrl;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
      showToast("ok", kind === "stremio" ? t("Stremio link copied") : t("Manifest URL copied"));
    } catch {
      showToast("error", t("Couldn't copy. Select the URL manually."));
    }
  };

  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [resolved.transportUrl]);

  return (
    <main ref={mainRef} className="h-full overflow-y-auto px-12 pb-0 pt-24">
      <header className="relative isolate -mx-12 -mt-24 flex min-h-[460px] items-start gap-10 px-12 pt-32 pb-10">
        <DetailHeaderBackdrop
          logo={resolveAddonLogo(m?.logo, resolved.transportUrl) ?? undefined}
          background={m?.background ?? undefined}
        />
        <div className="relative shrink-0">
          <AddonLogo
            addonId={idOf(resolved)}
            addonName={nameOf(resolved)}
            manifestLogo={resolveAddonLogo(m?.logo, resolved.transportUrl)}
            size="4xl"
          />
        </div>
        {community && (
          <button
            type="button"
            onClick={openRate}
            className="absolute end-12 top-32 flex items-baseline gap-2 leading-none transition-opacity hover:opacity-80"
            title={t("Rate on stremio-addons.net")}
          >
            <Star
              size={22}
              strokeWidth={2.4}
              fill="currentColor"
              className="text-accent harbor-rating-star"
            />
            <span className="text-[32px] font-semibold tabular-nums leading-none text-ink">
              {community.stars.toLocaleString()}
            </span>
          </button>
        )}
        <div className="relative flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-ink-subtle">
            {c?.tags.includes("official") ? t("Official") : t("Community")} ·{" "}
            {categoryLabel(c?.category ?? categorizeAddon(resolved)) ?? t("Addon")}
            {m?.id && (
              <>
                {" "}
                · <span className="font-mono normal-case tracking-normal">{m.id}</span>
              </>
            )}
          </span>
          <h1 className="font-display text-[36px] font-medium leading-tight tracking-tight text-ink">
            {nameOf(resolved)}
          </h1>
          {risingEntry && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-300 ring-1 ring-rose-500/40">
              <TrendingUp size={12} strokeWidth={2.6} />
              {risingEntry.recentStars === 1
                ? t("Rising · +{n} star in 24h", { n: risingEntry.recentStars })
                : t("Rising · +{n} stars in 24h", { n: risingEntry.recentStars })}
            </span>
          )}
          {m?.description && <AddonDescription text={m.description} />}
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {busy === "remove" ? (
              <button
                disabled
                className="flex h-11 items-center gap-2 rounded-full bg-elevated/60 px-5 text-[13.5px] font-semibold text-ink-muted ring-1 ring-edge-soft"
              >
                <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
                {t("Removing")}
              </button>
            ) : busy === "install" ? (
              <button
                disabled
                className="flex h-11 items-center gap-2 rounded-full bg-ink/85 px-5 text-[13.5px] font-semibold text-canvas/80"
              >
                <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
                {t("Installing")}
              </button>
            ) : installed ? (
              <button
                onClick={() => void handleUninstall()}
                className="group/pill flex h-11 items-center gap-2 rounded-full bg-elevated/70 px-5 text-[13.5px] font-semibold text-ink ring-1 ring-edge-soft transition-colors hover:bg-danger/15 hover:text-danger hover:ring-danger/30"
              >
                <Check
                  size={14}
                  strokeWidth={2.4}
                  className="block text-accent group-hover/pill:hidden"
                />
                <Trash2 size={14} strokeWidth={2.2} className="hidden group-hover/pill:block" />
                <span className="block group-hover/pill:hidden">{t("Installed")}</span>
                <span className="hidden group-hover/pill:block">{t("Remove")}</span>
              </button>
            ) : isConfigurable ? (
              <button
                onClick={() =>
                  openInstallerViewport(
                    configureUrl,
                    nameOf(resolved),
                    resolveAddonLogo(m?.logo, resolved.transportUrl),
                  )
                }
                className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
              >
                <Settings2 size={14} strokeWidth={2.2} />
                {t("Configure & install")}
              </button>
            ) : (
              <button
                onClick={() => void handleInstall()}
                className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
              >
                {t("Install")}
              </button>
            )}
            {!installed && isConfigurable && !busy && !web && (
              <button
                onClick={() => void handleInstall()}
                className="flex h-11 items-center gap-2 rounded-full border border-edge-soft px-5 text-[13.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                {t("Install default")}
              </button>
            )}
            {installed && isConfigurable && !busy && (
              <button
                onClick={() =>
                  openInstallerViewport(
                    configureUrl,
                    nameOf(resolved),
                    resolveAddonLogo(m?.logo, resolved.transportUrl),
                  )
                }
                className="flex h-11 items-center gap-2 rounded-full border border-edge-soft px-5 text-[13.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                <Settings2 size={14} strokeWidth={2.2} />
                {t("Reconfigure")}
              </button>
            )}
            <button
              onClick={() => copy("https")}
              className="flex h-11 items-center gap-2 rounded-full border border-edge-soft px-5 text-[13.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
            >
              {copied === "https" ? (
                <Check size={14} strokeWidth={2.4} />
              ) : (
                <Copy size={14} strokeWidth={2.2} />
              )}
              {copied === "https" ? t("Copied") : t("Copy URL")}
            </button>
            <button
              onClick={() => copy("stremio")}
              className="flex h-11 items-center gap-2 rounded-full border border-edge-soft px-5 text-[13.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
            >
              {copied === "stremio" ? (
                <Check size={14} strokeWidth={2.4} />
              ) : (
                <ExternalLink size={14} strokeWidth={2.2} />
              )}
              {copied === "stremio" ? t("Copied") : t("stremio:// link")}
            </button>
            {community && (
              <>
                <span className="mx-1 h-6 w-px shrink-0 bg-edge-soft" aria-hidden />
                <button
                  onClick={openRate}
                  className="flex h-11 items-center gap-2 rounded-full border border-accent/40 bg-accent-soft px-5 text-[13.5px] font-semibold text-accent transition-colors hover:border-accent hover:bg-accent-soft/80"
                >
                  <Star
                    size={14}
                    strokeWidth={2.4}
                    fill="currentColor"
                    className="harbor-rating-star"
                  />
                  {t("Rate")}
                </button>
                <button
                  onClick={() => openUrl(addonSiteUrl(community.slug))}
                  className="flex h-11 items-center gap-2 rounded-full border border-edge-soft ps-2 pe-5 text-[13.5px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
                >
                  <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-canvas ring-1 ring-edge-soft">
                    <img
                      src="https://stremio-addons.net/favicon.ico"
                      alt=""
                      draggable={false}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </span>
                  {t("On Stremio-Addons")}
                </button>
              </>
            )}
          </div>
          <TagRow resolved={resolved} />
        </div>
      </header>

      {c?.warnings && c.warnings.length > 0 && (
        <section className="mt-8 rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] p-5">
          <h3 className="text-[13.5px] font-semibold text-amber-200">{t("Worth knowing")}</h3>
          <ul className="mt-2 ms-1 list-disc ps-4 text-[13px] text-ink-muted">
            {c.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="-mx-12 bg-elevated/15 px-12 py-12">
        <div className="mx-auto max-w-5xl">
          {community?.slug && <AddonDocumentation slug={community.slug} />}
          <div className="mb-8 flex items-baseline justify-between gap-4">
            <h2 className="font-display text-[22px] font-medium tracking-tight text-ink">
              {t("Project information")}
            </h2>
            <span className="text-[10.5px] uppercase tracking-[0.22em] text-ink-subtle">
              {t("Pulled from manifest")}
            </span>
          </div>
          <div className="grid gap-12 md:grid-cols-[1.1fr_1fr]">
            <dl className="border-y border-edge-soft">
              {stats.map(([label, value], i) => (
                <div
                  key={label}
                  className={`flex items-baseline justify-between gap-6 py-3 ${
                    i < stats.length - 1 ? "border-b border-edge-soft" : ""
                  }`}
                >
                  <dt className="text-[12px] uppercase tracking-[0.16em] text-ink-subtle">
                    {label}
                  </dt>
                  <dd className="truncate text-end text-[13.5px] font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] uppercase tracking-[0.16em] text-ink-subtle">
                  {t("Manifest URL")}
                </span>
                <div className="flex items-center gap-1.5">
                  {manifestVisible && (
                    <button
                      type="button"
                      onClick={() => void copy("https")}
                      className="flex h-7 items-center gap-1.5 rounded-full border border-edge-soft px-2.5 text-[11px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
                    >
                      {copied === "https" ? (
                        <Check size={11} strokeWidth={2.6} />
                      ) : (
                        <Copy size={11} strokeWidth={2.4} />
                      )}
                      {copied === "https" ? t("Copied") : t("Copy")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setManifestVisible((v) => !v)}
                    className="flex h-7 items-center gap-1.5 rounded-full border border-edge-soft px-2.5 text-[11px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
                    title={
                      manifestVisible
                        ? t("Hide the full URL")
                        : t("URLs can carry debrid keys or tokens; reveal when you need to copy")
                    }
                  >
                    {manifestVisible ? (
                      <EyeOff size={11} strokeWidth={2.4} />
                    ) : (
                      <Eye size={11} strokeWidth={2.4} />
                    )}
                    {manifestVisible ? t("Hide") : t("Reveal")}
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-edge-soft bg-canvas/60 p-4">
                <p className="break-all font-mono text-[12.5px] leading-relaxed text-ink-muted">
                  {manifestVisible ? resolved.transportUrl : maskedManifestUrl}
                </p>
              </div>
              {!manifestVisible && (
                <p className="text-[11.5px] leading-relaxed text-ink-subtle">
                  {t(
                    "Hidden by default. Manifest paths often carry API keys (debrid tokens, OMDB keys, etc.) you don't want over a shoulder.",
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center gap-2 border-t border-edge-soft pt-6 text-center">
            <p className="text-[12px] text-ink-subtle">
              {t("Stremio addon, packaged into Harbor's catalog.")}
            </p>
            <p className="text-[11.5px] leading-relaxed text-ink-subtle">
              {t(
                "Version and capabilities come straight from the addon's manifest. Ratings and categories come from the",
              )}{" "}
              <button
                type="button"
                onClick={() => openUrl("https://stremio-addons.net")}
                className="inline-flex items-baseline gap-1 font-semibold text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
              >
                stremio-addons.net
              </button>{" "}
              {t("community API. Star, browse, and contribute on their site.")}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl pb-20">
        <DetailRail
          title={t("More like this")}
          items={related}
          installedIds={installedIds}
          onOpen={onOpen}
          onInstall={onInstallAddon}
        />
        <DetailRail
          title={t("Recommended for you")}
          items={recommended}
          installedIds={installedIds}
          onOpen={onOpen}
          onInstall={onInstallAddon}
        />
      </div>
    </main>
  );
}

function DetailHeaderBackdrop({
  logo,
  background,
}: {
  logo: string | undefined;
  background: string | undefined;
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, var(--color-elevated) 0%, var(--color-canvas) 65%, var(--color-canvas) 100%)",
        }}
      />
      {background && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${background})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.55,
          }}
        />
      )}
      {logo && !background && (
        <div
          className="absolute -inset-20"
          style={{
            backgroundImage: `url(${logo})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(70px) saturate(1.5)",
            opacity: 0.28,
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: background
            ? "linear-gradient(95deg, var(--color-canvas) 0%, color-mix(in oklch, var(--color-canvas) 88%, transparent) 38%, color-mix(in oklch, var(--color-canvas) 60%, transparent) 62%, color-mix(in oklch, var(--color-canvas) 30%, transparent) 100%)"
            : "linear-gradient(180deg, color-mix(in oklch, var(--color-canvas) 0%, transparent) 0%, color-mix(in oklch, var(--color-canvas) 24%, transparent) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, transparent 70%, color-mix(in oklch, var(--color-canvas) 28%, transparent) 100%)",
        }}
      />
    </div>
  );
}
