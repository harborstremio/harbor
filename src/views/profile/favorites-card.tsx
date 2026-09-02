import { BookOpen, Gamepad2, type LucideIcon, Music2, Pencil, Plus } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { FavoriteMedia } from "@/lib/providers/favorites-types";
import { compactNumber } from "./profile-bits";
import { FavoritesRow } from "./favorites-showcase";
import { FAVORITE_DISPLAY_CAP, useFavorites } from "./use-favorites";

type FavKind = FavoriteMedia["kind"];

const MAX_SHOWN = FAVORITE_DISPLAY_CAP;

type KindConfig = {
  Icon: LucideIcon;
  label: string;
  add: string;
};

const CONFIG: Record<FavKind, KindConfig> = {
  game: { Icon: Gamepad2, label: "Games", add: "Add favourite games" },
  book: { Icon: BookOpen, label: "Books", add: "Add favourite books" },
  music: { Icon: Music2, label: "Music", add: "Add favourite artists" },
};

function readHookKind(live: unknown, kind: FavKind, active: boolean): FavoriteMedia[] | undefined {
  if (!active || !live || typeof live !== "object") return undefined;
  const l = live as { entries?: Record<string, unknown>; loaded?: unknown };
  if (l.loaded !== true) return undefined;
  const arr = l.entries?.[kind];
  return Array.isArray(arr) ? (arr as FavoriteMedia[]) : undefined;
}

function dedupe(list: FavoriteMedia[]): FavoriteMedia[] {
  const seen = new Set<string>();
  const out: FavoriteMedia[] = [];
  for (const it of list) {
    if (!it || !it.id || !it.name || seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

export function FavoritesCard({
  kind,
  items,
  handle,
  isOwner = false,
  hideTitle = false,
  onManage,
}: {
  kind: FavKind;
  items?: FavoriteMedia[];
  handle?: string;
  isOwner?: boolean;
  hideTitle?: boolean;
  onManage?: () => void;
}) {
  const t = useT();
  const cfg = CONFIG[kind];
  const hookHandle = isOwner && items === undefined && handle ? handle : "";
  const live = useFavorites(hookHandle);
  const hookList = readHookKind(live, kind, hookHandle !== "");
  const shown = dedupe(items ?? hookList ?? []).slice(0, MAX_SHOWN);
  const count = shown.length;

  if (count === 0 && !isOwner) return null;

  const Icon = cfg.Icon;

  return (
    <section
      aria-label={t(cfg.label)}
      className="rounded-lg bg-surface p-5 ring-1 ring-edge-soft"
    >
      {!hideTitle && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              <Icon size={20} />
              <span className="truncate">{t(cfg.label)}</span>
            </div>
            <div className="mt-1 text-[11.5px] text-ink-subtle">
              {t("Favourites")}
              {count > 0 ? ` · ${compactNumber(count)}` : ""}
            </div>
          </div>
          {isOwner && count > 0 && onManage && (
            <button
              type="button"
              onClick={onManage}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-elevated px-3 text-[12px] font-semibold text-ink-muted ring-1 ring-edge-soft transition-colors hover:bg-raised hover:text-ink"
            >
              <Pencil size={14} /> {t("Edit")}
            </button>
          )}
        </div>
      )}

      {count > 0 ? (
        <FavoritesRow kind={kind} items={shown} />
      ) : (
        <button
          type="button"
          onClick={onManage}
          className="group/add flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-edge px-4 text-center transition-colors hover:border-accent/40 hover:bg-elevated/30"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-elevated text-ink-muted transition-colors group-hover/add:text-ink">
            <Plus size={18} />
          </span>
          <span className="text-[13px] font-medium text-ink-muted transition-colors group-hover/add:text-ink">
            {t(cfg.add)}
          </span>
        </button>
      )}
    </section>
  );
}
