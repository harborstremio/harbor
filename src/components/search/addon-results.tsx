import { Blocks, Star } from "lucide-react";
import type { AddonResultGroup } from "@/lib/search-addons";
import type { Meta } from "@/lib/cinemeta";
import { Poster, usePosterChain } from "@/components/poster";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";

export function AddonResults({
  groups,
  onClose,
}: {
  groups: AddonResultGroup[];
  onClose: () => void;
}) {
  if (groups.length === 0) return null;
  return (
    <section className="flex flex-col gap-6">
      <h3 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
        <Blocks size={11} strokeWidth={2.2} />
        From your addons
      </h3>
      {groups.map((g) => (
        <AddonGroup key={g.id} group={g} onClose={onClose} />
      ))}
    </section>
  );
}

function AddonGroup({ group, onClose }: { group: AddonResultGroup; onClose: () => void }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        {group.logo ? (
          <img
            src={group.logo}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-5 w-5 shrink-0 rounded-md object-contain"
          />
        ) : (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-elevated text-ink-subtle">
            <Blocks size={12} strokeWidth={2} />
          </span>
        )}
        <span className="truncate text-[13.5px] font-semibold text-ink-muted">{group.name}</span>
      </div>
      <div className="grid gap-1">
        {group.metas.map((m) => (
          <AddonResultRow key={m.id} meta={m} onClose={onClose} />
        ))}
      </div>
    </div>
  );
}

function AddonResultRow({ meta, onClose }: { meta: Meta; onClose: () => void }) {
  const { openMeta } = useView();
  const { settings } = useSettings();
  const poster = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster,
    meta.type === "series" ? "series" : "movie",
  );
  return (
    <button
      onClick={() => {
        openMeta(meta);
        onClose();
      }}
      className="group flex items-center gap-4 rounded-2xl border border-transparent px-3 py-2.5 text-start transition-colors hover:border-edge-soft hover:bg-elevated/50 active:scale-[0.997]"
    >
      <div className="h-[96px] w-[64px] shrink-0 overflow-hidden rounded-xl shadow-[0_6px_16px_-8px_rgba(0,0,0,0.55)] ring-1 ring-edge-soft">
        <Poster
          src={poster.src}
          onError={poster.onError}
          seed={meta.id}
          ratio="portrait"
          className="block h-full w-full"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[16px] font-semibold text-ink">{meta.name}</span>
        <div className="flex items-center gap-2 text-[12.5px] text-ink-muted">
          {meta.releaseInfo && <span>{meta.releaseInfo}</span>}
          {meta.releaseInfo && meta.imdbRating && (
            <span aria-hidden className="h-1 w-1 rounded-full bg-ink-subtle" />
          )}
          {meta.imdbRating && (
            <span className="flex items-center gap-1 text-ink">
              <Star size={11} className="fill-accent text-accent" />
              {meta.imdbRating}
            </span>
          )}
        </div>
        {meta.description && (
          <span className="line-clamp-2 text-[12.5px] leading-snug text-ink-subtle">
            {meta.description}
          </span>
        )}
      </div>
    </button>
  );
}
