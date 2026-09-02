import { User } from "lucide-react";
import { pushBigPicture } from "@/lib/big-picture";
import { IMG } from "@/lib/providers/tmdb/tmdb-client";
import { SFX } from "@/lib/sfx";
import { COLLAB_RAIL_MIN, type Collaborator } from "@/views/person/collaborator-rank";
import { bpBoxCss, bpBoxPx, bpCardArt, type BpArtBox } from "./bp-art";
import { BpArt } from "./bp-art-img";
import { useBpT } from "./bp-i18n";

const BOX: BpArtBox = { min: 124, vw: 10, max: 196 };
const CELL = bpBoxCss(BOX);

function BpCollaboratorCard({ person }: { person: Collaborator }) {
  const t = useBpT();
  const shared = t("{n} titles together", { n: person.titles });
  const ariaLabel = person.role
    ? t("{name}, {role}, {shared}", {
        name: person.name,
        role: person.role,
        shared,
      })
    : t("{name}, {shared}", { name: person.name, shared });
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`bp-collab:${person.id}`}
      onClick={() => {
        SFX.click();
        pushBigPicture({ kind: "person", personId: person.id, name: person.name });
      }}
      aria-label={ariaLabel}
      className="flex shrink-0 flex-col overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]"
      style={{ width: CELL }}
    >
      <span
        className="relative flex w-full items-center justify-center overflow-hidden bg-[var(--bp-panel-2)]"
        style={{ aspectRatio: "2 / 3" }}
      >
        {person.profilePath ? (
          <BpArt
            src={bpCardArt(`${IMG}/w342${person.profilePath}`, bpBoxPx(BOX))}
            className="object-cover"
          />
        ) : (
          <User size={26} className="text-ink-subtle" strokeWidth={1.7} />
        )}
      </span>
      <span className="flex w-full flex-col gap-0.5 p-[clamp(9px,0.9vw,15px)]">
        <span className="line-clamp-1 w-full text-[clamp(11.5px,1.55vh,17.5px)] font-semibold leading-tight text-ink">
          {person.name}
        </span>
        <span className="line-clamp-1 w-full text-[clamp(10px,1.3vh,14.5px)] font-medium leading-tight tabular-nums text-ink-subtle">
          {person.role && (
            <>
              {person.role}
              <span aria-hidden className="mx-[0.4em] opacity-40">
                •
              </span>
            </>
          )}
          {shared}
        </span>
      </span>
    </button>
  );
}

// No skeleton on purpose. The rail legitimately resolves to nothing below
// COLLAB_RAIL_MIN, and a shimmer that sometimes vanishes reads worse than a row
// that quietly appears. Callers still push this row unconditionally so its
// data-bp-rail-row index exists from the first frame; an index holding nothing
// focusable is stepped over, a missing index is a dead end.
export function BpCollaboratorRow({ people }: { people: Collaborator[] }) {
  const t = useBpT();
  if (people.length < COLLAB_RAIL_MIN) return null;

  return (
    <section data-bp-row data-bp-row-key="collaborators" className="relative">
      <h2 className="mb-[clamp(6px,0.8vh,12px)] px-[var(--bp-gutter)] text-[clamp(14px,2.05vh,26px)] font-bold tracking-[-0.01em] text-ink">
        {t("Frequent Collaborators")}
      </h2>
      <div
        data-bp-scroll-x
        className="flex gap-[clamp(16px,1.35vw,30px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {people.map((p) => (
          <BpCollaboratorCard key={p.id} person={p} />
        ))}
      </div>
    </section>
  );
}
