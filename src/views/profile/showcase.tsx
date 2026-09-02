import { Bookmark, Brush, Download, Loader2, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import { emitListToast } from "@/components/lists/list-toast";
import { clearShowcase, seedShowcaseMetaId, setThemeShowcase } from "@/lib/social/showcase";
import { myThemes, type StoreTheme } from "@/lib/theme-store";
import type { ProfileSummary, ShowcaseItem } from "./profile-types";

const KIND_LABEL: Record<ShowcaseItem["kind"], string> = {
  favorite: "All-time favorite",
  "top-genre": "Most watched genre",
  pinned: "Pinned",
  theme: "Theme",
};

function compact(n: number): string {
  if (n >= 1000000) return `${Math.round(n / 100000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}K`;
  return String(n);
}

function ThemeCard({ item }: { item: ShowcaseItem }) {
  const t = useT();
  return (
    <div className="flex w-full items-center gap-4 rounded-md p-2">
      <div
        className="w-36 shrink-0 overflow-hidden rounded-md bg-elevated ring-1 ring-edge-soft shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]"
        style={{ aspectRatio: "16/10", background: item.swatch?.[1] || undefined }}
      >
        {item.posterUrl && (
          <img
            src={item.posterUrl}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.1em] text-accent">
          {t(KIND_LABEL.theme)}
        </div>
        <div className="mt-1 truncate font-display text-[19px] text-ink">{item.title}</div>
        {item.caption && (
          <div className="mt-1 line-clamp-2 text-[13px] text-ink-muted">{item.caption}</div>
        )}
        <div className="mt-1.5 flex items-center gap-3 text-[12.5px] tabular-nums text-ink-subtle">
          <span className="inline-flex items-center gap-1">
            <Download size={13} strokeWidth={2.2} /> {compact(item.downloads ?? 0)}
          </span>
          {(item.ratingCount ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star size={13} strokeWidth={2.2} className="fill-current" /> {item.ratingAvg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ThemePicker({
  onPick,
  onClose,
  busy,
}: {
  onPick: (id: string) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const t = useT();
  const [mine, setMine] = useState<StoreTheme[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    myThemes()
      .then((list) => {
        if (!cancelled) setMine(list.filter((x) => x.status === "approved"));
      })
      .catch(() => {
        if (!cancelled) {
          setMine([]);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-3 rounded-md border border-edge-soft bg-elevated/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
          {t("Feature a theme")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close")}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={14} strokeWidth={2.4} />
        </button>
      </div>
      {mine === null ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-ink-subtle" />
        </div>
      ) : mine.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-ink-subtle">
          {failed ? t("Could not load your themes") : t("No approved themes yet")}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {mine.map((th) => (
            <button
              key={th.id}
              type="button"
              disabled={busy}
              onClick={() => onPick(th.id)}
              className="flex items-center gap-3 rounded-[8px] p-1.5 text-start transition-colors hover:bg-raised disabled:opacity-60"
            >
              <span
                className="h-10 w-16 shrink-0 overflow-hidden rounded-sm bg-raised ring-1 ring-edge-soft"
                style={{ background: th.swatch?.[1] || undefined }}
              >
                {th.cover && (
                  <img
                    src={th.cover}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-ink">{th.name}</span>
                <span className="block text-[11.5px] tabular-nums text-ink-subtle">
                  {compact(th.downloads)} {t("downloads")}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Showcase({
  item,
  onOpen,
  isOwner,
  onCleared,
}: {
  item?: ShowcaseItem;
  onOpen?: (metaId: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
  isOwner?: boolean;
  onCleared?: (summary: ProfileSummary) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (isOwner) seedShowcaseMetaId(item?.metaId);
  }, [isOwner, item?.metaId]);

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const summary = await clearShowcase();
      onCleared?.(summary);
    } catch {
      emitListToast(t("Could not update showcase"));
    } finally {
      setBusy(false);
    }
  };

  const pickTheme = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const summary = await setThemeShowcase(id);
      onCleared?.(summary);
      setPicking(false);
    } catch {
      emitListToast(t("Could not update showcase"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={t("Showcase")} className="rounded-lg bg-surface p-5 ring-1 ring-edge-soft">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          <Bookmark size={20} /> {t("Showcase")}
        </div>
        {isOwner && !picking && (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-elevated px-3 text-[12px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink"
          >
            <Brush size={13} strokeWidth={2.2} /> {t("Feature a theme")}
          </button>
        )}
      </div>
      {item ? (
        <div className="space-y-3">
          {item.kind === "theme" ? (
            <ThemeCard item={item} />
          ) : (
            <button
              onClick={() =>
                item.metaId &&
                onOpen?.(item.metaId, undefined, { name: item.title, poster: item.posterUrl })
              }
              disabled={!item.metaId}
              className="group flex w-full items-center gap-4 rounded-md p-2 text-start transition-colors hover:bg-elevated disabled:cursor-default"
            >
              <div className="w-24 shrink-0">
                <Poster
                  src={item.posterUrl}
                  seed={item.title}
                  ratio="portrait"
                  className="rounded-md"
                />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.1em] text-accent">
                  {t(KIND_LABEL[item.kind])}
                </div>
                <div className="mt-1 truncate font-display text-[19px] text-ink">{item.title}</div>
                {item.caption && (
                  <div className="mt-1 line-clamp-2 text-[13px] text-ink-muted">{item.caption}</div>
                )}
              </div>
            </button>
          )}
          {isOwner && (
            <button
              onClick={remove}
              disabled={busy}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-edge-soft text-[13px] font-medium text-ink-muted transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-60"
            >
              <X size={20} /> {busy ? t("Removing") : t("Remove from showcase")}
            </button>
          )}
        </div>
      ) : isOwner ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-edge py-10 text-center">
          <p className="text-[14px] text-ink-muted">{t("Nothing on display yet")}</p>
          <p className="mt-1 text-[12px] text-ink-subtle">
            {t("A favorite title or one of your themes will appear here")}
          </p>
        </div>
      ) : (
        <p className="py-6 text-center text-[13px] text-ink-subtle">
          {t("This user hasn't set a showcase")}
        </p>
      )}
      {isOwner && picking && (
        <ThemePicker onPick={pickTheme} onClose={() => setPicking(false)} busy={busy} />
      )}
    </section>
  );
}
