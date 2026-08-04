import { Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { Poster } from "@/components/poster";
import { RailChevron } from "@/components/nav-arrow";
import { useProfiles } from "@/lib/profiles";
import {
  removeMangaProgressEntry,
  useMangaProgressList,
  type MangaProgressEntry,
} from "@/lib/manga-progress";

export function MangaContinue({
  onResume,
}: {
  onResume: (entry: MangaProgressEntry) => void | Promise<void>;
}) {
  const items = useMangaProgressList();
  const t = useT();
  const { activeId } = useProfiles();
  const pid = activeId ?? "default";
  const scrollRef = useRef<HTMLDivElement>(null);
  if (!items.length) return null;
  const scrollBy = (dir: number) =>
    scrollRef.current?.scrollBy({ left: dir * 340, behavior: "smooth" });
  return (
    <section className="group/continue mb-9 flex flex-col gap-3.5">
      <h2 className="text-[22px] font-medium tracking-tight text-ink">{t("Continue reading")}</h2>
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-3.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [overflow-anchor:none] [overscroll-behavior-x:contain]"
          style={{ contain: "layout style", transform: "translateZ(0)" }}
        >
          {items.map((entry) => (
            <ContinueCard
              key={entry.id}
              entry={entry}
              onResume={onResume}
              onRemove={() => removeMangaProgressEntry(pid, entry.id)}
            />
          ))}
        </div>
        {items.length > 3 && (
          <>
            <RailChevron side="left" visible onClick={() => scrollBy(-1)} outset={44} size={44} />
            <RailChevron side="right" visible onClick={() => scrollBy(1)} outset={44} size={44} />
          </>
        )}
      </div>
    </section>
  );
}

function ContinueCard({
  entry,
  onResume,
  onRemove,
}: {
  entry: MangaProgressEntry;
  onResume: (entry: MangaProgressEntry) => void | Promise<void>;
  onRemove: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const t = useT();
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const pct =
    entry.totalPages > 0 ? Math.min(100, Math.round((entry.page / entry.totalPages) * 100)) : 0;
  const open = () => {
    if (busy) return;
    setBusy(true);
    Promise.resolve(onResume(entry)).finally(() => {
      if (mounted.current) setBusy(false);
    });
  };
  return (
    <div className="group relative w-[310px] shrink-0">
      <button
        type="button"
        onClick={open}
        aria-busy={busy}
        className={`flex w-full items-stretch gap-3.5 rounded-2xl border p-3 text-start transition-[transform,background-color,box-shadow] duration-200 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 ${
          busy
            ? "border-accent/50 bg-elevated/70 ring-1 ring-accent/40"
            : "border-edge-soft/60 bg-elevated/40 hover:bg-elevated/70"
        }`}
      >
        <div className="relative w-[68px] shrink-0">
          <Poster src={entry.cover} seed={entry.id} className="rounded-lg ring-1 ring-edge-soft" />
          {busy && (
            <div className="absolute inset-0 grid place-items-center rounded-lg bg-canvas/55 backdrop-blur-[1px]">
              <Loader2 className="h-4 w-4 animate-spin text-ink motion-reduce:animate-none" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <p className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-ink">
            {entry.title}
          </p>
          <p className="text-[12.5px] text-ink-muted">
            {busy
              ? t("Opening…")
              : t("{label} · page {page}/{total}", {
                  label: entry.chapterLabel,
                  page: entry.page,
                  total: entry.totalPages,
                })}
          </p>
          <div className="mt-1 flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-edge-soft/60">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11.5px] font-semibold tabular-nums text-ink-subtle">{pct}%</span>
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("Remove from continue reading")}
        className="absolute end-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-canvas/70 text-ink-subtle opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:text-ink"
      >
        <X size={13} strokeWidth={2.4} />
      </button>
    </div>
  );
}
