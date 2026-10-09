import type { PersonRef } from "@/lib/providers/tmdb";
import type { TmdbDetail } from "@/lib/providers/tmdb/tmdb-details";
import { pushBigPicture } from "@/lib/big-picture";
import { SFX } from "@/lib/sfx";
import { useBpT } from "../bp-i18n";
import { BP_DETAIL_HEADING } from "./bp-detail-chrome";

type Credit = { label: string; person: PersonRef };

const CELL =
  "flex shrink-0 flex-col justify-center gap-[clamp(3px,0.4vh,7px)] rounded-[var(--bp-r-sm)] px-[clamp(12px,1vw,20px)] py-[clamp(10px,1.2vh,18px)] text-start";

// No plate at rest. Crew is the one rail with no artwork to frame, so it reads
// as typography on the canvas and the focus ring is the only chrome it earns.
function BpCreditCell({ credit }: { credit: Credit }) {
  const { label, person } = credit;
  const body = (
    <>
      <span className="line-clamp-1 text-[clamp(9.5px,1.2vh,13.5px)] font-bold uppercase tracking-[0.16em] text-ink-subtle">
        {label}
      </span>
      <span className="line-clamp-2 text-[clamp(13px,1.8vh,21px)] font-semibold leading-tight text-ink">
        {person.name}
      </span>
    </>
  );
  const style = { minWidth: "clamp(146px, 12vw, 250px)", maxWidth: "clamp(220px, 20vw, 380px)" };

  if (person.id <= 0) {
    return (
      <span className={CELL} style={style}>
        {body}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`bp-crew:${label}:${person.id}`}
      onClick={() => {
        SFX.click();
        pushBigPicture({ kind: "person", personId: person.id, name: person.name });
      }}
      aria-label={`${label}, ${person.name}`}
      className={CELL}
      style={style}
    >
      {body}
    </button>
  );
}

export function BpCrewRow({ detail }: { detail: TmdbDetail }) {
  const t = useBpT();

  const credits: Credit[] = [];
  const add = (single: string, plural: string, people: PersonRef[], max: number) => {
    const label = people.length === 1 ? single : plural;
    for (const person of people.slice(0, max)) credits.push({ label, person });
  };

  add(t("Director"), t("Directors"), detail.directors, 3);
  add(t("Creator"), t("Creators"), detail.creators, 3);
  add(t("Writer"), t("Writers"), detail.writers, 4);
  add(t("Producers"), t("Producers"), detail.producers, 4);
  add(t("Cinematography"), t("Cinematography"), detail.cinematography, 2);
  add(t("Music"), t("Music"), detail.composer, 2);
  add(t("Editor"), t("Editors"), detail.editor, 2);

  if (credits.length === 0) return null;

  return (
    <section
      data-bp-row
      data-bp-row-key="crew"
      className="relative"
      style={{ containIntrinsicSize: "auto 170px" }}
    >
      <h2 className={BP_DETAIL_HEADING}>{t("Crew")}</h2>
      <div
        data-bp-scroll-x
        className="flex items-stretch gap-[clamp(8px,0.7vw,16px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(14px,1.8vh,26px)] pb-[42px] -mb-[28px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {credits.map((c) => (
          <BpCreditCell key={`${c.label}:${c.person.id}`} credit={c} />
        ))}
      </div>
    </section>
  );
}
