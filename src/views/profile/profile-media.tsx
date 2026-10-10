import { Camera, ImageIcon, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useProfiles } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import { fileToBannerWebp, removeBanner, uploadBanner } from "@/lib/social/banner";
import { removeAvatar as removeEcosystemAvatar, uploadAvatar } from "@/lib/social/avatar";
import { markAvatarSynced } from "@/lib/account/avatar-sync";
import { currentAuthor } from "@/lib/theme-auth";
import { Avatar } from "./profile-bits";
import type { ProfileSummary } from "./profile-types";

async function fileToWebp(file: File, max: number, t: ReturnType<typeof useT>): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(t("That image could not be read.")));
      img.src = url;
    });
    const size = Math.min(max, Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(t("Canvas unavailable."));
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/webp", 0.9));
    if (!blob) throw new Error(t("Could not process image."));
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ProfileMedia({
  summary,
  onSaved,
}: {
  summary: ProfileSummary;
  onSaved: (next: ProfileSummary) => void;
}) {
  const t = useT();
  const { activeProfile, updateProfile } = useProfiles();
  const { update: updateSettings } = useSettings();
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(summary.avatarUrl || currentAuthor()?.avatar || undefined);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(summary.bannerUrl || undefined);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const syncLocalAvatar = (url: string | null) => {
    updateSettings({ harborAvatar: url });
    if (activeProfile) updateProfile(activeProfile.id, { avatar: url });
  };

  const pickAvatar = async (file: File | undefined) => {
    if (!file || avatarBusy) return;
    setAvatarBusy(true);
    setError(null);
    try {
      const blob = await fileToWebp(file, 512, t);
      const result = await uploadAvatar(blob);
      const next = result.avatarUrl ?? undefined;
      setAvatarUrl(next);
      syncLocalAvatar(next ?? null);
      markAvatarSynced(next ?? null);
      onSaved({ ...summary, avatarUrl: next });
    } catch (e) {
      setError((e as Error).message || t("Could not update photo."));
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    if (avatarBusy) return;
    setAvatarBusy(true);
    setError(null);
    try {
      await removeEcosystemAvatar();
      setAvatarUrl(undefined);
      syncLocalAvatar(null);
      markAvatarSynced(null);
      onSaved({ ...summary, avatarUrl: undefined });
    } catch (e) {
      setError((e as Error).message || t("Could not remove photo."));
    } finally {
      setAvatarBusy(false);
    }
  };

  const pickBanner = async (file: File | undefined) => {
    if (!file || bannerBusy) return;
    setBannerBusy(true);
    setError(null);
    try {
      const blob = await fileToBannerWebp(file);
      const next = await uploadBanner(blob);
      setBannerUrl(next.bannerUrl);
      onSaved({ ...summary, bannerUrl: next.bannerUrl });
    } catch (e) {
      setError((e as Error).message || t("Could not update banner."));
    } finally {
      setBannerBusy(false);
    }
  };

  const clearBanner = async () => {
    if (bannerBusy) return;
    setBannerBusy(true);
    setError(null);
    try {
      const next = await removeBanner();
      setBannerUrl(undefined);
      onSaved({ ...summary, bannerUrl: next.bannerUrl });
    } catch (e) {
      setError((e as Error).message || t("Could not remove banner."));
    } finally {
      setBannerBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar src={avatarUrl} size={72} alias={summary.alias} />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarBusy}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-elevated px-3 text-[13px] font-medium text-ink ring-1 ring-edge-soft hover:bg-raised disabled:opacity-50"
            >
              <Camera size={15} /> {avatarBusy ? t("Saving") : t("Change photo")}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={avatarBusy}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink-muted transition-colors hover:text-danger disabled:opacity-50"
              >
                <Trash2 size={15} /> {t("Remove")}
              </button>
            )}
          </div>
          <span className="text-[12px] text-ink-subtle">{t("Stored as a small optimized webp.")}</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => void pickAvatar(e.target.files?.[0])}
        />
      </div>

      <div className="space-y-2">
        <span className="text-[13px] font-medium text-ink">{t("Profile background")}</span>
        <div className="relative aspect-[3/1] w-full overflow-hidden rounded-lg bg-elevated ring-1 ring-edge-soft">
          {bannerUrl ? (
            <img src={bannerUrl} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: "linear-gradient(135deg, var(--color-elevated), var(--color-surface) 55%, var(--color-canvas))" }}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => bannerRef.current?.click()}
            disabled={bannerBusy}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-elevated px-3 text-[13px] font-medium text-ink ring-1 ring-edge-soft hover:bg-raised disabled:opacity-50"
          >
            <ImageIcon size={20} /> {bannerBusy ? t("Saving") : bannerUrl ? t("Change banner") : t("Add banner")}
          </button>
          {bannerUrl && (
            <button
              type="button"
              onClick={clearBanner}
              disabled={bannerBusy}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink-muted transition-colors hover:text-danger disabled:opacity-50"
            >
              <Trash2 size={15} /> {t("Remove")}
            </button>
          )}
        </div>
        <input
          ref={bannerRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => void pickBanner(e.target.files?.[0])}
        />
      </div>

      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}
