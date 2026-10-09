import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AuthModal } from "@/components/auth-modal";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { verifyProfilePassword } from "@/lib/profile-password";
import { subscribeAccountMenuOpen, type AccountMenuAnchor } from "@/lib/social/account-menu-open";
import { useView } from "@/lib/view";
import { AccountMenuPanel } from "./account-menu-panel";
import { useAccountMenu } from "./use-account-menu";

export function AccountMenuFloating() {
  const ctrl = useAccountMenu();
  const { setView } = useView();
  const [anchor, setAnchor] = useState<AccountMenuAnchor>(null);
  const { menuOpen, setMenuOpen, pendingSwitch, setPendingSwitch, selectProfile, activeProfile } = ctrl;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      subscribeAccountMenuOpen((a) => {
        setAnchor(a);
        setMenuOpen(true);
      }),
    [setMenuOpen],
  );

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, setMenuOpen]);

  const top = anchor ? Math.min(anchor.bottom + 8, window.innerHeight - 120) : 84;
  const end = anchor ? Math.max(12, window.innerWidth - anchor.right) : 18;

  return (
    <>
      {menuOpen &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[160] w-64"
            style={{ top, insetInlineEnd: end }}
          >
            <div className="relative">
              <AccountMenuPanel
                ctrl={ctrl}
                positionClass="top-0 start-0 w-64"
                showHeader
                showSettings
                onOpenSettings={() => setView("settings")}
              />
            </div>
          </div>,
          document.body,
        )}
      {ctrl.authOpen && <AuthModal onClose={() => ctrl.setAuthOpen(false)} />}
      {pendingSwitch && activeProfile?.kid?.parentPinHash && (
        <ParentalPinModal
          mode={{
            kind: "unlock",
            onUnlock: () => {
              const target = pendingSwitch;
              setPendingSwitch(null);
              // The parent PIN clears the kid lock on the profile being LEFT, not the
              // target's own lock. Without this branch selectProfile refuses and the
              // press silently does nothing.
              if (target.passwordHash) ctrl.openPicker({ kind: "unlock", profileId: target.id });
              else selectProfile(target.id);
            },
            onCancel: () => setPendingSwitch(null),
          }}
          verify={(pin) => verifyProfilePassword(pin, activeProfile.kid!.parentPinHash!)}
          kids
        />
      )}
    </>
  );
}
