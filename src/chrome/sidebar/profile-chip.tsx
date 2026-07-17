import { Lock, LogIn, LogOut, Pencil, Plus, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AuthModal } from "@/components/auth-modal";
import { CatAvatar } from "@/components/icons/cat-avatar";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { TvModalClose } from "@/components/tv-modal-close";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useTvFocusScope } from "@/lib/keyboard-navigation";
import { verifyProfilePassword } from "@/lib/profile-password";
import { useProfiles, type Profile } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import type { User } from "@/lib/stremio";
import { openUrl } from "@/lib/window";

const STREMIO_REGISTER_URL = "https://www.stremio.com/register";

export function ProfileChip({ collapsed = false }: { collapsed?: boolean } = {}) {
  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  const { profiles, activeProfile, openPicker, selectProfile } = useProfiles();
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<Profile | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useTvFocusScope(menuOpen, ref);

  const doSwitch = (p: Profile) => {
    if (p.passwordHash) openPicker({ kind: "unlock", profileId: p.id });
    else selectProfile(p.id);
  };
  const requestSwitch = (p: Profile) => {
    setMenuOpen(false);
    if (activeProfile?.kid?.parentPinHash) {
      setPendingSwitch(p);
      return;
    }
    doSwitch(p);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const otherProfiles = profiles.filter((p) => p.id !== activeProfile?.id);
  const kid = !!activeProfile?.kid;
  const harborAvatar = settings.harborAvatar?.startsWith("/kids/avatars/")
    ? null
    : settings.harborAvatar;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        aria-label={activeProfile?.name ?? user?.email ?? t("profile.fallback")}
        className={`flex w-full items-center justify-center gap-4 rounded-xl py-3 text-start transition-colors hover:bg-elevated/60 ${
          collapsed ? "" : "lg:justify-start lg:px-4"
        }`}
      >
        <ProfileAvatar profile={activeProfile} user={user} fallbackAvatar={harborAvatar} />
        <div className={`hidden min-w-0 flex-1 ${collapsed ? "" : "lg:block"}`}>
          <div className="truncate text-[18px] font-medium tracking-tight text-ink">
            {activeProfile?.name ?? user?.fullname ?? user?.email?.split("@")[0] ?? t("profile.fallback")}
          </div>
          <div className="truncate text-[16px] text-ink-subtle">
            <SubtitleText active={activeProfile} profiles={profiles} user={user} />
          </div>
        </div>
      </button>

      {menuOpen && (
        <div
          data-tv-focus-scope
          className={`absolute bottom-full mb-1.5 overflow-hidden rounded-xl border border-edge bg-elevated shadow-[0_20px_40px_-10px_rgba(0,0,0,0.6)] ${
            collapsed ? "start-0 w-64" : "start-2 end-2 lg:start-4 lg:end-4"
          }`}
        >
          <TvModalClose onClose={() => setMenuOpen(false)} label={t("common.close")} />
          {otherProfiles.length > 0 && (
            <div className="flex flex-col gap-0.5 border-b border-edge-soft p-1.5">
              <span className="px-2.5 pb-1 pt-1 text-[14px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                {t("profile.switch")}
              </span>
              {otherProfiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => requestSwitch(p)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-start transition-colors hover:bg-raised"
                >
                  <span className="relative inline-flex shrink-0">
                    <ProfileAvatar profile={p} user={null} fallbackAvatar={null} compact />
                    {p.passwordHash && (
                      <span className="absolute -bottom-0.5 -end-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-canvas text-ink shadow-sm ring-1 ring-edge">
                        <Lock size={10} strokeWidth={2.6} />
                      </span>
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[18px] font-medium text-ink">{p.name}</span>
                    {p.isPrimary && (
                      <span
                        className="text-[12px] font-bold uppercase tracking-[0.18em]"
                        style={{ color: p.color }}
                      >
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
            <button
              onClick={() => {
                openPicker({ kind: "list" });
                setMenuOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-3 text-start text-[18px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <Users size={18} strokeWidth={2.2} />
              {t("profile.whoWatching")}
            </button>
            {activeProfile && (
              <button
                onClick={() => {
                  openPicker({ kind: "edit", profileId: activeProfile.id });
                  setMenuOpen(false);
                }}
className="flex items-center gap-3 px-4 py-3 text-start text-[18px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <Pencil size={18} strokeWidth={2.2} />
                {t("profile.editThis")}
              </button>
            )}
            {activeProfile?.isPrimary && (
              <button
                onClick={() => {
                  openPicker({ kind: "create" });
                  setMenuOpen(false);
                }}
className="flex items-center gap-3 px-4 py-3 text-start text-[18px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <Plus size={18} strokeWidth={2.2} />
                {t("profile.new")}
              </button>
            )}
            {user ? (
              <button
                onClick={() => {
                  signOut();
                  setMenuOpen(false);
                }}
className="flex items-center gap-3 border-t border-edge-soft px-4 py-3 text-start text-[18px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <LogOut size={18} strokeWidth={2.2} />
              {t("profile.signOut")}
              </button>
            ) : (
              <button
                onClick={() => {
                  setAuthOpen(true);
                  setMenuOpen(false);
                }}
className="flex items-center gap-3 border-t border-edge-soft px-4 py-3 text-start text-[18px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <LogIn size={18} strokeWidth={2.2} />
              {t("profile.signIn")}
              </button>
            )}
          </div>
          )}
        </div>
      )}

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      {pendingSwitch && activeProfile?.kid?.parentPinHash && (
        <ParentalPinModal
          mode={{
            kind: "unlock",
            onUnlock: () => {
              const target = pendingSwitch;
              setPendingSwitch(null);
              selectProfile(target.id);
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

function ProfileAvatar({
  profile,
  user,
  fallbackAvatar,
  compact,
}: {
  profile: Profile | null;
  user: User | null;
  fallbackAvatar: string | null;
  compact?: boolean;
}) {
  const dim = compact ? "h-10 w-10" : "h-16 w-16";
  const src = profile?.avatar ?? fallbackAvatar ?? user?.avatar ?? null;
  const ringStyle = profile?.color ? { boxShadow: `0 0 0 2px ${profile.color}` } : undefined;
  return (
    <div
      className={`${dim} shrink-0 overflow-hidden rounded-full bg-elevated`}
      style={ringStyle}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <CatAvatar className="h-full w-full" />
      )}
    </div>
  );
}

function SubtitleText({
  active,
  profiles,
  user,
}: {
  active: Profile | null;
  profiles: Profile[];
  user: User | null;
}) {
  const t = useT();
  if (active?.shareStremioWith) {
    const src = profiles.find((p) => p.id === active.shareStremioWith);
    if (src) return <>{t("Sharing {name}'s Stremio", { name: src.name })}</>;
  }
  if (user) {
    return <>{t("profile.signedIn")}</>;
  }
  return (
    <>
      {t("Sign in to")}{" "}
      <span
        role="link"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          openUrl(STREMIO_REGISTER_URL);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            openUrl(STREMIO_REGISTER_URL);
          }
        }}
        className="cursor-pointer text-ink transition-colors hover:text-accent"
      >
        Stremio
      </span>
    </>
  );
}
