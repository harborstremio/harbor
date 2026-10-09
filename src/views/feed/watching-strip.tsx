import { Users } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { WatchingNow } from "@/lib/social/feed";
import { Avatar } from "@/views/profile/profile-bits";

export function WatchingStrip({
  items,
  onOpenProfile,
}: {
  items: WatchingNow[];
  onOpenProfile?: (handle: string) => void;
}) {
  const t = useT();
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-70 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {t("Watching right now")}
        </h2>
        <span className="text-[11.5px] tabular-nums text-ink-subtle/70">{items.length}</span>
      </div>

      <div className="harbor-scroll flex gap-2.5 overflow-x-auto pb-1">
        {items.map((w, i) => (
          <WatchingCard key={w.actor.handle} item={w} index={i} onOpenProfile={onOpenProfile} />
        ))}
      </div>
    </section>
  );
}

function WatchingCard({
  item,
  index,
  onOpenProfile,
}: {
  item: WatchingNow;
  index: number;
  onOpenProfile?: (handle: string) => void;
}) {
  const t = useT();
  const w = item.watching;
  const party = w.kind === "party";
  const label = party
    ? w.partySize
      ? t("In a watch party of {count}", { count: w.partySize })
      : t("In a watch party")
    : w.paused
      ? t("Paused")
      : t("Watching");

  return (
    <button
      type="button"
      onClick={() => onOpenProfile?.(item.actor.handle)}
      style={{ animationDelay: `${Math.min(index * 45, 360)}ms`, animationDuration: "420ms", animationFillMode: "both" }}
      className="group relative flex w-[228px] shrink-0 flex-col justify-end overflow-hidden rounded-lg bg-surface p-3 text-start ring-1 ring-edge-soft transition-[background-color,box-shadow,transform] duration-200 hover:bg-elevated hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/70 active:scale-[0.99] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 sm:hover:-translate-y-[2px]"
    >
      {w.posterUrl && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-6 -z-10 opacity-[0.22] blur-2xl saturate-[1.35] transition-opacity duration-300 group-hover:opacity-[0.34]"
          style={{ backgroundImage: `url(${w.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}

      <div className="flex min-w-0 items-center gap-2.5">
        {w.posterUrl ? (
          <img
            src={w.posterUrl}
            alt=""
            draggable={false}
            loading="lazy"
            className="h-[62px] w-[42px] shrink-0 rounded-[8px] object-cover ring-1 ring-edge-soft"
          />
        ) : (
          <span className="grid h-[62px] w-[42px] shrink-0 place-items-center rounded-[8px] bg-elevated text-ink-subtle ring-1 ring-edge-soft">
            <Users size={16} />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <Avatar src={item.actor.avatarUrl} size={16} alias={item.actor.alias} />
            <span className="truncate text-[11.5px] font-medium text-ink-subtle">{item.actor.alias}</span>
          </span>
          <span className="truncate text-[13.5px] font-semibold text-ink">{w.title || label}</span>
          <span className="truncate text-[11.5px] text-ink-subtle">
            {w.title ? label : ""}
            {w.title && w.sub ? " · " : ""}
            {w.title ? w.sub ?? "" : ""}
          </span>
        </span>
      </div>
    </button>
  );
}
