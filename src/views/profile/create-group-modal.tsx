import { Camera, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createGroup, setGroupAvatar, type GroupDetail, type GroupVisibility } from "@/lib/social/groups";
import { Avatar } from "./profile-bits";
import { fileToWebp } from "./group-image-utils";
import { GroupTagsInput } from "./group-tags-input";
import { VisibilityToggle } from "./group-visibility-toggle";
import { useT } from "@/lib/i18n";

export function CreateGroupModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (g: GroupDetail) => void;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<GroupVisibility>("invite");
  const [tags, setTags] = useState<string[]>([]);
  const [pickedBlob, setPickedBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const blob = await fileToWebp(file, 512);
      if (preview) URL.revokeObjectURL(preview);
      setPickedBlob(blob);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setError((e as Error).message || t("Could not read image."));
    }
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const created = await createGroup(trimmed, { description, visibility, tags }).catch((e) => {
      const code = (e as Error).message;
      setError(
        code === "duplicate_name"
          ? t("You already have a group with this name.")
          : code || t("Could not create group."),
      );
      return null;
    });
    if (!created) {
      setBusy(false);
      return;
    }
    try {
      const final = pickedBlob ? await setGroupAvatar(created.id, pickedBlob) : created;
      onCreated(final);
    } catch {
      onCreated(created);
    }
    onClose();
  };

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[230] flex items-start justify-center bg-canvas/80 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in flex w-[min(94vw,460px)] flex-col rounded-2xl border border-edge-soft bg-elevated shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="font-display text-[19px] font-medium text-ink">{t("Create group")}</h2>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 pb-2 pt-4">
          <div className="flex items-center gap-4">
            <Avatar src={preview} size={64} alias={name} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-surface px-3 text-[13px] font-medium text-ink ring-1 ring-edge-soft transition-colors hover:bg-raised"
            >
              <Camera size={15} /> {preview ? t("Change photo") : t("Add photo")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void pickAvatar(e.target.files?.[0])}
            />
          </div>

          <label className="block">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-ink">{t("Name")}</span>
              <span className="text-[12px] text-ink-subtle">{name.length}/48</span>
            </div>
            <input
              autoFocus
              value={name}
              maxLength={48}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Late-night sci-fi crew")}
              className="w-full min-h-11 rounded-md bg-surface px-3 text-[14px] text-ink outline-none ring-1 ring-edge-soft placeholder:text-ink-subtle focus:ring-edge"
            />
          </label>

          <label className="block">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-ink">{t("Description")}</span>
              <span className="text-[12px] text-ink-subtle">{description.length}/200</span>
            </div>
            <textarea
              value={description}
              maxLength={200}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("What this group is about (optional)")}
              className="w-full resize-none rounded-md bg-surface px-3 py-2.5 text-[14px] text-ink outline-none ring-1 ring-edge-soft placeholder:text-ink-subtle focus:ring-edge"
            />
          </label>

          <div>
            <div className="mb-1.5 text-[13px] font-medium text-ink">{t("Who can join")}</div>
            <VisibilityToggle value={visibility} onChange={setVisibility} />
          </div>

          <div>
            <div className="mb-1.5 text-[13px] font-medium text-ink">{t("Tags")}</div>
            <GroupTagsInput tags={tags} onChange={setTags} />
          </div>

          {error && (
            <p className="rounded-lg bg-danger/15 px-3 py-2 text-[12.5px] text-danger">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-2">
          <button
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-md px-4 text-[14px] font-medium text-ink-muted transition-colors hover:bg-surface"
          >
            {t("Cancel")}
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy || !name.trim()}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? t("Creating") : t("Create")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
