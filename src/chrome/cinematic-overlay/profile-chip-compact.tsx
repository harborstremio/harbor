import { CatAvatar } from "@/components/icons/cat-avatar";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { LogOut, Pencil, Settings as SettingsIcon, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ProfileChipCompact({
  onOpenSettings,
  settingsActive,
}: {
  onOpenSettings: () => void;
  settingsActive: boolean;
}) {
  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  const { profiles, activeProfile, openPicker, selectProfile } = useProfiles();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const name = activeProfile?.name ?? user?.fullname ?? user?.email?.split("@")[0] ?? t("profile.fallback");
  const color = activeProfile?.color ?? "#7cd6ff";
  const avatarSrc = activeProfile?.avatar ?? settings.harborAvatar ?? user?.avatar ?? null;
  const otherProfiles = profiles.filter((p) => p.id !== activeProfile?.id);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-open={String(open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-2 rounded-full ps-1 pe-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-white/12 hover:text-ink"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/25"
          style={{ background: color }}
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <CatAvatar className="h-full w-full" />
          )}
        </span>
        <span className="hidden max-w-[8rem] truncate sm:inline">{name}</span>
      </button>
      {open && (
        <div className="harbor-profile-dropdown absolute end-0 top-[calc(100%+8px)] z-40 w-60 overflow-hidden rounded-2xl border border-white/15 bg-canvas/95 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="text-[13.5px] font-semibold text-ink">{name}</div>
            {user?.email && <div className="truncate text-[11.5px] text-ink-subtle">{user.email}</div>}
          </div>
          {otherProfiles.length > 0 && (
            <div className="flex flex-col gap-0.5 border-b border-white/10 p-1.5">
              <span className="px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                {t("profile.switch")}
              </span>
              {otherProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    if (p.passwordHash) {
                      openPicker({ kind: "unlock", profileId: p.id });
                    } else {
                      selectProfile(p.id);
                    }
                  }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-white/10"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-canvas"
                    style={{ background: p.color }}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate text-[12.5px] text-ink">{p.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => {
                openPicker({ kind: "list" });
                setOpen(false);
              }}
              className="flex items-center gap-2.5 px-4 py-2.5 text-start text-[13px] text-ink-muted transition-colors hover:bg-white/10 hover:text-ink"
            >
              <Users size={13} strokeWidth={2.2} /> {t("profile.whoWatching")}
            </button>
            {activeProfile && (
              <button
                type="button"
                onClick={() => {
                  openPicker({ kind: "edit", profileId: activeProfile.id });
                  setOpen(false);
                }}
                className="flex items-center gap-2.5 px-4 py-2.5 text-start text-[13px] text-ink-muted transition-colors hover:bg-white/10 hover:text-ink"
              >
                <Pencil size={13} strokeWidth={2.2} /> {t("Edit profile")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onOpenSettings();
                setOpen(false);
              }}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-start text-[13px] transition-colors hover:bg-white/10 ${
                settingsActive ? "text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              <SettingsIcon size={13} strokeWidth={2.2} /> {t("nav.settings")}
            </button>
            {user && (
              <button
                type="button"
                onClick={() => {
                  signOut();
                  setOpen(false);
                }}
                className="flex items-center gap-2.5 border-t border-white/10 px-4 py-2.5 text-start text-[13px] text-ink-muted transition-colors hover:bg-white/10 hover:text-ink"
              >
                <LogOut size={13} strokeWidth={2.2} /> {t("Sign out")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
