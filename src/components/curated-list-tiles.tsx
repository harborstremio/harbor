import { useT } from "@/lib/i18n";
import { shelfLists } from "@/lib/curated/registry";
import type { CuratedList } from "@/lib/curated/types";
import { useView } from "@/lib/view";
import { Row } from "./row";
import { curatedListLogos } from "./curated-list-logos";

const ART_COUNT = 3;

function artFor(list: CuratedList): string[] {
  return list.head
    .slice(0, ART_COUNT)
    .map((item) => `https://images.metahub.space/background/medium/${item.imdb}/img`);
}

export function CuratedListTiles({ title }: { title?: string }) {
  const t = useT();
  const lists = shelfLists();
  if (lists.length === 0) return null;
  return (
    <Row title={title ?? t("The canon")} min={210} shape="tile" scrollKey="discover:canon" alwaysActive>
      {lists.map((list) => (
        <CuratedListTile key={list.id} list={list} />
      ))}
    </Row>
  );
}

function CuratedListTile({ list }: { list: CuratedList }) {
  const t = useT();
  const { openCuratedList } = useView();
  const logo = curatedListLogos[list.id];
  return (
    <button
      type="button"
      onClick={() => openCuratedList(list.id)}
      aria-label={`${t(list.curator)}: ${t(list.title)}`}
      className="group relative aspect-[5/4] min-h-[196px] w-full cursor-pointer overflow-hidden rounded-2xl border border-edge-soft bg-elevated text-start transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] hover:-translate-y-1"
    >
      <div aria-hidden className="absolute inset-0 flex">
        {artFor(list).map((src) => (
          <span key={src} className="relative min-w-0 flex-1">
            <img
              src={src}
              alt=""
              draggable={false}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover opacity-40 transition-opacity duration-300 group-hover:opacity-55"
            />
          </span>
        ))}
      </div>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(8,10,14,0.30) 0%, rgba(8,10,14,0.50) 55%, rgba(8,10,14,0.92) 100%)",
        }}
      />
      <div className="absolute inset-x-5 top-4 bottom-[58px] flex items-center justify-center">
        {logo && <img src={logo} alt="" aria-hidden draggable={false}
          className="h-16 w-full max-w-[170px] object-contain brightness-0 invert" />}
      </div>
      <div className="absolute inset-x-5 bottom-4 flex items-end justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold text-white/95">
            {t(list.curator)}
          </span>
          <span className="block text-[12px] text-white/65">
            {t("{n} titles", { n: list.count.toLocaleString() })}
          </span>
        </span>
        <span
          className="dir-icon text-[18px] text-white/80 transition-transform duration-200 group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
          aria-hidden
        >
          ›
        </span>
      </div>
    </button>
  );
}
