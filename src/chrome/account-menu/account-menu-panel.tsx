import { Bell, ChevronDown, Lock, LogIn, LogOut, Pencil, Plus, Settings as SettingsIcon, UserRound, Users } from "lucide-react";
import { useT } from "@/lib/i18n";
import { ProfileAvatar } from "./account-menu-parts";
import type { AccountMenuController } from "./use-account-menu";

const ITEM = "flex items-center gap-2.5 px-4 py-2.5 text-start text-[13.5px] text-ink-muted transition-colors duration-150 ease-[var(--ease-out)] hover:bg-raised hover:text-ink active:scale-[0.98]";
const SUB_ITEM = "flex items-center gap-2.5 py-2 ps-11 pe-4 text-start text-[13px] text-ink-subtle transition-colors duration-150 ease-[var(--ease-out)] hover:bg-raised hover:text-ink";

export function AccountMenuPanel({
  ctrl,
  positionClass,
  showHeader = false,
  showSettings = false,
  onOpenSettings,
  settingsActive = false,
}: {
  ctrl: AccountMenuController;
  positionClass: string;
  showHeader?: boolean;
  showSettings?: boolean;
  onOpenSettings?: () => void;
  settingsActive?: boolean;
}) {
  const t = useT();
  const { user, signOut, profiles, activeProfile, author, openPicker, requestSwitch, viewMyProfile, openNotifications, manageOpen, setManageOpen, setMenuOpen, setAuthOpen } = ctrl;
  const otherProfiles = profiles.filter((p) => p.id !== activeProfile?.id);
  const kid = !!activeProfile?.kid;
  const name = activeProfile?.name ?? user?.fullname ?? user?.email?.split("@")[0] ?? t("profile.fallback");

  return (
    <div
      className={`harbor-profile-dropdown absolute z-40 overflow-hidden rounded-md bg-elevated ring-1 ring-edge shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] ${positionClass}`}
    >
      {showHeader && (
        <div className="border-b border-edge-soft px-4 py-2.5">
          <div className="truncate text-[13.5px] font-semibold text-ink">{name}</div>
          {user?.email && <div className="truncate text-[11.5px] text-ink-subtle">{user.email}</div>}
        </div>
      )}

      {otherProfiles.length > 0 && (
        <div className="flex flex-col gap-0.5 border-b border-edge-soft p-1.5">
          <span className="px-2.5 pb-1 pt-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            {t("profile.switch")}
          </span>
          {otherProfiles.map((p) => (
            <button
              key={p.id}
              onClick={() => requestSwitch(p)}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-start transition-colors duration-150 ease-[var(--ease-out)] hover:bg-raised active:scale-[0.98]"
            >
              <span className="relative inline-flex shrink-0">
                <ProfileAvatar profile={p} user={null} fallbackAvatar={null} size="sm" />
                {p.passwordHash && (
                  <span className="absolute -bottom-0.5 -end-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-canvas text-ink ring-1 ring-edge">
                    <Lock size={8} strokeWidth={2.6} />
                  </span>
                )}
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-[13.5px] font-medium text-ink">{p.name}</span>
                {p.isPrimary && (
                  <span className="shrink-0 text-[9px] font-bold uppercase leading-none tracking-[0.18em]" style={{ color: p.color }}>
                    {t("profile.primary")}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {!kid && (
        <div className="flex flex-col">
          {author && (
            <button onClick={viewMyProfile} className={ITEM}>
              <UserRound size={14} strokeWidth={2.2} />
              {t("View my profile")}
            </button>
          )}
          {author && (
            <button onClick={openNotifications} className={ITEM}>
              <Bell size={14} strokeWidth={2.2} />
              {t("Notifications")}
            </button>
          )}
          <button
            onClick={() => setManageOpen((o) => !o)}
            className={`${ITEM} ${author ? "border-t border-edge-soft" : ""}`}
          >
            <Users size={14} strokeWidth={2.2} />
            {t("Manage profiles")}
            <ChevronDown
              size={14}
              strokeWidth={2.2}
              className={`ms-auto transition-transform duration-200 ${manageOpen ? "rotate-180" : ""}`}
            />
          </button>
          {manageOpen && (
            <div className="flex flex-col bg-canvas/50">
              <button
                onClick={() => {
                  openPicker({ kind: "list" });
                  setMenuOpen(false);
                }}
                className={SUB_ITEM}
              >
                <Users size={13} strokeWidth={2.2} />
                {t("profile.whoWatching")}
              </button>
              {activeProfile && (
                <button
                  onClick={() => {
                    openPicker({ kind: "edit", profileId: activeProfile.id });
                    setMenuOpen(false);
                  }}
                  className={SUB_ITEM}
                >
                  <Pencil size={13} strokeWidth={2.2} />
                  {t("profile.editThis")}
                </button>
              )}
              {activeProfile?.isPrimary && (
                <button
                  onClick={() => {
                    openPicker({ kind: "create" });
                    setMenuOpen(false);
                  }}
                  className={SUB_ITEM}
                >
                  <Plus size={13} strokeWidth={2.2} />
                  {t("profile.new")}
                </button>
              )}
            </div>
          )}
          {showSettings && onOpenSettings && (
            <button
              onClick={() => {
                onOpenSettings();
                setMenuOpen(false);
              }}
              className={`${ITEM} border-t border-edge-soft ${settingsActive ? "text-ink" : ""}`}
            >
              <SettingsIcon size={14} strokeWidth={2.2} />
              {t("nav.settings")}
            </button>
          )}
          {user ? (
            <button
              onClick={() => {
                signOut();
                setMenuOpen(false);
              }}
              className={`${ITEM} border-t border-edge-soft`}
            >
              <LogOut size={14} strokeWidth={2.2} />
              {t("profile.signOut")}
            </button>
          ) : (
            <button
              onClick={() => {
                setAuthOpen(true);
                setMenuOpen(false);
              }}
              className={`${ITEM} border-t border-edge-soft`}
            >
              <LogIn size={14} strokeWidth={2.2} />
              {t("profile.signIn")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
