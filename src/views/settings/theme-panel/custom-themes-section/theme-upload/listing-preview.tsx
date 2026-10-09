import { Star } from "../../../icons";
import { useT } from "@/lib/i18n";
import { ROW_DESC, ROW_TITLE } from "@/views/settings/shared";

const BADGE =
  "inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

export function ListingPreview({
  name,
  author,
  blurb,
  swatch,
  coverUrl,
}: {
  name: string;
  author: string;
  blurb: string;
  swatch: string[];
  coverUrl: string | null;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <span className="harbor-settings-label">{t("How it'll look")}</span>
      <div className="w-full max-w-[280px] overflow-hidden rounded-md border border-edge-soft bg-surface shadow-[0_18px_40px_-24px_rgba(0,0,0,0.5)]">
        <div className="relative aspect-video w-full overflow-hidden bg-elevated">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full">
              {swatch.map((c, i) => (
                <div key={i} className="flex-1" style={{ background: c }} />
              ))}
            </div>
          )}
          <div className={`${BADGE} absolute bottom-2 end-2 bg-black/55 text-white backdrop-blur-sm`}>
            <Star size={12} className="fill-accent text-accent" /> {t("new")}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex h-1.5">
            {swatch.map((c, i) => (
              <span key={i} className="flex-1" style={{ background: c }} />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-col px-4 py-3">
          <span className={`${ROW_TITLE} truncate`}>{name || t("Your theme")}</span>
          <span className={`${ROW_DESC} truncate`}>
            {author || t("you")} · {t("0 downloads")}
          </span>
          {blurb && <span className={`${ROW_DESC} mt-1 line-clamp-2`}>{blurb}</span>}
        </div>
      </div>
    </div>
  );
}
