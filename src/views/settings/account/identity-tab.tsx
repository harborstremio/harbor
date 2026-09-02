import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useTogether } from "@/lib/together/provider";
import { useT } from "@/lib/i18n";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import { useAuth } from "@/lib/auth";
import { nameEquals } from "@/lib/account/name-sync";
import { AvatarFan } from "@/components/avatar-picker/avatar-fan";
import { AvatarCatalogModal } from "@/components/avatar-picker/avatar-catalog-modal";
import { CustomColorPanel, HARBOR_COLOR_SWATCHES } from "../color-picker";
import { ModalButton, SettingsModal, ROW_ACTION } from "../kit";
import { Section } from "../shared";
import { ProfileAudioSetting } from "../profile-audio-setting";
import { AvatarRing } from "./avatar-ring";
import { resizeAvatar } from "./avatar-utils";

export function IdentityTab() {
  const t = useT();
  const { user } = useAuth();
  const { settings, update } = useSettings();
  const { displayName, setDisplayName } = useTogether();
  const { activeProfile, updateProfile } = useProfiles();
  const [harborAuthor, setHarborAuthor] = useState(currentAuthor);
  useEffect(() => subscribeAuthor(() => setHarborAuthor(currentAuthor())), []);

  const [nameDraft, setNameDraft] = useState(displayName);
  const [colorOpen, setColorOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameDraft(displayName);
  }, [displayName]);

  const pushIdentity = (patch: { harborColor?: string; harborAvatar?: string | null }) => {
    update(patch);
    if (!activeProfile) return;
    const profilePatch: { color?: string; avatar?: string | null } = {};
    if (patch.harborColor !== undefined) profilePatch.color = patch.harborColor;
    if (patch.harborAvatar !== undefined) profilePatch.avatar = patch.harborAvatar;
    if (Object.keys(profilePatch).length > 0) updateProfile(activeProfile.id, profilePatch);
  };

  const pushDisplayName = (next: string) => {
    const trimmed = next.trim();
    if (nameEquals(trimmed, displayName)) return;
    setDisplayName(next);
    if (activeProfile && trimmed && trimmed !== activeProfile.name) {
      updateProfile(activeProfile.id, { name: trimmed });
    }
  };

  const stremioAvatar = user?.avatar ?? null;
  const customAvatar = activeProfile?.avatar ?? settings.harborAvatar ?? null;
  const effectiveAvatar = customAvatar ?? stremioAvatar;
  const nameDirty = !nameEquals(nameDraft.trim(), displayName);
  const commitName = () => pushDisplayName(nameDraft.trim() || displayName);

  const color = settings.harborColor;
  const isPresetColor = HARBOR_COLOR_SWATCHES.includes(color.toLowerCase());

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

  return (
    <>
      <Section
        title={t("Harbor identity")}
        subtitle={t("Your avatar, name, and handle across Harbor.")}
      >
        <div className="flex flex-col gap-5 rounded-md bg-elevated p-5">
          <div className="flex flex-wrap items-center gap-5">
            <AvatarRing src={effectiveAvatar} size={76} onClick={() => fileRef.current?.click()} />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="inline-grid max-w-full">
                  <span
                    aria-hidden
                    className="invisible col-start-1 row-start-1 whitespace-pre rounded-md px-1 font-display text-[22px] font-medium leading-tight tracking-tight"
                  >
                    {nameDraft || " "}
                  </span>
                  <input
                    value={nameDraft}
                    size={1}
                    maxLength={32}
                    aria-label={t("Display name")}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        commitName();
                        e.currentTarget.blur();
                      }
                      if (e.key === "Escape") {
                        setNameDraft(displayName);
                        e.currentTarget.blur();
                      }
                    }}
                    className="col-start-1 row-start-1 w-full min-w-0 rounded-md bg-transparent px-1 font-display text-[22px] font-medium leading-tight tracking-tight text-ink outline-none transition-colors hover:bg-canvas focus:bg-canvas"
                  />
                </span>
                {harborAuthor?.handle ? (
                  <span className="text-[13px] font-medium text-ink-subtle">
                    @{harborAuthor.handle}
                  </span>
                ) : user ? (
                  <span className="text-[13px] text-ink-subtle">
                    ({user.fullname || user.email.split("@")[0]})
                  </span>
                ) : null}
                {nameDirty && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={commitName}
                    className="h-8 shrink-0 rounded-md bg-ink px-3.5 text-[12.5px] font-semibold text-canvas"
                  >
                    {t("Save")}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onPickFile}
              className="hidden"
            />
            <button type="button" onClick={() => fileRef.current?.click()} className={ROW_ACTION}>
              {t("Upload photo")}
            </button>
            <AvatarFan
              onClick={() => setAvatarPickerOpen(true)}
              onRandomize={(value) => pushIdentity({ harborAvatar: value })}
            />
            {customAvatar && (
              <button
                type="button"
                onClick={() => pushIdentity({ harborAvatar: null })}
                className="flex h-9 shrink-0 items-center rounded-md bg-canvas px-3 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-danger"
              >
                {stremioAvatar ? t("Reset to Stremio avatar") : t("Reset to default")}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="me-1 text-[12.5px] font-medium text-ink-subtle">{t("Your color")}</span>
            {HARBOR_COLOR_SWATCHES.map((hex) => {
              const selected = color.toLowerCase() === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => pushIdentity({ harborColor: hex })}
                  aria-label={hex}
                  aria-pressed={selected}
                  className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full transition-transform hover:scale-105"
                  style={{ background: hex }}
                >
                  {selected && (
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-ink text-canvas">
                      <Check size={12} strokeWidth={3.2} />
                    </span>
                  )}
                </button>
              );
            })}
            <button type="button" onClick={() => setColorOpen(true)} className={ROW_ACTION}>
              <span
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ background: color }}
              />
              {isPresetColor ? t("Custom") : color.toUpperCase()}
            </button>
          </div>
        </div>
      </Section>

      <ProfileAudioSetting />

      <SettingsModal
        open={colorOpen}
        onClose={() => setColorOpen(false)}
        title={t("Your color")}
        width={380}
        actions={<ModalButton onClick={() => setColorOpen(false)}>{t("Done")}</ModalButton>}
      >
        <CustomColorPanel value={color} onChange={(c) => pushIdentity({ harborColor: c })} />
      </SettingsModal>

      {avatarPickerOpen && (
        <AvatarCatalogModal
          current={effectiveAvatar}
          onPick={(value) => {
            pushIdentity({ harborAvatar: value });
            setAvatarPickerOpen(false);
          }}
          onClose={() => setAvatarPickerOpen(false)}
        />
      )}
    </>
  );
}
