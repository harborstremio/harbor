import { ArrowRight } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import type { Rejection } from "@/lib/streams/trust";
import { groupRejections } from "./picker-utils";

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-edge bg-canvas/70 px-6 py-12 text-center">
      <p className="text-[14px] text-ink-muted">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-5 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          {action.label}
          <ArrowRight size={14} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

export function NoSourcesState({
  addonCount,
  hasDebrid,
  streamIds,
  isAnime,
}: {
  addonCount: number;
  hasDebrid: boolean;
  streamIds: string[];
  isAnime: boolean;
}) {
  const isWeb = typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window);
  const libraryOnly = hasDebrid && addonCount === 0;
  const tip = libraryOnly
    ? "Harbor searched your debrid library, but this title is not already saved there. Install a stream addon if you want to search for new torrents."
    : isAnime
      ? "Anime sources are usually richer through Torrentio's anime config or AIOStreams. Make sure one is installed in Stremio."
      : isWeb
        ? "On the web, Harbor can only reach addons that allow browser access (Torrentio, TorBox, Cinemeta). For unreleased titles, no source typically exists yet."
        : "Try signing in to Stremio so Harbor can use your addon collection. Older or foreign titles often need Torrentio + a debrid addon to find anything.";
  return (
    <div className="rounded-[24px] border border-edge-soft/70 bg-canvas/80 px-9 py-11">
      <div className="flex flex-col items-center gap-5 text-center">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.42em] text-ink-subtle">
          {libraryOnly ? "Not found in your debrid library" : "No source returned a stream"}
        </p>
        <h2 className="font-display text-[28px] leading-tight text-ink">
          {libraryOnly
            ? "Your library does not contain a matching file"
            : `Harbor queried ${addonCount} addon${addonCount === 1 ? "" : "s"} and got nothing back`}
        </h2>
        <p className="max-w-md text-[13.5px] leading-relaxed text-ink-muted">{tip}</p>
        <p className="text-[10.5px] font-mono uppercase tracking-[0.18em] text-ink-subtle/70">
          Tried IDs: {streamIds.slice(0, 3).join(" · ")}
          {streamIds.length > 3 ? ` · +${streamIds.length - 3} more` : ""}
        </p>
      </div>
    </div>
  );
}

export function FilteredOutState({
  rawCount,
  rejected,
  strictMode,
  onSearchWider,
}: {
  rawCount: number;
  rejected: Rejection[];
  strictMode: boolean;
  onSearchWider: () => void;
}) {
  const groups = groupRejections(rejected);
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-edge-soft/70 bg-canvas/80 px-9 py-11">
      <div className="flex flex-col items-center gap-5 text-center">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.42em] text-ink-subtle">
          {rawCount} sources · 0 made it through
        </p>
        <h2 className="font-display text-[34px] font-medium leading-[1.05] tracking-tight text-ink">
          Strict filters dropped everything
        </h2>
        <p className="max-w-lg text-[14px] leading-relaxed text-ink-muted">
          Harbor blocks suspicious files and mismatched releases by default. For older shows and
          unusual titles this is sometimes too tight.
        </p>
        {groups.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-2 pt-1">
            {groups.slice(0, 4).map((g) => (
              <li
                key={g.label}
                className="rounded-full border border-edge-soft/60 bg-canvas/60 px-3 py-1 text-[12px] font-semibold tracking-[0.06em] text-ink-muted"
              >
                {g.count} {g.label}
              </li>
            ))}
          </ul>
        )}
        {strictMode && (
          <button
            onClick={onSearchWider}
            className="mt-3 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-7 text-[14px] font-semibold tracking-[0.04em] text-canvas shadow-[0_12px_36px_rgba(0,0,0,0.4)] transition-[transform,opacity] duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Search wider
          </button>
        )}
        {!strictMode && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-subtle">
            Wide search · still empty
          </p>
        )}
      </div>
    </div>
  );
}

export function TheatresEmptyState({
  meta,
  onShowAll,
  showingAll,
}: {
  meta: Meta;
  onShowAll?: () => void;
  showingAll?: boolean;
}) {
  const art = meta.background || meta.poster;
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-edge-soft/60 bg-canvas/60">
      {art && (
        <img
          src={art}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-25 grayscale"
          draggable={false}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-canvas/60 via-canvas/80 to-canvas" />
      <div className="relative flex flex-col items-center gap-4 px-10 py-14 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.42em] text-ink-subtle">
          Not out yet
        </p>
        <h2 className="font-display text-[34px] font-medium leading-[1.05] tracking-tight text-ink">
          {meta.name}
        </h2>
        <p className="max-w-md text-[14px] leading-relaxed text-ink-muted">
          No clean release has surfaced yet. This may be too new. Harbor's filters dropped
          everything that came back as wrong-movie noise.
        </p>
        {onShowAll && !showingAll && (
          <button
            onClick={onShowAll}
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-full border border-edge bg-canvas/70 px-6 text-[13px] font-semibold tracking-[0.04em] text-ink-muted transition-[transform,background-color,color] duration-200 hover:scale-[1.02] hover:bg-canvas/90 hover:text-ink active:scale-[0.98]"
          >
            Show everything anyway
          </button>
        )}
        {showingAll && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-ink-subtle">
            Filters off · still empty
          </p>
        )}
      </div>
    </div>
  );
}
