import { Award, Medal, Star } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { BundleKind } from "./icon-keys";

const MAX_SWATCH = 8;

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
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
        {t("How it'll look")}
      </span>
      <div className="w-full max-w-[280px] overflow-hidden rounded-md border border-edge-soft bg-surface shadow-[0_18px_40px_-24px_rgba(0,0,0,0.5)]">
        <div className="relative aspect-video w-full overflow-hidden bg-elevated">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-elevated to-surface text-ink-subtle">
              <Icon size={30} strokeWidth={1.6} />
            </div>
          )}
          <div className="absolute bottom-2 end-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-sm">
            <Star size={10} className="fill-accent text-accent" /> {t("new")}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[14.5px] font-semibold text-ink">
              {name || (kind === "badge" ? t("Your badge pack") : t("Your award pack"))}
            </span>
            <span className="truncate text-[11.5px] text-ink-subtle">
              {t("{author} · 0 installs", { author: author || t("you") })}
            </span>
          </div>
          {description && (
            <span className="line-clamp-2 text-[12px] leading-snug text-ink-muted">
              {description}
            </span>
          )}
          {shown.length > 0 && (
            <div className="mt-0.5 flex items-center gap-1.5">
              {shown.map((p, i) => (
                <span
                  key={i}
                  className="grid h-8 w-8 place-items-center overflow-hidden rounded-md border border-edge-soft bg-elevated/60"
                >
                  <img src={p} alt="" className="h-full w-full object-contain p-1" />
                </span>
              ))}
              {extra > 0 && (
                <span className="text-[11.5px] font-medium text-ink-subtle">+{extra}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
