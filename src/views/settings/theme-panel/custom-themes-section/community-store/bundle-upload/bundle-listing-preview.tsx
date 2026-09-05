import { Award, Medal, Star } from "lucide-react";
import { useT } from "@/lib/i18n";
import { ROW_TITLE } from "../../../../shared";
import type { BundleKind } from "./icon-keys";

const MAX_SWATCH = 6;

export function BundleListingPreview({
  kind,
  name,
  author,
  description,
  coverUrl,
  previews,
}: {
  kind: BundleKind;
  name: string;
  author: string;
  description: string;
  coverUrl: string | null;
  previews: string[];
}) {
  const t = useT();
  const Icon = kind === "badge" ? Medal : Award;
  const shown = previews.slice(0, MAX_SWATCH);
  const extra = previews.length - shown.length;
  return (
    <div className="flex flex-col gap-3">
      <span className="harbor-settings-label">{t("How it'll look")}</span>
      <div className="w-full max-w-[288px] overflow-hidden rounded-md bg-elevated">
        <div className="relative aspect-video w-full overflow-hidden bg-surface">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-surface to-elevated text-ink-subtle">
              <Icon size={30} strokeWidth={1.6} />
            </div>
          )}
          <span className="absolute bottom-2 end-2 flex h-[22px] items-center gap-1 rounded-[8px] bg-black/55 px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] text-white backdrop-blur-sm">
            <Star size={13} className="fill-accent text-accent" /> {t("new")}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-2 px-3.5 pb-3 pt-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={`truncate ${ROW_TITLE}`}>
              {name || (kind === "badge" ? t("Your badge pack") : t("Your award pack"))}
            </span>
            <span className="truncate text-[15.5px] leading-[22px] text-ink-subtle">
              {t("{author} · 0 installs", { author: author || t("you") })}
            </span>
          </div>
          {description && (
            <span className="line-clamp-2 max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
              {description}
            </span>
          )}
          {shown.length > 0 && (
            <div className="mt-0.5 flex items-center gap-1.5">
              {shown.map((p, i) => (
                <span
                  key={i}
                  className="grid h-[36px] w-[36px] shrink-0 place-items-center overflow-hidden rounded-md bg-surface"
                >
                  <img src={p} alt="" className="h-full w-full object-contain p-1" />
                </span>
              ))}
              {extra > 0 && (
                <span className="text-[15.5px] font-medium leading-[22px] tabular-nums text-ink-subtle">
                  +{extra}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
