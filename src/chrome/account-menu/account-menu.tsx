import { AuthModal } from "@/components/auth-modal";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { verifyProfilePassword } from "@/lib/profile-password";
import { StatusDot, StatusPicker } from "@/chrome/sidebar/status-control";
import { AccountMenuPanel } from "./account-menu-panel";
import { ProfileAvatar, SubtitleText } from "./account-menu-parts";
import { useAccountMenu } from "./use-account-menu";

type TriggerKind = "row" | "pill" | "avatar";

export function AccountMenu({
  trigger = "pill",
  placement = "down",
  align = "end",
  collapsed = false,
  showSettings = false,
  onOpenSettings,
  settingsActive = false,
  triggerClassName,
}: {
  trigger?: TriggerKind;
  placement?: "up" | "down";
  align?: "start" | "end" | "stretch";
  collapsed?: boolean;
  showSettings?: boolean;
  onOpenSettings?: () => void;
  settingsActive?: boolean;
  triggerClassName?: string;
}) {
  const t = useT();
  const { settings } = useSettings();
  const ctrl = useAccountMenu();
  const { ref, user, activeProfile, author, status, menuOpen, setMenuOpen, statusOpen, toggleStatus, pickStatus, pendingSwitch, setPendingSwitch, selectProfile } = ctrl;

  const kid = !!activeProfile?.kid;
  const harborAvatar = settings.harborAvatar?.startsWith("/kids/avatars/") ? null : settings.harborAvatar;
  const name = activeProfile?.name ?? user?.fullname ?? user?.email?.split("@")[0] ?? t("profile.fallback");
  const showStatus = !!author && !kid;

  const vpos = placement === "up" ? "bottom-full mb-1.5" : "top-full mt-2";
  const hpos =
    trigger === "row" && !collapsed && align === "stretch"
      ? "start-2 end-2 lg:start-4 lg:end-4"
      : collapsed
        ? "start-0 w-64"
        : align === "end"
          ? "end-0 w-64"
          : align === "start"
            ? "start-0 w-64"
            : "start-0 end-0";
  const positionClass = `${vpos} ${hpos}`;

  const avatar = (size: "md" | "lg") => (
    <span className="relative inline-flex shrink-0">
      <ProfileAvatar profile={activeProfile} user={user} fallbackAvatar={harborAvatar} size={size} />
      {showStatus && (
        <StatusDot
          status={status}
          onActivate={(e) => {
            e.stopPropagation();
            toggleStatus();
          }}
        />
      )}
    </span>
  );

  return (
    <div ref={ref} className="relative">
      {trigger === "row" ? (
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={name}
          className={
            triggerClassName ??
            `flex w-full items-center justify-center gap-3.5 rounded-xl py-2.5 text-start transition-colors hover:bg-elevated/60 ${collapsed ? "" : "lg:justify-start lg:px-3"}`
          }
        >
          {avatar("lg")}
          <div className={`hidden min-w-0 flex-1 ${collapsed ? "" : "lg:block"}`}>
            <div className="truncate text-[14.5px] font-medium tracking-tight text-ink">{name}</div>
            <div className="truncate text-[12px] text-ink-subtle">
              <SubtitleText active={activeProfile} profiles={ctrl.profiles} user={user} />
            </div>
          </div>
        </button>
      ) : trigger === "avatar" ? (
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={name}
          className={triggerClassName ?? "flex items-center rounded-full transition-transform active:scale-95"}
        >
          {avatar("md")}
        </button>
      ) : (
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={
            triggerClassName ??
            "flex h-9 items-center gap-2 rounded-full ps-1 pe-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
          }
        >
          {avatar("md")}
          <span className="hidden max-w-[8rem] truncate sm:inline">{name}</span>
        </button>
      )}

      {statusOpen && showStatus && (
        <StatusPicker
          current={status}
          collapsed={collapsed}
          placement={placement}
          align={align}
          onPick={pickStatus}
        />
      )}

      {menuOpen && (
        <AccountMenuPanel
          ctrl={ctrl}
          positionClass={positionClass}
          showHeader={trigger !== "row"}
          showSettings={showSettings}
          onOpenSettings={onOpenSettings}
          settingsActive={settingsActive}
        />
      )}

      {ctrl.authOpen && <AuthModal onClose={() => ctrl.setAuthOpen(false)} />}
      {pendingSwitch && activeProfile?.kid?.parentPinHash && (
        <ParentalPinModal
          mode={{
            kind: "unlock",
            onUnlock: () => {
              const target = pendingSwitch;
              setPendingSwitch(null);
              // The parent PIN clears the kid lock on the profile being LEFT. It proves
              // nothing about the target, so a target with its own PIN still has to
              // unlock itself: selectProfile refuses otherwise and the press does
              // nothing at all.
              if (target.passwordHash) ctrl.openPicker({ kind: "unlock", profileId: target.id });
              else selectProfile(target.id);
            },
            onCancel: () => setPendingSwitch(null),
          }}
          verify={(pin) => verifyProfilePassword(pin, activeProfile.kid!.parentPinHash!)}
          kids
        />
      )}
    </div>
  );
}
