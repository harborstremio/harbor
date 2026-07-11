import { AwardLogo, laurelColorFor } from "@/components/icons/award-logo";
import { Laurel } from "@/components/icons/laurel";
import { useT } from "@/lib/i18n";
import type { AwardType } from "@/lib/providers/wikidata";
import { useView } from "@/lib/view";

import { Row } from "./row";

const AWARDS: Array<{ type: AwardType; name: string; sub: string }> = [
  { type: "oscar", name: "Academy Awards", sub: "Best Picture and beyond" },
  { type: "golden_globe", name: "Golden Globes", sub: "Film and television" },
  { type: "bafta", name: "BAFTA", sub: "The British Academy" },
  { type: "emmy", name: "Emmys", sub: "Television's finest" },
  { type: "sag", name: "SAG Awards", sub: "Chosen by actors" },
  { type: "critics_choice", name: "Critics' Choice", sub: "The critics' cut" },
  { type: "cannes", name: "Cannes", sub: "Palme d'Or" },
  { type: "venice", name: "Venice", sub: "Golden Lion" },
  { type: "berlin", name: "Berlinale", sub: "Golden Bear" },
];

export function AwardTiles() {
  const t = useT();
  return (
    <Row title={t("Browse by Award")} min={210} shape="tile" alwaysActive>
      {AWARDS.map((a) => (
        <AwardTile key={a.type} type={a.type} name={a.name} sub={a.sub} />
      ))}
    </Row>
  );
}

function AwardTile({ type, name, sub }: { type: AwardType; name: string; sub: string }) {
  const { openAward } = useView();
  const t = useT();
  const tint = laurelColorFor(type);
  return (
    <button
      type="button"
      onClick={() => openAward(type)}
      className="group relative aspect-[5/4] w-full cursor-pointer overflow-hidden rounded-2xl border border-edge-soft text-start transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] hover:-translate-y-1"
      style={{
        background: `linear-gradient(150deg, oklch(from ${tint} 0.26 calc(c * 0.45) h), oklch(from ${tint} 0.11 calc(c * 0.3) h))`,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 32%, oklch(from ${tint} 0.5 calc(c * 0.7) h / 0.22), transparent 62%)`,
        }}
      />
      <div className="absolute inset-x-0 top-0 flex h-[62%] items-center justify-center" style={{ color: tint }}>
        <span className="opacity-95 drop-shadow-[0_4px_24px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] group-hover:scale-[1.06]">
          <Laurel size={96}>
            <AwardLogo type={type} size={32} />
          </Laurel>
        </span>
      </div>
      <div className="absolute inset-x-5 bottom-4 flex items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate font-display text-[21px] font-medium leading-tight tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)]">
            {t(name)}
          </h3>
          <span className="truncate text-[11.5px] font-medium text-white/65">{t(sub)}</span>
        </div>
        <span
          className="dir-icon shrink-0 text-[18px] text-white/80 transition-transform duration-200 group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
          aria-hidden
        >
          ›
        </span>
      </div>
    </button>
  );
}
