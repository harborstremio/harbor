import { Clapperboard, Heart, Library, Star, Trophy } from "lucide-react";
import { Poster } from "@/components/poster";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { SectionHeader } from "./section-header";
import { timeAgo } from "./profile-bits";
import type { ActivityItem, ActivityKind } from "./profile-types";

export const ACTIVITY_VERB: Record<ActivityKind, string> = {
  watched: "Watched",
  finished: "Finished",
  rated: "Rated",
  favorited: "Favorited",
  imported: "Imported",
};

export function ActivityGlyph({ kind, size = 16 }: { kind: ActivityKind; size?: number }) {
  switch (kind) {
    case "watched":
      return <Clapperboard size={size} className="text-ink-muted" />;
    case "finished":
      return <Trophy size={size} className="text-accent" />;
    case "rated":
      return <Star size={size} className="text-accent" />;
    case "favorited":
      return <Heart size={size} className="text-danger" />;
    case "imported":
      return <Library size={size} className="text-accent" />;
  }
}

function ImportCard({ a, onOpenRatings }: { a: ActivityItem; onOpenRatings?: () => void }) {
  const t = useT();
  const count = a.rating ?? 0;
  return (
    <button
      onClick={() => onOpenRatings?.()}
      disabled={!onOpenRatings}
      className="group w-full text-start disabled:cursor-default"
    >
      <div className="flex aspect-[2/3] flex-col items-center justify-center gap-2 rounded-md bg-gradient-to-br from-accent/18 via-elevated to-surface px-3 text-center ring-1 ring-edge-soft transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:shadow-[0_18px_36px_-14px_rgba(0,0,0,0.6)] motion-safe:group-hover:[transform:translate3d(0,-0.5rem,0)_scale(1.03)]">
        <Library size={26} className="text-accent" />
        <span className="text-[24px] font-semibold leading-none tabular-nums text-ink">{count}</span>
        <span className="text-[11.5px] leading-snug text-ink-subtle">{t("ratings imported")}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-ink-subtle">
        <ActivityGlyph kind="imported" size={13} />
        {t("Imported")}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-medium text-ink">{t("from {source}", { source: a.title })}</div>
      <div className="mt-0.5 text-[11px] tabular-nums text-ink-subtle">{timeAgo(a.at)}</div>
    </button>
  );
}

function ActivityCard({
  a,
  onOpen,
  onOpenRatings,
}: {
  a: ActivityItem;
  onOpen?: (metaId: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
  onOpenRatings?: () => void;
}) {
  const t = useT();
  if (a.kind === "imported") return <ImportCard a={a} onOpenRatings={onOpenRatings} />;
  return (
    <button
      onClick={() => a.metaId && onOpen?.(a.metaId, undefined, { name: a.title, poster: a.posterUrl })}
      disabled={!a.metaId}
      className="group w-full text-start disabled:cursor-default"
    >
      <Poster
        src={a.posterUrl}
        seed={a.title}
        ratio="portrait"
        className="rounded-md ring-1 ring-edge-soft shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] motion-safe:group-hover:will-change-transform group-hover:shadow-[0_18px_36px_-14px_rgba(0,0,0,0.6)] motion-safe:group-hover:[transform:translate3d(0,-0.5rem,0)_scale(1.03)]"
        lazy
      />
      <div className="mt-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-ink-subtle">
        <ActivityGlyph kind={a.kind} size={13} />
        {t(ACTIVITY_VERB[a.kind])}
        {a.kind === "rated" && a.rating !== undefined && <span className="text-accent">{a.rating}/10</span>}
      </div>
      <div className="mt-0.5 truncate text-[13px] font-medium text-ink">{a.title}</div>
      <div className="mt-0.5 text-[11px] tabular-nums text-ink-subtle">{timeAgo(a.at)}</div>
    </button>
  );
}

export function RecentActivity({
  items,
  onOpen,
  onViewAll,
  handle,
  visibilityPrivate = false,
  onOpenRatings,
}: {
  items: ActivityItem[];
  onOpen?: (metaId: string, kind?: string, hint?: { name?: string; poster?: string }) => void;
  onViewAll?: () => void;
  handle?: string;
  visibilityPrivate?: boolean;
  onOpenRatings?: () => void;
}) {
  const t = useT();
  return (
    <section aria-label={t("Recent activity")} className="rounded-lg bg-surface p-5 ring-1 ring-edge-soft">
      <SectionHeader
        icon={<Clapperboard size={20} />}
        label={t("Recent activity")}
        onViewAll={!visibilityPrivate && items.length > 0 ? onViewAll : undefined}
      />
      {visibilityPrivate ? (
        <p className="py-6 text-center text-[13px] text-ink-subtle">{t("This user has chosen to keep activity private")}</p>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-subtle">{t("No recent activity yet")}</p>
      ) : (
        <Row min={150} shape="portrait" scrollKey={handle ? `profile:${handle}:activity` : undefined}>
          {items.map((a) => (
            <ActivityCard key={a.id} a={a} onOpen={onOpen} onOpenRatings={onOpenRatings} />
          ))}
        </Row>
      )}
    </section>
  );
}
