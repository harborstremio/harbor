import { User } from "lucide-react";
import { pushBigPicture } from "@/lib/big-picture";
import type { HarborRankExplanation } from "@/lib/harbor-rank";
import { SFX } from "@/lib/sfx";
import { bpBoxCss, bpBoxPx, bpCardArt, type BpArtBox } from "./bp-art";
import { BpArt } from "./bp-art-img";
import { useBpT } from "./bp-i18n";
import { BpLeadTile } from "./bp-lead-tile";

const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
const BOX: BpArtBox = { min: 124, vw: 10, max: 196 };
const CELL = bpBoxCss(BOX);

function BpPersonCell({ person }: { person: HarborRankExplanation }) {
  const t = useBpT();
  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile
      data-bp-restore-key={`bp-person:${person.id}`}
      onClick={() => {
        SFX.click();
        pushBigPicture({ kind: "person", personId: person.id, name: person.name });
      }}
      aria-label={person.name}
      className="flex shrink-0 flex-col overflow-hidden rounded-[var(--bp-r-md)] bg-[var(--bp-panel)] text-start transition-[transform,box-shadow] duration-[var(--bp-dur)] ease-[var(--bp-ease)]"
      style={{ width: CELL }}
    >
      <span
        className="relative flex w-full items-center justify-center overflow-hidden bg-[var(--bp-panel-2)]"
        style={{ aspectRatio: "2 / 3" }}
      >
        {person.profilePath ? (
          <BpArt
            src={bpCardArt(`${TMDB_IMG}${person.profilePath}`, bpBoxPx(BOX))}
            className="object-cover"
          />
        ) : (
          <User size={26} className="text-ink-subtle" strokeWidth={1.7} />
        )}
        <span data-bp-cell-rank className="absolute start-2 top-2 rounded-full bg-[var(--bp-void)]/85 px-2 py-0.5 text-[clamp(9.5px,1.2vh,13px)] font-bold tabular-nums text-ink">
          {person.rank}
        </span>
      </span>
      <span className="flex w-full flex-col gap-0.5 p-[clamp(9px,0.9vw,15px)]">
        <span data-bp-cell-name className="line-clamp-1 w-full text-[clamp(11.5px,1.55vh,17.5px)] font-semibold leading-tight text-ink">
          {person.name}
        </span>
        <span data-bp-cell-sub className="line-clamp-1 w-full text-[clamp(10px,1.3vh,14.5px)] font-medium leading-tight text-ink-subtle">
          {person.majorAwardWins > 0
            ? t("{n} award wins", { n: person.majorAwardWins })
            : (person.topTitles?.[0]?.title ?? "")}
        </span>
      </span>
    </button>
  );
}

export function BpPeopleBand({ people }: { people: HarborRankExplanation[] }) {
  const t = useBpT();
  if (people.length === 0) return null;

  return (
    <section data-bp-row data-bp-row-key="people" aria-label={t("Top People")} className="relative">
      <div
        data-bp-scroll-x
        className="flex items-stretch gap-[clamp(9px,0.85vw,17px)] overflow-x-auto px-[var(--bp-gutter)] pt-[clamp(22px,2.6vh,40px)] pb-[60px] -mb-[38px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {people.map((p) => (
          <BpPersonCell key={p.id} person={p} />
        ))}
        <BpLeadTile
          label={t("Start at number one")}
          action={t("Top People")}
          restoreKey="bp-lead:people"
          width={CELL}
          ratio="2 / 3"
          onSelect={() =>
            pushBigPicture({
              kind: "person",
              personId: people[0].id,
              name: people[0].name,
            })
          }
        />
      </div>
    </section>
  );
}
