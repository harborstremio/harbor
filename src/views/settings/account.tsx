import { useMemo, useRef, useState } from "react";
import stremioWordmark from "@/assets/stremio-wordmark.png";
import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/lib/auth";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useTogether } from "@/lib/together/provider";
import { useT } from "@/lib/i18n";
import { ColorPicker } from "./color-picker";
import { Section } from "./shared";
import { AvatarRing } from "./account/avatar-ring";
import { resizeAvatar } from "./account/avatar-utils";
import { SyncedAddonsCard } from "./account/synced-addons-card";
import { ProfilesStrip } from "./account/profiles-strip";
import { StartupDefaults } from "./account/startup-defaults";
import { SettingsScopeCard } from "./account/settings-scope-card";
import { HarborSyncCard } from "./account/harbor-sync-card";
import { AvatarFan } from "@/components/avatar-picker/avatar-fan";
import { AvatarCatalogModal } from "@/components/avatar-picker/avatar-catalog-modal";
import { avatarUrl } from "@/lib/avatars/catalog";

export function AccountStub() {
  const t = useT();
  const { user, signOut } = useAuth();
  const { settings, update } = useSettings();
  const { displayName, setDisplayName } = useTogether();
  const { activeProfile, updateProfile } = useProfiles();
  const pushIdentity = (patch: { harborColor?: string; harborAvatar?: string | null }) => {
    update(patch);
    if (!activeProfile) return;
    const profilePatch: { color?: string; avatar?: string | null } = {};
    if (patch.harborColor !== undefined) profilePatch.color = patch.harborColor;
    if (patch.harborAvatar !== undefined) profilePatch.avatar = patch.harborAvatar;
    if (Object.keys(profilePatch).length > 0) updateProfile(activeProfile.id, profilePatch);
  };
  const pushDisplayName = (next: string) => {
    setDisplayName(next);
    if (activeProfile && next && next !== activeProfile.name) {
      updateProfile(activeProfile.id, { name: next });
    }
  };
  const [showAuth, setShowAuth] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);
  const [editingName, setEditingName] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  const [prevDisplayName, setPrevDisplayName] = useState(displayName);
  if (prevDisplayName !== displayName) {
    setPrevDisplayName(displayName);
    setNameDraft(displayName);
  }

  const stremioAvatar = user?.avatar ?? null;
  const harborAvatar = settings.harborAvatar;
  const customAvatar = activeProfile?.avatar ?? harborAvatar ?? null;
  const effectiveAvatar = customAvatar ?? stremioAvatar;

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resizeAvatar(file, 320);
      pushIdentity({ harborAvatar: dataUrl });
    } catch (err) {
      console.warn("[avatar] resize failed", err);
    }
  };

  const maskedEmail = useMemo(() => {
    if (!user?.email) return "";
    const [local, domain] = user.email.split("@");
    if (!domain) return "*****";
    const visible = local.slice(0, 1);
    return `${visible}${"*".repeat(Math.max(local.length - 1, 4))}@${domain}`;
  }, [user]);

  return (
    <div className="flex flex-col gap-5">
      <Section
        title={t("Harbor identity")}
        subtitle={t(
          "How you appear in Watch Together, sessions, and chat. Sits on top of your Stremio account.",
        )}
      >
        <div className="flex flex-col gap-4 rounded-2xl border border-edge-soft bg-canvas/40 p-5">
          <div className="flex items-center gap-5">
            <AvatarRing src={effectiveAvatar} size={88} onClick={() => fileRef.current?.click()} />
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onPickFile}
              className="hidden"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        pushDisplayName(nameDraft.trim() || displayName);
                        setEditingName(false);
                      }
                      if (e.key === "Escape") {
                        setNameDraft(displayName);
                        setEditingName(false);
                      }
                    }}
                    className="h-10 flex-1 rounded-xl border border-ink bg-elevated px-3 text-[15px] font-semibold text-ink outline-none"
                  />
                  <button
                    onClick={() => {
                      pushDisplayName(nameDraft.trim() || displayName);
                      setEditingName(false);
                    }}
                    className="h-10 rounded-xl bg-ink px-4 text-[12.5px] font-semibold text-canvas"
                  >
                    {t("Save")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0 self-start rounded-lg px-1 py-0.5 text-start transition-colors hover:bg-canvas/50"
                >
                  <span className="font-display text-[24px] font-medium leading-tight tracking-tight text-ink">
                    {displayName}
                  </span>
                  {user && (
                    <span className="text-[13px] text-ink-subtle">
                      ({user.fullname || user.email.split("@")[0]})
                    </span>
                  )}
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className="text-ink-subtle"
                  >
                    <path
                      d="M16.5 4.5l3 3-11 11H5.5v-3l11-11z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-edge-soft px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                  {t("Upload photo")}
                </button>
                {customAvatar && (
                  <button
                    onClick={() => pushIdentity({ harborAvatar: null })}
                    className="flex h-9 items-center rounded-lg border border-edge-soft px-3 text-[12.5px] font-medium text-ink-subtle transition-colors hover:border-danger/40 hover:text-danger"
                  >
                    {stremioAvatar ? t("Reset to Stremio avatar") : t("Reset to default")}
                  </button>
                )}
              </div>
              <AvatarFan
                onClick={() => setAvatarPickerOpen(true)}
                onRandomize={(id) => pushIdentity({ harborAvatar: avatarUrl(id) })}
              />
              <ColorPicker
                value={settings.harborColor}
                onChange={(c) => pushIdentity({ harborColor: c })}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title={t("Profiles")}
        subtitle={t(
          "Everyone who uses this Harbor gets their own watch history, avatar, color, and optional PIN. Switch anytime.",
        )}
      >
        <div className="flex flex-col gap-5 rounded-2xl border border-edge-soft bg-canvas/40 p-5">
          <ProfilesStrip />
          <StartupDefaults />
          <SettingsScopeCard />
        </div>
      </Section>

      <Section
        title={t("Stremio account")}
        subtitle={t("Library, watch progress, and addon collection sync from this account.")}
      >
        {user ? (
          <div className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-edge-soft bg-canvas/40 p-5">
            <img
              src={stremioWordmark}
              alt=""
              aria-hidden
              className="pointer-events-none absolute end-5 bottom-4 h-9 w-auto opacity-45 select-none"
              style={{ filter: "invert(1) grayscale(1) brightness(1.1)" }}
              draggable={false}
            />
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
                  {t("Email")}
                </span>
                <span className="truncate font-mono text-[14.5px] text-ink">
                  {reveal ? user.email : maskedEmail}
                </span>
              </div>
              <button
                onClick={() => setReveal((v) => !v)}
                className="flex h-9 shrink-0 items-center rounded-lg border border-edge-soft px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                {reveal ? t("Hide") : t("Reveal")}
              </button>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
                  {t("Stremio ID")}
                </span>
                <span className="truncate font-mono text-[12.5px] text-ink-muted">{user._id}</span>
              </div>
            </div>
            <div className="mt-1 flex items-center gap-2 border-t border-edge-soft/60 pt-3">
              <button
                onClick={() => setShowAuth(true)}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-edge-soft px-4 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                {t("Re-authenticate")}
              </button>
              <button
                onClick={signOut}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-edge-soft px-4 text-[12.5px] font-medium text-ink-subtle transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
              >
                {t("Sign out")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-edge-soft bg-canvas/40 p-5">
            <div className="flex flex-col">
              <span className="text-[14px] font-medium text-ink">{t("Not signed in")}</span>
              <span className="text-[12.5px] text-ink-subtle">
                {t("Sign in to sync your library, watch progress, and addons.")}
              </span>
            </div>
            <button
              onClick={() => setShowAuth(true)}
              className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02]"
            >
              {t("Sign in")}
            </button>
          </div>
        )}
      </Section>

      <HarborSyncCard />

      <Section
        title={t("Synced addons")}
        subtitle={t(
          "Harbor pulls your addon collection from Stremio. Manage individual addons in Streaming sources.",
        )}
      >
        <SyncedAddonsCard />
      </Section>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {avatarPickerOpen && (
        <AvatarCatalogModal
          current={effectiveAvatar}
          onPick={(id) => {
            pushIdentity({ harborAvatar: avatarUrl(id) });
            setAvatarPickerOpen(false);
          }}
          onClose={() => setAvatarPickerOpen(false)}
        />
      )}
    </div>
  );
}
