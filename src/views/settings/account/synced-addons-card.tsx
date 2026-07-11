import { AddonLogo, AddonLogoStack, resolveAddonLogo } from "@/components/addon-logo";
import type { Addon } from "@/lib/addons";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { requestAddonsTab } from "@/views/addons";
import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
      <div className="flex items-center gap-3 rounded-2xl border border-edge-soft bg-canvas/40 p-5 text-[13px] text-ink-subtle">
        {t("Sign in to Stremio first. Your installed addons sync from there.")}
      </div>
    );
  }

  const count = addons?.length ?? null;
  const MAX_VISIBLE = 4;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-edge-soft bg-canvas/40 p-5">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-end gap-5">
          <div className="flex flex-col">
            <span className="font-display text-[36px] font-medium leading-none tracking-tight text-ink">
              {count != null ? count : "–"}
            </span>
            <span className="mt-1 text-[11.5px] uppercase tracking-[0.18em] text-ink-subtle">
              {count === 1 ? t("addon synced") : t("addons synced")}
            </span>
          </div>
          {addons && addons.length > 0 && <AddonStackPeek addons={addons} max={MAX_VISIBLE} />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={sync}
            disabled={busy}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : null}
            {busy ? t("Syncing…") : t("Sync now")}
          </button>
          <button
            onClick={() => {
              requestAddonsTab("installed");
              setView("addons");
            }}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-edge-soft px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            {t("Manage")}
            <ArrowRight size={12} strokeWidth={2.2} className="dir-icon" />
          </button>
        </div>
      </div>
      {lastSynced && (
        <p className="border-t border-edge-soft/60 pt-2 text-[11.5px] text-ink-subtle">
          {t("Last synced {n}s ago.", { n: Math.round((Date.now() - lastSynced) / 1000) })}
        </p>
      )}
    </div>
  );
}

function AddonStackPeek({ addons, max }: { addons: Addon[]; max: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const overflow = addons.length - max;

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
    <div ref={wrap} className="relative flex items-center gap-2">
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
          onClick={() => setOpen((v) => !v)}
          aria-label={t("Show {n} more addons", { n: overflow })}
          className={`flex h-9 min-w-[44px] items-center justify-center rounded-full border px-2.5 text-[12.5px] font-semibold transition-colors ${
            open
              ? "border-edge bg-elevated text-ink"
              : "border-edge-soft bg-canvas/60 text-ink-muted hover:border-edge hover:text-ink"
          }`}
        >
          +{overflow}
        </button>
      )}
      {open && <AddonListTooltip addons={addons} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddonListTooltip({ addons, onClose }: { addons: Addon[]; onClose: () => void }) {
  const t = useT();
  return (
    <div className="absolute start-0 top-[calc(100%+10px)] z-30 flex w-[320px] flex-col overflow-hidden rounded-2xl border border-edge-soft bg-elevated/95 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.65)] backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between border-b border-edge-soft/70 px-4 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          {t("All addons ({n})", { n: addons.length })}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close")}
          className="flex h-6 w-6 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="flex max-h-[320px] flex-col overflow-y-auto">
        {addons.map((a) => (
          <div
            key={a.manifest.id}
            className="flex items-center gap-3 border-b border-edge-soft/40 px-4 py-2.5 last:border-b-0"
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
