import { ArrowUpRight, Check, Loader2, Plus, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import stremioAddonsLogo from "@/assets/stremio-addons-net.png";
import { ArrowedScrollRow } from "@/components/arrowed-scroll-row";
import { addonSiteUrl, listAddons, type SAAddon } from "@/lib/providers/stremio-addons";
import { fetchManifestAt, installAddon, manifestToConfigureUrl } from "@/lib/addon-store";
import { openInstallerViewport } from "@/components/installer-viewport";
import { openUrl } from "@/lib/window";

const SITE_NAME = "stremio-addons.net";
const SITE_URL = "https://stremio-addons.net";

type SortMode = "stars" | "createdAt";

const TABS: Array<{ id: SortMode; label: string; sub: string }> = [
  { id: "stars", label: "Top rated", sub: "Highest community stars" },
  { id: "createdAt", label: "Just added", sub: "Newest manifests" },
];

export function CommunityAddonsRail({
  installedIds,
  onChange,
  onOpen,
}: {
  installedIds: Set<string>;
  onChange?: () => void;
  onOpen?: (manifestId: string) => void;
}) {
  const [sortMode, setSortMode] = useState<SortMode>("stars");
  const [items, setItems] = useState<SAAddon[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    listAddons({
      limit: 24,
      sort_by: sortMode,
      order: "desc",
      nsfw: "exclude",
    })
      .then((r) => {
        if (cancelled) return;
        setItems(r.addons);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Couldn't reach stremio-addons.net");
      });
    return () => {
      cancelled = true;
    };
  }, [sortMode]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => openUrl(SITE_URL)}
            aria-label={`Open ${SITE_NAME}`}
            className="group/logo relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-1 ring-edge-soft transition-all hover:-translate-y-0.5 hover:ring-2 hover:ring-accent/50 hover:shadow-[0_12px_28px_-12px_var(--color-accent-soft)]"
          >
            <img
              src={stremioAddonsLogo}
              alt={SITE_NAME}
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </button>
          <div className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-accent">
              Community ratings
            </span>
            <h3 className="text-[24px] font-medium tracking-tight text-ink">
              Top on{" "}
              <button
                type="button"
                onClick={() => openUrl(SITE_URL)}
                className="font-semibold text-ink underline decoration-accent/60 decoration-2 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
              >
                {SITE_NAME}
              </button>
            </h3>
            <p className="max-w-[52ch] text-[12.5px] text-ink-muted">
              Ranked by the {SITE_NAME} community from their public index.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TabBar value={sortMode} onChange={setSortMode} />
          <button
            type="button"
            onClick={() => openUrl(SITE_URL)}
            className="flex h-9 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            <ArrowUpRight size={12} strokeWidth={2.4} className="dir-icon" />
            Browse all
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : items === null ? (
        <SkeletonRow />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <RailScroller
          items={items}
          installedIds={installedIds}
          onChange={onChange}
          onOpen={onOpen}
        />
      )}
    </section>
  );
}

function TabBar({ value, onChange }: { value: SortMode; onChange: (v: SortMode) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-edge-soft bg-canvas/40 p-1">
      {TABS.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            title={t.sub}
            className={`h-8 rounded-full px-3 text-[12px] font-semibold transition-colors ${
              active ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function RailScroller({
  items,
  installedIds,
  onChange,
  onOpen,
}: {
  items: SAAddon[];
  installedIds: Set<string>;
  onChange?: () => void;
  onOpen?: (manifestId: string) => void;
}) {
  return (
    <ArrowedScrollRow className="-mx-1">
      {items.map((a) => (
        <CommunityCard
          key={a.uuid}
          addon={a}
          installed={isInstalled(a, installedIds)}
          onChange={onChange}
          onOpen={onOpen}
        />
      ))}
    </ArrowedScrollRow>
  );
}

function isInstalled(a: SAAddon, installedIds: Set<string>): boolean {
  const id = a.manifest?.id;
  if (!id) return false;
  return installedIds.has(id);
}

function CommunityCard({
  addon,
  installed,
  onChange,
  onOpen,
}: {
  addon: SAAddon;
  installed: boolean;
  onChange?: () => void;
  onOpen?: (manifestId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const m = addon.manifest;
  const name = m?.name ?? addon.slug;
  const description = m?.description ?? "";
  const logo = m?.logo;
  const background = m?.background;
  const types = useMemo(() => {
    const list = Array.isArray(m?.types) ? m!.types! : [];
    return list.slice(0, 3);
  }, [m?.types]);

  const install = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!m?.id || busy) return;
    setBusy(true);
    try {
      let hints = (
        m as { behaviorHints?: { configurable?: boolean; configurationRequired?: boolean } }
      ).behaviorHints;
      if (!hints) {
        const full = await fetchManifestAt(addon.manifestUrl).catch(() => null);
        hints = full?.behaviorHints;
      }
      if (hints?.configurable === true || hints?.configurationRequired === true) {
        openInstallerViewport(manifestToConfigureUrl(addon.manifestUrl), name, logo ?? null);
        return;
      }
      await installAddon(m.id, addon.manifestUrl);
      onChange?.();
    } catch (err) {
      console.warn("[community-rail] install failed", err);
    } finally {
      setBusy(false);
    }
  };

  const openDetail = () => {
    if (m?.id && onOpen) onOpen(m.id);
    else openUrl(addonSiteUrl(addon.slug));
  };
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={openDetail}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openDetail()}
      style={{ contentVisibility: "auto", containIntrinsicSize: "280px 244px" }}
      className="group relative flex w-[280px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-edge-soft bg-surface transition-all hover:-translate-y-0.5 hover:border-edge hover:shadow-[0_18px_40px_-22px_rgba(0,0,0,0.35)]"
    >
      <div
        className="relative h-24 w-full"
        style={
          background
            ? {
                backgroundImage: `url(${background})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : { background: "linear-gradient(135deg, var(--color-elevated), var(--color-raised))" }
        }
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
        <div className="absolute end-2.5 top-2.5 flex items-center gap-1 rounded-full bg-canvas/70 px-2 py-0.5 text-[11px] font-bold text-accent ring-1 ring-accent/30 backdrop-blur-sm">
          <Star size={10} strokeWidth={2.6} fill="currentColor" className="harbor-rating-star" />
          {addon.stars.toLocaleString()}
        </div>
        {logo && (
          <img
            src={logo}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            className="absolute bottom-2.5 start-2.5 h-10 w-10 rounded-lg bg-canvas/80 object-contain p-1 ring-1 ring-edge-soft"
          />
        )}
      </div>
      <div className="flex min-h-[120px] flex-1 flex-col gap-2 px-3.5 py-3">
        <div className="flex min-w-0 flex-col">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openUrl(addonSiteUrl(addon.slug));
            }}
            className="text-start text-[14px] font-semibold leading-tight text-ink transition-colors hover:text-accent hover:underline hover:underline-offset-4"
            title={`Open ${name} on ${SITE_NAME}`}
          >
            {name}
          </button>
          {description && (
            <span className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink-subtle">
              {description}
            </span>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {types.map((t) => (
              <span
                key={t}
                className="rounded-full bg-elevated/60 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle"
              >
                {t}
              </span>
            ))}
          </div>
          {installed ? (
            <span className="flex h-8 items-center gap-1 rounded-full bg-accent/15 px-2.5 text-[11.5px] font-semibold text-accent">
              <Check size={11} strokeWidth={2.6} />
              Installed
            </span>
          ) : (
            <button
              type="button"
              onClick={install}
              disabled={busy || !m?.id}
              className="flex h-8 items-center gap-1 rounded-full bg-ink px-2.5 text-[11.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 size={11} strokeWidth={2.6} className="animate-spin" />
              ) : (
                <Plus size={11} strokeWidth={2.6} />
              )}
              Install
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function SkeletonRow() {
  return (
    <div className="-mx-1 flex gap-3 overflow-hidden px-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-[244px] w-[280px] shrink-0 animate-pulse rounded-2xl border border-edge-soft bg-elevated/30"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <p className="rounded-xl border border-dashed border-edge bg-canvas/30 px-4 py-6 text-center text-[12.5px] text-ink-subtle">
      No addons match these filters right now.
    </p>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-edge bg-canvas/30 px-4 py-6 text-center text-[12.5px] text-ink-subtle">
      {SITE_NAME} should be reachable in a moment. They're deploying right now. Refresh once their
      docs go live.
      <br />
      <span className="text-[10.5px] opacity-70">({message})</span>
    </p>
  );
}
