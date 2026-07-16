import { ArrowRight } from "lucide-react";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { dropAdultContent, dropUnreleased } from "./kids-filter";
import { franchiseFetcher, KIDS_FRANCHISES, type Franchise } from "./kids-franchises";

export function KidsFranchiseRail() {
  const { settings } = useSettings();
  const t = useT();
  const key = settings.tmdbKey;
  if (!key) return null;
  return (
    <Row title={t("Pick a World")} min={232} shape="landscape" scrollKey="kids:franchises">
      {KIDS_FRANCHISES.map((f) => (
        <FranchiseTile key={f.key} franchise={f} tmdbKey={key} />
      ))}
    </Row>
  );
}

function FranchiseTile({ franchise, tmdbKey }: { franchise: Franchise; tmdbKey: string }) {
  const { openGrid } = useView();
  const t = useT();
  const open = () => {
    const fetch = franchiseFetcher(tmdbKey, franchise);
    openGrid({
      title: franchise.name,
      fetcher: (page) => fetch(page).then(dropUnreleased).then(dropAdultContent),
      kidsHero: {
        grad: franchise.grad,
        art: `/kids/cta/${franchise.key}.webp`,
        name: franchise.name,
      },
    });
  };
  return (
    <button
      type="button"
      onClick={open}
      className="group relative block aspect-16/10 w-full overflow-hidden rounded-[24px] ring-2 ring-white shadow-[0_14px_34px_-16px_rgba(20,40,60,0.5)] transition duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_22px_46px_-16px_rgba(20,40,60,0.6)] active:scale-[0.98]"
    >
      <div className={`absolute inset-0 bg-linear-to-br ${franchise.grad}`} />
      <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/25 blur-md transition-transform duration-500 group-hover:scale-110" />
      <div className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-white/15 blur-md transition-transform duration-500 group-hover:-translate-y-1.5" />
      <img
        src={`/kids/cta/${franchise.key}.webp`}
        alt=""
        draggable={false}
        loading="lazy"
        style={franchise.drop != null ? { bottom: `-${franchise.drop}%` } : undefined}
        className="pointer-events-none absolute bottom-0 inset-e-0 h-[122%] w-[80%] object-contain object-bottom drop-shadow-[0_10px_18px_rgba(0,0,0,0.3)] transition-transform duration-300 ease-out group-hover:scale-[1.05]"
      />
      <div className="absolute inset-0 bg-linear-to-r from-black/45 via-black/10 to-transparent" />
      <div className="absolute inset-x-3.5 bottom-3 max-w-[52%] text-start">
        <div className="font-display text-[19px] font-semibold leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
          {franchise.name}
        </div>
        <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-white/90">
          <span>{t("Explore")}</span>
          <ArrowRight
            size={12}
            strokeWidth={2.6}
            className="dir-icon transition-transform duration-300 group-hover:translate-x-0.5"
          />
        </div>
      </div>
    </button>
  );
}
