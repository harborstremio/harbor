import { Blocks, Check, ChevronRight } from "lucide-react";
import { AddonLogo, resolveAddonLogo } from "@/components/addon-logo";
import type { AddonHit } from "@/lib/search-addon-index";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";

export function AddonHits({ hits, onClose }: { hits: AddonHit[]; onClose: () => void }) {
  const { openAddonDetail } = useView();
  const t = useT();
  if (hits.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
        <Blocks size={11} strokeWidth={2.2} />
        {t("Addons")}
      </h3>
      <div className="grid gap-1.5">
        {hits.map((a) => (
          <button
            key={a.id}
            onClick={() => {
              openAddonDetail(a.id);
              onClose();
            }}
            className="group flex items-center gap-4 rounded-2xl border border-transparent px-3 py-2.5 text-start transition-colors hover:border-edge-soft hover:bg-elevated/50 active:scale-[0.997]"
          >
            <AddonLogo
              addonId={a.id}
              addonName={a.name}
              manifestLogo={resolveAddonLogo(a.logo, a.transportUrl)}
              size="lg"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="truncate text-[16px] font-semibold text-ink">{a.name}</span>
                {a.installed && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-semibold text-accent">
                    <Check size={10} strokeWidth={3} />
                    {t("Installed")}
                  </span>
                )}
              </div>
              {a.blurb && (
                <span className="line-clamp-1 text-[12.5px] leading-snug text-ink-subtle">{a.blurb}</span>
              )}
            </div>
            <ChevronRight size={18} className="dir-icon shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
          </button>
        ))}
      </div>
    </section>
  );
}
