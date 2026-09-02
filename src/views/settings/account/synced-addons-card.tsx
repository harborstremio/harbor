import { ArrowRight, Loader2, Puzzle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AddonLogo, AddonLogoStack, resolveAddonLogo } from "@/components/addon-logo";
import type { Addon } from "@/lib/addons";
import { useAuth } from "@/lib/auth";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { requestAddonsTab } from "@/views/addons";
import { SettingRow } from "../kit";

export function SyncedAddonsCard() {
  const t = useT();
  const { authKey } = useAuth();
  const [addons, setAddons] = useState<Addon[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const { setView } = useView();

  const sync = async () => {
    if (!authKey) return;
    setBusy(true);
    try {
      const mod = await import("@/lib/addons");
      const list = await mod.userAddons(authKey);
      setAddons(list);
      setLastSynced(Date.now());
    } catch {
      setAddons(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (authKey && addons == null) void sync();
  }, [authKey]);

  if (!authKey) {
    return (
      <SettingRow
        icon={<Puzzle size={16} strokeWidth={2} />}
        label={t("Your collection")}
        desc={t("Sign in to Stremio first. Your installed addons sync from there.")}
      />
    );
  }

  const count = addons?.length ?? null;
  const MAX_VISIBLE = 4;

  return (
    <SettingRow
      wide
      icon={<Puzzle size={16} strokeWidth={2} />}
      label={t("Your collection")}
      desc={
        lastSynced
          ? t("Last synced {n}s ago.", { n: Math.round((Date.now() - lastSynced) / 1000) })
          : t("Pulled from your Stremio account.")
      }
    >
      <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex shrink-0 items-baseline gap-2">
          <span className="font-display text-[28px] font-medium leading-none tracking-tight text-ink">
            {count != null ? count : "–"}
          </span>
          <span className="text-[11.5px] uppercase tracking-[0.16em] text-ink-subtle">
            {count === 1 ? t("addon synced") : t("addons synced")}
          </span>
        </div>
        {addons && addons.length > 0 && <AddonStackPeek addons={addons} max={MAX_VISIBLE} />}
        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={sync}
            disabled={busy}
            className="flex h-9 items-center gap-1.5 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {busy ? t("Syncing…") : t("Sync now")}
          </button>
          <button
            type="button"
            onClick={() => {
              requestAddonsTab("installed");
              setView("addons");
            }}
            className="flex h-9 items-center gap-1.5 rounded-md bg-canvas px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            {t("Manage")}
            <ArrowRight size={12} strokeWidth={2.2} className="dir-icon" />
          </button>
        </div>
      </div>
    </SettingRow>
  );
}

function AddonStackPeek({ addons, max }: { addons: Addon[]; max: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"up" | "down">("down");
  const wrap = useRef<HTMLDivElement>(null);
  const overflow = addons.length - max;

  const toggle = () => {
    if (!open && wrap.current) {
      const r = wrap.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      setPlacement(spaceBelow < 380 && r.top > spaceBelow ? "up" : "down");
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative flex shrink-0 items-center gap-1.5">
      <AddonLogoStack
        addons={addons.map((a) => ({
          id: a.manifest.id,
          name: a.manifest.name,
          logo: resolveAddonLogo(a.manifest.logo, a.transportUrl),
        }))}
        size="xl"
        max={max}
      />
      {overflow > 0 && (
        <button
          type="button"
          onClick={toggle}
          aria-label={t("Show {n} more addons", { n: overflow })}
          className={`flex h-9 min-w-[44px] items-center justify-center rounded-md px-2.5 text-[12.5px] font-semibold transition-colors ${
            open ? "bg-ink text-canvas" : "bg-canvas text-ink-muted hover:text-ink"
          }`}
        >
          +{overflow}
        </button>
      )}
      {open && <AddonListTooltip addons={addons} placement={placement} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddonListTooltip({
  addons,
  placement,
  onClose,
}: {
  addons: Addon[];
  placement: "up" | "down";
  onClose: () => void;
}) {
  const t = useT();
  return (
    <div
      className={`absolute start-0 z-30 flex w-[320px] flex-col overflow-hidden rounded-md bg-raised harbor-float animate-in fade-in duration-150 ${
        placement === "up"
          ? "bottom-[calc(100%+10px)] slide-in-from-bottom-1"
          : "top-[calc(100%+10px)] slide-in-from-top-1"
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <span className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          {t("All addons ({n})", { n: addons.length })}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close")}
          className="flex h-6 w-6 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto px-2 pb-2">
        {addons.map((a) => (
          <div
            key={a.manifest.id}
            className="flex items-center gap-3 rounded-md bg-elevated px-3 py-2.5"
          >
            <AddonLogo
              addonId={a.manifest.id}
              addonName={a.manifest.name}
              manifestLogo={resolveAddonLogo(a.manifest.logo, a.transportUrl)}
              size="sm"
            />
            <span className="truncate text-[13px] font-medium text-ink">{a.manifest.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
