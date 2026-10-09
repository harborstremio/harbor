import { useState } from "react";
import { FileVideo, Play, Plus, Trash2 } from "../icons";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import {
  activeScreensaverMedia,
  newScreensaverMedia,
  pickScreensaverFiles,
  previewScreensaver,
  screensaverMediaSrc,
} from "@/lib/screensaver/media";
import type { ScreensaverMedia } from "@/lib/settings/types";
import { ROW_ACTION, ROW_ACTION_DANGER, ROW_ACTION_PRIMARY, SettingRow } from "../kit";

export function ScreensaverMediaManager() {
  const t = useT();
  const { settings, update } = useSettings();
  const [busy, setBusy] = useState(false);
  const list = settings.screensaverMedia;
  const active = activeScreensaverMedia(list, settings.screensaverMediaId);

  const add = async () => {
    setBusy(true);
    try {
      const paths = await pickScreensaverFiles();
      const fresh = paths
        .map(newScreensaverMedia)
        .filter((m): m is ScreensaverMedia => m !== null && !list.some((x) => x.path === m.path));
      if (fresh.length === 0) return;
      update({
        screensaverMedia: [...list, ...fresh],
        screensaverMediaId: active ? settings.screensaverMediaId : fresh[0].id,
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) => {
    const next = list.filter((m) => m.id !== id);
    update({
      screensaverMedia: next,
      screensaverMediaId:
        settings.screensaverMediaId === id ? (next[0]?.id ?? null) : settings.screensaverMediaId,
    });
  };

  return (
    <SettingRow
      wide
      icon={<FileVideo size={18} strokeWidth={2} />}
      label={t("Your screensavers")}
      desc={t(
        "Add videos, GIFs, or images from this computer. Videos loop with the sound off, and everything fills the screen.",
      )}
    >
      <div className="flex w-full flex-col gap-2.5">
        {list.length === 0 && (
          <p className="text-[14.5px] text-ink-subtle">
            {t("Nothing added yet. The default screensaver plays until you add one.")}
          </p>
        )}
        {list.map((m) => (
          <MediaRow
            key={m.id}
            media={m}
            inUse={active?.id === m.id}
            onUse={() => update({ screensaverMediaId: m.id })}
            onRemove={() => remove(m.id)}
          />
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy}
            className={ROW_ACTION_PRIMARY}
          >
            <Plus size={18} strokeWidth={2.2} />
            {t("Add video, GIF, or image")}
          </button>
          {active && (
            <button type="button" onClick={previewScreensaver} className={ROW_ACTION}>
              <Play size={18} strokeWidth={2.2} />
              {t("Try it now")}
            </button>
          )}
        </div>
      </div>
    </SettingRow>
  );
}

function MediaRow({
  media,
  inUse,
  onUse,
  onRemove,
}: {
  media: ScreensaverMedia;
  inUse: boolean;
  onUse: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const src = screensaverMediaSrc(media.path);
  const kind = media.kind === "video" ? t("Video") : media.kind === "gif" ? t("GIF") : t("Image");
  return (
    <div
      className={`flex items-center gap-3 rounded-[10px] bg-elevated px-3 py-2 ring-1 ${
        inUse ? "ring-accent/50" : "ring-edge-soft"
      }`}
    >
      <span className="h-10 w-[68px] shrink-0 overflow-hidden rounded-[6px] bg-canvas">
        {media.kind === "video" ? (
          <video src={src} muted preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14.5px] font-medium text-ink">{media.name}</span>
        <span className="text-[12.5px] text-ink-subtle">
          {inUse ? t("{kind} · In use", { kind }) : kind}
        </span>
      </span>
      {!inUse && (
        <button type="button" onClick={onUse} className={ROW_ACTION}>
          {t("Use")}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("Remove")}
        className={ROW_ACTION_DANGER}
      >
        <Trash2 size={18} strokeWidth={2.2} />
      </button>
    </div>
  );
}
