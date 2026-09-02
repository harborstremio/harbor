import { Star } from "lucide-react";
import { useT } from "@/lib/i18n";

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
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
        {t("How it'll look")}
      </span>
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
          <div className="absolute bottom-2 end-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-sm">
            <Star size={10} className="fill-accent text-accent" /> {t("new")}
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex h-1.5">
            {swatch.map((c, i) => (
              <span key={i} className="flex-1" style={{ background: c }} />
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-col px-4 py-3">
          <span className="truncate text-[14.5px] font-semibold text-ink">
            {name || t("Your theme")}
          </span>
          <span className="truncate text-[11.5px] text-ink-subtle">
            {author || t("you")} · {t("0 downloads")}
          </span>
          {blurb && (
            <span className="mt-1 line-clamp-2 text-[12px] leading-snug text-ink-muted">
              {blurb}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
