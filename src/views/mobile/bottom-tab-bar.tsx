import { Bookmark, Home, MonitorSmartphone, User } from "lucide-react";
import { Search } from "@/components/icons/search-icon";
import type { ComponentType } from "react";
import { useProfiles } from "@/lib/profiles";
import { useT } from "@/lib/i18n";
import { useMobileRemote } from "./mobile-remote";
import { useSheetLock } from "./mobile-sheet-lock";

export type MobileTab = "remote" | "search" | "home" | "mystuff" | "profile";

const TABS: Array<{
  id: MobileTab;
  label: string;
  icon: ComponentType<{ size?: number | string; className?: string; strokeWidth?: number }>;
}> = [
  { id: "remote", label: "Remote", icon: MonitorSmartphone },
  { id: "search", label: "Search", icon: Search },
  { id: "home", label: "Home", icon: Home },
  { id: "mystuff", label: "My Stuff", icon: Bookmark },
  { id: "profile", label: "Profile", icon: User },
];

const TAB_BAR_SLIDE_CSS = `
.harbor-tabbar-slide {
  transition: transform 320ms var(--ease-out);
}
.harbor-tabbar-slide[data-hidden="true"] {
  transform: translateY(calc(100% + 24px));
}
@media (prefers-reduced-motion: reduce) {
  .harbor-tabbar-slide {
    transition: none;
  }
  .harbor-tabbar-slide[data-hidden="true"] {
    transform: none;
    visibility: hidden;
  }
}
`;

export function BottomTabBar({
  active,
  onSelect,
}: {
  active: MobileTab;
  onSelect: (tab: MobileTab) => void;
}) {
  const translate = useT();
  const { snapshot } = useMobileRemote();
  const { activeProfile } = useProfiles();
  const { sheetOpen } = useSheetLock();
  const avatar = snapshot.profile?.avatar ?? activeProfile?.avatar ?? null;
  const color = snapshot.profile?.color ?? activeProfile?.color ?? "oklch(0.78 0.13 60)";
  const pname = snapshot.profile?.name ?? activeProfile?.name ?? "";

  return (
    <nav
      className="harbor-tabbar-slide pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
      data-hidden={sheetOpen ? "true" : undefined}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
    >
      <style>{TAB_BAR_SLIDE_CSS}</style>
      <div className="pointer-events-auto flex w-[min(400px,100%)] items-center justify-between rounded-xl border border-edge-soft/60 bg-elevated/80 px-2 py-2 shadow-[0_12px_34px_-10px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        {TABS.map((t) => {
          const on = t.id === active;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              aria-label={translate(t.label)}
              aria-current={on ? "page" : undefined}
              onClick={() => onSelect(t.id)}
              className="flex flex-1 items-center justify-center"
            >
              <span
                className={`flex h-10 w-[52px] items-center justify-center rounded-[13px] transition-[background-color,transform] duration-200 active:scale-95 ${
                  on ? "bg-ink" : "bg-transparent"
                }`}
              >
                {t.id === "profile" ? (
                  <span
                    className="flex h-[23px] w-[23px] items-center justify-center overflow-hidden rounded-full text-[10px] font-bold text-white ring-1 ring-black/10"
                    style={{ background: avatar ? undefined : color }}
                  >
                    {avatar ? (
                      <img src={avatar} alt="" className="h-full w-full object-cover" />
                    ) : pname ? (
                      pname.slice(0, 1).toUpperCase()
                    ) : (
                      <User
                        size={15}
                        strokeWidth={2.1}
                        className={on ? "text-canvas" : "text-ink-subtle"}
                      />
                    )}
                  </span>
                ) : (
                  <Icon
                    size={22}
                    strokeWidth={2.1}
                    className={on ? "text-canvas" : "text-ink-subtle"}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
