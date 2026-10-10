import { HarborLoader } from "@/components/harbor-loader";
import { useT } from "@/lib/i18n";
import { useSectionBack } from "@/lib/section-back";
import graveyardScenery from "@/assets/spooktober-graveyard.svg?raw";
import "./spooktober-loading.css";

export function SpooktoberLoadingScene({ onBack }: { onBack?: () => void }) {
  const t = useT();
  useSectionBack(() => onBack?.(), Boolean(onBack));
  return (
    <section className="spooktober-loading-scene" role="status" aria-label={t("spooktober.loading")}>
      <div className="spooktober-loading-scenery" aria-hidden dangerouslySetInnerHTML={{ __html: graveyardScenery }} />
      <h1 className="spooktober-loading-title" aria-hidden>Spooktober</h1>
      <div className="spooktober-loading-boat" aria-hidden><HarborLoader size="sm" /><p>{t("spooktober.loading")}</p></div>
    </section>
  );
}
