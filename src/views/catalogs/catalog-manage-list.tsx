import { useMemo, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Home, Pin, PinOff } from "lucide-react";
import type { BrowseCatalog } from "@/lib/catalog-browse";
import { togglePinnedCatalog, useIsPinned } from "@/lib/pinned-catalogs";
import { useT } from "@/lib/i18n";
import type { AddonGroup } from "./use-catalog-list";

const TYPE_LABELS: Record<string, string> = {
  movie: "Movies",
  series: "Series",
  anime: "Anime",
  tv: "TV",
  channel: "Channels",
};

export function CatalogManageList({
  filtered,
  pinnedCats,
  pinnedSet,
  hiddenSet,
  onTogglePin,
  onToggleHide,
  onMovePin,
}: {
  filtered: BrowseCatalog[];
  pinnedCats: BrowseCatalog[];
  pinnedSet: Set<string>;
  hiddenSet: Set<string>;
  onTogglePin: (key: string) => void;
  onToggleHide: (key: string) => void;
  onMovePin: (key: string, dir: -1 | 1) => void;
}) {
  const t = useT();
  const rest = useMemo<AddonGroup[]>(() => {
    const m = new Map<string, AddonGroup>();
    for (const c of filtered) {
      if (pinnedSet.has(c.key)) continue;
      let g = m.get(c.addonName);
      if (!g) {
        g = { name: c.addonName, logo: c.addonLogo, cats: [] };
        m.set(c.addonName, g);
      }
      g.cats.push(c);
    }
    return [...m.values()];
  }, [filtered, pinnedSet]);

  return (
    <div className="flex flex-col gap-8">
      <p className="rounded-2xl border border-edge-soft bg-elevated/25 px-5 py-3.5 text-[13px] leading-relaxed text-ink-muted">
        {t(
          "Pin the catalogs you want up top, hide the ones you never open, and reorder your pinned rails. Your browse view updates instantly.",
        )}
      </p>

      {pinnedCats.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-ink-subtle">
            <Pin size={13} className="text-accent" />
            {t("Pinned to top")}
          </h2>
          <div className="flex flex-col gap-1.5">
            {pinnedCats.map((c, i) => (
              <ManageRow
                key={c.key}
                catalog={c}
                pinned
                hidden={hiddenSet.has(c.key)}
                onTogglePin={() => onTogglePin(c.key)}
                onToggleHide={() => onToggleHide(c.key)}
                moveUp={i > 0 ? () => onMovePin(c.key, -1) : undefined}
                moveDown={i < pinnedCats.length - 1 ? () => onMovePin(c.key, 1) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {rest.map((g) => (
        <section key={g.name} className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-ink-subtle">
            {g.logo ? (
              <img
                src={g.logo}
                alt=""
                draggable={false}
                className="h-4 w-4 rounded-[4px] object-contain"
              />
            ) : null}
            {g.name}
          </h2>
          <div className="flex flex-col gap-1.5">
            {g.cats.map((c) => (
              <ManageRow
                key={c.key}
                catalog={c}
                pinned={false}
                hidden={hiddenSet.has(c.key)}
                onTogglePin={() => onTogglePin(c.key)}
                onToggleHide={() => onToggleHide(c.key)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ManageRow({
  catalog,
  pinned,
  hidden,
  onTogglePin,
  onToggleHide,
  moveUp,
  moveDown,
}: {
  catalog: BrowseCatalog;
  pinned: boolean;
  hidden: boolean;
  onTogglePin: () => void;
  onToggleHide: () => void;
  moveUp?: () => void;
  moveDown?: () => void;
}) {
  const t = useT();
  const pinnedHome = useIsPinned(catalog.key);
  const toggleHome = () =>
    togglePinnedCatalog({
      id: catalog.key,
      source: "catalog",
      name: catalog.name,
      params: { base: catalog.base, type: catalog.type, id: catalog.id },
    });
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-edge-soft bg-elevated/25 py-2.5 pe-2.5 ps-3.5 transition-opacity ${
        hidden ? "opacity-45" : ""
      }`}
    >
      {catalog.addonLogo ? (
        <img
          src={catalog.addonLogo}
          alt=""
          draggable={false}
          className="h-7 w-7 shrink-0 rounded-[6px] object-contain"
        />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-canvas text-[11px] font-bold text-ink-subtle ring-1 ring-edge-soft">
          {catalog.addonName.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-ink">{catalog.name}</div>
        <div className="truncate text-[12px] text-ink-subtle">
          {catalog.addonName} · {t(TYPE_LABELS[catalog.type] ?? catalog.type)}
        </div>
      </div>

      {pinned && (
        <div className="flex items-center">
          <IconBtn label={t("Move up")} onClick={moveUp} disabled={!moveUp}>
            <ChevronUp size={16} />
          </IconBtn>
          <IconBtn label={t("Move down")} onClick={moveDown} disabled={!moveDown}>
            <ChevronDown size={16} />
          </IconBtn>
        </div>
      )}

      <IconBtn
        label={pinnedHome ? t("Remove from Home") : t("Add to Home Screen")}
        onClick={toggleHome}
        active={pinnedHome}
      >
        <Home size={16} />
      </IconBtn>
      <IconBtn
        label={hidden ? t("Show this catalog") : t("Hide this catalog")}
        onClick={onToggleHide}
        active={hidden}
      >
        {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
      </IconBtn>
      <IconBtn label={pinned ? t("Unpin") : t("Pin to top")} onClick={onTogglePin} active={pinned}>
        {pinned ? <PinOff size={16} /> : <Pin size={16} />}
      </IconBtn>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
  active,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-25 ${
        active
          ? "text-accent hover:bg-canvas/60"
          : "text-ink-subtle hover:bg-canvas/60 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
