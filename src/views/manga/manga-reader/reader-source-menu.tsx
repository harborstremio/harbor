import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Layers } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { MangaChapter } from "@/views/manga/manga-reader/reader-types";

const CHAPTER_SOURCE_KEY = "harbor.manga.chaptersource.v1";

export function loadChapterSource(): string {
  try {
    return localStorage.getItem(CHAPTER_SOURCE_KEY) ?? "all";
  } catch {
    return "all";
  }
}

export function saveChapterSource(id: string): void {
  try {
    localStorage.setItem(CHAPTER_SOURCE_KEY, id);
  } catch {
    /* noop */
  }
}

export function chapterSourceOf(c: MangaChapter): string {
  const i = c.id.indexOf("::");
  return i === -1 ? "" : c.id.slice(0, i);
}

export type SourceEntry = { id: string; count: number; name: string; iconUrl?: string };

function SourceIcon({ url, name, size = 16 }: { url?: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        className="shrink-0 rounded object-cover"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.55)) }}
      className="grid shrink-0 place-items-center rounded bg-raised font-bold text-ink-muted"
    >
      {(name.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

export function SourceMenu({
  sources,
  total,
  active,
  onPick,
}: {
  sources: SourceEntry[];
  total: number;
  active: string;
  onPick: (id: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const activeEntry = sources.find((s) => s.id === active);

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseDown={(e) => e.preventDefault()}
        aria-expanded={open}
        className="flex max-w-[190px] items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-subtle transition duration-150 hover:bg-raised hover:text-ink active:scale-[0.97]"
      >
        {activeEntry ? (
          <SourceIcon url={activeEntry.iconUrl} name={activeEntry.name} size={14} />
        ) : (
          <Layers size={13} strokeWidth={2.2} className="shrink-0" />
        )}
        <span className="truncate">{activeEntry ? activeEntry.name : t("All sources")}</span>
        <ChevronDown
          size={12}
          strokeWidth={2.4}
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="animate-popover-in absolute start-0 top-[calc(100%+6px)] z-20 w-60 origin-top-left overflow-hidden rounded-xl border border-edge bg-elevated p-1.5 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.7)]">
          <SourceRow
            icon={<Layers size={15} strokeWidth={2.1} className="shrink-0 text-ink-muted" />}
            name={t("All sources")}
            count={total}
            active={active === "all"}
            onClick={() => {
              onPick("all");
              setOpen(false);
            }}
          />
          {sources.map((s) => (
            <SourceRow
              key={s.id}
              icon={<SourceIcon url={s.iconUrl} name={s.name} size={15} />}
              name={s.name}
              count={s.count}
              active={active === s.id}
              onClick={() => {
                onPick(s.id);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SourceRow({
  icon,
  name,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  name: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[12.5px] transition-colors ${
        active
          ? "bg-accent/15 font-semibold text-ink"
          : "text-ink-muted hover:bg-raised hover:text-ink"
      }`}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <span className="shrink-0 text-[11px] tabular-nums text-ink-subtle">{count}</span>
      {active && <Check size={13} strokeWidth={2.6} className="shrink-0 text-accent" />}
    </button>
  );
}
