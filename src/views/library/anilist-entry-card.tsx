import { Check, ChevronDown, Minus, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { AnchoredMenu } from "@/components/anchored-menu";
import { Poster, usePosterChain } from "@/components/poster";
import { anilistMediaToMeta } from "@/lib/anilist/to-meta";
import type { AnilistMediaEntry, MediaListStatus } from "@/lib/anilist/types";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";

const STATUS_LABELS: Record<MediaListStatus, string> = {
  CURRENT: "Watching",
  PLANNING: "Plan to Watch",
  COMPLETED: "Completed",
  REPEATING: "Rewatching",
  PAUSED: "On Hold",
  DROPPED: "Dropped",
};

const STATUS_ORDER: MediaListStatus[] = [
  "CURRENT",
  "PLANNING",
  "COMPLETED",
  "REPEATING",
  "PAUSED",
  "DROPPED",
];

export function AnilistEntryCard({
  entry,
  busy,
  onStatus,
  onProgress,
  onRemove,
}: {
  entry: AnilistMediaEntry;
  busy: boolean;
  onStatus: (s: MediaListStatus) => void;
  onProgress: (p: number) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const { openMeta } = useView();
  const m = entry.media;
  const name = m.title.userPreferred || m.title.english || m.title.romaji || t("Untitled");
  const total = m.episodes ?? null;
  const atCeiling = total != null && entry.progress >= total;
  const metaId = m.idMal != null ? `mal:${m.idMal}` : `anilist:${m.id}`;
  const poster = usePosterChain(
    settings.rpdbKey,
    metaId,
    m.coverImage.extraLarge ?? m.coverImage.large ?? undefined,
    m.format === "MOVIE" ? "movie" : "series",
  );

  const open = () => {
    const meta = anilistMediaToMeta(m);
    if (meta) openMeta(meta);
  };

  return (
    <div className="group relative flex flex-col gap-2 text-start">
      <button
        type="button"
        onClick={open}
        className="relative aspect-[2/3] overflow-hidden rounded-xl bg-elevated shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] transition-transform duration-200 group-hover:scale-[1.02]"
      >
        <Poster
          src={poster.src}
          onError={poster.onError}
          seed={String(m.id)}
          className="h-full w-full"
        />
        <span
          role="button"
          aria-label={t("Remove from AniList")}
          onClick={(e) => {
            e.stopPropagation();
            if (!busy) onRemove();
          }}
          className="absolute end-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-canvas/85 text-ink-muted opacity-0 ring-1 ring-edge-soft backdrop-blur-sm transition-opacity hover:text-danger group-hover:opacity-100"
        >
          <Trash2 size={13} />
        </span>
      </button>

      <button
        type="button"
        onClick={open}
        className="truncate text-start text-[13px] font-medium text-ink"
      >
        {name}
      </button>

      <StatusDropdown value={entry.status} disabled={busy} onChange={onStatus} />

      <div className="flex items-center justify-between rounded-lg bg-elevated/50 ring-1 ring-edge-soft">
        <button
          type="button"
          aria-label={t("Decrease progress")}
          disabled={busy || entry.progress <= 0}
          onClick={() => onProgress(entry.progress - 1)}
          className="flex h-11 w-11 items-center justify-center rounded-s-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"
        >
          <Minus size={15} strokeWidth={2.4} />
        </button>
        <span className="flex-1 text-center text-[12.5px] tabular-nums text-ink">
          {entry.progress}
          {total != null ? ` / ${total}` : ""}
        </span>
        <button
          type="button"
          aria-label={t("Increase progress")}
          disabled={busy || atCeiling}
          onClick={() => onProgress(entry.progress + 1)}
          className="flex h-11 w-11 items-center justify-center rounded-e-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"
        >
          <Plus size={15} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

function StatusDropdown({
  value,
  disabled,
  onChange,
}: {
  value: MediaListStatus;
  disabled: boolean;
  onChange: (s: MediaListStatus) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg bg-elevated/50 px-3 text-[12.5px] font-medium text-ink ring-1 ring-edge-soft transition-colors hover:ring-edge disabled:opacity-60"
      >
        <span className="truncate">{t(STATUS_LABELS[value])}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnchoredMenu anchorRef={btnRef} open={open} onClose={() => setOpen(false)} width={168}>
        <div className="overflow-hidden rounded-xl border border-edge bg-raised py-1 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.8)]">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-[12.5px] transition-colors ${
                s === value
                  ? "bg-elevated/60 text-ink"
                  : "text-ink-muted hover:bg-elevated/40 hover:text-ink"
              }`}
            >
              {t(STATUS_LABELS[s])}
              {s === value && <Check size={13} className="text-ink" />}
            </button>
          ))}
        </div>
      </AnchoredMenu>
    </>
  );
}
