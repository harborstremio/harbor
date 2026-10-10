import { ArrowUpDown, Columns2, Rows3, Settings2 } from "lucide-react";
import { useState } from "react";
import { AddonLogo, resolveAddonLogo } from "@/components/addon-logo";
import { HoverTooltip } from "@/components/hover-tooltip";
import { isAddonEnabled, setAddonEnabled } from "@/lib/addon-store";
import type { ResolvedAddon } from "@/lib/addons-store/store";
import { useT } from "@/lib/i18n";
import { addonKey, idOf, nameOf, subtitleFromManifest } from "./addons-utils";

const LAYOUT_KEY = "harbor.addons.installedLayout";

type InstalledLayout = "columns" | "list";

function readLayout(): InstalledLayout {
  return localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "columns";
}

export function InstalledPane({
  installed,
  search,
  onOpen,
  onUninstall,
  onManage,
  onReorder,
}: {
  installed: ResolvedAddon[];
  search?: string | null;
  onOpen: (id: string) => void;
  onUninstall: (r: ResolvedAddon) => Promise<void>;
  onManage?: (r: ResolvedAddon) => void;
  onReorder?: () => void;
}) {
  const t = useT();
  const [layout, setLayout] = useState<InstalledLayout>(readLayout);
  const switchLayout = (next: InstalledLayout) => {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      /* noop */
    }
  };
  const q = search?.trim().toLowerCase() ?? "";
  const filtered = q
    ? installed.filter((r) => {
        const name = (r.manifest?.name ?? "").toLowerCase();
        const desc = (r.manifest?.description ?? "").toLowerCase();
        const id = (r.manifest?.id ?? r.curated?.id ?? "").toLowerCase();
        return name.includes(q) || desc.includes(q) || id.includes(q);
      })
    : installed;
  const positions = new Map(installed.map((r, i) => [addonKey(r), i + 1]));
  if (installed.length === 0) {
    return (
      <div className="rounded-2xl border border-edge-soft bg-elevated/30 p-12 text-center">
        <h3 className="font-display text-[22px] font-medium text-ink">{t("No addons installed yet")}</h3>
        <p className="mx-auto mt-2 max-w-md text-[13.5px] text-ink-muted">
          {t("Head to Discover. Cinemeta and OpenSubtitles cover the basics; Torrentio + a debrid key cover almost everything else.")}
        </p>
      </div>
    );
  }
  if (filtered.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-edge-soft bg-canvas/30 p-10 text-center">
        <p className="font-display text-[16px] font-medium text-ink">{t("No installed addon matches that.")}</p>
        <p className="mt-1.5 text-[12.5px] text-ink-subtle">
          {t("Clear the search to see all {n} installed.", { n: installed.length })}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2">
        <div className="flex h-9 shrink-0 items-center gap-0.5 rounded-full border border-edge-soft p-1">
          <HoverTooltip label={t("Two columns")} side="top" align="center" delayMs={200}>
            <button
              onClick={() => switchLayout("columns")}
              aria-pressed={layout === "columns"}
              aria-label={t("Two columns")}
              className={`flex h-7 w-8 items-center justify-center rounded-full transition-colors ${
                layout === "columns" ? "bg-raised text-ink" : "text-ink-subtle hover:text-ink-muted"
              }`}
            >
              <Columns2 size={14} strokeWidth={2.2} />
            </button>
          </HoverTooltip>
          <HoverTooltip label={t("One list")} side="top" align="center" delayMs={200}>
            <button
              onClick={() => switchLayout("list")}
              aria-pressed={layout === "list"}
              aria-label={t("One list")}
              className={`flex h-7 w-8 items-center justify-center rounded-full transition-colors ${
                layout === "list" ? "bg-raised text-ink" : "text-ink-subtle hover:text-ink-muted"
              }`}
            >
              <Rows3 size={14} strokeWidth={2.2} />
            </button>
          </HoverTooltip>
        </div>
        {onReorder && (
          <button
            onClick={onReorder}
            title={t("Change the order addons are tried in")}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle transition-colors hover:border-edge hover:text-ink-muted"
          >
            <ArrowUpDown size={13} strokeWidth={2.4} />
            {t("Reorder")}
          </button>
        )}
      </div>
      {layout === "list" ? (
        <div className="flex flex-col gap-2">
          {filtered.map((r) => (
            <InstalledRow
              key={addonKey(r)}
              resolved={r}
              position={positions.get(addonKey(r)) ?? 0}
              large
              onOpen={onOpen}
              onUninstall={onUninstall}
              onManage={onManage}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
          {splitColumnMajor(filtered).map((column, ci) => (
            <div key={ci} className="flex min-w-0 flex-col gap-2">
              {column.map((r) => (
                <InstalledRow
                  key={addonKey(r)}
                  resolved={r}
                  position={positions.get(addonKey(r)) ?? 0}
                  onOpen={onOpen}
                  onUninstall={onUninstall}
                  onManage={onManage}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function splitColumnMajor<T>(items: T[]): T[][] {
  if (items.length < 2) return [items];
  const mid = Math.ceil(items.length / 2);
  return [items.slice(0, mid), items.slice(mid)];
}

function InstalledRow({
  resolved,
  position,
  large = false,
  onOpen,
  onUninstall,
  onManage,
}: {
  resolved: ResolvedAddon;
  position: number;
  large?: boolean;
  onOpen: (id: string) => void;
  onUninstall: (r: ResolvedAddon) => Promise<void>;
  onManage?: (r: ResolvedAddon) => void;
}) {
  const t = useT();
  const r = resolved;
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(() => isAddonEnabled(r.transportUrl));
  const isConfigurable =
    r.manifest?.behaviorHints?.configurable === true ||
    r.manifest?.behaviorHints?.configurationRequired === true;
  const transportUrl = r.transportUrl;

  const handleUninstall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await onUninstall(r);
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !enabled;
    setEnabled(next);
    setAddonEnabled(r.transportUrl, next);
    window.dispatchEvent(
      new CustomEvent("harbor:addons-changed", { detail: { id: idOf(r), enabled: next } }),
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !busy && onOpen(idOf(r))}
      onKeyDown={(e) => !busy && (e.key === "Enter" || e.key === " ") && onOpen(idOf(r))}
      className={`flex items-center rounded-xl border bg-elevated text-start transition-all ${
        large ? "gap-4 px-5 py-4" : "gap-3.5 px-4 py-3"
      } ${
        busy
          ? "border-edge-soft cursor-wait opacity-60"
          : "border-edge-soft cursor-pointer hover:border-edge hover:bg-raised"
      }`}
    >
      <span
        className={`shrink-0 text-center font-display font-medium tabular-nums text-ink-subtle ${
          large ? "min-w-8 text-[18px]" : "min-w-6 text-[15px]"
        }`}
      >
        {position}
      </span>
      <div className={enabled ? "" : "opacity-45 transition-opacity"}>
        <AddonLogo
          addonId={idOf(r)}
          addonName={nameOf(r)}
          manifestLogo={resolveAddonLogo(r.manifest?.logo, r.transportUrl)}
          size={large ? "tile" : "lg"}
        />
      </div>
      <div className={`flex min-w-0 flex-1 flex-col ${large ? "gap-1" : "gap-0.5"} ${enabled ? "" : "opacity-55"}`}>
        <span className={`truncate font-medium text-ink ${large ? "text-[16px]" : "text-[14px]"}`}>
          {nameOf(r)}
        </span>
        <span className={`truncate text-ink-subtle ${large ? "text-[13px]" : "text-[11.5px]"}`}>
          {enabled ? subtitleFromManifest(r) : t("Off · catalogs and streams hidden")}
        </span>
      </div>
      {!busy && (
        <HoverTooltip
          side="top"
          align="center"
          className="shrink-0"
          label={enabled ? t("Enabled") : t("Disabled")}
          sublabel={enabled ? t("Click to turn off") : t("Click to turn on")}
        >
          <button
            onClick={handleToggle}
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? t("Turn {name} off", { name: nameOf(r) }) : t("Turn {name} on", { name: nameOf(r) })}
            className={`relative h-[22px] w-10 shrink-0 rounded-full outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent/50 ${
              enabled ? "bg-accent" : "bg-edge/70 ring-1 ring-inset ring-edge-soft"
            }`}
          >
            <span
              className={`absolute start-[3px] top-[3px] h-4 w-4 rounded-full bg-ink shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-transform duration-200 ${
                enabled ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0"
              }`}
            />
          </button>
        </HoverTooltip>
      )}
      {isConfigurable && transportUrl && onManage && !busy && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onManage(r);
          }}
          title={t("Re-configure this addon and apply the updated link")}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-raised px-3.5 py-1.5 text-[12px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-elevated hover:text-ink hover:ring-edge"
        >
          <Settings2 size={12} strokeWidth={2.2} />
          {t("Manage")}
        </button>
      )}
      <button
        onClick={handleUninstall}
        disabled={busy}
        className={`group/pill flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ring-1 transition-colors ${
          busy
            ? "bg-danger/15 text-danger ring-danger/30"
            : "bg-elevated/70 text-ink ring-edge-soft hover:bg-danger/15 hover:text-danger hover:ring-danger/30"
        }`}
      >
        {busy ? (
          <>
            <span>{t("Uninstalling")}</span>
            <DotsAnim />
          </>
        ) : (
          t("Installed")
        )}
      </button>
    </div>
  );
}

function DotsAnim() {
  return (
    <span className="inline-flex w-3 items-center">
      <span className="dots-anim text-[12px] leading-none">...</span>
    </span>
  );
}
