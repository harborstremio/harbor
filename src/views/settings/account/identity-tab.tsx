import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Palette } from "../icons";
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
import { ModalButton, SettingsModal, SettingRow, ROW_ACTION, ROW_ACTION_DANGER, ROW_ACTION_PRIMARY } from "../kit";
import { ROW_DESC, Section } from "../shared";
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
        title={t("Harbor identity")}
        subtitle={t("Your avatar, name, and handle across Harbor.")}
      >
        <div className="flex flex-wrap items-center gap-5 py-3">
          <AvatarRing src={effectiveAvatar} size={76} onClick={() => fileRef.current?.click()} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-grid max-w-full">
              <span
                aria-hidden
                className="invisible col-start-1 row-start-1 h-11 whitespace-pre rounded-[10px] px-2 font-display text-[22px] font-medium leading-[44px] tracking-tight"
              >
                {nameDraft || " "}
              </span>
              <input
                value={nameDraft}
                size={1}
                maxLength={32}
                aria-label={t("Display name")}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.currentTarget.hasAttribute("data-search-editing")) return;
                  if (e.key === "Enter") {
                    commitName();
                    e.currentTarget.blur();
                  }
                  if (e.key === "Escape") {
                    setDraft(displayName);
                    e.currentTarget.blur();
                  }
                }}
                className="col-start-1 row-start-1 h-11 w-full min-w-0 rounded-[10px] bg-transparent px-2 font-display text-[22px] font-medium leading-[44px] tracking-tight text-ink outline-none transition-colors hover:bg-elevated focus:bg-elevated"
              />
            </span>
            {harborAuthor?.handle ? (
              <span className={`${ROW_DESC} shrink-0`}>@{harborAuthor.handle}</span>
            ) : user ? (
              <span className={`${ROW_DESC} shrink-0`}>
                ({user.fullname || user.email.split("@")[0]})
              </span>
            ) : null}
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
