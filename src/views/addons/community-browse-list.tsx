import { ChevronRight, Loader2, Plus, Sparkles, Star, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AddonLogo, resolveAddonLogo } from "@/components/addon-logo";
import { CardArtBackdrop } from "@/components/card-art-backdrop";
import { installAddon, manifestToConfigureUrl } from "@/lib/addon-store";
import { openInstallerViewport } from "@/components/installer-viewport";
import {
  listAddons,
  risingEntryFor,
  useRising,
  type SAAddon,
} from "@/lib/providers/stremio-addons";
import { useTopMovers } from "@/lib/providers/stremio-addons-velocity";
import { openUrl } from "@/lib/window";
import { useT } from "@/lib/i18n";

export type BrowseMode = "top" | "new" | "rising";

const NEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function CommunityBrowseList({
  mode,
  category,
  search,
  allowAdult,
  installedIds,
  onOpen,
  onChange,
}: {
  mode: BrowseMode;
  category?: string | null;
  search?: string | null;
  allowAdult?: boolean;
  installedIds: Set<string>;
  onOpen: (manifestId: string) => void;
  onChange?: () => void;
}) {
  if (mode === "rising")
    return (
      <RisingList
        category={category ?? null}
        search={search ?? null}
        allowAdult={!!allowAdult}
        installedIds={installedIds}
        onOpen={onOpen}
        onChange={onChange}
      />
    );
  return (
    <ApiSortedList
      mode={mode}
      category={category ?? null}
      search={search ?? null}
      allowAdult={!!allowAdult}
      installedIds={installedIds}
      onOpen={onOpen}
      onChange={onChange}
    />
  );
}

function ApiSortedList({
  mode,
  category,
  search,
  allowAdult,
  installedIds,
  onOpen,
  onChange,
}: {
  mode: "top" | "new";
  category: string | null;
  search: string | null;
  allowAdult: boolean;
  installedIds: Set<string>;
  onOpen: (manifestId: string) => void;
  onChange?: () => void;
}) {
  const t = useT();
  const [items, setItems] = useState<SAAddon[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [exhausted, setExhausted] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const rising = useRising();

  useEffect(() => {
    seenRef.current = new Set();
    setItems([]);
    setPage(1);
    setExhausted(false);
  }, [mode, category, search, allowAdult]);

  const loadMore = useCallback(async () => {
    if (loading || exhausted) return;
    setLoading(true);
    try {
      const res = await listAddons({
        page,
        limit: 50,
        sort_by: mode === "top" ? "stars" : "createdAt",
        order: "desc",
        ...(allowAdult || category === "nsfw" ? {} : { nsfw: "exclude" as const }),
        ...(category ? { category } : {}),
        ...(search ? { search } : {}),
      });
      const fresh = res.addons.filter((a) => {
        if (seenRef.current.has(a.uuid)) return false;
        seenRef.current.add(a.uuid);
        return true;
      });
      setItems((prev) => [...prev, ...fresh]);
      if (!res.pagination.hasNextPage) setExhausted(true);
      else setPage((p) => p + 1);
    } catch {
      setExhausted(true);
    } finally {
      setLoading(false);
    }
  }, [mode, page, loading, exhausted, category, search, allowAdult]);

  useEffect(() => {
    if (items.length === 0 && !loading && !exhausted) void loadMore();
  }, [items.length, loading, exhausted, loadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || exhausted) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, exhausted, items.length]);

  return (
    <div className="flex flex-col gap-2">
      {items.map((a) => {
        const r = risingEntryFor(rising, a);
        return (
          <CommunityRow
            key={a.uuid}
            addon={a}
            installed={isInstalled(a, installedIds)}
            showRising={r != null}
            risingDelta={r?.recentStars}
            risingWindow={1}
            showNew={mode === "new" && isNewlyAdded(a.createdAt)}
            onOpen={onOpen}
            onChange={onChange}
          />
        );
      })}
      {items.length === 0 && loading && <SkeletonRows />}
      <div ref={sentinelRef} className="h-px w-full" aria-hidden />
      {loading && items.length > 0 && (
        <div className="flex items-center justify-center py-4 text-ink-subtle">
          <Loader2 size={18} className="animate-spin" />
        </div>
      )}
      {exhausted && items.length > 0 && (
        <p className="pt-3 text-center text-[11.5px] text-ink-subtle">
          {t("You've reached the end · {n} addons", { n: items.length })}
        </p>
      )}
    </div>
  );
}

function RisingList({
  category,
  search,
  allowAdult,
  installedIds,
  onOpen,
  onChange,
}: {
  category: string | null;
  search: string | null;
  allowAdult: boolean;
  installedIds: Set<string>;
  onOpen: (manifestId: string) => void;
  onChange?: () => void;
}) {
  const t = useT();
  const official = useRising();
  const allMovers = useTopMovers(80);
  const q = search?.trim().toLowerCase() ?? "";
  const officialFiltered = official.filter((a) => {
    if (!allowAdult && category !== "nsfw") {
      const bh = (a.manifest as { behaviorHints?: { adult?: boolean } } | undefined)?.behaviorHints;
      if (bh?.adult) return false;
    }
    if (category && !a.categories.some((c) => c.slug === category)) return false;
    if (q) {
      const m = a.manifest as { name?: string; description?: string } | undefined;
      const name = (m?.name ?? "").toLowerCase();
      const desc = (m?.description ?? "").toLowerCase();
      if (!name.includes(q) && !a.slug.toLowerCase().includes(q) && !desc.includes(q)) return false;
    }
    return true;
  });
  if (officialFiltered.length > 0) {
    return (
      <div className="flex flex-col gap-2">
        {officialFiltered.map((a) => (
          <CommunityRow
            key={a.uuid}
            addon={a}
            installed={isInstalled(a, installedIds)}
            showRising
            risingDelta={a.recentStars}
            risingWindow={1}
            onOpen={onOpen}
            onChange={onChange}
          />
        ))}
      </div>
    );
  }
  const movers = allMovers.filter((m) => {
    if (category && !m.community.categories.some((c) => c.slug === category)) return false;
    if (q) {
      const name = (m.community.name ?? "").toLowerCase();
      const slug = m.community.slug.toLowerCase();
      const desc = (m.community.description ?? "").toLowerCase();
      if (!name.includes(q) && !slug.includes(q) && !desc.includes(q)) return false;
    }
    return true;
  });
  if (movers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-edge bg-canvas/30 px-6 py-12 text-center">
        <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 ring-1 ring-rose-500/30">
          <TrendingUp size={20} strokeWidth={2.4} className="text-rose-300" />
        </span>
        <p className="font-display text-[18px] font-medium text-ink">{t("No velocity data yet")}</p>
        <p className="mt-1.5 text-[12.5px] text-ink-muted">
          {t(
            "Trending tracks star growth across your Harbor visits. Open the addons page again tomorrow and the top risers will appear here.",
          )}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {movers.map((m) => {
        const synthetic = {
          uuid: m.community.uuid,
          slug: m.community.slug,
          url: m.community.url,
          manifestUrl: m.community.manifestUrl,
          manifest: {
            id: m.community.manifestId ?? "",
            name: m.community.name ?? m.community.slug,
            description: m.community.description ?? "",
            logo: m.community.logo,
            background: m.community.background,
          },
          stars: m.community.stars,
          categories: m.community.categories,
          configureUrl: null,
          createdAt: m.community.createdAt,
          updatedAt: m.community.updatedAt,
        } as unknown as SAAddon;
        return (
          <CommunityRow
            key={m.community.uuid}
            addon={synthetic}
            installed={isInstalled(synthetic, installedIds)}
            showRising
            risingDelta={m.delta}
            risingWindow={m.windowDays}
            onOpen={onOpen}
            onChange={onChange}
          />
        );
      })}
    </div>
  );
}

function CommunityRow({
  addon,
  installed,
  showRising,
  showNew,
  risingDelta,
  risingWindow,
  onOpen,
  onChange,
}: {
  addon: SAAddon;
  installed: boolean;
  showRising: boolean;
  showNew?: boolean;
  risingDelta?: number;
  risingWindow?: number;
  onOpen: (manifestId: string) => void;
  onChange?: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const m = addon.manifest;
  const name = m?.name ?? addon.slug;
  const description = m?.description ?? "";
  const logo = resolveAddonLogo(m?.logo, addon.manifestUrl);

  const open = () => {
    if (m?.id) onOpen(m.id);
    else openUrl(addon.url);
  };
  const install = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!m?.id || busy) return;
    const hints = (
      m as { behaviorHints?: { configurable?: boolean; configurationRequired?: boolean } }
    ).behaviorHints;
    if (hints?.configurable === true || hints?.configurationRequired === true) {
      openInstallerViewport(manifestToConfigureUrl(addon.manifestUrl), name, logo);
      return;
    }
    setBusy(true);
    try {
      await installAddon(m.id, addon.manifestUrl);
      onChange?.();
    } catch (err) {
      console.warn("[community-browse] install failed", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open()}
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 116px" }}
      className="group relative flex cursor-pointer items-start gap-5 overflow-hidden rounded-2xl border border-edge-soft bg-elevated px-5 py-5 text-start transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-edge hover:shadow-[0_18px_36px_-22px_rgba(0,0,0,0.4)]"
    >
      <CardArtBackdrop logo={logo} background={m?.background} />
      <AddonLogo addonId={m?.id ?? addon.slug} addonName={name} manifestLogo={logo} size="tile" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[16px] font-semibold text-ink">{name}</span>
          {addon.stars > 0 && (
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-canvas/70 px-1.5 text-[10.5px] font-bold text-accent ring-1 ring-accent/30 backdrop-blur-sm">
              <Star size={9} strokeWidth={2.6} fill="currentColor" className="harbor-rating-star" />
              {addon.stars.toLocaleString()}
            </span>
          )}
          {showRising && risingDelta != null && (
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-rose-500/15 px-1.5 text-[10.5px] font-bold text-rose-300 ring-1 ring-rose-500/40">
              <TrendingUp size={9} strokeWidth={2.6} />+{risingDelta}
              {risingWindow != null && (
                <span className="ms-0.5 font-medium text-rose-300/70">
                  / {risingWindow === 1 ? "24h" : `${risingWindow}d`}
                </span>
              )}
            </span>
          )}
          {showNew && (
            <span className="inline-flex h-5 items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300 ring-1 ring-emerald-500/30">
              <Sparkles size={9} strokeWidth={2.6} />
              {t("New")}
            </span>
          )}
        </div>
        <p className="line-clamp-3 text-[13.5px] leading-relaxed text-ink-muted">{description}</p>
      </div>
      <div className="relative flex shrink-0 items-center gap-2">
        {!installed && m?.id && (
          <button
            type="button"
            onClick={install}
            disabled={busy}
            className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 size={12} strokeWidth={2.6} className="animate-spin" />
            ) : (
              <Plus size={12} strokeWidth={2.6} />
            )}
            {t("Install")}
          </button>
        )}
        {installed && (
          <span className="flex h-9 items-center gap-1 rounded-full bg-accent/15 px-3 text-[12.5px] font-semibold text-accent">
            {t("Installed")}
          </span>
        )}
        <ChevronRight size={16} className="dir-icon text-ink-subtle" />
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-[112px] w-full animate-pulse rounded-2xl border border-edge-soft bg-elevated/40"
        />
      ))}
    </>
  );
}

function isInstalled(a: SAAddon, set: Set<string>): boolean {
  const id = a.manifest?.id;
  return !!id && set.has(id);
}

function isNewlyAdded(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  return Number.isFinite(t) && Date.now() - t < NEW_WINDOW_MS;
}
