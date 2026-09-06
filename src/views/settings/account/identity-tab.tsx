import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Palette } from "../icons";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { useTogether } from "@/lib/together/provider";
import { useT } from "@/lib/i18n";
import { currentAuthor, subscribeAuthor } from "@/lib/theme-auth";
import { useAuth } from "@/lib/auth";
import { nameEquals } from "@/lib/account/name-sync";
import { navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { AvatarFan } from "@/components/avatar-picker/avatar-fan";
import { AvatarCatalogModal } from "@/components/avatar-picker/avatar-catalog-modal";
import { CustomColorPanel, HARBOR_COLOR_SWATCHES } from "../color-picker";
import { ModalButton, SettingsModal, SettingRow, ROW_ACTION, ROW_ACTION_DANGER, ROW_ACTION_PRIMARY } from "../kit";
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
  const draftRef = useRef(displayName);
  const [colorOpen, setColorOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setDraft = (next: string) => {
    draftRef.current = next;
    setNameDraft(next);
  };

  useEffect(() => {
    draftRef.current = displayName;
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
  const commitName = () => pushDisplayName(draftRef.current.trim() || displayName);

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
        title={t("Your profile")}
        subtitle={t("Your avatar, name, and handle across Harbor.")}
      >
        <div className="hset-profile-identity flex items-center gap-5 pt-2">
          <AvatarRing src={effectiveAvatar} size={76} onClick={() => fileRef.current?.click()} />
          <div className="flex min-w-0 max-w-[440px] flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-end gap-2">
            <label className="flex w-full max-w-[340px] flex-col gap-2 text-[14px] text-ink-muted">
              <span>{t("Display name")}</span>
              <span className="flex h-12 w-full min-w-0 items-center gap-3 rounded-[10px] border border-edge-soft bg-elevated px-3 transition-colors hover:border-edge focus-within:border-ink-muted">
              <input
                value={nameDraft}
                maxLength={32}
                aria-label={t("Display name")}
                aria-describedby={harborAuthor?.handle ? "hset-profile-handle" : undefined}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.currentTarget.hasAttribute("data-search-editing") || navOwnsFocus(e.currentTarget)) return;
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    commitName();
                    e.currentTarget.blur();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    setDraft(displayName);
                    e.currentTarget.blur();
                  }
                }}
                className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[17px] font-medium text-ink outline-none"
              />
              {harborAuthor?.handle && (
                <span id="hset-profile-handle" title={`@${harborAuthor.handle}`} className="max-w-[45%] shrink-0 truncate text-[14px] leading-5 text-ink-muted">
                  @{harborAuthor.handle}
                </span>
              )}
              </span>
            </label>
            {nameDirty && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={commitName}
                className={ROW_ACTION_PRIMARY}
              >
                {t("Save")}
              </button>
            )}
            </div>
          </div>
        </div>

        <SettingRow
          wide
          icon={<ImagePlus size={18} strokeWidth={2} />}
          label={t("Avatar")}
          desc={t("Upload a picture of your own, or pick one from the Harbor catalog.")}
        >
          <div className="flex w-full flex-wrap items-center gap-2.5">
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
                className={ROW_ACTION_DANGER}
              >
                {stremioAvatar ? t("Reset to Stremio avatar") : t("Reset to default")}
              </button>
            )}
          </div>
        </SettingRow>

        <SettingRow
          wide
          icon={<Palette size={18} strokeWidth={2} />}
          label={t("Your color")}
          desc={t("Colors your name, your cursor in Watch Together, and the ring around your avatar.")}
        >
          <div className="flex w-full flex-wrap items-center gap-2.5">
            {HARBOR_COLOR_SWATCHES.map((hex) => {
              const selected = color.toLowerCase() === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => pushIdentity({ harborColor: hex })}
                  aria-label={hex}
                  aria-pressed={selected}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] transition-colors hover:bg-elevated"
                >
                  <span
                    className="grid h-7 w-7 place-items-center rounded-full"
                    style={{ background: hex }}
                  >
                    {selected && (
                      <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-ink text-canvas">
                        <Check size={13} strokeWidth={3.2} />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            <button type="button" onClick={() => setColorOpen(true)} className={ROW_ACTION}>
              <span
                aria-hidden
                className="h-4 w-4 shrink-0 rounded-full"
                style={{ background: color }}
              />
              {isPresetColor ? t("Custom") : color.toUpperCase()}
            </button>
          </div>
        </SettingRow>
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
