import { NAV_ITEMS, applyNavCustomization } from "@/chrome/nav-items";
import { CatAvatar } from "@/components/icons/cat-avatar";
import { HarborMark } from "@/components/icons/harbor-mark";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useParental } from "@/lib/parental";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { getThemeById } from "@/lib/theme";
import { useView, type View } from "@/lib/view";
import { Lock } from "lucide-react";
import { useState, type ReactNode } from "react";

export function StremioRail() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();
  const t = useT();
  const [pendingPin, setPendingPin] = useState<View | null>(null);

  const themePreset = settings.theme.preset !== "custom" ? getThemeById(settings.theme.preset) : null;
  const customMark = themePreset?.logo?.mark ?? null;

  const items = applyNavCustomization(NAV_ITEMS, settings.navCustomization);
  const visible = items.filter((item) => {
    if (item.id === "kids") return false;
    if (item.view === "vod" && !settings.showPlaylistsTab) return false;
    if (item.hideKey && settings.hideContent[item.hideKey]) return false;
    if (locked && item.parentalKey && hiddenTabs[item.parentalKey]) return false;
    return true;
  });

  return (
    <>
      <aside
        aria-hidden={chromeHidden}
        className={`relative z-[60] flex w-20 shrink-0 flex-col transition-[opacity,transform] duration-[320ms] ease-[cubic-bezier(0.32,0.72,0.24,1)] ${
          chromeHidden ? "pointer-events-none -translate-x-2 rtl:translate-x-2 opacity-0" : "translate-x-0 opacity-100"
        }`}
      >
        <div data-tauri-drag-region className="flex h-[5.5rem] shrink-0 items-center justify-center text-white/90">
          {customMark ? (
            <img src={customMark} alt="" draggable={false} className="h-10 w-10 object-contain" />
          ) : (
            <HarborMark className="h-10 w-10" />
          )}
        </div>
        <nav className="flex flex-1 flex-col items-center gap-3 overflow-y-auto px-2 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visible.map((item) => {
            const active = view === item.view;
            const gated = !!item.pinGated && locked;
            return (
              <RailTab
                key={item.id}
                {...item}
                gated={gated}
                active={active}
                onClick={() => (gated ? setPendingPin(item.view) : setView(item.view))}
              />
            );
          })}
        </nav>
        <div className="shrink-0 px-1 pb-3 pt-1">
          {locked ? (
            <div className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl text-white/35">
              <Lock size={16} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">{t("chrome.locked")}</span>
            </div>
          ) : (
            <RailAvatar />
          )}
        </div>
      </aside>
      {pendingPin && (
        <ParentalPinModal
          mode={{
            kind: "unlock",
            onUnlock: () => {
              const v = pendingPin;
              setPendingPin(null);
              if (v) setView(v);
            },
            onCancel: () => setPendingPin(null),
          }}
          verify={unlock}
        />
      )}
    </>
  );
}

function RailAvatar() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { activeProfile, openPicker } = useProfiles();
  const t = useT();
  const src = activeProfile?.avatar ?? settings.harborAvatar ?? user?.avatar ?? null;
  const ring = activeProfile?.color ? { boxShadow: `0 0 0 2px ${activeProfile.color}` } : undefined;
  const label = activeProfile?.name ?? user?.fullname ?? user?.email?.split("@")[0] ?? t("profile.fallback");
  return (
    <button
      type="button"
      onClick={() => openPicker({ kind: "list" })}
      aria-label={label}
      title={label}
      className="group flex h-16 w-full flex-col items-center justify-center gap-1 rounded-xl text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white/85"
    >
      <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-elevated" style={ring}>
        {src ? (
          <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <CatAvatar className="h-full w-full" />
        )}
      </span>
      <span className="max-w-[5rem] truncate text-[10px] font-semibold leading-none opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

function RailTab({
  render,
  label,
  active,
  gated,
  onClick,
}: {
  render: (active: boolean) => ReactNode;
  label: string;
  active: boolean;
  gated: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const [hovered, setHovered] = useState(false);
  const translated = t(label);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={gated ? t("chrome.lockedRequiresPin", { label: translated }) : translated}
      title={gated ? t("chrome.lockedShort", { label: translated }) : translated}
      className={`group flex h-[4.5rem] w-full flex-col items-center justify-center gap-1.5 rounded-xl transition-colors duration-150 ${
        active ? "text-accent" : "text-white/35 hover:bg-white/[0.05] hover:text-white/85"
      }`}
    >
      <span className={`relative flex h-7 w-7 items-center justify-center ${gated ? "opacity-70" : ""}`}>
        {render(hovered)}
        {gated && (
          <span className="absolute -bottom-1 -end-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-canvas text-white/55 ring-1 ring-white/15">
            <Lock size={8} strokeWidth={2.4} />
          </span>
        )}
      </span>
      <span
        className={`text-[10.5px] font-semibold leading-none tracking-[0.02em] transition-opacity duration-150 ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
        }`}
      >
        {translated}
      </span>
    </button>
  );
}
