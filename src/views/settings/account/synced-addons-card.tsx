import { ArrowRight, Loader2, Puzzle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AddonLogo, AddonLogoStack, resolveAddonLogo } from "@/components/addon-logo";
import { AnchoredMenu } from "@/components/anchored-menu";
import type { Addon } from "@/lib/addons";
import { useAuth } from "@/lib/auth";
import { captureFocusReturn, tvFocus } from "@/lib/keyboard-navigation";
import { isBackKey, navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { requestAddonsTab } from "@/views/addons";
import { SettingRow } from "../kit";
import { SButton } from "../ui";

const CAPTION = "text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-ink-subtle";

export function SyncedAddonsCard() {
  const t = useT();
  const { authKey } = useAuth();
  const [addons, setAddons] = useState<Addon[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const { setView } = useView();

  const sync = async () => {
    if (!authKey || busy) return;
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
        icon={<Puzzle size={18} strokeWidth={2} />}
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
      icon={<Puzzle size={18} strokeWidth={2} />}
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
            {count != null ? count : "…"}
          </span>
          <span className={CAPTION}>{count === 1 ? t("addon synced") : t("addons synced")}</span>
        </div>
        {addons && addons.length > 0 && <AddonStackPeek addons={addons} max={MAX_VISIBLE} />}
        <div aria-busy={busy} className="ms-auto flex shrink-0 flex-wrap items-center gap-2.5">
          <SButton variant="primary" onClick={sync}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? t("Syncing…") : t("Sync now")}
          </SButton>
          <SButton
            onClick={() => {
              requestAddonsTab("installed");
              setView("addons");
            }}
          >
            {t("Manage")}
            <ArrowRight size={16} strokeWidth={2.2} className="dir-icon" />
          </SButton>
        </div>
      </div>
    </SettingRow>
  );
}

function AddonStackPeek({ addons, max }: { addons: Addon[]; max: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const overflow = addons.length - max;

  return (
    <div ref={wrap} className="flex shrink-0 items-center gap-2.5">
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
        <SButton
          variant={open ? "primary" : "secondary"}
          onClick={() => setOpen((v) => !v)}
          title={t("Show {n} more addons", { n: overflow })}
        >
          +{overflow}
        </SButton>
      )}
      {overflow > 0 && (
        <AnchoredMenu anchorRef={wrap} open={open} onClose={() => setOpen(false)} width={340}>
          <AddonList addons={addons} onClose={() => setOpen(false)} />
        </AnchoredMenu>
      )}
    </div>
  );
}

function AddonList({ addons, onClose }: { addons: Addon[]; onClose: () => void }) {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const restore = captureFocusReturn();
    const active = document.activeElement;
    const el = closeRef.current;
    if (el) {
      if (active instanceof HTMLElement && navOwnsFocus(active)) tvFocus(el);
      else el.focus({ preventScroll: true });
    }
    return restore;
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("All addons ({n})", { n: addons.length })}
      onKeyDown={(e) => {
        if (!isBackKey(e.nativeEvent)) return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      className="harbor-float flex flex-col overflow-hidden rounded-[10px] bg-raised"
    >
      <div className="flex items-center justify-between gap-3 ps-4 pe-2 pt-2">
        <span className={CAPTION}>
          {t("All addons ({n})", { n: addons.length })}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("Close")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>
      <div className="flex max-h-[360px] flex-col overflow-y-auto p-2">
        {addons.map((a) => (
          <div
            key={a.manifest.id}
            tabIndex={-1}
            data-focusable="true"
            className="flex min-h-11 items-center gap-3 rounded-[8px] px-2 outline-none"
          >
            <AddonLogo
              addonId={a.manifest.id}
              addonName={a.manifest.name}
              manifestLogo={resolveAddonLogo(a.manifest.logo, a.transportUrl)}
              size="sm"
            />
            <span className="min-w-0 text-[15.5px] leading-[22px] text-ink">{a.manifest.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
