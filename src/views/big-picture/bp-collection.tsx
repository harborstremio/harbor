import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import {
  entityToMeta,
  fetchTvdbCollection,
  fetchTvdbEntity,
} from "@/lib/providers/tvdb-collections";
import { BpTile } from "./bp-tile";
import {
  BpCollectionEmpty,
  BpCollectionGrid,
  BpCollectionShell,
  BpCollectionSkeleton,
} from "./bp-collection-shell";
import { HYDRATE_LANES } from "./bp-collection-steps";
import { bpMapLimit } from "./use-bp-collections";
import { useBpT } from "./bp-i18n";

const MAX_ENTRIES = 40;

type CollectionState = {
  name: string;
  overview: string | null;
  metas: Meta[];
  loading: boolean;
};

function useBpCollection(id: number, fallbackName: string): CollectionState {
  const [state, setState] = useState<CollectionState>({
    name: fallbackName,
    overview: null,
    metas: [],
    loading: true,
  });

  useEffect(() => {
    let alive = true;
    setState({ name: fallbackName, overview: null, metas: [], loading: true });
    void fetchTvdbCollection(id)
      .then(async (coll) => {
        if (!alive) return;
        if (!coll) {
          setState({ name: fallbackName, overview: null, metas: [], loading: false });
          return;
        }
        const wanted = coll.entries.slice(0, MAX_ENTRIES).map((e, i) => ({ e, i }));
        setState({
          name: coll.name,
          overview: coll.overview,
          metas: [],
          loading: wanted.length > 0,
        });
        const found = new Array<Meta | null>(wanted.length).fill(null);
        await bpMapLimit(wanted, HYDRATE_LANES, async ({ e, i }) => {
          const card = await fetchTvdbEntity(e.kind, e.tvdbId).catch(() => null);
          if (!alive || !card) return;
          found[i] = entityToMeta(card);
          setState((prev) => ({
            ...prev,
            metas: found.filter((m): m is Meta => m !== null),
          }));
        });
        if (alive) setState((prev) => ({ ...prev, loading: false }));
      })
      .catch(() => {
        if (alive) setState({ name: fallbackName, overview: null, metas: [], loading: false });
      });
    return () => {
      alive = false;
    };
  }, [id, fallbackName]);

  return state;
}

export function BpCollection({
  collectionId,
  name,
  image,
  onSelect,
}: {
  collectionId: number;
  name: string;
  image: string | null;
  onSelect: (m: Meta) => void;
}) {
  const t = useBpT();
  const { name: title, overview, metas, loading } = useBpCollection(collectionId, name);

  return (
    <BpCollectionShell
      backdrop={image}
      header={
        <div className="flex min-w-0 flex-col gap-[clamp(5px,0.7vh,11px)]">
          <span className="text-[clamp(11px,1.5vh,17px)] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {t("Collection")}
          </span>
          <h1 className="text-[clamp(24px,4.4vh,54px)] font-bold leading-[1.05] tracking-[-0.02em] text-ink">
            {title}
          </h1>
          {overview && (
            <p className="line-clamp-2 max-w-[62ch] text-[clamp(12.5px,1.75vh,20px)] font-medium text-ink-muted">
              {overview}
            </p>
          )}
        </div>
      }
    >
      {loading && metas.length === 0 ? (
        <BpCollectionSkeleton />
      ) : metas.length > 0 ? (
        <BpCollectionGrid>
          {metas.map((m, i) => (
            <BpTile key={`${m.id}-${i}`} meta={m} onSelect={onSelect} autofocus={i === 0} />
          ))}
        </BpCollectionGrid>
      ) : (
        <BpCollectionEmpty text={t("Couldn't load this collection right now.")} />
      )}
    </BpCollectionShell>
  );
}
