import { narrowMediaType, type Meta } from "@/lib/cinemeta";
import { Poster, usePosterChain } from "@/components/poster";
import { useSettings } from "@/lib/settings";
import { HIDE_SCROLL } from "./data";
import { SectionTitle } from "./ui";

export function RecRail({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: Meta[];
  onOpen: (m: Meta) => void;
}) {
  return (
    <section className="flex flex-col gap-3.5">
      <SectionTitle>{title}</SectionTitle>
      <div className={`-mx-5 flex snap-x snap-proximity gap-3 overflow-x-auto px-5 ${HIDE_SCROLL}`}>
        {items.slice(0, 20).map((m) => (
          <RecCard key={m.id} meta={m} onOpen={() => onOpen(m)} />
        ))}
      </div>
    </section>
  );
}

function RecCard({ meta, onOpen }: { meta: Meta; onOpen: () => void }) {
  const { settings } = useSettings();
  const { src, onError } = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster,
    narrowMediaType(meta.type),
  );
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-[104px] shrink-0 snap-start flex-col gap-2 text-start transition-transform active:scale-[0.97] motion-reduce:transition-none"
    >
      <Poster
        src={src}
        onError={onError}
        seed={meta.id}
        ratio="portrait"
        lazy
        className="rounded-xl ring-1 ring-edge-soft/60"
      />
      <p className="line-clamp-2 text-[12px] font-medium leading-tight text-ink-muted">
        {meta.name}
      </p>
    </button>
  );
}
